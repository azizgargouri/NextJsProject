import { isValidObjectId } from 'mongoose';
import { connectMongo } from './mongoose';
import { UserModel } from './models/user.model';
import type { Role } from './enums';

export interface UserRefRow {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/** Resolves many user ids to display identities in ONE query (avoids N+1 lookups). */
export async function findUserRefs(ids: string[]): Promise<Map<string, UserRefRow>> {
  const valid = [...new Set(ids)].filter((id) => isValidObjectId(id));
  if (valid.length === 0) return new Map();
  await connectMongo();
  const rows = await UserModel.find({ _id: { $in: valid } })
    .select('name email role')
    .lean<{ _id: unknown; name: string; email: string; role: Role }[]>();
  return new Map(
    rows.map((row) => [
      String(row._id),
      { id: String(row._id), name: row.name, email: row.email, role: row.role },
    ]),
  );
}

/** Loads a MOVER account that can receive claims / reviews (active, not deleted). */
export async function findActiveMover(id: string): Promise<UserRefRow | null> {
  if (!isValidObjectId(id)) return null;
  await connectMongo();
  const row = await UserModel.findOne({ _id: id, role: 'MOVER', status: 'ACTIVE', deletedAt: null })
    .select('name email role')
    .lean<{ _id: unknown; name: string; email: string; role: Role } | null>();
  return row ? { id: String(row._id), name: row.name, email: row.email, role: row.role } : null;
}
