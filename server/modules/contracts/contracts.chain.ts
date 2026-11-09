import {
  Contract,
  Interface,
  JsonRpcProvider,
  Wallet,
  getAddress,
  verifyTypedData,
  type ContractTransactionResponse,
  type Log,
  type LogDescription,
  type TransactionReceipt,
  type TransactionResponse,
} from 'ethers';
import { env } from '../../config/env';
import { BadRequestError } from '../../shared/database/errors';
import { employmentContractRegistryAbi } from '../../../lib/blockchain/abi';
import { buildContractIntent, contractIntentTypedData } from '../../../lib/contracts/eip712';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
}

/** Validated Web3 configuration. Throws a user-facing error when missing. */
export function getChainConfig(): ChainConfig {
  const current = env();
  const rpcUrl = current.NEXT_PUBLIC_RPC_URL;
  const contractAddress = current.NEXT_PUBLIC_CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    throw new BadRequestError(
      'Blockchain is not configured. Set NEXT_PUBLIC_RPC_URL and NEXT_PUBLIC_CONTRACT_ADDRESS in the app .env, then restart Next.js.',
    );
  }

  return {
    chainId: current.NEXT_PUBLIC_CHAIN_ID ?? 80002,
    rpcUrl,
    contractAddress: getAddress(contractAddress),
  };
}

let cachedProvider: { url: string; provider: JsonRpcProvider } | null = null;

/** Shared read-only JSON-RPC provider (server side only). */
export function getProvider(): JsonRpcProvider {
  const { rpcUrl } = getChainConfig();
  if (!cachedProvider || cachedProvider.url !== rpcUrl) {
    cachedProvider = {
      url: rpcUrl,
      provider: new JsonRpcProvider(rpcUrl),
    };
  }
  return cachedProvider.provider;
}

export function getRegistryContract(): Contract {
  const { contractAddress } = getChainConfig();
  return new Contract(contractAddress, employmentContractRegistryAbi, getProvider());
}

let cachedAdminWallet: { key: string; wallet: Wallet } | null = null;

/**
 * Backend system wallet that pays the gas for on-chain contract writes. It is
 * not an app user: HR and employees only sign the EIP-712 intent, which is a
 * free signature, so no app user ever needs funds.
 */
export function getContractAdminWallet(): Wallet {
  const key = env().CONTRACT_ADMIN_PRIVATE_KEY?.trim();
  if (!key) {
    throw new BadRequestError(
      'No system wallet configured. Set CONTRACT_ADMIN_PRIVATE_KEY in the app .env so contracts can be published on-chain.',
    );
  }

  if (!cachedAdminWallet || cachedAdminWallet.key !== key) {
    cachedAdminWallet = { key, wallet: new Wallet(key, getProvider()) };
  }

  return cachedAdminWallet.wallet;
}

export interface AnchorCreateInput {
  intent: ReturnType<typeof buildContractIntent>;
  document: string;
  documentUri: string;
  employerSignature: string;
  employeeSignature: string;
  contractId: string;
}

async function assertSystemWalletFunded(address: string): Promise<void> {
  const balance = await getProvider()
    .getBalance(address)
    .catch(() => null);

  if (balance === null) {
    throw new BadRequestError('Could not reach the blockchain to check the system wallet.');
  }
  if (balance === 0n) {
    throw new BadRequestError(
      `The system wallet ${address} has no gas on this network. Fund it with testnet POL, then retry.`,
    );
  }
}

function describeAnchorError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('insufficient funds') || message.includes('INSUFFICIENT_FUNDS')) {
    return 'The system wallet cannot pay the gas for this transaction. Fund it with testnet POL, then retry.';
  }
  if (message.toLowerCase().includes('nonce')) {
    return 'The system wallet nonce is out of sync. Retry in a few seconds.';
  }

  return 'The anchor transaction could not be sent. Check the RPC node and the system wallet.';
}

/**
 * Sends `createContract` from the backend system wallet. The registry accepts
 * any sender — the two EIP-712 signatures are the authority — so the sender
 * simply pays the gas on behalf of both parties.
 */
