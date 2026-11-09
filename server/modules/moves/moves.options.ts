import { connectMongo } from '../../shared/database/mongoose';
import { MoveModel, type MoveDoc } from '../../shared/database/models/move.model';

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
  const moves = await MoveModel.find({ clientId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean<MoveDoc[]>();

  return moves.map((move) => {
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
}
