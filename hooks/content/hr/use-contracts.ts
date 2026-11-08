import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  AnchorContractProposalPayload,
  PrepareContractPayload,
  ProposeContractPayload,
  RecordContractPayload,
  SignContractProposalPayload,
  TerminateContractPayload,
} from '@/lib/api/contracts';

/** Contracts visible to the signed-in session (organisation or own). */
export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => api.contracts.list(),
    refetchInterval: 30_000,
  });
}

/** Proposals waiting for the employee's signature. */
export function useContractProposals() {
  return useQuery({
    queryKey: ['contracts', 'proposals'],
    queryFn: () => api.contracts.proposals(),
    refetchInterval: 15_000,
  });
}

/** Builds the canonical document + EIP-712 payload before HR signs. */
export function usePrepareContract() {
  return useMutation({
    mutationFn: (payload: PrepareContractPayload) => api.contracts.prepare(payload),
  });
}

/** Stores the HR co-signature; no transaction is sent yet. */
export function useProposeContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProposeContractPayload) => api.contracts.propose(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] }),
  });
}

/** Stores the employee's free EIP-712 signature (no transaction, no gas). */
export function useSignContractProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SignContractProposalPayload) => api.contracts.sign(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] }),
  });
}

/**
 * Publishes a dual-signed proposal on-chain. The backend system wallet sends
 * the transaction, so the caller needs no wallet, gas or funds.
 */
export function useAnchorContractProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AnchorContractProposalPayload) => api.contracts.anchor(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/** Records an anchor transaction hash manually (server re-verifies the receipt). */
export function useRecordContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: RecordContractPayload) => api.contracts.record(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contracts'] });
      void queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

/** Employer termination or employee resignation. */
export function useTerminateContract() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: TerminateContractPayload) => api.contracts.terminate(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });
}
