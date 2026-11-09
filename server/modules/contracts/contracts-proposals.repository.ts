import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import {
  ContractProposalModel,
  type ContractProposalDoc,
  type ContractProposalSalary,
} from '../../shared/database/models/contract-proposal.model';
import type { ContractProposalStatus } from '../../shared/database/enums';

export interface ContractProposalRow {
  id: string;
  organization: string;
  employee: string;
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
}

export function toProposalRow(doc: ContractProposalDoc): ContractProposalRow {
  return {
    id: String(doc._id),
    organization: String(doc.organization),
    employee: String(doc.employee),
    employeeRef: doc.employeeRef,
    employeeName: doc.employeeName,
    employeeEmail: doc.employeeEmail,
    employeeWallet: doc.employeeWallet,
    employerWallet: doc.employerWallet,
    chainId: doc.chainId,
    contractAddress: doc.contractAddress,
    organizationHash: doc.organizationHash,
    employeeRefHash: doc.employeeRefHash,
    jobTitle: doc.jobTitle,
    salary: doc.salary
      ? { amount: doc.salary.amount, currency: doc.salary.currency, period: doc.salary.period }
      : null,
    startDate: doc.startDate,
    endDate: doc.endDate ?? null,
    documentHash: doc.documentHash,
    documentUri: doc.documentUri,
    document: doc.document,
    version: doc.version,
    previousContractId: doc.previousContractId,
    nonce: doc.nonce,
    deadline: doc.deadline,
    status: doc.status,
    employerSignature: doc.employerSignature,
    employeeSignature: doc.employeeSignature ?? null,
    employeeSignedAt: doc.employeeSignedAt ?? null,
    contractId: doc.contractId ?? null,
    createdTxHash: doc.createdTxHash ?? null,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Coordination records for contracts that are not on-chain yet. Nothing here
 * is authoritative once the HR anchor transaction is mined.
 */
export class ContractProposalsRepository extends AbstractRepository<ContractProposalRow> {
  private async model() {
    await connectMongo();
    return ContractProposalModel;
  }

  async findOneById(id: string): Promise<ContractProposalRow | null> {
    const doc = await (await this.model()).findById(id).lean();
    return doc ? toProposalRow(doc as unknown as ContractProposalDoc) : null;
  }

  async findByContractId(contractId: string): Promise<ContractProposalRow | null> {
    const doc = await (await this.model())
      .findOne({ contractId: contractId.toLowerCase() })
      .lean();
    return doc ? toProposalRow(doc as unknown as ContractProposalDoc) : null;
  }

  /** An employee may only have one proposal waiting for their signature. */
  async findOpenForEmployee(employee: string): Promise<ContractProposalRow | null> {
    const doc = await (await this.model())
      .findOne({ employee, status: 'awaiting_employee', expiresAt: { $gt: new Date() } })
      .lean();
    return doc ? toProposalRow(doc as unknown as ContractProposalDoc) : null;
  }

  async findOpenForOrganization(organization: string): Promise<ContractProposalRow[]> {
    const docs = await (await this.model())
      .find({ organization, status: 'awaiting_employee', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toProposalRow(doc as unknown as ContractProposalDoc));
  }

  async listForOrganization(organization: string): Promise<ContractProposalRow[]> {
    const docs = await (await this.model())
      .find({ organization, status: { $in: ['awaiting_employee', 'expired'] } })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toProposalRow(doc as unknown as ContractProposalDoc));
  }

  async listForEmployee(employee: string): Promise<ContractProposalRow[]> {
    const docs = await (await this.model())
      .find({ employee, status: { $in: ['awaiting_employee', 'expired'] } })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toProposalRow(doc as unknown as ContractProposalDoc));
  }

  /** Lazily expires proposals whose signing window has passed. */
  async expireOld(): Promise<void> {
    await (await this.model()).updateMany(
      { status: 'awaiting_employee', expiresAt: { $lte: new Date() } },
      { $set: { status: 'expired' } },
    );
  }

  async create(data: Record<string, unknown>): Promise<ContractProposalRow> {
    const doc = await (await this.model()).create(data as Partial<ContractProposalDoc>);
    return toProposalRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ContractProposalRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<ContractProposalDoc>, {
        new: true,
        runValidators: true,
      })
      .lean();
    if (!doc) throw new ReferenceError('Contract proposal not found during update');
    return toProposalRow(doc as unknown as ContractProposalDoc);
  }

  async delete(id: string): Promise<ContractProposalRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Contract proposal not found during delete');
    return toProposalRow(doc as unknown as ContractProposalDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<ContractProposalRow[]> {
    const M = await this.model();
    const {
      where = {},
      orderBy = {},
      skip = 0,
      limit = 50,
    } = (options ?? {}) as {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      limit?: number;
    };
    const docs = await M.find(where).sort(orderBy).skip(skip).limit(limit).lean();
    return docs.map((doc) => toProposalRow(doc as unknown as ContractProposalDoc));
  }
}
