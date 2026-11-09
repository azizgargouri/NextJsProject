/**
 * End-to-end API test of Smart Room Layout against a RUNNING app.
 *   yarn test:e2e                          → http://localhost:3000
 *   yarn test:e2e http://localhost:3001    → another server
 * Needs: `yarn db:seed` (omar.client + client demo accounts, MU-2026-DEMO01/02),
 * and a layout AI (Ollama or GROQ_API_KEY) — one step really asks it.
 * Writes to that server's database: its own "E2E …" houses are deleted again,
 * but each run books one extra move for omar.client (moves have no delete).
 */
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const PASSWORD = 'Demo#2026!';
let passed = 0;

async function call(token, method, path, body) {
  const started = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms: Date.now() - started };
}

async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    passed++;
    console.log(`  ✔ ${name} (${Date.now() - started} ms)${note ? ` — ${note}` : ''}`);
  } catch (error) {
    console.log(`  ✘ ${name}\n    ${error.message.split('\n').slice(0, 6).join('\n    ')}`);
    process.exit(1);
  }
}

async function signIn(email) {
  const r = await call(null, 'POST', '/api/auth/sign-in', { email, password: PASSWORD });
  assert.equal(r.status, 200, `sign-in ${email}: ${JSON.stringify(r.json)}`);
  return r.json.accessToken;
}

const omar = await signIn('omar.client@moveup.tn');
const amira = await signIn('client@moveup.tn');
let home, livingId, bedroomId, plan;

console.log('Smart Room Layout — E2E on', BASE);

// Leftovers from an aborted run would hold the move request link.
for (const old of (await call(omar, 'GET', '/api/homes?search=E2E&limit=50')).json.data) {
  await call(omar, 'DELETE', `/api/homes/${old.id}`);
}

await step('move requests come from real Moves (seeded DEMO01/02)', async () => {
  const r = await call(omar, 'GET', '/api/homes/move-requests');
  assert.equal(r.status, 200);
  const byRef = Object.fromEntries(r.json.moveRequests.map((m) => [m.reference, m]));
  assert.equal(byRef['MU-2026-DEMO01']?.moveDate, '2026-11-20');
  assert.equal(byRef['MU-2026-DEMO01']?.itemCount, 37);
  assert.equal(byRef['MU-2026-DEMO02']?.moveDate, '2026-12-05');
  assert.equal(byRef['MU-2026-DEMO02']?.itemCount, 14);
  return Object.keys(byRef).join(', ');
});

await step('another client does not see omar’s move requests', async () => {
  const r = await call(amira, 'GET', '/api/homes/move-requests');
  assert.equal(r.status, 200);
  assert.ok(!r.json.moveRequests.some((m) => m.reference.startsWith('MU-2026-DEMO')));
  return `amira sees: ${r.json.moveRequests.map((m) => m.reference).join(', ') || 'none'}`;
});

