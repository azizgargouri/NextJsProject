import { NextResponse } from 'next/server';
import { errorResponse, requireRole } from '@/server/shared/auth/guards';
import { parseBody, parseQuery } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimCreateSchema, ClaimPartyQuerySchema, claimsService } from '@/server/modules/claims';

/** GET /api/claims — client: claims I opened · mover: claims about me. */
export async function GET(request: Request) {
  try {
    const user = await requireRole(request, ['CLIENT', 'MOVER']);
    return NextResponse.json(
      await claimsService.listForParty(user, parseQuery(request, ClaimPartyQuerySchema)),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST /api/claims — REST twin of the `createClaimAction` Server Action (mobile / API clients). */
export async function POST(request: Request) {
  try {
    const user = await requireRole(request, ['CLIENT']);
    const claim = await claimsService.create(user, await parseBody(request, ClaimCreateSchema));
    logEvent({
      event: EventType.CLAIM_CREATE,
      userId: user.sub,
      method: 'POST',
      api: '/api/claims',
      logInfo: { claimId: claim.id, reference: claim.reference },
    });
    return NextResponse.json({ claim }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
