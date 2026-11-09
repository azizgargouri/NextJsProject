'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { web3Config } from '@/lib/blockchain/config';
import { hasMetaMask, getEthereum } from '@/lib/blockchain/ethereum';
import {
  connectWallet,
  getWalletAccounts,
  getWalletChainId,
  switchToConfiguredChain,
} from '@/lib/blockchain/metamask';
import { describeWalletError } from '@/lib/blockchain/errors';

interface WalletContextValue {
  address: string | null;
  chainId: number | null;
  hasProvider: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  isCorrectNetwork: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
  refresh: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/**
 * MetaMask session for the dashboard. This deliberately stays client-side:
 * the wallet never sends a password to the server, and every contract write
 * is verified from the transaction receipt by the server.
 */
export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasMetaMask()) {
      setHasProvider(false);
      return;
    }

    setHasProvider(true);
    try {
      const accounts = await getWalletAccounts();
      setAddress(accounts[0]?.toLowerCase() ?? null);
      setChainId(await getWalletChainId());
    } catch (refreshError) {
      setError(describeWalletError(refreshError));
    }
  }, []);

  useEffect(() => {
    void refresh();

    if (!hasMetaMask()) return;

    const ethereum = getEthereum();
    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      setAddress(accounts[0]?.toLowerCase() ?? null);
    };
    const onChainChanged = (...args: unknown[]) => {
      const next = Number.parseInt(String(args[0] ?? ''), 16);
      setChainId(Number.isNaN(next) ? null : next);
    };

    ethereum.on?.('accountsChanged', onAccountsChanged);
    ethereum.on?.('chainChanged', onChainChanged);

    return () => {
      ethereum.removeListener?.('accountsChanged', onAccountsChanged);
      ethereum.removeListener?.('chainChanged', onChainChanged);
    };
  }, [refresh]);

  const connect = useCallback(async () => {
    setError(null);
    setIsConnecting(true);
    try {
      const connection = await connectWallet();
      setAddress(connection.address);
      setChainId(connection.chainId);
      setHasProvider(true);
    } catch (connectError) {
      setError(describeWalletError(connectError));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const switchNetwork = useCallback(async () => {
    setError(null);
    try {
      await switchToConfiguredChain();
      setChainId(await getWalletChainId());
    } catch (switchError) {
      setError(describeWalletError(switchError));
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      hasProvider,
      isConnecting,
      isConnected: Boolean(address),
      isCorrectNetwork: chainId === web3Config.chainId,
      error,
      connect,
      switchNetwork,
      refresh,
      disconnect,
      clearError: () => setError(null),
    }),
    [
      address,
      chainId,
      hasProvider,
      isConnecting,
      error,
      connect,
      switchNetwork,
      refresh,
      disconnect,
    ],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) throw new Error('useWallet must be used inside <WalletProvider>');
  return context;
}
