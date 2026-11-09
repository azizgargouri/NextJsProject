import { web3Config } from './config';
import { getEthereum, type EthereumProvider } from './ethereum';

export interface WalletConnection {
  address: string;
  chainId: number;
}

function toHexChainId(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}

function errorCode(error: unknown): number | string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    return (error as { code?: number | string }).code;
  }
  return undefined;
}

export function isUserRejection(error: unknown): boolean {
  return errorCode(error) === 4001;
}

export function isUnknownChain(error: unknown): boolean {
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : '';
  return code === 4902 || message.toLowerCase().includes('unrecognized chain');
}

export async function getWalletAccounts(): Promise<string[]> {
  const accounts = await getEthereum().request({ method: 'eth_accounts' });
  return Array.isArray(accounts) ? (accounts as string[]) : [];
}

export async function getWalletChainId(): Promise<number> {
  const chainId = await getEthereum().request({ method: 'eth_chainId' });
  return Number.parseInt(String(chainId), 16);
}

/** Asks the wallet to switch to the configured chain, adding it if unknown. */
export async function switchToConfiguredChain(): Promise<void> {
  const ethereum: EthereumProvider = getEthereum();
  const chainId = toHexChainId(web3Config.chainId);

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
    return;
  } catch (error) {
    if (!isUnknownChain(error)) throw error;
  }

  const chainParams: Record<string, unknown> = {
    chainId,
    chainName: web3Config.chainName,
    nativeCurrency: web3Config.nativeCurrency,
    rpcUrls: [web3Config.rpcUrl],
  };

  if (web3Config.explorerUrl) {
    chainParams.blockExplorerUrls = [web3Config.explorerUrl];
  }

  await ethereum.request({
    method: 'wallet_addEthereumChain',
    params: [chainParams],
  });
}

/** Prompts MetaMask for account access and ensures the configured network. */
export async function connectWallet(): Promise<WalletConnection> {
  const ethereum = getEthereum();

  const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
  const address = accounts[0];
  if (!address) throw new Error('MetaMask did not return an account.');

  let chainId = await getWalletChainId();
  if (chainId !== web3Config.chainId) {
    await switchToConfiguredChain();
    chainId = await getWalletChainId();
  }

  return { address: address.toLowerCase(), chainId };
}
