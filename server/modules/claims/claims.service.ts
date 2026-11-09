import { createPageDto, type PageDto } from '../../shared/database/pagination';
import { BadRequestError, ForbiddenError } from '../../shared/database/errors';
import { findActiveMover, findUserRefs } from '../../shared/database/user-refs';
import { canTransitionClaim, type ClaimStatus, type Role } from '../../shared/database/enums';
import type {
  ClaimDoc,
  ClaimEvent,
  ClaimMediationDoc,
  ClaimVisionAnalysisDoc,
} from '../../shared/database/models/claim.model';
import {
  analyzeClaimEvidencePhotos,
  suggestClaimThreadMessage,
  triageClaim,
} from '../ai/ai.analysis';
import { claimsRepository } from './claims.repository';
import {
  claimUserIds,
  serializeClaim,
  type ClaimAudience,
  type ClaimResponse,
} from './claims.serializer';
import {
  ClaimClosedError,
  ClaimNotFoundError,
  DuplicateOpenClaimError,
  InvalidClaimTransitionError,
  ResolutionRequiredError,
} from './claims.errors';
import type {
  ClaimAdminQuery,
  ClaimAdminUpdateInput,
  ClaimCreateInput,
  ClaimMessageInput,
  ClaimPartyQuery,
} from './claims.schema';

/** Who is acting — always resolved server-side from the database (never from the client). */
export interface Actor {
  sub: string;
  role: Role;
}

const CLOSED: ClaimStatus[] = ['RESOLVED', 'REJECTED'];

function event(
  actor: Actor,
  kind: ClaimEvent['kind'],
  text: string,
  status: ClaimStatus | null = null,
): ClaimEvent {
  return { kind, authorId: actor.sub, authorRole: actor.role, text, status, createdAt: new Date() };
}

function newReference(): string {
  const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
  return `CLM-${date}-${suffix}`;
}

/**
 * Claims business rules (spec A-08). Controllers stay thin: they authenticate,
 * validate with Zod, then call exactly one method here.
 */
export class ClaimsService {
  private async present(docs: ClaimDoc[], audience: ClaimAudience): Promise<ClaimResponse[]> {
    const users = await findUserRefs(claimUserIds(docs));
    return docs.map((doc) => serializeClaim(doc, users, audience));
  }

  private async presentOne(doc: ClaimDoc, audience: ClaimAudience): Promise<ClaimResponse> {
    const [claim] = await this.present([doc], audience);
    return claim!;
  }

  /** A claim is visible to its client, the mover it targets, and staff — 404 for anyone else. */
  private async loadVisible(actor: Actor, id: string): Promise<ClaimDoc> {
    const doc = await claimsRepository.findById(id);
    if (!doc) throw new ClaimNotFoundError();
    const visible =
      actor.role === 'ADMIN' ||
      (actor.role === 'CLIENT' && doc.clientId === actor.sub) ||
      (actor.role === 'MOVER' && doc.moverId === actor.sub);
    if (!visible) throw new ClaimNotFoundError();
    return doc;
  }

