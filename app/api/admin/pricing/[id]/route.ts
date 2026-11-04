import { NextResponse } from 'next/server';
import { PricingService, PricingRuleUpdateSchema } from '@/server/modules/pricing';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { ValidationError } from '@/server/shared/database/errors';
import { EventType, logEvent } from '@/server/shared/logger/audit';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const parsed = PricingRuleUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError('Invalid pricing rule', parsed.error.flatten());
    }

    const { id } = await params;
    const rule = await new PricingService().update(id, parsed.data);
    logEvent({
      event: EventType.PRICING_UPDATE,
      userId: actor.sub,
      method: 'PATCH',
      api: `/api/admin/pricing/${id}`,
      logInfo: { ruleId: id, name: rule.name, status: rule.status },
    });
    return NextResponse.json({ rule });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const { id } = await params;
    const rule = await new PricingService().delete(id);
    logEvent({
      event: EventType.PRICING_DELETE,
      userId: actor.sub,
      method: 'DELETE',
      api: `/api/admin/pricing/${id}`,
      logInfo: { ruleId: id, name: rule.name },
    });
    return NextResponse.json({ rule });
  } catch (error) {
    return errorResponse(error);
  }
}
