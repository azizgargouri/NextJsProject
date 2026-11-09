'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import {
  useEmployees,
  usePrepareContract,
  useProposeContract,
  useUploadContractDocument,
} from '@/hooks/content/hr';
import { isContractConfigured } from '@/lib/blockchain/config';
import { extractErrorMessage } from '@/lib/api/errors';

const FormSchema = z
  .object({
    employeeId: z.string().min(1, 'Select an employee'),
    jobTitle: z.string().trim().min(2, 'Job title is required'),
    salaryAmount: z
      .string()
      .optional()
      .refine(
        (value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= 0),
        'Salary must be a positive number',
      ),
    salaryCurrency: z.string().trim().min(2, 'Currency is required').max(10),
    salaryPeriod: z.enum(['month', 'year', 'hour']),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
  })
  .refine((values) => !values.endDate || values.endDate > values.startDate, {
    path: ['endDate'],
    message: 'End date must be after the start date',
  });

type FormValues = z.infer<typeof FormSchema>;

type Step = 'idle' | 'uploading' | 'preparing' | 'proposing';

const STEP_LABEL: Record<Step, string> = {
  idle: '',
  uploading: 'Uploading + hashing the contract PDF…',
  preparing: 'Building + hashing the canonical document…',
  proposing: 'Signing with the HR app wallet + storing the proposal…',
};

const MAX_PDF_BYTES = 8 * 1024 * 1024;

/**
 * Admin flow: select employee → canonical document → server signs with the
 * HR app wallet → proposal waiting for the employee's app wallet.
 */
