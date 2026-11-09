export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { errorResponse } from '@/server/shared/auth/guards';
import { reviewsService } from '@/server/modules/reviews';

/** GET /api/movers/:id/reviews — PUBLIC rating summary + latest published reviews. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(await reviewsService.moverProfile(id), {
      // Public & cacheable: the service worker uses stale-while-revalidate on this route.
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
