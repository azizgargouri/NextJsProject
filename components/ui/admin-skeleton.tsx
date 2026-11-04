import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function AdminSkeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}
