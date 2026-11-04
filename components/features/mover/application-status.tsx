'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import type { MoverApplicationDto, VerificationStatus } from '@/types';
import { formatDateTime, PageTitle, Panel, Tag } from './mover-ui';

const COPY: Record<VerificationStatus, { tag: string; title: string; body: string }> = {
  PENDING: {
    tag: 'Pending',
    title: 'Your application is under review',
    body: 'The MoveUp team checks every mover before they can receive jobs. Your workspace opens as soon as you are approved.',
  },
  APPROVED: {
    tag: 'Approved',
    title: 'You are approved',
    body: 'Your workspace is open. Set your availability and zones to start receiving offers.',
  },
  REJECTED: {
    tag: 'Rejected',
    title: 'Your application was not approved',
    body: 'Your workspace stays locked. Contact the MoveUp team if you think this is a mistake.',
  },
  SUSPENDED: {
    tag: 'Suspended',
    title: 'Your account is suspended',
    body: 'Your workspace is locked and you will not receive offers. Contact the MoveUp team to resolve this.',
  },
};

/** Item 2: what a mover sees until an admin approves them (M-02). */
export function ApplicationStatus({ application }: { application: MoverApplicationDto }) {
  const copy = COPY[application.status];
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle title="Application" />
      <Panel>
        <Tag tone={application.status === 'APPROVED' ? 'solid' : 'alert'}>{copy.tag}</Tag>
        <h2 className="mt-4 text-2xl font-bold">{copy.title}</h2>
        <p className="mt-2 text-sm text-ink-80">{copy.body}</p>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-ink pt-4 text-sm">
          <dt className="text-ink-80">Company</dt>
          <dd className="font-bold">{application.companyName}</dd>
          <dt className="text-ink-80">Applied</dt>
          <dd>{formatDateTime(application.submittedAt)}</dd>
          <dt className="text-ink-80">Last update</dt>
          <dd>{formatDateTime(application.updatedAt)}</dd>
        </dl>
        {application.canAccessDashboard ? (
          <Link href="/mover" className={buttonVariants({ className: 'mt-6 w-full' })}>
            Open my workspace
          </Link>
        ) : null}
      </Panel>
    </div>
  );
}
