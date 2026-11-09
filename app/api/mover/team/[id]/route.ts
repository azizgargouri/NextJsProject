import {
  approvedMoverRoute,
  editTeamMember,
  parseJson,
  removeTeamMember,
  TeamMemberSchema,
} from '@/server/modules/mover';

export const PATCH = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => ({
  member: await editTeamMember(actor.sub, params.id, await parseJson(request, TeamMemberSchema)),
}));

export const DELETE = approvedMoverRoute<{ id: string }>(({ actor, params }) =>
  removeTeamMember(actor.sub, params.id),
);
