import {
  call,
  closeDatabase,
  createMove,
  createMover,
  createUser,
  dayFromNow,
  dispatched,
  expireOffer,
  MOVE_DAY,
  offerFor,
  PRIVATE,
  resetDatabase,
} from './helpers';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { GET as listOffers } from '@/app/api/mover/offers/route';
import { GET as getOffer } from '@/app/api/mover/offers/[id]/route';
import { POST as respond } from '@/app/api/mover/offers/[id]/respond/route';
import { GET as getJob } from '@/app/api/mover/jobs/[id]/route';
import { GET as notifications } from '@/app/api/mover/notifications/route';
import { POST as acceptQuote } from '@/app/api/moves/[id]/quotes/[quoteId]/accept/route';
import {
  AvailabilityModel,
  JobOfferModel,
  MoveRequestModel,
  MoverDocumentModel,
  MoverProfileModel,
  QuoteModel,
  StatusEventModel,
} from '@/server/shared/database/models';
import { dispatchMove, sweep } from '@/server/modules/mover';
import { moverRepository } from '@/server/modules/mover/mover.repository';

before(resetDatabase);
after(closeDatabase);
beforeEach(resetDatabase);

const respondTo = (token: string, id: string, body: unknown) =>
  call(respond, { token, params: { id }, body });

async function theOffer(moveId: string, moverId: string): Promise<string> {
  const offer = await offerFor(moveId, moverId);
  assert.ok(offer, 'expected an offer');
  return String(offer._id);
}

