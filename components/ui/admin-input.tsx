import * as React from 'react';
import { cn } from '@/lib/utils';

export type AdminInputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const AdminInput = React.forwardRef<HTMLInputElement, AdminInputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'h-9 w-full rounded-md border border-input bg-transparent px-3 text-base text-foreground shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20',
        className,
      )}
      {...props}
    />
  ),
);
AdminInput.displayName = 'AdminInput';
