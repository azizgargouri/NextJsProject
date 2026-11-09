import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { VoiceCheckinPayload } from '@/lib/api/voice';

/** Server-generated spoken challenge (never invented client-side). */
export function useVoiceChallenge(enabled = true) {
  return useQuery({
    queryKey: ['voice', 'challenge'],
    queryFn: () => api.voice.challenge(),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** Voice check-in forwarded to the Kaggle voice service (no local state). */
export function useVoiceCheckin() {
  return useMutation({
    mutationFn: (payload: VoiceCheckinPayload) => api.voice.checkin(payload),
  });
}

/** Recent voice attempts for the RH dashboard (different-voice detection). */
export function useVoiceCheckins(enabled = true) {
  return useQuery({
    queryKey: ['voice', 'checkins'],
    queryFn: () => api.voice.list(),
    enabled,
    refetchInterval: 20_000,
  });
}
