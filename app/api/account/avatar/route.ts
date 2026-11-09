import { NextResponse } from 'next/server';
import { accountService, AVATAR_MAX_BYTES } from '@/server/modules/account';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { PayloadTooLargeError, ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

/** POST /api/account/avatar — multipart `file` (PNG, JPEG or WebP, 2 MB max). */
export async function POST(request: Request) {
  try {
    const me = await requireAuth(request);
    const declared = Number(request.headers.get('content-length') ?? 0);
    // Multipart overhead is small; reject obviously oversized bodies before parsing.
    if (declared > AVATAR_MAX_BYTES + 64 * 1024) {
      throw new PayloadTooLargeError('Avatars must be 2 MB or smaller');
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') throw new ValidationError('Attach an image as `file`');

    const user = await accountService.setAvatar(me.sub, new Uint8Array(await file.arrayBuffer()));
    logEvent({
      event: EventType.AVATAR_UPDATE,
      userId: me.sub,
      method: 'POST',
      api: '/api/account/avatar',
      logInfo: { action: 'upload', bytes: String(file.size) },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE /api/account/avatar — remove the stored avatar. */
export async function DELETE(request: Request) {
  try {
    const me = await requireAuth(request);
    const user = await accountService.removeAvatar(me.sub);
    logEvent({
      event: EventType.AVATAR_UPDATE,
      userId: me.sub,
      method: 'DELETE',
      api: '/api/account/avatar',
      logInfo: { action: 'remove' },
    });
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
