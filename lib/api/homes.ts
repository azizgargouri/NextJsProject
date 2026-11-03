import { axiosClient } from './client';
import type { PageDto } from '@/types';
import type { HomeDto, HomePayload, HomesQuery, RoomPayload } from '@/types/homes';

type HomeEnvelope = { home: HomeDto };

/** Client's new-house endpoints (Smart Room Layout). Every call returns the full house. */
export const homesApi = {
  list: async (query: HomesQuery): Promise<PageDto<HomeDto>> => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    const { data } = await axiosClient.get<PageDto<HomeDto>>('/api/homes', { params });
    return data;
  },

  get: async (id: string): Promise<HomeDto> => {
    const { data } = await axiosClient.get<HomeEnvelope>(`/api/homes/${id}`);
    return data.home;
  },

  create: async (payload: HomePayload): Promise<HomeDto> => {
    const { data } = await axiosClient.post<HomeEnvelope>('/api/homes', payload);
    return data.home;
  },

  update: async (id: string, payload: Partial<HomePayload>): Promise<HomeDto> => {
    const { data } = await axiosClient.patch<HomeEnvelope>(`/api/homes/${id}`, payload);
    return data.home;
  },

  remove: async (id: string): Promise<HomeDto> => {
    const { data } = await axiosClient.delete<HomeEnvelope>(`/api/homes/${id}`);
    return data.home;
  },

  addRoom: async (homeId: string, payload: RoomPayload): Promise<HomeDto> => {
    const { data } = await axiosClient.post<HomeEnvelope>(`/api/homes/${homeId}/rooms`, payload);
    return data.home;
  },

  updateRoom: async (homeId: string, roomId: string, payload: RoomPayload): Promise<HomeDto> => {
    const { data } = await axiosClient.patch<HomeEnvelope>(
      `/api/homes/${homeId}/rooms/${roomId}`,
      payload,
    );
    return data.home;
  },

  removeRoom: async (homeId: string, roomId: string): Promise<HomeDto> => {
    const { data } = await axiosClient.delete<HomeEnvelope>(`/api/homes/${homeId}/rooms/${roomId}`);
    return data.home;
  },
};
