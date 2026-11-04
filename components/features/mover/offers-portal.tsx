'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FieldError, Label } from '@/components/ui/field';
import { useMoverOffer, useMoverOffers, useRespondToOffer } from '@/hooks/content/mover';
import type { MoveAreaDto, OfferDto, OfferResponsePayload } from '@/types';
import {
  apiErrorMessage,
  Countdown,
  EmptyState,
  ErrorState,
  formatDay,
  formatMoney,
  LoadingState,
  Notice,
  OfferCard,
  PageTitle,
  Panel,
  SLOT_LABELS,
  Tag,
  TextInput,
} from './mover-ui';

/** Item 5: offers matching the mover's zones and availability. */
export function OffersPortal() {
  const offers = useMoverOffers();

  if (offers.isPending) return <LoadingState label="Loading offers" />;
  if (offers.isError)
    return <ErrorState error={offers.error} onRetry={() => void offers.refetch()} />;
  const { eligibility, offers: open, quoted } = offers.data;

  return (
    <>
      <PageTitle
        title="Offers"
        description="Answer before the timer runs out, or the job goes to the next mover."
      />
      {eligibility.blockers.length > 0 ? (
        <div className="mb-6 flex flex-col gap-3">
          {eligibility.blockers.map((blocker) => (
            <Notice key={blocker}>
              {blocker}{' '}
              <Link href="/mover/profile" className="font-bold underline underline-offset-2">
                Open profile
              </Link>
            </Notice>
          ))}
        </div>
      ) : null}

      {open.length === 0 ? (
        <Panel>
          <EmptyState
            title="No open offers"
            body="Offers appear here when a job matches your zones and availability."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.map((offer) => (
            <OfferCard key={offer.id} offer={offer} onExpire={() => void offers.refetch()} />
          ))}
        </div>
      )}

      {quoted.length > 0 ? (
        <section className="mt-8">
          <h2 className="mono mb-3 text-[11px] font-bold">Quotes sent</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {quoted.map((offer) => (
              <OfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function floorLabel(area: MoveAreaDto): string {
  const floor = area.floor === 0 ? 'Ground floor' : `Floor ${area.floor}`;
  return `${floor}, ${area.hasElevator ? 'elevator' : 'no elevator'}`;
}

function AreaBlock({ label, area }: { label: string; area: MoveAreaDto }) {
  return (
    <div>
      <p className="mono text-[10px] text-ink-80">{label}</p>
      <p className="mt-1 font-bold">{area.city}</p>
      <p className="text-sm text-ink-80">{floorLabel(area)}</p>
    </div>
  );
}

const CLOSED_LABELS: Partial<Record<OfferDto['status'], string>> = {
  ACCEPTED: 'You accepted this job',
  DECLINED: 'You declined this offer',
  QUOTED: 'Quote sent, waiting for the client',
  EXPIRED: 'This offer expired and went to the next mover',
  WITHDRAWN: 'This job went to another mover',
};

type Mode = 'idle' | 'quote' | 'decline';

function OfferActions({ offer, onExpired }: { offer: OfferDto; onExpired: () => void }) {
  const router = useRouter();
  const respond = useRespondToOffer(offer.id);
  const [mode, setMode] = useState<Mode>('idle');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('');
  const [amountError, setAmountError] = useState<string>();
  const [formError, setFormError] = useState<string>();

  /**
   * Uses mutateAsync: the refreshed offer closes and removes these buttons, and
   * React Query drops mutate() callbacks once the component has unmounted.
   */
  const send = async (
    payload: OfferResponsePayload,
    done: (result: { jobId: string | null }) => void,
  ) => {
    setFormError(undefined);
    try {
      done(await respond.mutateAsync(payload));
    } catch (error) {
      setFormError(apiErrorMessage(error));
      onExpired();
    }
  };

  const accept = () =>
    void send({ action: 'ACCEPT' }, ({ jobId }) => {
      toast.success('Job accepted');
      router.push(jobId ? `/mover/jobs/${jobId}` : '/mover/jobs');
    });

  const submitQuote = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setAmountError('Enter an amount above zero');
      return;
    }
    setAmountError(undefined);
    void send({ action: 'QUOTE', amount: value, message: message.trim() || undefined }, () => {
      toast.success('Quote sent to the client');
      router.push('/mover/offers');
    });
  };

  const submitDecline = (event: FormEvent) => {
    event.preventDefault();
    void send({ action: 'DECLINE', reason: reason.trim() || undefined }, () => {
      toast.success('Offer declined');
      router.push('/mover/offers');
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {formError ? (
        <p role="alert" className="text-sm text-hazard-dark">
          {formError}
        </p>
      ) : null}

      {mode === 'idle' ? (
        <>
          {offer.canAccept && offer.move.estimatedPrice !== null ? (
            <Button size="lg" className="w-full" disabled={respond.isPending} onClick={accept}>
              {respond.isPending
                ? 'Sending…'
                : `Accept for ${formatMoney(offer.move.estimatedPrice)}`}
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={offer.canAccept ? 'outline' : 'primary'}
            className="w-full"
            onClick={() => setMode('quote')}
          >
            Send a quote
          </Button>
          <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode('decline')}>
            Decline
          </Button>
        </>
      ) : null}

      {mode === 'quote' ? (
        <form onSubmit={submitQuote} className="flex flex-col gap-3" noValidate>
          <div>
            <Label htmlFor="quote-amount">Your price (TND)</Label>
            <TextInput
              id="quote-amount"
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={amount}
              aria-invalid={Boolean(amountError)}
              onChange={(event) => setAmount(event.target.value)}
            />
            <FieldError message={amountError} />
          </div>
          <div>
            <Label htmlFor="quote-message">Message for the client (optional)</Label>
            <TextInput
              id="quote-message"
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>
          <Button size="lg" type="submit" disabled={respond.isPending}>
            {respond.isPending ? 'Sending…' : 'Send quote'}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setMode('idle')}>
            Back
          </Button>
        </form>
      ) : null}

      {mode === 'decline' ? (
        <form onSubmit={submitDecline} className="flex flex-col gap-3">
          <p className="text-sm text-ink-80">
            This job goes to the next mover. You will not be offered it again.
          </p>
          <div>
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <TextInput
              id="decline-reason"
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <Button size="lg" type="submit" disabled={respond.isPending}>
            {respond.isPending ? 'Sending…' : 'Decline this offer'}
          </Button>
          <Button variant="ghost" type="button" onClick={() => setMode('idle')}>
            Back
          </Button>
        </form>
      ) : null}
    </div>
  );
}

/** Items 5 and 6: the detail view. Address and phone stay hidden until assignment. */
export function OfferDetail({ id }: { id: string }) {
  const offer = useMoverOffer(id);

  if (offer.isPending) return <LoadingState label="Loading offer" />;
  if (offer.isError) return <ErrorState error={offer.error} onRetry={() => void offer.refetch()} />;
  const data = offer.data;
  const { move } = data;
  const isOpen = data.status === 'PENDING';

  return (
    <>
      <Link
        href="/mover/offers"
        className="mb-4 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> All offers
      </Link>
      <p className="mono text-[10px] text-ink-80">{move.reference}</p>
      <h1 className="display mt-2 text-3xl md:text-4xl">
        {move.pickup.city} to {move.dropoff.city}
      </h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Panel title="The job">
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-ink-80">Date</dt>
                <dd className="font-bold">{formatDay(move.moveDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-80">Time</dt>
                <dd className="font-bold">{SLOT_LABELS[move.timeSlot]}</dd>
              </div>
              <div>
                <dt className="text-ink-80">Volume</dt>
                <dd className="font-bold">{move.volumeM3} m³</dd>
              </div>
              <div>
                <dt className="text-ink-80">Home</dt>
                <dd className="font-bold">
                  {move.housingType || 'Not given'}
                  {move.sizeRooms ? `, ${move.sizeRooms} rooms` : ''}
                </dd>
              </div>
            </dl>
            <div className="mt-5 grid gap-4 border-t border-ink pt-4 sm:grid-cols-2">
              <AreaBlock label="Pickup" area={move.pickup} />
              <AreaBlock label="Destination" area={move.dropoff} />
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-ink-80">
              <Lock className="size-4 shrink-0" aria-hidden />
              The exact address and the client&apos;s phone appear once the job is assigned to you.
            </p>
          </Panel>

          <Panel title="What to move">
            {move.items.length === 0 ? (
              <p className="text-sm text-ink-80">The client did not list individual items.</p>
            ) : (
              <ul className="divide-y divide-ink/20">
                {move.items.map((item) => (
                  <li
                    key={`${item.name}-${item.category}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {item.quantity} x {item.name}
                    </span>
                    <span className="flex gap-1">
                      {item.isFragile ? <Tag tone="alert">Fragile</Tag> : null}
                      {item.needsDisassembly ? <Tag>Disassembly</Tag> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {move.extraServices.length > 0 ? (
              <p className="mt-3 border-t border-ink pt-3 text-sm">
                <span className="text-ink-80">Extra services: </span>
                {move.extraServices.join(', ').toLowerCase()}
              </p>
            ) : null}
          </Panel>
        </div>

        <Panel className="self-start">
          {isOpen ? (
            <>
              <p className="text-sm text-ink-80">Time left to answer</p>
              <p className="mb-4 mt-1 text-xl">
                <Countdown expiresAt={data.expiresAt} onExpire={() => void offer.refetch()} />
              </p>
              <OfferActions offer={data} onExpired={() => void offer.refetch()} />
            </>
          ) : (
            <>
              <p className="font-bold">{CLOSED_LABELS[data.status]}</p>
              {data.quote ? (
                <p className="mt-2 text-sm">Your quote: {formatMoney(data.quote.amount)}</p>
              ) : null}
              {data.status === 'ACCEPTED' ? (
                <Link
                  href={`/mover/jobs/${move.id}`}
                  className="mt-3 inline-block font-bold underline underline-offset-2"
                >
                  Open the job
                </Link>
              ) : null}
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
