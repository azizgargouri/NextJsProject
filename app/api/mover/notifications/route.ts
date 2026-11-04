import {
  anyMoverRoute,
  listNotifications,
  markNotificationsRead,
  NotificationsReadSchema,
  parseJson,
  sweep,
} from '@/server/modules/mover';

/** Polled by the workspace header, which also keeps the time-based rules moving. */
export const GET = anyMoverRoute(async ({ actor }) => {
  await sweep();
  return listNotifications(actor.sub);
});

export const PATCH = anyMoverRoute(async ({ request, actor }) => {
  const { ids } = await parseJson(request, NotificationsReadSchema);
  await markNotificationsRead(actor.sub, ids);
  return listNotifications(actor.sub);
});
