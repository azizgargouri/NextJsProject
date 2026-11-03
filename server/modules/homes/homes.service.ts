import { isValidObjectId } from 'mongoose';
import { AbstractCrudService } from '../../shared/database/crud-service';
import { BadRequestError, NotFoundError } from '../../shared/database/errors';
import { HomeRepository, type HomeRow } from './homes.repository';
import {
  HOME_LIMITS,
  type HomeCreateInput,
  type HomeUpdateInput,
  type RoomCreateInput,
  type RoomUpdateInput,
} from './homes.schema';
import { serializeHome, type HomeResponse } from './homes.serializer';

/**
 * Homes business logic. Every method is scoped to the calling client:
 * someone else's house answers 404, so ids never leak across accounts.
 */
export class HomeService extends AbstractCrudService<HomeRow> {
  private readonly homes = new HomeRepository();

  protected get repository(): HomeRepository {
    return this.homes;
  }

  async listMine(clientId: string, searchParams: URLSearchParams) {
    const page = await this.repository.findPaginatedForClient(clientId, searchParams);
    return { ...page, data: page.data.map(serializeHome) };
  }

  async getMine(clientId: string, homeId: string): Promise<HomeResponse> {
    return serializeHome(await this.owned(clientId, homeId));
  }

  async createMine(clientId: string, input: HomeCreateInput): Promise<HomeResponse> {
    const existing = await this.repository.count({ clientId, deletedAt: null });
    if (existing >= HOME_LIMITS.homesPerClient) {
      throw new BadRequestError(`You can save up to ${HOME_LIMITS.homesPerClient} houses`);
    }
    return serializeHome(await this.repository.create({ ...input, clientId, rooms: [] }));
  }

  async updateMine(clientId: string, homeId: string, input: HomeUpdateInput) {
    await this.owned(clientId, homeId);
    return serializeHome(await this.repository.update(homeId, input));
  }

  async deleteMine(clientId: string, homeId: string): Promise<HomeResponse> {
    await this.owned(clientId, homeId);
    return serializeHome(await this.repository.delete(homeId));
  }

  async addRoom(clientId: string, homeId: string, input: RoomCreateInput) {
    const home = await this.owned(clientId, homeId);
    if (home.rooms.length >= HOME_LIMITS.roomsPerHome) {
      throw new BadRequestError(`A house can have up to ${HOME_LIMITS.roomsPerHome} rooms`);
    }
    return serializeHome(await this.repository.addRoom(homeId, input));
  }

  async updateRoom(clientId: string, homeId: string, roomId: string, input: RoomUpdateInput) {
    await this.ownedRoom(clientId, homeId, roomId);
    return serializeHome(await this.repository.updateRoom(homeId, roomId, input));
  }

  async removeRoom(clientId: string, homeId: string, roomId: string) {
    await this.ownedRoom(clientId, homeId, roomId);
    return serializeHome(await this.repository.removeRoom(homeId, roomId));
  }

  private async owned(clientId: string, homeId: string): Promise<HomeRow> {
    if (!isValidObjectId(homeId)) throw new BadRequestError('Invalid house ID');
    const home = await this.repository.findOwned(homeId, clientId);
    if (!home) throw new NotFoundError('Home');
    return home;
  }

  private async ownedRoom(clientId: string, homeId: string, roomId: string) {
    if (!isValidObjectId(roomId)) throw new BadRequestError('Invalid room ID');
    const home = await this.owned(clientId, homeId);
    if (!home.rooms.some((room) => room.id === roomId)) throw new NotFoundError('Room');
    return home;
  }
}

export const homesService = new HomeService();
