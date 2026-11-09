import {
  BadRequestError,
  DomainError,
  NotFoundError,
  ValidationError,
} from '../../shared/database/errors';
import type { Role } from '../../shared/database/enums';
import type { MoveRequestDoc } from '../../shared/database/models';
import type {
  JobAction,
  JobDetailDto,
  JobsListDto,
  MessageDto,
  MessageThread,
  MoverPhotoStage,
  PhotoDto,
} from '../../../types/mover';
import {
  CHAT_OPEN_STATUSES,
  CONTACT_VISIBLE_STATUSES,
  MAX_PHOTOS_PER_STAGE,
  MAX_UPLOAD_BYTES,
  MIN_DELIVERY_PHOTOS,
  MIN_LOAD_PHOTOS,
} from './mover.constants';
import { completeMove } from './mover.completion';
import { sweep } from './mover.dispatch';
import { notify } from './mover.notifications';
import { moverRepository as repo } from './mover.repository';
import {
  boxScanOpen,
  expectedLoad,
  JOB_TRANSITIONS,
  nextJobAction,
  sniffFile,
} from './mover.rules';
import type { LoadCheckInput } from './mover.schema';
import {
  serializeAddress,
  serializeArea,
  serializeBoxScan,
  serializeItems,
  serializeJobSummary,
  serializeMessage,
  serializePhoto,
  serializeStatusEvent,
} from './mover.serializer';
import { moverStorage } from './mover.storage';
import { maybeRetrainDurationModel } from './mover.duration-training';

class ProofRequiredError extends DomainError {
  constructor(message: string) {
    super(message, 409, 'PROOF_REQUIRED');
  }
}

class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super(message, 409, 'INVALID_TRANSITION');
  }
}

function contactVisible(status: string): boolean {
  return (CONTACT_VISIBLE_STATUSES as readonly string[]).includes(status);
}

export async function listJobs(moverId: string): Promise<JobsListDto> {
  await sweep();
  const moves = await repo.listAssignedMoves(moverId);
  const isLive = (move: MoveRequestDoc) => contactVisible(move.status);
  return {
    active: moves.filter(isLive).map(serializeJobSummary),
    past: moves
      .filter((move) => !isLive(move))
      .map(serializeJobSummary)
      .reverse(),
  };
}

/** Returning 404 for someone else's job also hides that the job exists. */
export async function ownedMove(moverId: string, moveId: string): Promise<MoveRequestDoc> {
  const move = await repo.findAssignedMove(moverId, moveId);
  if (!move) throw new NotFoundError('Job');
  return move;
}

export async function getJob(moverId: string, moveId: string): Promise<JobDetailDto> {
  await sweep();
  const move = await ownedMove(moverId, moveId);
  const visible = contactVisible(move.status);
  const client = visible ? await repo.findUser(move.clientId) : null;
  const [events, loadPhotos, deliveryPhotos, boxes, unreadClient, unreadSupport] =
    await Promise.all([
      repo.listStatusEvents(moveId),
      repo.countPhotos(moveId, 'LOAD'),
      repo.countPhotos(moveId, 'DELIVERY'),
      repo.listBoxScans(moveId),
      repo.countUnread(moveId, 'MOVER_CLIENT', moverId),
      repo.countUnread(moveId, 'MOVER_SUPPORT', moverId),
    ]);

  return {
    ...serializeJobSummary(move),
    housingType: move.housingType,
    sizeRooms: move.sizeRooms,
    volumeM3: move.volumeM3,
    extraServices: move.extraServices,
    items: serializeItems(move.items),
    pickup: visible ? serializeAddress(move.pickup) : serializeArea(move.pickup),
    dropoff: visible ? serializeAddress(move.dropoff) : serializeArea(move.dropoff),
    client: client ? { name: client.name, phone: client.phone } : null,
    notes: visible ? move.notes : null,
    contactVisible: visible,
    nextAction: nextJobAction(move),
    proof: {
      minLoadPhotos: MIN_LOAD_PHOTOS,
      loadPhotos,
      minDeliveryPhotos: MIN_DELIVERY_PHOTOS,
      deliveryPhotos,
      loadCheck: move.loadCheck
        ? {
            boxes: move.loadCheck.boxes,
            furniture: move.loadCheck.furniture,
            note: move.loadCheck.note,
            confirmedAt: move.loadCheck.confirmedAt.toISOString(),
          }
        : null,
      expectedLoad: expectedLoad(move.items),
      boxes: boxes.map(serializeBoxScan),
      canScanBoxes: boxScanOpen(move),
    },
    timeline: events.map(serializeStatusEvent),
    canChat: (CHAT_OPEN_STATUSES as readonly string[]).includes(move.status),
    unread: { MOVER_CLIENT: unreadClient, MOVER_SUPPORT: unreadSupport },
  };
}

