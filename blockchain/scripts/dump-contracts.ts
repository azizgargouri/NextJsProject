import { ethers, network } from 'hardhat';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Recovers every contract directly from the chain — no MongoDB and no Next.js
 * server involved.
 *
 * Hosted testnet RPCs reject `eth_getLogs` over an unlimited block range, so
 * events are queried in chunks. Pass `DUMP_ID` to skip event scanning entirely
 * and read one contract record by id (useful when the contract id came from a
 * transaction receipt or a colleague).
 *
 * Hardhat rejects unknown CLI flags, so filters are passed as environment
 * variables:
 *
 *   npm run dump:amoy
 *   DUMP_ORG=0x<organizationHash> npm run dump:amoy
 *   DUMP_EMPLOYEE=0x<employeeWallet> npm run dump:amoy
 *   DUMP_ID=0x<contractId> npm run dump:amoy
 *   DUMP_JSON=1 npm run dump:amoy > contracts.json
 *
 * Optional overrides when the deployment file is missing:
 *   CONTRACT_ADDRESS=0x...   registry address
 *   DEPLOYMENT_BLOCK=123456  first block to scan for events
 */
// Stay within hosted RPC limits (Alchemy/Infura reject wide block ranges).
const LOG_CHUNK_SIZE = 2_000;

interface DeploymentInfo {
  address: string;
  blockNumber?: number | null;
}

interface RegistryLike {
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
    previousContractId: string;
    supersededBy: string;
    version: bigint;
    status: bigint;
    nonce: bigint;
    deadline: bigint;
    documentUri: string;
    document: string;
    employerSignature: string;
    employeeSignature: string;
  }>;
  contractExists(contractId: string): Promise<boolean>;
  filters: { ContractCreated(): unknown };
  queryFilter(
    filter: unknown,
    fromBlock: number,
    toBlock: number,
  ): Promise<
    {
      args?: { id?: unknown; organizationId?: unknown; employee?: unknown };
      blockNumber: number;
      transactionHash: string;
    }[]
  >;
}

function deploymentFile(): string {
  return path.resolve(__dirname, '..', 'deployments', `${network.name}.json`);
}

