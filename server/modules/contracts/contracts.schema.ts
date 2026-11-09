import { z } from 'zod';
import { CONTRACT_STATUSES, SALARY_PERIODS } from '../../shared/database/enums';

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

/** Payload sent before the server builds + signs the contract intent. */
export const ContractPrepareSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee is required'),
  jobTitle: z.string().trim().min(2, 'Job title is required').max(120),
  salaryAmount: SalaryAmountSchema,
  salaryCurrency: z.string().trim().min(2).max(10).default('TND'),
  salaryPeriod: z.enum(SALARY_PERIODS).default('month'),
  startDate: DateSchema,
  endDate: DateSchema.optional().nullable(),
  documentId: z.string().trim().min(1, 'Upload the contract PDF before preparing it.'),
});

/** HR signs the prepared EIP-712 intent server-side with their app wallet. */
export const ContractProposeSchema = z.object({
  token: z.string().min(20, 'Preparation token is required'),
});

/** Employee signs server-side with their app wallet; HR anchors afterwards. */
export const ContractSignProposalSchema = z.object({
  proposalId: z.string().trim().min(1, 'Proposal is required'),
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

/** Signed termination: the server signs with the HR or employee app wallet. */
export const ContractTerminateSchema = z.object({
  contractId: Bytes32Schema,
  reason: z.string().trim().max(500).optional().default(''),
  deadline: z.coerce.number().int().positive().optional(),
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
