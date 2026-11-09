import localFont from 'next/font/local';

/**
 * Fonts ship with the app, so neither building nor running it needs the internet.
 * Both files are variable fonts covering every weight below.
 */

/** Archivo (grotesk) — display + body. Never Inter. */
export const archivo = localFont({
  src: '../styles/fonts/archivo-latin.woff2',
  weight: '400 900',
  variable: '--font-archivo',
  display: 'swap',
});

/** JetBrains Mono — telemetry data, labels, coordinates. */
export const jetbrainsMono = localFont({
  src: '../styles/fonts/jetbrains-mono-latin.woff2',
  weight: '400 700',
  variable: '--font-jetbrains-mono',
  display: 'swap',
});
