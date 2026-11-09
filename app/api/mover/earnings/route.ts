import { approvedMoverRoute, getEarnings } from '@/server/modules/mover';

export const GET = approvedMoverRoute(({ actor }) => getEarnings(actor.sub));
