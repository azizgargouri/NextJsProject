export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminService } from '@/server/modules/admin';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

const UpdateStatusSchema = z.object({ status: z.enum(['ACTIVE', 'BLOCKED']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireAdmin(request);
    const parsed = UpdateStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid user status', parsed.error.flatten());
    }

    const { id } = await params;
    const user = await adminService.setUserStatus(actor.sub, id, parsed.data.status);
    logEvent({
      event: EventType.USER_STATUS,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/users/${id}/status`,
      logInfo: { targetUserId: id, status: parsed.data.status },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
