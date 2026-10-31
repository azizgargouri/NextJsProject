import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MoveUp',
    short_name: 'MoveUp',
    description:
      'One request. Vetted movers. Every step tracked. MoveUp matches you with a qualified mover and follows your move from quote to delivery.',
    start_url: '/',
    id: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#f2f1ec',
    theme_color: '#f2f1ec',
    orientation: 'portrait-primary',
    lang: 'en',
    categories: ['business', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Request a Move',
        short_name: 'Request',
        description: 'Calculate volume and book a mover',
        url: '/request',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Track Move',
        short_name: 'Track',
        description: 'Live move timeline and status updates',
        url: '/track',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
