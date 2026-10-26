import { AbstractCrudService } from '../../shared/database/crud-service';
import {
  AlreadyExistsError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/database/errors';
import type { AccessTokenPayload } from '../../shared/auth/jwt';
import { EmployeeRepository, type EmployeeRow } from './employees.repository';
import type { EmployeeCreateInput, EmployeeUpdateInput } from './employees.schema';
import { serializeEmployee, type EmployeeResponse } from './employees.serializer';

/**
 * Employees business logic — directory CRUD scoped to one organisation
 * (the authenticated admin's user id). No HTTP concerns, no query building.
 */
export class EmployeeService extends AbstractCrudService<EmployeeRow> {
  protected get repository(): EmployeeRepository {
    return new EmployeeRepository();
  }

  /** Whole directory of the caller's organisation (optionally hiding their own record). */
  async listForOrganization(organization: string, excludeId?: string): Promise<EmployeeResponse[]> {
    const rows = await this.repository.findForOrganization(organization, excludeId);
    return rows.map(serializeEmployee);
  }

  /** The employee profile linked to a platform account (matched by email). */
  async findMyProfile(email: string): Promise<EmployeeRow | null> {
    return this.repository.findByEmail(email);
  }

  async createEmployee(
    input: EmployeeCreateInput,
    organization: string,
  ): Promise<EmployeeResponse> {
    const email = input.email.toLowerCase();

    if (await this.repository.findByRef(input.employeeRef)) {
      throw new AlreadyExistsError('Employee', 'employeeRef');
    }
    if (await this.repository.findByEmail(email)) {
      throw new AlreadyExistsError('Employee', 'email');
    }

    const employee = await this.repository.create({ ...input, email, organization });
    return serializeEmployee(employee);
  }

  async updateEmployee(
    id: string,
    input: EmployeeUpdateInput,
    organization: string,
  ): Promise<EmployeeResponse> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestError('No fields to update');
    }

    const existing = await this.findOneInOrganization(id, organization);

    const updates: Record<string, unknown> = { ...input };
    if (input.email !== undefined) {
      const email = input.email.toLowerCase();
      const clash = await this.repository.findByEmail(email);
      if (clash && clash.id !== existing.id) {
        throw new AlreadyExistsError('Employee', 'email');
      }
      updates.email = email;
    }

    const employee = await this.repository.update(id, updates);
    return serializeEmployee(employee);
  }

  /** Loads an employee and enforces that it belongs to the caller's organisation. */
  async findOneInOrganization(id: string, organization: string): Promise<EmployeeRow> {
    const employee = await this.repository.findOneById(id);
    if (!employee) throw new NotFoundError('Employee');
    if (employee.organization !== organization) {
      throw new ForbiddenError('Employee is not in your organisation');
    }
    return employee;
  }

  /** Same guarantee, looked up by business reference (EMP001, …). */
  async findByRefInOrganization(employeeRef: string, organization: string): Promise<EmployeeRow> {
    const employee = await this.repository.findByRef(employeeRef);
    if (!employee) throw new NotFoundError('Employee');
    if (employee.organization !== organization) {
      throw new ForbiddenError('Employee is not in your organisation');
    }
    return employee;
  }

  /**
   * Read scope shared by the RH modules: admins get their whole organisation
   * (optionally narrowed to one reference), every other session only ever
   * sees its own profile.
   */
  async resolveReadScope(user: AccessTokenPayload, employeeRef?: string): Promise<string[]> {
    const myProfile = await this.repository.findByEmail(user.email);
    const isAdmin = user.role === 'ADMIN';

    if (employeeRef) {
      if (isAdmin) {
        const employee = await this.findByRefInOrganization(employeeRef, user.sub);
        return [employee.id];
      }
      if (!myProfile) return [];
      if (myProfile.employeeRef !== employeeRef) {
        throw new ForbiddenError('Employee is not in your organisation');
      }
      return [myProfile.id];
    }

    if (isAdmin) {
      const staff = await this.repository.findForOrganization(user.sub);
      return staff.map((employee) => employee.id);
    }

    return myProfile ? [myProfile.id] : [];
  }
}

export const employeesService = new EmployeeService();
