import { NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { claimsService } from '@/server/modules/claims';

/** GET /api/claims/:id — visible to the client, the targeted mover and staff (404 otherwise). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    return NextResponse.json({ claim: await claimsService.getForActor(user, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
