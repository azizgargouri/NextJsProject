'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import { useCreateEmployee } from '@/hooks/content/hr';
import { extractErrorMessage } from '@/lib/api/errors';

const AddEmployeeSchema = z.object({
  employeeRef: z.string().trim().min(1, 'Employee ref is required'),
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['employee', 'manager', 'hr']),
});

type AddEmployeeValues = z.infer<typeof AddEmployeeSchema>;

/** Add-employee form (client) — posts to the guarded directory endpoint. */
export function AddEmployeeForm() {
  const router = useRouter();
  const createEmployee = useCreateEmployee();
  const [serverError, setServerError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddEmployeeValues>({
    resolver: zodResolver(AddEmployeeSchema),
    defaultValues: { employeeRef: 'EMP', fullName: '', email: '', role: 'employee' },
  });

  const onSubmit = (values: AddEmployeeValues) => {
    setServerError(null);
    createEmployee.mutate(values, {
      onSuccess: () => router.push('/employees'),
      onError: (error) => setServerError(extractErrorMessage(error, 'Failed to add employee')),
    });
  };

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-xl">
      <div className="flex items-center justify-between">
        <Link
          href="/employees"
          className="mono border-b-2 border-ink pb-0.5 text-[10px] hover:border-hazard hover:text-hazard"
        >
          ← BACK TO DIRECTORY
        </Link>
        <p className="mono text-[10px] text-ink-40">ENDPOINT / EMPLOYEES · POST</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col" noValidate>
        <h1 className="display text-4xl md:text-5xl">NEW STAFF.</h1>
        <p className="mt-3 text-sm text-ink-80">
          The record joins your organisation directory — attendance and leave open up immediately.
        </p>

        <div className="mt-8 space-y-6">
          <FieldRow>
            <Label htmlFor="employeeRef">EMPLOYEE REF</Label>
            <Input
              id="employeeRef"
              placeholder="EMP006"
              autoComplete="off"
              {...register('employeeRef')}
            />
            <FieldError message={errors.employeeRef?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="fullName">FULL NAME</Label>
            <Input
              id="fullName"
              placeholder="Alice Johnson"
              autoComplete="name"
              {...register('fullName')}
            />
            <FieldError message={errors.fullName?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="email">WORK EMAIL</Label>
            <Input
              id="email"
              type="email"
              placeholder="alice@company.tn"
              autoComplete="email"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="role">ROLE</Label>
            <Select id="role" {...register('role')}>
              <option value="employee">employee</option>
              <option value="manager">manager</option>
              <option value="hr">hr</option>
            </Select>
            <FieldError message={errors.role?.message} />
          </FieldRow>

          {serverError && (
            <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] normal-case tracking-normal text-hazard">
              {serverError}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={createEmployee.isPending}
          >
            {createEmployee.isPending ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              'ADD EMPLOYEE >>>'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
