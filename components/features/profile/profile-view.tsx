'use client';

import { useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { explorerAddressUrl } from '@/lib/blockchain/config';

/**
 * Profile page — account identity + app wallet address.
 * Wallets are created and managed by the server; only the public address is shown.
 */
export function ProfileView() {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const walletAddress = user?.walletAddress ?? null;
  const explorer = explorerAddressUrl(walletAddress);

  const copy = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header>
        <h1 className="display text-4xl md:text-6xl">PROFILE.</h1>
        <p className="mono mt-3 text-[10px] text-ink-40">
          {user ? `SIGNED IN AS ${user.name.toUpperCase()}` : 'YOUR ACCOUNT DETAILS'}
        </p>
      </header>

      {user && (
        <section className="mt-8 max-w-2xl space-y-4">
          <div className="border border-ink bg-paper px-4 py-4">
            <p className="mono text-[9px] text-ink-40">NAME</p>
            <p className="mt-1 text-sm">{user.name}</p>
          </div>

          <div className="border border-ink bg-paper px-4 py-4">
            <p className="mono text-[9px] text-ink-40">EMAIL</p>
            <p className="mt-1 text-sm">{user.email}</p>
          </div>

          <div className="border border-ink bg-paper px-4 py-4">
            <p className="mono text-[9px] text-ink-40">WALLET ADDRESS</p>
            {walletAddress ? (
              <>
                <div className="mt-1 flex items-center gap-2">
                  <code className="mono break-all text-sm normal-case">{walletAddress}</code>
                  <button
                    type="button"
                    title="Copy wallet address"
                    onClick={() => void copy()}
                    className="shrink-0 text-ink-40 hover:text-hazard"
                  >
                    <Copy size={13} />
                  </button>
                  {copied && <span className="mono text-[9px] text-hazard">COPIED</span>}
                </div>
                {explorer && (
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="mono mt-2 inline-flex items-center gap-1 text-[9px] text-ink-40 underline underline-offset-2 hover:text-hazard"
                  >
                    VIEW ON EXPLORER <ExternalLink size={10} />
                  </a>
                )}
              </>
            ) : (
              <p className="mt-1 text-sm text-ink-40">Created automatically on first contract</p>
            )}
          </div>

          <div className="border border-ink bg-paper px-4 py-4">
            <p className="mono text-[9px] text-ink-40">PHONE</p>
            <p className="mt-1 text-sm">{user.phone || '—'}</p>
          </div>
        </section>
      )}
    </main>
  );
}
