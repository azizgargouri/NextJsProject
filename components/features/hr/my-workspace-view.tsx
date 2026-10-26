'use client';

import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { FieldError, FieldRow, Label } from '@/components/ui/field';
import { StatusLabel } from '@/components/ui/status-chip';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import {
  useAttendance,
  useCheckIn,
  useCreateLeaveRequest,
  useLeaveRequests,
  useMyEmployee,
} from '@/hooks/content/hr';
import { extractErrorMessage } from '@/lib/api/errors';
import type { AttendanceDto, LeaveRequestDto } from '@/types';

const LEAVE_TYPES = [
  { value: 'annual', label: 'Annual leave' },
  { value: 'sick', label: 'Sick leave' },
  { value: 'personal', label: 'Personal leave' },
  { value: 'unpaid', label: 'Unpaid leave' },
] as const;

const LeaveSchema = z
  .object({
    type: z.enum(['annual', 'sick', 'personal', 'unpaid']),
    startDate: z.string().min(1, 'Pick a start date'),
    endDate: z.string().min(1, 'Pick an end date'),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

type LeaveFormValues = z.infer<typeof LeaveSchema>;

const TABS = [
  { id: 'attendance', label: 'Attendance' },
  { id: 'leave', label: 'Leave' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not available in this browser'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 60000,
    });
  });
}

