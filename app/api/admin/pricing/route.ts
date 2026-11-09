export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { PricingService, PricingRuleCreateSchema } from '@/server/modules/pricing';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const url = new URL(request.url);
    return NextResponse.json(await new PricingService().list(url.searchParams));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(request);
    const parsed = PricingRuleCreateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid pricing rule', parsed.error.flatten());
    }

    const rule = await new PricingService().create(parsed.data);
    logEvent({
      event: EventType.PRICING_CREATE,
      userId: actor.sub,
      method: 'POST',
      api: '/api/admin/pricing',
      logInfo: { ruleId: rule.id, name: rule.name },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
