'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/field';
import { StatusLabel } from '@/components/ui/status-chip';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import { useEmployees, useUpdateEmployee } from '@/hooks/content/hr';
import { extractErrorMessage } from '@/lib/api/errors';
import type { EmployeeDto, EmployeeRole } from '@/types';

const ROLES: EmployeeRole[] = ['employee', 'manager', 'hr'];

type Draft = { fullName: string; email: string; role: EmployeeRole };

/** HR directory — table with inline edits and activate/deactivate toggles. */
export function EmployeesView() {
  const employeesQuery = useEmployees();
  const updateEmployee = useUpdateEmployee();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ fullName: '', email: '', role: 'employee' });
  const [rowError, setRowError] = useState<string | null>(null);

  const employees = employeesQuery.data ?? [];
  const busyId = updateEmployee.isPending ? updateEmployee.variables.id : null;

  function startEdit(employee: EmployeeDto) {
    setRowError(null);
    setEditingId(employee.id);
    setDraft({ fullName: employee.fullName, email: employee.email, role: employee.role });
  }

  function cancelEdit() {
    setEditingId(null);
    setRowError(null);
  }

  function saveEdit(employee: EmployeeDto) {
    setRowError(null);
    updateEmployee.mutate(
      { id: employee.id, payload: draft },
      {
        onSuccess: () => setEditingId(null),
        onError: (error) => setRowError(extractErrorMessage(error, 'Update failed')),
      },
    );
  }

  function toggleStatus(employee: EmployeeDto) {
    setRowError(null);
    updateEmployee.mutate(
      {
        id: employee.id,
        payload: { status: employee.status === 'active' ? 'inactive' : 'active' },
      },
      { onError: (error) => setRowError(extractErrorMessage(error, 'Update failed')) },
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">DIRECTORY.</h1>
          <p className="mono mt-3 text-[10px] text-ink-40">STAFF RECORDS · ORGANISATION SCOPE</p>
        </div>
        <Link
          href="/employees/new"
          className={cn(buttonVariants({ variant: 'hazard', size: 'default' }))}
        >
          + Add employee
        </Link>
      </header>

      {rowError && (
        <p className="mono mt-6 border border-hazard bg-hazard/5 px-4 py-3 text-[10px] text-hazard">
          {rowError.toUpperCase()}
        </p>
      )}

      {employeesQuery.isLoading && (
        <div className="mt-8">
          <LoadingBlock label="Loading employees" />
        </div>
      )}

      {employeesQuery.isError && (
        <div className="mono mt-8 border border-hazard px-4 py-4 text-[10px] text-hazard">
          {extractErrorMessage(employeesQuery.error, 'FAILED TO LOAD EMPLOYEES').toUpperCase()}
          <button
            type="button"
            onClick={() => void employeesQuery.refetch()}
            className="ml-3 underline underline-offset-2"
          >
            RETRY
          </button>
        </div>
      )}

      {!employeesQuery.isLoading && !employeesQuery.isError && employees.length === 0 && (
        <div className="mt-8 border border-ink bg-paper p-10 text-center">
          <p className="display text-2xl">NO EMPLOYEES YET</p>
          <p className="mono mt-3 text-[10px] text-ink-40">
            ADD YOUR FIRST EMPLOYEE TO START BUILDING THE DIRECTORY.
          </p>
          <Link
            href="/employees/new"
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'mt-6 inline-flex')}
          >
            Add employee
          </Link>
        </div>
      )}

      {!employeesQuery.isLoading && !employeesQuery.isError && employees.length > 0 && (
        <div className="mt-8 overflow-x-auto border border-ink bg-paper">
          <table className="w-full text-left">
            <thead className="border-b border-ink">
              <tr className="mono text-[9px] text-ink-40">
                <th className="px-4 py-3 font-normal">REF</th>
                <th className="px-4 py-3 font-normal">NAME</th>
                <th className="px-4 py-3 font-normal">EMAIL</th>
                <th className="px-4 py-3 font-normal">ROLE</th>
                <th className="px-4 py-3 font-normal">STATUS</th>
                <th className="px-4 py-3 text-right font-normal">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const isEditing = editingId === employee.id;
                const busy = busyId === employee.id;

                return (
                  <Fragment key={employee.id}>
                    <tr className="border-b border-ink/15 last:border-0">
                      <td className="mono px-4 py-3 text-[11px]">{employee.employeeRef}</td>
                      <td className="px-4 py-3 text-sm">{employee.fullName}</td>
                      <td className="px-4 py-3 text-sm text-ink-80">{employee.email}</td>
                      <td className="mono px-4 py-3 text-[10px] uppercase">{employee.role}</td>
                      <td className="px-4 py-3">
                        <StatusLabel kind="employee" value={employee.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-[9px]"
                            disabled={busy}
                            onClick={() => (isEditing ? cancelEdit() : startEdit(employee))}
                          >
                            {isEditing ? 'Close' : 'Edit'}
                          </Button>
                          <Button
                            variant={employee.status === 'active' ? 'ghost' : 'primary'}
                            size="sm"
                            className="h-7 px-3 text-[9px]"
                            disabled={busy}
                            onClick={() => toggleStatus(employee)}
                          >
                            {busy
                              ? 'Saving…'
                              : employee.status === 'active'
                                ? 'Deactivate'
                                : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {isEditing && (
                      <tr className="border-b border-ink/15 bg-paper-soft">
                        <td colSpan={6} className="px-4 py-4">
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              saveEdit(employee);
                            }}
                            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                          >
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`fullName-${employee.id}`}>FULL NAME</Label>
                              <Input
                                id={`fullName-${employee.id}`}
                                className="h-9"
                                value={draft.fullName}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    fullName: event.target.value,
                                  }))
                                }
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`email-${employee.id}`}>EMAIL</Label>
                              <Input
                                id={`email-${employee.id}`}
                                type="email"
                                className="h-9"
                                value={draft.email}
                                onChange={(event) =>
                                  setDraft((current) => ({ ...current, email: event.target.value }))
                                }
                                required
                              />
                            </div>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor={`role-${employee.id}`}>ROLE</Label>
                              <Select
                                id={`role-${employee.id}`}
                                className="h-9"
                                value={draft.role}
                                onChange={(event) =>
                                  setDraft((current) => ({
                                    ...current,
                                    role: event.target.value as EmployeeRole,
                                  }))
                                }
                              >
                                {ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="flex items-end gap-2">
                              <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                className="h-9 px-4 text-[10px]"
                                disabled={updateEmployee.isPending}
                              >
                                {updateEmployee.isPending ? 'Saving…' : 'Save changes'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 px-4 text-[10px]"
                                onClick={cancelEdit}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
