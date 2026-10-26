import { z } from 'zod';
import { BadRequestError } from '../../shared/database/errors';
import { LEAVE_DECISIONS, LEAVE_TYPES } from '../../shared/database/enums';

/** Submit payload — mirrors the local module's POST /api/leave-requests contract. */
export const LeaveCreateSchema = z
  .object({
    type: z.enum(LEAVE_TYPES),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    daysRequested: z.number().int().min(0).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

/** HR decision payload — approve or reject an existing request. */
export const LeaveDecisionSchema = z.object({
  status: z.enum(LEAVE_DECISIONS),
});

export type LeaveCreateInput = z.infer<typeof LeaveCreateSchema>;
export type LeaveDecisionInput = z.infer<typeof LeaveDecisionSchema>;

/** Resolved list query (`status` + optional employee reference). */
export interface LeaveQuery {
  status?: (typeof LEAVE_DECISIONS)[number] | 'pending';
  employeeRef?: string;
}

export function parseLeaveQuery(searchParams: URLSearchParams): LeaveQuery {
  const status = searchParams.get('status')?.trim();
  const employeeRef = searchParams.get('employeeRef')?.trim();

  let parsedStatus: LeaveQuery['status'];
  if (status) {
    if (status !== 'pending' && !LEAVE_DECISIONS.includes(status as 'approved' | 'rejected')) {
      throw new BadRequestError('Invalid status filter');
    }
    parsedStatus = status as LeaveQuery['status'];
  }

  return {
    ...(parsedStatus ? { status: parsedStatus } : {}),
    ...(employeeRef ? { employeeRef } : {}),
  };
}
