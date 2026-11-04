import { hashPassword } from '../../shared/auth/password';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectMongo } from '../../shared/database/mongoose';
import { MoveModel, type MoveDoc, type MoveStage, type MoveStageKey } from '../../shared/database/models/move.model';
import { MoverProfileModel } from '../../shared/database/models/mover-profile.model';
import { UserModel } from '../../shared/database/models/user.model';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/database/errors';
import type { MoveCreateInput } from './moves.schema';
import type { AccessTokenPayload } from '../../shared/auth/jwt';

const VEHICLES = [
  { name: 'Small Partner van', capacity: 3.5, payload: 600, base: 35 },
  { name: 'Compact van', capacity: 6, payload: 1000, base: 45 },
  { name: 'Moving van', capacity: 14, payload: 1800, base: 75 },
  { name: 'Box truck', capacity: 28, payload: 3500, base: 115 },
  { name: 'Large truck', capacity: 45, payload: 7500, base: 165 },
];

export const MOVE_STAGES_SPEC: { key: MoveStageKey; title: string; detail: string; minutes: number | null }[] = [
  { key: 'CONFIRMED', title: 'Booking confirmed', detail: 'Your move request has been confirmed and scheduled.', minutes: 0 },
  { key: 'ASSIGNED', title: 'Vehicle assigned', detail: 'A vetted vehicle and mover team have been assigned.', minutes: 12 },
  { key: 'EN_ROUTE', title: 'Driver en route', detail: 'Driver is travelling to your pickup location.', minutes: 18 },
  { key: 'ARRIVED', title: 'Vehicle arrives', detail: 'Driver arrives at pickup location and prepares loading.', minutes: 5 },
  { key: 'LOADING', title: 'Loading starts', detail: 'Furniture and boxes are inventoried and loaded into the vehicle.', minutes: 45 },
  { key: 'IN_TRANSIT', title: 'In transit', detail: 'Your cargo is securely on the road to destination.', minutes: 26 },
  { key: 'DELIVERY', title: 'Delivery', detail: 'Unloading items at the delivery address.', minutes: 35 },
  { key: 'COMPLETED', title: 'Move completed', detail: 'Move delivered. Please confirm and review your service.', minutes: null },
];

