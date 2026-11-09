import { NextRequest, NextResponse } from 'next/server';
import { errorResponse, requireAdmin } from '@/server/shared/auth/guards';
import { contractDocumentsService } from '@/server/modules/contracts/contracts-documents.service';

/**
 * POST /api/contracts/documents — upload the contract PDF (HR only).
 * The PDF is stored off-chain and referenced by an unguessable capability URL.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await requireAdmin(request);
    // A body that is not multipart (e.g. JSON) is a client error, not a crash.
    const form = await request.formData().catch(() => null);
    const file = form?.get('file');

    if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json(
        { message: 'Attach the contract PDF in the `file` field.', code: 'BAD_REQUEST' },
        { status: 400 },
      );
    }

    const document = await contractDocumentsService.store({
      organization: user.sub,
      uploadedBy: user.sub,
      file: file as File,
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
