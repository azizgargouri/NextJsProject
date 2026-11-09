import { ethers, network } from 'hardhat';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EXPLORERS: Record<string, string> = {
  amoy: 'https://amoy.polygonscan.com',
  sepolia: 'https://sepolia.etherscan.io',
};

const CHAIN_NAMES: Record<string, string> = {
  amoy: 'Polygon Amoy',
  sepolia: 'Sepolia',
  localhost: 'Hardhat Local',
  hardhat: 'Hardhat Local',
};

/**
 * Resolves the organisation hash expected by the registry.
 * `ORGANIZATION_ID` is the Mongo `_id` of the HR account (the app's `user.sub`).
 */
export function resolveOrganizationHash(): string | null {
  const explicit = process.env.ORGANIZATION_HASH?.trim();
  if (explicit) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(explicit)) {
      throw new Error('ORGANIZATION_HASH must be a 32-byte hex value (0x + 64 chars).');
    }
    return explicit.toLowerCase();
  }

  const organizationId = process.env.ORGANIZATION_ID?.trim();
  if (!organizationId) return null;

  return ethers.keccak256(ethers.toUtf8Bytes(organizationId));
}

export function deploymentPath(networkName: string): string {
  return path.resolve(__dirname, '..', 'deployments', `${networkName}.json`);
}

export function writeDeployment(
  networkName: string,
  data: Record<string, unknown>,
): string {
  const file = deploymentPath(networkName);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  return file;
}

export function readDeployment(networkName: string): { address: string } {
  const file = deploymentPath(networkName);
  if (!fs.existsSync(file)) {
    throw new Error(
      `No deployment found for "${networkName}". Run "npm run deploy:${networkName}" first or set CONTRACT_ADDRESS.`,
    );
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as { address: string };
}

/** Registry address from CONTRACT_ADDRESS or deployments/<network>.json. */
export function resolveRegistryAddress(networkName: string): string {
  const override = process.env.CONTRACT_ADDRESS?.trim();
  if (override) return override;
  return readDeployment(networkName).address;
}

export function explorerUrl(networkName: string): string {
  return (
    process.env.BLOCK_EXPLORER_URL?.trim() || EXPLORERS[networkName] || ''
  );
}

export function printAppEnv(address: string, chainId: number): void {
  const rpcVar = `${network.name.toUpperCase()}_RPC_URL`;
  const rpcUrl =
    network.name === 'localhost'
      ? process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545'
      : process.env[rpcVar]?.trim() ?? '';

  const chainName = CHAIN_NAMES[network.name] ?? network.name;

  console.log('\nAdd these lines to the app root .env (or .env.local) and restart Next.js:\n');
  console.log(`NEXT_PUBLIC_CHAIN_ID=${chainId}`);
  console.log(`NEXT_PUBLIC_CHAIN_NAME="${chainName}"`);
  console.log(`NEXT_PUBLIC_RPC_URL=${rpcUrl}`);
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
  console.log(`NEXT_PUBLIC_BLOCK_EXPLORER_URL=${explorerUrl(network.name)}`);
  console.log('');
}
