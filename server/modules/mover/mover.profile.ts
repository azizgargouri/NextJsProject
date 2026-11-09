import { BadRequestError, NotFoundError, ValidationError } from '../../shared/database/errors';
import type {
  AvailabilityDayDto,
  EarningsDto,
  EarningsSummaryDto,
  MoverApplicationDto,
  MoverDashboardDto,
  MoverDocumentDto,
  MoverDocumentType,
  MoverProfileDto,
  TeamMemberDto,
  VehicleDto,
} from '../../../types/mover';
import type { EarningDoc, PayoutDoc } from '../../shared/database/models';
import { MAX_UPLOAD_BYTES, SERVICE_ZONES } from './mover.constants';
import { listJobs } from './mover.jobs';
import { listOffers } from './mover.offers';
import { moverCosts } from './mover.profit';
import { moverRepository as repo } from './mover.repository';
import { documentState, roundMoney, sniffFile, todayInTunis } from './mover.rules';
import type {
  AvailabilitySetInput,
  MoverProfileUpdateInput,
  TeamMemberInput,
  VehicleInput,
} from './mover.schema';
import {
  serializeAvailability,
  serializeDocument,
  serializeEarning,
  serializePayout,
  serializeTeamMember,
  serializeVehicle,
} from './mover.serializer';
import { moverStorage } from './mover.storage';

// ---------- application status (M-02) ----------

export async function getApplication(moverId: string): Promise<MoverApplicationDto> {
  const user = await repo.findUser(moverId);
  if (!user) throw new NotFoundError('User');
  // Sign-up does not create a profile yet, so a mover's first visit opens the application.
  const profile = await repo.ensureProfile(moverId, user.name);
  return {
    status: profile.verificationStatus,
    companyName: profile.companyName,
    submittedAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    canAccessDashboard: profile.verificationStatus === 'APPROVED',
  };
}

// ---------- availability and zones (M-03) ----------

export async function listAvailability(
  moverId: string,
  from: string,
  to: string,
): Promise<AvailabilityDayDto[]> {
  if (from > to) throw new BadRequestError('The start date must come before the end date');
  return (await repo.listAvailability(moverId, from, to)).map(serializeAvailability);
}

export async function setAvailability(
  moverId: string,
  input: AvailabilitySetInput,
): Promise<AvailabilityDayDto | null> {
  if (input.date < todayInTunis()) {
    throw new ValidationError('Past days cannot be changed', {
      fieldErrors: { date: ['Past days cannot be changed'] },
    });
  }
  if (input.slot === null) {
    await repo.clearAvailability(moverId, input.date);
    return null;
  }
  await repo.setAvailability(moverId, input.date, input.slot);
  return { date: input.date, slot: input.slot };
}

// ---------- profile, vehicles, team, documents (M-10) ----------

export async function getProfile(moverId: string): Promise<MoverProfileDto> {
  const [user, profile, vehicles, team, documents] = await Promise.all([
    repo.findUser(moverId),
    repo.findProfile(moverId),
    repo.listVehicles(moverId),
    repo.listTeam(moverId),
    repo.listDocuments(moverId),
  ]);
  if (!user || !profile) throw new NotFoundError('Mover profile');
  return {
    companyName: profile.companyName,
    taxId: profile.taxId ?? '',
    bio: profile.bio,
    zones: profile.zones,
    ratingAvg: profile.ratingAvg,
    ratingCount: profile.ratingCount,
    verificationStatus: profile.verificationStatus,
    account: { name: user.name, email: user.email, phone: user.phone },
    vehicles: vehicles.map(serializeVehicle),
    team: team.map(serializeTeamMember),
    documents: documents.map((document) => serializeDocument(document)),
    availableZones: SERVICE_ZONES.map((zone) => ({ code: zone.code, label: zone.label })),
    costs: moverCosts(profile),
    costsAreDefaults: !profile.costs,
  };
}

export async function updateProfile(
  moverId: string,
  input: MoverProfileUpdateInput,
): Promise<MoverProfileDto> {
  await repo.updateProfile(moverId, input);
  return getProfile(moverId);
}