/** The status buttons stay locked until the proof exists; the screen only mirrors this. */
async function assertProofFor(move: MoveRequestDoc, action: JobAction): Promise<void> {
  const moveId = String(move._id);
  if (action === 'IN_TRANSIT') {
    if ((await repo.countPhotos(moveId, 'LOAD')) < MIN_LOAD_PHOTOS) {
      throw new ProofRequiredError(`Add at least ${MIN_LOAD_PHOTOS} photos of the loaded vehicle`);
    }
    if (!move.loadCheck) throw new ProofRequiredError('Confirm your load count before leaving');
  }
  if (
    action === 'DELIVERED' &&
    (await repo.countPhotos(moveId, 'DELIVERY')) < MIN_DELIVERY_PHOTOS
  ) {
    throw new ProofRequiredError('Add a photo of everything delivered first');
  }
}

/**
 * The mover's count of what is on the vehicle. Boxes are the ones scanned at
 * pickup; furniture is typed. It can be corrected until they leave.
 */
export async function confirmLoad(
  moverId: string,
  moveId: string,
  input: LoadCheckInput,
): Promise<JobDetailDto> {
  const move = await ownedMove(moverId, moveId);
  if (move.status !== 'IN_PROGRESS' || move.progressStage !== 'LOADING') {
    throw new InvalidTransitionError('The load can only be confirmed during loading');
  }
  if ((await repo.countPhotos(moveId, 'LOAD')) < MIN_LOAD_PHOTOS) {
    throw new ProofRequiredError(`Add at least ${MIN_LOAD_PHOTOS} photos of the loaded vehicle`);
  }
  const boxes = await repo.countBoxScans(moveId);
  if (boxes + input.furniture === 0) {
    throw new ValidationError('Scan the boxes, or enter the furniture you loaded');
  }
  const saved = await repo.saveLoadCheck(moveId, moverId, {
    boxes,
    furniture: input.furniture,
    note: input.note ?? '',
    confirmedAt: new Date(),
    confirmedBy: moverId,
  });
  if (!saved) throw new InvalidTransitionError('The load can only be confirmed during loading');

  const expected = expectedLoad(move.items);
  const differs =
    expected !== null && (expected.boxes !== boxes || expected.furniture !== input.furniture);
  await repo.addStatusEvent({
    moveId,
    fromStatus: 'IN_PROGRESS',
    toStatus: 'IN_PROGRESS',
    note: `Load confirmed: ${boxes} boxes scanned, ${input.furniture} furniture${
      differs ? `. Client listed ${expected.boxes} boxes, ${expected.furniture} furniture` : ''
    }${input.note ? `. Note: ${input.note}` : ''}`,
    actorId: moverId,
  });
  return getJob(moverId, moveId);
}

/** M-06. Only the next step in the sequence is accepted, and only once. */
export async function updateJobStatus(
  moverId: string,
  moveId: string,
  action: JobAction,
): Promise<JobDetailDto> {
  const move = await ownedMove(moverId, moveId);
  const transition = JOB_TRANSITIONS[action];
  const now = new Date();

  // Only the actual next step is checked, so a wrong step still reads as a wrong step.
  if (nextJobAction(move) === action) await assertProofFor(move, action);

  const updated = await repo.advanceMove(
    moveId,
    moverId,
    transition.from,
    transition.to,
    action === 'DELIVERED' ? { deliveredAt: now } : {},
  );
  if (!updated) {
    throw new InvalidTransitionError(`"${transition.label}" is not the next step for this job`);
  }

  await repo.addStatusEvent({
    moveId,
    fromStatus: move.status,
    toStatus: transition.to.status,
    note: transition.label,
    actorId: moverId,
  });
  await notify(move.clientId, {
    type: 'JOB_STATUS',
    title: `Move ${move.reference}: ${transition.label.toLowerCase()}`,
    body:
      action === 'DELIVERED'
        ? 'Please confirm delivery, or open a claim within 48 hours.'
        : 'Your mover updated the status of your move.',
    link: '/dashboard',
  });
  // A delivered job is a new example of how long jobs take.
  if (action === 'DELIVERED') {
    await maybeRetrainDurationModel(now).catch((error: unknown) => {
      console.error('Duration model training failed:', error);
    });
  }
  return getJob(moverId, moveId);
}

/** Client confirmation of delivery. The client UI will call this route. */
export async function confirmDelivery(clientId: string, moveId: string): Promise<void> {
  const move = await repo.findMove(moveId);
  if (!move || move.clientId !== clientId) throw new NotFoundError('Move');
  if (move.status !== 'DELIVERED') {
    throw new InvalidTransitionError('Only a delivered move can be confirmed');
  }
  const completed = await completeMove(move, clientId, 'Client confirmed delivery', new Date());
  if (!completed) throw new InvalidTransitionError('This move has already been closed');
}

// ---------- chat ----------

