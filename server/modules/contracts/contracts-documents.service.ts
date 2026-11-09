import { randomUUID } from 'node:crypto';
import { keccak256 } from 'ethers';
import { connectMongo } from '../../shared/database/mongoose';
import { ContractDocumentFileModel } from '../../shared/database/models/contract-document-file.model';
import { BadRequestError, NotFoundError } from '../../shared/database/errors';

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export interface ContractDocumentMetadataDto {
  id: string;
  fileName: string;
  mimeType: 'application/pdf';
  size: number;
  hash: string;
  uri: string;
}

function publicDocumentUri(documentId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? '';
  return `${baseUrl}/api/contracts/documents/${documentId}`;
}

function looksLikePdf(file: File, data: Buffer): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  if (type !== 'application/pdf' && !name.endsWith('.pdf')) return false;

  // PDFs start with %PDF- (some writers add a small amount of junk first).
  return data.subarray(0, 1024).toString('latin1').includes('%PDF-');
}

/**
 * Stores and serves contract PDFs. The PDF is hashed with keccak256 so the
 * canonical on-chain document can commit to the exact bytes without putting
 * the whole file on-chain.
 */
export class ContractDocumentsService {
  async store(input: {
    organization: string;
    uploadedBy: string;
    file: File;
  }): Promise<ContractDocumentMetadataDto> {
    const fileName = (input.file.name || 'contract.pdf').trim();
    if (input.file.size === 0) {
      throw new BadRequestError('The uploaded PDF is empty.');
    }
    if (input.file.size > MAX_PDF_BYTES) {
      throw new BadRequestError('The PDF must be 8 MB or smaller.');
    }

    const data = Buffer.from(await input.file.arrayBuffer());
    if (!looksLikePdf(input.file, data)) {
      throw new BadRequestError('Only valid PDF files are accepted.');
    }

    const documentId = randomUUID();
    const hash = keccak256(new Uint8Array(data));
    await connectMongo();
    await ContractDocumentFileModel.create({
      documentId,
      organization: input.organization,
      uploadedBy: input.uploadedBy,
      fileName,
      mimeType: 'application/pdf',
      size: data.length,
      hash,
      data,
    });

    return {
      id: documentId,
      fileName,
      mimeType: 'application/pdf',
      size: data.length,
      hash,
      uri: publicDocumentUri(documentId),
    };
  }

  /** Resolves an upload for the HR organisation that is issuing the contract. */
  async findForOrganization(
    documentId: string,
    organization: string,
  ): Promise<ContractDocumentMetadataDto> {
    await connectMongo();
    const document = await ContractDocumentFileModel.findOne({ documentId, organization })
      .select('documentId fileName mimeType size hash')
      .lean();

    if (!document) {
      throw new BadRequestError(
        'The contract PDF was not found for this organisation. Upload it again.',
      );
    }

    return {
      id: document.documentId,
      fileName: document.fileName,
      mimeType: 'application/pdf',
      size: document.size,
      hash: document.hash,
      uri: publicDocumentUri(document.documentId),
    };
  }

  /** Reads the raw PDF for the capability URL. */
  async getFile(documentId: string): Promise<{
    fileName: string;
    mimeType: string;
    data: Buffer;
  }> {
    await connectMongo();
    const document = await ContractDocumentFileModel.findOne({ documentId })
      .select('fileName mimeType data')
      .lean();

    if (!document) {
      throw new NotFoundError('Contract document');
    }

    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      data: document.data,
    };
  }
}

export const contractDocumentsService = new ContractDocumentsService();
