import { axiosClient } from './client';

export interface VoiceCheckinPayload {
  audio_b64: string;
  transcript: string;
  job_id: string;
  challenge: string;
  lat: number;
  lng: number;
}

export interface VoiceCheckinResult {
  decision: 'accept' | 'review' | 'reject';
  reasons: string[];
  speaker_score: number;
  voice_label: string;
  threshold: number;
  challenge_ok: boolean;
  job_ok: boolean;
  distance_m: number;
}

export interface VoiceCheckinRecord {
  id: string;
  employeeRef: string;
  decision: string;
  speakerScore: number;
  voiceLabel: string;
  challengeOk: boolean;
  jobOk: boolean;
  distanceM: number;
  reasons: string[];
  createdAt: string;
}

export interface VoiceChallenge {
  challenge: string;
  sentence: string;
}

/** Forwards a voice check-in to the Kaggle voice service via the app API. */
export const voiceApi = {
  challenge: async (): Promise<VoiceChallenge> => {
    const { data } = await axiosClient.get<VoiceChallenge>('/api/voice/challenge');
    return data;
  },
  checkin: async (payload: VoiceCheckinPayload): Promise<VoiceCheckinResult> => {
    const { data } = await axiosClient.post<VoiceCheckinResult>('/api/voice/checkin', payload, {
      timeout: 90_000,
    });
    return data;
  },
  health: async (): Promise<{ ok: boolean; body: unknown }> => {
    const { data } = await axiosClient.get('/api/voice/checkin');
    return data;
  },
  list: async (): Promise<VoiceCheckinRecord[]> => {
    const { data } = await axiosClient.get<{ checkins: VoiceCheckinRecord[] }>('/api/voice/checkins');
    return data.checkins;
  },
};
