import type {
  CrewStatus,
  EmployeeRole,
  EmployeeStatus,
} from '../../shared/database/enums';
import type { CrewMemberRow, CrewRow } from './crews.repository';

export interface CrewMemberResponse {
  id: string;
  employeeRef: string;
  fullName: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  isLeader: boolean;
}

/** Whitelisted crew response (members embedded as compact employee references). */
export interface CrewResponse {
  id: string;
  name: string;
  code: string | null;
  status: CrewStatus;
  leader: CrewMemberResponse | null;
  members: CrewMemberResponse[];
  memberCount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function serializeMember(member: CrewMemberRow, leaderId: string | null): CrewMemberResponse {
  return {
    id: member.id,
    employeeRef: member.employeeRef,
    fullName: member.fullName,
    role: member.role,
    status: member.status,
    isLeader: member.id === leaderId,
  };
}

/** Maps a crew row to the whitelisted response DTO. */
export function serializeCrew(row: CrewRow): CrewResponse {
  const members = row.members.map((member) => serializeMember(member, row.leaderId));
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    leader: members.find((member) => member.isLeader) ?? null,
    members,
    memberCount: members.length,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
