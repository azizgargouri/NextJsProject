import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { connectMongo } from '@/server/shared/database/mongoose';
import { VoiceCheckinModel } from '@/server/shared/database/models/voice-checkin.model';

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
    if (!row || !row.audio || (row.audio as Buffer).length === 0) {
      return NextResponse.json(
        { message: 'Recording not found.', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    const data = row.audio as Buffer;
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': row.mimeType || 'audio/webm',
        'Content-Length': String(data.length),
        'Content-Disposition': 'inline; filename="voice-checkin.webm"',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
