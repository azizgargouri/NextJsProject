'use server';

import type { ContractProposalDto, EmployeeContractDto, PreparedContractDto } from '@/types';
import { EventType, logEvent } from '@/server/shared/logger/audit';
import { requireActionUser, parseActionPayload, runAction } from '@/server/actions/helpers';
import { contractsService } from '@/server/modules/contracts/contracts.service';
import {
  ContractAnchorProposalSchema,
  ContractPrepareSchema,
  ContractProposeSchema,
  ContractRecordSchema,
  ContractSignProposalSchema,
  ContractTerminateSchema,
} from '@/server/modules/contracts/contracts.schema';
import type { ActionResult } from '@/lib/actions/result';

/* --- Employee contracts (dual-signed on-chain registry) --- */

export async function prepareContractAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<PreparedContractDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(ContractPrepareSchema, payload);
    const prepared = await contractsService.prepare(user, input);

    logEvent({
      event: EventType.CONTRACT_PREPARE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.prepare',
      logInfo: { employeeId: input.employeeId, documentHash: prepared.documentHash },
    });

    return prepared;
  });
}

/** Stores the HR EIP-712 signature; the employee still has to co-sign. */
export async function proposeContractAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<ContractProposalDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(ContractProposeSchema, payload);
    const proposal = await contractsService.propose(user, input);

    logEvent({
      event: EventType.CONTRACT_PROPOSE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.propose',
      logInfo: {
        proposalId: proposal.id,
        employeeRef: proposal.employee?.employeeRef,
        documentHash: proposal.documentHash,
      },
    });

    return proposal;
  });
}

/** Stores the employee's free EIP-712 co-signature; HR anchors it later. */
export async function signContractProposalAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<ContractProposalDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(ContractSignProposalSchema, payload);
    const proposal = await contractsService.signProposal(user, input);

    logEvent({
      event: EventType.CONTRACT_SIGN,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.signProposal',
      logInfo: {
        proposalId: proposal.id,
        employeeRef: proposal.employee?.employeeRef,
        documentHash: proposal.documentHash,
      },
    });

    return proposal;
  });
}

/**
 * Publishes a dual-signed proposal: the backend system wallet pays the gas, so
 * nobody using the app spends anything.
 */
export async function anchorContractProposalAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<EmployeeContractDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken, { admin: true });
    const input = parseActionPayload(ContractAnchorProposalSchema, payload);
    const contract = await contractsService.anchor(user, input);

    logEvent({
      event: EventType.CONTRACT_CREATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.anchor',
      logInfo: {
        contractId: contract.contractId,
        employeeRef: contract.employee?.employeeRef,
        txHash: contract.createdTxHash,
      },
    });

    return contract;
  });
}

/** Verifies an anchor transaction receipt and writes the DB mirror. */
export async function recordContractAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<EmployeeContractDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(ContractRecordSchema, payload);
    const contract = await contractsService.record(user, input);

    logEvent({
      event: EventType.CONTRACT_CREATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.record',
      logInfo: {
        contractId: contract.contractId,
        employeeRef: contract.employee?.employeeRef,
        txHash: input.txHash,
      },
    });

    return contract;
  });
}

export async function terminateContractAction(
  accessToken: string | null | undefined,
  payload: unknown,
): Promise<ActionResult<EmployeeContractDto>> {
  return runAction(async () => {
    const user = await requireActionUser(accessToken);
    const input = parseActionPayload(ContractTerminateSchema, payload);
    const contract = await contractsService.terminate(user, input);

    logEvent({
      event: EventType.CONTRACT_TERMINATE,
      userId: user.sub,
      method: 'SERVER_ACTION',
      api: 'action:contracts.terminate',
      logInfo: { contractId: contract.contractId, txHash: contract.terminatedTxHash },
    });

    return contract;
  });
}
