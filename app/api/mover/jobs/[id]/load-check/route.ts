import {
  approvedMoverRoute,
  confirmLoad,
  LoadCheckSchema,
  parseJson,
} from '@/server/modules/mover';

export const POST = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => ({
  job: await confirmLoad(actor.sub, params.id, await parseJson(request, LoadCheckSchema)),
}));
