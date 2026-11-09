import {
  approvedMoverRoute,
  getProfile,
  MoverProfileUpdateSchema,
  parseJson,
  updateProfile,
} from '@/server/modules/mover';

export const GET = approvedMoverRoute(async ({ actor }) => ({
  profile: await getProfile(actor.sub),
}));

export const PATCH = approvedMoverRoute(async ({ request, actor }) => ({
  profile: await updateProfile(actor.sub, await parseJson(request, MoverProfileUpdateSchema)),
}));
