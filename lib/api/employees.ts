import { axiosClient } from './client';
import type { EmployeeDto, EmployeeRole, EmployeeStatus } from '@/types';

export interface CreateEmployeePayload {
  employeeRef: string;
  fullName: string;
  email: string;
  role?: EmployeeRole;
  status?: EmployeeStatus;
}

export type UpdateEmployeePayload = Partial<Omit<CreateEmployeePayload, 'employeeRef'>>;

/** Employees endpoints — the RH directory (admins only, JWT-scoped server-side). */
export const employeesApi = {
  list: async (): Promise<EmployeeDto[]> => {
    const { data } = await axiosClient.get<{ employees: EmployeeDto[] }>('/api/employees');
    return data.employees;
  },
  me: async (): Promise<EmployeeDto | null> => {
    const { data } = await axiosClient.get<{ employee: EmployeeDto | null }>('/api/employees/me');
    return data.employee;
  },
  create: async (payload: CreateEmployeePayload): Promise<EmployeeDto> => {
    const { data } = await axiosClient.post<{ employee: EmployeeDto }>('/api/employees', payload);
    return data.employee;
  },
  update: async (id: string, payload: UpdateEmployeePayload): Promise<EmployeeDto> => {
    const { data } = await axiosClient.patch<{ employee: EmployeeDto }>(
      `/api/employees/${id}`,
      payload,
    );
    return data.employee;
  },
};
