import { HomesOffline } from '@/components/features/homes/homes-offline';

export default function HomesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomesOffline />
      {children}
    </>
  );
}
