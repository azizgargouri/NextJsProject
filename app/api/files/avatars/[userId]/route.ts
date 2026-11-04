import { accountService } from '@/server/modules/account';
import { errorResponse } from '@/server/shared/auth/guards';
import { NotFoundError } from '@/server/shared/database/errors';
import { isMissingObjectError } from '@/server/shared/storage/s3';

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * GET /api/files/avatars/:userId — proxies the avatar from object storage so the
 * bucket never needs to be public. URLs carry `?v=` so long caching is safe.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { userId } = await params;
    if (!/^[a-f0-9]{24}$/.test(userId)) throw new NotFoundError('Avatar');

    const object = await accountService.readAvatar(userId).catch((error: unknown) => {
      if (isMissingObjectError(error)) throw new NotFoundError('Avatar');
      throw error;
    });
    return new Response(Buffer.from(object.body), {
      headers: {
        'Content-Type': object.contentType,
        'Content-Length': String(object.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
