import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { z } from 'zod';
import { ServiceUnavailableError } from '../database/errors';

/**
 * S3-compatible object storage: RustFS locally (`docker compose up -d`),
 * Cloudflare R2 in production (S3_REGION=auto).
 * Config is validated lazily so the rest of the app boots without storage;
 * storage calls surface a 503 instead of crashing the process.
 */
const storageEnvSchema = z.object({
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a URL'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_BUCKET: z.string().min(3, 'S3_BUCKET is required'),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

let cachedEnv: StorageEnv | null = null;
let cachedClient: S3Client | null = null;

export function storageEnv(): StorageEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = storageEnvSchema.safeParse({
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION || undefined,
    S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
    S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    S3_BUCKET: process.env.S3_BUCKET,
  });
  if (!parsed.success) {
    throw new ServiceUnavailableError(
      `Object storage is not configured: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

function client(): S3Client {
  if (cachedClient) return cachedClient;
  const config = storageEnv();
  cachedClient = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
    // Recent SDKs add CRC checksum headers to every upload; S3-compatible stores
    // (Cloudflare R2, RustFS) may reject them. Send them only when an API needs them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  return cachedClient;
}

/** Wraps driver/network failures into a typed 503 so routes answer honestly. */
async function guarded<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;
    const name = (error as { name?: string }).name;
    if (name === 'NoSuchKey' || name === 'NotFound') throw error;
    if (process.env.NODE_ENV === 'development') console.error('[storage]', error);
    throw new ServiceUnavailableError(storageFailureMessage(error));
  }
}

/**
 * What went wrong, in terms an operator can act on (the cause used to be hidden
 * behind "unreachable"). Logged server-side too, so Vercel's logs show it.
 */
function storageFailureMessage(error: unknown): string {
  const { name, $metadata } = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = $metadata?.httpStatusCode;
  console.error('[storage]', name, status, (error as Error).message);
  // R2 answers both a wrong secret and a read-only key with AccessDenied (403).
  if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || status === 401) {
    return `Object storage rejected the credentials (${name ?? status}): check S3_ACCESS_KEY and S3_SECRET_KEY.`;
  }
  if (name === 'AccessDenied' || status === 403) {
    return 'Object storage refused the request (AccessDenied): S3_ACCESS_KEY / S3_SECRET_KEY are wrong, or the key lacks read & write access to the bucket.';
  }
  if (name === 'NoSuchBucket') return 'Object storage bucket not found: check S3_BUCKET.';
  return `Object storage is unreachable (${name ?? 'network error'}): check S3_ENDPOINT.`;
}

export function isMissingObjectError(error: unknown): boolean {
  const name = (error as { name?: string }).name;
  return name === 'NoSuchKey' || name === 'NotFound';
}

export interface StoredObject {
  key: string;
  size: number;
  lastModified: string | null;
  etag: string | null;
}

export const storage = {
  bucket: () => storageEnv().S3_BUCKET,
  endpoint: () => storageEnv().S3_ENDPOINT,

  async putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await guarded(() =>
      client().send(
        new PutObjectCommand({
          Bucket: storageEnv().S3_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  },

  async getObject(
    key: string,
  ): Promise<{ body: Uint8Array; contentType: string; size: number; etag: string | null }> {
    return guarded(async () => {
      const result = await client().send(
        new GetObjectCommand({ Bucket: storageEnv().S3_BUCKET, Key: key }),
      );
      const body = result.Body ? await result.Body.transformToByteArray() : new Uint8Array();
      return {
        body,
        contentType: result.ContentType ?? 'application/octet-stream',
        size: result.ContentLength ?? body.byteLength,
        etag: result.ETag ?? null,
      };
    });
  },

  async deleteObject(key: string): Promise<void> {
    await guarded(() =>
      client().send(new DeleteObjectCommand({ Bucket: storageEnv().S3_BUCKET, Key: key })),
    );
  },

  /** True when the bucket answers a HEAD; false (never throws) when it does not. */
  async ping(): Promise<boolean> {
    try {
      await client().send(new HeadBucketCommand({ Bucket: storageEnv().S3_BUCKET }));
      return true;
    } catch {
      return false;
    }
  },

  async listObjects(options: {
    prefix?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ objects: StoredObject[]; nextCursor: string | null }> {
    return guarded(async () => {
      const result = await client().send(
        new ListObjectsV2Command({
          Bucket: storageEnv().S3_BUCKET,
          Prefix: options.prefix || undefined,
          ContinuationToken: options.cursor || undefined,
          MaxKeys: options.limit ?? 25,
        }),
      );
      return {
        objects: (result.Contents ?? []).map((item) => ({
          key: item.Key ?? '',
          size: item.Size ?? 0,
          lastModified: item.LastModified ? item.LastModified.toISOString() : null,
          etag: item.ETag ?? null,
        })),
        nextCursor: result.IsTruncated ? (result.NextContinuationToken ?? null) : null,
      };
    });
  },

  /** Walks the whole bucket (or prefix) to total object count and bytes. */
  async usage(prefix?: string): Promise<{ objectCount: number; totalBytes: number }> {
    let cursor: string | undefined;
    let objectCount = 0;
    let totalBytes = 0;
    do {
      const page = await this.listObjects({ prefix, cursor, limit: 1000 });
      objectCount += page.objects.length;
      totalBytes += page.objects.reduce((sum, item) => sum + item.size, 0);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return { objectCount, totalBytes };
  },
};
