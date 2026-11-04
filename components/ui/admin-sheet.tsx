'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminButton } from './admin-button';

interface AdminSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AdminSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: AdminSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-dialog-overlay fixed inset-0 z-[90] bg-black/50" />
        <Dialog.Content
          onPointerDownOutside={(event) => event.preventDefault()}
          className={cn(
            'admin-sheet-content fixed inset-x-0 bottom-0 z-[100] flex h-[min(500px,85dvh)] flex-col rounded-t-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none min-[1500px]:inset-y-0 min-[1500px]:left-auto min-[1500px]:h-full min-[1500px]:w-[480px] min-[1500px]:rounded-none min-[1500px]:rounded-l-xl',
            className,
          )}
        >
          <header className="shrink-0 border-b border-border px-6 py-5 pr-14">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-sm leading-5 text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : null}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="flex shrink-0 justify-end gap-2 border-t border-border px-6 py-4">
              {footer}
            </footer>
          ) : null}
          <Dialog.Close asChild>
            <AdminButton
              variant="ghost"
              size="iconSm"
              className="absolute right-4 top-4"
              aria-label="Close panel"
            >
              <X />
            </AdminButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
