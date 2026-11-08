'use client';

import { useAuthStore } from '@/hooks/stores/auth-store';
import { useContractProposals, useContracts } from '@/hooks/content/hr';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import { WalletPanel } from './wallet-panel';
import { CreateContractForm } from './create-contract-form';
import { ContractProposalList } from './contract-proposal-list';
import { ContractList } from './contract-list';
import { extractErrorMessage } from '@/lib/api/errors';

/**
 * Contracts workspace.
 *  - ADMIN builds a contract and co-signs it.
 *  - The employee reviews the exact JSON and signs it (no gas, no funds).
 *  - The server publishes it on-chain from a system wallet that pays the gas.
 */
export function ContractsView() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const contractsQuery = useContracts();
  const proposalsQuery = useContractProposals();
  const contracts = contractsQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">CONTRACTS.</h1>
          <p className="mono mt-3 text-[10px] text-ink-40">
            {isAdmin
              ? 'DUAL-SIGNED AGREEMENTS · FULL DOCUMENT STORED ON-CHAIN · META_MASK'
              : 'YOUR AGREEMENTS · SIGN WITH YOUR WALLET · IT NEVER COSTS YOU GAS'}
          </p>
        </div>
        <div className="mono text-right text-[9px] text-ink-40">
          <p>SMART CONTRACT · EMPLOYMENTCONTRACTREGISTRY</p>
          <p>HR SIGNATURE + EMPLOYEE SIGNATURE REQUIRED</p>
        </div>
      </header>

      <WalletPanel />

      {isAdmin && <CreateContractForm />}

      {proposalsQuery.isLoading && (
        <div className="mt-8">
          <LoadingBlock label="Loading proposals" />
        </div>
      )}

      {proposalsQuery.isError && (
        <div className="mono mt-8 border border-hazard px-4 py-4 text-[10px] text-hazard">
          {extractErrorMessage(proposalsQuery.error, 'FAILED TO LOAD PROPOSALS').toUpperCase()}
          <button
            type="button"
            onClick={() => void proposalsQuery.refetch()}
            className="ml-3 underline underline-offset-2"
          >
            RETRY
          </button>
        </div>
      )}

      {!proposalsQuery.isLoading && !proposalsQuery.isError && (
        <ContractProposalList proposals={proposals} isAdmin={isAdmin} />
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 className="display text-2xl">
            {isAdmin ? 'ORGANISATION CONTRACTS' : 'MY CONTRACTS'}
          </h2>
          <p className="mono text-[9px] text-ink-40">
            {contracts.length} RECORD{contracts.length === 1 ? '' : 'S'}
          </p>
        </div>

        {contractsQuery.isLoading && (
          <div className="mt-6">
            <LoadingBlock label="Loading contracts" />
          </div>
        )}

        {contractsQuery.isError && (
          <div className="mono mt-6 border border-hazard px-4 py-4 text-[10px] text-hazard">
            {extractErrorMessage(contractsQuery.error, 'FAILED TO LOAD CONTRACTS').toUpperCase()}
            <button
              type="button"
              onClick={() => void contractsQuery.refetch()}
              className="ml-3 underline underline-offset-2"
            >
              RETRY
            </button>
          </div>
        )}

        {!contractsQuery.isLoading && !contractsQuery.isError && (
          <ContractList contracts={contracts} isAdmin={isAdmin} />
        )}
      </section>

      <section className="mt-10 border border-ink/30 bg-paper-soft px-4 py-3">
        <p className="mono text-[9px] leading-relaxed text-ink-40">
          BOTH THE HR WALLET AND THE EMPLOYEE WALLET SIGN THE SAME EIP-712 INTENT. THE CONTRACT IS
          ONLY WRITTEN TO A BLOCK WHEN BOTH SIGNATURES ARE VALID. THE FULL CANONICAL JSON IS PART OF
          THE TRANSACTION AND IS STORED IN CONTRACT STORAGE, SO IT CAN BE RECOVERED FROM THE CHAIN
          EVEN IF MONGODB IS LOST. SIGNING COSTS NOTHING FOR THE EMPLOYEE: HR SUBMITS THE ANCHOR
          TRANSACTION AND PAYS THE GAS. THE TRADE-OFF: NAMES, EMAILS AND SALARY ARE PUBLIC ON A
          PUBLIC NETWORK.
        </p>
      </section>
    </main>
  );
}
