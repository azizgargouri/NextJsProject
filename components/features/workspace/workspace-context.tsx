'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAuthStore, type AuthUser } from '@/hooks/stores/auth-store';

/**
 * Workspace context (course ch.4 "Contexte & État avancé"): every page of the client /
 * mover workspace reads the current user and role from here instead of prop drilling.
 */
interface WorkspaceValue {
  user: AuthUser | null;
  isClient: boolean;
  isMover: boolean;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const value = useMemo<WorkspaceValue>(
    () => ({ user, isClient: user?.role === 'CLIENT', isMover: user?.role === 'MOVER' }),
    [user],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/** Custom hook: throws early if a component is rendered outside the provider. */
export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return value;
}
