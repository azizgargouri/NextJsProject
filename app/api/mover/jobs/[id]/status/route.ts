import {
  approvedMoverRoute,
  JobStatusSchema,
  parseJson,
  updateJobStatus,
} from '@/server/modules/mover';

export const POST = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => {
  const { action } = await parseJson(request, JobStatusSchema);
  return { job: await updateJobStatus(actor.sub, params.id, action) };
});
