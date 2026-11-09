import { approvedMoverRoute, listOffers } from '@/server/modules/mover';

export const GET = approvedMoverRoute(({ actor }) => listOffers(actor.sub));
