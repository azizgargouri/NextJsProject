import {
  call,
  closeDatabase,
  createMover,
  createUser,
  dispatched,
  JPEG,
  offerFor,
  PDF,
  PRIVATE,
  resetDatabase,
  upload,
  type Account,
} from './helpers';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { POST as respond } from '@/app/api/mover/offers/[id]/respond/route';
import { GET as listJobs } from '@/app/api/mover/jobs/route';
import { GET as getJob } from '@/app/api/mover/jobs/[id]/route';
import { POST as setStatus } from '@/app/api/mover/jobs/[id]/status/route';
import { GET as listPhotos, POST as addPhoto } from '@/app/api/mover/jobs/[id]/photos/route';
import { POST as loadCheck } from '@/app/api/mover/jobs/[id]/load-check/route';
import { GET as messages, POST as sendMessage } from '@/app/api/moves/[id]/messages/route';
import { POST as confirm } from '@/app/api/moves/[id]/confirm-delivery/route';
import { GET as earnings } from '@/app/api/mover/earnings/route';
import { GET as notifications } from '@/app/api/mover/notifications/route';
import { GET as file } from '@/app/api/files/mover/route';
import {
  EarningModel,
  MoveRequestModel,
  NotificationModel,
  PayoutModel,
  PricingRuleModel,
  StatusEventModel,
} from '@/server/shared/database/models';
import { sweep } from '@/server/modules/mover';

before(resetDatabase);
after(closeDatabase);
beforeEach(resetDatabase);

async function assignedJob(price = 400) {
  const client = await createUser('CLIENT');
  const mover = await createMover();
  const { moveId } = await dispatched(client.id, { estimatedPrice: price });
  const offer = await offerFor(moveId, mover.id);
  const accepted = await call(respond, {
    token: mover.token,
    params: { id: String(offer?._id) },
    body: { action: 'ACCEPT' },
  });
  assert.equal(accepted.status, 200);
  return { client, mover, moveId };
}

const act = (mover: Account, id: string, action: string) =>
  call(setStatus, { token: mover.token, params: { id }, body: { action } });

const photo = (
  mover: Account,
  id: string,
  stage: string,
  bytes: Uint8Array = JPEG,
  name = 'a.jpg',
) => call(addPhoto, { token: mover.token, params: { id }, form: upload({ stage }, bytes, name) });

const checkLoad = (mover: Account, id: string, body: unknown) =>
  call(loadCheck, { token: mover.token, params: { id }, body });

async function loadPhotos(mover: Account, id: string, count = 4) {
  for (let index = 0; index < count; index += 1) {
    assert.equal((await photo(mover, id, 'LOAD')).status, 201);
  }
}

/** Supplies the proof each status button requires, then presses it. */
async function advance(mover: Account, id: string, actions: string[]) {
  for (const action of actions) {
    if (action === 'IN_TRANSIT') {
      await loadPhotos(mover, id);
      const body = { boxes: 0, furniture: 1, confirmed: true };
      assert.equal((await checkLoad(mover, id, body)).status, 200);
    }
    if (action === 'DELIVERED') assert.equal((await photo(mover, id, 'DELIVERY')).status, 201);
    assert.equal((await act(mover, id, action)).status, 200, action);
  }
}

const ALL_STEPS = ['EN_ROUTE', 'LOADING', 'IN_TRANSIT', 'DELIVERED'];

