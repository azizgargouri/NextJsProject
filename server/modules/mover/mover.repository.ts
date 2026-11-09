import { isValidObjectId } from 'mongoose';
import { connectMongo } from '../../shared/database/mongoose';
import {
  AvailabilityModel,
  BoxScanModel,
  EarningModel,
  JobOfferModel,
  MessageModel,
  MoveRequestModel,
  MoverDocumentModel,
  MoverProfileModel,
  NotificationModel,
  PayoutModel,
  PhotoModel,
  PricingRuleModel,
  QuoteModel,
  StatusEventModel,
  TeamMemberModel,
  UserModel,
  VehicleModel,
  type AvailabilityDoc,
  type BoxScanDoc,
  type EarningDoc,
  type JobOfferDoc,
  type MessageDoc,
  type MoveRequestDoc,
  type MoverDocumentDoc,
  type MoverProfileDoc,
  type NotificationDoc,
  type PayoutDoc,
  type PhotoDoc,
  type PricingRuleDoc,
  type QuoteDoc,
  type StatusEventDoc,
  type TeamMemberDoc,
  type UserDoc,
  type VehicleDoc,
} from '../../shared/database/models';
import type {
  DocumentType,
  MessageThread,
  MoveStatus,
  NotificationType,
  OfferStatus,
  PhotoStage,
  ProgressStage,
  QuoteStatus,
  Role,
  TimeSlot,
} from '../../shared/database/enums';
import { ACTIVE_JOB_STATUSES } from './mover.constants';

/**
 * Data access for the mover domain. Every state change that two requests could
 * race on is a single conditional update, because local mongod runs without
 * replication and so without multi-document transactions.
 */
async function db(): Promise<void> {
  await connectMongo();
}

/** A malformed id can never match, so it reads as "not found" rather than a 500. */
function validId(id: string): boolean {
  return isValidObjectId(id);
}

