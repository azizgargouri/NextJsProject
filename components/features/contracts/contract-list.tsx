'use client';

import { useState } from 'react';
import {
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/field';
import { StatusLabel } from '@/components/ui/status-chip';
import { useTerminateContract } from '@/hooks/content/hr';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { readContractOnChain, type OnChainContractRecord } from '@/lib/blockchain/registry';
import { extractErrorMessage } from '@/lib/api/errors';
import { explorerTxUrl, isContractConfigured } from '@/lib/blockchain/config';
import { formatSalary, hashText } from '@/lib/contracts/document';
import type { EmployeeContractDto } from '@/types';

function formatDate(value: string | null): string {
  if (!value) return 'Open-ended';
  return new Date(value).toISOString().slice(0, 10);
}

/** Public PDF link for new contracts; falls back to legacy http/ipfs URIs. */
function documentHref(contract: EmployeeContractDto): string | null {
  if (contract.document.attachment?.uri) return contract.document.attachment.uri;
  if (contract.documentUri.startsWith('http') || contract.documentUri.startsWith('ipfs')) {
    return contract.documentUri;
  }
  return null;
}

/** List + actions for both the admin directory and the employee's own view. */
export function ContractList({
  contracts,
  isAdmin,
}: {
  contracts: EmployeeContractDto[];
  isAdmin: boolean;
}) {
  const { user } = useAuthStore();
  const terminateMutation = useTerminateContract();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [chainRecord, setChainRecord] = useState<OnChainContractRecord | null>(null);
  const [chainLoadingId, setChainLoadingId] = useState<string | null>(null);

  const showOnChainCopy = async (contract: EmployeeContractDto) => {
    setActionError(null);
    if (!isContractConfigured) {
      setActionError('Blockchain is not configured. Set the contract address and RPC URL.');
      return;
    }

    setChainLoadingId(contract.id);
    try {
      setChainRecord(await readContractOnChain(contract.contractId));
    } catch (error) {
      setActionError(extractErrorMessage(error, 'Could not read the contract from the chain.'));
    } finally {
      setChainLoadingId(null);
    }
  };

  const terminate = async (contract: EmployeeContractDto) => {
    setActionError(null);

    setBusyId(contract.id);
    try {
      // The server signs with the HR/employee app wallet and relays the
      // transaction from the system wallet.
      await terminateMutation.mutateAsync({
        contractId: contract.contractId,
        reason,
      });
      setTerminatingId(null);
      setReason('');
    } catch (error) {
      setActionError(extractErrorMessage(error, 'The contract could not be terminated.'));
    } finally {
      setBusyId(null);
    }
  };

  if (contracts.length === 0) {
    return (
      <section className="mt-8 border border-ink bg-paper p-10 text-center">
        <p className="display text-2xl">NO CONTRACTS YET</p>
        <p className="mono mt-3 text-[10px] text-ink-40">
          {isAdmin
            ? 'ISSUE THE FIRST ON-CHAIN CONTRACT FROM THE FORM ABOVE.'
            : 'YOUR EMPLOYER HAS NOT ISSUED A CONTRACT TO YOUR WALLET YET.'}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 space-y-4">
      {actionError && (
        <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[10px] normal-case tracking-normal text-hazard">
          {actionError}
        </p>
      )}

      {contracts.map((contract) => {
        const isBusy = busyId === contract.id;
        const isMine = contract.employee?.email.toLowerCase() === user?.email?.toLowerCase();
        const canEnd =
          (isAdmin && (contract.status === 'pending' || contract.status === 'active')) ||
          (isMine && (contract.status === 'pending' || contract.status === 'active'));
        const txUrl = explorerTxUrl(contract.createdTxHash);
        const chainView = chainRecord?.id === contract.contractId ? chainRecord : null;
        const chainHashMatches = chainView
          ? hashText(chainView.document).toLowerCase() ===
            chainView.documentHash.toLowerCase()
          : false;

        return (
          <article key={contract.id} className="border border-ink bg-paper">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="mono text-[11px] font-bold">{contract.employee?.employeeRef}</span>
                <h3 className="text-lg">{contract.employee?.fullName}</h3>
                <span className="mono text-[9px] text-ink-40">V{contract.version}</span>
                <span className="mono text-[9px] text-ink-40">
                  {contract.jobTitle.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusLabel kind="contract" value={contract.status} />
                <span className="mono text-[9px] text-ink-40">
                  CHAIN {contract.chainId}
                </span>
              </div>
            </header>

            <div className="grid gap-x-6 gap-y-3 px-4 py-4 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mono text-[9px] text-ink-40">TERM</p>
                <p>
                  {formatDate(contract.startDate)} → {formatDate(contract.endDate)}
                </p>
              </div>
              <div>
                <p className="mono text-[9px] text-ink-40">GROSS SALARY</p>
                <p>{formatSalary(contract.salary)}</p>
              </div>
              <div>
                <p className="mono text-[9px] text-ink-40">EMPLOYEE WALLET</p>
                <p className="mono text-[10px] normal-case tracking-normal">
                  {contract.employee?.walletAddress}
                </p>
              </div>
              <div>
                <p className="mono text-[9px] text-ink-40">EMPLOYER WALLET</p>
                <p className="mono text-[10px] normal-case tracking-normal">
                  {contract.employerWallet}
                </p>
              </div>
              <div className="lg:col-span-2">
                <p className="mono text-[9px] text-ink-40">DOCUMENT HASH (KECCAK256)</p>
                <p className="mono break-all text-[10px] normal-case tracking-normal">
                  {contract.documentHash}
                </p>
              </div>
              <div className="lg:col-span-2">
                <p className="mono text-[9px] text-ink-40">ON-CHAIN CONTRACT ID</p>
                <p className="mono break-all text-[10px] normal-case tracking-normal">
                  {contract.contractId}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                {txUrl ? (
                  <a
                    href={txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mono inline-flex items-center gap-1 text-[9px] underline underline-offset-2 hover:text-hazard"
                  >
                    CREATE TX <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="mono text-[9px] text-ink-40">
                    TX {contract.createdTxHash.slice(0, 18)}…
                  </span>
                )}
                {contract.acceptedAt && (
                  <span className="mono inline-flex items-center gap-1 text-[9px] text-ink-80">
                    <ShieldCheck size={11} /> DUAL-SIGNED {formatDate(contract.acceptedAt)}
                  </span>
                )}
                {contract.terminatedAt && (
                  <span className="mono inline-flex items-center gap-1 text-[9px] text-hazard">
                    <TriangleAlert size={11} /> ENDED {formatDate(contract.terminatedAt)}
                  </span>
                )}
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/20 bg-paper-soft px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {documentHref(contract) && (
                  <a
                    href={documentHref(contract) ?? undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="mono inline-flex h-8 items-center gap-1 border-2 border-ink px-3 text-[9px] uppercase transition-colors hover:bg-ink hover:text-paper"
                  >
                    <FileText size={12} /> View PDF <ExternalLink size={10} />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[9px]"
                  disabled={chainLoadingId === contract.id}
                  onClick={() => void showOnChainCopy(contract)}
                >
                  {chainLoadingId === contract.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <ShieldCheck size={12} />
                  )}
                  On-chain copy
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canEnd && (
                  <Button
                    variant={isAdmin ? 'ghost' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-[9px]"
                    disabled={isBusy || terminatingId === contract.id}
                    onClick={() => {
                      setReason('');
                      setTerminatingId(terminatingId === contract.id ? null : contract.id);
                    }}
                  >
                    {isAdmin ? 'Terminate' : 'Resign'}
                  </Button>
                )}
              </div>
            </footer>

            {chainView && (
              <div className="border-t border-ink/20 bg-paper-soft px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="mono text-[9px] text-ink-40">
                    READ DIRECTLY FROM CONTRACT STORAGE · NO DATABASE USED
                  </p>
                  <span
                    className={`mono text-[9px] ${
                      chainHashMatches ? 'text-ink-80' : 'text-hazard'
                    }`}
                  >
                    {chainHashMatches ? 'HASH MATCH' : 'HASH MISMATCH'}
                  </span>
                </div>
                <pre className="mono mt-3 max-h-72 overflow-auto border border-ink/20 bg-paper p-3 text-[9px] normal-case leading-relaxed tracking-normal">
                  {chainView.document}
                </pre>
                <p className="mono mt-2 break-all text-[8px] text-ink-40">
                  EMPLOYER SIG {chainView.employerSignature.slice(0, 26)}… · EMPLOYEE SIG{' '}
                  {chainView.employeeSignature.slice(0, 26)}…
                </p>
                {chainView.nft && (
                  <div className="mt-3 grid gap-2 border-t border-ink/20 pt-3 md:grid-cols-3">
                    <div>
                      <p className="mono text-[9px] text-ink-40">NFT TOKEN</p>
                      <p className="mono break-all text-[10px] normal-case tracking-normal">
                        #{chainView.nft.tokenId}
                      </p>
                    </div>
                    <div>
                      <p className="mono text-[9px] text-ink-40">NFT OWNER (EMPLOYER)</p>
                      <p className="mono break-all text-[10px] normal-case tracking-normal">
                        {chainView.nft.employer}
                      </p>
                    </div>
                    <div>
                      <p className="mono text-[9px] text-ink-40">NFT CO-OWNER (EMPLOYEE)</p>
                      <p className="mono break-all text-[10px] normal-case tracking-normal">
                        {chainView.nft.employee}
                      </p>
                    </div>
                  </div>
                )}
                {chainView.nft && (
                  <p className="mono mt-2 break-all text-[8px] text-ink-40">
                    TOKEN URI {chainView.nft.tokenUri}
                  </p>
                )}
              </div>
            )}

            {terminatingId === contract.id && (
              <div className="flex flex-wrap items-end gap-3 border-t border-ink/20 px-4 py-3">
                <div className="min-w-[220px] flex-1">
                  <Label htmlFor={`reason-${contract.id}`}>
                    {isAdmin ? 'TERMINATION REASON (OPTIONAL)' : 'RESIGNATION NOTE (OPTIONAL)'}
                  </Label>
                  <Input
                    id={`reason-${contract.id}`}
                    className="h-9"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="End of mission, mutual agreement…"
                  />
                  <p className="mono mt-1 text-[9px] normal-case tracking-normal text-ink-40">
                    Only keccak256(reason) is stored on-chain. Your app wallet signs server-side
                    and the system wallet pays the gas.
                  </p>
                </div>
                <Button
                  variant="hazard"
                  size="sm"
                  className="h-9 px-4 text-[9px]"
                  disabled={isBusy}
                  onClick={() => void terminate(contract)}
                >
                  {isBusy ? <Loader2 size={12} className="animate-spin" /> : null}
                  Sign {isAdmin ? 'termination' : 'resignation'} · app wallet
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-4 text-[9px]"
                  onClick={() => setTerminatingId(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
