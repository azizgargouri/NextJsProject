import { acceptQuote, clientRoute } from '@/server/modules/mover';

export const POST = clientRoute<{ id: string; quoteId: string }>(({ actor, params }) =>
  acceptQuote(actor.sub, params.id, params.quoteId),
);
