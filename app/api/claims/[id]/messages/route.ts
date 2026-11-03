import { NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimMessageSchema, claimsService } from '@/server/modules/claims';

/** POST /api/claims/:id/messages — add a message to the claim conversation. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const claim = await claimsService.addMessage(
      user,
      id,
      await parseBody(request, ClaimMessageSchema),
    );
    logEvent({
      event: EventType.CLAIM_MESSAGE,
      userId: user.sub,
      method: 'POST',
      api: `/api/claims/${id}/messages`,
      logInfo: { claimId: id },
    });
    return NextResponse.json({ claim });
  } catch (error) {
    return errorResponse(error);
  }
}
