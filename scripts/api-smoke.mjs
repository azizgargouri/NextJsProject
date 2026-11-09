#!/usr/bin/env node
/**
 * API smoke test — calls every route under app/api as four users (anonymous,
 * client, mover, admin) against a running server, and reports:
 *   - any 5xx (a crash: always a failure);
 *   - private routes that answer 2xx to an anonymous caller.
 * Writes are sent with an empty JSON body, so they exercise guards and
 * validation without changing data. Routes that would change real state even
 * with an empty body are skipped (see SKIP).
 *
 *   yarn dev            # in another terminal (or BASE_URL=https://…)
 *   yarn test:api
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const API_DIR = path.resolve('app/api');
const ACCOUNTS = {
  client: ['client@moveup.tn', 'Demo#2026!'],
  mover: ['mover@moveup.tn', 'Demo#2026!'],
  admin: ['admin@moveup.tn', process.env.ADMIN_PASSWORD ?? 'Admin#2026!'],
};

/** Mutations that act even with an empty body, or end the session used here. */
const SKIP = new Set([
  'POST /api/auth/sign-out',
  'POST /api/auth/refresh',
  'POST /api/admin/playground',
  'DELETE /api/account/sessions',
  'DELETE /api/account/avatar',
  'POST /api/account/notifications/read',
  'PATCH /api/mover/notifications',
  'POST /api/ai/chat',
  'DELETE /api/ai/chat',
]);

/** Routes meant to be public (no sign-in). */
const PUBLIC = [
  /^\/api\/auth\//,
  /^\/api\/estimate\//,
  /^\/api\/movers(\/|$)/,
  /^\/api\/files\//,
  /^\/api\/ai\/movers\//,
  /^\/api\/contracts\/documents\/[^/]+$/,
  /^\/api\/moves\/[^/]+$/, // tracking by reference + token
  /^\/api\/health/,
];

const FAKE_ID = '000000000000000000000000';

function routes(dir, prefix = '/api') {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...routes(full, `${prefix}/${entry}`));
    } else if (entry === 'route.ts') {
      const source = readFileSync(full, 'utf8');
      const methods = [
        ...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/g),
      ].map((match) => match[1]);
      found.push({ pattern: prefix, methods: [...new Set(methods)] });
    }
  }
  return found;
}

async function signIn([email, password]) {
  const response = await fetch(`${BASE}/api/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Sign-in failed for ${email}: ${response.status}`);
  return (await response.json()).accessToken;
}

async function json(url, token) {
  const response = await fetch(`${BASE}${url}`, { headers: { authorization: `Bearer ${token}` } });
  return response.ok ? response.json() : null;
}

/** Real ids where the data has them, so dynamic routes run their happy path too. */
async function sampleIds(tokens) {
  const ids = {};
  const moves = await json('/api/moves', tokens.client);
  const firstMove = moves?.moves?.[0];
  ids.move = firstMove?.id;
  ids.quote = firstMove?.quotes?.[0]?.id;
  const claims = await json('/api/admin/claims?limit=1', tokens.admin);
  ids.claim = claims?.data?.[0]?.id;
  const reviews = await json('/api/admin/reviews?limit=1', tokens.admin);
  ids.review = reviews?.data?.[0]?.id;
  const homes = await json('/api/homes', tokens.client);
  ids.home = (homes?.data ?? homes?.homes ?? [])[0]?.id;
  const users = await json('/api/admin/users?limit=1', tokens.admin);
  ids.user = users?.data?.[0]?.id;
  const jobs = await json('/api/mover/jobs', tokens.mover);
  ids.job = (jobs?.active ?? jobs?.jobs ?? jobs?.data ?? [])[0]?.id;
  const offers = await json('/api/mover/offers', tokens.mover);
  ids.offer = (offers?.offers ?? offers?.open ?? [])[0]?.id;
  const me = await json('/api/auth/me', tokens.mover);
  ids.moverUser = me?.user?.id;
  return ids;
}

