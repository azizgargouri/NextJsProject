import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  CLAIM_STATUS_LABELS,
  REVIEW_STATUS_LABELS,
  type ClaimStatus,
  type ReviewStatus,
} from '@/lib/quality/constants';

/** Server-safe presentational blocks (no hooks) — usable from Server and Client Components. */

export function PageTitle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-ink pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="mono text-[10px] text-hazard">{kicker}</p>
        <h1 className="display mt-2 text-4xl md:text-6xl">{title}</h1>
      </div>
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </header>
  );
}

const CLAIM_STAMP: Record<ClaimStatus, string> = {
  OPEN: 'border-hazard text-hazard',
  UNDER_REVIEW: 'border-ink text-ink',
  RESOLVED: 'border-ink bg-ink text-paper',
  REJECTED: 'border-ink-40 text-ink-40',
};

export function ClaimStamp({ status }: { status: ClaimStatus }) {
  return (
    <span className={cn('mono inline-block border px-2 py-1 text-[10px]', CLAIM_STAMP[status])}>
      {CLAIM_STATUS_LABELS[status]}
    </span>
  );
}

const REVIEW_STAMP: Record<ReviewStatus, string> = {
  PUBLISHED: 'border-ink bg-ink text-paper',
  FLAGGED: 'border-hazard text-hazard',
  HIDDEN: 'border-ink-40 text-ink-40',
};

export function ReviewStamp({ status }: { status: ReviewStatus }) {
  return (
    <span className={cn('mono inline-block border px-2 py-1 text-[10px]', REVIEW_STAMP[status])}>
      {status === 'FLAGGED' ? 'Pending check' : REVIEW_STATUS_LABELS[status]}
    </span>
  );
}

export function EmptyBlock({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-ink px-6 py-12 text-center">
      <p className="display text-2xl">{title}</p>
      {children ? (
        <div className="mono mt-3 text-[11px] normal-case tracking-normal text-ink-80">
          {children}
        </div>
      ) : null}
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
