#!/usr/bin/env node
/**
 * Client ↔ mover sync check. Runs one booking through the whole flow against a
 * running server and, after every step, compares what the client, the mover and
 * the admin see. Each mismatch is reported; exit code 1 when any is found.
 *
 *   yarn dev          # in another terminal
 *   yarn test:flow    # or BASE_URL=https://… yarn test:flow
 *
 * Uses client@moveup.tn and mover@moveup.tn (yarn db:seed, mover zone Tunis).
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9,
]);
const problems = [];
let step = '';

const check = (condition, message) => {
  console.log(`    ${condition ? 'ok  ' : 'FAIL'} ${message}`);
  if (!condition) problems.push(`${step}: ${message}`);
};

async function api(method, path, token, body) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function signIn(email, password) {
  const { status, data } = await api('POST', '/api/auth/sign-in', '', { email, password });
  if (status !== 200) throw new Error(`Sign-in failed for ${email} (${status})`);
  return data.accessToken;
}

const client = await signIn('client@moveup.tn', 'Demo#2026!');
const mover = await signIn('mover@moveup.tn', 'Demo#2026!');
const admin = await signIn('admin@moveup.tn', process.env.ADMIN_PASSWORD ?? 'Admin#2026!');
const moverProfile = (await api('GET', '/api/mover/profile', mover)).data.profile;
const moverId = (await api('GET', '/api/auth/me', mover)).data.user.id;

/** A day this mover has no job yet (the dispatch never books a mover twice a day). */
const jobs = (await api('GET', '/api/mover/jobs', mover)).data;
const busy = new Set(
  Object.values(jobs)
    .filter(Array.isArray)
    .flat()
    .map((job) => job.moveDate),
);
let offset = 20;
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
while (busy.has(day(offset))) offset += 1;
const moveDate = day(offset);

const views = async (id) => ({
  client: (await api('GET', `/api/moves/${id}`, client)).data.move,
  job: (await api('GET', `/api/mover/jobs/${id}`, mover)).data?.job,
  admin: ((await api('GET', '/api/moves', admin)).data.moves ?? []).find((move) => move.id === id),
});

