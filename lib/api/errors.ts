import type { AxiosError } from 'axios';
import type { ServerErrorResponse } from '@/types';

/** Pulls the server's `message` out of a failed API call (falls back to a generic). */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && 'response' in error) {
    const axiosError = error as AxiosError<ServerErrorResponse>;
    return axiosError.response?.data?.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}
