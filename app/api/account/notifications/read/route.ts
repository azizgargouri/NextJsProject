import { NextResponse } from 'next/server';
import { accountService } from '@/server/modules/account';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';

/** POST /api/account/notifications/read — mark everything up to now as read. */
export async function POST(request: Request) {
  try {
    const me = await requireAuth(request);
    return NextResponse.json(await accountService.markNotificationsRead(me.sub));
  } catch (error) {
    return errorResponse(error);
  }
}
