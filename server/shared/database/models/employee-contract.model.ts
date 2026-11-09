import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  CONTRACT_STATUSES,
  SALARY_PERIODS,
  type ContractStatus,
  type SalaryPeriod,
} from '../enums';

/**
 * Queryable mirror of an on-chain employment contract.
 *
 * The canonical document, both signatures and the salary are stored on-chain
 * by EmploymentContractRegistry; this collection keeps a copy for fast app
 * queries. `contractId` is the bytes32 id emitted by
 * EmploymentContractRegistry.ContractCreated.
 */
export interface ContractSalary {
  amount: number;
  currency: string;
  period: SalaryPeriod;
}

export interface EmployeeContractDoc {
  id: string;
  contractId: string;
  chainId: number;
  contractAddress: string;
  organization: Types.ObjectId | null;
  employee: Types.ObjectId | null;
  employeeRef: string;
  employeeName: string;
  employeeEmail: string;
  employeeWallet: string;
  employerWallet: string;
  status: ContractStatus;
  jobTitle: string;
  salary: ContractSalary | null;
  startDate: Date;
  endDate: Date | null;
  documentHash: string;
  employeeRefHash: string;
  organizationHash: string;
  documentUri: string;
  document: Record<string, unknown>;
  version: number;
  previousContractId: string | null;
  supersededBy: string | null;
  nonce: string;
  employerSignature: string;
  employeeSignature: string;
  createdTxHash: string;
  acceptedTxHash: string | null;
  terminatedTxHash: string | null;
  acceptedAt: Date | null;
  terminatedAt: Date | null;
  terminatedByWallet: string | null;
  terminationReasonHash: string | null;
  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

const SalarySchema = new Schema<ContractSalary>(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true },
    period: { type: String, enum: [...SALARY_PERIODS], required: true },
  },
  { _id: false },
);

const EmployeeContractSchema = new Schema<EmployeeContractDoc>(
  {
    contractId: { type: String, required: true, unique: true, lowercase: true },
    chainId: { type: Number, required: true },
    contractAddress: { type: String, required: true, lowercase: true },
    organization: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeRef: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    employeeEmail: { type: String, required: true, lowercase: true, trim: true },
    employeeWallet: { type: String, required: true, lowercase: true, trim: true, index: true },
    employerWallet: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: [...CONTRACT_STATUSES], default: 'pending', index: true },
    jobTitle: { type: String, required: true, trim: true },
    salary: { type: SalarySchema, default: null },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    documentHash: { type: String, required: true, lowercase: true },
    employeeRefHash: { type: String, required: true, lowercase: true },
    organizationHash: { type: String, required: true, lowercase: true },
    documentUri: { type: String, required: true, trim: true },
    document: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true, default: 1, min: 1 },
    previousContractId: { type: String, default: null, lowercase: true },
    supersededBy: { type: String, default: null, lowercase: true },
    nonce: { type: String, required: true, trim: true },
    employerSignature: { type: String, required: true, lowercase: true },
    employeeSignature: { type: String, required: true, lowercase: true },
    createdTxHash: { type: String, required: true, lowercase: true },
    acceptedTxHash: { type: String, default: null, lowercase: true },
    terminatedTxHash: { type: String, default: null, lowercase: true },
    acceptedAt: { type: Date, default: null },
    terminatedAt: { type: Date, default: null },
    terminatedByWallet: { type: String, default: null, lowercase: true },
    terminationReasonHash: { type: String, default: null, lowercase: true },
  },
  { timestamps: true },
);

export const EmployeeContractModel = (models.EmployeeContract ??
  model('EmployeeContract', EmployeeContractSchema)) as Model<EmployeeContractDoc>;