describe('item 7: active job page (M-06)', () => {
  it('shows full address, phone and notes once assigned', async () => {
    const { client, mover, moveId } = await assignedJob();
    const { data } = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(data.job.contactVisible, true);
    assert.equal(data.job.pickup.street, PRIVATE.pickupStreet);
    assert.equal(data.job.pickup.accessNotes, PRIVATE.accessNotes);
    assert.equal(data.job.dropoff.street, PRIVATE.dropoffStreet);
    assert.deepEqual(data.job.client, { name: client.name, phone: client.phone });
    assert.equal(data.job.notes, PRIVATE.notes);
    assert.equal(data.job.nextAction, 'EN_ROUTE');
  });

  it('walks the four buttons in order, with a timeline entry for each', async () => {
    const { mover, moveId } = await assignedJob();
    const expected = [
      ['EN_ROUTE', 'EN_ROUTE', null, 'LOADING'],
      ['LOADING', 'IN_PROGRESS', 'LOADING', 'IN_TRANSIT'],
      ['IN_TRANSIT', 'IN_PROGRESS', 'IN_TRANSIT', 'DELIVERED'],
      ['DELIVERED', 'DELIVERED', null, null],
    ] as const;
    for (const [action, status, stage, next] of expected) {
      if (action === 'IN_TRANSIT') {
        await loadPhotos(mover, moveId);
        await checkLoad(mover, moveId, { boxes: 0, furniture: 1, confirmed: true });
      }
      if (action === 'DELIVERED') await photo(mover, moveId, 'DELIVERY');
      const { status: code, data } = await act(mover, moveId, action);
      assert.equal(code, 200);
      assert.equal(data.job.status, status);
      assert.equal(data.job.progressStage, stage);
      assert.equal(data.job.nextAction, next);
    }
    const events = await StatusEventModel.find({ moveId }).sort({ createdAt: 1, _id: 1 }).lean();
    assert.deepEqual(
      events.map((event) => event.toStatus),
      ['QUOTING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS', 'IN_PROGRESS', 'IN_PROGRESS', 'DELIVERED'],
    );
    assert.ok((await MoveRequestModel.findById(moveId))?.deliveredAt);
  });

  it('refuses skipping ahead or going backwards, and changes nothing', async () => {
    const { mover, moveId } = await assignedJob();
    for (const action of ['LOADING', 'IN_TRANSIT', 'DELIVERED']) {
      const response = await act(mover, moveId, action);
      assert.equal(response.status, 409, action);
      assert.equal(response.data.code, 'INVALID_TRANSITION');
    }
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'ASSIGNED');

    await advance(mover, moveId, ['EN_ROUTE', 'LOADING']);
    assert.equal((await act(mover, moveId, 'EN_ROUTE')).status, 409);
    assert.equal((await act(mover, moveId, 'DELIVERED')).status, 409);
    assert.equal((await MoveRequestModel.findById(moveId))?.progressStage, 'LOADING');
  });

  it('a double tap records one step', async () => {
    const { mover, moveId } = await assignedJob();
    const results = await Promise.all([
      act(mover, moveId, 'EN_ROUTE'),
      act(mover, moveId, 'EN_ROUTE'),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(await StatusEventModel.countDocuments({ moveId, toStatus: 'EN_ROUTE' }), 1);
  });

  it('rejects unknown actions, and terminal statuses cannot move', async () => {
    const { mover, moveId } = await assignedJob();
    assert.equal((await act(mover, moveId, 'COMPLETED')).status, 422);
    await MoveRequestModel.updateOne({ _id: moveId }, { $set: { status: 'CANCELLED' } });
    assert.equal((await act(mover, moveId, 'EN_ROUTE')).status, 409);
  });

  it("another mover cannot see or change someone else's job", async () => {
    const { moveId } = await assignedJob();
    const other = await createMover({ zones: ['SFA'] });
    const seen = await call(getJob, { token: other.token, params: { id: moveId } });
    assert.equal(seen.status, 404);
    assert.ok(!JSON.stringify(seen.data).includes(PRIVATE.pickupStreet));
    assert.equal((await act(other, moveId, 'EN_ROUTE')).status, 404);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'ASSIGNED');
  });

  it('notifies the client of each status change', async () => {
    const { client, mover, moveId } = await assignedJob();
    await act(mover, moveId, 'EN_ROUTE');
    const latest = await NotificationModel.findOne({ userId: client.id }).sort({
      createdAt: -1,
      _id: -1,
    });
    assert.match(latest?.title ?? '', /on the way/);
  });

  for (const status of ['CANCELLED', 'REFUNDED', 'COMPLETED'] as const) {
    it(`hides the address and phone again once a job is ${status}`, async () => {
      const { client, mover, moveId } = await assignedJob();
      await MoveRequestModel.updateOne({ _id: moveId }, { $set: { status } });
      const { data } = await call(getJob, { token: mover.token, params: { id: moveId } });
      assert.equal(data.job.contactVisible, false);
      assert.equal(data.job.client, null);
      assert.equal(data.job.notes, null);
      const text = JSON.stringify(data);
      for (const secret of [...Object.values(PRIVATE), client.phone]) {
        assert.ok(!text.includes(secret), `leaked: ${secret}`);
      }
      const list = await call(listJobs, { token: mover.token });
      assert.equal(list.data.past.length, 1);
      assert.equal(list.data.active.length, 0);
    });
  }
});

