/**
 * Unit tests for the quality domain's pure logic (no database, no network, no LLM).
 * Run: yarn test   (node:test runner through tsx)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionClaim } from '../lib/quality/constants';
import {
  ClaimTriageSchema,
  ReviewInsightsSchema,
  ReviewModerationSchema,
} from '../lib/quality/ai-schemas';
import { moderateReviewByRules, triageClaimByRules } from '../server/modules/ai/ai.fallback';
import { insightsByRules } from '../server/modules/ai/ai.insights';
import { ClaimAdminUpdateSchema, ClaimCreateSchema } from '../server/modules/claims/claims.schema';
import { serializeClaim } from '../server/modules/claims/claims.serializer';
import { ReviewCreateSchema } from '../server/modules/reviews/reviews.schema';
import { publicName } from '../server/modules/reviews/reviews.serializer';
import type { ClaimDoc } from '../server/shared/database/models/claim.model';

describe('claim status machine', () => {
  it('allows the normal flow OPEN → UNDER_REVIEW → RESOLVED', () => {
    assert.equal(canTransitionClaim('OPEN', 'UNDER_REVIEW'), true);
    assert.equal(canTransitionClaim('UNDER_REVIEW', 'RESOLVED'), true);
  });
  it('forbids skipping review or editing a closed claim', () => {
    assert.equal(canTransitionClaim('OPEN', 'RESOLVED'), false);
    assert.equal(canTransitionClaim('RESOLVED', 'REJECTED'), false);
    assert.equal(canTransitionClaim('REJECTED', 'OPEN'), false);
  });
  it('lets staff reopen a closed claim into review', () => {
    assert.equal(canTransitionClaim('RESOLVED', 'UNDER_REVIEW'), true);
  });
});

describe('rule-based claim triage (AI fallback)', () => {
  it('detects damage in French and keeps the Zod contract', () => {
    const triage = triageClaimByRules({
      subject: 'Table cassée',
      description: 'La table en verre est arrivée cassée. Je demande un remboursement.',
      amountClaimed: 300,
    });
    assert.equal(triage.category, 'DAMAGE');
    assert.equal(ClaimTriageSchema.safeParse(triage).success, true);
  });
  it('escalates safety words to URGENT and high amounts to HIGH', () => {
    assert.equal(
      triageClaimByRules({
        subject: 'Accident',
        description: 'A worker was injured on the stairs.',
        amountClaimed: null,
      }).priority,
      'URGENT',
    );
    assert.equal(
      triageClaimByRules({
        subject: 'Missing box',
        description: 'One box is missing since the move.',
        amountClaimed: 50,
      }).priority,
      'HIGH',
    );
  });
  it('falls back to the client category when nothing matches', () => {
    assert.equal(
      triageClaimByRules({
        subject: 'Question',
        description: 'Something about my move happened yesterday.',
        amountClaimed: null,
        category: 'BILLING',
      }).category,
      'BILLING',
    );
  });
});

describe('rule-based review moderation', () => {
  it('lets an honest negative review through', () => {
    const result = moderateReviewByRules({
      comment: 'They were two hours late and the sofa got scratched.',
      rating: 2,
    });
    assert.equal(result.toxic, false);
    assert.equal(result.sentiment, 'NEGATIVE');
    assert.ok(result.topics.includes('PUNCTUALITY'));
    assert.equal(ReviewModerationSchema.safeParse(result).success, true);
  });
  it('flags insults and personal contact details', () => {
    assert.equal(
      moderateReviewByRules({ comment: 'Bande de voleurs, idiot!', rating: 1 }).toxic,
      true,
    );
    const phone = moderateReviewByRules({
      comment: 'Great job, call me on +216 55 123 456',
      rating: 5,
    });
    assert.equal(phone.toxic, true);
    assert.match(phone.reasons.join(), /contact/i);
  });
});

describe('Zod input contracts', () => {
  it('coerces FormData strings and drops empty optionals', () => {
    const parsed = ClaimCreateSchema.parse({
      subject: 'Broken mirror',
      description: 'The mirror was broken when the movers unloaded the truck.',
      category: 'DAMAGE',
      moverId: '',
      moveReference: '',
      amountClaimed: '120.5',
    });
    assert.equal(parsed.amountClaimed, 120.5);
    assert.equal(parsed.moverId, undefined);
    assert.equal(parsed.moveReference, undefined);
  });
  it('rejects a too-short description and an invalid rating', () => {
    assert.equal(
      ClaimCreateSchema.safeParse({ subject: 'Hello', description: 'short', category: 'DAMAGE' })
        .success,
      false,
    );
    assert.equal(
      ReviewCreateSchema.safeParse({
        moverId: 'a'.repeat(24),
        moveReference: 'MV-1',
        rating: '6',
        comment: 'Very good movers overall.',
      }).success,
      false,
    );
  });
  it('refuses an empty admin update', () => {
    assert.equal(ClaimAdminUpdateSchema.safeParse({}).success, false);
  });
});

describe('serializers (whitelists)', () => {
  const doc = {
    _id: 'c1',
    reference: 'CLM-261104-AB12',
    clientId: 'u1',
    moverId: 'm1',
    moveReference: 'MV-1',
    category: 'DAMAGE',
    priority: 'HIGH',
    status: 'OPEN',
    subject: 'Broken table',
    description: 'Broken during unloading',
    amountClaimed: 200,
    aiTriage: {
      source: 'rules',
      category: 'DAMAGE',
      priority: 'HIGH',
      summary: 's',
      suggestedAction: 'a',
      sentiment: 'NEGATIVE',
      confidence: 0.6,
      model: null,
      createdAt: new Date(),
    },
    resolution: null,
    timeline: [
      {
        kind: 'MESSAGE',
        authorId: 'admin1',
        authorRole: 'ADMIN',
        text: 'We are on it',
        status: null,
        createdAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as ClaimDoc;
  const users = new Map([
    ['u1', { id: 'u1', name: 'Amira Ben Salah', email: 'a@x.tn' }],
    ['admin1', { id: 'admin1', name: 'Sami (staff)', email: 's@x.tn' }],
  ]);

  it('hides priority, AI triage and staff identity from parties', () => {
    const party = serializeClaim(doc, users, 'party');
    assert.equal(party.priority, undefined);
    assert.equal(party.aiTriage, undefined);
    assert.equal(party.client?.email, undefined);
    assert.equal(party.timeline[0]?.author?.name, 'MoveUp support');
  });
  it('exposes the triage to staff', () => {
    const staff = serializeClaim(doc, users, 'staff');
    assert.equal(staff.priority, 'HIGH');
    assert.equal(staff.aiTriage?.source, 'rules');
  });
  it('shortens client names on public pages', () => {
    assert.equal(publicName('Amira Ben Salah'), 'Amira B.');
    assert.equal(publicName('Mehdi'), 'Mehdi');
  });
});

describe('rule-based review insights', () => {
  it('produces a schema-valid summary', () => {
    const insights = insightsByRules([
      { rating: 5, comment: 'Very professional and careful with fragile items' },
      { rating: 1, comment: 'Three hours late, no call' },
    ]);
    assert.equal(ReviewInsightsSchema.safeParse(insights).success, true);
    assert.ok(insights.issues.some((issue) => /punctuality/i.test(issue)));
  });
});
