/**
 * Browser-safe Web3 configuration. Every value comes from NEXT_PUBLIC_* so it
 * is inlined at build time by Next.js. Only the contract address and RPC URL
 * are public — never put a private key in this file.
 */
// Testnet-first: the registry is deployed on Polygon Amoy (chain 80002).
// Sepolia and local Hardhat remain opt-in overrides via NEXT_PUBLIC_* values.
const DEFAULT_CHAIN_ID = 80002;

interface NetworkDefaults {
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  currencyName: string;
  currencySymbol: string;
}

const NETWORKS: Record<number, NetworkDefaults> = {
  80002: {
    name: 'Polygon Amoy',
    rpcUrl: 'https://polygon-amoy-bor-rpc.publicnode.com',
    explorerUrl: 'https://amoy.polygonscan.com',
    currencyName: 'POL',
    currencySymbol: 'POL',
  },
  11155111: {
    name: 'Sepolia',
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    currencyName: 'Ether',
    currencySymbol: 'ETH',
  },
  31337: {
    name: 'Hardhat Local',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: '',
    currencyName: 'Ether',
    currencySymbol: 'ETH',
  },
};

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? DEFAULT_CHAIN_ID);
const defaults = NETWORKS[chainId];

export const web3Config = {
  chainId,
  chainName: process.env.NEXT_PUBLIC_CHAIN_NAME ?? defaults?.name ?? `Chain ${chainId}`,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? defaults?.rpcUrl ?? '',
  contractAddress: (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? '').trim(),
  explorerUrl: (process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? defaults?.explorerUrl ?? '').trim(),
  nativeCurrency: {
    name: defaults?.currencyName ?? 'Ether',
    symbol: defaults?.currencySymbol ?? 'ETH',
    decimals: 18,
  },
} as const;

export const isContractConfigured = /^0x[a-fA-F0-9]{40}$/.test(web3Config.contractAddress);

export function shortAddress(address: string | null | undefined, size = 4): string {
  if (!address) return '—';
  return `${address.slice(0, 2 + size)}…${address.slice(-size)}`;
}

export function explorerTxUrl(hash: string | null | undefined): string | null {
  if (!hash || !web3Config.explorerUrl) return null;
  return `${web3Config.explorerUrl.replace(/\/$/, '')}/tx/${hash}`;
}

export function explorerAddressUrl(address: string | null | undefined): string | null {
  if (!address || !web3Config.explorerUrl) return null;
  return `${web3Config.explorerUrl.replace(/\/$/, '')}/address/${address}`;
}
