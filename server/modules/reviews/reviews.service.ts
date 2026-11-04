import { createPageDto, type PageDto } from '../../shared/database/pagination';
import { BadRequestError, ForbiddenError } from '../../shared/database/errors';
import { findActiveMover, findUserRefs } from '../../shared/database/user-refs';
import type { ReviewDoc } from '../../shared/database/models/review.model';
import { moderateReview, suggestMoverReply } from '../ai/ai.analysis';
import { moderateReviewByRules } from '../ai/ai.fallback';
import type { Actor } from '../claims/claims.service';
import { reviewsRepository } from './reviews.repository';
import { serializeReview, type ReviewAudience, type ReviewResponse } from './reviews.serializer';
import {
  DuplicateReviewError,
  ReplyRejectedError,
  ReviewNotFoundError,
  ReviewNotPublicError,
} from './reviews.errors';
import type {
  ReviewAdminQuery,
  ReviewCreateInput,
  ReviewModerateInput,
  ReviewPartyQuery,
  ReviewReplyInput,
} from './reviews.schema';

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/** Reviews business rules (spec C-14 rating, A-09 moderation). */
export class ReviewsService {
  private async present(docs: ReviewDoc[], audience: ReviewAudience): Promise<ReviewResponse[]> {
    const users = await findUserRefs(docs.flatMap((doc) => [doc.clientId, doc.moverId]));
    return docs.map((doc) => serializeReview(doc, users, audience));
  }

  async create(actor: Actor, input: ReviewCreateInput): Promise<ReviewResponse> {
    if (actor.role !== 'CLIENT') throw new ForbiddenError('Only clients can review a mover');
    const mover = await findActiveMover(input.moverId);
    if (!mover) throw new BadRequestError('The selected mover does not exist or is not active');

    const moveReference = input.moveReference.toUpperCase();
    if (await reviewsRepository.exists(actor.sub, input.moverId, moveReference))
      throw new DuplicateReviewError();

    // Moderation BEFORE publishing: toxic reviews wait in the FLAGGED queue for staff.
    const moderation = await moderateReview({ comment: input.comment, rating: input.rating });

    try {
      const doc = await reviewsRepository.create({
        clientId: actor.sub,
        moverId: input.moverId,
        moveReference,
        rating: input.rating,
        punctuality: input.punctuality ?? null,
        care: input.care ?? null,
        communication: input.communication ?? null,
        comment: input.comment,
        status: moderation.result.toxic ? 'FLAGGED' : 'PUBLISHED',
        moderation: {
          ...moderation.result,
          source: moderation.source,
          model: moderation.model,
          createdAt: new Date(),
        },
        moderationNote: null,
        moderatedBy: null,
        moverReply: null,
      });
      await reviewsRepository.syncMoverRating(input.moverId);
      const [review] = await this.present([doc], 'author');
      return review!;
    } catch (error) {
      // Race between the exists() check and insert: the unique index is the real guard.
      if (isDuplicateKey(error)) throw new DuplicateReviewError();
      throw error;
    }
  }

  /** Client → reviews they wrote (any status). Mover → published reviews about them. */
  async listForParty(actor: Actor, query: ReviewPartyQuery): Promise<PageDto<ReviewResponse>> {
    if (actor.role === 'ADMIN') throw new ForbiddenError('Use the back-office endpoint');
    const where =
      actor.role === 'CLIENT'
        ? { clientId: actor.sub }
        : { moverId: actor.sub, status: 'PUBLISHED' };
    const { docs, itemCount } = await reviewsRepository.paginate(where, query.page, query.limit);
    const audience: ReviewAudience = actor.role === 'CLIENT' ? 'author' : 'public';
    return createPageDto(await this.present(docs, audience), query.page, query.limit, itemCount);
  }

