import { isAxiosError } from 'axios';
import { axiosClient } from './client';
import type { PageDto } from '@/types';
import type {
  ClientMoveRequestDto,
  HomeDetailDto,
  HomeDto,
  HomePayload,
  HomesQuery,
  HomeUpdatePayload,
  LayoutItemUpdatePayload,
  LayoutPlanDto,
  RoomPayload,
} from '@/types/homes';

/** AI layout generation waits for Ollama, then Groq: far above the client's 15 s default. */
const LAYOUT_TIMEOUT_MS = 180_000;

type HomeEnvelope = { home: HomeDetailDto };

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

  get: async (id: string): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.get<HomeEnvelope>(`/api/homes/${id}`);
    return data.home;
  },

  create: async (payload: HomePayload): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.post<HomeEnvelope>('/api/homes', payload);
    return data.home;
  },

  update: async (id: string, payload: HomeUpdatePayload): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.patch<HomeEnvelope>(`/api/homes/${id}`, payload);
    return data.home;
  },

  moveRequests: async (): Promise<ClientMoveRequestDto[]> => {
    const { data } = await axiosClient.get<{ moveRequests: ClientMoveRequestDto[] }>(
      '/api/homes/move-requests',
    );
    return data.moveRequests;
  },

  remove: async (id: string): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.delete<HomeEnvelope>(`/api/homes/${id}`);
    return data.home;
  },

  addRoom: async (homeId: string, payload: RoomPayload): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.post<HomeEnvelope>(`/api/homes/${homeId}/rooms`, payload);
    return data.home;
  },

  updateRoom: async (
    homeId: string,
    roomId: string,
    payload: RoomPayload,
  ): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.patch<HomeEnvelope>(
      `/api/homes/${homeId}/rooms/${roomId}`,
      payload,
    );
    return data.home;
  },

  removeRoom: async (homeId: string, roomId: string): Promise<HomeDetailDto> => {
    const { data } = await axiosClient.delete<HomeEnvelope>(`/api/homes/${homeId}/rooms/${roomId}`);
    return data.home;
  },

  /** The house's saved layout plan, or null when none was generated yet. */
  layout: async (homeId: string): Promise<LayoutPlanDto | null> => {
    try {
      const { data } = await axiosClient.get<{ plan: LayoutPlanDto }>(
        `/api/homes/${homeId}/layout`,
      );
      return data.plan;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },

  /** `roomChoices`: pieces the client placed in a room themselves (the assistant keeps them there). */
  generateLayout: async (
    homeId: string,
    roomChoices: LayoutPlanDto['roomChoices'] = [],
  ): Promise<LayoutPlanDto> => {
    const { data } = await axiosClient.post<{ plan: LayoutPlanDto }>(
      `/api/homes/${homeId}/layout`,
      { roomChoices },
      { timeout: LAYOUT_TIMEOUT_MS },
    );
    return data.plan;
  },

  updateLayoutItem: async (
    homeId: string,
    payload: LayoutItemUpdatePayload,
  ): Promise<LayoutPlanDto> => {
    const { data } = await axiosClient.patch<{ plan: LayoutPlanDto }>(
      `/api/homes/${homeId}/layout`,
      payload,
    );
    return data.plan;
  },

  deleteLayout: async (homeId: string): Promise<void> => {
    await axiosClient.delete(`/api/homes/${homeId}/layout`);
  },
};
