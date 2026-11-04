import { anyMoverRoute, getApplication } from '@/server/modules/mover';

export const GET = anyMoverRoute(async ({ actor }) => ({
  application: await getApplication(actor.sub),
}));
