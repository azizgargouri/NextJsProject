'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminButton } from './admin-button';

interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: AdminDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-dialog-overlay fixed inset-0 z-[90] bg-black/50" />
        <Dialog.Content
          className={cn(
            'admin-dialog-content fixed left-1/2 top-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-popover p-6 text-popover-foreground shadow-lg outline-none',
            className,
          )}
        >
          <div className="pr-8">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-2 text-sm leading-5 text-muted-foreground">
                {description}
              </Dialog.Description>
            ) : null}
          </div>
          {children ? <div className="mt-5">{children}</div> : null}
          {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
          <Dialog.Close asChild>
            <AdminButton
              variant="ghost"
              size="iconSm"
              className="absolute right-3 top-3"
              aria-label="Close dialog"
            >
              <X />
            </AdminButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
