'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AxiosError } from 'axios';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoverActionError } from '@/lib/actions/mover-action';
import { Input, type InputProps } from '@/components/ui/input';
import type { MoveStatus, OfferDto, ProgressStage, ServerErrorResponse, TimeSlot } from '@/types';

/** Shared pieces for the mover workspace, in the public Swiss print language. */

export const SLOT_LABELS: Record<TimeSlot, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  FULL_DAY: 'Full day',
};

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.') {
  if (error instanceof MoverActionError) return error.message;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You are offline, and this has not been saved on this device yet.';
  }
  // A failed Server Action call never reached the server.
  if (error instanceof TypeError) return 'No connection. Check your network and try again.';
  if (error instanceof AxiosError) {
    const body = error.response?.data as ServerErrorResponse | undefined;
    if (body?.message) return body.message;
    if (!error.response) return 'No connection. Check your network and try again.';
  }
  return fallback;
}

export function formatMoney(amount: number, currency = 'TND'): string {
  const value = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(amount);
  return `${value} ${currency}`;
}

/** Formats a YYYY-MM-DD day without letting the viewer's time zone shift it. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Tunis',
  }).format(new Date(iso));
}

export function jobStatusLabel(status: MoveStatus, stage: ProgressStage | null = null): string {
  if (status === 'IN_PROGRESS') return stage === 'IN_TRANSIT' ? 'In transit' : 'Loading';
  const labels: Partial<Record<MoveStatus, string>> = {
    QUOTING: 'Open',
    ASSIGNED: 'Assigned',
    EN_ROUTE: 'On the way',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
    DISPUTED: 'Disputed',
    CANCELLED: 'Cancelled',
    REFUNDED: 'Refunded',
  };
  return labels[status] ?? status;
}

/**
 * The shared Input uses `.mono`, whose uppercase transform outranks its own
 * `normal-case` utility. Movers type names and messages here, so show them as typed.
 */
export function TextInput({ className, ...props }: InputProps) {
  return <Input className={cn('normal-case! tracking-normal!', className)} {...props} />;
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <header className="mb-6 md:mb-8">
      <h1 className="display text-4xl md:text-5xl">{title}</h1>
      {description ? <p className="mt-3 max-w-2xl text-sm text-ink-80">{description}</p> : null}
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('border border-ink bg-paper', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-ink px-4 py-3">
          <h2 className="mono text-[11px] font-bold">{title}</h2>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Tag({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'solid' | 'alert';
}) {
  return (
    <span
      className={cn(
        'mono inline-flex items-center whitespace-nowrap border px-2 py-1 text-[10px] leading-none',
        tone === 'neutral' && 'border-ink text-ink',
        tone === 'solid' && 'border-ink bg-ink text-paper',
        tone === 'alert' && 'border-hazard-dark text-hazard-dark',
      )}
    >
      {children}
    </span>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <p role="status" className="mono py-12 text-center text-[11px] text-ink-80">
      {label}…
    </p>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-2 py-8 text-center">
      <p className="font-bold">{title}</p>
      {body ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-80">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="border border-hazard-dark p-4 text-center">
      <p className="text-sm text-hazard-dark">{apiErrorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 border border-hazard-dark p-3 text-sm text-ink">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-hazard-dark" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

function remainingLabel(ms: number): string {
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
    : `${pad(minutes)}m ${pad(seconds)}s`;
}

const URGENT_MS = 15 * 60 * 1000;

/** Live count to the offer deadline. The server enforces it; this only displays it. */
export function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire?: () => void }) {
  const deadline = new Date(expiresAt).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = now === null ? null : deadline - now;
  const expired = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (expired) onExpire?.();
    // Fires once when the deadline passes; the callback identity does not matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        'mono inline-block min-w-24 text-right text-[12px] font-bold tabular-nums',
        (expired || (remaining !== null && remaining < URGENT_MS)) && 'text-hazard-dark',
      )}
    >
      {remaining === null ? '—' : expired ? 'Expired' : remainingLabel(remaining)}
    </span>
  );
}

export function OfferCard({ offer, onExpire }: { offer: OfferDto; onExpire?: () => void }) {
  const { move } = offer;
  return (
    <Link
      href={`/mover/offers/${offer.id}`}
      className="block border border-ink bg-paper p-4 transition-colors hover:bg-paper-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hazard"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-[10px] text-ink-80">{move.reference}</p>
        {offer.status === 'PENDING' ? (
          <Countdown expiresAt={offer.expiresAt} onExpire={onExpire} />
        ) : (
          <Tag>Waiting for client</Tag>
        )}
      </div>
      <p className="mt-2 text-lg font-bold">
        {move.pickup.city} to {move.dropoff.city}
      </p>
      <p className="mt-1 text-sm text-ink-80">
        {formatDay(move.moveDate)}, {SLOT_LABELS[move.timeSlot].toLowerCase()}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>{move.volumeM3} m³</span>
        {offer.quote ? (
          <span className="font-bold">Your quote: {formatMoney(offer.quote.amount)}</span>
        ) : move.estimatedPrice !== null ? (
          <span className="font-bold">{formatMoney(move.estimatedPrice)}</span>
        ) : (
          <span className="font-bold">Quote needed</span>
        )}
      </div>
    </Link>
  );
}

export function JobRow({
  job,
}: {
  job: {
    id: string;
    reference: string;
    moveDate: string;
    timeSlot: TimeSlot;
    status: MoveStatus;
    progressStage: ProgressStage | null;
    pickupCity: string;
    dropoffCity: string;
  };
}) {
  return (
    <Link
      href={`/mover/jobs/${job.id}`}
      className="block border border-ink bg-paper p-4 transition-colors hover:bg-paper-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hazard"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="mono text-[10px] text-ink-80">{job.reference}</p>
        <Tag tone="solid">{jobStatusLabel(job.status, job.progressStage)}</Tag>
      </div>
      <p className="mt-2 text-lg font-bold">
        {job.pickupCity} to {job.dropoffCity}
      </p>
      <p className="mt-1 text-sm text-ink-80">
        {formatDay(job.moveDate)}, {SLOT_LABELS[job.timeSlot].toLowerCase()}
      </p>
    </Link>
  );
}
