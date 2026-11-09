import { ZeroHash, keccak256, toUtf8Bytes } from 'ethers';
import type {
  ContractDocumentAttachmentDto,
  ContractDocumentDto,
  ContractSalaryDto,
  SalaryPeriod,
} from '@/types';

/**
 * Deterministic JSON serialisation used on both the server and the client.
 * The hash only stays stable if key order is stable, so every object is
 * recursively sorted before stringification.
 */
function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const normalized = normalize(record[key]);
        if (normalized !== undefined) accumulator[key] = normalized;
        return accumulator;
      }, {});
  }

  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(normalize(value));
}

/** keccak256 of a UTF-8 string (matches Solidity's `keccak256(bytes(x))`). */
export function hashText(value: string): string {
  return keccak256(toUtf8Bytes(value));
}

/** keccak256 of the canonical contract document. Anchored on-chain. */
export function hashContractDocument(document: ContractDocumentDto): string {
  return hashText(stableStringify(document));
}

export function formatSalary(salary: ContractSalaryDto | null): string {
  if (!salary) return 'Not disclosed';
  return `${salary.amount.toLocaleString('en-US')} ${salary.currency} / ${salary.period}`;
}

export interface ContractDocumentInput {
  employeeRef: string;
  employeeName: string;
  employeeEmail: string;
  employeeWallet: string;
  organizationHash: string;
  employerWallet: string;
  jobTitle: string;
  salary: ContractSalaryDto | null;
  startDate: string;
  endDate: string | null;
  attachment: ContractDocumentAttachmentDto | null;
  issuedAt: string;
}

export function buildContractDocument(input: ContractDocumentInput): ContractDocumentDto {
  return {
    schema: 'moveup.employment-contract.v1',
    employee: {
      ref: input.employeeRef,
      name: input.employeeName,
      email: input.employeeEmail,
      wallet: input.employeeWallet,
    },
    employer: {
      organizationIdHash: input.organizationHash,
      wallet: input.employerWallet,
    },
    terms: {
      jobTitle: input.jobTitle,
      salary: input.salary,
      startDate: input.startDate,
      endDate: input.endDate,
    },
    attachment: input.attachment,
    issuedAt: input.issuedAt,
  };
}

/** Deterministic URN so every contract has a location even without IPFS. */
export function contractDocumentUri(documentHash: string): string {
  return `urn:moveup:employment-contract:${documentHash}`;
}

/** bytes32 reason anchored on-chain (zero hash when no reason is given). */
export function terminationReasonHash(reason: string): string {
  const trimmed = reason.trim();
  return trimmed ? hashText(trimmed) : ZeroHash;
}

/** Converts a YYYY-MM-DD date or ISO timestamp to unix seconds (UTC). */
export function toUnixSeconds(value: string): number {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return Math.floor(date.getTime() / 1000);
}

/** Normalises a date input to the YYYY-MM-DD stored in the canonical document. */
export function toDateOnly(value: string): string {
  return new Date(toUnixSeconds(value) * 1000).toISOString().slice(0, 10);
}

export const SALARY_PERIODS: SalaryPeriod[] = ['month', 'year', 'hour'];
