import {
  anchorContractProposalAction,
  prepareContractAction,
  proposeContractAction,
  recordContractAction,
  signContractProposalAction,
  terminateContractAction,
} from '@/app/actions/contracts';
import { actionAccessToken, unwrapActionResult } from '@/lib/actions/client';
import { axiosClient } from './client';
import type {
  ContractProposalDto,
  EmployeeContractDto,
  PreparedContractDto,
  SalaryPeriod,
} from '@/types';

export interface PrepareContractPayload {
  employeeId: string;
  jobTitle: string;
  salaryAmount?: number;
  salaryCurrency?: string;
  salaryPeriod?: SalaryPeriod;
  startDate: string;
  endDate?: string | null;
  /** UUID returned by `uploadDocument`. */
  documentId: string;
}

export interface ContractDocumentUploadDto {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  /** keccak256 of the raw PDF bytes. */
  hash: string;
  /** Capability URL serving the PDF. */
  uri: string;
}

export interface ProposeContractPayload {
  token: string;
}

export interface SignContractProposalPayload {
  proposalId: string;
}

export interface AnchorContractProposalPayload {
  proposalId: string;
}

export interface RecordContractPayload {
  proposalId: string;
  contractId: string;
  txHash: string;
}

export interface TerminateContractPayload {
  contractId: string;
  /** Optional signature deadline (unix seconds); the server defaults to +15 min. */
  deadline?: number;
  reason?: string;
}

/** Employee contracts endpoint — on-chain facts verified server-side. */
export const contractsApi = {
  list: async (): Promise<EmployeeContractDto[]> => {
    const { data } = await axiosClient.get<{ contracts: EmployeeContractDto[] }>('/api/contracts');
    return data.contracts;
  },
  get: async (id: string): Promise<EmployeeContractDto> => {
    const { data } = await axiosClient.get<{ contract: EmployeeContractDto }>(
      `/api/contracts/${id}`,
    );
    return data.contract;
  },
  proposals: async (): Promise<ContractProposalDto[]> => {
    const { data } = await axiosClient.get<{ proposals: ContractProposalDto[] }>(
      '/api/contracts/proposals',
    );
    return data.proposals;
  },
  uploadDocument: async (file: File): Promise<ContractDocumentUploadDto> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await axiosClient.post<{ document: ContractDocumentUploadDto }>(
      '/api/contracts/documents',
      form,
      { timeout: 60_000 },
    );
    return data.document;
  },
  prepare: async (payload: PrepareContractPayload): Promise<PreparedContractDto> =>
    unwrapActionResult(await prepareContractAction(actionAccessToken(), payload)),
  propose: async (payload: ProposeContractPayload): Promise<ContractProposalDto> =>
    unwrapActionResult(await proposeContractAction(actionAccessToken(), payload)),
  sign: async (payload: SignContractProposalPayload): Promise<ContractProposalDto> =>
    unwrapActionResult(await signContractProposalAction(actionAccessToken(), payload)),
  anchor: async (payload: AnchorContractProposalPayload): Promise<EmployeeContractDto> =>
    unwrapActionResult(await anchorContractProposalAction(actionAccessToken(), payload)),
  record: async (payload: RecordContractPayload): Promise<EmployeeContractDto> =>
    unwrapActionResult(await recordContractAction(actionAccessToken(), payload)),
  terminate: async (payload: TerminateContractPayload): Promise<EmployeeContractDto> =>
    unwrapActionResult(await terminateContractAction(actionAccessToken(), payload)),
};