function fill(pattern, ids) {
  return pattern.replace(/\[([^\]]+)\]/g, (_, name) => {
    if (pattern.includes('/claims/') && name === 'id') return ids.claim ?? FAKE_ID;
    if (pattern.includes('/reviews/') && name === 'id') return ids.review ?? FAKE_ID;
    if (pattern.includes('/homes/') && name === 'id') return ids.home ?? FAKE_ID;
    if (pattern.includes('/users/') && name === 'id') return ids.user ?? FAKE_ID;
    if (pattern.includes('/mover/jobs/') && name === 'id') return ids.job ?? FAKE_ID;
    if (pattern.includes('/mover/offers/') && name === 'id') return ids.offer ?? FAKE_ID;
    if (pattern.includes('/movers/') && name === 'id') return ids.moverUser ?? FAKE_ID;
    if (pattern.includes('/moves/') && name === 'id') return ids.move ?? FAKE_ID;
    if (name === 'quoteId') return ids.quote ?? FAKE_ID;
    if (name === 'userId') return ids.user ?? FAKE_ID;
    return FAKE_ID;
  });
}

async function call(method, url, token) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${url}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      },
      body: method === 'GET' ? undefined : '{}',
      redirect: 'manual',
      signal: AbortSignal.timeout(60_000),
    });
    await response.arrayBuffer().catch(() => null);
    return { status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { status: 0, ms: Date.now() - started, error: error.message };
  }
}

const tokens = Object.fromEntries(
  await Promise.all(
    Object.entries(ACCOUNTS).map(async ([role, account]) => [role, await signIn(account)]),
  ),
);
const ids = await sampleIds(tokens);
const all = routes(API_DIR).sort((a, b) => a.pattern.localeCompare(b.pattern));

const failures = [];
const warnings = [];
let calls = 0;
console.log(`API smoke test against ${BASE}: ${all.length} routes\n`);
for (const route of all) {
  for (const method of route.methods) {
    const key = `${method} ${route.pattern}`;
    if (SKIP.has(key)) {
      console.log(`  skip  ${key}`);
      continue;
    }
    const url = fill(route.pattern, ids);
    const results = {};
    for (const [role, token] of [['anon', null], ...Object.entries(tokens)]) {
      results[role] = await call(method, url, token);
      calls += 1;
    }
    // 502/503 mean an external dependency is down (bucket, voice service, AI): a warning, not a crash.
    const crashed = Object.entries(results).filter(
      ([, result]) =>
        (result.status >= 500 && result.status !== 502 && result.status !== 503) ||
        result.status === 0,
    );
    const degraded = Object.entries(results).filter(
      ([, result]) => result.status === 502 || result.status === 503,
    );
    const isPublic = PUBLIC.some((pattern) => pattern.test(route.pattern));
    const openToAnon =
      !isPublic && method !== 'GET' ? false : !isPublic && results.anon.status < 300;
    const line = Object.entries(results)
      .map(([role, result]) => `${role} ${result.status || 'ERR'}`)
      .join(' · ');
    const flag = crashed.length ? 'FAIL' : openToAnon ? 'OPEN' : degraded.length ? 'DOWN' : ' ok ';
    console.log(`  ${flag}  ${key.padEnd(52)} ${line}`);
    if (crashed.length)
      failures.push(
        `${key}: ${crashed.map(([role, r]) => `${role} ${r.status || r.error}`).join(', ')}`,
      );
    if (openToAnon) failures.push(`${key}: answers ${results.anon.status} without sign-in`);
    if (!crashed.length && degraded.length)
      warnings.push(
        `${key}: dependency down (${degraded.map(([role, r]) => `${role} ${r.status}`).join(', ')})`,
      );
  }
}

console.log(
  `\n${calls} calls, ${failures.length} problem(s), ${warnings.length} dependency warning(s)`,
);
for (const failure of failures) console.log(`  - ${failure}`);
for (const warning of warnings) console.log(`  ~ ${warning}`);
process.exitCode = failures.length ? 1 : 0;
