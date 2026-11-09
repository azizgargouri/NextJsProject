import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  CONTRACT_PROPOSAL_STATUSES,
  SALARY_PERIODS,
  type ContractProposalStatus,
  type SalaryPeriod,
} from '../enums';

/**
 * Off-chain coordination record for a contract that is waiting for the
 * employee's signature. Both signatures are collected here; the canonical
 * document is replicated on-chain when HR sends the anchor transaction.
 *
 * This collection is not the source of truth after the anchor transaction:
 * the chain record is. It only lets the employee discover and review a
 * proposal before signing.
 */
export interface ContractProposalSalary {
  amount: number;
  currency: string;
  period: SalaryPeriod;
}

export interface ContractProposalDoc {
  id: string;
  organization: Types.ObjectId | null;
  employee: Types.ObjectId | null;
  employeeRef: string;
  employeeName: string;
  employeeEmail: string;
  employeeWallet: string;
  employerWallet: string;
  chainId: number;
  contractAddress: string;
  organizationHash: string;
  employeeRefHash: string;
  jobTitle: string;
  salary: ContractProposalSalary | null;
  startDate: Date;
  endDate: Date | null;
  documentHash: string;
  documentUri: string;
  document: Record<string, unknown>;
  version: number;
  previousContractId: string;
  nonce: string;
  deadline: number;
  status: ContractProposalStatus;
  employerSignature: string;
  employeeSignature: string | null;
  employeeSignedAt: Date | null;
  contractId: string | null;
  createdTxHash: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const SalarySchema = new Schema<ContractProposalSalary>(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    period: { type: String, enum: [...SALARY_PERIODS], required: true },
  },
  { _id: false },
);

const ContractProposalSchema = new Schema<ContractProposalDoc>(
  {
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeRef: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    employeeEmail: { type: String, required: true, lowercase: true, trim: true },
    employeeWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    employerWallet: { type: String, required: true, lowercase: true, trim: true },
    chainId: { type: Number, required: true },
    contractAddress: { type: String, required: true, lowercase: true },
    organizationHash: { type: String, required: true, lowercase: true },
    employeeRefHash: { type: String, required: true, lowercase: true },
    jobTitle: { type: String, required: true, trim: true },
    salary: { type: SalarySchema, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    documentHash: { type: String, required: true, lowercase: true },
    documentUri: { type: String, required: true, trim: true },
    document: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    previousContractId: { type: String, required: true, lowercase: true },
    nonce: { type: String, required: true, trim: true },
    deadline: { type: Number, required: true },
    status: {
      type: String,
      enum: [...CONTRACT_PROPOSAL_STATUSES],
      default: 'awaiting_employee',
      index: true,
    },
    employerSignature: { type: String, required: true, lowercase: true },
    employeeSignature: { type: String, default: null, lowercase: true },
    employeeSignedAt: { type: Date, default: null },
    contractId: { type: String, default: null, lowercase: true, index: true },
    createdTxHash: { type: String, default: null, lowercase: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

ContractProposalSchema.index({ organization: 1, status: 1, createdAt: -1 });
ContractProposalSchema.index({ employee: 1, status: 1, createdAt: -1 });

export const ContractProposalModel = (models.ContractProposal ??
  model('ContractProposal', ContractProposalSchema)) as Model<ContractProposalDoc>;
