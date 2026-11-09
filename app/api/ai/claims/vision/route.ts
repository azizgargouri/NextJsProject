import { NextResponse } from 'next/server';
import { errorResponse } from '@/server/shared/auth/guards';
import { requireSessionUser } from '@/server/shared/auth/session';
import { parseBody } from '@/server/shared/http/validate';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { ClaimVisionRequestSchema } from '@/server/modules/claims';
import { analyzeClaimEvidencePhotos, VISION_DEMO_PRESETS } from '@/server/modules/ai';

export const maxDuration = 30;

/**
 * POST /api/ai/claims/vision — Multimodal Vision AI damage scanner (course ch.6 "Synthèse & Vision").
 * Inspects 1–4 uploaded evidence photos (or a curated demo preset) and returns a Zod-validated
 * DamageVision object with detected items, severity, repair/replacement range in TND, and
 * auto-fill suggestions for the client claim form.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireSessionUser(request, ['CLIENT', 'ADMIN']);
    const body = await parseBody(request, ClaimVisionRequestSchema);

    logEvent({
      event: EventType.AI_REQUEST,
      userId: actor.sub,
      method: 'POST',
      api: '/api/ai/claims/vision',
      logInfo: { imageCount: String(body.images.length), presetId: body.presetId },
    });

    const analyzed = await analyzeClaimEvidencePhotos({
      images: body.images,
      hint: body.hint,
      presetId: body.presetId,
      photoAnnotations: body.photoAnnotations,
    });

    return NextResponse.json({
      source: analyzed.source,
      model: analyzed.model,
      analysis: analyzed.result,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** GET /api/ai/claims/vision — returns curated test presets so live demos work in one click. */
export async function GET(request: Request) {
  try {
    await requireSessionUser(request, ['CLIENT', 'ADMIN']);
    return NextResponse.json({
      presets: VISION_DEMO_PRESETS.map((preset) => ({
        id: preset.id,
        label: preset.label,
        hint: preset.hint,
        dataUrl: preset.dataUrl,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
