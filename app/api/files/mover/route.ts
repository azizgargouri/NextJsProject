import { NextResponse } from 'next/server';
import { moverStorage, verifyFileSignature } from '@/server/modules/mover';

/** The signature is the permission: URLs are issued only to authorised movers. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const key = params.get('key');
  if (!verifyFileSignature(key, params.get('exp'), params.get('sig'))) {
    return NextResponse.json(
      { message: 'Link expired or invalid', code: 'FORBIDDEN' },
      { status: 403 },
    );
  }
  try {
    const { body, contentType } = await moverStorage.getObject(key);
    return new NextResponse(Buffer.from(body), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'File not found', code: 'FILE_NOT_FOUND' },
      { status: 404 },
    );
  }
}
