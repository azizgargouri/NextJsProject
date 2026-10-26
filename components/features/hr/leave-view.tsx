'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusLabel } from '@/components/ui/status-chip';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import { useDecideLeaveRequest, useLeaveRequests } from '@/hooks/content/hr';
import { extractErrorMessage } from '@/lib/api/errors';
import type { LeaveType } from '@/types';

const TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual',
  sick: 'Sick',
  personal: 'Personal',
  unpaid: 'Unpaid',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Leave review queue — HR approves or rejects pending requests. */
export function LeaveView() {
  const leaveQuery = useLeaveRequests({});
  const decide = useDecideLeaveRequest();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const requests = leaveQuery.data ?? [];
  const pending = requests.filter((request) => request.status === 'pending').length;

  function decideRequest(id: string, status: 'approved' | 'rejected') {
    setActionError(null);
    setBusyId(id);
    decide.mutate(
      { id, status },
      {
        onError: (error) =>
          setActionError(extractErrorMessage(error, 'Failed to update the request')),
        onSettled: () => setBusyId(null),
      },
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">LEAVE.</h1>
          <p className="mono mt-3 text-[10px] text-ink-40">REQUESTS · DECISIONS · BALANCES</p>
        </div>
        {!leaveQuery.isLoading && !leaveQuery.isError && requests.length > 0 && (
          <p className="mono text-[10px] text-ink-40">
            {requests.length} REQUEST{requests.length === 1 ? '' : 'S'}
            {pending > 0 ? ` · ${pending} PENDING` : ''}
          </p>
        )}
      </header>

      {actionError && (
        <p className="mono mt-6 border border-hazard bg-hazard/5 px-4 py-3 text-[10px] text-hazard">
          {actionError.toUpperCase()}
        </p>
      )}

      {leaveQuery.isLoading && (
        <div className="mt-8">
          <LoadingBlock label="Loading leave requests" />
        </div>
      )}

      {leaveQuery.isError && (
        <div className="mono mt-8 border border-hazard px-4 py-4 text-[10px] text-hazard">
          {extractErrorMessage(leaveQuery.error, 'FAILED TO LOAD LEAVE REQUESTS').toUpperCase()}
          <button
            type="button"
            onClick={() => void leaveQuery.refetch()}
            className="ml-3 underline underline-offset-2"
          >
            RETRY
          </button>
        </div>
      )}

      {!leaveQuery.isLoading && !leaveQuery.isError && requests.length === 0 && (
        <div className="mt-8 border border-ink bg-paper p-10 text-center">
          <p className="display text-2xl">NO LEAVE REQUESTS</p>
          <p className="mono mt-3 text-[10px] text-ink-40">
            SUBMITTED REQUESTS SHOW UP HERE FOR REVIEW.
          </p>
        </div>
      )}

      {!leaveQuery.isLoading && !leaveQuery.isError && requests.length > 0 && (
        <div className="mt-8 overflow-x-auto border border-ink bg-paper">
          <table className="w-full text-left">
            <thead className="border-b border-ink">
              <tr className="mono text-[9px] text-ink-40">
                <th className="px-4 py-3 font-normal">EMPLOYEE</th>
                <th className="px-4 py-3 font-normal">TYPE</th>
                <th className="px-4 py-3 font-normal">DATES</th>
                <th className="px-4 py-3 font-normal">DAYS</th>
                <th className="px-4 py-3 font-normal">REASON</th>
                <th className="px-4 py-3 font-normal">STATUS</th>
                <th className="px-4 py-3 font-normal">REQUESTED</th>
                <th className="px-4 py-3 text-right font-normal">DECISION</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-ink/15 last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-sm">{request.employee?.fullName ?? 'Unknown'}</p>
                    <p className="mono text-[9px] text-ink-40">{request.employee?.employeeRef}</p>
                  </td>
                  <td className="mono px-4 py-3 text-[10px] uppercase">
                    {TYPE_LABEL[request.type] ?? request.type}
                  </td>
                  <td className="mono px-4 py-3 text-[10px] text-ink-80">
                    {formatDate(request.startDate)} → {formatDate(request.endDate)}
                  </td>
                  <td className="mono px-4 py-3 text-[10px]">{request.daysRequested}</td>
                  <td className="max-w-52 truncate px-4 py-3 text-sm text-ink-80">
                    {request.reason || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusLabel kind="leave" value={request.status} />
                  </td>
                  <td className="mono px-4 py-3 text-[10px] text-ink-40">
                    {formatDate(request.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {request.status === 'pending' ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          className="h-7 px-3 text-[9px]"
                          disabled={busyId === request.id}
                          onClick={() => decideRequest(request.id, 'approved')}
                        >
                          {busyId === request.id ? 'Saving…' : 'Approve'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-3 text-[9px]"
                          disabled={busyId === request.id}
                          onClick={() => decideRequest(request.id, 'rejected')}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <p className="mono text-right text-[9px] text-ink-40">
                        {request.status === 'approved' ? 'ACCEPTED' : 'DECLINED'}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