await step('create a house', async () => {
  const r = await call(omar, 'POST', '/api/homes', {
    label: 'E2E Sfax flat',
    city: 'Sfax',
    type: 'APARTMENT',
    floor: 2,
    hasElevator: true,
    notes: '',
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  home = r.json.home;
  assert.equal(home.rooms.length, 0);
  return home.id;
});

await step('add rooms (with doors/windows)', async () => {
  const rooms = [
    {
      name: 'Living room',
      type: 'LIVING',
      widthCm: 520,
      lengthCm: 420,
      notes: '',
      openings: [
        { kind: 'DOOR', wall: 'S', offsetCm: 40, widthCm: 90 },
        { kind: 'WINDOW', wall: 'N', offsetCm: 150, widthCm: 160 },
      ],
    },
    {
      name: 'Bedroom',
      type: 'BEDROOM',
      widthCm: 400,
      lengthCm: 380,
      notes: '',
      openings: [{ kind: 'DOOR', wall: 'W', offsetCm: 20, widthCm: 80 }],
    },
    { name: 'Kitchen', type: 'KITCHEN', widthCm: 320, lengthCm: 300, notes: '', openings: [] },
    { name: 'Office', type: 'OFFICE', widthCm: 300, lengthCm: 280, notes: '', openings: [] },
    { name: 'Temp room', type: 'STORAGE', widthCm: 150, lengthCm: 150, notes: '', openings: [] },
  ];
  for (const room of rooms) {
    const r = await call(omar, 'POST', `/api/homes/${home.id}/rooms`, room);
    assert.equal(r.status, 201, `${room.name}: ${JSON.stringify(r.json)}`);
    home = r.json.home;
  }
  assert.equal(home.rooms.length, 5);
  livingId = home.rooms.find((room) => room.name === 'Living room').id;
  bedroomId = home.rooms.find((room) => room.name === 'Bedroom').id;
  return `${home.rooms.length} rooms, ${home.totalAreaM2} m²`;
});

await step('reject an opening that does not fit its wall', async () => {
  const r = await call(omar, 'POST', `/api/homes/${home.id}/rooms`, {
    name: 'Bad room',
    type: 'OTHER',
    widthCm: 200,
    lengthCm: 200,
    notes: '',
    openings: [{ kind: 'DOOR', wall: 'N', offsetCm: 150, widthCm: 90 }],
  });
  assert.equal(r.status, 422, JSON.stringify(r.json));
  return r.json.details.fieldErrors.openings[0];
});

await step('edit a room, then delete one', async () => {
  const kitchen = home.rooms.find((room) => room.name === 'Kitchen');
  const edit = await call(omar, 'PATCH', `/api/homes/${home.id}/rooms/${kitchen.id}`, {
    ...kitchen,
    name: 'Kitchen + dining',
    type: 'DINING',
    widthCm: 380,
    openings: [],
  });
  assert.equal(edit.status, 200, JSON.stringify(edit.json));
  assert.ok(
    edit.json.home.rooms.some((room) => room.name === 'Kitchen + dining' && room.widthCm === 380),
  );
  const temp = edit.json.home.rooms.find((room) => room.name === 'Temp room');
  const del = await call(omar, 'DELETE', `/api/homes/${home.id}/rooms/${temp.id}`);
  assert.equal(del.status, 200, JSON.stringify(del.json));
  home = del.json.home;
  assert.equal(home.rooms.length, 4);
});

await step('another client cannot read or edit omar’s house', async () => {
  assert.equal((await call(amira, 'GET', `/api/homes/${home.id}`)).status, 404);
  assert.equal(
    (await call(amira, 'PATCH', `/api/homes/${home.id}`, { label: 'hacked' })).status,
    404,
  );
  assert.equal((await call(amira, 'GET', `/api/homes/${home.id}/layout`)).status, 404);
});

await step('link move request DEMO02 → house shows items + footprints', async () => {
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}`, { moveReference: 'mu-2026-demo02' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  home = r.json.home;
  assert.equal(home.moveReference, 'MU-2026-DEMO02');
  assert.equal(home.moveRequest.items.length, 6);
  assert.equal(home.moveRequest.totals.itemCount, 14);
  assert.ok(home.moveRequest.items.every((item) => item.footprint.widthCm > 0));
  return `${home.moveRequest.totals.volumeM3} m³, ${home.moveRequest.totals.weightKg} kg`;
});

await step('picker marks DEMO02 as linked to this house', async () => {
  const r = await call(omar, 'GET', '/api/homes/move-requests');
  assert.equal(
    r.json.moveRequests.find((m) => m.reference === 'MU-2026-DEMO02').linkedHome.id,
    home.id,
  );
});

await step('same request cannot be linked to a 2nd house (409); someone else’s → 404', async () => {
  const other = await call(omar, 'POST', '/api/homes', {
    label: 'E2E second',
    city: 'Tunis',
    type: 'STUDIO',
  });
  assert.equal(other.status, 201);
  const dup = await call(omar, 'PATCH', `/api/homes/${other.json.home.id}`, {
    moveReference: 'MU-2026-DEMO02',
  });
  assert.equal(dup.status, 409, JSON.stringify(dup.json));
  const foreign = await call(omar, 'PATCH', `/api/homes/${other.json.home.id}`, {
    moveReference: 'MU-2026-004281',
  });
  assert.equal(foreign.status, 404, JSON.stringify(foreign.json));
  assert.equal((await call(omar, 'DELETE', `/api/homes/${other.json.home.id}`)).status, 200);
});

await step('no layout yet → 404', async () => {
  assert.equal((await call(omar, 'GET', `/api/homes/${home.id}/layout`)).status, 404);
});

await step('generate the AI furniture layout', async () => {
  const r = await call(omar, 'POST', `/api/homes/${home.id}/layout`);
  assert.equal(r.status, 201, JSON.stringify(r.json));
  plan = r.json.plan;
  const roomIds = new Set(home.rooms.map((room) => room.id));
  assert.ok(plan.placements.length > 0, 'no placements');
  for (const p of plan.placements) {
    const room = home.rooms.find((candidate) => candidate.id === p.roomId);
    assert.ok(roomIds.has(p.roomId), `unknown room ${p.roomId}`);
    assert.ok(
      p.x >= 0 && p.y >= 0 && p.x + p.w <= room.widthCm && p.y + p.h <= room.lengthCm,
      `${p.name} outside ${room.name}`,
    );
  }
  // no two items overlap in the same room
  for (const a of plan.placements)
    for (const b of plan.placements) {
      if (a === b || a.roomId !== b.roomId) continue;
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${a.name} overlaps ${b.name}`);
    }
  const tried = plan.attempts.map((a) => `${a.provider}:${a.ok ? 'ok' : a.error}`).join(' → ');
  return `${plan.placements.length} placed, ${plan.unplaced.length} unplaced, by ${plan.provider}/${plan.model} in ${r.ms} ms [${tried}]`;
});

