import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmLoadAction,
  markNotificationsReadAction,
  removeBoxScanAction,
  removeTeamMemberAction,
  removeVehicleAction,
  respondToOfferAction,
  saveTeamMemberAction,
  scanBoxAction,
  saveVehicleAction,
  setAvailabilityAction,
  updateJobStatusAction,
  updateMoverProfileAction,
} from '@/app/(mover)/mover/actions';
import { callMoverAction } from '@/lib/actions/mover-action';
import { api } from '@/lib/api';
import type {
  JobAction,
  JobDetailDto,
  LoadCheckPayload,
  MessageThread,
  MoverDocumentType,
  MoverPhotoStage,
  MoverProfilePayload,
  OfferResponsePayload,
  TeamMemberPayload,
  TimeSlot,
  VehiclePayload,
} from '@/types';

/** Offers, jobs and notifications change on the server, so they keep polling. */
/**
 * React Query normally skips requests while offline. Sending them lets the
 * service worker answer with the saved copy, or fail into an honest error state.
 */
const ALWAYS_TRY = 'always';

const LIVE_POLL_MS = 30_000;
const CHAT_POLL_MS = 5_000;

export function useMoverApplication() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'application'],
    queryFn: api.mover.application,
    staleTime: 0,
  });
}

export function useMoverDashboard() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'dashboard'],
    queryFn: api.mover.dashboard,
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useMoverOffers() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'offers'],
    queryFn: api.mover.offers,
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useMoverOffer(id: string) {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'offers', id],
    queryFn: () => api.mover.offer(id),
    staleTime: 0,
  });
}

export function useRespondToOffer(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: OfferResponsePayload) =>
      callMoverAction(respondToOfferAction(id, payload)),
    onSettled: () => client.invalidateQueries({ queryKey: ['mover'] }),
  });
}

export function useMoverJobs() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'jobs'],
    queryFn: api.mover.jobs,
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useMoverJob(id: string) {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'jobs', id],
    queryFn: () => api.mover.job(id),
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useUpdateJobStatus(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: JobAction) => callMoverAction(updateJobStatusAction(id, { action })),
    onSettled: () => client.invalidateQueries({ queryKey: ['mover'] }),
  });
}

export function useConfirmLoad(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoadCheckPayload) => callMoverAction(confirmLoadAction(id, payload)),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mover', 'jobs', id] }),
  });
}

const boxScanKey = (id: string) => ['mover', 'boxes', id];

/**
 * Scans can arrive faster than the server answers, or wait for a connection.
 * One queue per job sends them in order, so each answer is the latest list of
 * boxes; a poll still in flight must not put an older list back.
 */
function useBoxMutation<T>(
  id: string,
  kind: 'scan' | 'remove',
  mutationFn: (input: T) => Promise<JobDetailDto>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: [...boxScanKey(id), kind],
    scope: { id: boxScanKey(id).join(':') },
    mutationFn,
    onMutate: () => client.cancelQueries({ queryKey: ['mover', 'jobs', id], exact: true }),
    onSuccess: (job) => client.setQueryData(['mover', 'jobs', id], job),
  });
}

export const useScanBox = (id: string) =>
  useBoxMutation(id, 'scan', (code: string) => callMoverAction(scanBoxAction(id, { code })));

export const useRemoveBoxScan = (id: string) =>
  useBoxMutation(id, 'remove', (scanId: string) =>
    callMoverAction(removeBoxScanAction(id, scanId)),
  );

/** Scans not yet saved, including those waiting for a connection. */
export function usePendingBoxScans(id: string): { code: string; waiting: boolean }[] {
  return useMutationState({
    filters: { mutationKey: [...boxScanKey(id), 'scan'], status: 'pending' },
    select: (mutation) => ({
      code: String(mutation.state.variables ?? ''),
      waiting: mutation.state.isPaused,
    }),
  });
}

export function useJobPhotos(id: string) {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'photos', id],
    queryFn: () => api.mover.photos(id),
  });
}

export function useAddJobPhoto(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ stage, file }: { stage: MoverPhotoStage; file: File }) =>
      api.mover.addPhoto(id, stage, file),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['mover', 'photos', id] });
      // The photo counts decide whether the next status button unlocks.
      void client.invalidateQueries({ queryKey: ['mover', 'jobs', id] });
    },
  });
}

export function useJobMessages(moveId: string, thread: MessageThread, polling: boolean) {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'messages', moveId, thread],
    queryFn: () => api.mover.messages(moveId, thread),
    staleTime: 0,
    refetchInterval: polling ? CHAT_POLL_MS : false,
  });
}

export function useSendJobMessage(moveId: string, thread: MessageThread) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.mover.sendMessage(moveId, thread, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['mover', 'messages', moveId, thread] }),
  });
}

export function useMoverAvailability(from: string, to: string) {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'availability', from, to],
    queryFn: () => api.mover.availability(from, to),
    placeholderData: (previous) => previous,
  });
}

export function useSetAvailability() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ date, slot }: { date: string; slot: TimeSlot | null }) =>
      callMoverAction(setAvailabilityAction({ date, slot })),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['mover', 'availability'] });
      void client.invalidateQueries({ queryKey: ['mover', 'offers'] });
      void client.invalidateQueries({ queryKey: ['mover', 'dashboard'] });
    },
  });
}

export function useMoverProfile() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'profile'],
    queryFn: api.mover.profile,
  });
}

/** Profile edits can change whether the mover receives offers, so everything refreshes. */
function useProfileMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['mover'] }),
  });
}

export const useUpdateMoverProfile = () =>
  useProfileMutation((payload: MoverProfilePayload) =>
    callMoverAction(updateMoverProfileAction(payload)),
  );

export const useSaveVehicle = () =>
  useProfileMutation(({ id, payload }: { id?: string; payload: VehiclePayload }) =>
    callMoverAction(saveVehicleAction(id, payload)),
  );

export const useRemoveVehicle = () =>
  useProfileMutation((id: string) => callMoverAction(removeVehicleAction(id)));

export const useSaveTeamMember = () =>
  useProfileMutation(({ id, payload }: { id?: string; payload: TeamMemberPayload }) =>
    callMoverAction(saveTeamMemberAction(id, payload)),
  );

export const useRemoveTeamMember = () =>
  useProfileMutation((id: string) => callMoverAction(removeTeamMemberAction(id)));

export const useUploadDocument = () =>
  useProfileMutation(
    ({ type, file, expiresAt }: { type: MoverDocumentType; file: File; expiresAt?: string }) =>
      api.mover.uploadDocument(type, file, expiresAt),
  );

export function useMoverEarnings() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'earnings'],
    queryFn: api.mover.earnings,
    staleTime: 0,
  });
}

export function useMoverNotifications() {
  return useQuery({
    networkMode: ALWAYS_TRY,
    queryKey: ['mover', 'notifications'],
    queryFn: api.mover.notifications,
    staleTime: 0,
    refetchInterval: LIVE_POLL_MS,
  });
}

export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => callMoverAction(markNotificationsReadAction({ ids })),
    onSuccess: (data) => client.setQueryData(['mover', 'notifications'], data),
  });
}
