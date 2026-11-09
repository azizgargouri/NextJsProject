import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Env is read lazily by the app, so setting it here applies before the first connection.
Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGODB_URI: process.env.TEST_MONGODB_URI ?? 'mongodb://localhost:27017',
  MONGODB_DB_NAME: 'moveup_mover_test',
  JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
  OFFER_TTL_MINUTES: '120',
  UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'moveup-mover-test-')),
});

import mongoose from 'mongoose';
import { connectMongo } from '@/server/shared/database/mongoose';
import { generateAccessToken } from '@/server/shared/auth/jwt';
import {
  AvailabilityModel,
  JobOfferModel,
  MoveRequestModel,
  MoverDocumentModel,
  MoverProfileModel,
  UserModel,
  type MoveRequestDoc,
} from '@/server/shared/database/models';
import { dispatchMove } from '@/server/modules/mover';
import { newMoveReference } from '@/server/modules/mover/mover.offers';
import { todayInTunis } from '@/server/modules/mover/mover.rules';

/** Connects to the test database, and refuses to wipe anything else. */
export async function resetDatabase(): Promise<void> {
  await connectMongo();
  const name = mongoose.connection.db?.databaseName ?? '';
  if (!name.endsWith('_test')) throw new Error(`Refusing to wipe database "${name}"`);
  await mongoose.connection.db?.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
}

type Handler = (request: Request, context: { params: Promise<never> }) => Promise<Response>;

interface CallOptions {
  token?: string;
  method?: string;
  body?: unknown;
  form?: FormData;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

/** Invokes a real route handler, so guards, parsing and serializers all run. */
export async function call<T = any>( // eslint-disable-line @typescript-eslint/no-explicit-any
  handler: unknown,
  options: CallOptions = {},
): Promise<{ status: number; data: T }> {
  const url = new URL('http://test.local/api');
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const hasJson = options.body !== undefined;
  const request = new Request(url, {
    method: options.method ?? (hasJson || options.form ? 'POST' : 'GET'),
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(hasJson ? { 'content-type': 'application/json' } : {}),
    },
    body: hasJson ? JSON.stringify(options.body) : options.form,
  });
  const response = await (handler as Handler)(request, {
    params: Promise.resolve(options.params ?? {}) as Promise<never>,
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // Binary or plain body: tests read it as text.
  }
  return { status: response.status, data: data as T };
}

let sequence = 0;

export interface Account {
  id: string;
  token: string;
  name: string;
  phone: string;
}

export async function createUser(
  role: 'CLIENT' | 'MOVER' | 'ADMIN',
  overrides: { status?: 'ACTIVE' | 'BLOCKED' } = {},
): Promise<Account> {
  await connectMongo();
  sequence += 1;
  const email = `${role.toLowerCase()}${sequence}@test.local`;
  const phone = `+2169${String(sequence).padStart(7, '0')}`;
  const name = `${role} Person ${sequence}`;
  const user = await UserModel.create({
    email,
    phone,
    name,
    role,
    passwordHash: 'not-used',
    status: overrides.status ?? 'ACTIVE',
  });
  const id = String(user._id);
  return { id, name, phone, token: await generateAccessToken({ sub: id, email, role }) };
}

export function dayFromNow(days: number): string {
  return todayInTunis(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

export const MOVE_DAY = dayFromNow(7);

/** An approved mover who can receive offers unless a test takes something away. */
export async function createMover(
  options: {
    verification?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    zones?: string[];
    rating?: number;
    insuranceDays?: number | null;
    availableOn?: string[];
    slot?: 'MORNING' | 'AFTERNOON' | 'FULL_DAY';
    userStatus?: 'ACTIVE' | 'BLOCKED';
  } = {},
): Promise<Account> {
  const account = await createUser('MOVER', { status: options.userStatus });
  await MoverProfileModel.create({
    userId: account.id,
    companyName: `${account.name} Co`,
    zones: options.zones ?? ['TUN'],
    verificationStatus: options.verification ?? 'APPROVED',
    ratingAvg: options.rating ?? 4,
  });
  const insuranceDays = options.insuranceDays === undefined ? 200 : options.insuranceDays;
  if (insuranceDays !== null) {
    await MoverDocumentModel.create({
      moverId: account.id,
      type: 'INSURANCE',
      storageKey: `mover/${account.id}/documents/seed.pdf`,
      contentType: 'application/pdf',
      fileName: 'insurance.pdf',
      expiresAt: new Date(Date.now() + insuranceDays * 24 * 60 * 60 * 1000),
    });
  }
  for (const date of options.availableOn ?? [MOVE_DAY]) {
    await AvailabilityModel.create({
      moverId: account.id,
      date,
      slot: options.slot ?? 'FULL_DAY',
    });
  }
  return account;
}

export const PRIVATE = {
  pickupStreet: '12 Rue Secrete Pickup',
  dropoffStreet: '99 Avenue Cachee Dropoff',
  pickupPostal: '1002-PRIVATE',
  accessNotes: 'Door code 4471',
  notes: 'Call my cousin on 22 333 444',
};

export async function createMove(
  clientId: string,
  overrides: Partial<
    Pick<MoveRequestDoc, 'moveDate' | 'timeSlot' | 'status' | 'estimatedPrice'>
  > & {
    zone?: string;
  } = {},
): Promise<MoveRequestDoc> {
  const { zone, ...rest } = overrides;
  return (
    await MoveRequestModel.create({
      reference: newMoveReference(),
      clientId,
      pickup: {
        street: PRIVATE.pickupStreet,
        city: 'Tunis',
        zone: zone ?? 'TUN',
        postalCode: PRIVATE.pickupPostal,
        floor: 3,
        hasElevator: false,
        accessNotes: PRIVATE.accessNotes,
      },
      dropoff: {
        street: PRIVATE.dropoffStreet,
        city: 'Sousse',
        zone: 'SOU',
        postalCode: '4000',
        floor: 1,
        hasElevator: true,
      },
      moveDate: MOVE_DAY,
      timeSlot: 'MORNING',
      housingType: 'Apartment',
      sizeRooms: 3,
      volumeM3: 18,
      extraServices: ['PACKING'],
      notes: PRIVATE.notes,
      items: [{ name: 'Sofa', quantity: 1, category: 'Furniture', needsDisassembly: true }],
      status: 'SUBMITTED',
      estimatedPrice: 400,
      ...rest,
    })
  ).toObject() as MoveRequestDoc;
}

/** Creates a move and offers it to the top `count` eligible movers. */
export async function dispatched(
  clientId: string,
  overrides: Parameters<typeof createMove>[1] = {},
  count = 1,
): Promise<{ move: MoveRequestDoc; moveId: string; offersSent: number }> {
  const move = await createMove(clientId, overrides);
  const moveId = String(move._id);
  const { offersSent } = await dispatchMove(moveId, { actorId: null, count });
  return { move, moveId, offersSent };
}

export async function offerFor(moveId: string, moverId: string) {
  return JobOfferModel.findOne({ moveId, moverId }).lean();
}

/** Forces an offer past its deadline, instead of waiting two hours. */
export async function expireOffer(moveId: string, moverId: string): Promise<void> {
  await JobOfferModel.updateOne(
    { moveId, moverId },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
}

export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);
export const PDF = new TextEncoder().encode('%PDF-1.4\n%test\n');

export function upload(fields: Record<string, string>, bytes: Uint8Array, name: string): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('file', new File([bytes as BlobPart], name));
  return form;
}