  private async loadForMover(actor: Actor, id: string): Promise<ReviewDoc> {
    if (actor.role !== 'MOVER') throw new ForbiddenError('Only the reviewed mover can reply');
    const doc = await reviewsRepository.findById(id);
    if (!doc || doc.moverId !== actor.sub) throw new ReviewNotFoundError();
    if (doc.status !== 'PUBLISHED') throw new ReviewNotPublicError();
    return doc;
  }

  async reply(actor: Actor, id: string, input: ReviewReplyInput): Promise<ReviewResponse> {
    await this.loadForMover(actor, id);
    // Replies are public too: the same hard rules (no insults, no phone numbers) apply.
    const check = moderateReviewByRules({ comment: input.text, rating: 3 });
    if (check.toxic) throw new ReplyRejectedError(check.reasons.join(', ').toLowerCase());
    const updated = await reviewsRepository.update(id, {
      moverReply: { text: input.text, createdAt: new Date() },
    });
    if (!updated) throw new ReviewNotFoundError();
    const [review] = await this.present([updated], 'public');
    return review!;
  }

  async suggestReply(actor: Actor, id: string) {
    const doc = await this.loadForMover(actor, id);
    const users = await findUserRefs([actor.sub]);
    return suggestMoverReply({
      moverName: users.get(actor.sub)?.name ?? 'our team',
      rating: doc.rating,
      comment: doc.comment,
    });
  }

  /** Public profile block: rating summary + latest published reviews. */
  async moverProfile(moverId: string) {
    const mover = await findActiveMover(moverId);
    if (!mover) throw new ReviewNotFoundError();
    const [summary, latest] = await Promise.all([
      reviewsRepository.summary(moverId),
      reviewsRepository.findLatest({ moverId, status: 'PUBLISHED' }, 5),
    ]);
    return {
      mover: { id: mover.id, name: mover.name },
      summary,
      latest: await this.present(latest, 'public'),
    };
  }

  async adminList(query: ReviewAdminQuery): Promise<PageDto<ReviewResponse>> {
    const where: Record<string, unknown> = {};
    if (query.status !== 'ALL') where.status = query.status;
    if (query.sentiment !== 'ALL') where['moderation.sentiment'] = query.sentiment;
    if (query.maxRating) where.rating = { $lte: query.maxRating };
    if (query.moverId) where.moverId = query.moverId;
    const { docs, itemCount } = await reviewsRepository.paginate(where, query.page, query.limit);
    return createPageDto(await this.present(docs, 'staff'), query.page, query.limit, itemCount);
  }

  async adminModerate(
    actor: Actor,
    id: string,
    input: ReviewModerateInput,
  ): Promise<ReviewResponse> {
    if (actor.role !== 'ADMIN') throw new ForbiddenError();
    const doc = await reviewsRepository.findById(id);
    if (!doc) throw new ReviewNotFoundError();
    const updated = await reviewsRepository.update(id, {
      status: input.status,
      moderationNote: input.note ?? null,
      moderatedBy: actor.sub,
    });
    if (!updated) throw new ReviewNotFoundError();
    await reviewsRepository.syncMoverRating(doc.moverId);
    const [review] = await this.present([updated], 'staff');
    return review!;
  }

  async stats() {
    const [byStatus, summary, negative] = await Promise.all([
      reviewsRepository.countByStatus(),
      reviewsRepository.summary(),
      reviewsRepository.countNegative(),
    ]);
    return { byStatus, averageRating: summary.average, published: summary.count, negative };
  }

  /** Material for AI insights: latest published comments (no names, no ids). */
  async corpusForInsights(moverId?: string): Promise<{ rating: number; comment: string }[]> {
    const where: Record<string, unknown> = { status: 'PUBLISHED' };
    if (moverId) where.moverId = moverId;
    const docs = await reviewsRepository.findLatest(where, 40);
    return docs.map((doc) => ({ rating: doc.rating, comment: doc.comment }));
  }
}

export const reviewsService = new ReviewsService();
