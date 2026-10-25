import type { Metadata, Viewport } from 'next';
import { archivo, jetbrainsMono } from '@/lib/fonts';
import { Providers } from './providers';
import '@/styles/globals.css';

const APP_NAME = 'MoveUp';
const APP_DESCRIPTION =
  'One request. Vetted movers. Every step tracked. MoveUp matches you with a qualified mover and follows your move from quote to delivery.';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Moves, tracked to the millimetre`,
    template: `%s — ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: ['moving', 'movers', 'Tunisia', 'Tunis', 'Sfax', 'relocation', 'freight'],
};

export const viewport: Viewport = {
  themeColor: '#f2f1ec',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${archivo.variable} ${jetbrainsMono.variable} grain min-h-dvh antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
