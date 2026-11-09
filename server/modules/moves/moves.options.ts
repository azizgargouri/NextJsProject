import { connectMongo } from '../../shared/database/mongoose';
import { MoveModel, type MoveDoc } from '../../shared/database/models/move.model';
import {
  MoveRequestModel,
  type MoveRequestDoc,
} from '../../shared/database/models/move-request.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';
import { UserModel } from '../../shared/database/models/user.model';

/** A client's move, shaped for the claim and review move pickers. */
export interface ClientMoveOption {
  moveReference: string;
  route: string;
  completedDate: string;
  truckTier: string;
  moverId: string;
  moverName: string;
  totalPaidTnd: number;
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  ASSIGNED: 'Mover assigned',
  EN_ROUTE: 'En route',
  IN_PROGRESS: 'In progress',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
};

const STAGE_LABELS: Record<MoveDoc['currentStage'], string> = {
  CONFIRMED: 'Confirmed',
  ASSIGNED: 'Mover assigned',
  EN_ROUTE: 'En route',
  ARRIVED: 'Mover arrived',
  LOADING: 'Loading',
  IN_TRANSIT: 'In transit',
  DELIVERY: 'Delivering',
  COMPLETED: 'Completed',
};

const formatDay = (date: Date) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    date,
  );

/**
 * The signed-in client's real moves, newest first: completed ones carry their
 * completion day, the others their move day and current stage, so a claim or a
 * review always points at a move that exists.
 */
export async function clientMoveOptions(clientId: string): Promise<ClientMoveOption[]> {
  await connectMongo();
  // Booked requests that reached a mover (a claim or review needs one), plus legacy Moves.
  const [requests, moves] = await Promise.all([
    MoveRequestModel.find({ clientId, assignedMoverId: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean<MoveRequestDoc[]>(),
    MoveModel.find({ clientId }).sort({ createdAt: -1 }).limit(30).lean<MoveDoc[]>(),
  ]);
  const moverIds = [...new Set(requests.map((request) => request.assignedMoverId!))];
  const [users, profiles] = await Promise.all([
    UserModel.find({ _id: { $in: moverIds } })
      .select('name')
      .lean<{ _id: unknown; name: string }[]>(),
    MoverProfileModel.find({ userId: { $in: moverIds } })
      .select('userId companyName')
      .lean<{ userId: string; companyName?: string }[]>(),
  ]);
  const nameOf = (id: string) =>
    profiles.find((profile) => profile.userId === id)?.companyName ||
    users.find((user) => String(user._id) === id)?.name ||
    'Assigned mover';

  const fromRequests: ClientMoveOption[] = requests.map((request) => {
    const day = request.completedAt ?? new Date(`${request.moveDate}T00:00:00`);
    return {
      moveReference: request.reference,
      route: `${request.pickup.street} → ${request.dropoff.street}`,
      completedDate:
        request.status === 'COMPLETED'
          ? formatDay(day)
          : `${formatDay(day)} · ${REQUEST_STATUS_LABELS[request.status] ?? request.status}`,
      truckTier: `${request.vehicleName ?? 'Vehicle to confirm'} · ${request.volumeM3} m³`,
      moverId: request.assignedMoverId!,
      moverName: nameOf(request.assignedMoverId!),
      totalPaidTnd: request.finalPrice ?? request.estimatedPrice ?? 0,
    };
  });

  const fromMoves = moves.map((move) => {
    const completedAt = move.stages.find((stage) => stage.key === 'COMPLETED')?.completedAt;
    const day = completedAt ?? move.moveDate ?? move.createdAt;
    return {
      moveReference: move.reference,
      route: `${move.pickupAddress} → ${move.destinationAddress}`,
      completedDate:
        move.currentStage === 'COMPLETED'
          ? formatDay(new Date(day))
          : `${formatDay(new Date(day))} · ${STAGE_LABELS[move.currentStage]}`,
      truckTier: `${move.vehicle.name} · ${move.volume} m³`,
      moverId: move.mover.userId,
      moverName: move.mover.companyName || move.mover.name,
      totalPaidTnd: move.estimatedPrice,
    };
  });
  return [...fromRequests, ...fromMoves];
}
