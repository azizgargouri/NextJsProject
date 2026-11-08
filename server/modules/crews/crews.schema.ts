import { z } from 'zod';
import { CREW_STATUSES, type CrewStatus } from '../../shared/database/enums';

const ObjectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid employee id');

/** HR payload for creating a crew (members are employee ids from the directory). */
export const CrewCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(1).max(24).nullable().optional(),
  leaderEmployeeId: ObjectIdSchema.nullable().optional(),
  employeeIds: z.array(ObjectIdSchema).max(100).optional(),
  status: z.enum(CREW_STATUSES).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type CrewCreateInput = z.infer<typeof CrewCreateSchema>;

export const CrewUpdateSchema = CrewCreateSchema.partial();
export type CrewUpdateInput = z.infer<typeof CrewUpdateSchema>;

export const CrewMembersSchema = z.object({
  employeeIds: z.array(ObjectIdSchema).min(1).max(100),
});

export type CrewMembersInput = z.infer<typeof CrewMembersSchema>;

export interface CrewListQuery {
  status?: CrewStatus;
  search?: string;
}

/** Parses the optional filters accepted by `GET /api/crews`. */
export function parseCrewListQuery(searchParams: URLSearchParams): CrewListQuery {
  const rawStatus = searchParams.get('status')?.trim();
  const status =
    rawStatus && (CREW_STATUSES as readonly string[]).includes(rawStatus)
      ? (rawStatus as CrewStatus)
      : undefined;
  const search = searchParams.get('search')?.trim() || undefined;

  return {
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  };
}