export async function addVehicle(moverId: string, input: VehicleInput): Promise<VehicleDto> {
  return serializeVehicle(await repo.createVehicle(moverId, input));
}

export async function editVehicle(
  moverId: string,
  id: string,
  input: VehicleInput,
): Promise<VehicleDto> {
  const vehicle = await repo.updateVehicle(moverId, id, input);
  if (!vehicle) throw new NotFoundError('Vehicle');
  return serializeVehicle(vehicle);
}

export async function removeVehicle(moverId: string, id: string): Promise<void> {
  if (!(await repo.deleteVehicle(moverId, id))) throw new NotFoundError('Vehicle');
}

export async function addTeamMember(
  moverId: string,
  input: TeamMemberInput,
): Promise<TeamMemberDto> {
  return serializeTeamMember(await repo.createTeamMember(moverId, input));
}

export async function editTeamMember(
  moverId: string,
  id: string,
  input: TeamMemberInput,
): Promise<TeamMemberDto> {
  const member = await repo.updateTeamMember(moverId, id, input);
  if (!member) throw new NotFoundError('Team member');
  return serializeTeamMember(member);
}

export async function removeTeamMember(moverId: string, id: string): Promise<void> {
  if (!(await repo.deleteTeamMember(moverId, id))) throw new NotFoundError('Team member');
}

export async function uploadDocument(
  moverId: string,
  type: MoverDocumentType,
  expiresAt: string | undefined,
  file: { bytes: Uint8Array; name: string },
): Promise<MoverDocumentDto> {
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new BadRequestError('This file is over 8 MB');
  }
  const sniffed = sniffFile(file.bytes);
  if (!sniffed) throw new BadRequestError('Use a PDF, JPEG, PNG or WebP file');

  const storageKey = moverStorage.newKey(moverId, 'documents', sniffed.extension);
  await moverStorage.putObject(storageKey, file.bytes);
  const document = await repo.upsertDocument(moverId, type, {
    storageKey,
    contentType: sniffed.contentType,
    fileName: file.name.slice(0, 120),
    // A document stays valid through the whole of its expiry day, in Tunisian time.
    expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59.999+01:00`) : null,
  });
  return serializeDocument(document);
}

// ---------- earnings (M-09) ----------

function summarize(earnings: EarningDoc[], payouts: PayoutDoc[]): EarningsSummaryDto {
  const sum = (values: number[]) => roundMoney(values.reduce((total, value) => total + value, 0));
  return {
    currency: 'TND',
    gross: sum(earnings.map((earning) => earning.gross)),
    commission: sum(earnings.map((earning) => earning.commission)),
    net: sum(earnings.map((earning) => earning.net)),
    pending: sum(
      earnings.filter((earning) => earning.status === 'PENDING').map((earning) => earning.net),
    ),
    paidOut: sum(payouts.map((payout) => payout.amount)),
    completedJobs: earnings.length,
  };
}

export async function getEarnings(moverId: string): Promise<EarningsDto> {
  const [earnings, payouts] = await Promise.all([
    repo.listEarnings(moverId),
    repo.listPayouts(moverId),
  ]);
  return {
    summary: summarize(earnings, payouts),
    earnings: earnings.map(serializeEarning),
    payouts: payouts.map(serializePayout),
  };
}

// ---------- dashboard home ----------

export async function getDashboard(moverId: string): Promise<MoverDashboardDto> {
  const [offers, jobs, earnings, documents] = await Promise.all([
    listOffers(moverId),
    listJobs(moverId),
    getEarnings(moverId),
    repo.listDocuments(moverId),
  ]);
  const now = new Date();
  return {
    eligibility: offers.eligibility,
    expiringDocuments: documents
      .filter((document) => documentState(document.expiresAt, now).state === 'EXPIRING')
      .map((document) => serializeDocument(document, now)),
    offerCount: offers.offers.length,
    offers: offers.offers.slice(0, 3),
    upcomingJobs: jobs.active.slice(0, 3),
    earnings: earnings.summary,
  };
}
