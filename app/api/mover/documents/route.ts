import { NextResponse } from 'next/server';
import {
  approvedMoverRoute,
  DocumentMetaSchema,
  MAX_UPLOAD_BYTES,
  parse,
  readUpload,
  uploadDocument,
} from '@/server/modules/mover';

export const POST = approvedMoverRoute(async ({ request, actor }) => {
  const { form, bytes, name } = await readUpload(request, MAX_UPLOAD_BYTES);
  const { type, expiresAt } = parse(DocumentMetaSchema, {
    type: form.get('type'),
    expiresAt: form.get('expiresAt') || undefined,
  });
  const document = await uploadDocument(actor.sub, type, expiresAt, { bytes, name });
  return NextResponse.json({ document }, { status: 201 });
});
