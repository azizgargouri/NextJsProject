import { footprintFor, summarizeItems, type Footprint } from './furniture-sizes';
import { STATIC_MOVE_REQUESTS, type StaticMoveRequest } from './static-move-requests';

/** The signed-in client, as the guards resolve it from database truth. */
export interface ClientRef {
  id: string;
  email: string;
}

export interface MoveItemResponse {
  id: string;
  name: string;
  quantity: number;
  volumeM3: number;
  weightKg: number;
  footprint: Footprint;
}

export interface LinkedMoveRequestResponse {
  reference: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  items: MoveItemResponse[];
  totals: ReturnType<typeof summarizeItems>;
}

/**
 * Client move requests for Smart Room Layout. Reads STATIC data today; when
 * the Move model is merged, only the two lookups below change
 * (`MoveModel.find({ clientId: client.id })` / `findOne({ reference, clientId })`).
 */
export class MoveRequestsService {
  async listForClient(client: ClientRef): Promise<StaticMoveRequest[]> {
    return STATIC_MOVE_REQUESTS.filter((request) => request.clientEmail === client.email);
  }

  async findForClient(client: ClientRef, reference: string): Promise<StaticMoveRequest | null> {
    return (
      STATIC_MOVE_REQUESTS.find(
        (request) => request.reference === reference && request.clientEmail === client.email,
      ) ?? null
    );
  }

  /** Request + every item's floor footprint + totals (the AI input in step 3). */
  expand(request: StaticMoveRequest): LinkedMoveRequestResponse {
    return {
      reference: request.reference,
      pickupAddress: request.pickupAddress,
      destinationAddress: request.destinationAddress,
      moveDate: request.moveDate,
      items: request.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        volumeM3: item.volume,
        weightKg: item.weight,
        footprint: footprintFor(item),
      })),
      totals: summarizeItems(request.items),
    };
  }
}

export const moveRequestsService = new MoveRequestsService();
