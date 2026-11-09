/*
 * Runs the whole app on this machine with no internet: `npm run offline`.
 *
 * - Creates .env on first run.
 * - Uses the local MongoDB if it is already running, otherwise starts one with
 *   its data in .offline/db.
 * - Seeds the demo accounts only when the database has no users, because the
 *   seeds overwrite admin-edited content and reset the test accounts.
 * - Builds into .next-offline when the source or .env changed, then serves that
 *   build on every network address, so phones on the same Wi-Fi can open it.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD_DIR = '.next-offline';
const BUILD_STAMP = path.join(ROOT, BUILD_DIR, 'offline-build.json');
const MONGO_DATA_DIR = path.join(ROOT, '.offline', 'db');
const SOURCE_PATHS = [
  'app',
  'components',
  'hooks',
  'lib',
  'public',
  'server',
  'styles',
  'types',
  'next.config.ts',
  'package.json',
  'postcss.config.mjs',
  'tsconfig.json',
  '.env',
];
const MONGO_START_TIMEOUT_MS = 30_000;
const MONGO_POLL_MS = 250;

const children = new Set();
let shuttingDown = false;

class OfflineError extends Error {}

function log(message) {
  console.log(`[offline] ${message}`);
}

function ensureEnvFile() {
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) return;
  const template = readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  const secret = randomBytes(32).toString('hex');
  writeFileSync(envFile, template.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${secret}`));
  log('Created .env with a new JWT secret.');
}

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: ROOT, env, stdio: 'inherit' });
    children.add(child);
    child.once('error', reject);
    child.once('exit', (code) => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new OfflineError(`${path.basename(command)} ${args[0]} failed (${code})`));
    });
  });
}

const bin = (name) => path.join(ROOT, 'node_modules', '.bin', name);

function portIsOpen(host, port) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function ensureMongo(uri) {
  const { hostname, port: rawPort } = new URL(uri);
  const port = Number(rawPort) || 27017;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new OfflineError(`MONGODB_URI points at ${hostname}, which needs the internet.`);
  }
  if (await portIsOpen(hostname, port)) {
    log(`Using the MongoDB already running on port ${port}.`);
    return;
  }

  mkdirSync(MONGO_DATA_DIR, { recursive: true });
  log(`Starting MongoDB on port ${port} (data in .offline/db).`);
  const mongod = spawn(
    process.env.MONGOD_PATH || 'mongod',
    ['--dbpath', MONGO_DATA_DIR, '--port', String(port), '--bind_ip', '127.0.0.1', '--quiet'],
    { cwd: ROOT, stdio: 'ignore' },
  );
  const failed = new Promise((_, reject) => {
    mongod.once('error', () =>
      reject(new OfflineError('mongod was not found. Install MongoDB or set MONGOD_PATH.')),
    );
    mongod.once('exit', (code) =>
      reject(new OfflineError(`mongod stopped during startup (${code}).`)),
    );
  });
  children.add(mongod);

  const ready = (async () => {
    const deadline = Date.now() + MONGO_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await portIsOpen(hostname, port)) return;
      await new Promise((resolve) => setTimeout(resolve, MONGO_POLL_MS));
    }
    throw new OfflineError('mongod did not start in time.');
  })();
  await Promise.race([ready, failed]);
  mongod.once('exit', () => {
    children.delete(mongod);
    if (!shuttingDown) {
      log('MongoDB stopped. The app cannot reach its data until you restart this command.');
    }
  });
}

async function seedIfEmpty(uri, dbName) {
  const connection = await mongoose.createConnection(uri, { dbName }).asPromise();
  const users = await connection.collection('users').countDocuments();
  await connection.close();
  if (users > 0) {
    log(`Database has ${users} users, skipping the seed.`);
    return;
  }

  log('Empty database, adding the demo accounts.');
  await run(bin('tsx'), ['server/seed.ts']);
}

function newestChange(target) {
  const stats = statSync(target);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(target).reduce(
    (newest, entry) => Math.max(newest, newestChange(path.join(target, entry))),
    stats.mtimeMs,
  );
}

function buildIsCurrent() {
  if (!existsSync(BUILD_STAMP)) return false;
  const stamp = JSON.parse(readFileSync(BUILD_STAMP, 'utf8'));
  const newestSource = Math.max(
    ...SOURCE_PATHS.map((entry) => newestChange(path.join(ROOT, entry))),
  );
  return newestSource <= stamp.builtAt;
}

/**
 * `next build` points next-env.d.ts at its own output folder. Pointing it back
 * at .next keeps lint and the type checker working when .next-offline is gone.
 */
function pointTypesBackAtDevBuild() {
  const file = path.join(ROOT, 'next-env.d.ts');
  if (!existsSync(file)) return;
  const content = readFileSync(file, 'utf8');
  writeFileSync(file, content.replaceAll(`./${BUILD_DIR}/`, './.next/'));
}

/** Addresses a phone on the same network can use to reach this computer. */
function wifiAddresses(port) {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => `http://${address.address}:${port}`);
}

async function main() {
  ensureEnvFile();
  process.loadEnvFile(path.join(ROOT, '.env'));

  const port = Number(process.env.PORT) || 3000;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new OfflineError('MONGODB_URI is missing from .env.');

  if (await portIsOpen('localhost', port)) {
    throw new OfflineError(
      `Port ${port} is already in use. Stop that server, or run: PORT=3100 npm run offline`,
    );
  }

  await ensureMongo(uri);
  await seedIfEmpty(uri, process.env.MONGODB_DB_NAME || 'moveup');

  const baseUrl = `http://localhost:${port}`;
  // The browser calls the API on whatever address it opened, so this is only the
  // server-side default.
  const appEnv = {
    ...process.env,
    COOKIE_SECURE: 'false',
    NEXT_DIST_DIR: BUILD_DIR,
    NEXT_PUBLIC_BASE_URL: baseUrl,
    NEXT_TELEMETRY_DISABLED: '1',
  };

  if (buildIsCurrent()) {
    log('Build is up to date.');
  } else {
    log('Building the app (about a minute).');
    const builtAt = Date.now();
    try {
      await run(bin('next'), ['build'], appEnv);
    } finally {
      pointTypesBackAtDevBuild();
    }
    writeFileSync(BUILD_STAMP, JSON.stringify({ builtAt }));
  }

  log(`Open ${baseUrl}  (press Ctrl+C to stop)`);
  for (const address of wifiAddresses(port)) log(`On a phone on the same Wi-Fi: ${address}`);
  await run(bin('next'), ['start', '-p', String(port)], appEnv);
}

function stopChildren() {
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
}

process.once('SIGINT', () => {
  stopChildren();
  process.exit(0);
});
process.once('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

main().catch((error) => {
  console.error(`[offline] ${error instanceof OfflineError ? error.message : error.stack}`);
  stopChildren();
  process.exit(1);
});