export async function sendCreateContractTransaction(
  input: AnchorCreateInput,
): Promise<{ txHash: string; contractId: string }> {
  const { contractAddress } = getChainConfig();
  const wallet = getContractAdminWallet();

  await assertSystemWalletFunded(wallet.address);

  const registry = new Contract(
    contractAddress,
    employmentContractRegistryAbi,
    wallet,
  ) as unknown as {
    createContract(
      intent: AnchorCreateInput['intent'],
      document: string,
      documentUri: string,
      employerSignature: string,
      employeeSignature: string,
    ): Promise<ContractTransactionResponse>;
  };

  let tx: ContractTransactionResponse;
  try {
    tx = await registry.createContract(
      input.intent,
      input.document,
      input.documentUri,
      input.employerSignature,
      input.employeeSignature,
    );
  } catch (error) {
    throw new BadRequestError(describeAnchorError(error));
  }

  const receipt = await tx.wait();
  if (!receipt) throw new BadRequestError('The anchor transaction was not confirmed.');
  if (receipt.status !== 1) throw new BadRequestError('The anchor transaction reverted on-chain.');

  const event = parseReceiptEvents(receipt, contractAddress).find(
    (item) =>
      item.name === 'ContractCreated' &&
      String(item.args.id).toLowerCase() === input.contractId.toLowerCase(),
  );

  if (!event) {
    throw new BadRequestError(
      'The transaction confirmed without the expected ContractCreated event.',
    );
  }

  return { txHash: tx.hash, contractId: String(event.args.id).toLowerCase() };
}

function parseReceiptEvents(
  receipt: TransactionReceipt,
  contractAddress: string,
): LogDescription[] {
  const iface = new Interface(employmentContractRegistryAbi);

  return receipt.logs
    .filter((log: Log) => log.address.toLowerCase() === contractAddress.toLowerCase())
    .map((log) => {
      try {
        return iface.parseLog({ topics: [...log.topics], data: log.data });
      } catch {
        return null;
      }
    })
    .filter((event): event is LogDescription => event !== null);
}

async function confirmedTransaction(txHash: string): Promise<{
  receipt: TransactionReceipt;
  tx: TransactionResponse;
  events: ReturnType<typeof parseReceiptEvents>;
}> {
  const { contractAddress } = getChainConfig();
  const provider = getProvider();

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    throw new BadRequestError('Transaction is not confirmed yet. Wait a few seconds and retry.');
  }
  if (receipt.status !== 1) {
    throw new BadRequestError('The transaction reverted on-chain.');
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) throw new BadRequestError('Transaction not found on the configured network.');
  if (!tx.to || tx.to.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new BadRequestError('Transaction does not target the employment contract registry.');
  }

  return { receipt, tx, events: parseReceiptEvents(receipt, contractAddress) };
}

export async function isHrAdminOnChain(wallet: string, organizationHash: string): Promise<boolean> {
  const registry = getRegistryContract() as unknown as {
    isHrAdminFor(admin: string, organizationId: string): Promise<boolean>;
  };
  try {
    return Boolean(await registry.isHrAdminFor(wallet, organizationHash));
  } catch {
    throw new BadRequestError(
      'Could not reach the blockchain to verify the HR wallet. Check the RPC node and contract address.',
    );
  }
}

/**
 * Ensures an HR app wallet is authorised for its organisation on-chain.
 *
 * New HR accounts get freshly generated wallets, so the registry owner must
 * grant each one. The backend system wallet is expected to be the owner; if it
 * is not, the transaction reverts and we surface a clear configuration error.
 */
export async function ensureHrAdminOnChain(
  wallet: string,
  organizationHash: string,
): Promise<void> {
  if (await isHrAdminOnChain(wallet, organizationHash)) return;

  const { contractAddress } = getChainConfig();
  const systemWallet = getContractAdminWallet();
  await assertSystemWalletFunded(systemWallet.address);

  const registry = new Contract(
    contractAddress,
    employmentContractRegistryAbi,
    systemWallet,
  ) as unknown as {
    setHrAdmin(admin: string, organizationId: string): Promise<ContractTransactionResponse>;
  };

  try {
    const tx = await registry.setHrAdmin(wallet, organizationHash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new Error('setHrAdmin transaction reverted');
    }
  } catch {
    throw new BadRequestError(
      'The system wallet could not authorise the HR app wallet on-chain. Make CONTRACT_ADMIN_PRIVATE_KEY the registry owner (or grant this wallet with the blockchain script), then retry.',
    );
  }

  if (!(await isHrAdminOnChain(wallet, organizationHash))) {
    throw new BadRequestError(
      'The HR app wallet is still not authorised on-chain after the grant transaction.',
    );
  }
}