export const moverRepository = {
  // ---------- accounts and profiles ----------
  async findUser(id: string): Promise<UserDoc | null> {
    await db();
    if (!validId(id)) return null;
    return UserModel.findOne({ _id: id, deletedAt: null }).lean<UserDoc | null>();
  },

  async findProfile(moverId: string): Promise<MoverProfileDoc | null> {
    await db();
    return MoverProfileModel.findOne({ userId: moverId }).lean<MoverProfileDoc | null>();
  },

  /** Idempotent: accounts created before this module simply gain a PENDING profile. */
  async ensureProfile(moverId: string, companyName: string): Promise<MoverProfileDoc> {
    await db();
    const doc = await MoverProfileModel.findOneAndUpdate(
      { userId: moverId },
      { $setOnInsert: { userId: moverId, companyName, verificationStatus: 'PENDING' } },
      { upsert: true, returnDocument: 'after' },
    ).lean<MoverProfileDoc | null>();
    if (!doc) throw new Error('Mover profile upsert failed');
    return doc;
  },

  async updateProfile(moverId: string, data: Record<string, unknown>): Promise<void> {
    await db();
    await MoverProfileModel.updateOne({ userId: moverId }, { $set: data });
  },

  async findApprovedProfilesInZone(zone: string): Promise<MoverProfileDoc[]> {
    await db();
    return MoverProfileModel.find({ verificationStatus: 'APPROVED', zones: zone })
      .sort({ ratingAvg: -1, createdAt: 1 })
      .lean<MoverProfileDoc[]>();
  },

  // ---------- availability ----------
  async listAvailability(moverId: string, from: string, to: string): Promise<AvailabilityDoc[]> {
    await db();
    return AvailabilityModel.find({ moverId, date: { $gte: from, $lte: to } })
      .sort({ date: 1 })
      .lean<AvailabilityDoc[]>();
  },

  async availabilityOn(moverId: string, dates: string[]): Promise<AvailabilityDoc[]> {
    await db();
    return AvailabilityModel.find({ moverId, date: { $in: dates } }).lean<AvailabilityDoc[]>();
  },

  async setAvailability(moverId: string, date: string, slot: TimeSlot): Promise<void> {
    await db();
    await AvailabilityModel.updateOne({ moverId, date }, { $set: { slot } }, { upsert: true });
  },

  async clearAvailability(moverId: string, date: string): Promise<void> {
    await db();
    await AvailabilityModel.deleteOne({ moverId, date });
  },

  // ---------- vehicles and team ----------
  async listVehicles(moverId: string): Promise<VehicleDoc[]> {
    await db();
    return VehicleModel.find({ moverId }).sort({ createdAt: 1 }).lean<VehicleDoc[]>();
  },

  async createVehicle(moverId: string, data: Record<string, unknown>): Promise<VehicleDoc> {
    await db();
    return (await VehicleModel.create({ ...data, moverId })).toObject() as VehicleDoc;
  },

  async updateVehicle(
    moverId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<VehicleDoc | null> {
    await db();
    if (!validId(id)) return null;
    return VehicleModel.findOneAndUpdate(
      { _id: id, moverId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).lean<VehicleDoc | null>();
  },

  async deleteVehicle(moverId: string, id: string): Promise<boolean> {
    await db();
    if (!validId(id)) return false;
    return (await VehicleModel.deleteOne({ _id: id, moverId })).deletedCount === 1;
  },

  async listTeam(moverId: string): Promise<TeamMemberDoc[]> {
    await db();
    return TeamMemberModel.find({ moverId }).sort({ createdAt: 1 }).lean<TeamMemberDoc[]>();
  },

  async createTeamMember(moverId: string, data: Record<string, unknown>): Promise<TeamMemberDoc> {
    await db();
    return (await TeamMemberModel.create({ ...data, moverId })).toObject() as TeamMemberDoc;
  },

  async updateTeamMember(
    moverId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<TeamMemberDoc | null> {
    await db();
    if (!validId(id)) return null;
    return TeamMemberModel.findOneAndUpdate(
      { _id: id, moverId },
      { $set: data },
      { returnDocument: 'after', runValidators: true },
    ).lean<TeamMemberDoc | null>();
  },

  async deleteTeamMember(moverId: string, id: string): Promise<boolean> {
    await db();
    if (!validId(id)) return false;
    return (await TeamMemberModel.deleteOne({ _id: id, moverId })).deletedCount === 1;
  },

  // ---------- documents ----------
  async listDocuments(moverId: string): Promise<MoverDocumentDoc[]> {
    await db();
    return MoverDocumentModel.find({ moverId }).sort({ type: 1 }).lean<MoverDocumentDoc[]>();
  },

  /** A replacement restarts the expiry warning and clears any earlier review. */
  async upsertDocument(
    moverId: string,
    type: DocumentType,
    data: {
      storageKey: string;
      contentType: string;
      fileName: string;
      expiresAt: Date | null;
    },
  ): Promise<MoverDocumentDoc> {
    await db();
    const doc = await MoverDocumentModel.findOneAndUpdate(
      { moverId, type },
      { $set: { ...data, expiryWarnedAt: null, reviewedBy: null, reviewedAt: null } },
      { upsert: true, returnDocument: 'after' },
    ).lean<MoverDocumentDoc | null>();
    if (!doc) throw new Error('Document upsert failed');
    return doc;
  },

  /** Claims each document exactly once, so the warning never repeats. */
  async claimExpiringDocuments(before: Date, now: Date): Promise<MoverDocumentDoc[]> {
    await db();
    const due = await MoverDocumentModel.find({
      expiresAt: { $ne: null, $lte: before },
      expiryWarnedAt: null,
    })
      .limit(100)
      .lean<MoverDocumentDoc[]>();
    const claimed: MoverDocumentDoc[] = [];
    for (const doc of due) {
      const updated = await MoverDocumentModel.updateOne(
        { _id: doc._id, expiryWarnedAt: null },
        { $set: { expiryWarnedAt: now } },
      );
      if (updated.modifiedCount === 1) claimed.push(doc);
    }
    return claimed;
  },

  // ---------- moves ----------
  async createMove(data: Record<string, unknown>): Promise<MoveRequestDoc> {
    await db();
    return (await MoveRequestModel.create(data)).toObject() as MoveRequestDoc;
  },

  async findMove(id: string): Promise<MoveRequestDoc | null> {
    await db();
    if (!validId(id)) return null;
    return MoveRequestModel.findById(id).lean<MoveRequestDoc | null>();
  },

  async findMoves(ids: string[]): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({ _id: { $in: ids } }).lean<MoveRequestDoc[]>();
  },

  async findAssignedMove(moverId: string, id: string): Promise<MoveRequestDoc | null> {
    await db();
    if (!validId(id)) return null;
    return MoveRequestModel.findOne({
      _id: id,
      assignedMoverId: moverId,
    }).lean<MoveRequestDoc | null>();
  },

  async listAssignedMoves(moverId: string): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({ assignedMoverId: moverId })
      .sort({ moveDate: 1 })
      .lean<MoveRequestDoc[]>();
  },

  async activeMovesOnDate(
    moverId: string,
    date: string,
    excludeMoveId?: string,
  ): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({
      assignedMoverId: moverId,
      moveDate: date,
      status: { $in: [...ACTIVE_JOB_STATUSES] },
      ...(excludeMoveId ? { _id: { $ne: excludeMoveId } } : {}),
    }).lean<MoveRequestDoc[]>();
  },

  /** Atomic: at most one mover can ever win a move. Null means it was already taken. */
  async claimMove(
    moveId: string,
    moverId: string,
    finalPrice: number,
    now: Date,
  ): Promise<MoveRequestDoc | null> {
    await db();
    return MoveRequestModel.findOneAndUpdate(
      { _id: moveId, status: 'QUOTING', assignedMoverId: null },
      { $set: { status: 'ASSIGNED', assignedMoverId: moverId, assignedAt: now, finalPrice } },
      { returnDocument: 'after' },
    ).lean<MoveRequestDoc | null>();
  },

  /** Conditional on the current position, so a stale or doubled tap changes nothing. */
  async advanceMove(
    moveId: string,
    moverId: string,
    from: { status: MoveStatus; progressStage: ProgressStage | null },
    to: { status: MoveStatus; progressStage: ProgressStage | null },
    extra: Record<string, unknown> = {},
  ): Promise<MoveRequestDoc | null> {
    await db();
    return MoveRequestModel.findOneAndUpdate(
      {
        _id: moveId,
        assignedMoverId: moverId,
        status: from.status,
        progressStage: from.progressStage,
      },
      { $set: { status: to.status, progressStage: to.progressStage, ...extra } },
      { returnDocument: 'after' },
    ).lean<MoveRequestDoc | null>();
  },

  /** Only while loading, so the record cannot change once the mover has left. */
  async saveLoadCheck(
    moveId: string,
    moverId: string,
    loadCheck: Record<string, unknown>,
  ): Promise<MoveRequestDoc | null> {
    await db();
    return MoveRequestModel.findOneAndUpdate(
      { _id: moveId, assignedMoverId: moverId, status: 'IN_PROGRESS', progressStage: 'LOADING' },
      { $set: { loadCheck } },
      { returnDocument: 'after', runValidators: true },
    ).lean<MoveRequestDoc | null>();
  },

  async transitionMove(
    moveId: string,
    from: MoveStatus,
    to: MoveStatus,
    extra: Record<string, unknown> = {},
  ): Promise<MoveRequestDoc | null> {
    await db();
    return MoveRequestModel.findOneAndUpdate(
      { _id: moveId, status: from },
      { $set: { status: to, ...extra } },
      { returnDocument: 'after' },
    ).lean<MoveRequestDoc | null>();
  },

  async findDeliveredBefore(cutoff: Date): Promise<MoveRequestDoc[]> {
    await db();
    return MoveRequestModel.find({ status: 'DELIVERED', deliveredAt: { $lte: cutoff } })
      .limit(100)
      .lean<MoveRequestDoc[]>();
  },

  // ---------- status events ----------
  async addStatusEvent(event: {
    moveId: string;
    fromStatus: string | null;
    toStatus: string;
    note?: string;
    actorId: string | null;
  }): Promise<void> {
    await db();
    await StatusEventModel.create(event);
  },

  async listStatusEvents(moveId: string): Promise<StatusEventDoc[]> {
    await db();
    return StatusEventModel.find({ moveId })
      .sort({ createdAt: 1, _id: 1 })
      .lean<StatusEventDoc[]>();
  },

  // ---------- offers ----------
  /** The unique index turns a concurrent duplicate into a null instead of a second offer. */
  async createOffer(moveId: string, moverId: string, expiresAt: Date): Promise<JobOfferDoc | null> {
    await db();
    try {
      return (await JobOfferModel.create({ moveId, moverId, expiresAt })).toObject() as JobOfferDoc;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    }
  },

  async findOffer(moverId: string, id: string): Promise<JobOfferDoc | null> {
    await db();
    if (!validId(id)) return null;
    return JobOfferModel.findOne({ _id: id, moverId }).lean<JobOfferDoc | null>();
  },

  async listOffersByStatus(
    moverId: string,
    status: OfferStatus,
    now?: Date,
  ): Promise<JobOfferDoc[]> {
    await db();
    return JobOfferModel.find({
      moverId,
      status,
      ...(now ? { expiresAt: { $gt: now } } : {}),
    })
      .sort({ expiresAt: 1 })
      .lean<JobOfferDoc[]>();
  },

  async offeredMoverIds(moveId: string): Promise<string[]> {
    await db();
    return (await JobOfferModel.find({ moveId }).select('moverId').lean<JobOfferDoc[]>()).map(
      (offer) => offer.moverId,
    );
  },

  async countPendingOffers(moveId: string, now: Date): Promise<number> {
    await db();
    return JobOfferModel.countDocuments({ moveId, status: 'PENDING', expiresAt: { $gt: now } });
  },

  /** Atomic: an offer can only be answered once, and only before its deadline. */
  async claimOffer(
    moverId: string,
    id: string,
    status: OfferStatus,
    now: Date,
    extra: Record<string, unknown> = {},
  ): Promise<JobOfferDoc | null> {
    await db();
    if (!validId(id)) return null;
    return JobOfferModel.findOneAndUpdate(
      { _id: id, moverId, status: 'PENDING', expiresAt: { $gt: now } },
      { $set: { status, respondedAt: now, ...extra } },
      { returnDocument: 'after' },
    ).lean<JobOfferDoc | null>();
  },

  async setOfferStatus(id: string, status: OfferStatus): Promise<void> {
    await db();
    await JobOfferModel.updateOne({ _id: id }, { $set: { status } });
  },

  /** Claims each overdue offer once, so concurrent sweeps cannot hand off twice. */
  async claimExpiredOffers(now: Date): Promise<JobOfferDoc[]> {
    await db();
    const due = await JobOfferModel.find({ status: 'PENDING', expiresAt: { $lte: now } })
      .limit(100)
      .lean<JobOfferDoc[]>();
    const claimed: JobOfferDoc[] = [];
    for (const offer of due) {
      const updated = await JobOfferModel.updateOne(
        { _id: offer._id, status: 'PENDING' },
        { $set: { status: 'EXPIRED' } },
      );
      if (updated.modifiedCount === 1) claimed.push(offer);
    }
    return claimed;
  },

  /** Closes every other mover's open offer on a move that has just been assigned. */
  async withdrawOpenOffers(moveId: string, keepMoverId: string): Promise<JobOfferDoc[]> {
    await db();
    const open = await JobOfferModel.find({
      moveId,
      moverId: { $ne: keepMoverId },
      status: { $in: ['PENDING', 'QUOTED'] },
    }).lean<JobOfferDoc[]>();
    await JobOfferModel.updateMany(
      { _id: { $in: open.map((offer) => offer._id) } },
      { $set: { status: 'WITHDRAWN' } },
    );
    return open;
  },

  // ---------- quotes ----------
  async createQuote(data: {
    moveId: string;
    moverId: string;
    offerId: string;
    amount: number;
    validUntil: Date;
    message: string;
  }): Promise<QuoteDoc> {
    await db();
    return (await QuoteModel.create(data)).toObject() as QuoteDoc;
  },

  async findQuote(moveId: string, id: string): Promise<QuoteDoc | null> {
    await db();
    if (!validId(id)) return null;
    return QuoteModel.findOne({ _id: id, moveId }).lean<QuoteDoc | null>();
  },

  async quotesByOffers(offerIds: string[]): Promise<QuoteDoc[]> {
    await db();
    return QuoteModel.find({ offerId: { $in: offerIds } }).lean<QuoteDoc[]>();
  },

  async countOpenQuotes(moveId: string, now: Date): Promise<number> {
    await db();
    return QuoteModel.countDocuments({ moveId, status: 'SENT', validUntil: { $gt: now } });
  },

  async claimQuote(id: string, now: Date, status: QuoteStatus): Promise<QuoteDoc | null> {
    await db();
    return QuoteModel.findOneAndUpdate(
      { _id: id, status: 'SENT', validUntil: { $gt: now } },
      { $set: { status } },
      { returnDocument: 'after' },
    ).lean<QuoteDoc | null>();
  },

  async setQuoteStatus(id: string, status: QuoteStatus): Promise<void> {
    await db();
    await QuoteModel.updateOne({ _id: id }, { $set: { status } });
  },

  async rejectOtherQuotes(moveId: string, keepQuoteId: string | null): Promise<QuoteDoc[]> {
    await db();
    const open = await QuoteModel.find({
      moveId,
      status: 'SENT',
      ...(keepQuoteId ? { _id: { $ne: keepQuoteId } } : {}),
    }).lean<QuoteDoc[]>();
    await QuoteModel.updateMany(
      { _id: { $in: open.map((quote) => quote._id) } },
      { $set: { status: 'REJECTED' } },
    );
    return open;
  },

  async claimExpiredQuotes(now: Date): Promise<QuoteDoc[]> {
    await db();
    const due = await QuoteModel.find({ status: 'SENT', validUntil: { $lte: now } })
      .limit(100)
      .lean<QuoteDoc[]>();
    await QuoteModel.updateMany(
      { _id: { $in: due.map((quote) => quote._id) }, status: 'SENT' },
      { $set: { status: 'EXPIRED' } },
    );
    return due;
  },

  // ---------- messages ----------
  async listMessages(moveId: string, thread: MessageThread): Promise<MessageDoc[]> {
    await db();
    return MessageModel.find({ moveId, thread })
      .sort({ createdAt: 1, _id: 1 })
      .limit(500)
      .lean<MessageDoc[]>();
  },

  async createMessage(data: {
    moveId: string;
    thread: MessageThread;
    senderId: string;
    senderRole: Role;
    body: string;
  }): Promise<MessageDoc> {
    await db();
    return (await MessageModel.create(data)).toObject() as MessageDoc;
  },

  async markThreadRead(
    moveId: string,
    thread: MessageThread,
    readerId: string,
    now: Date,
  ): Promise<void> {
    await db();
    await MessageModel.updateMany(
      { moveId, thread, senderId: { $ne: readerId }, readAt: null },
      { $set: { readAt: now } },
    );
  },

  async countUnread(moveId: string, thread: MessageThread, readerId: string): Promise<number> {
    await db();
    return MessageModel.countDocuments({
      moveId,
      thread,
      senderId: { $ne: readerId },
      readAt: null,
    });
  },

  // ---------- photos ----------
  async listPhotos(moveId: string, stages: PhotoStage[]): Promise<PhotoDoc[]> {
    await db();
    return PhotoModel.find({ moveId, stage: { $in: stages } })
      .sort({ createdAt: 1 })
      .lean<PhotoDoc[]>();
  },

  async countPhotos(moveId: string, stage: PhotoStage): Promise<number> {
    await db();
    return PhotoModel.countDocuments({ moveId, stage });
  },

  async createPhoto(data: Record<string, unknown>): Promise<PhotoDoc> {
    await db();
    return (await PhotoModel.create(data)).toObject() as PhotoDoc;
  },

  // ---------- box scans ----------
  async listBoxScans(moveId: string): Promise<BoxScanDoc[]> {
    await db();
    return BoxScanModel.find({ moveId }).sort({ createdAt: -1, _id: -1 }).lean<BoxScanDoc[]>();
  },

  async countBoxScans(moveId: string): Promise<number> {
    await db();
    return BoxScanModel.countDocuments({ moveId });
  },

  /** The unique index turns a second scan of the same box into a null. */
  async createBoxScan(data: {
    moveId: string;
    moverId: string;
    code: string;
    label: string;
  }): Promise<BoxScanDoc | null> {
    await db();
    try {
      return (await BoxScanModel.create(data)).toObject() as BoxScanDoc;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) return null;
      throw error;
    }
  },

  async deleteBoxScan(moveId: string, id: string): Promise<boolean> {
    await db();
    if (!validId(id)) return false;
    return (await BoxScanModel.deleteOne({ _id: id, moveId })).deletedCount === 1;
  },

  /** A confirmed count stops matching once the scanned boxes change. */
  async clearLoadCheck(moveId: string, moverId: string): Promise<void> {
    await db();
    await MoveRequestModel.updateOne(
      { _id: moveId, assignedMoverId: moverId, status: 'IN_PROGRESS', progressStage: 'LOADING' },
      { $set: { loadCheck: null } },
    );
  },

  // ---------- notifications ----------
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link: string;
  }): Promise<void> {
    await db();
    await NotificationModel.create(data);
  },

  async listNotifications(userId: string, limit: number): Promise<NotificationDoc[]> {
    await db();
    return NotificationModel.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<NotificationDoc[]>();
  },

  async countUnreadNotifications(userId: string): Promise<number> {
    await db();
    return NotificationModel.countDocuments({ userId, readAt: null });
  },

  async markNotificationsRead(userId: string, ids: string[] | undefined, now: Date): Promise<void> {
    await db();
    await NotificationModel.updateMany(
      {
        userId,
        readAt: null,
        ...(ids ? { _id: { $in: ids.filter(validId) } } : {}),
      },
      { $set: { readAt: now } },
    );
  },

  // ---------- earnings ----------
  /** The unique moveId makes this safe to call twice for the same completed move. */
  async createEarningOnce(data: {
    moveId: string;
    moverId: string;
    reference: string;
    gross: number;
    commissionRate: number;
    commission: number;
    net: number;
  }): Promise<void> {
    await db();
    await EarningModel.updateOne({ moveId: data.moveId }, { $setOnInsert: data }, { upsert: true });
  },

  async listEarnings(moverId: string): Promise<EarningDoc[]> {
    await db();
    return EarningModel.find({ moverId }).sort({ createdAt: -1 }).lean<EarningDoc[]>();
  },

  async listPayouts(moverId: string): Promise<PayoutDoc[]> {
    await db();
    return PayoutModel.find({ moverId }).sort({ paidAt: -1 }).lean<PayoutDoc[]>();
  },

  async activePricingRule(): Promise<PricingRuleDoc | null> {
    await db();
    return PricingRuleModel.findOne({
      status: 'ACTIVE',
      deletedAt: null,
    }).lean<PricingRuleDoc | null>();
  },
};
