import type { UpdateQuery } from 'mongoose';
import { AbstractRepository } from '../../shared/database/repository';
import { connectMongo } from '../../shared/database/mongoose';
import { createPageDto } from '../../shared/database/pagination';
import { parseListQuery } from '../../shared/database/query-builder';
import {
  HomeModel,
  type HomeDoc,
  type HomeType,
  type OpeningKind,
  type RoomType,
  type Wall,
} from '../../shared/database/models/home.model';
import { escapeRegExp } from '../users/users.repository';
import type { RoomCreateInput } from './homes.schema';

export interface OpeningRow {
  id: string;
  kind: OpeningKind;
  wall: Wall;
  offsetCm: number;
  widthCm: number;
}

export interface RoomRow {
  id: string;
  name: string;
  type: RoomType;
  widthCm: number;
  lengthCm: number;
  notes: string;
  openings: OpeningRow[];
}

export interface HomeRow {
  id: string;
  clientId: string;
  label: string;
  city: string;
  type: HomeType;
  floor: number;
  hasElevator: boolean;
  notes: string;
  rooms: RoomRow[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Maps a (lean) Mongoose document to the repository row — no Document leaks upward. */
export function toHomeRow(doc: HomeDoc): HomeRow {
  return {
    id: String(doc._id),
    clientId: doc.clientId,
    label: doc.label,
    city: doc.city,
    type: doc.type,
    floor: doc.floor,
    hasElevator: doc.hasElevator,
    notes: doc.notes ?? '',
    rooms: (doc.rooms ?? []).map((room) => ({
      id: String(room._id),
      name: room.name,
      type: room.type,
      widthCm: room.widthCm,
      lengthCm: room.lengthCm,
      notes: room.notes ?? '',
      openings: (room.openings ?? []).map((opening) => ({
        id: String(opening._id),
        kind: opening.kind,
        wall: opening.wall,
        offsetCm: opening.offsetCm,
        widthCm: opening.widthCm,
      })),
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    deletedAt: doc.deletedAt ?? null,
  };
}

const AFTER = { returnDocument: 'after' as const };

/** Homes data access — the only place that knows about the `homes` collection. */
export class HomeRepository extends AbstractRepository<HomeRow> {
  private async model() {
    await connectMongo();
    return HomeModel;
  }

  async findOneById(id: string): Promise<HomeRow | null> {
    const doc = await (await this.model()).findById(id).lean<HomeDoc>();
    return doc ? toHomeRow(doc) : null;
  }

  /** Live (not deleted) house owned by the client, or null. */
  async findOwned(id: string, clientId: string): Promise<HomeRow | null> {
    const doc = await (
      await this.model()
    )
      .findOne({ _id: id, clientId, deletedAt: null })
      .lean<HomeDoc>();
    return doc ? toHomeRow(doc) : null;
  }

  async findPaginatedForClient(clientId: string, searchParams: URLSearchParams) {
    const query = parseListQuery(searchParams);
    const where: Record<string, unknown> = { clientId, deletedAt: null };
    if (query.search) {
      const pattern = new RegExp(escapeRegExp(query.search), 'i');
      where.$or = [{ label: pattern }, { city: pattern }];
    }

    const M = await this.model();
    const [docs, itemCount] = await Promise.all([
      M.find(where)
        .sort({ createdAt: 'desc' })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<HomeDoc[]>(),
      M.countDocuments(where),
    ]);
    return createPageDto(docs.map(toHomeRow), query.page, query.limit, itemCount);
  }

  async create(data: Record<string, unknown>): Promise<HomeRow> {
    const doc = await (await this.model()).create(data as Partial<HomeDoc>);
    return toHomeRow(doc.toObject());
  }

  async update(id: string, data: Record<string, unknown>): Promise<HomeRow> {
    const doc = await (
      await this.model()
    )
      .findByIdAndUpdate(id, data as UpdateQuery<HomeDoc>, AFTER)
      .lean<HomeDoc>();
    if (!doc) throw new ReferenceError('Home not found during update');
    return toHomeRow(doc);
  }

  /** Soft delete — the house stays for history (layout plans reference it). */
  async delete(id: string): Promise<HomeRow> {
    return this.update(id, { deletedAt: new Date() });
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    return (await this.model()).countDocuments(where ?? {});
  }

  async findMany(options: Record<string, unknown> = {}): Promise<HomeRow[]> {
    const { where = {}, limit = 50 } = options as {
      where?: Record<string, unknown>;
      limit?: number;
    };
    const docs = await (await this.model()).find(where).limit(limit).lean<HomeDoc[]>();
    return docs.map(toHomeRow);
  }

  async addRoom(homeId: string, room: RoomCreateInput): Promise<HomeRow> {
    return this.update(homeId, { $push: { rooms: room } });
  }

  /** Replaces one embedded room's fields in place (the room keeps its id). */
  async updateRoom(homeId: string, roomId: string, room: RoomCreateInput): Promise<HomeRow> {
    const set = Object.fromEntries(
      Object.entries(room).map(([field, value]) => [`rooms.$.${field}`, value]),
    );
    const doc = await (
      await this.model()
    )
      .findOneAndUpdate({ _id: homeId, 'rooms._id': roomId }, { $set: set }, AFTER)
      .lean<HomeDoc>();
    if (!doc) throw new ReferenceError('Room not found during update');
    return toHomeRow(doc);
  }

  async removeRoom(homeId: string, roomId: string): Promise<HomeRow> {
    return this.update(homeId, { $pull: { rooms: { _id: roomId } } });
  }
}