await step('GET returns the saved plan; regenerate replaces it', async () => {
  const r = await call(omar, 'GET', `/api/homes/${home.id}/layout`);
  assert.equal(r.status, 200);
  assert.equal(r.json.plan.createdAt, plan.createdAt);
  assert.equal(r.json.plan.stale, false);
  // "same input → reuse saved plan" is planned in Step 5 (not built yet): today every POST asks the AI.
  const again = await call(omar, 'POST', `/api/homes/${home.id}/layout`);
  assert.equal(again.status, 201, JSON.stringify(again.json));
  assert.ok(again.json.plan.placements.length > 0);
  plan = again.json.plan;
  return `regenerated in ${again.ms} ms (${plan.placements.length} placed)`;
});

await step('manual edit: rotate an item', async () => {
  const target = plan.placements.find((p) => p.w !== p.h) ?? plan.placements[0];
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/layout`, {
    action: 'rotate',
    unitId: target.unitId,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = r.json.plan.placements.find((p) => p.unitId === target.unitId);
  assert.equal(after.rotated, !target.rotated);
  assert.equal(after.source, 'client');
  plan = r.json.plan;
  return `${target.name}: ${target.w}×${target.h} → ${after.w}×${after.h}`;
});

await step('manual edit: drag an item to an exact free spot (place)', async () => {
  const target = plan.placements[plan.placements.length - 1];
  const room = home.rooms.find((candidate) => candidate.id === target.roomId);
  // scan the room for a free rectangle of the item's size
  // Server rules: 5 cm gap to other items, never on a door's swing square.
  const GAP = 5;
  const blocked = [
    ...plan.placements
      .filter((p) => p.roomId === room.id && p.unitId !== target.unitId)
      .map((p) => ({ x: p.x - GAP, y: p.y - GAP, w: p.w + 2 * GAP, h: p.h + 2 * GAP })),
    ...room.openings
      .filter((o) => o.kind === 'DOOR')
      .map(({ wall, offsetCm: o, widthCm: s }) =>
        wall === 'N'
          ? { x: o, y: 0, w: s, h: s }
          : wall === 'S'
            ? { x: o, y: room.lengthCm - s, w: s, h: s }
            : wall === 'W'
              ? { x: 0, y: o, w: s, h: s }
              : { x: room.widthCm - s, y: o, w: s, h: s },
      ),
  ];
  let spot = null;
  for (let y = 0; y + target.h <= room.lengthCm && !spot; y += 10)
    for (let x = 0; x + target.w <= room.widthCm && !spot; x += 10)
      if (
        !blocked.some(
          (b) => x < b.x + b.w && b.x < x + target.w && y < b.y + b.h && b.y < y + target.h,
        )
      )
        spot = { x, y };
  assert.ok(spot, 'no free spot found to drag to');
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/layout`, {
    action: 'place',
    unitId: target.unitId,
    roomId: room.id,
    x: spot.x,
    y: spot.y,
    w: target.w,
    h: target.h,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const after = r.json.plan.placements.find((p) => p.unitId === target.unitId);
  assert.deepEqual([after.x, after.y], [spot.x, spot.y]);
  plan = r.json.plan;
  return `${target.name} → (${spot.x}, ${spot.y}) in ${room.name}`;
});

await step('manual edit: dropping onto another item is refused', async () => {
  const shared = plan.placements.find((p) =>
    plan.placements.some((q) => q !== p && q.roomId === p.roomId),
  );
  const [a, b] = plan.placements.filter((p) => p.roomId === shared?.roomId);
  if (!a || !b) return 'skipped: no room with 2 items';
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/layout`, {
    action: 'place',
    unitId: a.unitId,
    roomId: b.roomId,
    x: b.x,
    y: b.y,
    w: a.w,
    h: a.h,
  });
  assert.ok(r.status >= 400 && r.status < 500, `expected 4xx, got ${r.status}`);
  return `${r.status} ${r.json?.message ?? ''}`;
});

await step('manual edit: move to a room + wall (menu)', async () => {
  const target = plan.placements.find((p) => p.roomId !== bedroomId) ?? plan.placements[0];
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/layout`, {
    action: 'move',
    unitId: target.unitId,
    roomId: livingId,
    wall: 'CENTER',
  });
  assert.ok([200, 409, 422].includes(r.status), JSON.stringify(r.json));
  if (r.status !== 200) return `no room on that wall: ${r.json?.message}`;
  plan = r.json.plan;
  return `${target.name} → Living room`;
});

