import { NextResponse } from 'next/server';
import {
  addTeamMember,
  approvedMoverRoute,
  parseJson,
  TeamMemberSchema,
} from '@/server/modules/mover';

export const POST = approvedMoverRoute(async ({ request, actor }) => {
  const member = await addTeamMember(actor.sub, await parseJson(request, TeamMemberSchema));
  return NextResponse.json({ member }, { status: 201 });
});
