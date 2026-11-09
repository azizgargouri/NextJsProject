import { env } from '../../config/env';
import type { MoveRequestDoc, MoverProfileDoc } from '../../shared/database/models';
import { moverRepository as repo } from './mover.repository';
import { documentBlockers, matchesMove, slotsOverlap, todayInTunis } from './mover.rules';
import { AUTO_COMPLETE_HOURS, DOCUMENT_WARNING_DAYS } from './mover.constants';
import { notify } from './mover.notifications';
import { completeMove } from './mover.completion';
import { BadRequestError, NotFoundError } from '../../shared/database/errors';

/**
 * Who gets offered what, and what happens when time runs out.
 * The admin back office will call dispatchMove; sweep() runs lazily on mover
 * reads because the project has no scheduler yet.
 */

export async function moverBlockers(profile: MoverProfileDoc, now = new Date()): Promise<string[]> {
  const blockers: string[] = [];
  if (profile.verificationStatus !== 'APPROVED') {
    blockers.push('Your application has not been approved.');
  }
  const documents = await repo.listDocuments(profile.userId);
  blockers.push(...documentBlockers(documents, now));
  if (profile.zones.length === 0) blockers.push('Choose at least one service zone.');
  return blockers;
}

export async function hasScheduleConflict(
  moverId: string,
  move: Pick<MoveRequestDoc, '_id' | 'moveDate' | 'timeSlot'>,
): Promise<boolean> {
  const sameDay = await repo.activeMovesOnDate(moverId, move.moveDate, String(move._id));
  return sameDay.some((other) => slotsOverlap(other.timeSlot, move.timeSlot));
}

/** Checks one mover against one move: account, documents, zone, availability, schedule. */
export async function isMoverEligible(
  profile: MoverProfileDoc,
  move: MoveRequestDoc,
  now = new Date(),
): Promise<boolean> {
  const user = await repo.findUser(profile.userId);
  if (!user || user.status !== 'ACTIVE') return false;
  if ((await moverBlockers(profile, now)).length > 0) return false;
  const availability = await repo.availabilityOn(profile.userId, [move.moveDate]);
  if (!matchesMove({ zones: profile.zones, availability }, move)) return false;
  return !(await hasScheduleConflict(profile.userId, move));
}

/** Offers the move to the next `count` eligible movers, best rated first. */
async function offerToNext(move: MoveRequestDoc, count: number, now: Date): Promise<number> {
  if (move.moveDate < todayInTunis(now)) return 0;
  const alreadyOffered = new Set(await repo.offeredMoverIds(String(move._id)));
  const candidates = await repo.findApprovedProfilesInZone(move.pickup.zone);
  const expiresAt = new Date(now.getTime() + env().OFFER_TTL_MINUTES * 60_000);
  let sent = 0;

  for (const profile of candidates) {
    if (sent >= count) break;
    if (alreadyOffered.has(profile.userId)) continue;
    if (!(await isMoverEligible(profile, move, now))) continue;

    const offer = await repo.createOffer(String(move._id), profile.userId, expiresAt);
    if (!offer) continue;
    sent += 1;
    await notify(profile.userId, {
      type: 'OFFER_NEW',
      title: `New job offer ${move.reference}`,
      body: `${move.pickup.city} to ${move.dropoff.city} on ${move.moveDate}.`,
      link: `/mover/offers/${String(offer._id)}`,
    });
  }
  return sent;
}

/** Entry point for the back office (A-03): opens a submitted move to eligible movers. */
export async function dispatchMove(
  moveId: string,
  options: { actorId: string | null; count?: number; now?: Date },
): Promise<{ offersSent: number }> {
  const now = options.now ?? new Date();
  let move = await repo.findMove(moveId);
  if (!move) throw new NotFoundError('Move');

  if (move.status === 'SUBMITTED') {
    const opened = await repo.transitionMove(moveId, 'SUBMITTED', 'QUOTING');
    if (opened) {
      await repo.addStatusEvent({
        moveId,
        fromStatus: 'SUBMITTED',
        toStatus: 'QUOTING',
        actorId: options.actorId,
      });
      move = opened;
    }
  }
  if (move.status !== 'QUOTING') {
    throw new BadRequestError('Only a submitted or quoting move can be dispatched');
  }
  return { offersSent: await offerToNext(move, options.count ?? 1, now) };
}

/** Moves on once nobody holds the job: no open offer and no live quote. */
export async function handOffIfIdle(moveId: string, now: Date): Promise<void> {
  const move = await repo.findMove(moveId);
  if (!move || move.status !== 'QUOTING') return;
  if ((await repo.countPendingOffers(moveId, now)) > 0) return;
  if ((await repo.countOpenQuotes(moveId, now)) > 0) return;
  await offerToNext(move, 1, now);
}

/** Runs every time-based rule. Each step claims its rows, so concurrent runs are safe. */
export async function sweep(now: Date = new Date()): Promise<void> {
  for (const offer of await repo.claimExpiredOffers(now)) {
    const move = await repo.findMove(offer.moveId);
    await notify(offer.moverId, {
      type: 'OFFER_EXPIRED',
      title: `Offer ${move?.reference ?? 'for a job'} expired`,
      body: 'The response time passed, so the job went to the next mover.',
      link: '/mover/offers',
    });
    await handOffIfIdle(offer.moveId, now);
  }

  for (const quote of await repo.claimExpiredQuotes(now)) {
    await handOffIfIdle(quote.moveId, now);
  }

  const completionCutoff = new Date(now.getTime() - AUTO_COMPLETE_HOURS * 60 * 60 * 1000);
  for (const move of await repo.findDeliveredBefore(completionCutoff)) {
    await completeMove(move, null, `No claim within ${AUTO_COMPLETE_HOURS} hours of delivery`, now);
  }

  const warnBefore = new Date(now.getTime() + DOCUMENT_WARNING_DAYS * 24 * 60 * 60 * 1000);
  for (const document of await repo.claimExpiringDocuments(warnBefore, now)) {
    const expired = (document.expiresAt as Date).getTime() <= now.getTime();
    await notify(document.moverId, {
      type: 'DOCUMENT_EXPIRING',
      title: expired
        ? `Your ${document.type} document has expired`
        : `Your ${document.type} document expires soon`,
      body: `Expiry date: ${(document.expiresAt as Date).toISOString().slice(0, 10)}. Upload a new one to keep receiving offers.`,
      link: '/mover/profile',
    });
  }
}
