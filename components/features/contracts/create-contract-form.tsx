'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import { useEmployees, usePrepareContract, useProposeContract } from '@/hooks/content/hr';
import { useWallet } from '@/components/features/web3/wallet-provider';
import { isContractConfigured, web3Config } from '@/lib/blockchain/config';
import { signContractIntent } from '@/lib/blockchain/registry';
import { describeWalletError } from '@/lib/blockchain/errors';

const FormSchema = z
  .object({
    employeeId: z.string().min(1, 'Select an employee'),
    employeeWallet: z
      .string()
      .trim()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter the employee MetaMask address (0x + 40 hex chars)'),
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
    documentUri: z.string().trim().max(500).optional(),
  })
  .refine((values) => !values.endDate || values.endDate > values.startDate, {
    path: ['endDate'],
    message: 'End date must be after the start date',
  });

type FormValues = z.infer<typeof FormSchema>;

type Step = 'idle' | 'preparing' | 'signing' | 'proposing';

const STEP_LABEL: Record<Step, string> = {
  idle: '',
  preparing: 'Building + hashing the contract document…',
  signing: 'Sign the contract intent in MetaMask…',
  proposing: 'Storing the HR co-signature for the employee…',
};

/** Admin flow: select employee → canonical document → HR co-signature → proposal. */
export function CreateContractForm() {
  const employeesQuery = useEmployees();
  const prepare = usePrepareContract();
  const propose = useProposeContract();
  const {
    address,
    isConnected,
    isCorrectNetwork,
    chainId,
    connect,
    switchNetwork,
  } = useWallet();

  const [step, setStep] = useState<Step>('idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ proposalId: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      employeeId: '',
      employeeWallet: '',
      jobTitle: '',
      salaryAmount: '',
      salaryCurrency: 'TND',
      salaryPeriod: 'month',
      startDate: '',
      endDate: '',
      documentUri: '',
    },
  });

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const selectedId = watch('employeeId');

  useEffect(() => {
    if (!selectedId) return;
    const employee = employees.find((item) => item.id === selectedId);
    if (employee) {
      setValue('employeeWallet', employee.walletAddress ?? '', { shouldValidate: true });
    }
  }, [selectedId, employees, setValue]);

  const busy = step !== 'idle' || prepare.isPending || propose.isPending;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    setSuccess(null);

    if (!isContractConfigured) {
      setServerError('Contract address missing. Set NEXT_PUBLIC_CONTRACT_ADDRESS and restart.');
      return;
    }
    if (!isConnected || !address) {
      setServerError('Connect MetaMask before creating a contract.');
      return;
    }
    if (!isCorrectNetwork) {
      setServerError(`Switch MetaMask to ${web3Config.chainName} (chain ${web3Config.chainId}) first.`);
      return;
    }
    if (chainId !== web3Config.chainId) {
      setServerError('Wallet is on the wrong network.');
      return;
    }

    try {
      setStep('preparing');
      const prepared = await prepare.mutateAsync({
        employeeId: values.employeeId,
        employeeWallet: values.employeeWallet.toLowerCase(),
        employerWallet: address.toLowerCase(),
        jobTitle: values.jobTitle,
        salaryAmount: values.salaryAmount ? Number(values.salaryAmount) : undefined,
        salaryCurrency: values.salaryCurrency.toUpperCase(),
        salaryPeriod: values.salaryPeriod,
        startDate: values.startDate,
        endDate: values.endDate || null,
        documentUri: values.documentUri || undefined,
      });

      if (prepared.employerWallet.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Switch MetaMask to the HR wallet that will co-sign this contract.');
      }

      setStep('signing');
      const { signature } = await signContractIntent(prepared.typedData);

      setStep('proposing');
      const proposal = await propose.mutateAsync({
        token: prepared.token,
        signature,
      });

      setSuccess({ proposalId: proposal.id });
      reset({
        employeeId: '',
        employeeWallet: '',
        jobTitle: '',
        salaryAmount: '',
        salaryCurrency: 'TND',
        salaryPeriod: 'month',
        startDate: '',
        endDate: '',
        documentUri: '',
      });
    } catch (error) {
      setServerError(describeWalletError(error));
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
          Add an employee to the directory, assign their MetaMask wallet, then issue a contract.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-ink bg-paper">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-4 py-3">
        <h2 className="mono text-[10px]">ISSUE A NEW EMPLOYMENT CONTRACT</h2>
        <span className="mono text-[9px] text-ink-40">EMPLOYEE SIGNS FREE · HR ANCHORS ON-CHAIN</span>
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
        </FieldRow>

        <FieldRow className="md:col-span-2">
          <Label htmlFor="contract-wallet">EMPLOYEE METAMASK WALLET</Label>
          <Input
            id="contract-wallet"
            placeholder="0x…"
            autoComplete="off"
            {...register('employeeWallet')}
            disabled={busy}
          />
          <FieldError message={errors.employeeWallet?.message} />
          <p className="mono mt-1 text-[9px] normal-case tracking-normal text-ink-40">
            Prefilled from the employee directory. This wallet must co-sign the same document.
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
          <Label htmlFor="contract-uri">DOCUMENT URI (OPTIONAL)</Label>
          <Input
            id="contract-uri"
            placeholder="ipfs://… or https://… — leave empty for a deterministic URN"
            {...register('documentUri')}
            disabled={busy}
          />
          <FieldError message={errors.documentUri?.message} />
          <p className="mono mt-1 text-[9px] normal-case tracking-normal text-ink-40">
            The full canonical JSON is stored on-chain when the employee co-signs. It is PUBLIC on
            a public network.
          </p>
        </FieldRow>

        {!isConnected && (
          <div className="md:col-span-2 flex flex-wrap items-center gap-3 border border-hazard bg-hazard/5 px-3 py-3">
            <ShieldAlert size={15} className="text-hazard" />
            <p className="mono text-[9px] normal-case tracking-normal text-hazard">
              Connect MetaMask as the employer/HR wallet before issuing a contract.
            </p>
            <Button type="button" variant="hazard" size="sm" onClick={() => void connect()}>
              Connect
            </Button>
          </div>
        )}

        {isConnected && !isCorrectNetwork && (
          <div className="md:col-span-2 flex flex-wrap items-center gap-3 border border-hazard bg-hazard/5 px-3 py-3">
            <p className="mono text-[9px] normal-case tracking-normal text-hazard">
              Wallet network does not match {web3Config.chainName}.
            </p>
            <Button type="button" variant="hazard" size="sm" onClick={() => void switchNetwork()}>
              Switch network
            </Button>
          </div>
        )}

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
            THE EMPLOYEE TO SIGN (FREE). YOU THEN ANCHOR IT ON-CHAIN AND PAY THE GAS.
          </p>
        )}

        <div className="md:col-span-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={busy || !address || !isCorrectNetwork || !isContractConfigured}
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : 'CO-SIGN AS HR & SEND TO EMPLOYEE >>>'}
          </Button>
        </div>
      </form>
    </section>
  );
}
