import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env';
import { FILE_URL_TTL_SECONDS } from './mover.constants';
import { connectMongo } from '../../shared/database/mongoose';
import { MoverFileModel } from '../../shared/database/models/mover-file.model';
import { storage } from '../../shared/storage/s3';

/**
 * Private storage for mover photos and documents. Files are never public: they
 * are reachable only through a short-lived signed URL. Where the bytes live
 * depends on the host:
 *   - "disk":  UPLOAD_DIR on the local disk (development, the offline build);
 *   - "s3":    the S3-compatible bucket, on Vercel when S3_* is configured;
 *   - "mongo": MongoDB, on Vercel without a bucket (its disk is read-only).
 * MOVER_STORAGE forces one of them.
 */
const KEY_PATTERN = /^mover\/[a-f0-9]{24}\/[a-z]+\/[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

type Driver = 's3' | 'mongo' | 'disk';

function s3Configured(): boolean {
  return ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY', 'S3_BUCKET'].every((name) =>
    Boolean(process.env[name]?.trim()),
  );
}

export function moverStorageDriver(): Driver {
  const forced = process.env.MOVER_STORAGE?.trim();
  if (forced === 's3' || forced === 'mongo' || forced === 'disk') return forced;
  // Serverless hosts (Vercel) have a read-only filesystem: use the bucket, else MongoDB.
  if (process.env.VERCEL) return s3Configured() ? 's3' : 'mongo';
  return 'disk';
}

function checkKey(key: string): void {
  if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
}

function contentTypeOf(key: string): string {
  return CONTENT_TYPES[key.split('.').pop() ?? ''] ?? 'application/octet-stream';
}

function resolveKey(key: string): string {
  checkKey(key);
  return path.resolve(env().UPLOAD_DIR, key);
}

export const moverStorage = {
  newKey(moverId: string, folder: string, extension: string): string {
    return `mover/${moverId}/${folder}/${randomUUID()}.${extension}`;
  },

  async putObject(key: string, body: Uint8Array): Promise<void> {
    checkKey(key);
    const contentType = contentTypeOf(key);
    const driver = moverStorageDriver();
    if (driver === 's3') return storage.putObject(key, body, contentType);
    if (driver === 'mongo') {
      await connectMongo();
      await MoverFileModel.updateOne(
        { key },
        { $set: { contentType, size: body.byteLength, data: Buffer.from(body) } },
        { upsert: true },
      );
      return;
    }
    const target = resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  },

  async getObject(key: string): Promise<{ body: Uint8Array; contentType: string }> {
    checkKey(key);
    const driver = moverStorageDriver();
    if (driver === 's3') {
      const object = await storage.getObject(key);
      return { body: object.body, contentType: object.contentType || contentTypeOf(key) };
    }
    if (driver === 'mongo') {
      await connectMongo();
      const file = await MoverFileModel.findOne({ key }).lean();
      if (!file) throw Object.assign(new Error('File not found'), { code: 'ENOENT' });
      // `.lean()` returns BSON Binary; normalise to a Node Buffer.
      const raw = file.data as unknown as Buffer | { buffer: ArrayBuffer };
      const body = Buffer.isBuffer(raw)
        ? raw
        : Buffer.from((raw as { buffer: ArrayBuffer }).buffer);
      return { body, contentType: file.contentType };
    }
    const body = await readFile(resolveKey(key));
    return { body, contentType: contentTypeOf(key) };
  },
};

function signature(key: string, expires: number): string {
  return createHmac('sha256', `mover-files:${env().JWT_SECRET}`)
    .update(`${key}\n${expires}`)
    .digest('hex');
}

export function signFileUrl(key: string, now: number = Date.now()): string {
  const expires = Math.floor(now / 1000) + FILE_URL_TTL_SECONDS;
  const query = new URLSearchParams({
    key,
    exp: String(expires),
    sig: signature(key, expires),
  });
  return `/api/files/mover?${query.toString()}`;
}

export function verifyFileSignature(
  key: string | null,
  exp: string | null,
  sig: string | null,
  now: number = Date.now(),
): key is string {
  if (!key || !exp || !sig || !KEY_PATTERN.test(key)) return false;
  const expires = Number(exp);
  if (!Number.isInteger(expires) || expires * 1000 <= now) return false;
  const expected = Buffer.from(signature(key, expires));
  const received = Buffer.from(sig);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
