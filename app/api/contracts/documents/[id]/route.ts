import { NextRequest, NextResponse } from 'next/server';
import { errorResponse } from '@/server/shared/auth/guards';
import { contractDocumentsService } from '@/server/modules/contracts/contracts-documents.service';

function safeFileName(fileName: string): string {
  return fileName.replace(/["\r\n]/g, '_');
}

/**
 * GET /api/contracts/documents/[id] — serve the uploaded PDF.
 *
 * The id is a random UUID used as a capability URL so a plain link in the
 * contract card can open the PDF without putting the access token in a URL.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const document = await contractDocumentsService.getFile(id);

    return new NextResponse(new Uint8Array(document.data), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeFileName(document.fileName)}"`,
        'Content-Length': String(document.data.length),
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
