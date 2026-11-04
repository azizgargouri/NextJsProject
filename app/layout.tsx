import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import { archivo, jetbrainsMono } from '@/lib/fonts';
import { Providers } from './providers';
import '@/styles/globals.css';

const APP_NAME = 'MoveUp';
const APP_DESCRIPTION =
  'MoveUp matches you with vetted movers and tracks every step from quote to delivery.';

export const metadata: Metadata = {
  title: {
    template: '%s | MoveUp',
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  keywords: ['moving', 'movers', 'Tunisia', 'Tunis', 'Sfax', 'relocation', 'freight'],
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
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
  maximumScale: 5,
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
