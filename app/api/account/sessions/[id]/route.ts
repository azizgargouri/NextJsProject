import { NextRequest, NextResponse } from 'next/server';
import { accountService } from '@/server/modules/account';
import { REFRESH_COOKIE } from '@/server/modules/auth/auth.controller';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { NotFoundError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

type RouteContext = { params: Promise<{ id: string }> };

/** DELETE /api/account/sessions/:id — sign out one other device. */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const me = await requireAuth(request);
    const { id } = await params;
    if (!/^[a-f0-9]{24}$/.test(id)) throw new NotFoundError('Session');

    await accountService.revokeSession(
      me.sub,
      id,
      request.cookies.get(REFRESH_COOKIE)?.value ?? null,
    );
    logEvent({
      event: EventType.SESSION_REVOKE,
      userId: me.sub,
      method: 'DELETE',
      api: `/api/account/sessions/${id}`,
      logInfo: { scope: 'single', sessionId: id },
    });
    return NextResponse.json({ revoked: 1 });
  } catch (error) {
    return errorResponse(error);
  }
}
