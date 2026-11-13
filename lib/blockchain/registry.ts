import {
  BrowserProvider,
  Contract,
  JsonRpcProvider,
  type ContractRunner,
  type ContractTransactionResponse,
  type Eip1193Provider as EthersEip1193Provider,
  type Signer,
} from 'ethers';
import { employmentContractRegistryAbi } from './abi';
import { isContractConfigured, web3Config } from './config';
import { getEthereum } from './ethereum';
import type {
  ContractIntentMessage,
  ContractIntentTypedData,
  ContractTerminationTypedData,
} from '@/types';

/**
 * Typed façade over the generated ABI. ethers' generic `Contract` index
 * signature marks every method as optional, which does not play well with
 * `noUncheckedIndexedAccess`; this interface keeps the call sites precise.
 */
interface RegistryContract {
  createContract(
    intent: ContractIntentMessage,
    document: string,
    documentUri: string,
    employerSignature: string,
    employeeSignature: string,
  ): Promise<ContractTransactionResponse>;
  getContract(contractId: string): Promise<{
    id: string;
    organizationId: string;
    employer: string;
    employee: string;
    employeeRefHash: string;
    documentHash: string;
    startDate: bigint;
    endDate: bigint;
    createdAt: bigint;
    acceptedAt: bigint;
    terminatedAt: bigint;
    terminationReasonHash: string;
    previousContractId: string;
    supersededBy: string;
    terminatedBy: string;
    version: bigint;
    status: bigint;
    nonce: bigint;
    deadline: bigint;
    documentUri: string;
    document: string;
    employerSignature: string;
    employeeSignature: string;
  }>;
  hashContractIntent(intent: ContractIntentMessage): Promise<string>;
  terminateContract(
    contractId: string,
    reasonHash: string,
    deadline: bigint,
    signature: string,
  ): Promise<ContractTransactionResponse>;
  isHrAdminFor(admin: string, organizationHash: string): Promise<boolean>;
  ownerOf(tokenId: bigint): Promise<string>;
  coOwnerOf(tokenId: bigint): Promise<string>;
  ownersOf(tokenId: bigint): Promise<[string, string]>;
  isContractOwner(account: string, tokenId: bigint): Promise<boolean>;
  tokenURI(tokenId: bigint): Promise<string>;
}

export interface ContractNftInfo {
  tokenId: string;
  employer: string;
  employee: string;
  tokenUri: string;
}

export interface OnChainContractRecord {
  id: string;
  organizationId: string;
  employer: string;
  employee: string;
  employeeRefHash: string;
  documentHash: string;
  startDate: number;
  endDate: number;
  createdAt: number;
  acceptedAt: number;
  terminatedAt: number;
  terminationReasonHash: string;
  previousContractId: string;
  supersededBy: string;
  terminatedBy: string;
  version: number;
  status: number;
  nonce: string;
  deadline: number;
  documentUri: string;
  document: string;
  employerSignature: string;
  employeeSignature: string;
  nft: ContractNftInfo | null;
}

function assertConfigured(): void {
  if (!isContractConfigured) {
    throw new Error(
      'Contract address missing. Set NEXT_PUBLIC_CONTRACT_ADDRESS in the app .env and restart Next.js.',
    );
  }
}

export async function getBrowserProvider(): Promise<BrowserProvider> {
  const ethereum = getEthereum();
  return new BrowserProvider(ethereum as unknown as EthersEip1193Provider);
}

export async function getSigner(): Promise<Signer> {
  const provider = await getBrowserProvider();
  return provider.getSigner();
}

let cachedReadProvider: { url: string; provider: JsonRpcProvider } | null = null;

/** Read-only provider backed by the public RPC — no MetaMask required. */
function getReadProvider(): JsonRpcProvider {
  assertConfigured();
  const url = web3Config.rpcUrl;
  if (!url) {
    throw new Error(
      'RPC URL missing. Set NEXT_PUBLIC_RPC_URL in the app .env and restart Next.js.',
    );
  }
  if (!cachedReadProvider || cachedReadProvider.url !== url) {
    cachedReadProvider = { url, provider: new JsonRpcProvider(url) };
  }
  return cachedReadProvider.provider;
}

