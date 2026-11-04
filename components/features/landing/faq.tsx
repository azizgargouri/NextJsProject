'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { SectionHeading } from '@/components/shared/section-heading';
import type { LandingMessages } from '@/lib/i18n/landing';
import { cn } from '@/lib/utils';

/**
 * FAQ — the answers a client needs before trusting a move to strangers.
 * Disclosure buttons (aria-expanded/controls); panels animate their height
 * with a grid-rows 0fr → 1fr transition, so no layout measuring is needed.
 */
export function Faq({ t }: { t: LandingMessages['faq'] }) {
  const [open, setOpen] = useState<number | null>(0);
  const baseId = useId();

  return (
    <section
      id="faq"
      tabIndex={-1}
      aria-labelledby="faq-title"
      className="scroll-mt-14 border-b border-ink bg-paper outline-none"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-24 md:grid-cols-12 md:px-6 md:py-32">
        <div className="md:col-span-4">
          <SectionHeading
            id="faq-title"
            index={t.index}
            title={t.title}
            size="column"
            className="md:sticky md:top-28"
          />
        </div>
        <ul className="border-t-2 border-ink md:col-span-8">
          {t.items.map((item, index) => {
            const expanded = open === index;
            const panelId = `${baseId}-panel-${index}`;
            const buttonId = `${baseId}-button-${index}`;
            return (
              <li key={index} className="border-b border-ink">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : index)}
                    className="group flex w-full items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="display text-xl leading-tight md:text-2xl">{item.q}</span>
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center border-2 border-ink transition-colors duration-200 group-hover:bg-ink group-hover:text-paper',
                        expanded && 'bg-hazard text-white',
                      )}
                    >
                      <Plus
                        className={cn(
                          'size-4 transition-transform duration-300 ease-out',
                          expanded && 'rotate-45',
                        )}
                      />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className={cn(
                    'grid transition-[grid-template-rows] duration-300 ease-out',
                    expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                  )}
                >
                  <div className="overflow-hidden" inert={!expanded}>
                    <p className="max-w-[62ch] pb-7 text-base leading-relaxed text-ink-80">
                      {item.a}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
