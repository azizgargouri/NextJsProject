'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { useMoverDashboard } from '@/hooks/content/mover';
import {
  EmptyState,
  ErrorState,
  formatMoney,
  JobRow,
  LoadingState,
  Notice,
  OfferCard,
  PageTitle,
  Panel,
} from './mover-ui';

/** Item 3: new offers, upcoming jobs and a short earnings summary. */
export function MoverHome() {
  const dashboard = useMoverDashboard();

  if (dashboard.isPending) return <LoadingState label="Loading your dashboard" />;
  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => void dashboard.refetch()} />;
  }
  const { eligibility, expiringDocuments, offerCount, offers, upcomingJobs, earnings } =
    dashboard.data;

  return (
    <>
      <PageTitle title="Dashboard" />

      <div className="mb-6 flex flex-col gap-3 empty:hidden">
        {eligibility.blockers.map((blocker) => (
          <Notice key={blocker}>
            {blocker}{' '}
            <Link href="/mover/profile" className="font-bold underline underline-offset-2">
              Open profile
            </Link>
          </Notice>
        ))}
        {expiringDocuments.map((document) => (
          <Notice key={document.id}>
            Your {document.type.toLowerCase()} document expires in {document.daysLeft}{' '}
            {document.daysLeft === 1 ? 'day' : 'days'}. Upload a new one to keep receiving offers.{' '}
            <Link href="/mover/profile" className="font-bold underline underline-offset-2">
              Update it
            </Link>
          </Notice>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel
            title={`New offers (${offerCount})`}
            action={
              offerCount > offers.length ? (
                <Link href="/mover/offers" className="text-sm underline underline-offset-2">
                  See all
                </Link>
              ) : null
            }
          >
            {offers.length === 0 ? (
              <EmptyState
                title="No open offers"
                body="Offers appear here when a job matches your zones and availability."
                action={
                  <Link
                    href="/mover/availability"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Check my availability
                  </Link>
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                {offers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onExpire={() => void dashboard.refetch()}
                  />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Upcoming jobs">
            {upcomingJobs.length === 0 ? (
              <EmptyState title="No upcoming jobs" body="Jobs you win will be listed here." />
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingJobs.map((job) => (
                  <JobRow key={job.id} job={job} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Earnings"
          action={
            <Link href="/mover/earnings" className="text-sm underline underline-offset-2">
              Details
            </Link>
          }
          className="self-start"
        >
          <p className="text-sm text-ink-80">Net earned</p>
          <p className="display mt-1 text-4xl normal-case">{formatMoney(earnings.net)}</p>
          <dl className="mt-4 grid grid-cols-[1fr_auto] gap-y-2 border-t border-ink pt-4 text-sm">
            <dt className="text-ink-80">Waiting for payout</dt>
            <dd className="font-bold">{formatMoney(earnings.pending)}</dd>
            <dt className="text-ink-80">Completed jobs</dt>
            <dd className="font-bold">{earnings.completedJobs}</dd>
          </dl>
        </Panel>
      </div>
    </>
  );
}
