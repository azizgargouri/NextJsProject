import {
  addCrewMembersAction,
  archiveCrewAction,
  createCrewAction,
  removeCrewMemberAction,
  updateCrewAction,
} from '@/app/actions/hr';
import { actionAccessToken, unwrapActionResult } from '@/lib/actions/client';
import { axiosClient } from './client';
import type {
  CrewDto,
  CrewStatus,
  CrewUpdatePayload,
  CrewWritePayload,
} from '@/types';

export interface CrewListParams {
  status?: CrewStatus;
  search?: string;
}

/** HR crew endpoints (admin-only, organisation-scoped server-side). */
export const crewsApi = {
  list: async (params: CrewListParams = {}): Promise<CrewDto[]> => {
    const { data } = await axiosClient.get<{ crews: CrewDto[] }>('/api/crews', {
      params,
    });
    return data.crews;
  },
  get: async (id: string): Promise<CrewDto> => {
    const { data } = await axiosClient.get<{ crew: CrewDto }>(`/api/crews/${id}`);
    return data.crew;
  },
  create: async (payload: CrewWritePayload): Promise<CrewDto> =>
    unwrapActionResult(await createCrewAction(actionAccessToken(), payload)),
  update: async (id: string, payload: CrewUpdatePayload): Promise<CrewDto> =>
    unwrapActionResult(await updateCrewAction(actionAccessToken(), id, payload)),
  /** Archives the crew; historical tracking data remains intact. */
  archive: async (id: string): Promise<CrewDto> =>
    unwrapActionResult(await archiveCrewAction(actionAccessToken(), id)),
  addMembers: async (id: string, employeeIds: string[]): Promise<CrewDto> =>
    unwrapActionResult(
      await addCrewMembersAction(actionAccessToken(), id, { employeeIds }),
    ),
  removeMember: async (id: string, employeeId: string): Promise<CrewDto> =>
    unwrapActionResult(
      await removeCrewMemberAction(actionAccessToken(), id, employeeId),
    ),
};
