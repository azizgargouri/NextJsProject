'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Error boundary for the workspace segment (course ch.2 error.tsx) — must be a Client Component. */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="border border-hazard p-8">
      <p className="mono text-[10px] text-hazard">ERROR</p>
      <h1 className="display mt-2 text-3xl">This page could not load.</h1>
      <p className="mono mt-3 text-[11px] normal-case tracking-normal text-ink-80">
        Check your connection — if you are offline, pages you visited before are still available.
      </p>
      <Button className="mt-6" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
