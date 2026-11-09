'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Submit button that reads the pending state of its parent <form action={…}>
 * (course ch.5 "États de chargement (useFormStatus)"). Must be rendered INSIDE the form.
 */
export function SubmitButton({
  children,
  pendingLabel = 'Sending…',
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="animate-spin" /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'mono min-h-28 w-full border border-ink bg-paper px-3 py-2 text-[13px] normal-case leading-6 tracking-normal text-ink placeholder:text-ink-40 focus-visible:border-hazard focus-visible:outline-none aria-[invalid=true]:border-hazard',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'mono h-12 w-full border border-ink bg-paper px-3 text-[13px] normal-case tracking-normal text-ink focus-visible:border-hazard focus-visible:outline-none aria-[invalid=true]:border-hazard',
      className,
    )}
    {...props}
  />
));
NativeSelect.displayName = 'NativeSelect';

/** Read-only star display; accessible label carries the value. */
export function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <Star
          key={index}
          aria-hidden
          className={cn(
            size === 'lg' ? 'size-5' : 'size-3.5',
            index <= Math.round(value) ? 'fill-hazard text-hazard' : 'text-ink-40',
          )}
        />
      ))}
    </span>
  );
}

/** 1–5 star input built on radio buttons: keyboard-accessible and works in a plain <form>. */
export function StarInput({
  name,
  label,
  defaultValue,
  onValueChange,
  required,
  error,
}: {
  name: string;
  label: string;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  required?: boolean;
  error?: string;
}) {
  const [value, setValue] = React.useState(defaultValue ?? 0);
  React.useEffect(() => {
    if (defaultValue !== undefined) setValue(defaultValue);
  }, [defaultValue]);
  return (
    <fieldset>
      <legend className="mono pb-2 text-[10px] text-ink-80">
        {label}
        {required ? ' *' : ''}
      </legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <label key={score} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={score}
              required={required && score === 1}
              checked={value === score}
              onChange={() => {
                setValue(score);
                onValueChange?.(score);
              }}
              className="peer sr-only"
            />
            <Star
              aria-hidden
              className={cn(
                'size-7 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-hazard',
                score <= value ? 'fill-hazard text-hazard' : 'text-ink-40 hover:text-ink',
              )}
            />
            <span className="sr-only">
              {score} star{score > 1 ? 's' : ''}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p className="mono mt-1 text-[10px] normal-case tracking-normal text-hazard">{error}</p>
      ) : null}
    </fieldset>
  );
}

export function FormMessage({ ok, message }: { ok: boolean; message: string }) {
  if (!message) return null;
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={cn(
        'mono border px-3 py-2 text-[11px] normal-case tracking-normal',
        ok ? 'border-ink bg-ink text-paper' : 'border-hazard text-hazard',
      )}
    >
      {message}
    </p>
  );
}