export interface VerifyCreateInput {
  txHash: string;
  contractId: string;
  organizationHash: string;
  employerWallet: string;
  employeeWallet: string;
  employeeRefHash: string;
  documentHash: string;
  startTimestamp: number;
  endTimestamp: number;
  documentUri: string;
  version: number;
  previousContractId: string;
  nonce: string;
  deadline: number;
  document: string;
  employerSignature: string;
}

export interface VerifiedCreateResult {
  createdAt: Date;
  acceptedAt: Date;
  employerSignature: string;
  employeeSignature: string;
  nonce: string;
  document: string;
}

interface OnChainContract {
  id: string;
  organizationId: string;
  employer: string;
  employee: string;
  employeeRefHash: string;
  documentHash: string;
  createdAt: bigint;
  acceptedAt: bigint;
  previousContractId: string;
  version: bigint;
  status: bigint;
  nonce: bigint;
  deadline: bigint;
  documentUri: string;
  document: string;
  employerSignature: string;
  employeeSignature: string;
}

/** Verifies the receipt, both EIP-712 signatures and the on-chain stored document. */
export async function verifyCreateTransaction(
  input: VerifyCreateInput,
): Promise<VerifiedCreateResult> {
  const { events } = await confirmedTransaction(input.txHash);

  const event = events.find(
    (item) =>
      item.name === 'ContractCreated' &&
      String(item.args.id).toLowerCase() === input.contractId.toLowerCase(),
  );

  if (!event) {
    throw new BadRequestError(
      'The transaction does not contain the expected ContractCreated event.',
    );
  }

  const matches =
    String(event.args.organizationId).toLowerCase() === input.organizationHash.toLowerCase() &&
    String(event.args.employer).toLowerCase() === input.employerWallet.toLowerCase() &&
    String(event.args.employee).toLowerCase() === input.employeeWallet.toLowerCase() &&
    String(event.args.employeeRefHash).toLowerCase() === input.employeeRefHash.toLowerCase() &&
    String(event.args.documentHash).toLowerCase() === input.documentHash.toLowerCase() &&
    BigInt(event.args.startDate) === BigInt(input.startTimestamp) &&
    BigInt(event.args.endDate) === BigInt(input.endTimestamp) &&
    BigInt(event.args.version) === BigInt(input.version) &&
    String(event.args.previousContractId).toLowerCase() ===
      input.previousContractId.toLowerCase() &&
    BigInt(event.args.nonce) === BigInt(input.nonce) &&
    BigInt(event.args.deadline) === BigInt(input.deadline) &&
    String(event.args.documentUri) === input.documentUri &&
    String(event.args.employerSignature).toLowerCase() === input.employerSignature.toLowerCase();

  if (!matches) {
    throw new BadRequestError('The on-chain contract does not match the prepared document.');
  }

  const eventEmployeeSignature = String(event.args.employeeSignature).toLowerCase();

  const intent = buildContractIntent({
    organizationHash: input.organizationHash,
    employerWallet: input.employerWallet,
    employeeWallet: input.employeeWallet,
    employeeRefHash: input.employeeRefHash,
    documentHash: input.documentHash,
    startTimestamp: input.startTimestamp,
    endTimestamp: input.endTimestamp,
    previousContractId: input.previousContractId,
    version: input.version,
    nonce: input.nonce,
    deadline: input.deadline,
  });
  const { chainId, contractAddress } = getChainConfig();
  const typedData = contractIntentTypedData(chainId, contractAddress, intent);

  try {
    const employerSigner = verifyTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
      input.employerSignature,
    );
    const employeeSigner = verifyTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
      eventEmployeeSignature,
    );

    if (employerSigner.toLowerCase() !== input.employerWallet.toLowerCase()) {
      throw new BadRequestError('The on-chain employer signature is not from the HR wallet.');
    }
    if (employeeSigner.toLowerCase() !== input.employeeWallet.toLowerCase()) {
      throw new BadRequestError('The on-chain employee signature is not from the employee wallet.');
    }
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    throw new BadRequestError('The on-chain EIP-712 signatures could not be verified.');
  }

  const registry = getRegistryContract() as unknown as {
    getContract(contractId: string): Promise<OnChainContract>;
  };

  let onChain: OnChainContract;
  try {
    onChain = await registry.getContract(input.contractId);
  } catch {
    throw new BadRequestError('The contract could not be read back from the blockchain.');
  }

  if (
    onChain.document !== input.document ||
    String(onChain.documentHash).toLowerCase() !== input.documentHash.toLowerCase()
  ) {
    throw new BadRequestError('The document stored on-chain does not match the proposal.');
  }
  if (BigInt(onChain.status) !== 1n) {
    throw new BadRequestError('The on-chain contract is not active.');
  }
  if (String(onChain.organizationId).toLowerCase() !== input.organizationHash.toLowerCase()) {
    throw new BadRequestError('The on-chain contract belongs to another organisation.');
  }
  if (String(onChain.employee).toLowerCase() !== input.employeeWallet.toLowerCase()) {
    throw new BadRequestError('The on-chain contract is assigned to another employee.');
  }
  if (BigInt(onChain.nonce) !== BigInt(input.nonce)) {
    throw new BadRequestError('The on-chain nonce does not match the proposal.');
  }
  if (BigInt(onChain.deadline) !== BigInt(input.deadline)) {
    throw new BadRequestError('The on-chain signature deadline does not match the proposal.');
  }

  return {
    createdAt: new Date(Number(onChain.createdAt) * 1000),
    acceptedAt: new Date(Number(onChain.acceptedAt) * 1000),
    employerSignature: String(onChain.employerSignature).toLowerCase(),
    employeeSignature: String(onChain.employeeSignature).toLowerCase(),
    nonce: String(onChain.nonce),
    document: String(onChain.document),
  };
}