/** Who may use which conversation. Admins read and answer everything (A-07). */
const THREAD_ACCESS: Record<string, MessageThread[]> = {
  MOVER: ['MOVER_CLIENT', 'MOVER_SUPPORT'],
  CLIENT: ['MOVER_CLIENT', 'CLIENT_SUPPORT'],
  ADMIN: ['MOVER_CLIENT', 'MOVER_SUPPORT', 'CLIENT_SUPPORT'],
};

interface ChatActor {
  sub: string;
  role: Role;
}

async function chatMove(actor: ChatActor, moveId: string, thread: MessageThread) {
  const move = await repo.findMove(moveId);
  if (!move) throw new NotFoundError('Move');

  const party =
    actor.role === 'ADMIN' ||
    (actor.role === 'MOVER' && move.assignedMoverId === actor.sub) ||
    (actor.role === 'CLIENT' && move.clientId === actor.sub);
  if (!party || !(THREAD_ACCESS[actor.role] ?? []).includes(thread)) {
    throw new NotFoundError('Move');
  }
  return move;
}

export async function listMessages(
  actor: ChatActor,
  moveId: string,
  thread: MessageThread,
): Promise<MessageDto[]> {
  await chatMove(actor, moveId, thread);
  await repo.markThreadRead(moveId, thread, actor.sub, new Date());
  const messages = await repo.listMessages(moveId, thread);
  return messages.map((message) => serializeMessage(message, actor.sub));
}

export async function sendMessage(
  actor: ChatActor,
  moveId: string,
  thread: MessageThread,
  body: string,
): Promise<MessageDto> {
  const move = await chatMove(actor, moveId, thread);
  if (!(CHAT_OPEN_STATUSES as readonly string[]).includes(move.status)) {
    throw new BadRequestError('Chat is closed for this move');
  }
  const message = await repo.createMessage({
    moveId,
    thread,
    senderId: actor.sub,
    senderRole: actor.role,
    body,
  });

  const preview = body.length > 80 ? `${body.slice(0, 77)}...` : body;
  if (actor.role !== 'MOVER' && thread !== 'CLIENT_SUPPORT' && move.assignedMoverId) {
    await notify(move.assignedMoverId, {
      type: 'MESSAGE',
      title: `${actor.role === 'CLIENT' ? 'Client' : 'Support'} message on ${move.reference}`,
      body: preview,
      link: `/mover/jobs/${moveId}`,
    });
  }
  if (actor.role !== 'CLIENT' && thread !== 'MOVER_SUPPORT') {
    await notify(move.clientId, {
      type: 'MESSAGE',
      title: `New message on ${move.reference}`,
      body: preview,
      link: '/dashboard',
    });
  }
  return serializeMessage(message, actor.sub);
}

// ---------- proof photos ----------

function photoWindowOpen(stage: MoverPhotoStage, move: MoveRequestDoc): boolean {
  const { status, progressStage } = move;
  if (stage === 'PICKUP') return status === 'EN_ROUTE' || status === 'IN_PROGRESS';
  if (stage === 'LOAD') return status === 'IN_PROGRESS' && progressStage === 'LOADING';
  return (status === 'IN_PROGRESS' && progressStage === 'IN_TRANSIT') || status === 'DELIVERED';
}

const PHOTO_WINDOW_MESSAGES: Record<MoverPhotoStage, string> = {
  PICKUP: 'Pickup photos can be added once you are on the way, until delivery.',
  LOAD: 'Photos of the loaded vehicle can only be added during loading.',
  DELIVERY: 'Delivery photos can be added once you have left with the load.',
};

export async function listJobPhotos(moverId: string, moveId: string): Promise<PhotoDto[]> {
  await ownedMove(moverId, moveId);
  return (await repo.listPhotos(moveId, ['PICKUP', 'LOAD', 'DELIVERY'])).map(serializePhoto);
}

export async function addJobPhoto(
  moverId: string,
  moveId: string,
  stage: MoverPhotoStage,
  bytes: Uint8Array,
): Promise<PhotoDto> {
  const move = await ownedMove(moverId, moveId);
  if (!photoWindowOpen(stage, move)) throw new BadRequestError(PHOTO_WINDOW_MESSAGES[stage]);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new BadRequestError('This photo is over 8 MB');
  const file = sniffFile(bytes);
  if (!file || file.contentType === 'application/pdf') {
    throw new BadRequestError('Use a JPEG, PNG or WebP photo');
  }
  if ((await repo.countPhotos(moveId, stage)) >= MAX_PHOTOS_PER_STAGE) {
    throw new BadRequestError(`A job can hold ${MAX_PHOTOS_PER_STAGE} photos per stage`);
  }

  const storageKey = moverStorage.newKey(moverId, 'photos', file.extension);
  await moverStorage.putObject(storageKey, bytes);
  const photo = await repo.createPhoto({
    moveId,
    uploaderId: moverId,
    stage,
    storageKey,
    contentType: file.contentType,
    size: bytes.byteLength,
  });
  return serializePhoto(photo);
}
