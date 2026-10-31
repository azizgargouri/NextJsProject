import { hashPassword } from '../../shared/auth/password';
import { randomBytes } from 'node:crypto';
import { connectMongo } from '../../shared/database/mongoose';
import { MoveModel, type MoveDoc, type MoveStage, type MoveStageKey } from '../../shared/database/models/move.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';
import { UserModel } from '../../shared/database/models/user.model';
import { NotFoundError, ValidationError } from '../../shared/database/errors';
import type { MoveCreateInput } from './moves.schema';

const VEHICLES = [
  { name: 'Small Partner van', capacity: 3.5, payload: 600, base: 35 },
  { name: 'Compact van', capacity: 6, payload: 1000, base: 45 },
  { name: 'Moving van', capacity: 14, payload: 1400, base: 75 },
  { name: 'Box truck', capacity: 28, payload: 3000, base: 115 },
  { name: 'Large truck', capacity: 45, payload: 5000, base: 165 },
];
const STAGES: { key: MoveStageKey; title: string; detail: string; minutes: number | null }[] = [
  { key: 'CONFIRMED', title: 'Booking confirmed', detail: 'Your move request has been accepted.', minutes: 0 },
  { key: 'ASSIGNED', title: 'Vehicle assigned', detail: 'A vetted driver and vehicle have been assigned.', minutes: 12 },
  { key: 'EN_ROUTE', title: 'Driver en route', detail: 'Driver is travelling to your pickup location.', minutes: 18 },
  { key: 'ARRIVED', title: 'Vehicle arrives', detail: 'Driver arrives at your pickup location.', minutes: 5 },
  { key: 'LOADING', title: 'Loading starts', detail: 'Furniture and boxes are checked and loaded.', minutes: 45 },
  { key: 'IN_TRANSIT', title: 'In transit', detail: 'Your load is on the road to the destination.', minutes: 26 },
  { key: 'DELIVERY', title: 'Delivery', detail: 'Unloading at the destination address.', minutes: 35 },
  { key: 'COMPLETED', title: 'Move completed', detail: 'Confirm delivery or report a problem.', minutes: null },
];

function serialize(move: MoveDoc) {
  // Mongoose subdocuments cannot be safely object-spread: their visible fields
  // live behind accessors. Explicit serialization keeps stage titles/times intact.
  return {
    id: String(move._id),
    reference: move.reference,
    clientId: move.clientId,
    pickupAddress: move.pickupAddress,
    destinationAddress: move.destinationAddress,
    items: move.items.map((item) => ({ id: item.id, name: item.name, volume: item.volume, weight: item.weight, quantity: item.quantity })),
    volume: move.volume,
    distance: move.distance,
    estimatedPrice: move.estimatedPrice,
    vehicle: { name: move.vehicle.name, capacity: move.vehicle.capacity, payload: move.vehicle.payload },
    mover: { userId: move.mover.userId, name: move.mover.name, phone: move.mover.phone, companyName: move.mover.companyName },
    currentStage: move.currentStage,
    createdAt: move.createdAt.toISOString(),
    updatedAt: move.updatedAt.toISOString(),
    stages: move.stages.map((stage) => ({
      key: stage.key,
      title: stage.title,
      detail: stage.detail,
      durationMinutes: stage.durationMinutes,
      estimatedAt: stage.estimatedAt.toISOString(),
      completedAt: stage.completedAt?.toISOString() ?? null,
    })),
  };
}

export class MovesService {
  private async ensureDemoMover() {
    await connectMongo();
    let mover = await UserModel.findOne({ email: 'mover@moveup.tn' });
    if (!mover) {
      mover = await UserModel.create({ email: 'mover@moveup.tn', passwordHash: await hashPassword('Demo#2026!'), name: 'Mehdi Transport', phone: '+21698123456', role: 'MOVER', locale: 'en', status: 'ACTIVE' });
    }
    await MoverProfileModel.findOneAndUpdate({ userId: String(mover._id) }, { $set: { companyName: 'Mehdi Transport', bio: 'Moving van, 14 m³ — Greater Tunis.', zones: ['TUN'], verificationStatus: 'APPROVED' } }, { upsert: true });
    return mover;
  }

  async create(input: MoveCreateInput, clientId: string) {
    const mover = await this.ensureDemoMover();
    const volume = input.items.reduce((total, item) => total + item.volume * item.quantity, 0);
    const weight = input.items.reduce((total, item) => total + item.weight * item.quantity, 0);
    const recommended = VEHICLES.find((candidate) => volume <= candidate.capacity && weight <= candidate.payload) ?? VEHICLES[VEHICLES.length - 1]!;
    const selected = input.vehicleName ? VEHICLES.find((candidate) => candidate.name === input.vehicleName) : undefined;
    if (selected && (selected.capacity < volume || selected.payload < weight)) {
      throw new ValidationError(`The selected ${selected.name} cannot safely carry this ${volume.toFixed(1)} m³ / ${weight.toFixed(0)} kg load`);
    }
    const vehicle = selected ?? recommended;
    const price = Math.round(vehicle.base + input.distance * 1.15 + volume * 4);
    const now = new Date();
    let cursor = now.getTime();
    const stages: MoveStage[] = STAGES.map((stage, index) => {
      if (index > 0) cursor += (STAGES[index - 1]?.minutes ?? 0) * 60_000;
      return { key: stage.key, title: stage.title, detail: stage.detail, durationMinutes: stage.minutes, estimatedAt: new Date(cursor), completedAt: index === 0 ? now : null };
    });
    const reference = `MU-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const trackingToken = randomBytes(24).toString('hex');
    const move = await MoveModel.create({ reference, clientId, trackingToken, pickupAddress: input.pickupAddress, destinationAddress: input.destinationAddress, items: input.items, volume, distance: input.distance, estimatedPrice: price, vehicle: { name: vehicle.name, capacity: vehicle.capacity, payload: vehicle.payload }, mover: { userId: String(mover._id), name: mover.name, phone: mover.phone, companyName: 'Mehdi Transport' }, currentStage: 'ASSIGNED', stages: stages.map((stage, index) => index === 1 ? { ...stage, completedAt: now } : stage) });
    return { ...serialize(move), trackingToken };
  }

  async findOne(id: string, trackingToken: string) {
    await connectMongo();
    const move = await MoveModel.findOne({ _id: id, trackingToken }).select('+trackingToken');
    if (!move) throw new NotFoundError('Move');
    return serialize(move);
  }

  async advance(id: string, stage: MoveStageKey, actor: { sub: string; role: string }) {
    await connectMongo();
    const move = await MoveModel.findById(id);
    if (!move) throw new NotFoundError('Move');
    if (actor.role !== 'ADMIN' && (actor.role !== 'MOVER' || actor.sub !== move.mover.userId)) {
      throw new ValidationError('You cannot update this move');
    }
    const requestedIndex = STAGES.findIndex((entry) => entry.key === stage);
    const currentIndex = STAGES.findIndex((entry) => entry.key === move.currentStage);
    if (requestedIndex < currentIndex || requestedIndex > currentIndex + 1) throw new ValidationError('Stages must be advanced one step at a time');
    const now = new Date();
    const selected = move.stages.find((entry) => entry.key === stage);
    if (selected) selected.completedAt = now;
    move.currentStage = stage;
    await move.save();
    return serialize(move);
  }
}

export const movesService = new MovesService();
