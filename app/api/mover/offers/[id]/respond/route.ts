import {
  approvedMoverRoute,
  OfferResponseSchema,
  parseJson,
  respondToOffer,
} from '@/server/modules/mover';

export const POST = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) =>
  respondToOffer(actor.sub, params.id, await parseJson(request, OfferResponseSchema)),
);