export function CreateContractForm() {
  const employeesQuery = useEmployees();
  const upload = useUploadContractDocument();
  const prepare = usePrepareContract();
  const propose = useProposeContract();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ proposalId: string } | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      employeeId: '',
      jobTitle: '',
      salaryAmount: '',
      salaryCurrency: 'TND',
      salaryPeriod: 'month',
      startDate: '',
      endDate: '',
    },
  });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const selectedId = watch('employeeId');
  const selectedEmployee = useMemo(
    () => employees.find((item) => item.id === selectedId) ?? null,
    [employees, selectedId],
  );

  const busy = step !== 'idle' || upload.isPending || prepare.isPending || propose.isPending;

  const onPdfChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPdfError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPdfFile(null);
      return;
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setPdfFile(null);
      setPdfError('Choose a PDF file.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setPdfFile(null);
      setPdfError('The PDF must be 8 MB or smaller.');
      event.target.value = '';
      return;
    }

    setPdfFile(file);
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSuccess(null);

    if (!isContractConfigured) {
      setServerError('Contract address missing. Set NEXT_PUBLIC_CONTRACT_ADDRESS and restart.');
      return;
    }
    if (!pdfFile) {
      setPdfError('Upload the contract as a PDF before issuing it.');
      return;
    }

    try {
      setStep('uploading');
      const uploaded = await upload.mutateAsync(pdfFile);

      setStep('preparing');
      const prepared = await prepare.mutateAsync({
        employeeId: values.employeeId,
        jobTitle: values.jobTitle,
        salaryAmount: values.salaryAmount ? Number(values.salaryAmount) : undefined,
        salaryCurrency: values.salaryCurrency.toUpperCase(),
        salaryPeriod: values.salaryPeriod,
        startDate: values.startDate,
        endDate: values.endDate || null,
        documentId: uploaded.id,
      });

      setStep('proposing');
      const proposal = await propose.mutateAsync({ token: prepared.token });

      setSuccess({ proposalId: proposal.id });
      setPdfFile(null);
      setPdfError(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      reset({
        employeeId: '',
        jobTitle: '',
        salaryAmount: '',
        salaryCurrency: 'TND',
        salaryPeriod: 'month',
        startDate: '',
        endDate: '',
      });
    } catch (error) {
      setServerError(
        extractErrorMessage(error, 'The contract could not be prepared. Check the server logs.'),
      );
    } finally {
      setStep('idle');
    }
  };

  if (employeesQuery.isLoading) {
    return (
      <section className="mt-8 border border-ink bg-paper px-4 py-6">
        <p className="mono text-[10px] text-ink-40">LOADING EMPLOYEES…</p>
      </section>
    );
  }

  if (employeesQuery.isError) {
    return (
      <section className="mt-8 border border-hazard bg-hazard/5 px-4 py-6">
        <p className="mono text-[10px] text-hazard">
          FAILED TO LOAD THE EMPLOYEE DIRECTORY. REFRESH AND RETRY.
        </p>
      </section>
    );
  }

  if (employees.length === 0) {
    return (
      <section className="mt-8 border border-ink bg-paper px-4 py-6">
        <p className="display text-2xl">NO EMPLOYEES YET.</p>
        <p className="mt-2 text-sm text-ink-80">
          Add an employee to the directory — their app wallet is created automatically — then issue
          a contract.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-ink bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-4 py-3">
        <h2 className="mono text-[10px]">ISSUE A NEW EMPLOYMENT CONTRACT</h2>
        <span className="mono text-[9px] text-ink-40">APP WALLETS SIGN · SERVER PAYS GAS</span>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 px-4 py-4 md:grid-cols-2" noValidate>
        <FieldRow className="md:col-span-2">
          <Label htmlFor="contract-employee">EMPLOYEE</Label>
          <Select id="contract-employee" {...register('employeeId')} disabled={busy}>
            <option value="">Select an employee…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeRef} — {employee.fullName}
              </option>
            ))}
          </Select>
          <FieldError message={errors.employeeId?.message} />
          <p className="mono mt-1 text-[9px] normal-case tracking-normal text-ink-40">
            {selectedEmployee
              ? `APP WALLET ${selectedEmployee.walletAddress ?? 'will be created on first use'}`
              : 'Every employee has an app-managed wallet created automatically.'}
          </p>
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-title">JOB TITLE</Label>
          <Input
            id="contract-title"
            placeholder="Senior mover"
            {...register('jobTitle')}
            disabled={busy}
          />
          <FieldError message={errors.jobTitle?.message} />
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-salary">GROSS SALARY (OPTIONAL)</Label>
          <Input
            id="contract-salary"
            inputMode="decimal"
            placeholder="1200"
            {...register('salaryAmount')}
            disabled={busy}
          />
          <FieldError message={errors.salaryAmount?.message} />
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-currency">CURRENCY</Label>
          <Select id="contract-currency" {...register('salaryCurrency')} disabled={busy}>
            <option value="TND">TND</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </Select>
          <FieldError message={errors.salaryCurrency?.message} />
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-period">PAY PERIOD</Label>
          <Select id="contract-period" {...register('salaryPeriod')} disabled={busy}>
            <option value="month">per month</option>
            <option value="year">per year</option>
            <option value="hour">per hour</option>
          </Select>
          <FieldError message={errors.salaryPeriod?.message} />
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-start">START DATE</Label>
          <Input id="contract-start" type="date" {...register('startDate')} disabled={busy} />
          <FieldError message={errors.startDate?.message} />
        </FieldRow>

        <FieldRow>
          <Label htmlFor="contract-end">END DATE (EMPTY = OPEN-ENDED)</Label>
          <Input id="contract-end" type="date" {...register('endDate')} disabled={busy} />
          <FieldError message={errors.endDate?.message} />
        </FieldRow>

        <FieldRow className="md:col-span-2">
          <Label htmlFor="contract-pdf">CONTRACT DOCUMENT (PDF)</Label>
          <Input
            id="contract-pdf"
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPdfChange}
            disabled={busy}
            className="h-auto cursor-pointer py-2 text-[11px] file:mr-3 file:cursor-pointer file:border-0 file:bg-ink file:px-3 file:py-1 file:text-[9px] file:uppercase file:text-paper hover:file:bg-hazard"
          />
          <FieldError message={pdfError ?? undefined} />
          <p className="mono mt-1 text-[9px] normal-case tracking-normal text-ink-40">
            {pdfFile
              ? `${pdfFile.name} · ${(pdfFile.size / 1024).toFixed(0)} KB · will be hashed into the on-chain document.`
              : 'PDF only, max 8 MB. The PDF is stored off-chain and its keccak256 hash is committed on-chain.'}
          </p>
        </FieldRow>

        {step !== 'idle' && (
          <p className="mono md:col-span-2 flex items-center gap-2 text-[10px] text-ink-80">
            <Loader2 size={13} className="animate-spin" /> {STEP_LABEL[step]}
          </p>
        )}

        {serverError && (
          <p className="mono md:col-span-2 border border-hazard bg-hazard/5 px-3 py-2 text-[10px] normal-case tracking-normal text-hazard">
            {serverError}
          </p>
        )}

        {success && (
          <p className="mono md:col-span-2 border border-ink bg-paper-soft px-3 py-2 text-[10px] normal-case tracking-normal">
            HR SIGNATURE STORED · PROPOSAL {success.proposalId.slice(0, 10)}… IS NOW WAITING FOR
            THE EMPLOYEE TO SIGN. YOU THEN ANCHOR IT ON-CHAIN.
          </p>
        )}

        <div className="md:col-span-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy || !isContractConfigured}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : 'SIGN AS HR & SEND TO EMPLOYEE >>>'}
          </Button>
        </div>
      </form>
    </section>
  );
}
