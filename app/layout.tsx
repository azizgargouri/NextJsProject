import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import { archivo, jetbrainsMono } from '@/lib/fonts';
import { Providers } from './providers';
import '@/styles/globals.css';

const APP_NAME = 'MoveUp';
const APP_DESCRIPTION =
  'One request. Vetted movers. Every step tracked. MoveUp matches you with a qualified mover and follows your move from quote to delivery.';

export const metadata: Metadata = {
  metadataBase: new URL('https://moveup.local'),
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: APP_NAME,
  },
  manifest: '/manifest.webmanifest',
  title: {
    default: `${APP_NAME} — Moves, tracked to the millimetre`,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['moving', 'movers', 'Tunisia', 'Tunis', 'Sfax', 'relocation', 'freight'],
  icons: [
    { rel: 'icon', url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { rel: 'icon', url: '/icons/icon-192.svg', type: 'image/svg+xml' },
    { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
  ],
};

export const viewport: Viewport = {
  themeColor: '#f2f1ec',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${jetbrainsMono.variable} grain min-h-dvh antialiased`}>
        <PwaRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
