import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { MoverShell } from '@/components/features/mover/mover-shell';

/** Installable as its own app, separate from the client and admin experiences. */
export const metadata: Metadata = {
  manifest: '/mover.webmanifest',
  appleWebApp: { capable: true, title: 'MoveUp Mover', statusBarStyle: 'black-translucent' },
  icons: { apple: '/icons/mover-apple-touch.png' },
};

export const viewport: Viewport = { themeColor: '#101010' };

export default function MoverLayout({ children }: { children: ReactNode }) {
  return <MoverShell>{children}</MoverShell>;
}
