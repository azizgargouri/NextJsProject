import { connectMongo } from '../../shared/database/mongoose';
import { MoveModel, type MoveDoc } from '../../shared/database/models/move.model';
import {
  MoveRequestModel,
  type MoveRequestDoc,
} from '../../shared/database/models/move-request.model';
import { footprintFor, summarizeItems, type Footprint } from './furniture-sizes';

/** The signed-in client, as the guards resolve it from database truth. */
export interface ClientRef {
  id: string;
}

/** The slice of a client's Move that Smart Room Layout uses. */
export interface ClientMoveRequest {
  reference: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  items: MoveDoc['items'];
}

function toRequest(move: MoveDoc): ClientMoveRequest {
  return {
    reference: move.reference,
    pickupAddress: move.pickupAddress,
    destinationAddress: move.destinationAddress,
    // Moves booked before moveDate was stored fall back to their booking day.
    moveDate: (move.moveDate ?? move.createdAt).toISOString().slice(0, 10),
    items: move.items,
  };
}

/** A booked request (mover side); items keep the booking catalogue id when there is one. */
function fromRequest(move: MoveRequestDoc): ClientMoveRequest {
  return {
    reference: move.reference,
    pickupAddress: move.pickup.street,
    destinationAddress: move.dropoff.street,
    moveDate: move.moveDate,
    items: move.items.map((item, index) => ({
      id: item.key || `item-${index + 1}`,
      name: item.name,
      volume: item.volume ?? 0,
      weight: item.weight ?? 0,
      quantity: item.quantity,
    })),
  };
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

/** Client move requests for Smart Room Layout: booked requests and legacy Moves, newest first. */
export class MoveRequestsService {
  async listForClient(client: ClientRef): Promise<ClientMoveRequest[]> {
    await connectMongo();
    const [moves, requests] = await Promise.all([
      MoveModel.find({ clientId: client.id }).sort({ createdAt: -1 }).lean<MoveDoc[]>(),
      MoveRequestModel.find({ clientId: client.id, status: { $ne: 'CANCELLED' } })
        .sort({ createdAt: -1 })
        .lean<MoveRequestDoc[]>(),
    ]);
    // Booked requests (the live flow) and legacy Moves, newest first.
    return [
      ...requests.map((request) => ({ at: request.createdAt, value: fromRequest(request) })),
      ...moves.map((move) => ({ at: move.createdAt, value: toRequest(move) })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .map((entry) => entry.value);
  }

  async findForClient(client: ClientRef, reference: string): Promise<ClientMoveRequest | null> {
    await connectMongo();
    const request = await MoveRequestModel.findOne({
      reference,
      clientId: client.id,
    }).lean<MoveRequestDoc>();
    if (request) return fromRequest(request);
    const move = await MoveModel.findOne({ reference, clientId: client.id }).lean<MoveDoc>();
    return move ? toRequest(move) : null;
  }

  /** Request + every item's floor footprint + totals (the AI input in step 3). */
  expand(request: ClientMoveRequest): LinkedMoveRequestResponse {
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