  async create(actor: Actor, input: ClaimCreateInput): Promise<ClaimResponse> {
    if (actor.role !== 'CLIENT') throw new ForbiddenError('Only clients can open a claim');

    if (input.moverId && !(await findActiveMover(input.moverId))) {
      throw new BadRequestError('The selected mover does not exist or is not active');
    }

    const moveReference = input.moveReference?.toUpperCase() ?? null;
    if (moveReference) {
      const open = await claimsRepository.findActiveForMove(actor.sub, moveReference);
      if (open) throw new DuplicateOpenClaimError(open.reference);
    }

    const evidencePhotos = Array.isArray(input.evidencePhotos) ? input.evidencePhotos : [];

    // Vision AI runs on attached photos (or uses the pre-scanned client result).
    let visionAnalysis: ClaimVisionAnalysisDoc | null = null;
    if (input.visionAnalysisJson) {
      visionAnalysis = {
        ...input.visionAnalysisJson,
        source: 'rules',
        model: null,
        analyzedAt: new Date(),
      };
    } else if (evidencePhotos.length > 0) {
      const vision = await analyzeClaimEvidencePhotos({
        images: evidencePhotos,
        hint: `${input.subject} — ${input.description}`,
      });
      visionAnalysis = {
        ...vision.result,
        source: vision.source,
        model: vision.model,
        analyzedAt: new Date(),
      };
    }

    // AI triage (or rule fallback) runs before saving so staff see it immediately.
    const triage = await triageClaim({
      subject: input.subject,
      description: input.description,
      amountClaimed: input.amountClaimed ?? visionAnalysis?.recommendedClaimAmountTnd ?? null,
      category: input.category,
    });

    const doc = await claimsRepository.create({
      reference: newReference(),
      clientId: actor.sub,
      moverId: input.moverId ?? null,
      moveReference,
      category: input.category,
      priority: triage.result.priority,
      status: 'OPEN',
      subject: input.subject,
      description: input.description,
      amountClaimed: input.amountClaimed ?? null,
      evidencePhotos,
      visionAnalysis,
      aiTriage: {
        ...triage.result,
        source: triage.source,
        model: triage.model,
        createdAt: new Date(),
      },
      aiMediation: null,
      resolution: null,
      timeline: [event(actor, 'CREATED', 'Claim submitted', 'OPEN')],
    });

    return this.presentOne(doc, 'party');
  }

  async listForParty(actor: Actor, query: ClaimPartyQuery): Promise<PageDto<ClaimResponse>> {
    if (actor.role === 'ADMIN') throw new ForbiddenError('Use the back-office endpoint');
    const where: Record<string, unknown> =
      actor.role === 'CLIENT' ? { clientId: actor.sub } : { moverId: actor.sub };
    if (query.status !== 'ALL') where.status = query.status;
    const { docs, itemCount } = await claimsRepository.paginate(where, query.page, query.limit);
    return createPageDto(await this.present(docs, 'party'), query.page, query.limit, itemCount);
  }

  async getForActor(actor: Actor, id: string): Promise<ClaimResponse> {
    const doc = await this.loadVisible(actor, id);
    return this.presentOne(doc, actor.role === 'ADMIN' ? 'staff' : 'party');
  }

  /** Conversation on a claim: client, targeted mover, or staff. Closed claims are read-only for parties. */
  async addMessage(actor: Actor, id: string, input: ClaimMessageInput): Promise<ClaimResponse> {
    const doc = await this.loadVisible(actor, id);
    if (actor.role !== 'ADMIN' && CLOSED.includes(doc.status)) throw new ClaimClosedError();
    const updated = await claimsRepository.update(id, {}, [event(actor, 'MESSAGE', input.text)]);
    if (!updated) throw new ClaimNotFoundError();
    return this.presentOne(updated, actor.role === 'ADMIN' ? 'staff' : 'party');
  }

  /** AI communication coach (generateText in Server Action): drafts a polite reply for the claim thread. */
  async suggestMessage(actor: Actor, id: string) {
    const doc = await this.loadVisible(actor, id);
    const actorRole = actor.role === 'MOVER' ? 'MOVER' : 'CLIENT';
    const lastMessage = [...(doc.timeline ?? [])]
      .reverse()
      .find((ev) => ev.kind === 'MESSAGE' && ev.text?.trim());
    const visionSummary = doc.visionAnalysis
      ? `${doc.visionAnalysis.detectedItems.length} item(s), overall damage rate ${doc.visionAnalysis.overallDamageRatePct ?? 65}%, recommended ${doc.visionAnalysis.recommendedClaimAmountTnd} TND`
      : null;

    return suggestClaimThreadMessage({
      actorRole,
      reference: doc.reference,
      category: doc.category,
      subject: doc.subject,
      amountClaimed: doc.amountClaimed ?? null,
      visionSummary,
      lastMessageText: lastMessage?.text ?? null,
    });
  }

