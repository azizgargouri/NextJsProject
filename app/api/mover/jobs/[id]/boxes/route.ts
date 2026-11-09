import { NextResponse } from 'next/server';
import { approvedMoverRoute, BoxScanSchema, parseJson, scanBox } from '@/server/modules/mover';

export const POST = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => {
  const { code } = await parseJson(request, BoxScanSchema);
  return NextResponse.json({ job: await scanBox(actor.sub, params.id, code) }, { status: 201 });
});
