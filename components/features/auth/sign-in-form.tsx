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
import { useSignIn } from '@/hooks/content/auth/use-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import type { ServerErrorResponse } from '@/types';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

const SignInFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type SignInFormValues = z.infer<typeof SignInFormSchema>;

export function SignInForm() {
  const router = useRouter();
  const { mutate, isPending, error, isError } = useSignIn();
  const rootRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(SignInFormSchema),
    defaultValues: { email: '', password: '' },
  });

  useGSAP(
    () => {
      gsap.from('[data-form-reveal]', {
        y: 30,
        autoAlpha: 0,
        duration: 0.8,
        stagger: 0.07,
        ease: 'power3.out',
      });
    },
    { scope: rootRef },
  );

  const onSubmit = (values: SignInFormValues) => {
    mutate(values, { onSuccess: () => router.push('/dashboard') });
  };

  return (
    <div ref={rootRef} className="flex min-h-dvh flex-col justify-between px-6 py-10 md:px-12">
      {/* Header */}
      <div data-form-reveal className="flex items-center justify-between">
        <Link href="/" className="mono flex items-center gap-2 text-sm font-bold lg:hidden">
          <span className="inline-block size-2.5 bg-hazard" aria-hidden />
          MOVE<span className="text-hazard">UP</span>
        </Link>
        <p className="mono text-[10px] text-ink-40">ENDPOINT / SIGN-IN</p>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto flex w-full max-w-md flex-col"
        noValidate
      >
        <h1 data-form-reveal className="display text-5xl md:text-6xl">
          WELCOME
          <br />
          BACK.
        </h1>
        <p data-form-reveal className="mt-4 text-sm text-ink-80">
          Log in to request a move, follow your job or manage your crew.
        </p>

        <div data-form-reveal className="mt-10 space-y-6">
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
            <Label htmlFor="password">PASSWORD</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </FieldRow>

          {isError && (
            <p className="mono border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard">
              {extractErrorMessage(error)}
            </p>
          )}

          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" size={16} /> : 'LOG IN >>>'}
          </Button>
        </div>
      </form>

      {/* Footer */}
      <div data-form-reveal className="mx-auto mt-12 w-full max-w-md">
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-ink/20" />
          <span className="mono text-[10px] text-ink-40">NEW TO MOVEUP</span>
          <span className="h-px flex-1 bg-ink/20" />
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/sign-up"
            className="mono border-b-2 border-ink pb-0.5 text-[11px] hover:border-hazard hover:text-hazard"
          >
            CREATE AN ACCOUNT &gt;&gt;&gt;
          </Link>
        </div>
        <p className="mono mt-10 text-center text-[9px] text-ink-40">
          PASSWORDS ARE HASHED. SESSIONS ARE LOGGED.
        </p>
      </div>
    </div>
  );
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Object && 'response' in error) {
    const axiosError = error as AxiosError<ServerErrorResponse>;
    return axiosError.response?.data?.message ?? 'Sign-in failed. Try again.';
  }
  return 'Sign-in failed. Try again.';
}
