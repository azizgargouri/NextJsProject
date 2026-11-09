'use client';

import Link from 'next/link';
import { useMoverEarnings } from '@/hooks/content/mover';
import {
  EmptyState,
  ErrorState,
  formatDateTime,
  formatMoney,
  LoadingState,
  PageTitle,
  Panel,
  Tag,
} from './mover-ui';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper p-4">
      <dt className="text-sm text-ink-80">{label}</dt>
      <dd className="mt-1 text-xl font-bold md:text-2xl">{value}</dd>
    </div>
  );
}

/** Item 10: earnings, commission deducted and payout history (M-09). */
export function EarningsPortal() {
  const earnings = useMoverEarnings();
  if (earnings.isPending) return <LoadingState label="Loading earnings" />;
  if (earnings.isError) {
    return <ErrorState error={earnings.error} onRetry={() => void earnings.refetch()} />;
  }
  const { summary, earnings: rows, payouts } = earnings.data;

  return (
    <>
      <PageTitle
        title="Earnings"
        description="Money is added when the client confirms a job, or 48 hours after delivery."
      />
      <dl className="grid grid-cols-2 gap-px border border-ink bg-ink lg:grid-cols-4">
        <Stat label="Net earned" value={formatMoney(summary.net)} />
        <Stat label="Commission deducted" value={formatMoney(summary.commission)} />
        <Stat label="Waiting for payout" value={formatMoney(summary.pending)} />
        <Stat label="Paid out" value={formatMoney(summary.paidOut)} />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Completed jobs">
          {rows.length === 0 ? (
            <EmptyState title="No earnings yet" body="Completed jobs will be listed here." />
          ) : (
            <ul className="divide-y divide-ink/20">
              {rows.map((row) => (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/mover/jobs/${row.moveId}`}
                      className="mono text-[11px] font-bold underline underline-offset-2"
                    >
                      {row.reference}
                    </Link>
                    <Tag tone={row.status === 'PAID' ? 'solid' : 'neutral'}>
                      {row.status === 'PAID' ? 'Paid' : 'Waiting for payout'}
                    </Tag>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-ink-80">Price</dt>
                      <dd>{formatMoney(row.gross, row.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-80">
                        Commission ({Math.round(row.commissionRate * 1000) / 10}%)
                      </dt>
                      <dd>-{formatMoney(row.commission, row.currency)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-80">You get</dt>
                      <dd className="font-bold">{formatMoney(row.net, row.currency)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Payout history" className="self-start">
          {payouts.length === 0 ? (
            <EmptyState title="No payouts yet" />
          ) : (
            <ul className="divide-y divide-ink/20">
              {payouts.map((payout) => (
                <li
                  key={payout.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="font-bold">{formatMoney(payout.amount, payout.currency)}</p>
                    <p className="text-ink-80">{payout.reference || payout.method}</p>
                  </div>
                  <span className="text-ink-80">{formatDateTime(payout.paidAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
