'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

export interface AdminPageMeta {
  breadcrumbs: AdminBreadcrumb[];
  title: string;
  description?: string;
  actions?: ReactNode;
}

interface AdminShellContextValue {
  page: AdminPageMeta | null;
  footer: ReactNode;
  setPage: (page: AdminPageMeta) => void;
  clearPage: () => void;
  setFooter: (footer: ReactNode) => void;
  clearFooter: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [page, setPageState] = useState<AdminPageMeta | null>(null);
  const [footer, setFooterState] = useState<ReactNode>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const setPage = useCallback((next: AdminPageMeta) => setPageState(next), []);
  const clearPage = useCallback(() => setPageState(null), []);
  const setFooter = useCallback((next: ReactNode) => setFooterState(next), []);
  const clearFooter = useCallback(() => setFooterState(null), []);

  const value = useMemo(
    () => ({
      page,
      footer,
      setPage,
      clearPage,
      setFooter,
      clearFooter,
      mobileNavOpen,
      setMobileNavOpen,
    }),
    [page, footer, setPage, clearPage, setFooter, clearFooter, mobileNavOpen],
  );

  return <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>;
}

export function useAdminShell() {
  const context = useContext(AdminShellContext);
  if (!context) throw new Error('useAdminShell must be used inside AdminShellProvider');
  return context;
}
