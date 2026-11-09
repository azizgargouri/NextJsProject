import * as React from 'react';
import { cn } from '@/lib/utils';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Native select dressed in the design system (matches <Input>). */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'mono h-11 w-full appearance-none border border-ink bg-paper px-3 pr-8 text-[12px] normal-case tracking-normal text-ink transition-colors focus-visible:border-hazard focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-ink-80"
      >
        ▼
      </span>
    </div>
  ),
);
Select.displayName = 'Select';

export { Select };
