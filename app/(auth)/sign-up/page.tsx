import type { Metadata } from 'next';
import { AuthLayout } from '@/components/features/auth/auth-layout';
import { SignUpForm } from '@/components/features/auth/sign-up-form';

export const metadata: Metadata = {
  title: 'Create account',
};

/** `?role=MOVER` preselects the crew account type (linked from the landing). */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;
  return (
    <AuthLayout>
      <SignUpForm initialRole={role?.toUpperCase() === 'MOVER' ? 'MOVER' : 'CLIENT'} />
    </AuthLayout>
  );
}
