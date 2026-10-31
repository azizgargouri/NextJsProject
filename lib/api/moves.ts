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

export interface MoveResponse {
  move: {
    id: string;
    reference: string;
    pickupAddress: string;
    destinationAddress: string;
    distance: number;
    volume: number;
    estimatedPrice: number;
    trackingToken: string;
    currentStage: string;
    vehicle: {
      name: string;
      capacity: number;
    };
  };
}

export const movesApi = {
  create: async (payload: MoveCreatePayload): Promise<MoveResponse> => {
    const { data } = await axiosClient.post<MoveResponse>('/api/moves', payload);
    return data;
  },
  getOne: async (id: string, token: string): Promise<MoveResponse> => {
    const { data } = await axiosClient.get<MoveResponse>(`/api/moves/${id}`, {
      params: { token },
    });
    return data;
  },
};
