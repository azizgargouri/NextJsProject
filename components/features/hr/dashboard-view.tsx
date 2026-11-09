'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StatusLabel } from '@/components/ui/status-chip';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import {
  useAttendance,
  useDashboardStats,
  useEmployees,
  useLeaveRequests,
  useVoiceCheckins,
} from '@/hooks/content/hr';
import type { AttendanceDto, EmployeeDto } from '@/types';

type RosterRow = {
  employee: EmployeeDto;
  record?: AttendanceDto;
  state: 'in' | 'leave' | 'absent' | 'out';
};

const ROSTER_ORDER: Record<RosterRow['state'], number> = { in: 0, leave: 1, absent: 2, out: 3 };

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function coversToday(start: string, end: string): boolean {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const rangeStart = new Date(start);
  const rangeEnd = new Date(end);
  rangeEnd.setHours(23, 59, 59, 999);
  return rangeStart < dayEnd && rangeEnd >= dayStart;
}

function isVoiceMismatch(label: string, decision: string, reasons: string[]): boolean {
  return (
    decision === 'reject' ||
    label === 'different_voice' ||
    reasons.some(
      (reason) =>
        reason.includes('voice') || reason.includes('different') || reason.includes('challenge'),
    )
  );
}

function VoiceAlertsSection() {
  const voice = useVoiceCheckins();
  const [playing, setPlaying] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  if (voice.isError) return null;

  const rows = voice.data ?? [];
  const mismatches = rows.filter((row) =>
    isVoiceMismatch(row.voiceLabel, row.decision, row.reasons),
  );

  const listen = async (id: string) => {
    if (urls[id]) {
      setPlaying((current) => (current === id ? null : id));
      return;
    }
    try {
      const { axiosClient } = await import('@/lib/api/client');
      const { data } = await axiosClient.get(`/api/voice/checkins/${id}/audio`, {
        responseType: 'blob',
      });
      setUrls((current) => ({
        ...current,
        [id]: URL.createObjectURL(new Blob([data as Blob], { type: 'audio/webm' })),
      }));
      setPlaying(id);
    } catch {
      setPlaying(null);
    }
  };

  return (
    <section className="mt-6 border border-ink bg-paper">
      <div className="border-b border-ink px-5 py-3">
        <h2 className="mono text-[11px] font-bold">VOICE CHECK-IN ALERTS</h2>
        <p className="mono mt-1 text-[9px] text-ink-40">
          {voice.isLoading ? 'LOADING…' : `${mismatches.length} MISMATCH${mismatches.length === 1 ? '' : 'ES'} · ${rows.length} ATTEMPT${rows.length === 1 ? '' : 'S'} TOTAL`}
        </p>
      </div>
      {mismatches.length === 0 ? (
        <p className="mono px-5 py-5 text-[10px] text-ink-40">
          NO DIFFERENT-VOICE DETECTIONS. ATTEMPTS APPEAR HERE AS EMPLOYEES CHECK IN BY VOICE.
        </p>
      ) : (
        <ul>
          {mismatches.slice(0, 10).map((row) => (
            <li
              key={row.id}
              className="border-b border-ink/15 px-5 py-3 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="mono text-[10px] font-bold">⚠ {row.employeeRef}</span>
                <span className="mono text-[10px] text-ink-40">
                  speaker {row.speakerScore.toFixed(2)} · {row.voiceLabel} · {row.decision}
                </span>
                <span className="mono text-[10px] text-ink-40">
                  {new Date(row.createdAt).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="mono ml-auto text-[9px] text-hazard">
                  {(row.reasons.join(', ') || 'DIFFERENT VOICE').toUpperCase()}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void listen(row.id)}
                  className="mono border border-ink px-3 py-1.5 text-[9px] hover:bg-ink hover:text-paper"
                >
                  {playing === row.id ? 'HIDE REC' : 'LISTEN REC'}
                </button>
                {playing === row.id && urls[row.id] && (
                  <audio controls autoPlay src={urls[row.id]} className="w-full sm:w-80" />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** HR control dashboard — stats, today's roster, schedule and voice alerts. */
export function DashboardView() {
  const statsQuery = useDashboardStats();
  const employeesQuery = useEmployees();
  const attendanceQuery = useAttendance({});
  const leaveQuery = useLeaveRequests({});

  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const attendance = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);
  const leaves = useMemo(() => leaveQuery.data ?? [], [leaveQuery.data]);
  const stats = statsQuery.data;

  const loading =
    statsQuery.isLoading ||
    employeesQuery.isLoading ||
    attendanceQuery.isLoading ||
    leaveQuery.isLoading;
  const error =
    statsQuery.error ?? employeesQuery.error ?? attendanceQuery.error ?? leaveQuery.error;

  const refetchAll = () => {
    void statsQuery.refetch();
    void employeesQuery.refetch();
    void attendanceQuery.refetch();
    void leaveQuery.refetch();
  };

  const team = useMemo(() => employees.filter((employee) => employee.role !== 'hr'), [employees]);

  const roster = useMemo<RosterRow[]>(() => {
    const onLeaveIds = new Set(
      leaves
        .filter(
          (leave) =>
            leave.status === 'approved' &&
            Boolean(leave.employee) &&
            coversToday(leave.startDate, leave.endDate),
        )
        .map((leave) => leave.employee?.employeeRef),
    );

    const rows = team.map<RosterRow>((employee) => {
      const record = attendance.find((item) => item.employee?.employeeRef === employee.employeeRef);
      if (record?.clockIn) return { employee, record, state: 'in' };
      if (onLeaveIds.has(employee.employeeRef)) return { employee, record, state: 'leave' };
      if (record?.status === 'absent') return { employee, record, state: 'absent' };
      return { employee, record, state: 'out' };
    });

    return rows.sort(
      (a, b) =>
        ROSTER_ORDER[a.state] - ROSTER_ORDER[b.state] ||
        a.employee.fullName.localeCompare(b.employee.fullName),
    );
  }, [team, attendance, leaves]);

  const statTiles = [
    { label: 'Employees', value: stats ? String(stats.totalEmployees) : '—' },
    { label: 'Scheduled today', value: stats ? String(stats.employeesScheduledToday) : '—' },
    { label: 'Present today', value: stats ? String(stats.employeesPresentToday) : '—' },
    { label: 'Late today', value: stats ? String(stats.employeesLateToday) : '—' },
    { label: 'Approved leave', value: stats ? String(stats.confirmedAbsencesToday) : '—' },
    { label: 'Pending requests', value: stats ? String(stats.pendingLeaveRequests) : '—' },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">HR CONTROL.</h1>
          <p className="mono mt-3 text-[10px] text-ink-40">
            EMPLOYEE &amp; RH MODULE — LIVE FROM MONGO ·{' '}
            {stats ? `${stats.rangeFrom} → ${stats.rangeTo}` : 'TODAY'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetchAll}>
          Refresh
        </Button>
      </header>

      {error && (
        <p className="mono mt-6 border border-hazard bg-hazard/5 px-4 py-3 text-[10px] text-hazard">
          {(error as Error).message?.toUpperCase() || 'FAILED TO LOAD DASHBOARD'} —{' '}
          <button type="button" onClick={refetchAll} className="underline underline-offset-2">
            RETRY
          </button>
        </p>
      )}

      <section className="mt-8 grid grid-cols-2 gap-px border border-ink bg-ink md:grid-cols-3 xl:grid-cols-6">
        {statTiles.map((tile) => (
          <div key={tile.label} className="bg-paper p-5">
            <p className="display text-4xl">{tile.value}</p>
            <p className="mono mt-2 text-[9px] text-ink-40">{tile.label.toUpperCase()}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="border border-ink bg-paper lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink px-5 py-3">
            <h2 className="mono text-[11px] font-bold">TODAY&apos;S TEAM</h2>
            <p className="mono text-[9px] text-ink-40">
              {loading
                ? 'LOADING…'
                : `${roster.length} STAFF · ${roster.filter((row) => row.state === 'in').length} IN`}
            </p>
          </div>

          {loading ? (
            <LoadingBlock label="Loading today's activity" />
          ) : roster.length === 0 ? (
            <p className="mono px-5 py-6 text-[10px] text-ink-40">
              NO EMPLOYEES IN THE DIRECTORY YET.
            </p>
          ) : (
            <ul>
              {roster.map((row) => {
                const hasLocation = Boolean(row.record?.location);
                return (
                  <li
                    key={row.employee.id}
                    className="flex flex-wrap items-center gap-3 border-b border-ink/15 px-5 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{row.employee.fullName}</p>
                      <p className="mono text-[9px] text-ink-40">
                        {row.employee.employeeRef} · {row.employee.role.toUpperCase()}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                      {row.state === 'in' && (
                        <span className="mono text-[9px] text-ink-40">
                          AT {formatTime(row.record?.clockIn)}
                        </span>
                      )}
                      <StatusLabel kind="roster" value={row.state} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border border-ink bg-paper">
          <div className="flex items-center justify-between border-b border-ink px-5 py-3">
            <h2 className="mono text-[11px] font-bold">SCHEDULE · 7 DAYS</h2>
          </div>
          {!stats ? (
            <LoadingBlock label="Loading schedule" />
          ) : (
            <ul>
              {stats.upcomingWorkdays.map((day, index) => (
                <li
                  key={day.date}
                  className="flex items-center justify-between border-b border-ink/15 px-5 py-3 last:border-0"
                >
                  <span className="mono text-[10px]">
                    {index === 0
                      ? 'TODAY'
                      : new Date(`${day.date}T00:00:00`)
                          .toLocaleDateString([], {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })
                          .toUpperCase()}
                  </span>
                  <span className="mono text-[11px] font-bold">{day.scheduledEmployees}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mono border-t border-ink px-5 py-3 text-[9px] text-ink-40">
            NOT CHECKED IN YET: {stats ? stats.employeesNotCheckedIn : '—'}
          </p>
        </div>
      </section>

      <VoiceAlertsSection />
    </main>
  );
}
