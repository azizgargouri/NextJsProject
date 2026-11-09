'use server';

import { cookies } from 'next/headers';
import {
  AvailabilitySetSchema,
  BoxScanSchema,
  JobStatusSchema,
  LoadCheckSchema,
  MoverProfileUpdateSchema,
  NotificationsReadSchema,
  OfferResponseSchema,
  TeamMemberSchema,
  VehicleSchema,
  addTeamMember,
  addVehicle,
  confirmLoad,
  editTeamMember,
  editVehicle,
  markNotificationsRead,
  listNotifications,
  parse,
  removeBoxScan,
  removeTeamMember,
  removeVehicle,
  respondToOffer,
  scanBox,
  setAvailability,
  updateJobStatus,
  updateProfile,
} from '@/server/modules/mover';
import { MOVER_SESSION_COOKIE, runMoverAction } from '@/server/modules/mover/mover.action-core';

/**
 * Server Actions for the mover workspace. Each one authenticates from the
 * httpOnly cookie, validates its input with the same Zod schema as the API
 * route, and calls the same service, so the rules cannot drift apart.
 * Arguments come from the browser, so they are always treated as untrusted.
 * Uploads stay on API routes: actions cap request bodies at 1 MB by default.
 */
async function withMover<T>(work: (moverId: string) => Promise<T>) {
  const token = (await cookies()).get(MOVER_SESSION_COOKIE)?.value ?? null;
  return runMoverAction(token, work);
}

export async function respondToOfferAction(offerId: string, payload: unknown) {
  return withMover((moverId) =>
    respondToOffer(moverId, offerId, parse(OfferResponseSchema, payload)),
  );
}

export async function updateJobStatusAction(jobId: string, payload: unknown) {
  return withMover((moverId) =>
    updateJobStatus(moverId, jobId, parse(JobStatusSchema, payload).action),
  );
}

export async function confirmLoadAction(jobId: string, payload: unknown) {
  return withMover((moverId) => confirmLoad(moverId, jobId, parse(LoadCheckSchema, payload)));
}

export async function scanBoxAction(jobId: string, payload: unknown) {
  return withMover((moverId) => scanBox(moverId, jobId, parse(BoxScanSchema, payload).code));
}

export async function removeBoxScanAction(jobId: string, scanId: string) {
  return withMover((moverId) => removeBoxScan(moverId, jobId, scanId));
}

export async function setAvailabilityAction(payload: unknown) {
  return withMover((moverId) => setAvailability(moverId, parse(AvailabilitySetSchema, payload)));
}

export async function updateMoverProfileAction(payload: unknown) {
  return withMover((moverId) => updateProfile(moverId, parse(MoverProfileUpdateSchema, payload)));
}

export async function saveVehicleAction(vehicleId: string | undefined, payload: unknown) {
  return withMover((moverId) => {
    const input = parse(VehicleSchema, payload);
    return vehicleId ? editVehicle(moverId, vehicleId, input) : addVehicle(moverId, input);
  });
}

export async function removeVehicleAction(vehicleId: string) {
  return withMover((moverId) => removeVehicle(moverId, vehicleId));
}

export async function saveTeamMemberAction(memberId: string | undefined, payload: unknown) {
  return withMover((moverId) => {
    const input = parse(TeamMemberSchema, payload);
    return memberId ? editTeamMember(moverId, memberId, input) : addTeamMember(moverId, input);
  });
}

export async function removeTeamMemberAction(memberId: string) {
  return withMover((moverId) => removeTeamMember(moverId, memberId));
}

export async function markNotificationsReadAction(payload: unknown) {
  return withMover(async (moverId) => {
    await markNotificationsRead(moverId, parse(NotificationsReadSchema, payload).ids);
    return listNotifications(moverId);
  });
}
