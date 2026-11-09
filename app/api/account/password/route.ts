import { NextRequest, NextResponse } from 'next/server';
import { accountService, PasswordChangeSchema } from '@/server/modules/account';
import { REFRESH_COOKIE } from '@/server/modules/auth/auth.controller';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

/** PATCH /api/account/password — verify current password, set a new one. */
export async function PATCH(request: NextRequest) {
  try {
    const me = await requireAuth(request);
    const parsed = PasswordChangeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError('Invalid password data', parsed.error.flatten());

    const result = await accountService.changePassword(
      me.sub,
      parsed.data,
      request.cookies.get(REFRESH_COOKIE)?.value ?? null,
    );
    logEvent({
      event: EventType.PASSWORD_CHANGE,
      userId: me.sub,
      method: 'PATCH',
      api: '/api/account/password',
      logInfo: { revokedSessions: String(result.revokedSessions) },
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