describe('item 5: offers list and detail (M-04)', () => {
  it('shows a matching offer with a deadline about two hours away', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { offersSent } = await dispatched(client.id);
    assert.equal(offersSent, 1);

    const { status, data } = await call(listOffers, { token: mover.token });
    assert.equal(status, 200);
    assert.equal(data.eligibility.eligible, true);
    assert.equal(data.offers.length, 1);
    const minutes = (new Date(data.offers[0].expiresAt).getTime() - Date.now()) / 60_000;
    assert.ok(minutes > 118 && minutes <= 120, `deadline was ${minutes} minutes away`);
  });

  it('never exposes the exact address, phone, name or notes before assignment', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const offerId = await theOffer(moveId, mover.id);

    const payloads = [
      await call(listOffers, { token: mover.token }),
      await call(getOffer, { token: mover.token, params: { id: offerId } }),
    ];
    const secrets = [...Object.values(PRIVATE), client.phone, client.name, client.id];
    for (const { data } of payloads) {
      const text = JSON.stringify(data);
      for (const secret of secrets) assert.ok(!text.includes(secret), `leaked: ${secret}`);
    }
    // ...but the mover still gets enough to decide.
    const { offer } = payloads[1]?.data;
    assert.equal(offer.move.pickup.city, 'Tunis');
    assert.equal(offer.move.pickup.floor, 3);
    assert.equal(offer.move.pickup.hasElevator, false);
    assert.equal(offer.move.items[0].name, 'Sofa');
  });

  it('a job page for a move the mover only has an offer on is a 404', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const job = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(job.status, 404);
    assert.ok(!JSON.stringify(job.data).includes(PRIVATE.pickupStreet));
  });

  it("another mover's offer is a 404, for reading and for answering", async () => {
    const client = await createUser('CLIENT');
    const owner = await createMover();
    const other = await createMover({ zones: ['SFA'] });
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, owner.id);
    assert.equal((await call(getOffer, { token: other.token, params: { id } })).status, 404);
    assert.equal((await respondTo(other.token, id, { action: 'ACCEPT' })).status, 404);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');
  });

  it('a malformed offer id is a 404, not a server error', async () => {
    const mover = await createMover();
    assert.equal(
      (await call(getOffer, { token: mover.token, params: { id: 'nope' } })).status,
      404,
    );
  });

  it('dispatch skips movers outside the zone, unavailable, or on the wrong slot', async () => {
    const client = await createUser('CLIENT');
    const wrongZone = await createMover({ zones: ['SFA'] });
    const wrongDay = await createMover({ availableOn: [dayFromNow(9)] });
    const wrongSlot = await createMover({ slot: 'AFTERNOON' });
    const { moveId, offersSent } = await dispatched(client.id, {}, 5);
    assert.equal(offersSent, 0);
    for (const mover of [wrongZone, wrongDay, wrongSlot]) {
      assert.equal(await offerFor(moveId, mover.id), null);
    }
  });

  it('dispatch skips unapproved, blocked, uninsured and expired-insurance movers', async () => {
    const client = await createUser('CLIENT');
    await createMover({ verification: 'PENDING' });
    await createMover({ verification: 'SUSPENDED' });
    await createMover({ userStatus: 'BLOCKED' });
    await createMover({ insuranceDays: null });
    await createMover({ insuranceDays: -1 });
    const { offersSent } = await dispatched(client.id, {}, 5);
    assert.equal(offersSent, 0);
  });

  it('dispatch skips a mover already booked in that slot, but not the other half-day', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const first = await dispatched(client.id, { timeSlot: 'MORNING' });
    await respondTo(mover.token, await theOffer(first.moveId, mover.id), { action: 'ACCEPT' });

    const clash = await dispatched(client.id, { timeSlot: 'MORNING' });
    assert.equal(clash.offersSent, 0);
    const clear = await dispatched(client.id, { timeSlot: 'AFTERNOON' });
    assert.equal(clear.offersSent, 1);
  });

  it('expired insurance empties the list and explains why', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    await dispatched(client.id);
    await MoverDocumentModel.updateOne(
      { moverId: mover.id, type: 'INSURANCE' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const { data } = await call(listOffers, { token: mover.token });
    assert.equal(data.eligibility.eligible, false);
    assert.match(data.eligibility.blockers.join(' '), /insurance has expired/);
    assert.deepEqual(data.offers, []);
  });

  it('an open offer drops off the list once it stops matching, and cannot be accepted', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);

    await AvailabilityModel.deleteMany({ moverId: mover.id });
    assert.deepEqual((await call(listOffers, { token: mover.token })).data.offers, []);
    assert.equal((await respondTo(mover.token, id, { action: 'ACCEPT' })).status, 403);

    await AvailabilityModel.create({ moverId: mover.id, date: MOVE_DAY, slot: 'FULL_DAY' });
    await MoverProfileModel.updateOne({ userId: mover.id }, { $set: { zones: ['SFA'] } });
    assert.deepEqual((await call(listOffers, { token: mover.token })).data.offers, []);
  });

  it('notifies the mover of a new offer, in the app', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    const { data } = await call(notifications, { token: mover.token });
    assert.equal(data.unreadCount, 1);
    assert.equal(data.notifications[0].type, 'OFFER_NEW');
    assert.equal(data.notifications[0].link, `/mover/offers/${id}`);
  });

  it('refuses to dispatch a move that is already past quoting', async () => {
    const client = await createUser('CLIENT');
    const move = await createMove(client.id, { status: 'ASSIGNED' });
    await assert.rejects(dispatchMove(String(move._id), { actorId: null }));
  });
});

