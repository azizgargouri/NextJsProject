import type {
  ContractDocumentDto,
  ContractProposalDto,
  ContractSalaryDto,
  EmployeeContractDto,
  PreparedContractDto,
} from '../../../types';
import { buildContractIntent, contractIntentTypedData } from '../../../lib/contracts/eip712';
import type { ContractRow } from './contracts.repository';
import type { ContractProposalRow } from './contracts-proposals.repository';
import type { PreparedContractPayload } from './contracts.token';

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Maps a contract row to the whitelisted API shape. */
export function serializeContract(row: ContractRow): EmployeeContractDto {
  return {
    id: row.id,
    contractId: row.contractId,
    chainId: row.chainId,
    contractAddress: row.contractAddress,
    employee: {
      id: row.employee,
      employeeRef: row.employeeRef,
      fullName: row.employeeName,
      email: row.employeeEmail,
      walletAddress: row.employeeWallet,
    },
    employerWallet: row.employerWallet,
    status: row.status,
    jobTitle: row.jobTitle,
    salary: row.salary as ContractSalaryDto | null,
    startDate: row.startDate.toISOString(),
    endDate: iso(row.endDate),
    documentHash: row.documentHash,
    employeeRefHash: row.employeeRefHash,
    organizationHash: row.organizationHash,
    documentUri: row.documentUri,
    document: row.document as unknown as ContractDocumentDto,
    version: row.version,
    previousContractId: row.previousContractId,
    supersededBy: row.supersededBy,
    nonce: row.nonce,
    employerSignature: row.employerSignature,
    employeeSignature: row.employeeSignature,
    createdTxHash: row.createdTxHash,
    acceptedTxHash: row.acceptedTxHash,
    terminatedTxHash: row.terminatedTxHash,
    acceptedAt: iso(row.acceptedAt),
    terminatedAt: iso(row.terminatedAt),
    terminatedByWallet: row.terminatedByWallet,
    terminationReasonHash: row.terminationReasonHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prepared payload returned to the client before either wallet signs. */
export function serializePreparedContract(
  payload: PreparedContractPayload,
  token: string,
): PreparedContractDto {
  const intent = buildContractIntent({
    organizationHash: payload.organizationHash,
    employerWallet: payload.employerWallet,
    employeeWallet: payload.employeeWallet,
    employeeRefHash: payload.employeeRefHash,
    documentHash: payload.documentHash,
    startTimestamp: payload.startTimestamp,
    endTimestamp: payload.endTimestamp,
    previousContractId: payload.previousContractId,
    version: payload.version,
    nonce: payload.nonce,
    deadline: payload.deadline,
  });

  return {
    token,
    chainId: payload.chainId,
    contractAddress: payload.contractAddress,
    organizationHash: payload.organizationHash,
    employeeRefHash: payload.employeeRefHash,
    documentHash: payload.documentHash,
    employeeWallet: payload.employeeWallet,
    employerWallet: payload.employerWallet,
    startTimestamp: payload.startTimestamp,
    endTimestamp: payload.endTimestamp,
    documentUri: payload.documentUri,
    version: payload.version,
    previousContractId: payload.previousContractId,
    nonce: payload.nonce,
    deadline: payload.deadline,
    typedData: contractIntentTypedData(payload.chainId, payload.contractAddress, intent),
    document: payload.document,
  };
}

/** Proposal shown to the employee so they can review and co-sign. */
export function serializeProposal(row: ContractProposalRow): ContractProposalDto {
  const startTimestamp = Math.floor(row.startDate.getTime() / 1000);
  const endTimestamp = row.endDate ? Math.floor(row.endDate.getTime() / 1000) : 0;
  const intent = buildContractIntent({
    organizationHash: row.organizationHash,
    employerWallet: row.employerWallet,
    employeeWallet: row.employeeWallet,
    employeeRefHash: row.employeeRefHash,
    documentHash: row.documentHash,
    startTimestamp,
    endTimestamp,
    previousContractId: row.previousContractId,
    version: row.version,
    nonce: row.nonce,
    deadline: row.deadline,
  });

  return {
    id: row.id,
    chainId: row.chainId,
    contractAddress: row.contractAddress,
    organizationHash: row.organizationHash,
    employee: {
      id: row.employee,
      employeeRef: row.employeeRef,
      fullName: row.employeeName,
      email: row.employeeEmail,
      walletAddress: row.employeeWallet,
    },
    employerWallet: row.employerWallet,
    jobTitle: row.jobTitle,
    salary: row.salary as ContractSalaryDto | null,
    startDate: row.startDate.toISOString(),
    endDate: iso(row.endDate),
    startTimestamp,
    endTimestamp,
    documentHash: row.documentHash,
    employeeRefHash: row.employeeRefHash,
    documentUri: row.documentUri,
    document: row.document as unknown as ContractDocumentDto,
    version: row.version,
    previousContractId: row.previousContractId,
    nonce: row.nonce,
    deadline: row.deadline,
    status: row.status,
    employerSignature: row.employerSignature,
    employeeSignature: row.employeeSignature,
    employeeSignedAt: iso(row.employeeSignedAt),
    typedData: contractIntentTypedData(row.chainId, row.contractAddress, intent),
    contractId: row.contractId,
    createdTxHash: row.createdTxHash,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
