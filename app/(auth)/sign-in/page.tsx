import type { Metadata } from 'next';
import { AuthLayout } from '@/components/features/auth/auth-layout';
import { SignInForm } from '@/components/features/auth/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function SignInPage() {
  return (
    <AuthLayout>
      <SignInForm />
    </AuthLayout>
  );
}