await step('manual edit: take an item out → listed as removed by client', async () => {
  const target = plan.placements[0];
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/layout`, {
    action: 'remove',
    unitId: target.unitId,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  plan = r.json.plan;
  assert.ok(plan.unplaced.some((u) => u.unitId === target.unitId && u.removedByClient));
  return `manualChanges = ${plan.manualChanges}`;
});

await step('changing a room marks the plan stale', async () => {
  const office = home.rooms.find((room) => room.name === 'Office');
  const r = await call(omar, 'PATCH', `/api/homes/${home.id}/rooms/${office.id}`, {
    ...office,
    widthCm: 310,
  });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const g = await call(omar, 'GET', `/api/homes/${home.id}/layout`);
  assert.equal(g.json.plan.stale, true);
});

await step('booking a move with a date → shows up in the picker with that date', async () => {
  const r = await call(omar, 'POST', '/api/moves', {
    pickupAddress: '1 Rue E2E, Tunis',
    destinationAddress: '2 Rue E2E, Sousse',
    distance: 140,
    moveDate: '2026-12-24',
    items: [{ id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 }],
  });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  const ref = r.json.move.reference;
  const list = await call(omar, 'GET', '/api/homes/move-requests');
  assert.equal(list.json.moveRequests[0].reference, ref, 'newest first');
  assert.equal(list.json.moveRequests[0].moveDate, '2026-12-24');
  return ref;
});

await step('delete the layout plan, unlink, delete the house', async () => {
  assert.equal((await call(omar, 'DELETE', `/api/homes/${home.id}/layout`)).status, 200);
  assert.equal((await call(omar, 'GET', `/api/homes/${home.id}/layout`)).status, 404);
  const unlink = await call(omar, 'PATCH', `/api/homes/${home.id}`, { moveReference: null });
  assert.equal(unlink.json.home.moveRequest, null);
  assert.equal((await call(omar, 'DELETE', `/api/homes/${home.id}`)).status, 200);
  assert.equal((await call(omar, 'GET', `/api/homes/${home.id}`)).status, 404);
});

await step('unauthenticated access is refused', async () => {
  assert.equal((await call(null, 'GET', '/api/homes')).status, 401);
  assert.equal((await call(null, 'GET', '/api/homes/move-requests')).status, 401);
});

console.log(`\n${passed} steps passed`);
