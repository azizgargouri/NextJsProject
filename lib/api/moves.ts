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
  pickup?: { city?: string; zone?: string; postalCode?: string; floor?: number; hasElevator?: boolean; accessNotes?: string };
  dropoff?: { city?: string; zone?: string; postalCode?: string; floor?: number; hasElevator?: boolean; accessNotes?: string };
  housingType?: string; sizeRooms?: number; extraServices?: string[]; notes?: string;
  vehicleName?: string;
  /** YYYY-MM-DD */
  moveDate?: string;
  timeSlot?: 'MORNING' | 'AFTERNOON' | 'FULL_DAY';
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
  offersSent?: number;
  quotes?: { id: string; moverId: string; moverName: string; amount: number; currency: string; message: string; status: string; validUntil: string }[];
  history?: { fromStatus: string | null; toStatus: string; note: string; createdAt: string }[];
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

  acceptQuote: async (moveId: string, quoteId: string): Promise<{ jobId: string }> => {
    const { data } = await axiosClient.post<{ jobId: string }>(`/api/moves/${moveId}/quotes/${quoteId}/accept`);
    return data;
  },
};
