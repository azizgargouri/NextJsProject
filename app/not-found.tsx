import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-start justify-center px-4 py-16">
      <p className="mono text-[10px] text-ink-40">404 · NOT FOUND</p>
      <h1 className="display mt-3 text-5xl md:text-7xl">THIS PAGE MOVED.</h1>
      <p className="mt-4 max-w-md text-sm text-ink-80">
        The page you are looking for does not exist or has been moved somewhere else.
      </p>
      <Link
        href="/"
        className="mono mt-8 border-b-2 border-ink pb-0.5 text-[10px] hover:border-hazard hover:text-hazard"
      >
        ← BACK TO MOVEUP
      </Link>
    </main>
  );
}
