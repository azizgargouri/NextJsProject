import { axiosClient } from './client';
import type {
  AvailabilityDayDto,
  EarningsDto,
  JobDetailDto,
  JobsListDto,
  MessageDto,
  MessageThread,
  MoverApplicationDto,
  MoverDashboardDto,
  MoverDocumentDto,
  MoverDocumentType,
  MoverPhotoStage,
  MoverProfileDto,
  NotificationsDto,
  OfferDto,
  OffersListDto,
  PhotoDto,
} from '@/types';

/** Uploads travel over mobile data, so they get far longer than the default 15 s. */
const UPLOAD_TIMEOUT_MS = 120_000;

export const moverApi = {
  application: async (): Promise<MoverApplicationDto> =>
    (await axiosClient.get<{ application: MoverApplicationDto }>('/api/mover/application')).data
      .application,

  dashboard: async (): Promise<MoverDashboardDto> =>
    (await axiosClient.get<MoverDashboardDto>('/api/mover/dashboard')).data,

  offers: async (): Promise<OffersListDto> =>
    (await axiosClient.get<OffersListDto>('/api/mover/offers')).data,

  offer: async (id: string): Promise<OfferDto> =>
    (await axiosClient.get<{ offer: OfferDto }>(`/api/mover/offers/${id}`)).data.offer,

  jobs: async (): Promise<JobsListDto> =>
    (await axiosClient.get<JobsListDto>('/api/mover/jobs')).data,

  job: async (id: string): Promise<JobDetailDto> =>
    (await axiosClient.get<{ job: JobDetailDto }>(`/api/mover/jobs/${id}`)).data.job,

  photos: async (id: string): Promise<PhotoDto[]> =>
    (await axiosClient.get<{ photos: PhotoDto[] }>(`/api/mover/jobs/${id}/photos`)).data.photos,

  addPhoto: async (id: string, stage: MoverPhotoStage, file: File): Promise<PhotoDto> => {
    const form = new FormData();
    form.set('stage', stage);
    form.set('file', file);
    const { data } = await axiosClient.post<{ photo: PhotoDto }>(
      `/api/mover/jobs/${id}/photos`,
      form,
      { timeout: UPLOAD_TIMEOUT_MS },
    );
    return data.photo;
  },

  messages: async (moveId: string, thread: MessageThread): Promise<MessageDto[]> =>
    (
      await axiosClient.get<{ messages: MessageDto[] }>(`/api/moves/${moveId}/messages`, {
        params: { thread },
      })
    ).data.messages,

  sendMessage: async (moveId: string, thread: MessageThread, body: string): Promise<MessageDto> =>
    (
      await axiosClient.post<{ message: MessageDto }>(`/api/moves/${moveId}/messages`, {
        thread,
        body,
      })
    ).data.message,

  availability: async (from: string, to: string): Promise<AvailabilityDayDto[]> =>
    (
      await axiosClient.get<{ days: AvailabilityDayDto[] }>('/api/mover/availability', {
        params: { from, to },
      })
    ).data.days,

  profile: async (): Promise<MoverProfileDto> =>
    (await axiosClient.get<{ profile: MoverProfileDto }>('/api/mover/profile')).data.profile,

  uploadDocument: async (
    type: MoverDocumentType,
    file: File,
    expiresAt?: string,
  ): Promise<MoverDocumentDto> => {
    const form = new FormData();
    form.set('type', type);
    form.set('file', file);
    if (expiresAt) form.set('expiresAt', expiresAt);
    const { data } = await axiosClient.post<{ document: MoverDocumentDto }>(
      '/api/mover/documents',
      form,
      { timeout: UPLOAD_TIMEOUT_MS },
    );
    return data.document;
  },

  earnings: async (): Promise<EarningsDto> =>
    (await axiosClient.get<EarningsDto>('/api/mover/earnings')).data,

  notifications: async (): Promise<NotificationsDto> =>
    (await axiosClient.get<NotificationsDto>('/api/mover/notifications')).data,
};