function attachRegistry(runner: ContractRunner): RegistryContract {
  assertConfigured();
  return new Contract(
    web3Config.contractAddress,
    employmentContractRegistryAbi,
    runner,
  ) as unknown as RegistryContract;
}

/** Asks MetaMask to sign the exact EIP-712 intent (no gas, no transaction). */
export async function signContractIntent(
  typedData: ContractIntentTypedData,
): Promise<{ signature: string; signer: string }> {
  const signer = await getSigner();
  const address = await signer.getAddress();
  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
  );

  return { signature, signer: address.toLowerCase() };
}

/**
 * Employee step: co-sign the HR-signed intent. This is a signature only — no
 * transaction is sent, so the employee never needs gas or testnet funds.
 */
export async function signContractAsEmployee(
  typedData: ContractIntentTypedData,
): Promise<{ signature: string; signer: string }> {
  const signer = await getSigner();
  const address = (await signer.getAddress()).toLowerCase();

  if (address !== typedData.message.employee.toLowerCase()) {
    throw new Error(
      `Switch MetaMask to the employee wallet ${typedData.message.employee} before signing.`,
    );
  }

  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
  );

  return { signature, signer: address };
}

/** Reads the full contract, including the document JSON, directly from the chain. */
export async function readContractOnChain(
  contractId: string,
): Promise<OnChainContractRecord> {
  const registry = attachRegistry(getReadProvider());
  const record = await registry.getContract(contractId);

  let nft: ContractNftInfo | null = null;
  try {
    const tokenId = BigInt(contractId);
    const [employer, employee] = await registry.ownersOf(tokenId);
    nft = {
      tokenId: tokenId.toString(),
      employer: String(employer),
      employee: String(employee),
      tokenUri: await registry.tokenURI(tokenId),
    };
  } catch {
    // Legacy registries (deployed before the NFT upgrade) have no token.
  }

  return {
    id: String(record.id),
    organizationId: String(record.organizationId),
    employer: String(record.employer),
    employee: String(record.employee),
    employeeRefHash: String(record.employeeRefHash),
    documentHash: String(record.documentHash),
    startDate: Number(record.startDate),
    endDate: Number(record.endDate),
    createdAt: Number(record.createdAt),
    acceptedAt: Number(record.acceptedAt),
    terminatedAt: Number(record.terminatedAt),
    terminationReasonHash: String(record.terminationReasonHash),
    previousContractId: String(record.previousContractId),
    supersededBy: String(record.supersededBy),
    terminatedBy: String(record.terminatedBy),
    version: Number(record.version),
    status: Number(record.status),
    nonce: String(record.nonce),
    deadline: Number(record.deadline),
    documentUri: String(record.documentUri),
    document: String(record.document),
    employerSignature: String(record.employerSignature),
    employeeSignature: String(record.employeeSignature),
    nft,
  };
}

/**
 * Termination step: the HR wallet (dismissal) or the employee (resignation)
 * signs the `Termination` intent. Signature only — no transaction, no gas.
 */
export async function signContractTermination(
  typedData: ContractTerminationTypedData,
): Promise<{ signature: string; signer: string }> {
  const signer = await getSigner();
  const address = (await signer.getAddress()).toLowerCase();
  const signature = await signer.signTypedData(
    typedData.domain,
    typedData.types,
    typedData.message,
  );

  return { signature, signer: address };
}

/** Reads whether an app wallet is registered as HR for the organisation. */
export async function isRegisteredHrAdmin(
  wallet: string,
  organizationHash: string,
): Promise<boolean> {
  if (!isContractConfigured) return false;

  try {
    const registry = attachRegistry(getReadProvider());
    return Boolean(await registry.isHrAdminFor(wallet, organizationHash));
  } catch {
    return false;
  }
}
