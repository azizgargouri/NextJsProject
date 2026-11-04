import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { parseQuery } from '@/server/shared/http/validate';
import { ReviewAdminQuerySchema, reviewsService } from '@/server/modules/reviews';

/** GET /api/admin/reviews — moderation queue (status, sentiment, max rating, mover). */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    return NextResponse.json(
      await reviewsService.adminList(parseQuery(request, ReviewAdminQuerySchema)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
