import { NextResponse } from 'next/server';
import { errorResponse, requireRole } from '@/server/shared/auth/guards';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ReviewReplySchema, reviewsService } from '@/server/modules/reviews';

/** POST /api/reviews/:id/reply — the reviewed mover answers publicly. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole(request, ['MOVER']);
    const { id } = await params;
    const review = await reviewsService.reply(
      user,
      id,
      await parseBody(request, ReviewReplySchema),
    );
    logEvent({
      event: EventType.REVIEW_REPLY,
      userId: user.sub,
      method: 'POST',
      api: `/api/reviews/${id}/reply`,
      logInfo: { reviewId: id },
    });
    return NextResponse.json({ review });
  } catch (error) {
    return errorResponse(error);
  }
}
