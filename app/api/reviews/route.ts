export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { errorResponse, requireRole } from '@/server/shared/auth/guards';
import { parseBody, parseQuery } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import {
  ReviewCreateSchema,
  ReviewPartyQuerySchema,
  reviewsService,
} from '@/server/modules/reviews';

/** GET /api/reviews — client: reviews I wrote · mover: published reviews about me. */
export async function GET(request: Request) {
  try {
    const user = await requireRole(request, ['CLIENT', 'MOVER']);
    return NextResponse.json(
      await reviewsService.listForParty(user, parseQuery(request, ReviewPartyQuerySchema)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/reviews — REST twin of the `createReviewAction` Server Action. */
export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ['CLIENT']);
    const review = await reviewsService.create(user, await parseBody(request, ReviewCreateSchema));
    logEvent({
      event: EventType.REVIEW_CREATE,
      userId: user.sub,
      method: 'POST',
      api: '/api/reviews',
      logInfo: { reviewId: review.id, status: review.status },
    });
    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
