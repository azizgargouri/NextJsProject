import { compileSort, parseListQuery } from '../../shared/database/query-builder';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import { UserModel, type UserDoc } from '../../shared/database/models/user.model';
import type { UpdateQuery } from 'mongoose';
import { UserCreateInput, UserQuery, UserUpdateInput } from './users.schema';

/** Repository row: plain object with a string `id` (driver-independent shape). */
export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  role: 'CLIENT' | 'MOVER' | 'ADMIN';
  locale: string;
  status: 'ACTIVE' | 'BLOCKED';
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Maps a Mongoose document to the repository row (no Document leaks upward). */
export function toUserRow(doc: UserDoc): UserRow {
  return {
    id: String(doc._id),
    email: doc.email,
    passwordHash: doc.passwordHash,
    name: doc.name,
    phone: doc.phone,
    role: doc.role as UserRow['role'],
    locale: doc.locale,
    status: doc.status as UserRow['status'],
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt ?? null,
  };
}

/**
 * Users data access — the only place that knows about the `users` collection.
 * All queries await the shared mongoose connection first.
 */
export class UserRepository extends AbstractRepository<UserRow> {
  private async model() {
    await connectMongo();
    return UserModel;
  }

  async findOneById(id: string): Promise<UserRow | null> {
    const doc = await (await this.model()).findById(id).lean();
    return doc ? toUserRow(doc as unknown as UserDoc) : null;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const doc = await (await this.model())
      .findOne({ email: email.toLowerCase(), deletedAt: null })
      .lean();
    return doc ? toUserRow(doc as unknown as UserDoc) : null;
  }

  async findByPhone(phone: string): Promise<UserRow | null> {
    const doc = await (await this.model())
      .findOne({ phone, deletedAt: null })
      .lean();
    return doc ? toUserRow(doc as unknown as UserDoc) : null;
  }

  /** Standardized paginated list (query DSL: page / limit / search / sort / filter). */
  async findPaginated(searchParams: URLSearchParams) {
    const query = parseListQuery(searchParams);
    const where = this.buildWhere(query);
    const orderBy = compileSort(query.sort, ['email', 'name', 'role', 'createdAt', 'updatedAt']);
    const skip = (query.page - 1) * query.limit;
    const M = await this.model();

    const [docs, itemCount] = await Promise.all([
      M.find(where)
        .sort(orderBy)
        .skip(skip)
        .limit(query.limit)
        .lean(),
      M.countDocuments(where),
    ]);

    const { createPageDto } = await import('../../shared/database/pagination');
    return createPageDto(
      docs.map((doc) => toUserRow(doc as unknown as UserDoc)),
      query.page,
      query.limit,
      itemCount,
    );
  }

  async create(data: Record<string, unknown>): Promise<UserRow> {
    const doc = await (await this.model()).create(data as Partial<UserDoc>);
    return toUserRow(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<UserRow> {
    const doc = await (await this.model())
      .findByIdAndUpdate(id, data as UpdateQuery<UserDoc>, { new: true })
      .lean();
    if (!doc) throw new ReferenceError('User not found during update');
    return toUserRow(doc as unknown as UserDoc);
  }

  /** Soft delete (parity with previous SQL behavior). */
  async delete(id: string): Promise<UserRow> {
    const doc = await (await this.model())
      .findByIdAndUpdate(id, { deletedAt: new Date() } as UpdateQuery<UserDoc>, { new: true })
      .lean();
    if (!doc) throw new ReferenceError('User not found during delete');
    return toUserRow(doc as unknown as UserDoc);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<UserRow[]> {
    const M = await this.model();
    const { where = {}, orderBy = {}, skip = 0, limit = 50 } = (options ?? {}) as {
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      skip?: number;
      limit?: number;
    };
    const docs = await M.find(where)
      .sort(orderBy)
      .skip(skip)
      .limit(limit)
      .lean();
    return docs.map((doc) => toUserRow(doc as unknown as UserDoc));
  }

  private buildWhere(query: ReturnType<typeof parseListQuery>) {
    const where: Record<string, unknown> = { deletedAt: null };
    if (query.search) {
      const pattern = new RegExp(escapeRegExp(query.search), 'i');
      where.$or = [{ name: pattern }, { email: pattern }];
    }
    return where;
  }
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export type { UserCreateInput, UserUpdateInput, UserQuery };
