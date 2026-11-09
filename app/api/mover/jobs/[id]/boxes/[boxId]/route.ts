import { approvedMoverRoute, removeBoxScan } from '@/server/modules/mover';

export const DELETE = approvedMoverRoute<{ id: string; boxId: string }>(
  async ({ actor, params }) => ({
    job: await removeBoxScan(actor.sub, params.id, params.boxId),
  }),
);