describe('load and delivery proof', () => {
  const loading = async () => {
    const job = await assignedJob();
    await advance(job.mover, job.moveId, ['EN_ROUTE', 'LOADING']);
    return job;
  };
  const GOOD = { boxes: 20, furniture: 2, confirmed: true };

  it('cannot leave without the photos and the confirmed count', async () => {
    const { mover, moveId } = await loading();
    const noProof = await act(mover, moveId, 'IN_TRANSIT');
    assert.equal(noProof.status, 409);
    assert.equal(noProof.data.code, 'PROOF_REQUIRED');

    await loadPhotos(mover, moveId, 4);
    const noCount = await act(mover, moveId, 'IN_TRANSIT');
    assert.equal(noCount.status, 409);
    assert.match(noCount.data.message, /load count/);
    assert.equal((await MoveRequestModel.findById(moveId))?.progressStage, 'LOADING');

    assert.equal((await checkLoad(mover, moveId, GOOD)).status, 200);
    assert.equal((await act(mover, moveId, 'IN_TRANSIT')).status, 200);
  });

  it('needs four photos before the count can be confirmed', async () => {
    const { mover, moveId } = await loading();
    await loadPhotos(mover, moveId, 3);
    const early = await checkLoad(mover, moveId, GOOD);
    assert.equal(early.status, 409);
    assert.equal(early.data.code, 'PROOF_REQUIRED');
    assert.equal((await MoveRequestModel.findById(moveId))?.loadCheck, null);
    await loadPhotos(mover, moveId, 1);
    assert.equal((await checkLoad(mover, moveId, GOOD)).status, 200);
  });

  it('rejects an unconfirmed, empty or invalid count', async () => {
    const { mover, moveId } = await loading();
    await loadPhotos(mover, moveId);
    const bad = [
      { boxes: 20, furniture: 2 },
      { boxes: 20, furniture: 2, confirmed: false },
      { boxes: 0, furniture: 0, confirmed: true },
      { boxes: -1, furniture: 2, confirmed: true },
      { boxes: 1.5, furniture: 2, confirmed: true },
      { boxes: 'many', furniture: 2, confirmed: true },
    ];
    for (const body of bad) {
      assert.equal((await checkLoad(mover, moveId, body)).status, 422, JSON.stringify(body));
    }
    assert.equal((await MoveRequestModel.findById(moveId))?.loadCheck, null);
  });

  it('compares with the client list, warns in the record, and does not block', async () => {
    const { mover, moveId } = await loading();
    await loadPhotos(mover, moveId);
    const { status, data } = await checkLoad(mover, moveId, {
      boxes: 5,
      furniture: 2,
      note: 'One box stayed behind',
      confirmed: true,
    });
    assert.equal(status, 200);
    // The test move lists one sofa and no boxes.
    assert.deepEqual(data.job.proof.expectedLoad, { boxes: 0, furniture: 1 });
    assert.equal(data.job.proof.loadCheck.boxes, 5);
    assert.equal(data.job.proof.loadCheck.note, 'One box stayed behind');
    const notes = data.job.timeline.map((event: { note: string }) => event.note).join(' | ');
    assert.match(notes, /Load confirmed: 5 boxes, 2 furniture/);
    assert.match(notes, /Client listed 0 boxes, 1 furniture/);
    assert.match(notes, /One box stayed behind/);
    assert.equal((await act(mover, moveId, 'IN_TRANSIT')).status, 200);
  });

  it('the count can be corrected while loading, then is locked after leaving', async () => {
    const { mover, moveId } = await loading();
    await loadPhotos(mover, moveId);
    await checkLoad(mover, moveId, GOOD);
    await checkLoad(mover, moveId, { ...GOOD, boxes: 21 });
    assert.equal((await MoveRequestModel.findById(moveId))?.loadCheck?.boxes, 21);
    await act(mover, moveId, 'IN_TRANSIT');
    assert.equal((await checkLoad(mover, moveId, { ...GOOD, boxes: 1 })).status, 409);
    assert.equal((await MoveRequestModel.findById(moveId))?.loadCheck?.boxes, 21);
  });

  it('load photos and the count only work during loading', async () => {
    const { mover, moveId } = await assignedJob();
    assert.equal((await photo(mover, moveId, 'LOAD')).status, 400);
    assert.equal((await checkLoad(mover, moveId, GOOD)).status, 409);
    await advance(mover, moveId, ['EN_ROUTE']);
    assert.equal((await photo(mover, moveId, 'LOAD')).status, 400);
    await advance(mover, moveId, ['LOADING', 'IN_TRANSIT']);
    assert.equal((await photo(mover, moveId, 'LOAD')).status, 400);
  });

  it('cannot mark delivered without a delivery photo', async () => {
    const { mover, moveId } = await loading();
    assert.equal((await photo(mover, moveId, 'DELIVERY')).status, 400);
    await advance(mover, moveId, ['IN_TRANSIT']);
    const refused = await act(mover, moveId, 'DELIVERED');
    assert.equal(refused.status, 409);
    assert.equal(refused.data.code, 'PROOF_REQUIRED');
    assert.match(refused.data.message, /delivered/);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'IN_PROGRESS');
    assert.equal((await photo(mover, moveId, 'DELIVERY')).status, 201);
    const done = await act(mover, moveId, 'DELIVERED');
    assert.equal(done.status, 200);
    assert.equal(done.data.job.proof.deliveryPhotos, 1);
  });

  it('a wrong step still reads as a wrong step, not missing proof', async () => {
    const { mover, moveId } = await assignedJob();
    const response = await act(mover, moveId, 'IN_TRANSIT');
    assert.equal(response.status, 409);
    assert.equal(response.data.code, 'INVALID_TRANSITION');
  });

  it("another mover cannot confirm or photograph someone else's load", async () => {
    const { moveId } = await loading();
    const other = await createMover({ zones: ['SFA'] });
    assert.equal((await checkLoad(other, moveId, GOOD)).status, 404);
    assert.equal((await photo(other, moveId, 'LOAD')).status, 404);
  });

  it('the job page reports progress towards each requirement', async () => {
    const { mover, moveId } = await loading();
    await photo(mover, moveId, 'LOAD');
    const { data } = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(data.job.proof.loadPhotos, 1);
    assert.equal(data.job.proof.minLoadPhotos, 4);
    assert.equal(data.job.proof.loadCheck, null);
    assert.equal(data.job.proof.minDeliveryPhotos, 1);
  });
});

