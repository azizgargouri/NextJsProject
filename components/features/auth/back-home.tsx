import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/** Form-column header: brand (mobile) + an always-visible way back to the landing. */
export function AuthHeader() {
  return (
    <div data-form-reveal className="flex items-center justify-between gap-4">
      <Link
        href="/"
        aria-label="MoveUp home"
        className="mono flex items-center gap-2 text-sm font-bold lg:hidden"
      >
        <span className="inline-block size-2.5 bg-hazard" aria-hidden />
        MOVE<span className="text-hazard-ink">UP</span>
      </Link>
      <Link
        href="/"
        className="mono group ml-auto inline-flex min-h-11 items-center gap-2 border-b-2 border-ink text-[11px] text-ink transition-colors hover:border-hazard hover:text-hazard-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hazard"
      >
        <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
        BACK TO HOME
      </Link>
    </div>
  );
}
