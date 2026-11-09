/** DTOs for the mover workspace. Server serializers are typed against these. */

export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'FULL_DAY';
export type MoveStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QUOTING'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DISPUTED'
  | 'CANCELLED'
  | 'REFUNDED';
export type ProgressStage = 'LOADING' | 'IN_TRANSIT';
export type JobAction = 'EN_ROUTE' | 'LOADING' | 'IN_TRANSIT' | 'DELIVERED';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'QUOTED' | 'EXPIRED' | 'WITHDRAWN';
export type QuoteStatus = 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
export type MessageThread = 'MOVER_CLIENT' | 'MOVER_SUPPORT' | 'CLIENT_SUPPORT';
export type MoverPhotoStage = 'PICKUP' | 'LOAD' | 'DELIVERY';
export type VehicleType = 'VAN' | 'SMALL_TRUCK' | 'LARGE_TRUCK';
export type MoverDocumentType = 'ID' | 'LICENCE' | 'INSURANCE' | 'REGISTRATION';

export interface MoverApplicationDto {
  status: VerificationStatus;
  companyName: string;
  submittedAt: string;
  updatedAt: string;
  /** False keeps every workspace screen except this one locked (M-02). */
  canAccessDashboard: boolean;
}

export interface MoveItemDto {
  name: string;
  quantity: number;
  category: string;
  isFragile: boolean;
  needsDisassembly: boolean;
}

/** Location safe to show before assignment: no street, access notes or postal code. */
export interface MoveAreaDto {
  city: string;
  zone: string;
  floor: number;
  hasElevator: boolean;
}

export interface MoveAddressDto extends MoveAreaDto {
  street: string;
  postalCode: string;
  accessNotes: string;
}

export interface QuoteDto {
  id: string;
  amount: number;
  currency: string;
  validUntil: string;
  message: string;
  status: QuoteStatus;
  createdAt: string;
}

/** The mover's own running costs, used to work out what a job leaves them. */
export interface MoverCostsDto {
  fuelLitresPer100Km: number;
  fuelPricePerLitre: number;
  /** Helpers on a usual job, besides the driver. */
  helpers: number;
  helperHourlyRate: number;
  /** Wear, maintenance and other costs that grow with distance. */
  costPerKm: number;
  /** Net per hour the mover wants to earn. */
  targetHourlyNet: number;
}

export type ProfitVerdict = 'GOOD' | 'OK' | 'LOW';
export type ProfitLineKind = 'PRICE' | 'COMMISSION' | 'FUEL' | 'HELPERS' | 'WEAR';

export interface ProfitabilityDto {
  /** Fixed price, or the mover's own quote. Null while a quote is still needed. */
  price: number | null;
  currency: string;
  net: number | null;
  /** Net if the job runs to the worst-case duration. */
  netWorstCase: number | null;
  netPerHour: number | null;
  verdict: ProfitVerdict | null;
  /** The mover's own hourly target, to compare against. */
  targetHourlyNet: number;
  /** Whole time away, from leaving base to getting back. */
  hours: { likely: number; worst: number };
  distanceKm: number;
  /** Price (or the suggested quote) first, then each cost as a negative amount. */
  breakdown: { label: string; amount: number; kind: ProfitLineKind }[];
  reasons: string[];
  warnings: string[];
  /** Offered only while a quote is still needed, with what the mover would keep at that price. */
  suggestedQuote: {
    amount: number;
    net: number;
    netPerHour: number;
    similarRange: { low: number; high: number } | null;
  } | null;
  /** ROUGH until the model has learned from enough of this mover's finished jobs. */
  confidence: 'ROUGH' | 'GOOD';
  basedOnJobs: number;
  modelVersion: number | null;
  costsAreDefaults: boolean;
}

export interface OfferDto {
  id: string;
  status: OfferStatus;
  expiresAt: string;
  createdAt: string;
  /** True when the society set a fixed price the mover can accept directly. */
  canAccept: boolean;
  quote: QuoteDto | null;
  profitability: ProfitabilityDto;
  move: {
    id: string;
    reference: string;
    moveDate: string;
    timeSlot: TimeSlot;
    housingType: string;
    sizeRooms: number;
    volumeM3: number;
    extraServices: string[];
    estimatedPrice: number | null;
    items: MoveItemDto[];
    pickup: MoveAreaDto;
    dropoff: MoveAreaDto;
  };
}

export interface MoverEligibilityDto {
  eligible: boolean;
  /** Plain-language reasons the mover cannot receive offers right now. */
  blockers: string[];
}

export interface OffersListDto {
  eligibility: MoverEligibilityDto;
  offers: OfferDto[];
  /** Quotes sent and still waiting on the client. */
  quoted: OfferDto[];
}

export interface StatusEventDto {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  note: string;
  createdAt: string;
}

export interface JobSummaryDto {
  id: string;
  reference: string;
  moveDate: string;
  timeSlot: TimeSlot;
  status: MoveStatus;
  progressStage: ProgressStage | null;
  finalPrice: number | null;
  pickupCity: string;
  dropoffCity: string;
}

