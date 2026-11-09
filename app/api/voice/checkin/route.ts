import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAuth } from '@/server/shared/auth/guards';
import { connectMongo } from '@/server/shared/database/mongoose';
import { VoiceCheckinModel } from '@/server/shared/database/models/voice-checkin.model';
import { employeesService } from '@/server/modules/employees/employees.service';

function voiceBaseUrl(): string {
  const url = process.env.VOICE_API_BASE_URL?.trim();
  if (!url) {
    throw new Error(
      'VOICE_API_BASE_URL is not configured. Set it in the app .env to the ngrok URL printed by the Kaggle notebook.',
    );
  }
  return url.replace(/\/+$/, '');
}

/** GET /api/voice/checkin — ping the Kaggle voice service health endpoint. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAuth(request);
    const response = await fetch(`${voiceBaseUrl()}/health`, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    return NextResponse.json({ ok: response.ok, body }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/voice/checkin — forward to the Kaggle voice service.
 * Body: { audio_b64, transcript, job_id, challenge, lat, lng }
 * Stores every attempt so RH can spot different-voice / mismatched check-ins.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAuth(request);
    const payload = await request.json();

    const response = await fetch(`${voiceBaseUrl()}/api/voice/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      decision?: string;
      speaker_score?: number;
      voice_label?: string;
      challenge_ok?: boolean;
      job_ok?: boolean;
      distance_m?: number;
      reasons?: string[];
    } | null;

    // Persist for the RH dashboard (best-effort — never fail the check-in).
    try {
      const profile = await employeesService.findMyProfile(user.email);
      await connectMongo();
      const audio = Buffer.from(String((payload as { audio_b64?: string }).audio_b64 ?? ''), 'base64');
      await VoiceCheckinModel.create({
        userId: user.sub,
        employeeId: profile?.id ?? null,
        employeeRef: profile?.employeeRef ?? user.email,
        decision: body?.decision ?? 'unknown',
        speakerScore: Number(body?.speaker_score ?? 0),
        voiceLabel: body?.voice_label ?? 'unknown',
        challengeOk: body?.challenge_ok ?? false,
        jobOk: body?.job_ok ?? false,
        distanceM: Number(body?.distance_m ?? 0),
        reasons: Array.isArray(body?.reasons) ? body.reasons : [],
        audio,
        mimeType: 'audio/webm',
      });
    } catch {
      // best effort only
    }

    return NextResponse.json(body ?? { message: 'Voice service returned no data.' }, {
      status: response.ok ? 200 : 502,
    });
  } catch (error) {
    return errorResponse(error);
  }
}


