import { NotFoundError } from '../../shared/database/errors';
import { isMissingObjectError, storage, type StoredObject } from '../../shared/storage/s3';
import { UserRepository } from '../users/users.repository';
import type { StorageListQuery } from './storage.schema';

export interface StorageStatusDto {
  reachable: boolean;
  bucket: string;
  endpoint: string;
  objectCount: number | null;
  totalBytes: number | null;
  prefixes: { prefix: string; objectCount: number; totalBytes: number }[];
}

export interface StorageObjectDto extends StoredObject {
  /** Account the object belongs to, when the key follows `avatars/<userId>/…`. */
  owner: { id: string; name: string; email: string } | null;
  /** True when a live record still points at this object. */
  referenced: boolean;
}

/** Known top-level folders; anything else still lists under its own prefix. */
const KNOWN_PREFIXES = ['avatars/'];

/** Back-office view of the object-storage bucket (status, browse, delete). */
export class StorageService {
  private readonly users = new UserRepository();

  async status(): Promise<StorageStatusDto> {
    const bucket = storage.bucket();
    const endpoint = storage.endpoint();
    const reachable = await storage.ping();
    if (!reachable) {
      return { reachable, bucket, endpoint, objectCount: null, totalBytes: null, prefixes: [] };
    }

    const [total, ...byPrefix] = await Promise.all([
      storage.usage(),
      ...KNOWN_PREFIXES.map((prefix) => storage.usage(prefix)),
    ]);
    return {
      reachable,
      bucket,
      endpoint,
      objectCount: total.objectCount,
      totalBytes: total.totalBytes,
      prefixes: KNOWN_PREFIXES.map((prefix, index) => ({
        prefix,
        objectCount: byPrefix[index]?.objectCount ?? 0,
        totalBytes: byPrefix[index]?.totalBytes ?? 0,
      })),
    };
  }

  async list(query: StorageListQuery): Promise<{
    data: StorageObjectDto[];
    nextCursor: string | null;
  }> {
    const page = await storage.listObjects(query);
    const ownerIds = [
      ...new Set(page.objects.map((object) => avatarOwnerId(object.key)).filter(Boolean)),
    ] as string[];
    const owners = new Map(
      (
        await Promise.all(ownerIds.map((id) => this.users.findOneById(id).catch(() => null)))
      ).flatMap((user) => (user ? [[user.id, user] as const] : [])),
    );

    return {
      data: page.objects.map((object) => {
        const owner = owners.get(avatarOwnerId(object.key) ?? '');
        return {
          ...object,
          owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
          referenced: Boolean(owner && !owner.deletedAt && owner.avatarKey === object.key),
        };
      }),
      nextCursor: page.nextCursor,
    };
  }

  async download(key: string) {
    try {
      return await storage.getObject(key);
    } catch (error) {
      if (isMissingObjectError(error)) throw new NotFoundError('Object');
      throw error;
    }
  }

  /** Deletes the object and clears any account pointer so no record dangles. */
  async remove(key: string): Promise<{ key: string; detachedUserId: string | null }> {
    const user = await this.users.findByAvatarKey(key);
    if (user) await this.users.update(user.id, { avatarKey: null });
    await storage.deleteObject(key);
    return { key, detachedUserId: user?.id ?? null };
  }
}

function avatarOwnerId(key: string): string | null {
  const match = /^avatars\/([a-f0-9]{24})\//.exec(key);
  return match?.[1] ?? null;
}

export const storageService = new StorageService();
