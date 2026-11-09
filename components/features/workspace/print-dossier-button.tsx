'use client';

import { Printer } from 'lucide-react';

/**
 * Triggers a clean browser print / Save-as-PDF of the official MoveUp Claim & Vision AI Dossier.
 */
export function PrintDossierButton({ reference }: { reference: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      title={`Export ${reference} as PDF / Print Dossier`}
      className="mono inline-flex items-center gap-2 border border-ink bg-paper px-3 py-1.5 text-[10px] font-bold text-ink transition-colors hover:border-hazard hover:text-hazard print:hidden"
    >
      <Printer className="size-3.5" /> EXPORT / PRINT DOSSIER (PDF)
    </button>
  );
}