function readDeploymentFile(): DeploymentInfo | null {
  const file = deploymentFile();
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as DeploymentInfo;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function toDate(seconds: number): string | null {
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function resolveRegistry(): { address: string; fromBlock: number } {
  const override = process.env.CONTRACT_ADDRESS?.trim();
  const deployment = readDeploymentFile();
  const address = override || deployment?.address;

  if (!address) {
    throw new Error(
      `No registry address found. Run "npm run deploy:${network.name}" first or set CONTRACT_ADDRESS.`,
    );
  }

  const explicitBlock = process.env.DEPLOYMENT_BLOCK?.trim();
  let fromBlock = 0;
  if (explicitBlock) {
    fromBlock = Number(explicitBlock);
  } else if (!override && deployment?.blockNumber) {
    fromBlock = deployment.blockNumber;
  }

  return { address, fromBlock };
}

async function createdEvents(
  registry: RegistryLike,
  fromBlock: number,
  toBlock: number,
): Promise<Awaited<ReturnType<RegistryLike['queryFilter']>>> {
  const events: Awaited<ReturnType<RegistryLike['queryFilter']>> = [];

  for (let start = fromBlock; start <= toBlock; start += LOG_CHUNK_SIZE) {
    const end = Math.min(start + LOG_CHUNK_SIZE - 1, toBlock);
    const chunk = await registry.queryFilter(registry.filters.ContractCreated(), start, end);
    events.push(...chunk);
  }

  return events;
}

interface RecoveredContract {
  contractId: string;
  organizationHash: string;
  employer: string;
  employee: string;
  employeeRefHash: string;
  documentHash: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  terminatedAt: string | null;
  status: string;
  version: number;
  nonce: string;
  deadline: number;
  previousContractId: string;
  supersededBy: string;
  documentUri: string;
  employerSignature: string;
  employeeSignature: string;
  blockNumber: number | null;
  transactionHash: string | null;
  document: unknown;
}

async function readRecord(
  registry: RegistryLike,
  contractId: string,
  blockNumber: number | null,
  transactionHash: string | null,
): Promise<RecoveredContract> {
  const contract = await registry.getContract(contractId);

  let document: unknown = contract.document;
  try {
    document = JSON.parse(String(contract.document)) as unknown;
  } catch {
    // Keep the raw string if the stored document is not valid JSON.
  }

  return {
    contractId: String(contract.id),
    organizationHash: String(contract.organizationId),
    employer: String(contract.employer),
    employee: String(contract.employee),
    employeeRefHash: String(contract.employeeRefHash),
    documentHash: String(contract.documentHash),
    startDate: toDate(Number(contract.startDate)),
    endDate: toDate(Number(contract.endDate)),
    createdAt: toDate(Number(contract.createdAt)),
    terminatedAt: toDate(Number(contract.terminatedAt)),
    status: ['None', 'Active', 'Terminated', 'Superseded'][Number(contract.status)] ?? 'Unknown',
    version: Number(contract.version),
    nonce: String(contract.nonce),
    deadline: Number(contract.deadline),
    previousContractId: String(contract.previousContractId),
    supersededBy: String(contract.supersededBy),
    documentUri: String(contract.documentUri),
    employerSignature: String(contract.employerSignature),
    employeeSignature: String(contract.employeeSignature),
    blockNumber,
    transactionHash,
    document,
  };
}

async function main() {
  const { address, fromBlock } = resolveRegistry();
  const registry = (await ethers.getContractAt(
    'EmploymentContractRegistry',
    address,
  )) as unknown as RegistryLike;

  const organization = (process.env.DUMP_ORG ?? arg('org'))?.toLowerCase();
  const employee = (process.env.DUMP_EMPLOYEE ?? arg('employee'))?.toLowerCase();
  const contractId = (process.env.DUMP_ID ?? arg('id'))?.toLowerCase();
  const asJson = process.env.DUMP_JSON === '1' || process.argv.includes('--json');

  let candidates: { id: string; blockNumber: number | null; transactionHash: string | null }[] = [];

  if (contractId) {
    if (!(await registry.contractExists(contractId))) {
      console.error(`No on-chain contract with id ${contractId} on ${network.name}.`);
      process.exitCode = 1;
      return;
    }
    candidates = [{ id: contractId, blockNumber: null, transactionHash: null }];
  } else {
    const latest = await ethers.provider.getBlockNumber();
    if (fromBlock === 0 && latest > 1_000_000) {
      console.warn(
        'Scanning from genesis; this can take a while. Set DEPLOYMENT_BLOCK to narrow the range.',
      );
    }
    const events = fromBlock > latest ? [] : await createdEvents(registry, fromBlock, latest);

    candidates = events
      .filter((event) => event.args?.id !== undefined)
      .map((event) => ({
        id: String(event.args?.id).toLowerCase(),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
      }));
  }

  const records: RecoveredContract[] = [];
  for (const candidate of candidates) {
    const record = await readRecord(
      registry,
      candidate.id,
      candidate.blockNumber,
      candidate.transactionHash,
    );
    if (organization && record.organizationHash.toLowerCase() !== organization) continue;
    if (employee && record.employee.toLowerCase() !== employee) continue;
    records.push(record);
  }

  if (records.length === 0) {
    console.error('No on-chain contracts matched the filters.');
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(records, null, 2));
    return;
  }

  console.log(`Registry: ${address}  (${network.name})`);
  console.log(`Recovered ${records.length} contract(s) from chain (no database, no Next.js).\n`);

  for (const record of records) {
    console.log('─'.repeat(78));
    console.log(`${record.contractId}  [${record.status}]  v${record.version}`);
    console.log(`Employee: ${record.employee}`);
    console.log(`Employer: ${record.employer}`);
    console.log(`Created:  ${record.createdAt}`);
    console.log(`Deadline: ${new Date(record.deadline * 1000).toISOString()}`);
    console.log(`Document: ${record.documentUri}`);
    console.log(`Hash:     ${record.documentHash}`);
    console.log(
      `Tx:       ${record.transactionHash ?? 'n/a (read directly by contract id)'}`,
    );
    console.log('Signatures: employer + employee ✔');
    console.log(JSON.stringify(record.document, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
