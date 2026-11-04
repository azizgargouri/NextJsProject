import { NextResponse } from 'next/server';
import { adminService } from '@/server/modules/admin';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ManagedUserCreateSchema } from '@/server/modules/users/users.schema';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    return NextResponse.json(await adminService.listUsers(url.searchParams));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const parsed = ManagedUserCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid user data', parsed.error.flatten());
    }

    const user = await adminService.createUser(parsed.data);
    logEvent({
      event: EventType.USER_CREATE,
      userId: actor.sub,
      method: 'POST',
      api: '/api/admin/users',
      logInfo: { targetUserId: user.id },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
