'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useCreateHome } from '@/hooks/content/homes';
import { HomeForm } from './home-form';
import { HomesPageHeader } from './homes-page-header';

/** /dashboard/homes/new — create the house, then continue with its rooms. */
export function HomeCreatePortal() {
  const router = useRouter();
  const createHome = useCreateHome();

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <HomesPageHeader
        trail={[
          { label: 'Workspace', href: '/dashboard' },
          { label: 'New houses', href: '/dashboard/homes' },
          { label: 'Add' },
        ]}
        title="Add a house."
        description="Start with the general details. You will add the rooms on the next screen."
      />
      <div className="mt-10">
        <HomeForm
          submitLabel="Save and add rooms >>>"
          pending={createHome.isPending}
          error={createHome.error}
          onCancel={() => router.push('/dashboard/homes')}
          onSubmit={(values) =>
            createHome.mutate(values, {
              onSuccess: (home) => {
                toast.success(`“${home.label}” saved`);
                router.push(`/dashboard/homes/${home.id}`);
              },
            })
          }
        />
      </div>
    </main>
  );
}
