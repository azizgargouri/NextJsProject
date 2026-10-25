import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'mono inline-flex items-center justify-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hazard focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-paper hover:bg-hazard hover:text-white',
        hazard: 'bg-hazard text-white hover:bg-ink hover:text-paper',
        outline: 'border-2 border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
        ghost: 'text-ink hover:bg-ink/5',
        link: 'text-ink underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-4',
        default: 'h-11 px-6',
        lg: 'h-14 px-8 text-xs',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