describe('item 8: chat (M-08)', () => {
  const send = (actor: Account, id: string, thread: string, body: string) =>
    call(sendMessage, { token: actor.token, params: { id }, body: { thread, body } });
  const read = (actor: Account, id: string, thread: string) =>
    call(messages, { token: actor.token, params: { id }, query: { thread } });

  it('mover and client talk in one thread, marked from each side', async () => {
    const { client, mover, moveId } = await assignedJob();
    assert.equal((await send(mover, moveId, 'MOVER_CLIENT', 'On my way soon')).status, 201);
    assert.equal((await send(client, moveId, 'MOVER_CLIENT', 'Thanks')).status, 201);

    const { data } = await read(mover, moveId, 'MOVER_CLIENT');
    assert.deepEqual(
      data.messages.map((m: { body: string; mine: boolean }) => [m.body, m.mine]),
      [
        ['On my way soon', true],
        ['Thanks', false],
      ],
    );
  });

  it('counts unread messages until the mover opens the thread, and notifies', async () => {
    const { client, mover, moveId } = await assignedJob();
    await send(client, moveId, 'MOVER_CLIENT', 'Hello?');
    let job = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(job.data.job.unread.MOVER_CLIENT, 1);
    const feed = await call(notifications, { token: mover.token });
    assert.equal(feed.data.notifications[0].type, 'MESSAGE');
    assert.equal(feed.data.notifications[0].body, 'Hello?');

    await read(mover, moveId, 'MOVER_CLIENT');
    job = await call(getJob, { token: mover.token, params: { id: moveId } });
    assert.equal(job.data.job.unread.MOVER_CLIENT, 0);
  });

  it('support has its own thread that the client cannot read', async () => {
    const { client, mover, moveId } = await assignedJob();
    const admin = await createUser('ADMIN');
    await send(mover, moveId, 'MOVER_SUPPORT', 'Client is not answering');
    assert.equal((await send(admin, moveId, 'MOVER_SUPPORT', 'We will call them')).status, 201);

    const moverView = await read(mover, moveId, 'MOVER_SUPPORT');
    assert.equal(moverView.data.messages.length, 2);
    assert.equal(moverView.data.messages[1].senderRole, 'ADMIN');
    assert.equal((await read(client, moveId, 'MOVER_SUPPORT')).status, 404);
    assert.equal((await send(client, moveId, 'MOVER_SUPPORT', 'hi')).status, 404);
  });

  it("the mover cannot read the client's private support thread", async () => {
    const { mover, moveId } = await assignedJob();
    assert.equal((await read(mover, moveId, 'CLIENT_SUPPORT')).status, 404);
  });

  it('outsiders, and movers who only hold an offer, are kept out', async () => {
    const { moveId } = await assignedJob();
    const otherMover = await createMover({ zones: ['SFA'] });
    const otherClient = await createUser('CLIENT');
    assert.equal((await read(otherMover, moveId, 'MOVER_CLIENT')).status, 404);
    assert.equal((await send(otherClient, moveId, 'MOVER_CLIENT', 'x')).status, 404);

    const client = await createUser('CLIENT');
    const holder = await createMover({ zones: ['BIZ'] });
    const open = await dispatched(client.id, { zone: 'BIZ' });
    assert.equal(
      (await send(holder, open.moveId, 'MOVER_CLIENT', 'what is your address?')).status,
      404,
    );
  });

  it('validates the message and the thread, and closes chat when the move ends', async () => {
    const { mover, moveId } = await assignedJob();
    assert.equal((await send(mover, moveId, 'MOVER_CLIENT', '   ')).status, 422);
    assert.equal((await send(mover, moveId, 'MOVER_CLIENT', 'x'.repeat(2001))).status, 422);
    assert.equal((await send(mover, moveId, 'NOPE', 'x')).status, 422);
    assert.equal((await read(mover, moveId, 'NOPE')).status, 422);

    await send(mover, moveId, 'MOVER_CLIENT', 'last one');
    await MoveRequestModel.updateOne({ _id: moveId }, { $set: { status: 'COMPLETED' } });
    assert.equal((await send(mover, moveId, 'MOVER_CLIENT', 'too late')).status, 400);
    assert.equal((await read(mover, moveId, 'MOVER_CLIENT')).data.messages.length, 1);
  });

  it('stores markup as plain text', async () => {
    const { mover, moveId } = await assignedJob();
    const html = '<img src=x onerror=alert(1)>';
    await send(mover, moveId, 'MOVER_CLIENT', html);
    assert.equal((await read(mover, moveId, 'MOVER_CLIENT')).data.messages[0].body, html);
  });
});

