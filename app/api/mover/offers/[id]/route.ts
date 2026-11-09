import { approvedMoverRoute, getOffer } from '@/server/modules/mover';

export const GET = approvedMoverRoute<{ id: string }>(async ({ actor, params }) => ({
  offer: await getOffer(actor.sub, params.id),
}));
