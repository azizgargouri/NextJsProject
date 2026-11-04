'use client';

import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Destructive confirmation on the native <dialog> (focus trap + Esc handled by the browser). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] border-2 border-ink bg-paper p-0 text-ink backdrop:bg-ink/50"
    >
      <div className="p-6">
        <p className="mono text-[10px] text-hazard">Confirm / cannot be undone</p>
        <h2 id="confirm-dialog-title" className="display mt-3 text-3xl">
          {title}
        </h2>
        <p className="mt-3 text-sm text-ink-80">{description}</p>
        <div className="mt-8 flex justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="hazard" size="sm" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-label="Deleting" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
