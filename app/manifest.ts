import type { MetadataRoute } from 'next';

/** Installable app (PWA). Next.js links /manifest.webmanifest from every page; offline caching is public/sw.js. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'MoveUp',
    short_name: 'MoveUp',
    description: 'One request. Vetted movers. Every step tracked.',
    // The workspace: it sends clients, movers and admins to their own pages (or to sign-in).
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f1ec',
    theme_color: '#f2f1ec',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
