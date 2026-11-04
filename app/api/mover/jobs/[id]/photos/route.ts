import { NextResponse } from 'next/server';
import {
  addJobPhoto,
  approvedMoverRoute,
  listJobPhotos,
  MAX_UPLOAD_BYTES,
  parse,
  PhotoStageSchema,
  readUpload,
} from '@/server/modules/mover';

export const GET = approvedMoverRoute<{ id: string }>(async ({ actor, params }) => ({
  photos: await listJobPhotos(actor.sub, params.id),
}));

export const POST = approvedMoverRoute<{ id: string }>(async ({ request, actor, params }) => {
  const { form, bytes } = await readUpload(request, MAX_UPLOAD_BYTES);
  const stage = parse(PhotoStageSchema, form.get('stage'));
  const photo = await addJobPhoto(actor.sub, params.id, stage, bytes);
  return NextResponse.json({ photo }, { status: 201 });
});
