export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimAdminUpdateSchema, claimsService } from '@/server/modules/claims';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json({ claim: await claimsService.getForActor(actor, id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/admin/claims/:id — status transition, priority, staff note or final resolution. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const input = await parseBody(request, ClaimAdminUpdateSchema);
    const claim = await claimsService.adminUpdate(actor, id, input);
    logEvent({
      event: EventType.CLAIM_STATUS,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/claims/${id}`,
      logInfo: { claimId: id, reference: claim.reference, status: claim.status },
    });
    return NextResponse.json({ claim });
  } catch (error) {
    return errorResponse(error);
  }
}
