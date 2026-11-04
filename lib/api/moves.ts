import { axiosClient } from './client';

export interface MoveCreatePayload {
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  items: {
    id: string;
    name: string;
    volume: number;
    weight: number;
    quantity: number;
  }[];
  vehicleName?: string;
}

export interface MoveStageDto {
  key: string;
  title: string;
  detail: string;
  durationMinutes: number | null;
  estimatedAt: string;
  completedAt: string | null;
}

export interface MoveItemDto {
  id: string;
  name: string;
  volume: number;
  weight: number;
  quantity: number;
}

export interface MoveDataDto {
  id: string;
  reference: string;
  clientId: string;
  pickupAddress: string;
  destinationAddress: string;
  distance: number;
  volume: number;
  estimatedPrice: number;
  trackingToken?: string;
  currentStage: string;
  items?: MoveItemDto[];
  vehicle: {
    name: string;
    capacity: number;
    payload: number;
  };
  mover: {
    userId?: string;
    name: string;
    phone: string;
    companyName: string;
  };
  stages: MoveStageDto[];
  createdAt: string;
  updatedAt: string;
}

export interface MoveResponse {
  move: MoveDataDto;
}

export interface MovesListResponse {
  moves: MoveDataDto[];
}

export const movesApi = {
  create: async (payload: MoveCreatePayload): Promise<MoveResponse> => {
    const { data } = await axiosClient.post<MoveResponse>('/api/moves', payload);
    return data;
  },

  list: async (): Promise<MovesListResponse> => {
    const { data } = await axiosClient.get<MovesListResponse>('/api/moves');
    return data;
  },

  getOne: async (identifier: string, token?: string): Promise<MoveResponse> => {
    const { data } = await axiosClient.get<MoveResponse>(`/api/moves/${identifier}`, {
      params: token ? { token } : undefined,
    });
    return data;
  },

  advance: async (id: string, stage: string): Promise<MoveResponse> => {
    const { data } = await axiosClient.patch<MoveResponse>(`/api/moves/${id}`, { stage });
    return data;
  },
};
