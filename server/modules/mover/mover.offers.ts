import { randomInt } from 'node:crypto';
import {
  AlreadyExistsError,
  BadRequestError,
  DomainError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/database/errors';
import type { JobOfferDoc, MoveRequestDoc, QuoteDoc } from '../../shared/database/models';
import type { MoverEligibilityDto, OfferDto, OffersListDto } from '../../../types/mover';
import { QUOTE_VALID_HOURS } from './mover.constants';
import {
  handOffIfIdle,
  hasScheduleConflict,
  isMoverEligible,
  moverBlockers,
  sweep,
} from './mover.dispatch';
import { notify } from './mover.notifications';
import { moverRepository as repo } from './mover.repository';
import { matchesMove } from './mover.rules';
import { serializeOffer } from './mover.serializer';
import type { OfferResponseInput } from './mover.schema';

class OfferClosedError extends DomainError {
  constructor(message: string) {
    super(message, 409, 'OFFER_CLOSED');
  }
}

export async function moverEligibility(moverId: string): Promise<MoverEligibilityDto> {
  const profile = await repo.findProfile(moverId);
  if (!profile) return { eligible: false, blockers: ['Your mover profile is missing.'] };
  const blockers = await moverBlockers(profile);
  return { eligible: blockers.length === 0, blockers };
}

async function joinOffers(offers: JobOfferDoc[]): Promise<OfferDto[]> {
  const moves = await repo.findMoves(offers.map((offer) => offer.moveId));
  const movesById = new Map(moves.map((move) => [String(move._id), move]));
  const quotes = await repo.quotesByOffers(offers.map((offer) => String(offer._id)));
  const quotesByOffer = new Map<string, QuoteDoc>(quotes.map((quote) => [quote.offerId, quote]));

  return offers.flatMap((offer) => {
    const move = movesById.get(offer.moveId);
    return move ? [serializeOffer(offer, move, quotesByOffer.get(String(offer._id)) ?? null)] : [];
  });
}

/** M-04: open offers that still match the mover's zones and availability. */
export async function listOffers(moverId: string): Promise<OffersListDto> {
  const now = new Date();
  await sweep(now);

  const eligibility = await moverEligibility(moverId);
  const quotedOffers = await repo.listOffersByStatus(moverId, 'QUOTED');
  const quoted = (await joinOffers(quotedOffers)).filter((offer) => offer.quote?.status === 'SENT');
  if (!eligibility.eligible) return { eligibility, offers: [], quoted };

  const profile = await repo.findProfile(moverId);
  const pending = await repo.listOffersByStatus(moverId, 'PENDING', now);
  const moves = await repo.findMoves(pending.map((offer) => offer.moveId));
  const availability = await repo.availabilityOn(
    moverId,
    moves.map((move) => move.moveDate),
  );
  const matching = new Set(
    moves
      .filter(
        (move) =>
          move.status === 'QUOTING' &&
          matchesMove({ zones: profile?.zones ?? [], availability }, move),
      )
      .map((move) => String(move._id)),
  );
  const offers = await joinOffers(pending.filter((offer) => matching.has(offer.moveId)));
  return { eligibility, offers, quoted };
}

export async function getOffer(moverId: string, offerId: string): Promise<OfferDto> {
  await sweep();
  const offer = await repo.findOffer(moverId, offerId);
  if (!offer) throw new NotFoundError('Offer');
  const [joined] = await joinOffers([offer]);
  if (!joined) throw new NotFoundError('Offer');
  return joined;
}

/** Assigns the move and closes it for everyone else. Caller has already won the claim. */
async function finishAssignment(
  move: MoveRequestDoc,
  moverId: string,
  keepQuoteId: string | null,
  actorId: string,
  note: string,
): Promise<void> {
  const moveId = String(move._id);
  await repo.addStatusEvent({
    moveId,
    fromStatus: 'QUOTING',
    toStatus: 'ASSIGNED',
    note,
    actorId,
  });

  const withdrawn = await repo.withdrawOpenOffers(moveId, moverId);
  const rejected = await repo.rejectOtherQuotes(moveId, keepQuoteId);
  const quotedMovers = new Set(rejected.map((quote) => quote.moverId));

  for (const quote of rejected) {
    await notify(quote.moverId, {
      type: 'QUOTE_REJECTED',
      title: `Quote for ${move.reference} not selected`,
      body: 'The job went to another mover.',
      link: '/mover/offers',
    });
  }
  for (const offer of withdrawn) {
    if (quotedMovers.has(offer.moverId)) continue;
    await notify(offer.moverId, {
      type: 'OFFER_WITHDRAWN',
      title: `Offer ${move.reference} closed`,
      body: 'Another mover took this job.',
      link: '/mover/offers',
    });
  }

  await notify(moverId, {
    type: 'JOB_ASSIGNED',
    title: `Job ${move.reference} is yours`,
    body: `The client's address and phone are now on the job page. Move date: ${move.moveDate}.`,
    link: `/mover/jobs/${moveId}`,
  });
  await notify(move.clientId, {
    type: 'JOB_STATUS',
    title: `A mover was assigned to ${move.reference}`,
    body: 'You can now chat with your mover from the move page.',
    link: `/dashboard`,
  });
}

/** M-05: accept, decline or quote. The deadline and first-answer rule are atomic. */
export async function respondToOffer(
  moverId: string,
  offerId: string,
  input: OfferResponseInput,
): Promise<{ status: string; jobId: string | null }> {
  const now = new Date();
  await sweep(now);

  const offer = await repo.findOffer(moverId, offerId);
  if (!offer) throw new NotFoundError('Offer');
  if (offer.status !== 'PENDING' || offer.expiresAt <= now) {
    throw new OfferClosedError(
      offer.status === 'EXPIRED' || offer.expiresAt <= now
        ? 'This offer has expired'
        : 'This offer has already been answered or closed',
    );
  }
  const move = await repo.findMove(offer.moveId);
  if (!move) throw new NotFoundError('Offer');
  if (move.status !== 'QUOTING') throw new OfferClosedError('This job is no longer open');

  if (input.action === 'DECLINE') {
    const claimed = await repo.claimOffer(moverId, offerId, 'DECLINED', now, {
      declineReason: input.reason ?? '',
    });
    if (!claimed) throw new OfferClosedError('This offer has already been answered or closed');
    await handOffIfIdle(offer.moveId, now);
    return { status: 'DECLINED', jobId: null };
  }

  // Taking on work needs a mover who is still eligible right now.
  const profile = await repo.findProfile(moverId);
  if (!profile || !(await isMoverEligible(profile, move, now))) {
    if (profile && (await hasScheduleConflict(moverId, move))) {
      throw new AlreadyExistsError('Job on this date and time slot');
    }
    throw new ForbiddenError(
      'You no longer meet the conditions for this offer. Check your documents, zones and availability.',
    );
  }

  if (input.action === 'ACCEPT') {
    if (move.estimatedPrice === null) {
      throw new BadRequestError('This job has no fixed price. Send a quote instead.');
    }
    const claimed = await repo.claimOffer(moverId, offerId, 'ACCEPTED', now);
    if (!claimed) throw new OfferClosedError('This offer has already been answered or closed');

    const assigned = await repo.claimMove(offer.moveId, moverId, move.estimatedPrice, now);
    if (!assigned) {
      await repo.setOfferStatus(offerId, 'WITHDRAWN');
      throw new OfferClosedError('Another mover has already taken this job');
    }
    await finishAssignment(assigned, moverId, null, moverId, 'Mover accepted the fixed price');
    return { status: 'ACCEPTED', jobId: offer.moveId };
  }

  const claimed = await repo.claimOffer(moverId, offerId, 'QUOTED', now);
  if (!claimed) throw new OfferClosedError('This offer has already been answered or closed');
  await repo.createQuote({
    moveId: offer.moveId,
    moverId,
    offerId,
    amount: input.amount,
    message: input.message ?? '',
    validUntil: new Date(now.getTime() + QUOTE_VALID_HOURS * 60 * 60 * 1000),
  });
  await notify(move.clientId, {
    type: 'JOB_STATUS',
    title: `New quote for ${move.reference}`,
    body: `${input.amount} TND.`,
    link: '/dashboard',
  });
  return { status: 'QUOTED', jobId: null };
}

/** C-06, needed so a mover's quote can lead to a job. The client UI will call this route. */
export async function acceptQuote(
  clientId: string,
  moveId: string,
  quoteId: string,
): Promise<{ jobId: string }> {
  const now = new Date();
  const move = await repo.findMove(moveId);
  if (!move || move.clientId !== clientId) throw new NotFoundError('Move');
  const quote = await repo.findQuote(moveId, quoteId);
  if (!quote) throw new NotFoundError('Quote');
  if (await hasScheduleConflict(quote.moverId, move)) {
    throw new AlreadyExistsError('Job for this mover on this date and time slot');
  }

  const claimedQuote = await repo.claimQuote(quoteId, now, 'ACCEPTED');
  if (!claimedQuote) throw new OfferClosedError('This quote is no longer open');

  const assigned = await repo.claimMove(moveId, quote.moverId, quote.amount, now);
  if (!assigned) {
    await repo.setQuoteStatus(quoteId, 'REJECTED');
    throw new OfferClosedError('This move has already been assigned');
  }
  await repo.setOfferStatus(quote.offerId, 'ACCEPTED');
  await finishAssignment(assigned, quote.moverId, quoteId, clientId, 'Client accepted a quote');
  await notify(quote.moverId, {
    type: 'QUOTE_ACCEPTED',
    title: `Your quote for ${assigned.reference} was accepted`,
    body: `${quote.amount} TND.`,
    link: `/mover/jobs/${moveId}`,
  });
  return { jobId: moveId };
}

export function newMoveReference(now: Date = new Date()): string {
  return `MV-${now.getFullYear()}-${String(randomInt(0, 100_000)).padStart(5, '0')}`;
}
