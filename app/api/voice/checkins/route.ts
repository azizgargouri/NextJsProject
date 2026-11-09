import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { connectMongo } from '@/server/shared/database/mongoose';
import { VoiceCheckinModel } from '@/server/shared/database/models/voice-checkin.model';

/** GET /api/voice/checkins — recent attempts for the RH dashboard (admin only). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireAdmin(request);
    await connectMongo();
    const rows = await VoiceCheckinModel.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    const checkins = rows.map((row) => ({
      id: String(row._id),
      employeeRef: row.employeeRef,
      decision: row.decision,
      speakerScore: row.speakerScore,
      voiceLabel: row.voiceLabel,
      challengeOk: row.challengeOk,
      jobOk: row.jobOk,
      distanceM: row.distanceM,
      reasons: row.reasons ?? [],
      createdAt: new Date(row.createdAt).toISOString(),
    }));
    return NextResponse.json({ checkins });
  } catch (error) {
    return errorResponse(error);
  }
}
