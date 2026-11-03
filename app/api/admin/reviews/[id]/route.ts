import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ReviewModerateSchema, reviewsService } from '@/server/modules/reviews';

/** PATCH /api/admin/reviews/:id — publish, hide or keep flagged (recomputes the mover rating). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const review = await reviewsService.adminModerate(
      actor,
      id,
      await parseBody(request, ReviewModerateSchema),
    );
    logEvent({
      event: EventType.REVIEW_MODERATE,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/reviews/${id}`,
      logInfo: { reviewId: id, status: review.status },
    });
    return NextResponse.json({ review });
  } catch (error) {
    return errorResponse(error);
  }
}
