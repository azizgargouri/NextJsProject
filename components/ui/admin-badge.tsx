import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium leading-5',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border bg-background text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-accent text-accent-foreground',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface AdminBadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function AdminBadge({ className, variant, ...props }: AdminBadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
