import { approvedMoverRoute, getJob } from '@/server/modules/mover';

export const GET = approvedMoverRoute<{ id: string }>(async ({ actor, params }) => ({
  job: await getJob(actor.sub, params.id),
}));
