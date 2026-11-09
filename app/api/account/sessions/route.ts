import { NextRequest, NextResponse } from 'next/server';
import { accountService } from '@/server/modules/account';
import { REFRESH_COOKIE } from '@/server/modules/auth/auth.controller';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { EventType, logEvent } from '@/server/shared/logger/audit';

/** GET /api/account/sessions — active refresh sessions; the caller's own is flagged. */
export async function GET(request: NextRequest) {
  try {
    const me = await requireAuth(request);
    const sessions = await accountService.listSessions(
      me.sub,
      request.cookies.get(REFRESH_COOKIE)?.value ?? null,
    );
    return NextResponse.json({ sessions });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/account/sessions — sign out every other device. */
export async function DELETE(request: NextRequest) {
  try {
    const me = await requireAuth(request);
    const revoked = await accountService.revokeOtherSessions(
      me.sub,
      request.cookies.get(REFRESH_COOKIE)?.value ?? null,
    );
    logEvent({
      event: EventType.SESSION_REVOKE,
      userId: me.sub,
      method: 'DELETE',
      api: '/api/account/sessions',
      logInfo: { scope: 'others', revoked: String(revoked) },
    });
    return NextResponse.json({ revoked });
  } catch (error) {
    return errorResponse(error);
  }
}
