export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { adminService } from '@/server/modules/admin';
import { ManagedUserUpdateSchema } from '@/server/modules/users/users.schema';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin(request);
    const { id } = await params;
    return NextResponse.json({ user: await adminService.getUser(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const parsed = ManagedUserUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid user data', parsed.error.flatten());
    }

    const { id } = await params;
    const user = await adminService.updateUser(actor.sub, id, parsed.data);
    logEvent({
      event: EventType.USER_UPDATE,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/users/${id}`,
      logInfo: { targetUserId: id },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const user = await adminService.deleteUser(actor.sub, id);
    logEvent({
      event: EventType.USER_DELETE,
      userId: actor.sub,
      method: 'DELETE',
      api: `/api/admin/users/${id}`,
      logInfo: { targetUserId: id },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