describe('item 6: accept, decline or quote (M-05)', () => {
  it('accept assigns the job, records the event and reveals the contact details', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const response = await respondTo(mover.token, await theOffer(moveId, mover.id), {
      action: 'ACCEPT',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { status: 'ACCEPTED', jobId: moveId });

    const move = await MoveRequestModel.findById(moveId).lean();
    assert.equal(move?.status, 'ASSIGNED');
    assert.equal(move?.assignedMoverId, mover.id);
    assert.equal(move?.finalPrice, 400);
    const events = await StatusEventModel.find({ moveId }).sort({ createdAt: 1 }).lean();
    assert.deepEqual(
      events.map((event) => event.toStatus),
      ['QUOTING', 'ASSIGNED'],
    );

    const job = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(job.data.job.pickup.street, PRIVATE.pickupStreet);
    assert.equal(job.data.job.client.phone, client.phone);
  });

  it('accept is refused without a fixed price, and the offer stays open', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id, { estimatedPrice: null });
    const id = await theOffer(moveId, mover.id);
    const offer = await call(getOffer, { token: mover.token, params: { id } });
    assert.equal(offer.data.offer.canAccept, false);
    assert.equal((await respondTo(mover.token, id, { action: 'ACCEPT' })).status, 400);
    assert.equal((await offerFor(moveId, mover.id))?.status, 'PENDING');
  });

  it('an offer can only be answered once', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    assert.equal((await respondTo(mover.token, id, { action: 'ACCEPT' })).status, 200);
    const again = await respondTo(mover.token, id, { action: 'DECLINE' });
    assert.equal(again.status, 409);
    assert.equal(again.data.code, 'OFFER_CLOSED');
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'ASSIGNED');
  });

  it('when two movers accept at once, exactly one wins', async () => {
    const client = await createUser('CLIENT');
    const a = await createMover({ rating: 5 });
    const b = await createMover({ rating: 4 });
    const { moveId, offersSent } = await dispatched(client.id, {}, 2);
    assert.equal(offersSent, 2);
    const results = await Promise.all([
      respondTo(a.token, await theOffer(moveId, a.id), { action: 'ACCEPT' }),
      respondTo(b.token, await theOffer(moveId, b.id), { action: 'ACCEPT' }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    const winner = results[0]?.status === 200 ? a : b;
    const move = await MoveRequestModel.findById(moveId).lean();
    assert.equal(move?.assignedMoverId, winner.id);
    assert.equal(await StatusEventModel.countDocuments({ moveId, toStatus: 'ASSIGNED' }), 1);
  });

  it('the same mover double-tapping accept is assigned once', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    const results = await Promise.all([
      respondTo(mover.token, id, { action: 'ACCEPT' }),
      respondTo(mover.token, id, { action: 'ACCEPT' }),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(await StatusEventModel.countDocuments({ moveId, toStatus: 'ASSIGNED' }), 1);
  });

  it('accepting closes the other open offers and tells those movers', async () => {
    const client = await createUser('CLIENT');
    const a = await createMover({ rating: 5 });
    const b = await createMover({ rating: 4 });
    const { moveId } = await dispatched(client.id, {}, 2);
    await respondTo(a.token, await theOffer(moveId, a.id), { action: 'ACCEPT' });
    assert.equal((await offerFor(moveId, b.id))?.status, 'WITHDRAWN');
    const { data } = await call(notifications, { token: b.token });
    assert.equal(data.notifications[0].type, 'OFFER_WITHDRAWN');
    assert.deepEqual((await call(listOffers, { token: b.token })).data.offers, []);
  });

  it('decline hands the job to the next best mover straight away', async () => {
    const client = await createUser('CLIENT');
    const first = await createMover({ rating: 5 });
    const second = await createMover({ rating: 4 });
    const { moveId } = await dispatched(client.id);
    assert.equal(await offerFor(moveId, second.id), null);

    const response = await respondTo(first.token, await theOffer(moveId, first.id), {
      action: 'DECLINE',
      reason: 'Truck in repair',
    });
    assert.equal(response.status, 200);
    assert.equal((await offerFor(moveId, first.id))?.declineReason, 'Truck in repair');
    assert.equal((await offerFor(moveId, second.id))?.status, 'PENDING');
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');
  });

  it('a quote waits for the client and shows on the mover side as waiting', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id, { estimatedPrice: null });
    const response = await respondTo(mover.token, await theOffer(moveId, mover.id), {
      action: 'QUOTE',
      amount: 520.5,
      message: 'Includes packing',
    });
    assert.equal(response.status, 200);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');

    const { data } = await call(listOffers, { token: mover.token });
    assert.deepEqual(data.offers, []);
    assert.equal(data.quoted[0].quote.amount, 520.5);
    assert.equal(data.quoted[0].quote.status, 'SENT');
    assert.ok(!JSON.stringify(data).includes(PRIVATE.pickupStreet));
  });

  it('rejects zero, negative, absurd or non-numeric quotes and unknown actions', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    for (const amount of [0, -5, 2_000_000, 'abc']) {
      const response = await respondTo(mover.token, id, { action: 'QUOTE', amount });
      assert.equal(response.status, 422, `amount ${amount}`);
    }
    assert.equal((await respondTo(mover.token, id, { action: 'STEAL' })).status, 422);
    assert.equal((await respondTo(mover.token, id, null)).status, 422);
    assert.equal((await offerFor(moveId, mover.id))?.status, 'PENDING');
  });

  it('when the client accepts a quote, the mover is assigned at the quoted amount', async () => {
    const client = await createUser('CLIENT');
    const winner = await createMover({ rating: 5 });
    const loser = await createMover({ rating: 4 });
    const { moveId } = await dispatched(client.id, {}, 2);
    await respondTo(winner.token, await theOffer(moveId, winner.id), {
      action: 'QUOTE',
      amount: 350,
    });
    await respondTo(loser.token, await theOffer(moveId, loser.id), {
      action: 'QUOTE',
      amount: 300,
    });
    const quote = await QuoteModel.findOne({ moveId, moverId: winner.id }).lean();

    const accepted = await call(acceptQuote, {
      token: client.token,
      params: { id: moveId, quoteId: String(quote?._id) },
      method: 'POST',
    });
    assert.equal(accepted.status, 200);

    const move = await MoveRequestModel.findById(moveId).lean();
    assert.equal(move?.assignedMoverId, winner.id);
    assert.equal(move?.finalPrice, 350);
    assert.equal((await offerFor(moveId, winner.id))?.status, 'ACCEPTED');
    assert.equal((await QuoteModel.findOne({ moveId, moverId: loser.id }))?.status, 'REJECTED');
    const types = (await call(notifications, { token: winner.token })).data.notifications.map(
      (entry: { type: string }) => entry.type,
    );
    assert.ok(types.includes('QUOTE_ACCEPTED') && types.includes('JOB_ASSIGNED'));
    const lost = (await call(notifications, { token: loser.token })).data.notifications;
    assert.equal(lost[0].type, 'QUOTE_REJECTED');
  });

  it("only the move's own client can accept a quote, once, while it is valid", async () => {
    const client = await createUser('CLIENT');
    const stranger = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    await respondTo(mover.token, await theOffer(moveId, mover.id), {
      action: 'QUOTE',
      amount: 350,
    });
    const quote = await QuoteModel.findOne({ moveId }).lean();
    const params = { id: moveId, quoteId: String(quote?._id) };

    assert.equal(
      (await call(acceptQuote, { token: stranger.token, params, method: 'POST' })).status,
      404,
    );
    assert.equal(
      (await call(acceptQuote, { token: mover.token, params, method: 'POST' })).status,
      403,
    );

    await QuoteModel.updateOne(
      { _id: quote?._id },
      { $set: { validUntil: new Date(Date.now() - 1) } },
    );
    assert.equal(
      (await call(acceptQuote, { token: client.token, params, method: 'POST' })).status,
      409,
    );
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');
  });
});