export interface LoadCountsDto {
  boxes: number;
  furniture: number;
}

export interface LoadCheckDto extends LoadCountsDto {
  note: string;
  confirmedAt: string;
}

export interface BoxScanDto {
  id: string;
  code: string;
  label: string;
  scannedAt: string;
}

/** Proof still needed before the next status button unlocks. */
export interface JobProofDto {
  minLoadPhotos: number;
  loadPhotos: number;
  minDeliveryPhotos: number;
  deliveryPhotos: number;
  loadCheck: LoadCheckDto | null;
  /** Worked out from the client's item list; null when they listed no items. */
  expectedLoad: LoadCountsDto | null;
  /** Boxes scanned into the vehicle at pickup, newest first. They set the box count. */
  boxes: BoxScanDto[];
  canScanBoxes: boolean;
}

/** The box count is not sent: it is the number of scanned boxes. */
export interface LoadCheckPayload {
  furniture: number;
  note?: string;
  confirmed: true;
}

export interface JobDetailDto extends JobSummaryDto {
  housingType: string;
  sizeRooms: number;
  volumeM3: number;
  extraServices: string[];
  items: MoveItemDto[];
  /** Exact addresses, client and notes are null unless the job is live (spec 9.3). */
  pickup: MoveAddressDto | MoveAreaDto;
  dropoff: MoveAddressDto | MoveAreaDto;
  client: { name: string; phone: string } | null;
  notes: string | null;
  contactVisible: boolean;
  nextAction: JobAction | null;
  proof: JobProofDto;
  timeline: StatusEventDto[];
  canChat: boolean;
  unread: { MOVER_CLIENT: number; MOVER_SUPPORT: number };
}

export interface JobsListDto {
  active: JobSummaryDto[];
  past: JobSummaryDto[];
}

export interface MessageDto {
  id: string;
  thread: MessageThread;
  senderRole: 'CLIENT' | 'MOVER' | 'ADMIN';
  mine: boolean;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface PhotoDto {
  id: string;
  stage: MoverPhotoStage;
  url: string;
  createdAt: string;
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsDto {
  unreadCount: number;
  notifications: NotificationDto[];
}

export interface AvailabilityDayDto {
  date: string;
  slot: TimeSlot;
}

export interface VehicleDto {
  id: string;
  type: VehicleType;
  capacityM3: number;
  plate: string;
}

export interface TeamMemberDto {
  id: string;
  name: string;
  phone: string;
  role: string;
}

export interface MoverDocumentDto {
  id: string;
  type: MoverDocumentType;
  fileName: string;
  url: string;
  expiresAt: string | null;
  uploadedAt: string;
  state: 'VALID' | 'EXPIRING' | 'EXPIRED';
  /** Whole days until expiry; null when the document does not expire. */
  daysLeft: number | null;
}

export interface MoverProfileDto {
  companyName: string;
  taxId: string;
  bio: string;
  zones: string[];
  ratingAvg: number;
  ratingCount: number;
  verificationStatus: VerificationStatus;
  account: { name: string; email: string; phone: string };
  vehicles: VehicleDto[];
  team: TeamMemberDto[];
  documents: MoverDocumentDto[];
  availableZones: { code: string; label: string }[];
  /** The mover's costs, or the defaults until they enter their own. */
  costs: MoverCostsDto;
  costsAreDefaults: boolean;
}

export interface EarningDto {
  id: string;
  moveId: string;
  reference: string;
  gross: number;
  commissionRate: number;
  commission: number;
  net: number;
  currency: string;
  status: 'PENDING' | 'PAID';
  createdAt: string;
}

export interface PayoutDto {
  id: string;
  amount: number;
  currency: string;
  method: string;
  reference: string;
  paidAt: string;
}

export interface EarningsSummaryDto {
  currency: string;
  gross: number;
  commission: number;
  net: number;
  /** Net earned and not yet paid out. */
  pending: number;
  paidOut: number;
  completedJobs: number;
}

export interface EarningsDto {
  summary: EarningsSummaryDto;
  earnings: EarningDto[];
  payouts: PayoutDto[];
}

export interface MoverDashboardDto {
  eligibility: MoverEligibilityDto;
  expiringDocuments: MoverDocumentDto[];
  offerCount: number;
  offers: OfferDto[];
  upcomingJobs: JobSummaryDto[];
  earnings: EarningsSummaryDto;
}

export type OfferResponsePayload =
  | { action: 'ACCEPT' }
  | { action: 'DECLINE'; reason?: string }
  | { action: 'QUOTE'; amount: number; message?: string };

export interface MoverProfilePayload {
  companyName?: string;
  taxId?: string;
  bio?: string;
  zones?: string[];
  /** Null goes back to the defaults. */
  costs?: MoverCostsDto | null;
}

export interface VehiclePayload {
  type: VehicleType;
  capacityM3: number;
  plate: string;
}

export interface TeamMemberPayload {
  name: string;
  phone?: string;
  role?: string;
}

/** What every mover Server Action returns: plain data, safe to cross to the browser. */
export type MoverActionResult<T> =
  { ok: true; data: T } | { ok: false; message: string; code: string };
