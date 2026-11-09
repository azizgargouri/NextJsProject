import { isValidObjectId } from 'mongoose';
import { AbstractCrudService } from '../../shared/database/crud-service';
import { BadRequestError, DomainError, NotFoundError } from '../../shared/database/errors';
import { moveRequestsService, type ClientRef } from '../room-layout/move-requests.service';
import { HomeRepository, type HomeRow } from './homes.repository';
import {
  HOME_LIMITS,
  type HomeCreateInput,
  type HomeUpdateInput,
  type RoomCreateInput,
  type RoomUpdateInput,
} from './homes.schema';
import { serializeHome, type HomeDetailResponse } from './homes.serializer';

/** One entry of the client's move requests, with the house it is linked to (if any). */
export interface ClientMoveRequestResponse {
  reference: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  itemCount: number;
  linkedHome: { id: string; label: string } | null;
}

/**
 * Homes business logic. Every method is scoped to the calling client:
 * someone else's house answers 404, so ids never leak across accounts.
 */
export class HomeService extends AbstractCrudService<HomeRow> {
  private readonly homes = new HomeRepository();

  protected get repository(): HomeRepository {
    return this.homes;
  }

  async listMine(client: ClientRef, searchParams: URLSearchParams) {
    const page = await this.repository.findPaginatedForClient(client.id, searchParams);
    return { ...page, data: page.data.map(serializeHome) };
  }

  async getMine(client: ClientRef, homeId: string): Promise<HomeDetailResponse> {
    return this.detail(client, await this.owned(client.id, homeId));
  }

  async createMine(client: ClientRef, input: HomeCreateInput): Promise<HomeDetailResponse> {
    const existing = await this.repository.count({ clientId: client.id, deletedAt: null });
    if (existing >= HOME_LIMITS.homesPerClient) {
      throw new BadRequestError(`You can save up to ${HOME_LIMITS.homesPerClient} houses`);
    }
    const home = await this.repository.create({
      ...input,
      clientId: client.id,
      moveReference: null,
      rooms: [],
    });
    return this.detail(client, home);
  }

  async updateMine(client: ClientRef, homeId: string, input: HomeUpdateInput) {
    await this.owned(client.id, homeId);
    if (input.moveReference) await this.assertLinkable(client, homeId, input.moveReference);
    return this.detail(client, await this.repository.update(homeId, input));
  }

  async deleteMine(client: ClientRef, homeId: string): Promise<HomeDetailResponse> {
    await this.owned(client.id, homeId);
    // A deleted house releases its move request so another house can link it.
    return this.detail(
      client,
      await this.repository.update(homeId, { deletedAt: new Date(), moveReference: null }),
    );
  }

  async addRoom(client: ClientRef, homeId: string, input: RoomCreateInput) {
    const home = await this.owned(client.id, homeId);
    if (home.rooms.length >= HOME_LIMITS.roomsPerHome) {
      throw new BadRequestError(`A house can have up to ${HOME_LIMITS.roomsPerHome} rooms`);
    }
    return this.detail(client, await this.repository.addRoom(homeId, input));
  }

  async updateRoom(client: ClientRef, homeId: string, roomId: string, input: RoomUpdateInput) {
    await this.ownedRoom(client.id, homeId, roomId);
    return this.detail(client, await this.repository.updateRoom(homeId, roomId, input));
  }

  async removeRoom(client: ClientRef, homeId: string, roomId: string) {
    await this.ownedRoom(client.id, homeId, roomId);
    return this.detail(client, await this.repository.removeRoom(homeId, roomId));
  }

  /** The client's move requests for the link picker, marking which house uses each. */
  async listMoveRequests(client: ClientRef): Promise<ClientMoveRequestResponse[]> {
    const requests = await moveRequestsService.listForClient(client);
    const linked = await this.repository.findLinked(
      client.id,
      requests.map((request) => request.reference),
    );
    return requests.map((request) => {
      const home = linked.find((candidate) => candidate.moveReference === request.reference);
      return {
        reference: request.reference,
        pickupAddress: request.pickupAddress,
        destinationAddress: request.destinationAddress,
        moveDate: request.moveDate,
        itemCount: request.items.reduce((sum, item) => sum + item.quantity, 0),
        linkedHome: home ? { id: home.id, label: home.label } : null,
      };
    });
  }

  /** Request must be the client's own and not already used by another of their houses. */
  private async assertLinkable(client: ClientRef, homeId: string, reference: string) {
    if (!(await moveRequestsService.findForClient(client, reference))) {
      throw new NotFoundError('Move request');
    }
    const [other] = (await this.repository.findLinked(client.id, [reference])).filter(
      (home) => home.id !== homeId,
    );
    if (other) {
      throw new DomainError(
        `${reference} is already linked to “${other.label}”. Unlink it there first.`,
        409,
        'MOVE_REQUEST_ALREADY_LINKED',
      );
    }
  }

  private async detail(client: ClientRef, home: HomeRow): Promise<HomeDetailResponse> {
    const request = home.moveReference
      ? await moveRequestsService.findForClient(client, home.moveReference)
      : null;
    return {
      ...serializeHome(home),
      moveRequest: request ? moveRequestsService.expand(request) : null,
    };
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
