import { clientRoute, confirmDelivery } from '@/server/modules/mover';

export const POST = clientRoute<{ id: string }>(({ actor, params }) =>
  confirmDelivery(actor.sub, params.id),
);