describe('item 9: pickup and delivery photos (M-07)', () => {
  it('stores a photo and serves it back through a signed link', async () => {
    const { mover, moveId } = await assignedJob();
    await advance(mover, moveId, ['EN_ROUTE']);
    const created = await photo(mover, moveId, 'PICKUP');
    assert.equal(created.status, 201);
    assert.equal(created.data.photo.stage, 'PICKUP');

    const listed = await call(listPhotos, { token: mover.token, params: { id: moveId } });
    assert.equal(listed.data.photos.length, 1);
    const url = new URL(listed.data.photos[0].url, 'http://test.local');
    const request = new Request(url);
    const response = await (file as (r: Request) => Promise<Response>)(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), JPEG);

    url.searchParams.set('sig', '0'.repeat(64));
    const forged = await (file as (r: Request) => Promise<Response>)(new Request(url));
    assert.equal(forged.status, 403);
  });

  it('only accepts each stage at the right point of the job', async () => {
    const { mover, moveId } = await assignedJob();
    assert.equal((await photo(mover, moveId, 'PICKUP')).status, 400);
    assert.equal((await photo(mover, moveId, 'DELIVERY')).status, 400);
    await advance(mover, moveId, ['EN_ROUTE']);
    assert.equal((await photo(mover, moveId, 'PICKUP')).status, 201);
    assert.equal((await photo(mover, moveId, 'DELIVERY')).status, 400);
    await advance(mover, moveId, ['LOADING', 'IN_TRANSIT', 'DELIVERED']);
    assert.equal((await photo(mover, moveId, 'PICKUP')).status, 400);
    assert.equal((await photo(mover, moveId, 'DELIVERY')).status, 201);
  });

  it('rejects a disguised file, a PDF, a bad stage and an empty upload', async () => {
    const { mover, moveId } = await assignedJob();
    await advance(mover, moveId, ['EN_ROUTE']);
    const script = new TextEncoder().encode('<script>alert(1)</script>');
    assert.equal((await photo(mover, moveId, 'PICKUP', script, 'photo.jpg')).status, 400);
    assert.equal((await photo(mover, moveId, 'PICKUP', PDF, 'photo.jpg')).status, 400);
    assert.equal((await photo(mover, moveId, 'CLAIM')).status, 422);
    assert.equal((await photo(mover, moveId, 'PICKUP', new Uint8Array(), 'a.jpg')).status, 422);
  });

  it('rejects a file over 8 MB', async () => {
    const { mover, moveId } = await assignedJob();
    await advance(mover, moveId, ['EN_ROUTE']);
    const big = new Uint8Array(8 * 1024 * 1024 + 1);
    big.set(JPEG);
    assert.equal((await photo(mover, moveId, 'PICKUP', big)).status, 422);
  });

  it("another mover cannot add to or list someone else's photos", async () => {
    const { mover, moveId } = await assignedJob();
    await advance(mover, moveId, ['EN_ROUTE']);
    const other = await createMover({ zones: ['SFA'] });
    assert.equal((await photo(other, moveId, 'PICKUP')).status, 404);
    assert.equal(
      (await call(listPhotos, { token: other.token, params: { id: moveId } })).status,
      404,
    );
  });
});

