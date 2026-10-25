'use client';

import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AxiosError } from 'axios';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Loader2 } from 'lucide-react';
import { useSignUp } from '@/hooks/content/auth/use-sign-up';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import type { ServerErrorResponse } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

const SignUpFormSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{8,15}$/, 'Invalid phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a digit'),
  role: z.enum(['CLIENT', 'MOVER']),
});

type SignUpFormValues = z.infer<typeof SignUpFormSchema>;

const ROLE_OPTIONS = [
  { value: 'CLIENT' as const, label: 'I AM MOVING', hint: 'Client account' },
  { value: 'MOVER' as const, label: 'I AM A MOVER', hint: 'Requires verification' },
];

export function SignUpForm() {
  const router = useRouter();
  const { mutate, isPending, isError, error } = useSignUp();
  const rootRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(SignUpFormSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', role: 'CLIENT' },
  });

  const role = watch('role');

  useGSAP(
    () => {
      gsap.from('[data-form-reveal]', {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.06,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  const onSubmit = (values: SignUpFormValues) => {
    mutate({ ...values, locale: 'en' }, { onSuccess: () => router.push('/dashboard') });
  };

  return (
    <div
      ref={rootRef}
      className="flex min-h-dvh flex-col justify-between bg-paper px-6 py-10 md:px-12"
    >
      {/* Header */}
      <div data-form-reveal className="flex items-center justify-between">
        <Link href="/" className="mono flex items-center gap-2 text-sm font-bold lg:hidden">
          <span className="inline-block size-2.5 bg-hazard" aria-hidden />
          MOVE<span className="text-hazard">UP</span>
        </Link>
        <p className="mono text-[10px] text-ink-40">ENDPOINT / SIGN-UP</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex w-full max-w-md flex-col"
        noValidate
      >
        <h1 data-form-reveal className="display text-5xl md:text-6xl">
          CREATE
          <br />
          SESSION.
        </h1>
        <p data-form-reveal className="mt-4 text-sm text-ink-80">
          Movers apply here and are verified by the society within 48 hours.
        </p>

        {/* Role selector — segmented control */}
        <div data-form-reveal className="mt-8 grid grid-cols-2 gap-px border border-ink bg-ink">
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setValue('role', option.value)}
              className={`mono px-3 py-3 text-[10px] transition-colors ${
                role === option.value ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink/5'
              }`}
              aria-pressed={role === option.value}
            >
              {option.label}
              <span
                className={`mt-1 block text-[9px] ${role === option.value ? 'text-paper/60' : 'text-ink-40'}`}
              >
                {option.hint}
              </span>
            </button>
          ))}
        </div>

        <div data-form-reveal className="mt-6 space-y-5">
          <FieldRow>
            <Label htmlFor="name">FULL NAME</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="Amira Ben Salah"
              {...register('name')}
            />
            <FieldError message={errors.name?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="email">EMAIL</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="name@domain.tn"
              {...register('email')}
            />
            <FieldError message={errors.email?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="phone">PHONE (+216…)</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+216 55 123 456"
              {...register('phone')}
            />
            <FieldError message={errors.phone?.message} />
          </FieldRow>

          <FieldRow>
            <Label htmlFor="password">PASSWORD</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="8+ CHARS — 1 UPPERCASE — 1 DIGIT"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </FieldRow>

          {isError && (
            <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard">
              {extractErrorMessage(error)}
            </p>
          )}

          <Button type="submit" variant="hazard" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" size={16} /> : 'OPEN MY ACCOUNT >>>'}
          </Button>
        </div>
      </form>

      {/* Footer */}
      <div data-form-reveal className="mx-auto mt-10 w-full max-w-md">
        <p className="mono text-center text-[10px] text-ink-40">ALREADY REGISTERED?</p>
        <p className="mt-3 text-center">
          <Link
            href="/sign-in"
            className="mono border-b-2 border-ink pb-0.5 text-[11px] hover:border-hazard hover:text-hazard"
          >
            GO TO LOGIN &gt;&gt;&gt;
          </Link>
        </p>
        <p className="mono mt-8 text-[9px] text-ink-40">
          BY CONTINUING YOU ACCEPT THE TERMS OF SERVICE — TN ORGANIC LAW 2004-63.
        </p>
      </div>
    </div>
  );
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Object && 'response' in error) {
    const axiosError = error as AxiosError<ServerErrorResponse>;
    return axiosError.response?.data?.message ?? 'Sign-up failed. Try again.';
  }
  return 'Sign-up failed. Try again.';
}
