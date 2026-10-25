import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  locale: string;
  createdAt: string;
}

interface AuthActions {
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  updateProfile: (profile: Partial<AuthUser>) => void;
  logout: () => void;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

export type AuthStore = AuthState & AuthActions;

/** Client-side auth session state (Zustand + persist), synced from API responses. */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setSession: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (accessToken) => set({ accessToken }),

      updateProfile: (profile) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...profile } : state.user,
        })),

      logout: () => set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'moveup-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
