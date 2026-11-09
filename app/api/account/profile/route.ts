import { NextResponse } from 'next/server';
import { accountService, ProfileUpdateSchema } from '@/server/modules/account';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

/** GET /api/account/profile — the signed-in user's own profile. */
export async function GET(request: Request) {
  try {
    const me = await requireAuth(request);
    return NextResponse.json({ user: await accountService.getProfile(me.sub) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH /api/account/profile — name, phone and preferred locale. */
export async function PATCH(request: Request) {
  try {
    const me = await requireAuth(request);
    const parsed = ProfileUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ValidationError('Invalid profile data', parsed.error.flatten());

    const user = await accountService.updateProfile(me.sub, parsed.data);
    logEvent({
      event: EventType.PROFILE_UPDATE,
      userId: me.sub,
      method: 'PATCH',
      api: '/api/account/profile',
      logInfo: { fields: Object.keys(parsed.data).join(',') },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
