import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, EmployeeStatus, LeaveStatus } from '@/types';

const statusChipVariants = cva(
  'mono inline-flex items-center whitespace-nowrap border px-2 py-1 text-[9px] leading-none',
  {
    variants: {
      variant: {
        ink: 'border-ink bg-ink text-paper',
        hazard: 'border-hazard bg-hazard text-white',
        outline: 'border-ink bg-transparent text-ink',
        quiet: 'border-ink/30 bg-transparent text-ink-40',
      },
    },
    defaultVariants: { variant: 'outline' },
  },
);

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusChipVariants> {}

export function StatusChip({ className, variant, ...props }: StatusChipProps) {
  return <span className={cn(statusChipVariants({ variant, className }))} {...props} />;
}

type ChipVariant = NonNullable<VariantProps<typeof statusChipVariants>['variant']>;

const ATTENDANCE: Record<AttendanceStatus, { label: string; variant: ChipVariant }> = {
  present: { label: 'Present', variant: 'ink' },
  late: { label: 'Late', variant: 'hazard' },
  absent: { label: 'Absent', variant: 'hazard' },
  leave: { label: 'Leave', variant: 'outline' },
  halfDay: { label: 'Half day', variant: 'outline' },
};

const LEAVE: Record<LeaveStatus, { label: string; variant: ChipVariant }> = {
  pending: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'ink' },
  rejected: { label: 'Rejected', variant: 'hazard' },
};

const EMPLOYEE: Record<EmployeeStatus, { label: string; variant: ChipVariant }> = {
  active: { label: 'Active', variant: 'ink' },
  inactive: { label: 'Inactive', variant: 'quiet' },
  pending: { label: 'Pending', variant: 'outline' },
};

/** Today's roster state (checked in / on leave / absent / not checked in). */
const ROSTER: Record<'in' | 'leave' | 'absent' | 'out', { label: string; variant: ChipVariant }> = {
  in: { label: 'Checked in', variant: 'ink' },
  leave: { label: 'On leave', variant: 'outline' },
  absent: { label: 'Absent', variant: 'hazard' },
  out: { label: 'Not checked in', variant: 'quiet' },
};

const CONFIG = {
  attendance: ATTENDANCE,
  leave: LEAVE,
  employee: EMPLOYEE,
  roster: ROSTER,
} as const;

export type StatusKind = keyof typeof CONFIG;

/** Renders the MoveUp-styled label for a domain status value. */
export function StatusLabel({
  kind,
  value,
  className,
}: {
  kind: StatusKind;
  value: string;
  className?: string;
}) {
  const entry = (
    CONFIG[kind] as Record<string, { label: string; variant: ChipVariant } | undefined>
  )[value];
  if (!entry) return <span className={cn('mono text-[9px] text-ink-40', className)}>{value}</span>;

  return (
    <StatusChip variant={entry.variant} className={className}>
      {entry.label}
    </StatusChip>
  );
}
