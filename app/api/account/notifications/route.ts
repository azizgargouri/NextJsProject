import { NextResponse } from 'next/server';
import { accountService, NotificationsQuerySchema } from '@/server/modules/account';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';

/** GET /api/account/notifications — activity relevant to the caller, newest first. */
export async function GET(request: Request) {
  try {
    const me = await requireAuth(request);
    const url = new URL(request.url);
    const parsed = NotificationsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) throw new ValidationError('Invalid query', parsed.error.flatten());
    return NextResponse.json(await accountService.listNotifications(me.sub, me.role, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}