/** Self-service workspace: today's attendance card + leave tab (the local /me module). */
export function MyWorkspaceView() {
  const user = useAuthStore((state) => state.user);
  const profileQuery = useMyEmployee();

  const [tab, setTab] = useState<TabId>('attendance');
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [checkInError, setCheckInError] = useState<string | null>(null);
  const [checkInOk, setCheckInOk] = useState<string | null>(null);
  const [allowWithoutLocation, setAllowWithoutLocation] = useState(false);

  const profile = profileQuery.data ?? null;
  const employeeRef = profile?.employeeRef;

  const todayQuery = useAttendance({ employeeRef: employeeRef ?? '' }, Boolean(employeeRef));
  const leaveQuery = useLeaveRequests({ employeeRef: employeeRef ?? '' }, Boolean(employeeRef));

  const checkIn = useCheckIn();
  const createLeave = useCreateLeaveRequest();

  const today: AttendanceDto | null = todayQuery.data?.[0] ?? null;
  const leaves: LeaveRequestDto[] = leaveQuery.data ?? [];
  const checkedIn = Boolean(today?.clockIn);
  const checkingIn = checkIn.isPending;

  const submitCheckIn = useCallback(
    async (shareLocation: boolean) => {
      setCheckInError(null);
      setCheckInOk(null);
      setAllowWithoutLocation(false);

      let coords: { latitude: number; longitude: number; accuracy: number } | null = null;
      if (shareLocation) {
        setGeoMessage('Asking your browser for your location…');
        try {
          const position = await getPosition();
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          };
          setGeoMessage('Location captured — HR can see it on the team map.');
        } catch (error) {
          const code = (error as GeolocationPositionError | undefined)?.code;
          setGeoMessage(
            code === 1
              ? 'Location permission was blocked. Allow it in your browser and try again — or continue without it.'
              : 'We could not get your location. Try again, or check in without it.',
          );
          setCheckInError(
            'Location not shared. Try again to allow it, or check in without location.',
          );
          setAllowWithoutLocation(true);
          return;
        }
      }

      checkIn.mutate(
        {
          updateLocationOnly: Boolean(today?.clockIn),
          ...(coords ?? {}),
        },
        {
          onSuccess: (response) => {
            if (response.updatedLocation) {
              setCheckInOk('Location updated. HR can see you on the team map.');
            } else if (response.alreadyCheckedIn) {
              setCheckInOk(
                `You were already checked in at ${formatTime(response.attendance.clockIn)}`,
              );
            } else {
              setCheckInOk(
                `Checked in at ${formatTime(response.attendance.clockIn)}${
                  coords ? ' — location shared with HR.' : '.'
                }`,
              );
            }
          },
          onError: (error) => {
            setCheckInError(extractErrorMessage(error, 'Failed to check in. Please try again.'));
          },
        },
      );
    },
    [checkIn, today?.clockIn],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(LeaveSchema),
    defaultValues: { type: 'annual', startDate: '', endDate: '', reason: '' },
  });

  const onSubmitLeave = (values: LeaveFormValues) => {
    createLeave.mutate(
      {
        type: values.type,
        startDate: values.startDate,
        endDate: values.endDate,
        ...(values.reason ? { reason: values.reason } : {}),
      },
      {
        onSuccess: () => {
          reset();
          setTab('leave');
        },
      },
    );
  };

  if (profileQuery.isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
        <LoadingBlock label="Loading your workspace" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 md:px-6">
      <header>
        <h1 className="display text-4xl md:text-6xl">MY WORKSPACE.</h1>
        <p className="mono mt-3 text-[10px] text-ink-40">
          {profile
            ? `SIGNED IN AS ${profile.employeeRef} · ${profile.fullName.toUpperCase()}`
            : 'NO EMPLOYEE PROFILE LINKED TO THIS ACCOUNT'}
        </p>
      </header>

      {!profile && (
        <div className="mt-8 border border-ink bg-paper p-10 text-center">
          <p className="display text-2xl">PROFILE NOT LINKED</p>
          <p className="mono mt-3 text-[10px] leading-relaxed text-ink-40">
            YOUR ACCOUNT ({user?.email?.toUpperCase() ?? 'UNKNOWN'}) HAS NO EMPLOYEE RECORD YET —
            ASK HR TO ADD YOUR WORK EMAIL TO THE DIRECTORY.
          </p>
        </div>
      )}

      {profile && (
        <>
          <div className="mt-8 flex gap-1 border-b border-ink" role="tablist">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={
                    active
                      ? 'mono -mb-px border-b-2 border-hazard px-4 py-2 text-[10px] text-ink'
                      : 'mono -mb-px border-b-2 border-transparent px-4 py-2 text-[10px] text-ink-40 transition-colors hover:text-ink'
                  }
                >
                  {item.label.toUpperCase()}
                </button>
              );
            })}
          </div>

          {tab === 'attendance' && (
            <section className="mt-6 border border-ink bg-paper p-5" role="tabpanel">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="mono text-[11px] font-bold">TODAY&apos;S ATTENDANCE</h2>
                  <p className="mono mt-2 text-[10px] text-ink-40">
                    {todayQuery.isLoading
                      ? 'LOADING…'
                      : checkedIn
                        ? `CHECKED IN AT ${formatTime(today?.clockIn)}`
                        : 'NOT CHECKED IN YET'}
                  </p>
                </div>
                <Button
                  variant={checkedIn ? 'outline' : 'hazard'}
                  size="sm"
                  disabled={checkingIn || checkedIn}
                  onClick={() => void submitCheckIn(true)}
                  title={
                    checkedIn
                      ? 'You are already checked in today'
                      : 'Check in and share your location'
                  }
                >
                  {checkingIn ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : checkedIn ? (
                    'Checked in'
                  ) : (
                    'Check in'
                  )}
                </Button>
              </div>

              <p className="mono mt-3 text-[9px] text-ink-40">
                {checkedIn
                  ? today?.location
                    ? 'YOUR LOCATION WAS CAPTURED WHEN YOU CHECKED IN.'
                    : 'YOU CHECKED IN WITHOUT SHARING A LOCATION.'
                  : 'CHECK IN WITH ONE CLICK — YOUR BROWSER WILL ASK FOR YOUR LOCATION.'}
              </p>

              {!checkedIn && allowWithoutLocation && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3 h-8 px-3 text-[9px]"
                  disabled={checkingIn}
                  onClick={() => void submitCheckIn(false)}
                >
                  Check in without location
                </Button>
              )}

              {geoMessage && (
                <p className="mono mt-3 text-[9px] text-ink-40">{geoMessage.toUpperCase()}</p>
              )}
              {checkInOk && (
                <p className="mono mt-3 border border-ink px-3 py-2 text-[10px] text-ink">
                  {checkInOk.toUpperCase()}
                </p>
              )}
              {checkInError && (
                <p className="mono mt-3 border border-hazard bg-hazard/5 px-3 py-2 text-[10px] text-hazard">
                  {checkInError.toUpperCase()}
                </p>
              )}

              {today?.location && (
                <p className="mono mt-3 text-[9px] text-ink-40">
                  LOCATION SHARED: {today.location.lat.toFixed(5)}, {today.location.lng.toFixed(5)}
                  {today.location.accuracy ? ` (±${today.location.accuracy}M)` : ''}
                </p>
              )}

              <div className="mt-6 border-t border-ink/15 pt-4">
                <h3 className="mono text-[10px] text-ink-40">MY RECENT DAYS</h3>
                <ul className="mt-3">
                  {(todayQuery.data ?? []).slice(0, 7).map((record) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between border-b border-ink/10 py-2 last:border-0"
                    >
                      <span className="mono text-[10px]">
                        {formatDate(record.workDate).toUpperCase()}
                      </span>
                      <span className="mono text-[10px] text-ink-40">
                        IN {formatTime(record.clockIn)}
                        {record.clockOut ? ` · OUT ${formatTime(record.clockOut)}` : ''}
                      </span>
                      <StatusLabel kind="attendance" value={record.status} />
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {tab === 'leave' && (
            <div className="mt-6 space-y-6" role="tabpanel">
              <section className="border border-ink bg-paper p-5">
                <h2 className="mono text-[11px] font-bold">REQUEST LEAVE</h2>

                <form
                  onSubmit={handleSubmit(onSubmitLeave)}
                  className="mt-5 grid gap-4 sm:grid-cols-2"
                  noValidate
                >
                  <FieldRow>
                    <Label htmlFor="leaveType">TYPE</Label>
                    <Select id="leaveType" {...register('type')}>
                      {LEAVE_TYPES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                    <FieldError message={errors.type?.message} />
                  </FieldRow>

                  <FieldRow>
                    <Label htmlFor="leaveStart">START DATE</Label>
                    <Input id="leaveStart" type="date" {...register('startDate')} />
                    <FieldError message={errors.startDate?.message} />
                  </FieldRow>

                  <FieldRow>
                    <Label htmlFor="leaveEnd">END DATE</Label>
                    <Input id="leaveEnd" type="date" {...register('endDate')} />
                    <FieldError message={errors.endDate?.message} />
                  </FieldRow>

                  <FieldRow>
                    <Label htmlFor="leaveReason">REASON</Label>
                    <Input id="leaveReason" placeholder="Optional" {...register('reason')} />
                    <FieldError message={errors.reason?.message} />
                  </FieldRow>

                  <div className="sm:col-span-2">
                    <Button
                      type="submit"
                      variant="primary"
                      size="default"
                      disabled={createLeave.isPending}
                    >
                      {createLeave.isPending ? 'Submitting…' : 'Submit request'}
                    </Button>
                  </div>
                </form>

                {createLeave.isError && (
                  <p className="mono mt-4 border border-hazard bg-hazard/5 px-3 py-2 text-[10px] text-hazard">
                    {extractErrorMessage(
                      createLeave.error,
                      'FAILED TO SUBMIT REQUEST',
                    ).toUpperCase()}
                  </p>
                )}
                {createLeave.isSuccess && (
                  <p className="mono mt-4 border border-ink px-3 py-2 text-[10px] text-ink">
                    LEAVE REQUEST SUBMITTED
                  </p>
                )}
              </section>

              <section className="border border-ink bg-paper">
                <div className="border-b border-ink px-5 py-3">
                  <h2 className="mono text-[11px] font-bold">MY LEAVE REQUESTS</h2>
                </div>
                {leaveQuery.isLoading ? (
                  <LoadingBlock label="Loading requests" />
                ) : leaves.length === 0 ? (
                  <p className="mono px-5 py-5 text-[10px] text-ink-40">NO LEAVE REQUESTS YET.</p>
                ) : (
                  <ul>
                    {leaves.map((leave) => (
                      <li
                        key={leave.id}
                        className="flex flex-wrap items-center gap-3 border-b border-ink/15 px-5 py-3 last:border-0"
                      >
                        <span className="mono text-[10px] uppercase">{leave.type}</span>
                        <span className="mono text-[10px] text-ink-40">
                          {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                        </span>
                        <span className="mono text-[10px] text-ink-40">
                          {leave.daysRequested} DAY{leave.daysRequested === 1 ? '' : 'S'}
                        </span>
                        <span className="ml-auto">
                          <StatusLabel kind="leave" value={leave.status} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}
