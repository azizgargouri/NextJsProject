import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Uploaded employment-contract PDFs.
 *
 * The PDF itself is kept off-chain; the canonical JSON document commits to its
 * keccak256 hash and public URL. `documentId` is a random UUID used as a
 * capability URL (it is unguessable and stable for the life of the contract).
 */
export interface ContractDocumentFileDoc {
  id: string;
  documentId: string;
  organization: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  fileName: string;
  mimeType: string;
  size: number;
  /** keccak256 of the raw PDF bytes — committed inside the canonical document. */
  hash: string;
  data: Buffer;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const ContractDocumentFileSchema = new Schema<ContractDocumentFileDoc>(
  {
    documentId: { type: String, required: true, unique: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, default: 'application/pdf' },
    size: { type: Number, required: true, min: 1 },
    hash: { type: String, required: true, lowercase: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export const ContractDocumentFileModel = (models.ContractDocumentFile ??
  model(
    'ContractDocumentFile',
    ContractDocumentFileSchema,
  )) as Model<ContractDocumentFileDoc>;
