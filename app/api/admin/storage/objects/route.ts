import { NextResponse } from 'next/server';
import {
  StorageListQuerySchema,
  StorageObjectKeySchema,
  storageService,
} from '@/server/modules/storage';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

/**
 * GET  /api/admin/storage/objects?prefix=&cursor=&limit=  — browse objects
 * GET  /api/admin/storage/objects?key=…&download=1        — fetch one object
 * DELETE /api/admin/storage/objects?key=…                 — delete one object
 */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const params = new URL(request.url).searchParams;

    if (params.has('key')) {
      const parsed = StorageObjectKeySchema.safeParse({ key: params.get('key') });
      if (!parsed.success) throw new ValidationError('Invalid key', parsed.error.flatten());
      const object = await storageService.download(parsed.data.key);
      const filename = parsed.data.key.split('/').pop() ?? 'object';
      return new Response(Buffer.from(object.body), {
        headers: {
          'Content-Type': object.contentType,
          'Content-Length': String(object.size),
          'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }

    const parsed = StorageListQuerySchema.safeParse(Object.fromEntries(params));
    if (!parsed.success) throw new ValidationError('Invalid query', parsed.error.flatten());
    return NextResponse.json(await storageService.list(parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const parsed = StorageObjectKeySchema.safeParse({
      key: new URL(request.url).searchParams.get('key'),
    });
    if (!parsed.success) throw new ValidationError('Invalid key', parsed.error.flatten());

    const result = await storageService.remove(parsed.data.key);
    logEvent({
      event: EventType.STORAGE_DELETE,
      userId: actor.sub,
      method: 'DELETE',
      api: '/api/admin/storage/objects',
      logInfo: {
        key: result.key,
        ...(result.detachedUserId ? { targetUserId: result.detachedUserId } : {}),
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