describe('item 6: the time limit', () => {
  it('after the deadline the offer closes and goes to the next mover', async () => {
    const client = await createUser('CLIENT');
    const slow = await createMover({ rating: 5 });
    const next = await createMover({ rating: 4 });
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, slow.id);
    await expireOffer(moveId, slow.id);

    // Answering late is refused, even if nothing has swept the offer yet.
    const late = await respondTo(slow.token, id, { action: 'ACCEPT' });
    assert.equal(late.status, 409);
    assert.match(late.data.message, /expired/);
    assert.equal((await offerFor(moveId, slow.id))?.status, 'EXPIRED');
    assert.equal((await offerFor(moveId, next.id))?.status, 'PENDING');
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');

    const told = (await call(notifications, { token: slow.token })).data.notifications;
    assert.equal(told[0].type, 'OFFER_EXPIRED');
    assert.equal(
      (await call(notifications, { token: next.token })).data.notifications[0].type,
      'OFFER_NEW',
    );
  });

  it('a late quote and a late decline are refused too', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    await expireOffer(moveId, mover.id);
    assert.equal((await respondTo(mover.token, id, { action: 'QUOTE', amount: 100 })).status, 409);
    assert.equal(await QuoteModel.countDocuments({ moveId }), 0);
    assert.equal((await respondTo(mover.token, id, { action: 'DECLINE' })).status, 409);
  });

  it('the atomic claim itself refuses a deadline that passed after the earlier checks', async () => {
    const client = await createUser('CLIENT');
    const mover = await createMover();
    const { moveId } = await dispatched(client.id);
    const id = await theOffer(moveId, mover.id);
    await expireOffer(moveId, mover.id);
    assert.equal(await moverRepository.claimOffer(mover.id, id, 'ACCEPTED', new Date()), null);
    assert.equal((await offerFor(moveId, mover.id))?.status, 'PENDING');
  });

  it('concurrent sweeps hand off only once', async () => {
    const client = await createUser('CLIENT');
    const slow = await createMover({ rating: 5 });
    const next = await createMover({ rating: 4 });
    await createMover({ rating: 3 });
    const { moveId } = await dispatched(client.id);
    await expireOffer(moveId, slow.id);
    await Promise.all([sweep(), sweep(), sweep()]);
    assert.equal(await JobOfferModel.countDocuments({ moveId, status: 'PENDING' }), 1);
    assert.equal((await offerFor(moveId, next.id))?.status, 'PENDING');
    assert.equal(
      (await call(notifications, { token: slow.token })).data.notifications.filter(
        (entry: { type: string }) => entry.type === 'OFFER_EXPIRED',
      ).length,
      1,
    );
  });

  it('with nobody left, the move stays open rather than looping back', async () => {
    const client = await createUser('CLIENT');
    const only = await createMover();
    const { moveId } = await dispatched(client.id);
    await expireOffer(moveId, only.id);
    await sweep();
    assert.equal(await JobOfferModel.countDocuments({ moveId }), 1);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'QUOTING');
  });

  it('does not hand off while another mover still holds a live quote', async () => {
    const client = await createUser('CLIENT');
    const quoter = await createMover({ rating: 5 });
    const slow = await createMover({ rating: 4 });
    const waiting = await createMover({ rating: 3 });
    const { moveId } = await dispatched(client.id, {}, 2);
    await respondTo(quoter.token, await theOffer(moveId, quoter.id), {
      action: 'QUOTE',
      amount: 300,
    });
    await expireOffer(moveId, slow.id);
    await sweep();
    assert.equal(await offerFor(moveId, waiting.id), null);
  });

  it('an expired quote reopens the job to the next mover', async () => {
    const client = await createUser('CLIENT');
    const quoter = await createMover({ rating: 5 });
    const next = await createMover({ rating: 4 });
    const { moveId } = await dispatched(client.id);
    await respondTo(quoter.token, await theOffer(moveId, quoter.id), {
      action: 'QUOTE',
      amount: 300,
    });
    await QuoteModel.updateOne({ moveId }, { $set: { validUntil: new Date(Date.now() - 1) } });
    await sweep();
    assert.equal((await QuoteModel.findOne({ moveId }))?.status, 'EXPIRED');
    assert.equal((await offerFor(moveId, next.id))?.status, 'PENDING');
    assert.deepEqual((await call(listOffers, { token: quoter.token })).data.quoted, []);
  });
});
