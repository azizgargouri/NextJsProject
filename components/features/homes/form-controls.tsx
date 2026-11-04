import * as React from 'react';
import { cn } from '@/lib/utils';

/** Native controls styled like components/ui/input (Swiss print: ink rule, hazard focus). */
const control =
  'mono w-full border border-ink bg-paper px-3 text-[13px] normal-case tracking-normal text-ink transition-colors placeholder:text-ink-40 focus-visible:border-hazard focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-hazard';

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(control, 'h-12', className)} {...props} />
));
NativeSelect.displayName = 'NativeSelect';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(control, 'min-h-24 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }
>(({ className, label, id, ...props }, ref) => (
  <label
    htmlFor={id}
    className={cn('mono flex cursor-pointer items-center gap-3 text-[11px] text-ink', className)}
  >
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className="size-5 cursor-pointer accent-[var(--color-hazard)] focus-visible:outline-2 focus-visible:outline-hazard"
      {...props}
    />
    {label}
  </label>
));
Checkbox.displayName = 'Checkbox';