// 1 ── the client books
step = '1 booking';
console.log(`\n${step} (${moveDate})`);
const booked = await api('POST', '/api/moves', client, {
  pickupAddress: '18 Rue de Marseille, Tunis',
  destinationAddress: 'Résidence Jasmin, Lac 2, Tunis',
  distance: 9,
  moveDate,
  timeSlot: 'MORNING',
  items: [
    { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
    { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
    { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 8 },
  ],
});
check(booked.status === 201 || booked.status === 200, `booking accepted (${booked.status})`);
const created = booked.data.move ?? booked.data;
const id = created.id;
const reference = created.reference;
let v = await views(id);
check(
  v.client.status === 'QUOTING',
  `client sees the request out to movers (status ${v.client.status})`,
);
check(v.client.currentStage === 'CONFIRMED', `client timeline at "${v.client.stages?.[0]?.title}"`);
const offers = (await api('GET', '/api/mover/offers', mover)).data.offers ?? [];
const offer = offers.find((entry) => entry.move?.reference === reference);
check(Boolean(offer), `mover received the offer for ${reference}`);
check(
  offer?.move?.moveDate === moveDate,
  `offer day matches the booking (${offer?.move?.moveDate})`,
);
check(
  offer?.move?.estimatedPrice === v.client.estimatedPrice,
  `offer price matches the client's estimate (${offer?.move?.estimatedPrice} / ${v.client.estimatedPrice})`,
);
check(
  !JSON.stringify(offer?.move ?? {}).includes('Rue de Marseille'),
  'offer hides the client street address before acceptance',
);
check(v.admin?.status === 'QUOTING', `admin sees it awaiting a mover (${v.admin?.status})`);
check(
  v.client.offersSent >= 1,
  `after a reload the client still sees movers notified (${v.client.offersSent})`,
);

// 1b ── a day no mover is free: the client must be told, not left waiting
step = '1b no mover free';
console.log(`\n${step}`);
const farDay = day(120); // beyond every mover's published availability
const lonely = await api('POST', '/api/moves', client, {
  pickupAddress: '2 Rue de Rome, Tunis',
  destinationAddress: '9 Rue de Rome, Tunis',
  distance: 2,
  moveDate: farDay,
  items: [{ id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 4 }],
});
const lonelyMove = (await api('GET', `/api/moves/${(lonely.data.move ?? lonely.data).id}`, client))
  .data.move;
check(lonelyMove.offersSent === 0, `no offer sent for ${farDay} (${lonelyMove.offersSent})`);
check(
  lonelyMove.stages?.[0]?.title === 'No mover available yet',
  `client told "${lonelyMove.stages?.[0]?.title}"`,
);

// 2 ── the mover sends a quote, the client accepts it
step = '2 quote';
console.log(`\n${step}`);
const quoteAmount = Math.round(created.estimatedPrice * 1.1);
const quoted = await api('POST', `/api/mover/offers/${offer.id}/respond`, mover, {
  action: 'QUOTE',
  amount: quoteAmount,
  message: 'Two helpers included.',
});
check(quoted.status === 200, `mover quote sent (${quoted.status})`);
v = await views(id);
const quote = v.client.quotes?.find((entry) => entry.status === 'SENT');
check(quote?.amount === quoteAmount, `client sees the quote of ${quote?.amount} TND`);
check(
  quote?.moverName === moverProfile.companyName,
  `quote shows the mover company (${quote?.moverName})`,
);
const accepted = await api('POST', `/api/moves/${id}/quotes/${quote.id}/accept`, client);
check(accepted.status === 200, `client accepted the quote (${accepted.status})`);
v = await views(id);
check(
  v.client.status === 'ASSIGNED' && v.job?.status === 'ASSIGNED',
  `both see ASSIGNED (client ${v.client.status}, mover ${v.job?.status})`,
);
check(
  v.client.estimatedPrice === quoteAmount && v.job?.finalPrice === quoteAmount,
  `both see the agreed price ${quoteAmount} (client ${v.client.estimatedPrice}, mover ${v.job?.finalPrice})`,
);
check(
  v.client.mover.userId === moverId && v.client.mover.phone !== '',
  `client sees the mover and their phone (${v.client.mover.companyName} ${v.client.mover.phone})`,
);
check(
  Boolean(v.job?.client?.phone),
  `mover now sees the client contact (${v.job?.client?.name} ${v.job?.client?.phone})`,
);
const stillOffered = ((await api('GET', '/api/mover/offers', mover)).data.offers ?? []).some(
  (entry) => entry.move?.reference === reference,
);
check(!stillOffered, "the offer left the mover's open offers");
check(
  v.admin?.mover?.userId === moverId,
  `admin sees the assigned mover (${v.admin?.mover?.companyName})`,
);

// 3 ── they talk
step = '3 messages';
console.log(`\n${step}`);
const fromMover = await api('POST', `/api/moves/${id}/messages`, mover, {
  thread: 'MOVER_CLIENT',
  body: 'We will be there at 9:00.',
});
check(
  fromMover.status === 201 || fromMover.status === 200,
  `mover sent a message (${fromMover.status})`,
);
const clientThread =
  (await api('GET', `/api/moves/${id}/messages?thread=MOVER_CLIENT`, client)).data.messages ?? [];
check(
  clientThread.some((message) => message.body === 'We will be there at 9:00.'),
  'client receives it',
);
await api('POST', `/api/moves/${id}/messages`, client, {
  thread: 'MOVER_CLIENT',
  body: 'Perfect, the code is 4471.',
});
const moverThread =
  (await api('GET', `/api/moves/${id}/messages?thread=MOVER_CLIENT`, mover)).data.messages ?? [];
check(
  moverThread.some((message) => message.body === 'Perfect, the code is 4471.'),
  'mover receives the reply',
);

// 4 ── the mover reports each step
const expect = async (label, stage, status) => {
  v = await views(id);
  check(
    v.client.currentStage === stage,
    `client timeline at ${stage} (${v.client.currentStage}) after ${label}`,
  );
  check(v.job?.status === status, `mover job ${status} (${v.job?.status})`);
  const done = (v.client.stages ?? [])
    .filter((entry) => entry.completedAt)
    .map((entry) => entry.key);
  check(done.includes(stage), `${stage} is dated on the client timeline`);
};
step = '4 en route';
console.log(`\n${step}`);
check(
  (await api('POST', `/api/mover/jobs/${id}/status`, mover, { action: 'EN_ROUTE' })).status === 200,
  'mover: on the way',
);
await expect('en route', 'EN_ROUTE', 'EN_ROUTE');

step = '5 loading';
console.log(`\n${step}`);
check(
  (await api('POST', `/api/mover/jobs/${id}/status`, mover, { action: 'LOADING' })).status === 200,
  'mover: loading',
);
await expect('loading', 'LOADING', 'IN_PROGRESS');
for (let i = 0; i < 4; i += 1) {
  const form = new FormData();
  form.set('stage', 'LOAD');
  form.set('file', new File([JPEG], `load-${i + 1}.jpg`, { type: 'image/jpeg' }));
  await api('POST', `/api/mover/jobs/${id}/photos`, mover, form);
}
check(
  (await api('POST', `/api/mover/jobs/${id}/load-check`, mover, { furniture: 2, confirmed: true }))
    .status === 200,
  'mover: load confirmed',
);

step = '6 in transit';
console.log(`\n${step}`);
check(
  (await api('POST', `/api/mover/jobs/${id}/status`, mover, { action: 'IN_TRANSIT' })).status ===
    200,
  'mover: in transit',
);
await expect('in transit', 'IN_TRANSIT', 'IN_PROGRESS');

step = '7 delivered';
console.log(`\n${step}`);
const proof = new FormData();
proof.set('stage', 'DELIVERY');
proof.set('file', new File([JPEG], 'delivered.jpg', { type: 'image/jpeg' }));
await api('POST', `/api/mover/jobs/${id}/photos`, mover, proof);
check(
  (await api('POST', `/api/mover/jobs/${id}/status`, mover, { action: 'DELIVERED' })).status ===
    200,
  'mover: delivered',
);
await expect('delivery', 'DELIVERY', 'DELIVERED');

// 5 ── the client confirms
step = '8 client confirms';
console.log(`\n${step}`);
const earningsBefore = (await api('GET', '/api/mover/earnings', mover)).data.summary;
check(
  (await api('PATCH', `/api/moves/${id}`, client, { stage: 'COMPLETED' })).status === 200,
  'client confirmed delivery',
);
await expect('confirmation', 'COMPLETED', 'COMPLETED');
const earningsAfter = (await api('GET', '/api/mover/earnings', mover)).data.summary;
check(
  Math.round((earningsAfter.gross - earningsBefore.gross) * 100) === quoteAmount * 100,
  `mover earning added for the agreed price (+${(earningsAfter.gross - earningsBefore.gross).toFixed(2)} gross)`,
);
v = await views(id);
check(v.admin?.status === 'COMPLETED', `admin sees it completed (${v.admin?.status})`);
const homes = (await api('GET', '/api/homes/move-requests', client)).data.moveRequests ?? [];
check(
  homes.some((entry) => entry.reference === reference),
  'smart rooms lists the booking',
);

console.log(
  `\n${reference}: ${problems.length ? `${problems.length} mismatch(es)` : 'client, mover and admin stayed in sync at every step'}`,
);
for (const problem of problems) console.log(`  - ${problem}`);
process.exitCode = problems.length ? 1 : 0;
