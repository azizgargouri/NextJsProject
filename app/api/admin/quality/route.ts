import { NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { claimsService } from '@/server/modules/claims';
import { reviewsService } from '@/server/modules/reviews';
import { aiModelId, aiProviderName, aiUsageStats, isAiEnabled } from '@/server/modules/ai';

/** GET /api/admin/quality — claims, reviews and AI usage KPIs for the overview. */
export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const [claims, reviews, usage] = await Promise.all([
      claimsService.stats(),
      reviewsService.stats(),
      aiUsageStats(),
    ]);
    return NextResponse.json({
      claims,
      reviews,
      ai: { enabled: isAiEnabled(), provider: aiProviderName(), model: aiModelId(), ...usage },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