function serialize(move: MoveDoc) {
  return {
    id: String(move._id),
    reference: move.reference,
    clientId: move.clientId,
    pickupAddress: move.pickupAddress,
    destinationAddress: move.destinationAddress,
    items: move.items.map((item) => ({
      id: item.id,
      name: item.name,
      volume: item.volume,
      weight: item.weight,
      quantity: item.quantity,
    })),
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
      mover = await UserModel.create({
        email: 'mover@moveup.tn',
        passwordHash: await hashPassword('Demo#2026!'),
        name: 'Mehdi Transport',
        phone: '+21698123456',
        role: 'MOVER',
        locale: 'en',
        status: 'ACTIVE',
      });
    }
    await MoverProfileModel.findOneAndUpdate(
      { userId: String(mover._id) },
      {
        $set: {
          companyName: 'Mehdi Transport',
          bio: 'Moving van, 14 m³ — Greater Tunis.',
          zones: ['TUN'],
          verificationStatus: 'APPROVED',
        },
      },
      { upsert: true },
    );
    return mover;
  }

  async create(input: MoveCreateInput, clientId: string) {
    const mover = await this.ensureDemoMover();
    const volume = Number(input.items.reduce((total, item) => total + item.volume * item.quantity, 0).toFixed(2));
    const weight = Math.round(input.items.reduce((total, item) => total + item.weight * item.quantity, 0));
    const recommended = VEHICLES.find((candidate) => volume <= candidate.capacity && weight <= candidate.payload) ?? VEHICLES[VEHICLES.length - 1]!;
    const selected = input.vehicleName ? VEHICLES.find((candidate) => candidate.name === input.vehicleName) : undefined;
    if (selected && (selected.capacity < volume || selected.payload < weight)) {
      throw new ValidationError(`The selected ${selected.name} cannot safely carry this ${volume.toFixed(1)} m³ / ${weight.toFixed(0)} kg load`);
    }
    const vehicle = selected ?? recommended;
    const price = Math.round(vehicle.base + input.distance * 1.15 + volume * 4);
    const now = new Date();
    let cursor = now.getTime();
    const stages: MoveStage[] = MOVE_STAGES_SPEC.map((stage, index) => {
      if (index > 0) cursor += (MOVE_STAGES_SPEC[index - 1]?.minutes ?? 0) * 60_000;
      return {
        key: stage.key,
        title: stage.title,
        detail: stage.detail,
        durationMinutes: stage.minutes,
        estimatedAt: new Date(cursor),
        completedAt: index <= 1 ? now : null,
      };
    });
    const reference = `MU-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const trackingToken = randomBytes(24).toString('hex');

    const move = await MoveModel.create({
      reference,
      clientId,
      trackingToken,
      pickupAddress: input.pickupAddress,
      destinationAddress: input.destinationAddress,
      items: input.items,
      volume,
      distance: input.distance,
      estimatedPrice: price,
      vehicle: { name: vehicle.name, capacity: vehicle.capacity, payload: vehicle.payload },
      mover: { userId: String(mover._id), name: mover.name, phone: mover.phone, companyName: 'Mehdi Transport' },
      currentStage: 'ASSIGNED',
      stages,
    });

    return { ...serialize(move), trackingToken };
  }

  async findOne(identifier: string, trackingToken?: string | null, actor?: AccessTokenPayload | null) {
    await connectMongo();

    const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isMongoId
      ? { _id: identifier }
      : { reference: new RegExp(`^${identifier.trim()}$`, 'i') };

    const move = await MoveModel.findOne(query).select('+trackingToken');
    if (!move) {
      throw new NotFoundError('Move not found with this reference or ID');
    }

    // Access authorization check
    let authorized = false;

    // 1. Token matches tracking link
    if (trackingToken && move.trackingToken === trackingToken) {
      authorized = true;
    }
    // 2. Authenticated user is the client who owns the move
    else if (actor && (actor.role === 'CLIENT' || actor.role === 'ADMIN') && (move.clientId === actor.sub || actor.role === 'ADMIN')) {
      authorized = true;
    }
    // 3. Authenticated user is the assigned mover
    else if (actor && actor.role === 'MOVER' && move.mover.userId === actor.sub) {
      authorized = true;
    }
    // 4. If query was by exact reference code, allow read-only tracking view
    else if (!isMongoId && move.reference.toLowerCase() === identifier.trim().toLowerCase()) {
      authorized = true;
    }

    if (!authorized) {
      throw new ForbiddenError('Please provide a valid tracking link or sign in to track this move');
    }

    return {
      ...serialize(move),
      trackingToken: move.trackingToken,
    };
  }

  async list(actor: AccessTokenPayload) {
    await connectMongo();

    let query: Record<string, unknown> = {};
    if (actor.role === 'CLIENT') {
      query = { clientId: actor.sub };
    } else if (actor.role === 'MOVER') {
      query = { 'mover.userId': actor.sub };
    }

    const moves = await MoveModel.find(query).sort({ createdAt: -1 }).limit(50);
    return moves.map(serialize);
  }

  async advance(identifier: string, stage: MoveStageKey, actor: AccessTokenPayload) {
    await connectMongo();

    const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isMongoId ? { _id: identifier } : { reference: identifier.trim() };
    const move = await MoveModel.findOne(query);

    if (!move) throw new NotFoundError('Move');

    // Role check: Admin, assigned Mover, or Client confirming completion
    const isMover = actor.role === 'MOVER' && move.mover.userId === actor.sub;
    const isAdmin = actor.role === 'ADMIN';
    const isClientCompleting = actor.role === 'CLIENT' && move.clientId === actor.sub && stage === 'COMPLETED';

    if (!isAdmin && !isMover && !isClientCompleting) {
      throw new ForbiddenError('You are not authorized to update this move progress');
    }

    const requestedIndex = MOVE_STAGES_SPEC.findIndex((entry) => entry.key === stage);
    if (requestedIndex < 0) throw new ValidationError('Invalid move stage');

    const now = new Date();

    // Mark all stages up to requested as completed if not already
    move.stages.forEach((s, idx) => {
      if (idx <= requestedIndex && !s.completedAt) {
        s.completedAt = now;
      }
    });

    move.currentStage = stage;
    await move.save();

    return serialize(move);
  }
}

export const movesService = new MovesService();
