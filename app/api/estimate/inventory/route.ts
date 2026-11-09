import { NextResponse } from 'next/server';
import {
  INVENTORY_MAX_PHOTOS,
  INVENTORY_PHOTO_MAX_BYTES,
  InventoryRequestSchema,
  inventoryService,
} from '@/server/modules/inventory';
import { errorResponse } from '@/server/shared/auth/guards';
import { PayloadTooLargeError, ValidationError } from '@/server/shared/database/errors';
import { clientIp, createRateLimiter, TooManyRequestsError } from '@/server/shared/http/rate-limit';

// A local model runs one request at a time; keep the public endpoint polite.
const limit = createRateLimiter({ limit: 6, windowMs: 10 * 60 * 1000 });

export const maxDuration = 120;

/**
 * POST /api/estimate/inventory — public. Multipart: `description` (text),
 * `locale` (en|fr), up to 3 `photos` (PNG, JPEG or WebP, 4 MB each).
 * Returns an itemised inventory whose volumes come from the reference catalogue.
 */
export async function POST(request: Request) {
  try {
    limit(clientIp(request));

    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > INVENTORY_MAX_PHOTOS * INVENTORY_PHOTO_MAX_BYTES + 64 * 1024) {
      throw new PayloadTooLargeError('Photos are too large');
    }

    const form = await request.formData().catch(() => null);
    if (!form) throw new ValidationError('Send the request as multipart form data');

    const parsed = InventoryRequestSchema.safeParse({
      description: form.get('description') ?? undefined,
      locale: form.get('locale') ?? undefined,
    });
    if (!parsed.success) {
      throw new ValidationError('Invalid request', parsed.error.flatten());
    }

    const files = form.getAll('photos').filter((entry): entry is File => typeof entry !== 'string');
    const photos = await Promise.all(
      files.map(async (file) => ({ bytes: new Uint8Array(await file.arrayBuffer()) })),
    );

    const result = await inventoryService.estimate(parsed.data, photos);
    return NextResponse.json(result);
  } catch (error) {
    const response = errorResponse(error);
    if (error instanceof TooManyRequestsError) {
      response.headers.set('Retry-After', String(error.retryAfterSeconds));
    }
    return response;
  }
}
