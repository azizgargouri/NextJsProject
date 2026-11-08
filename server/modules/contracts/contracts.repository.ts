import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import {
  EmployeeContractModel,
  type ContractSalary,
  type EmployeeContractDoc,
} from '../../shared/database/models/employee-contract.model';
import type { ContractStatus } from '../../shared/database/enums';

/** Repository row: plain object with string ids (driver-independent shape). */
export interface ContractRow {
  id: string;
  contractId: string;
  chainId: number;
  contractAddress: string;
  organization: string;
  employee: string;
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
}

export function toContractRow(doc: EmployeeContractDoc): ContractRow {
  return {
    id: String(doc._id),
    contractId: doc.contractId,
    chainId: doc.chainId,
    contractAddress: doc.contractAddress,
    organization: String(doc.organization),
    employee: String(doc.employee),
    employeeRef: doc.employeeRef,
    employeeName: doc.employeeName,
    employeeEmail: doc.employeeEmail,
    employeeWallet: doc.employeeWallet,
    employerWallet: doc.employerWallet,
    status: doc.status,
    jobTitle: doc.jobTitle,
    salary: doc.salary
      ? { amount: doc.salary.amount, currency: doc.salary.currency, period: doc.salary.period }
      : null,
    startDate: doc.startDate,
    endDate: doc.endDate ?? null,
    documentHash: doc.documentHash,
    employeeRefHash: doc.employeeRefHash,
    organizationHash: doc.organizationHash,
    documentUri: doc.documentUri,
    document: doc.document,
    version: doc.version,
    previousContractId: doc.previousContractId ?? null,
    supersededBy: doc.supersededBy ?? null,
    nonce: doc.nonce ?? '',
    employerSignature: doc.employerSignature ?? '',
    employeeSignature: doc.employeeSignature ?? '',
    createdTxHash: doc.createdTxHash,
    acceptedTxHash: doc.acceptedTxHash ?? null,
    terminatedTxHash: doc.terminatedTxHash ?? null,
    acceptedAt: doc.acceptedAt ?? null,
    terminatedAt: doc.terminatedAt ?? null,
    terminatedByWallet: doc.terminatedByWallet ?? null,
    terminationReasonHash: doc.terminationReasonHash ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Employment contracts data access. The chain is the source of truth; this
 * collection is the queryable mirror used by the app.
 */
export class ContractsRepository extends AbstractRepository<ContractRow> {
  private async model() {
    await connectMongo();
    return EmployeeContractModel;
  }

  async findOneById(id: string): Promise<ContractRow | null> {
    const doc = await (await this.model()).findById(id).lean();
    return doc ? toContractRow(doc as unknown as EmployeeContractDoc) : null;
  }

  async findByContractId(contractId: string): Promise<ContractRow | null> {
    const doc = await (await this.model())
      .findOne({ contractId: contractId.toLowerCase() })
      .lean();
    return doc ? toContractRow(doc as unknown as EmployeeContractDoc) : null;
  }

  async findForOrganization(organization: string): Promise<ContractRow[]> {
    const docs = await (await this.model())
      .find({ organization })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toContractRow(doc as unknown as EmployeeContractDoc));
  }

  async findForEmployee(employee: string): Promise<ContractRow[]> {
    const docs = await (await this.model())
      .find({ employee })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map((doc) => toContractRow(doc as unknown as EmployeeContractDoc));
  }

  /** At most one pending/active contract per employee (renewals use amend). */
  async findCurrentForEmployee(employee: string): Promise<ContractRow | null> {
    const doc = await (await this.model())
      .findOne({ employee, status: { $in: ['pending', 'active'] } })
      .lean();
    return doc ? toContractRow(doc as unknown as EmployeeContractDoc) : null;
  }

  async create(data: Record<string, unknown>): Promise<ContractRow> {
    const doc = await (await this.model()).create(data as Partial<EmployeeContractDoc>);
    return toContractRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ContractRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<EmployeeContractDoc>, {
        new: true,
        runValidators: true,
      })
      .lean();
    if (!doc) throw new ReferenceError('Contract not found during update');
    return toContractRow(doc as unknown as EmployeeContractDoc);
  }

  /** Hard delete — only used for off-chain maintenance, never for audit rows. */
  async delete(id: string): Promise<ContractRow> {
    const doc = await (await this.model()).findByIdAndDelete(id).lean();
    if (!doc) throw new ReferenceError('Contract not found during delete');
    return toContractRow(doc as unknown as EmployeeContractDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<ContractRow[]> {
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
    return docs.map((doc) => toContractRow(doc as unknown as EmployeeContractDoc));
  }
}
