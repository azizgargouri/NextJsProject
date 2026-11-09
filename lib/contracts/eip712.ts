import { AbiCoder, ZeroHash, keccak256 } from 'ethers';
import type {
  ContractIntentMessage,
  ContractIntentTypedData,
  ContractTerminationTypedData,
} from '@/types';

/**
 * EIP-712 definition shared by the browser and the server.
 *
 * The Solidity contract declares the exact same type string:
 *   ContractIntent(bytes32 organizationId,address employer,address employee,
 *   bytes32 employeeRefHash,bytes32 documentHash,uint64 startDate,uint64 endDate,
 *   bytes32 previousContractId,uint32 version,uint256 nonce,uint64 deadline)
 *
 * Changing this list requires redeploying the registry.
 */
export const CONTRACT_INTENT_DOMAIN = {
  name: 'MoveUp Employment Contract Registry',
  version: '2',
} as const;

export const CONTRACT_INTENT_TYPES = {
  ContractIntent: [
    { name: 'organizationId', type: 'bytes32' },
    { name: 'employer', type: 'address' },
    { name: 'employee', type: 'address' },
    { name: 'employeeRefHash', type: 'bytes32' },
    { name: 'documentHash', type: 'bytes32' },
    { name: 'startDate', type: 'uint64' },
    { name: 'endDate', type: 'uint64' },
    { name: 'previousContractId', type: 'bytes32' },
    { name: 'version', type: 'uint32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export interface ContractIntentInput {
  organizationHash: string;
  employerWallet: string;
  employeeWallet: string;
  employeeRefHash: string;
  documentHash: string;
  startTimestamp: number;
  endTimestamp: number;
  previousContractId?: string | null;
  version: number;
  nonce: string;
  deadline: number;
}

/** Builds the exact message object both MetaMask wallets sign. */
export function buildContractIntent(input: ContractIntentInput): ContractIntentMessage {
  return {
    organizationId: input.organizationHash.toLowerCase(),
    employer: input.employerWallet.toLowerCase(),
    employee: input.employeeWallet.toLowerCase(),
    employeeRefHash: input.employeeRefHash.toLowerCase(),
    documentHash: input.documentHash.toLowerCase(),
    startDate: input.startTimestamp,
    endDate: input.endTimestamp,
    previousContractId: (input.previousContractId ?? ZeroHash).toLowerCase(),
    version: input.version,
    nonce: input.nonce,
    deadline: input.deadline,
  };
}

/**
 * Mirrors `_contractId` in Solidity:
 * keccak256(abi.encode(organizationId, employee, employeeRefHash, version, nonce)).
 */
export function computeContractId(message: ContractIntentMessage): string {
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      ['bytes32', 'address', 'bytes32', 'uint32', 'uint256'],
      [
        message.organizationId,
        message.employee,
        message.employeeRefHash,
        message.version,
        BigInt(message.nonce),
      ],
    ),
  );
}

/**
 * Termination intent signed by the HR wallet (dismissal) or by the employee
 * (resignation). The signature is free; the backend system wallet submits the
 * transaction and pays the gas.
 *
 * Mirrors the Solidity typehash:
 *   Termination(bytes32 contractId,bytes32 reasonHash,uint64 deadline)
 */
export const TERMINATION_TYPES = {
  Termination: [
    { name: 'contractId', type: 'bytes32' },
    { name: 'reasonHash', type: 'bytes32' },
    { name: 'deadline', type: 'uint64' },
  ],
} as const;

export interface ContractTerminationInput {
  contractId: string;
  reasonHash: string;
  deadline: number;
}

/** Full termination `signTypedData` payload for MetaMask. */
export function contractTerminationTypedData(
  chainId: number,
  contractAddress: string,
  input: ContractTerminationInput,
): ContractTerminationTypedData {
  return {
    domain: {
      ...CONTRACT_INTENT_DOMAIN,
      chainId,
      verifyingContract: contractAddress,
    },
    types: {
      Termination: TERMINATION_TYPES.Termination.map((field) => ({ ...field })),
    },
    primaryType: 'Termination',
    message: {
      contractId: input.contractId.toLowerCase(),
      reasonHash: input.reasonHash.toLowerCase(),
      deadline: input.deadline,
    },
  };
}

/** Full `signTypedData` payload; `types` excludes EIP712Domain (ethers adds it). */
export function contractIntentTypedData(
  chainId: number,
  contractAddress: string,
  message: ContractIntentMessage,
): ContractIntentTypedData {
  return {
    domain: {
      ...CONTRACT_INTENT_DOMAIN,
      chainId,
      verifyingContract: contractAddress,
    },
    types: {
      ContractIntent: CONTRACT_INTENT_TYPES.ContractIntent.map((field) => ({ ...field })),
    },
    primaryType: 'ContractIntent',
    message,
  };
}
