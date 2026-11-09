import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { connectMongo } from '@/server/shared/database/mongoose';
import { VoiceCheckinModel } from '@/server/shared/database/models/voice-checkin.model';

/**
 * Normalizes the stored clip to a real Buffer. Mongoose `.lean()` hands back a
 * BSON `Binary` (whose `.length` is a method), not a Node Buffer, so a naive
 * `String(data.length)` produces an invalid Content-Length header.
 */
function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  const binary = value as {
    buffer?: Uint8Array;
    value?: (asRaw?: boolean) => Buffer;
  } | null;

  if (binary?.buffer) return Buffer.from(binary.buffer);
  if (typeof binary?.value === 'function') return Buffer.from(binary.value(true));
  return Buffer.alloc(0);
}

/**
 * GET /api/voice/checkins/[id]/audio — admin-only playback of a stored clip,
 * so RH can hear the exact recording behind a faulty check-in.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    await connectMongo();
    const row = await VoiceCheckinModel.findById(id).select('audio mimeType').lean();
    const data = toBuffer(row?.audio);
    if (!row || data.length === 0) {
      return NextResponse.json(
        { message: 'Recording not found.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': row.mimeType || 'audio/webm',
        'Content-Length': String(data.length),
        'Content-Disposition': `inline; filename="voice-checkin.${
          (row.mimeType || '').includes('wav') ? 'wav' : 'webm'
        }"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
