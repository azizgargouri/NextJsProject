import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthLayout } from '@/components/features/auth/auth-layout';
import { SignInForm } from '@/components/features/auth/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function SignInPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<div className="mono p-8 text-xs text-ink-40">LOADING FORM…</div>}>
        <SignInForm />
      </Suspense>
    </AuthLayout>
  );
}
