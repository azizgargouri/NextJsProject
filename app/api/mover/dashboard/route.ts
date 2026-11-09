import { approvedMoverRoute, getDashboard } from '@/server/modules/mover';

export const GET = approvedMoverRoute(({ actor }) => getDashboard(actor.sub));
