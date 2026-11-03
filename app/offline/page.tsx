import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Offline' };

/** Static fallback precached by the service worker; shown when a page is not in cache. */
export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
      <p className="mono text-[10px] text-hazard">NO CONNECTION</p>
      <h1 className="display mt-2 text-5xl">YOU ARE OFFLINE.</h1>
      <p className="mono mt-4 text-[11px] normal-case tracking-normal text-ink-80">
        Pages you already opened (your claims, your reviews, the assistant history) are still
        available. New claims, reviews and AI answers need a connection.
      </p>
      <Link
        href="/dashboard"
        className="mono mt-8 w-fit border-2 border-ink px-6 py-3 text-[11px] hover:bg-ink hover:text-paper"
      >
        Back to my workspace
      </Link>
    </main>
  );
}