export interface TerminateIntentInput {
  contractId: string;
  reasonHash: string;
  deadline: number;
  signature: string;
  expectedSigner: string;
}

/**
 * Sends `terminateContract` from the backend system wallet. The signed
 * `Termination` intent is the authority — the sender only pays the gas, so a
 * resignation never costs the employee anything.
 */
export async function sendTerminateContractTransaction(input: TerminateIntentInput): Promise<{
  txHash: string;
  terminatedAt: Date;
  terminatedBy: string;
  reasonHash: string;
}> {
  const { contractAddress } = getChainConfig();
  const wallet = getContractAdminWallet();

  await assertSystemWalletFunded(wallet.address);

  const registry = new Contract(
    contractAddress,
    employmentContractRegistryAbi,
    wallet,
  ) as unknown as {
    terminateContract(
      contractId: string,
      reasonHash: string,
      deadline: bigint,
      signature: string,
    ): Promise<ContractTransactionResponse>;
  };

  let tx: ContractTransactionResponse;
  try {
    tx = await registry.terminateContract(
      input.contractId,
      input.reasonHash,
      BigInt(input.deadline),
      input.signature,
    );
  } catch (error) {
    throw new BadRequestError(describeAnchorError(error));
  }

  const receipt = await tx.wait();
  if (!receipt) throw new BadRequestError('The termination transaction was not confirmed.');
  if (receipt.status !== 1) {
    throw new BadRequestError('The termination transaction reverted on-chain.');
  }

  const event = parseReceiptEvents(receipt, contractAddress).find(
    (item) =>
      item.name === 'ContractTerminated' &&
      String(item.args.id).toLowerCase() === input.contractId.toLowerCase(),
  );

  if (!event) {
    throw new BadRequestError(
      'The transaction confirmed without the expected ContractTerminated event.',
    );
  }

  const terminatedBy = String(event.args.terminatedBy).toLowerCase();
  if (terminatedBy !== input.expectedSigner.toLowerCase()) {
    throw new BadRequestError('The on-chain termination was authorised by another wallet.');
  }

  return {
    txHash: tx.hash,
    terminatedAt: new Date(Number(event.args.terminatedAt) * 1000),
    terminatedBy,
    reasonHash: String(event.args.reasonHash).toLowerCase(),
  };
}
