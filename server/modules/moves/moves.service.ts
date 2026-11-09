import mongoose from 'mongoose';
import { connectMongo } from '../../shared/database/mongoose';
import {
  MoveModel,
  type MoveDoc,
  type MoveStageKey,
} from '../../shared/database/models/move.model';
import {
  MoveRequestModel,
  type MoveRequestDoc,
} from '../../shared/database/models/move-request.model';
import { moverRepository } from '../mover/mover.repository';
import { dispatchMove } from '../mover/mover.dispatch';
import { confirmDelivery, updateJobStatus } from '../mover/mover.jobs';
import type { JobAction } from '../../../types/mover';
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

export const MOVE_STAGES_SPEC: {
  key: MoveStageKey;
  title: string;
  detail: string;
  minutes: number | null;
}[] = [
  {
    key: 'CONFIRMED',
    title: 'Booking confirmed',
    detail: 'Your move request has been confirmed and scheduled.',
    minutes: 0,
  },
  {
    key: 'ASSIGNED',
    title: 'Vehicle assigned',
    detail: 'A vetted vehicle and mover team have been assigned.',
    minutes: 12,
  },
  {
    key: 'EN_ROUTE',
    title: 'Driver en route',
    detail: 'Driver is travelling to your pickup location.',
    minutes: 18,
  },
  {
    key: 'ARRIVED',
    title: 'Vehicle arrives',
    detail: 'Driver arrives at pickup location and prepares loading.',
    minutes: 5,
  },
  {
    key: 'LOADING',
    title: 'Loading starts',
    detail: 'Furniture and boxes are inventoried and loaded into the vehicle.',
    minutes: 45,
  },
  {
    key: 'IN_TRANSIT',
    title: 'In transit',
    detail: 'Your cargo is securely on the road to destination.',
    minutes: 26,
  },
  {
    key: 'DELIVERY',
    title: 'Delivery',
    detail: 'Unloading items at the delivery address.',
    minutes: 35,
  },
  {
    key: 'COMPLETED',
    title: 'Move completed',
    detail: 'Move delivered. Please confirm and review your service.',
    minutes: null,
  },
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
    vehicle: {
      name: move.vehicle.name,
      capacity: move.vehicle.capacity,
      payload: move.vehicle.payload,
    },
    mover: {
      userId: move.mover.userId,
      name: move.mover.name,
      phone: move.mover.phone,
      companyName: move.mover.companyName,
    },
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

function recommendVehicle(volume: number, weight: number) {
  return (
    VEHICLES.find((candidate) => volume <= candidate.capacity && weight <= candidate.payload) ??
    VEHICLES[VEHICLES.length - 1]!
  );
}

/** Timeline step reached by a mover-side request (status + progress stage). */
function requestStage(move: Pick<MoveRequestDoc, 'status' | 'progressStage'>): MoveStageKey {
  switch (move.status) {
    case 'ASSIGNED':
      return 'ASSIGNED';
    case 'EN_ROUTE':
      return 'EN_ROUTE';
    case 'IN_PROGRESS':
      return move.progressStage === 'IN_TRANSIT' ? 'IN_TRANSIT' : 'LOADING';
    case 'DELIVERED':
      return 'DELIVERY';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return 'CONFIRMED';
  }
}

const SLOT_START_HOUR: Record<string, number> = { MORNING: 8, AFTERNOON: 13, FULL_DAY: 8 };

/**
 * The 8-step tracking timeline for a request: steps reached are dated from the
 * status history, upcoming ones estimated from the booked day and slot.
 */
function requestTimeline(
  move: MoveRequestDoc,
  history: { toStatus: string; note: string; createdAt: Date }[],
) {
  const reached = MOVE_STAGES_SPEC.findIndex((stage) => stage.key === requestStage(move));
  const firstEvent = (status: string) =>
    history.find((event) => event.toStatus === status)?.createdAt;
  const loadingEvents = history.filter((event) => event.toStatus === 'IN_PROGRESS');
  const doneAt: Partial<Record<MoveStageKey, Date | undefined>> = {
    CONFIRMED: firstEvent('SUBMITTED') ?? move.createdAt,
    ASSIGNED: firstEvent('ASSIGNED') ?? move.assignedAt ?? undefined,
    EN_ROUTE: firstEvent('EN_ROUTE'),
    ARRIVED: loadingEvents[0]?.createdAt,
    LOADING: loadingEvents[0]?.createdAt,
    IN_TRANSIT: loadingEvents[1]?.createdAt,
    DELIVERY: firstEvent('DELIVERED') ?? move.deliveredAt ?? undefined,
    COMPLETED: firstEvent('COMPLETED') ?? move.completedAt ?? undefined,
  };
  const waiting = move.status === 'SUBMITTED' || move.status === 'QUOTING';
  let cursor =
    new Date(`${move.moveDate}T00:00:00`).getTime() +
    (SLOT_START_HOUR[move.timeSlot] ?? 8) * 3_600_000;
  return MOVE_STAGES_SPEC.map((stage, index) => {
    if (index > 1) cursor += (MOVE_STAGES_SPEC[index - 1]?.minutes ?? 0) * 60_000;
    const done = index <= reached ? (doneAt[stage.key] ?? move.updatedAt) : null;
    const detail =
      stage.key === 'CONFIRMED' && waiting
        ? 'Your request was sent to verified movers. You will see the mover here once one accepts.'
        : stage.key === 'COMPLETED' && move.status === 'DELIVERED'
          ? 'The mover marked the move as delivered. Confirm delivery, or open a claim if something is wrong.'
          : stage.detail;
    return {
      key: stage.key,
      title: stage.key === 'CONFIRMED' && waiting ? 'Request sent to movers' : stage.title,
      detail,
      durationMinutes: stage.minutes,
      estimatedAt: (done ?? new Date(cursor)).toISOString(),
      completedAt: done ? done.toISOString() : null,
    };
  });
}

/** Tracking step a mover can report, mapped to the mover-side job action. */
const STAGE_TO_JOB_ACTION: Partial<Record<MoveStageKey, JobAction>> = {
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'LOADING',
  LOADING: 'LOADING',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERY: 'DELIVERED',
};

export class MovesService {
  private address(value: string) {
    const normalized = value.toLowerCase();
    const city = normalized.includes('sfax')
      ? 'Sfax'
      : normalized.includes('sousse')
        ? 'Sousse'
        : normalized.includes('bizerte')
          ? 'Bizerte'
          : normalized.includes('nabeul')
            ? 'Nabeul'
            : normalized.includes('kairouan')
              ? 'Kairouan'
              : 'Tunis';
    const zone =
      city === 'Sfax'
        ? 'SFA'
        : city === 'Sousse'
          ? 'SOU'
          : city === 'Bizerte'
            ? 'BIZ'
            : city === 'Nabeul'
              ? 'NAB'
              : city === 'Kairouan'
                ? 'KAI'
                : 'TUN';
    return {
      street: value,
      city,
      zone,
      postalCode: '',
      floor: 0,
      hasElevator: false,
      accessNotes: '',
    };
  }

  /**
   * The client-facing view of a mover-side request: the 8-step tracking timeline
   * rebuilt from its status history, the real assigned mover, distance and vehicle.
   * `currentStage` is a timeline step; `status` is the request's own status.
   */
  private async serializeRequest(move: MoveRequestDoc, includeQuotes = false) {
    const moveId = String(move._id);
    const [quotes, history] = await Promise.all([
      includeQuotes ? moverRepository.listQuotesForMove(moveId) : Promise.resolve([]),
      moverRepository.listStatusEvents(moveId),
    ]);
    const quoteData = await Promise.all(
      quotes.map(async (quote) => {
        const [user, profile] = await Promise.all([
          moverRepository.findUser(quote.moverId),
          moverRepository.findProfile(quote.moverId),
        ]);
        return {
          id: String(quote._id),
          moverId: quote.moverId,
          moverName: profile?.companyName || user?.name || 'Verified mover',
          amount: quote.amount,
          currency: quote.currency,
          message: quote.message,
          status: quote.status,
          validUntil: quote.validUntil.toISOString(),
        };
      }),
    );

    const [assignedUser, assignedProfile] = move.assignedMoverId
      ? await Promise.all([
          moverRepository.findUser(move.assignedMoverId),
          moverRepository.findProfile(move.assignedMoverId),
        ])
      : [null, null];
    const vehicleName = move.vehicleName ?? recommendVehicle(move.volumeM3, 0).name;
    const vehicle = VEHICLES.find((candidate) => candidate.name === vehicleName);

    return {
      id: moveId,
      reference: move.reference,
      clientId: move.clientId,
      source: 'request' as const,
      status: move.status,
      progressStage: move.progressStage,
      moveDate: move.moveDate,
      timeSlot: move.timeSlot,
      pickupAddress: move.pickup.street,
      destinationAddress: move.dropoff.street,
      distance: move.distanceKm ?? 0,
      volume: move.volumeM3,
      estimatedPrice: move.finalPrice ?? move.estimatedPrice ?? 0,
      currentStage: requestStage(move),
      items: move.items.map((item, index) => ({
        id: item.key || String(index),
        name: item.name,
        volume: item.volume ?? 0,
        weight: item.weight ?? 0,
        quantity: item.quantity,
      })),
      vehicle: {
        name: vehicleName,
        capacity: vehicle?.capacity ?? 0,
        payload: vehicle?.payload ?? 0,
      },
      mover: move.assignedMoverId
        ? {
            userId: move.assignedMoverId,
            name: assignedUser?.name ?? 'Assigned mover',
            phone: assignedUser?.phone ?? '',
            companyName: assignedProfile?.companyName ?? '',
          }
        : { userId: undefined, name: 'Awaiting a mover', phone: '', companyName: '' },
      pickup: move.pickup,
      dropoff: move.dropoff,
      offersSent: 0,
      quotes: quoteData,
      history: history.map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        createdAt: event.createdAt.toISOString(),
      })),
      stages: requestTimeline(move, history),
      createdAt: move.createdAt.toISOString(),
      updatedAt: move.updatedAt.toISOString(),
    };
  }

  async create(input: MoveCreateInput, clientId: string) {
    await connectMongo();
    const volume = Number(
      input.items.reduce((total, item) => total + item.volume * item.quantity, 0).toFixed(2),
    );
    const weight = Math.round(
      input.items.reduce((total, item) => total + item.weight * item.quantity, 0),
    );
    const recommended =
      VEHICLES.find((candidate) => volume <= candidate.capacity && weight <= candidate.payload) ??
      VEHICLES[VEHICLES.length - 1]!;
    const selected = input.vehicleName
      ? VEHICLES.find((candidate) => candidate.name === input.vehicleName)
      : undefined;
    if (selected && (selected.capacity < volume || selected.payload < weight)) {
      throw new ValidationError(
        `The selected ${selected.name} cannot safely carry this ${volume.toFixed(1)} m³ / ${weight.toFixed(0)} kg load`,
      );
    }
    const vehicle = selected ?? recommended;
    const price = Math.round(vehicle.base + input.distance * 1.15 + volume * 4);
    const reference = `MU-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    const move = await moverRepository.createMove({
      reference,
      clientId,
      pickup: { ...this.address(input.pickupAddress), ...input.pickup },
      dropoff: { ...this.address(input.destinationAddress), ...input.dropoff },
      moveDate: input.moveDate ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      timeSlot: input.timeSlot ?? 'FULL_DAY',
      housingType: input.housingType ?? '',
      sizeRooms: input.sizeRooms ?? 0,
      volumeM3: volume,
      extraServices: input.extraServices ?? [],
      notes: input.notes ?? '',
      distanceKm: input.distance,
      vehicleName: vehicle.name,
      items: input.items.map((item) => ({
        key: item.id,
        name: item.name,
        quantity: item.quantity,
        category: item.category ?? '',
        isFragile: item.isFragile ?? false,
        needsDisassembly: item.needsDisassembly ?? false,
        volume: item.volume,
        weight: item.weight,
        room: item.room ?? '',
      })),
      status: 'SUBMITTED',
      progressStage: null,
      estimatedPrice: price,
      finalPrice: null,
      assignedMoverId: null,
      assignedAt: null,
      deliveredAt: null,
      completedAt: null,
    });
    await moverRepository.addStatusEvent({
      moveId: String(move._id),
      fromStatus: null,
      toStatus: 'SUBMITTED',
      note: 'Move request submitted by client',
      actorId: clientId,
    });
    const { offersSent } = await dispatchMove(String(move._id), { actorId: clientId });
    const refreshed = (await MoveRequestModel.findById(move._id).lean()) as MoveRequestDoc | null;
    return { ...(await this.serializeRequest(refreshed ?? move, true)), offersSent };
  }

  async findOne(
    identifier: string,
    trackingToken?: string | null,
    actor?: AccessTokenPayload | null,
  ) {
    await connectMongo();

    const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isMongoId
      ? { _id: identifier }
      : { reference: new RegExp(`^${identifier.trim()}$`, 'i') };

    const move = await MoveModel.findOne(query).select('+trackingToken');
    if (!move) {
      const request = await MoveRequestModel.findOne(
        isMongoId ? { _id: identifier } : { reference: new RegExp(`^${identifier.trim()}$`, 'i') },
      ).lean<MoveRequestDoc | null>();
      if (!request) throw new NotFoundError('Move not found with this reference or ID');
      const allowed =
        actor &&
        (actor.role === 'ADMIN' ||
          (actor.role === 'CLIENT' && request.clientId === actor.sub) ||
          (actor.role === 'MOVER' && request.assignedMoverId === actor.sub));
      if (!allowed) throw new ForbiddenError('Please sign in to track this move');
      return this.serializeRequest(
        request,
        actor?.role === 'CLIENT' && request.clientId === actor.sub,
      );
    }

    // Access authorization check
    let authorized = false;

    // 1. Token matches tracking link
    if (trackingToken && move.trackingToken === trackingToken) {
      authorized = true;
    }
    // 2. Authenticated user is the client who owns the move
    else if (
      actor &&
      (actor.role === 'CLIENT' || actor.role === 'ADMIN') &&
      (move.clientId === actor.sub || actor.role === 'ADMIN')
    ) {
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
      throw new ForbiddenError(
        'Please provide a valid tracking link or sign in to track this move',
      );
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
    const requestQuery =
      actor.role === 'CLIENT'
        ? { clientId: actor.sub }
        : actor.role === 'MOVER'
          ? { assignedMoverId: actor.sub }
          : {};
    const requests = await MoveRequestModel.find(requestQuery)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean<MoveRequestDoc[]>();
    const serializedRequests = await Promise.all(
      requests.map((request) => this.serializeRequest(request, actor.role === 'CLIENT')),
    );
    return [...moves.map(serialize), ...serializedRequests].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async advance(identifier: string, stage: MoveStageKey, actor: AccessTokenPayload) {
    await connectMongo();

    const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
    const query = isMongoId ? { _id: identifier } : { reference: identifier.trim() };
    const move = await MoveModel.findOne(query);

    if (!move) return this.advanceRequest(identifier, stage, actor);

    // Role check: Admin, assigned Mover, or Client confirming completion
    const isMover = actor.role === 'MOVER' && move.mover.userId === actor.sub;
    const isAdmin = actor.role === 'ADMIN';
    const isClientCompleting =
      actor.role === 'CLIENT' && move.clientId === actor.sub && stage === 'COMPLETED';

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

  /**
   * Progress on a booked request goes through the mover-side rules: the assigned
   * mover reports each step (with its photo checks), the client confirms delivery
   * (which completes the job and creates the mover's earning). Nobody else can
   * move it forward from the tracking page.
   */
  private async advanceRequest(identifier: string, stage: MoveStageKey, actor: AccessTokenPayload) {
    const isMongoId = mongoose.Types.ObjectId.isValid(identifier);
    const request = await MoveRequestModel.findOne(
      isMongoId ? { _id: identifier } : { reference: identifier.trim() },
    ).lean<MoveRequestDoc | null>();
    if (!request) throw new NotFoundError('Move');
    const moveId = String(request._id);

    if (actor.role === 'CLIENT' && request.clientId === actor.sub && stage === 'COMPLETED') {
      await confirmDelivery(actor.sub, moveId);
    } else if (actor.role === 'MOVER' && request.assignedMoverId === actor.sub) {
      const action = STAGE_TO_JOB_ACTION[stage];
      if (!action) throw new ValidationError('This step is not reported by the mover');
      await updateJobStatus(actor.sub, moveId, action);
    } else if (actor.role === 'ADMIN') {
      throw new ForbiddenError(
        'Progress on a booked request is reported by the mover in the mover app',
      );
    } else {
      throw new ForbiddenError('You are not authorized to update this move progress');
    }

    const refreshed = await MoveRequestModel.findById(moveId).lean<MoveRequestDoc | null>();
    return this.serializeRequest(refreshed ?? request, actor.role === 'CLIENT');
  }
}

export const movesService = new MovesService();
