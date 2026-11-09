import type {
  AvailabilityDoc,
  BoxScanDoc,
  EarningDoc,
  JobOfferDoc,
  MessageDoc,
  MoveAddress,
  MoveItem,
  MoveRequestDoc,
  MoverDocumentDoc,
  NotificationDoc,
  PayoutDoc,
  PhotoDoc,
  QuoteDoc,
  StatusEventDoc,
  TeamMemberDoc,
  VehicleDoc,
} from '../../shared/database/models';
import type {
  AvailabilityDayDto,
  BoxScanDto,
  EarningDto,
  JobSummaryDto,
  MessageDto,
  MoveAddressDto,
  MoveAreaDto,
  MoveItemDto,
  MoverDocumentDto,
  MoverPhotoStage,
  NotificationDto,
  OfferDto,
  PayoutDto,
  PhotoDto,
  ProfitabilityDto,
  QuoteDto,
  StatusEventDto,
  TeamMemberDto,
  VehicleDto,
} from '../../../types/mover';
import { documentState } from './mover.rules';
import { signFileUrl } from './mover.storage';

/**
 * Allow-list serializers: a field reaches a mover only if it is named here.
 * That is what keeps the client's address and phone out of offers (spec 9.3).
 */
export function serializeArea(address: MoveAddress): MoveAreaDto {
  return {
    city: address.city,
    zone: address.zone,
    floor: address.floor,
    hasElevator: address.hasElevator,
  };
}

export function serializeAddress(address: MoveAddress): MoveAddressDto {
  return {
    ...serializeArea(address),
    street: address.street,
    postalCode: address.postalCode,
    accessNotes: address.accessNotes,
  };
}

export function serializeItems(items: MoveItem[]): MoveItemDto[] {
  return items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    category: item.category,
    isFragile: item.isFragile,
    needsDisassembly: item.needsDisassembly,
  }));
}

export function serializeQuote(quote: QuoteDoc): QuoteDto {
  return {
    id: String(quote._id),
    amount: quote.amount,
    currency: quote.currency,
    validUntil: quote.validUntil.toISOString(),
    message: quote.message,
    status: quote.status,
    createdAt: quote.createdAt.toISOString(),
  };
}

export function serializeOffer(
  offer: JobOfferDoc,
  move: MoveRequestDoc,
  quote: QuoteDoc | null,
  profitability: ProfitabilityDto,
): OfferDto {
  return {
    id: String(offer._id),
    status: offer.status,
    expiresAt: offer.expiresAt.toISOString(),
    createdAt: offer.createdAt.toISOString(),
    canAccept: move.estimatedPrice !== null,
    quote: quote ? serializeQuote(quote) : null,
    profitability,
    move: {
      id: String(move._id),
      reference: move.reference,
      moveDate: move.moveDate,
      timeSlot: move.timeSlot,
      housingType: move.housingType,
      sizeRooms: move.sizeRooms,
      volumeM3: move.volumeM3,
      extraServices: move.extraServices,
      estimatedPrice: move.estimatedPrice,
      items: serializeItems(move.items),
      pickup: serializeArea(move.pickup),
      dropoff: serializeArea(move.dropoff),
    },
  };
}

export function serializeJobSummary(move: MoveRequestDoc): JobSummaryDto {
  return {
    id: String(move._id),
    reference: move.reference,
    moveDate: move.moveDate,
    timeSlot: move.timeSlot,
    status: move.status,
    progressStage: move.progressStage,
    finalPrice: move.finalPrice,
    pickupCity: move.pickup.city,
    dropoffCity: move.dropoff.city,
  };
}

export function serializeStatusEvent(event: StatusEventDoc): StatusEventDto {
  return {
    id: String(event._id),
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  };
}

export function serializeMessage(message: MessageDoc, viewerId: string): MessageDto {
  return {
    id: String(message._id),
    thread: message.thread,
    senderRole: message.senderRole,
    mine: message.senderId === viewerId,
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function serializePhoto(photo: PhotoDoc): PhotoDto {
  return {
    id: String(photo._id),
    stage: photo.stage as MoverPhotoStage,
    url: signFileUrl(photo.storageKey),
    createdAt: photo.createdAt.toISOString(),
  };
}

export function serializeBoxScan(scan: BoxScanDoc): BoxScanDto {
  return {
    id: String(scan._id),
    code: scan.code,
    label: scan.label,
    scannedAt: scan.createdAt.toISOString(),
  };
}

export function serializeNotification(notification: NotificationDoc): NotificationDto {
  return {
    id: String(notification._id),
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export function serializeAvailability(day: AvailabilityDoc): AvailabilityDayDto {
  return { date: day.date, slot: day.slot };
}

export function serializeVehicle(vehicle: VehicleDoc): VehicleDto {
  return {
    id: String(vehicle._id),
    type: vehicle.type,
    capacityM3: vehicle.capacityM3,
    plate: vehicle.plate,
  };
}

export function serializeTeamMember(member: TeamMemberDoc): TeamMemberDto {
  return { id: String(member._id), name: member.name, phone: member.phone, role: member.role };
}

export function serializeDocument(
  document: MoverDocumentDoc,
  now: Date = new Date(),
): MoverDocumentDto {
  return {
    id: String(document._id),
    type: document.type,
    fileName: document.fileName,
    url: signFileUrl(document.storageKey),
    expiresAt: document.expiresAt?.toISOString() ?? null,
    uploadedAt: document.updatedAt.toISOString(),
    ...documentState(document.expiresAt, now),
  };
}

export function serializeEarning(earning: EarningDoc): EarningDto {
  return {
    id: String(earning._id),
    moveId: earning.moveId,
    reference: earning.reference,
    gross: earning.gross,
    commissionRate: earning.commissionRate,
    commission: earning.commission,
    net: earning.net,
    currency: earning.currency,
    status: earning.status,
    createdAt: earning.createdAt.toISOString(),
  };
}

export function serializePayout(payout: PayoutDoc): PayoutDto {
  return {
    id: String(payout._id),
    amount: payout.amount,
    currency: payout.currency,
    method: payout.method,
    reference: payout.reference,
    paidAt: payout.paidAt.toISOString(),
  };
}
