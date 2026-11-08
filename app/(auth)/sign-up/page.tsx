import type { Metadata } from 'next';
import { AuthLayout } from '@/components/features/auth/auth-layout';
import { SignUpForm } from '@/components/features/auth/sign-up-form';

export const metadata: Metadata = {
  title: 'Sign up',
};

export default function SignUpPage() {
  return (
    <AuthLayout>
      <SignUpForm />
    </AuthLayout>
  );
}