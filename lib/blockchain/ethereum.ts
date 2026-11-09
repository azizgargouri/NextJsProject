/**
 * Minimal EIP-1193 provider surface exposed by MetaMask. Declaring it locally
 * keeps the browser globals typed without pulling a wallet SDK into the app.
 */
export interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function hasMetaMask(): boolean {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

export function getEthereum(): EthereumProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error(
      'MetaMask is not installed. Install it from https://metamask.io and reload the page.',
    );
  }
  return window.ethereum;
}
