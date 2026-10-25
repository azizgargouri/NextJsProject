import { Archivo, JetBrains_Mono } from 'next/font/google';

/** Archivo (grotesk) — display + body. Never Inter. */
export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

/** JetBrains Mono — telemetry data, labels, coordinates. */
export const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