describe('item 10: earnings and payouts (M-09)', () => {
  async function delivered(price = 400) {
    const job = await assignedJob(price);
    await advance(job.mover, job.moveId, ALL_STEPS);
    return job;
  }
  const confirmAs = (actor: Account, id: string) =>
    call(confirm, { token: actor.token, params: { id }, method: 'POST' });

  it('earns nothing until the client confirms delivery', async () => {
    const { client, mover, moveId } = await delivered();
    assert.equal((await call(earnings, { token: mover.token })).data.earnings.length, 0);
    assert.equal((await confirmAs(client, moveId)).status, 200);

    const { data } = await call(earnings, { token: mover.token });
    assert.equal(data.earnings.length, 1);
    assert.equal(data.earnings[0].gross, 400);
    assert.equal(data.earnings[0].commission, 60);
    assert.equal(data.earnings[0].net, 340);
    assert.equal(data.summary.pending, 340);
    assert.equal(data.summary.completedJobs, 1);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'COMPLETED');
    const feed = await call(notifications, { token: mover.token });
    assert.equal(feed.data.notifications[0].type, 'JOB_COMPLETED');
  });

  it('uses the active pricing rule, and later changes leave past earnings alone', async () => {
    await PricingRuleModel.create({
      name: 'Test rule',
      status: 'ACTIVE',
      baseFare: 1,
      perKm: 1,
      perM3: 1,
      expressSurcharge: 0,
      minQuote: 0,
      commissionRate: 0.1,
      effectiveFrom: new Date(),
    });
    const { client, mover, moveId } = await delivered(200);
    await confirmAs(client, moveId);
    await PricingRuleModel.updateOne({ name: 'Test rule' }, { $set: { commissionRate: 0.5 } });
    const { data } = await call(earnings, { token: mover.token });
    assert.equal(data.earnings[0].commission, 20);
    assert.equal(data.earnings[0].commissionRate, 0.1);
    assert.equal(data.earnings[0].net, 180);
  });

  it('a double confirmation books one earning', async () => {
    const { client, moveId } = await delivered();
    const results = await Promise.all([confirmAs(client, moveId), confirmAs(client, moveId)]);
    assert.ok(results.some((result) => result.status === 200));
    assert.equal(await EarningModel.countDocuments({ moveId }), 1);
    assert.equal(await StatusEventModel.countDocuments({ moveId, toStatus: 'COMPLETED' }), 1);
  });

  it('only the owning client can confirm, and only after delivery', async () => {
    const { client, mover, moveId } = await assignedJob();
    const stranger = await createUser('CLIENT');
    assert.equal((await confirmAs(client, moveId)).status, 409);
    await advance(mover, moveId, ALL_STEPS);
    assert.equal((await confirmAs(stranger, moveId)).status, 404);
    assert.equal((await confirmAs(mover, moveId)).status, 403);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'DELIVERED');
  });

  it('completes by itself after 48 hours without a claim, but not sooner', async () => {
    const { mover, moveId } = await delivered();
    const setAge = (hours: number) =>
      MoveRequestModel.updateOne(
        { _id: moveId },
        { $set: { deliveredAt: new Date(Date.now() - hours * 60 * 60 * 1000) } },
      );
    await setAge(47);
    await sweep();
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'DELIVERED');
    await setAge(49);
    await Promise.all([sweep(), sweep()]);
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'COMPLETED');
    assert.equal(await EarningModel.countDocuments({ moveId }), 1);
    assert.equal((await call(earnings, { token: mover.token })).data.summary.net, 340);
  });

  it('an open dispute stops auto-completion', async () => {
    const { moveId } = await delivered();
    await MoveRequestModel.updateOne(
      { _id: moveId },
      { $set: { status: 'DISPUTED', deliveredAt: new Date(Date.now() - 72 * 60 * 60 * 1000) } },
    );
    await sweep();
    assert.equal((await MoveRequestModel.findById(moveId))?.status, 'DISPUTED');
    assert.equal(await EarningModel.countDocuments({ moveId }), 0);
  });

  it('separates pending from paid out, and only shows your own money', async () => {
    const { client, mover, moveId } = await delivered();
    await confirmAs(client, moveId);
    const other = await createMover({ zones: ['SFA'] });
    await PayoutModel.create({
      moverId: mover.id,
      amount: 100,
      method: 'TRANSFER',
      reference: 'P-1',
      paidAt: new Date(),
    });
    await PayoutModel.create({ moverId: other.id, amount: 999, paidAt: new Date() });

    const { data } = await call(earnings, { token: mover.token });
    assert.equal(data.summary.paidOut, 100);
    assert.equal(data.payouts.length, 1);
    assert.equal(data.payouts[0].reference, 'P-1');
    const theirs = await call(earnings, { token: other.token });
    assert.equal(theirs.data.summary.net, 0);
    assert.equal(theirs.data.earnings.length, 0);
  });
});
