'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import { useMoverJob } from '@/hooks/content/mover';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { boxLabelCode, MAX_LABELS_PER_SHEET } from '@/lib/box-label';
import { ErrorState, LoadingState, PageTitle, TextInput } from './mover-ui';

const DEFAULT_LABELS = 20;
const LAST_BOX_NUMBER = 9999;

interface BoxLabel {
  boxNumber: number;
  src: string;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

/**
 * A printable sheet of QR labels for one move. The codes are worked out from
 * the move reference and box number, so a reprint gives the same labels.
 */
export function BoxLabelSheet({ id }: { id: string }) {
  const job = useMoverJob(id);
  const listedBoxes = job.data?.proof.expectedLoad?.boxes ?? 0;
  const [count, setCount] = useState<string | null>(null);
  const [first, setFirst] = useState('1');
  const [labels, setLabels] = useState<BoxLabel[]>([]);

  const reference = job.data?.reference ?? null;
  // Up to 200 QR codes are drawn per change, so typing settles first.
  const typedCount = useDebouncedValue(count);
  const typedFirst = useDebouncedValue(first);
  const total = clamp(
    Number(typedCount ?? (listedBoxes || DEFAULT_LABELS)),
    1,
    MAX_LABELS_PER_SHEET,
  );
  const start = clamp(Number(typedFirst), 1, LAST_BOX_NUMBER - total + 1);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    const numbers = Array.from({ length: total }, (_, index) => start + index);
    void Promise.all(
      numbers.map(async (boxNumber) => ({
        boxNumber,
        src: await QRCode.toDataURL(boxLabelCode(reference, boxNumber), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 256,
        }),
      })),
    ).then((generated) => {
      if (!cancelled) setLabels(generated);
    });
    return () => {
      cancelled = true;
    };
  }, [reference, start, total]);

  if (job.isPending) return <LoadingState label="Loading job" />;
  if (job.isError) return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;

  return (
    <>
      <div className="print:hidden">
        <Link
          href={`/mover/jobs/${id}`}
          className="mb-4 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to the job
        </Link>
        <PageTitle
          title="Box labels"
          description={`QR labels for move ${job.data.reference}. Stick one on each box, then scan it at pickup as it goes into the vehicle. These labels are refused on any other move.`}
        />
        <form
          className="mb-6 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            window.print();
          }}
        >
          <div className="w-32">
            <Label htmlFor="label-count">Labels</Label>
            <TextInput
              id="label-count"
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_LABELS_PER_SHEET}
              value={count ?? String(listedBoxes || DEFAULT_LABELS)}
              onChange={(event) => setCount(event.target.value)}
            />
          </div>
          <div className="w-32">
            <Label htmlFor="label-first">First box number</Label>
            <TextInput
              id="label-first"
              type="number"
              inputMode="numeric"
              min="1"
              value={first}
              onChange={(event) => setFirst(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-12" disabled={labels.length === 0}>
            <Printer className="size-4" aria-hidden /> Print
          </Button>
        </form>
        <p className="mb-4 text-sm text-ink-80">
          Boxes {start} to {start + total - 1}
          {listedBoxes ? `. The client listed ${listedBoxes} boxes` : ''}. Up to{' '}
          {MAX_LABELS_PER_SHEET} labels per sheet; to add more later, start from the next free
          number.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px border border-ink bg-ink sm:grid-cols-3 print:grid-cols-3 print:gap-2 print:border-0 print:bg-transparent">
        {labels.map((label) => (
          <div
            key={label.boxNumber}
            className="flex break-inside-avoid flex-col items-center bg-paper p-3 text-center print:border print:border-dashed print:border-ink"
          >
            {/* A generated data URL, so next/image optimisation does not apply. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={label.src}
              alt={`QR code for box ${label.boxNumber}`}
              className="size-32 [image-rendering:pixelated]"
            />
            <p className="display mt-2 text-2xl">BOX {label.boxNumber}</p>
            <p className="mono text-[10px]">{job.data.reference}</p>
          </div>
        ))}
      </div>
    </>
  );
}
