'use client';

import { useEffect, useState } from 'react';
import { Copy, ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { useWallet } from '@/components/features/web3/wallet-provider';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { hashText } from '@/lib/contracts/document';
import {
  explorerAddressUrl,
  isContractConfigured,
  web3Config,
} from '@/lib/blockchain/config';
import { isRegisteredHrAdmin } from '@/lib/blockchain/registry';

/**
 * Wallet + network status. Also explains the on-chain setup to an admin:
 * organisation hash, assigned HR wallet and registry address.
 */
export function WalletPanel() {
  const { user } = useAuthStore();
  const {
    address,
    chainId,
    hasProvider,
    isConnecting,
    isConnected,
    isCorrectNetwork,
    error,
    connect,
    switchNetwork,
    refresh,
  } = useWallet();

  const organizationHash = user?.role === 'ADMIN' && user.id ? hashText(user.id) : null;
  const [isHrAdmin, setIsHrAdmin] = useState<boolean | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!address || !organizationHash || !isContractConfigured || !isCorrectNetwork) {
      setIsHrAdmin(null);
      return;
    }

    setIsHrAdmin(null);
    void isRegisteredHrAdmin(address, organizationHash).then((result) => {
      if (!cancelled) setIsHrAdmin(result);
    });

    return () => {
      cancelled = true;
    };
  }, [address, organizationHash, isCorrectNetwork]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const explorer = explorerAddressUrl(address);

  return (
    <section className="mt-8 border border-ink bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-4 py-3">
        <div className="flex items-center gap-2">
          <Wallet size={14} />
          <h2 className="mono text-[10px]">META_MASK WALLET</h2>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip variant={isConnected && isCorrectNetwork ? 'ink' : 'outline'}>
            {!hasProvider
              ? 'Not installed'
              : !isConnected
                ? 'Disconnected'
                : isCorrectNetwork
                  ? 'Connected'
                  : 'Wrong network'}
          </StatusChip>
          {isConnected && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[9px]" onClick={() => void refresh()}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
        <div className="space-y-2">
          {!hasProvider ? (
            <>
              <p className="text-sm text-ink-80">
                MetaMask is required to sign employee contracts. Install the extension, create or
                import a wallet, then reload this page.
              </p>
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="mono inline-flex items-center gap-2 border-b-2 border-ink pb-0.5 text-[10px] hover:border-hazard hover:text-hazard"
              >
                INSTALL METAMASK <ExternalLink size={12} />
              </a>
            </>
          ) : !isConnected ? (
            <>
              <p className="text-sm text-ink-80">
                Connect the wallet that will act as the employer (HR) or employee signer.
              </p>
              <Button variant="primary" size="sm" onClick={() => void connect()} disabled={isConnecting}>
                {isConnecting ? 'Opening MetaMask…' : 'Connect MetaMask'}
              </Button>
            </>
          ) : (
            <>
              <p className="mono text-[10px] text-ink-40">CONNECTED WALLET</p>
              <div className="flex items-center gap-2">
                <code className="mono break-all text-[11px] normal-case">{address}</code>
                <button
                  type="button"
                  title="Copy wallet address"
                  onClick={() => address && void copy(address, 'wallet')}
                  className="text-ink-40 hover:text-hazard"
                >
                  <Copy size={13} />
                </button>
                {copied === 'wallet' && <span className="mono text-[9px] text-hazard">COPIED</span>}
              </div>
              {explorer && (
                <a
                  href={explorer}
                  target="_blank"
                  rel="noreferrer"
                  className="mono inline-flex items-center gap-1 text-[9px] text-ink-40 underline underline-offset-2 hover:text-hazard"
                >
                  VIEW ON EXPLORER <ExternalLink size={10} />
                </a>
              )}
              {!isCorrectNetwork && (
                <div className="mt-3 border border-hazard bg-hazard/5 p-3">
                  <p className="mono text-[9px] text-hazard">
                    WRONG NETWORK — EXPECTED {web3Config.chainName.toUpperCase()} (
                    {web3Config.chainId})
                  </p>
                  <Button
                    variant="hazard"
                    size="sm"
                    className="mt-2"
                    onClick={() => void switchNetwork()}
                  >
                    Switch to {web3Config.chainName}
                  </Button>
                </div>
              )}
              {isCorrectNetwork && organizationHash && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="mono text-[9px] text-ink-40">ON-CHAIN HR ROLE:</span>
                  <StatusChip variant={isHrAdmin ? 'ink' : 'hazard'}>
                    {isHrAdmin === null ? 'Checking…' : isHrAdmin ? 'Authorized' : 'Not authorized'}
                  </StatusChip>
                  {isHrAdmin === false && (
                    <span className="mono text-[9px] normal-case tracking-normal text-ink-40">
                      Run the grant script for this wallet before creating contracts.
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {error && (
            <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[10px] normal-case tracking-normal text-hazard">
              {error}
            </p>
          )}
        </div>

        <div className="space-y-2 border-t border-ink/15 pt-3 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <p className="mono text-[10px] text-ink-40">NETWORK / REGISTRY</p>
          <p className="mono text-[11px]">
            {web3Config.chainName} · chain {chainId ?? web3Config.chainId}
          </p>
          <p className="mono break-all text-[10px] normal-case tracking-normal text-ink-80">
            {isContractConfigured ? web3Config.contractAddress : 'Contract address not configured'}
          </p>
          {!isContractConfigured && (
            <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[9px] normal-case tracking-normal text-hazard">
              SET NEXT_PUBLIC_CONTRACT_ADDRESS IN .env AND RESTART NEXT.JS.
            </p>
          )}
          {organizationHash && (
            <div className="pt-2">
              <div className="flex items-center gap-2">
                <p className="mono text-[9px] text-ink-40">YOUR ORGANISATION HASH</p>
                <button
                  type="button"
                  title="Copy organisation hash"
                  onClick={() => void copy(organizationHash, 'org')}
                  className="text-ink-40 hover:text-hazard"
                >
                  <Copy size={12} />
                </button>
                {copied === 'org' && <span className="mono text-[9px] text-hazard">COPIED</span>}
              </div>
              <code className="mono break-all text-[10px] normal-case tracking-normal text-ink-80">
                {organizationHash}
              </code>
              <p className="mt-2 flex items-start gap-1 text-[11px] text-ink-40">
                <ShieldCheck size={13} className="mt-0.5 shrink-0" />
                Use this hash with the grant script. It is keccak256(your Mongo user id) — the id
                itself never goes on-chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
