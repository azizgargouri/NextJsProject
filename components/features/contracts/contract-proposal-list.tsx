'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, FileJson, Loader2, PenLine, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusLabel } from '@/components/ui/status-chip';
import { useAnchorContractProposal, useSignContractProposal } from '@/hooks/content/hr';
import { useWallet } from '@/components/features/web3/wallet-provider';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { signContractAsEmployee } from '@/lib/blockchain/registry';
import { describeWalletError } from '@/lib/blockchain/errors';
import { shortAddress } from '@/lib/blockchain/config';
import { formatSalary, stableStringify } from '@/lib/contracts/document';
import type { ContractProposalDto } from '@/types';

function formatDate(value: string | null): string {
  if (!value) return 'Open-ended';
  return new Date(value).toISOString().slice(0, 10);
}

function formatDeadline(value: number): string {
  return new Date(value * 1000).toISOString().replace('T', ' ').slice(0, 16);
}

function downloadDocument(proposal: ContractProposalDto) {
  const blob = new Blob([stableStringify(proposal.document)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `proposal-${proposal.employee?.employeeRef ?? 'employee'}-v${proposal.version}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Contracts that are not on-chain yet. The employee co-signs for free (a
 * signature, no gas); the backend system wallet then sends the anchor
 * transaction and pays for it, so no app user ever spends anything.
 */
export function ContractProposalList({
  proposals,
  isAdmin,
}: {
  proposals: ContractProposalDto[];
  isAdmin: boolean;
}) {
  const { address, isConnected, isCorrectNetwork } = useWallet();
  const { user } = useAuthStore();
  const publish = useAnchorContractProposal();
  const signProposal = useSignContractProposal();
  const queryClient = useQueryClient();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const ready = isConnected && isCorrectNetwork;

  /** Employee step: free EIP-712 signature. No transaction, no gas. */
  const sign = async (proposal: ContractProposalDto) => {
    setActionError(null);

    if (!ready || !address) {
      setActionError('Connect MetaMask on the correct network first.');
      return;
    }
    if (proposal.status !== 'awaiting_employee') {
      setActionError('This proposal has expired. Ask HR to issue a new one.');
      return;
    }
    if (proposal.employee?.walletAddress.toLowerCase() !== address.toLowerCase()) {
      setActionError(
        `Switch MetaMask to ${shortAddress(proposal.employee?.walletAddress)} — the employee wallet that must sign.`,
      );
      return;
    }

    setBusyId(proposal.id);
    try {
      const { signature } = await signContractAsEmployee(proposal.typedData);
      await signProposal.mutateAsync({ proposalId: proposal.id, signature });
      await queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] });
    } catch (error) {
      setActionError(describeWalletError(error));
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Admin step: asks the server to publish the proposal. The backend system
   * wallet sends the transaction and pays the gas, so no wallet is needed here.
   */
  const anchor = async (proposal: ContractProposalDto) => {
    setActionError(null);

    if (proposal.status !== 'awaiting_employee') {
      setActionError('This proposal has expired. Ask HR to issue a new one.');
      return;
    }
    if (!proposal.employeeSignature) {
      setActionError('The employee has not signed this proposal yet.');
      return;
    }

    setBusyId(proposal.id);
    try {
      await publish.mutateAsync({ proposalId: proposal.id });

      await queryClient.invalidateQueries({ queryKey: ['contracts', 'proposals'] });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Could not publish the contract on-chain.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (proposals.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-2">
        <h2 className="display text-2xl">PENDING ON-CHAIN CONTRACTS</h2>
        <p className="mono text-[9px] text-ink-40">
          {proposals.length} PROPOSAL{proposals.length === 1 ? '' : 'S'} · NOT ON-CHAIN YET
        </p>
      </div>

      {actionError && (
        <p className="mono mt-4 border border-hazard bg-hazard/5 px-3 py-2 text-[10px] normal-case tracking-normal text-hazard">
          {actionError}
        </p>
      )}

      <div className="mt-4 space-y-4">
        {proposals.map((proposal) => {
          const isBusy = busyId === proposal.id;
          const isMine =
            proposal.employee?.email.toLowerCase() === user?.email?.toLowerCase();
          const canSign =
            !isAdmin &&
            isMine &&
            proposal.status === 'awaiting_employee' &&
            !proposal.employeeSignature;
          const canAnchor =
            isAdmin &&
            proposal.status === 'awaiting_employee' &&
            Boolean(proposal.employeeSignature);

          return (
            <article key={proposal.id} className="border border-ink bg-paper">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="mono text-[11px] font-bold">
                    {proposal.employee?.employeeRef}
                  </span>
                  <h3 className="text-lg">{proposal.employee?.fullName}</h3>
                  <span className="mono text-[9px] text-ink-40">V{proposal.version}</span>
                  <span className="mono text-[9px] text-ink-40">
                    {proposal.jobTitle.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusLabel kind="proposal" value={proposal.status} />
                  <span className="mono text-[9px] text-ink-40">CHAIN {proposal.chainId}</span>
                </div>
              </header>

              <div className="grid gap-x-6 gap-y-3 px-4 py-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="mono text-[9px] text-ink-40">TERM</p>
                  <p>
                    {formatDate(proposal.startDate)} → {formatDate(proposal.endDate)}
                  </p>
                </div>
                <div>
                  <p className="mono text-[9px] text-ink-40">GROSS SALARY</p>
                  <p>{formatSalary(proposal.salary)}</p>
                </div>
                <div>
                  <p className="mono text-[9px] text-ink-40">SIGNING DEADLINE</p>
                  <p className="mono text-[10px] normal-case tracking-normal">
                    {formatDeadline(proposal.deadline)}
                  </p>
                </div>
                <div>
                  <p className="mono text-[9px] text-ink-40">EMPLOYEE WALLET</p>
                  <p className="mono text-[10px] normal-case tracking-normal">
                    {proposal.employee?.walletAddress}
                  </p>
                </div>
                <div>
                  <p className="mono text-[9px] text-ink-40">EMPLOYER WALLET</p>
                  <p className="mono text-[10px] normal-case tracking-normal">
                    {proposal.employerWallet}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="mono text-[9px] text-ink-40">HR SIGNATURE</p>
                  <span className="mono inline-flex items-center gap-1 text-[9px] text-ink-80">
                    <ShieldCheck size={11} /> COLLECTED
                  </span>
                </div>
                <div className="lg:col-span-2">
                  <p className="mono text-[9px] text-ink-40">DOCUMENT HASH (KECCAK256)</p>
                  <p className="mono break-all text-[10px] normal-case tracking-normal">
                    {proposal.documentHash}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="mono text-[9px] text-ink-40">EMPLOYEE SIGNATURE</p>
                  {proposal.employeeSignature ? (
                    <span className="mono inline-flex items-center gap-1 text-[9px] text-ink-80">
                      <ShieldCheck size={11} /> SIGNED
                    </span>
                  ) : (
                    <span className="mono inline-flex items-center gap-1 text-[9px] text-ink-40">
                      <Clock size={11} /> PENDING
                    </span>
                  )}
                </div>
              </div>

              <details className="border-t border-ink/20 px-4 py-3">
                <summary className="mono cursor-pointer text-[9px] text-ink-40">
                  REVIEW THE EXACT DOCUMENT THAT WILL BE STORED IN THE BLOCK
                </summary>
                <pre className="mono mt-3 max-h-72 overflow-auto border border-ink/20 bg-paper-soft p-3 text-[9px] normal-case leading-relaxed tracking-normal">
                  {stableStringify(proposal.document)}
                </pre>
              </details>

              <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/20 bg-paper-soft px-4 py-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[9px]"
                  onClick={() => downloadDocument(proposal)}
                >
                  <FileJson size={12} /> Download JSON
                </Button>

                {canSign ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 px-3 text-[9px]"
                    disabled={isBusy}
                    onClick={() => void sign(proposal)}
                  >
                    {isBusy ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                    Sign with wallet · no gas
                  </Button>
                ) : canAnchor ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8 px-3 text-[9px]"
                    disabled={isBusy}
                    onClick={() => void anchor(proposal)}
                  >
                    {isBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} />
                    )}
                    Publish on-chain · no gas for you
                  </Button>
                ) : (
                  <span className="mono text-[9px] text-ink-40">
                    {proposal.status === 'expired'
                      ? 'EXPIRED · HR MUST ISSUE A NEW PROPOSAL'
                      : isAdmin
                        ? proposal.employeeSignature
                          ? 'PUBLISH ON-CHAIN · SYSTEM WALLET PAYS THE GAS'
                          : 'WAITING FOR THE EMPLOYEE TO SIGN'
                        : isMine
                          ? proposal.employeeSignature
                            ? 'SIGNED · WAITING FOR THE ADMIN TO PUBLISH IT'
                            : 'CONNECT THE EMPLOYEE WALLET TO SIGN'
                          : 'WAITING FOR THE EMPLOYEE TO SIGN'}
                  </span>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