  async adminList(query: ClaimAdminQuery): Promise<PageDto<ClaimResponse>> {
    const where: Record<string, unknown> = {};
    if (query.status !== 'ALL') where.status = query.status;
    if (query.priority !== 'ALL') where.priority = query.priority;
    if (query.category !== 'ALL') where.category = query.category;
    if (query.severity && query.severity !== 'ALL') {
      where['visionAnalysis.overallSeverity'] = query.severity;
    }
    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      where.$or = [
        { reference: { $regex: escaped, $options: 'i' } },
        { subject: { $regex: escaped, $options: 'i' } },
        { moveReference: { $regex: escaped, $options: 'i' } },
      ];
    }
    const { docs, itemCount } = await claimsRepository.paginate(where, query.page, query.limit);
    return createPageDto(await this.present(docs, 'staff'), query.page, query.limit, itemCount);
  }

  async adminUpdate(
    actor: Actor,
    id: string,
    input: ClaimAdminUpdateInput,
  ): Promise<ClaimResponse> {
    if (actor.role !== 'ADMIN') throw new ForbiddenError();
    const doc = await claimsRepository.findById(id);
    if (!doc) throw new ClaimNotFoundError();

    const set: Partial<Pick<ClaimDoc, 'status' | 'priority' | 'resolution'>> = {};
    const events: ClaimEvent[] = [];
    const nextStatus = input.status ?? (input.resolution ? 'RESOLVED' : doc.status);

    if (nextStatus !== doc.status) {
      if (!canTransitionClaim(doc.status, nextStatus))
        throw new InvalidClaimTransitionError(doc.status, nextStatus);
      set.status = nextStatus;
    }

    if (nextStatus === 'RESOLVED' && doc.status !== 'RESOLVED') {
      if (!input.resolution) throw new ResolutionRequiredError();
      set.resolution = {
        outcome: input.resolution.outcome,
        amount: input.resolution.amount ?? null,
        note: input.resolution.note,
        resolvedBy: actor.sub,
        resolvedAt: new Date(),
      };
      events.push(event(actor, 'RESOLUTION', input.resolution.note, 'RESOLVED'));
    } else if (set.status) {
      // Reopening clears the previous decision so the record never shows a stale outcome.
      if (CLOSED.includes(doc.status)) set.resolution = null;
      events.push(event(actor, 'STATUS_CHANGED', input.note ?? '', set.status));
    } else if (input.note) {
      events.push(event(actor, 'MESSAGE', input.note));
    }

    if (input.priority && input.priority !== doc.priority) set.priority = input.priority;

    const updated = await claimsRepository.update(id, set, events);
    if (!updated) throw new ClaimNotFoundError();
    return this.presentOne(updated, 'staff');
  }

  async saveMediation(id: string, mediation: ClaimMediationDoc): Promise<void> {
    await claimsRepository.update(id, { aiMediation: mediation }, []);
  }

  async countForMover(moverId: string): Promise<number> {
    const page = await claimsRepository.paginate({ moverId }, 1, 1);
    return page.itemCount;
  }

  async stats() {
    const [byStatus, urgentOpen, avgResolutionHours] = await Promise.all([
      claimsRepository.countByStatus(),
      claimsRepository.countOpenUrgent(),
      claimsRepository.averageResolutionHours(),
    ]);
    return { byStatus, urgentOpen, avgResolutionHours };
  }

  /** Compact rows for the AI assistant tools (no free text beyond the subject). */
  async briefForActor(actor: Actor, status?: ClaimStatus) {
    const where: Record<string, unknown> =
      actor.role === 'ADMIN'
        ? {}
        : actor.role === 'CLIENT'
          ? { clientId: actor.sub }
          : { moverId: actor.sub };
    if (status) where.status = status;
    const docs = await claimsRepository.findRecent(where, 10);
    return docs.map((doc) => ({
      reference: doc.reference,
      subject: doc.subject,
      status: doc.status,
      category: doc.category,
      updatedAt: new Date(doc.updatedAt ?? doc.createdAt ?? Date.now()).toISOString().slice(0, 10),
      resolution: doc.resolution ? `${doc.resolution.outcome}: ${doc.resolution.note}` : null,
    }));
  }

  async findByReferenceForActor(actor: Actor, reference: string): Promise<ClaimResponse | null> {
    const doc = await claimsRepository.findByReference(reference);
    if (!doc) return null;
    try {
      return await this.getForActor(actor, String(doc._id));
    } catch {
      return null;
    }
  }
}

export const claimsService = new ClaimsService();
