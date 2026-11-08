import { z } from 'zod';
import { CONTRACT_STATUSES, SALARY_PERIODS } from '../../shared/database/enums';

export const WalletSchema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address (expected 0x + 40 hex chars)')
  .transform((value) => value.toLowerCase());

export const Bytes32Schema = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid 32-byte hash')
  .transform((value) => value.toLowerCase());

export const TxHashSchema = Bytes32Schema;

const DateSchema = z
  .string()
  .trim()
  .min(1, 'Date is required')
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Invalid date');

const SalaryAmountSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') return Number(value);
    return value;
  },
  z.number().finite().nonnegative('Salary cannot be negative').optional(),
);

/** Payload sent before the MetaMask transaction (server builds the document). */
export const ContractPrepareSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required'),
  employeeWallet: WalletSchema,
  employerWallet: WalletSchema,
  jobTitle: z.string().trim().min(2, 'Job title is required').max(120),
  salaryAmount: SalaryAmountSchema,
  salaryCurrency: z.string().trim().min(2).max(10).default('TND'),
  salaryPeriod: z.enum(SALARY_PERIODS).default('month'),
  startDate: DateSchema,
  endDate: DateSchema.optional().nullable(),
  documentUri: z.string().trim().max(500).optional().default(''),
});

/** HR co-signature over the prepared EIP-712 intent. */
export const ContractProposeSchema = z.object({
  token: z.string().min(20, 'Preparation token is required'),
  signature: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid EIP-712 signature'),
});

/** Employee's gasless EIP-712 co-signature; HR anchors it afterwards. */
export const ContractSignProposalSchema = z.object({
  proposalId: z.string().trim().min(1, 'Proposal is required'),
  signature: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid EIP-712 signature'),
});

/** Publishing a dual-signed proposal: the backend system wallet pays the gas. */
export const ContractAnchorProposalSchema = z.object({
  proposalId: z.string().trim().min(1, 'Proposal is required'),
});

/** A receipt hash of an anchor transaction (kept for manual reconciliation). */
export const ContractRecordSchema = z.object({
  proposalId: z.string().trim().min(1, 'Proposal is required'),
  contractId: Bytes32Schema,
  txHash: TxHashSchema,
});

/** Signed termination: the HR wallet or the employee signs, the system wallet pays. */
export const ContractTerminateSchema = z.object({
  contractId: Bytes32Schema,
  reason: z.string().trim().max(500).optional().default(''),
  deadline: z.coerce.number().int().positive('Signature deadline is required'),
  signature: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid EIP-712 signature'),
});

export const ContractQuerySchema = z.object({
  status: z.enum(CONTRACT_STATUSES).optional(),
});

export type ContractPrepareInput = z.output<typeof ContractPrepareSchema>;
export type ContractProposeInput = z.output<typeof ContractProposeSchema>;
export type ContractSignProposalInput = z.output<typeof ContractSignProposalSchema>;
export type ContractAnchorProposalInput = z.output<typeof ContractAnchorProposalSchema>;
export type ContractRecordInput = z.output<typeof ContractRecordSchema>;
export type ContractTerminateInput = z.output<typeof ContractTerminateSchema>;
