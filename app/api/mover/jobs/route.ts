import { approvedMoverRoute, listJobs } from '@/server/modules/mover';

export const GET = approvedMoverRoute(({ actor }) => listJobs(actor.sub));
