import * as React from 'react';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mono block text-[10px] text-ink-80 leading-none pb-2', className)}
      {...props}
    />
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mono mt-1 text-[10px] normal-case tracking-normal text-hazard">{message}</p>;
}

export function FieldRow({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-px', className)} {...props} />;
}
