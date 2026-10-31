import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/features/auth/auth-layout';
import { SignUpForm } from '@/components/features/auth/sign-up-form';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function SignUpPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="mono p-8 text-xs text-ink-40">LOADING FORM…</div>}>
        <SignUpForm />
      </Suspense>
    </AuthLayout>
  );
}
