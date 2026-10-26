'use client';

import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusLabel } from '@/components/ui/status-chip';
import { LoadingBlock } from '@/components/features/hr/loading-block';
import { useAttendance, useEmployees } from '@/hooks/content/hr';
import { extractErrorMessage } from '@/lib/api/errors';
import type { AttendanceDto, AttendanceStatus, EmployeeDto } from '@/types';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const CHART_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'leave', 'halfDay'];

/** Two-ink print system: carbon + hazard fills only. */
const CHART_FILL: Record<AttendanceStatus, string> = {
  present: 'bg-ink',
  late: 'bg-hazard',
  absent: 'bg-hazard/35',
  leave: 'bg-paper-soft',
  halfDay: 'bg-ink/40',
};

const CHART_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
  halfDay: 'Half day',
};

type Counts = Record<AttendanceStatus, number>;

function emptyCounts(): Counts {
  return { present: 0, late: 0, absent: 0, leave: 0, halfDay: 0 };
}

function addToCounts(counts: Counts, status?: string) {
  const key = (status ?? 'present') as AttendanceStatus;
  if (key in counts) counts[key] += 1;
}

function totalOf(counts: Counts) {
  return CHART_ORDER.reduce((sum, key) => sum + counts[key], 0);
}

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function gridStart(month: Date) {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return start;
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Attendance history — month calendar, employee filter, status chart, day detail. */
export function AttendanceView() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [employeeRef, setEmployeeRef] = useState('');
  const [allMode, setAllMode] = useState(true);
  const [search, setSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const employeesQuery = useEmployees();
  const from = dayKey(gridStart(month));
  const to = dayKey(addDays(gridStart(month), 41));
  const attendanceQuery = useAttendance({
    from,
    to,
    ...(employeeRef && !allMode ? { employeeRef } : {}),
  });

  const employees = (employeesQuery.data ?? []).filter((employee) => employee.role !== 'hr');
  const records = useMemo(() => attendanceQuery.data ?? [], [attendanceQuery.data]);

  const grid = useMemo(() => {
    const start = gridStart(month);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, AttendanceDto[]>();
    for (const record of records) {
      const key = dayKey(new Date(record.workDate));
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.clockIn && b.clockIn) return +new Date(a.clockIn) - +new Date(b.clockIn);
        if (a.clockIn) return -1;
        if (b.clockIn) return 1;
        return (a.employee?.fullName ?? '').localeCompare(b.employee?.fullName ?? '');
      });
    }

    return map;
  }, [records]);

  const monthTotals = useMemo(() => {
    const totals = emptyCounts();
    for (const record of records) addToCounts(totals, record.status);
    return totals;
  }, [records]);

  const perEmployee = useMemo(() => {
    const map = new Map<string, { name: string; counts: Counts }>();
    for (const record of records) {
      const ref = record.employee?.employeeRef ?? 'unknown';
      const entry = map.get(ref) ?? {
        name: record.employee?.fullName ?? 'Unknown employee',
        counts: emptyCounts(),
      };
      addToCounts(entry.counts, record.status);
      map.set(ref, entry);
    }
    return map;
  }, [records]);

  const chartRows = useMemo(() => {
    const rows = employees.map((employee) => {
      const counts = perEmployee.get(employee.employeeRef)?.counts ?? emptyCounts();
      return {
        ref: employee.employeeRef,
        name: employee.fullName,
        counts,
        total: totalOf(counts),
      };
    });

    const scoped = allMode ? rows : rows.filter((row) => row.ref === employeeRef);

    return scoped.slice().sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [employees, perEmployee, allMode, employeeRef]);

  const chartMax = useMemo(() => Math.max(1, ...chartRows.map((row) => row.total)), [chartRows]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return employees;
    return employees.filter(
      (employee) =>
        employee.fullName.toLowerCase().includes(query) ||
        employee.employeeRef.toLowerCase().includes(query),
    );
  }, [employees, search]);

  function selectEmployee(employee: EmployeeDto) {
    setAllMode(false);
    setEmployeeRef(employee.employeeRef);
    setSearch(employee.fullName);
    setPickerOpen(false);
    setSelectedKey(null);
  }

  function toggleAll(checked: boolean) {
    setAllMode(checked);
    if (checked) {
      setEmployeeRef('');
      setSearch('');
      setPickerOpen(false);
      setSelectedKey(null);
    } else {
      setPickerOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }

  const selectedRecords = selectedKey ? (byDay.get(selectedKey) ?? []) : [];
  const monthLabel = month.toLocaleDateString([], { month: 'long', year: 'numeric' }).toUpperCase();
  const todayKey = dayKey(new Date());

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl md:text-6xl">ATTENDANCE.</h1>
          <p className="mono mt-3 text-[10px] text-ink-40">CLOCK-INS · TIMESHEETS · CALENDAR</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="mono flex cursor-pointer select-none items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={allMode}
              onChange={(event) => toggleAll(event.target.checked)}
              className="size-3.5 accent-hazard"
            />
            ALL
          </label>

          <div ref={pickerRef} className="relative">
            <Input
              ref={searchRef}
              id="employeeFilter"
              className="h-9 w-56 text-[11px]"
              value={search}
              disabled={allMode}
              onChange={(event) => {
                setSearch(event.target.value);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              placeholder={allMode ? 'All employees' : 'Search employee…'}
              autoComplete="off"
            />

            {pickerOpen && !allMode && (
              <ul className="absolute right-0 z-20 mt-1 max-h-56 w-64 overflow-auto border border-ink bg-paper">
                {filteredEmployees.length === 0 && (
                  <li className="mono px-3 py-2 text-[10px] text-ink-40">NO MATCHING EMPLOYEE</li>
                )}
                {filteredEmployees.map((employee) => (
                  <li key={employee.id}>
                    <button
                      type="button"
                      onClick={() => selectEmployee(employee)}
                      className="flex w-full items-center justify-between border-b border-ink/10 px-3 py-2 text-left text-sm last:border-0 hover:bg-paper-soft"
                    >
                      <span>{employee.fullName}</span>
                      <span className="mono text-[9px] text-ink-40">{employee.employeeRef}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[12px]"
            aria-label="Previous month"
            onClick={() =>
              setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
            }
          >
            ‹
          </Button>
          <span className="mono min-w-48 text-center text-[11px] font-bold">{monthLabel}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-3 text-[12px]"
            aria-label="Next month"
            onClick={() =>
              setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
            }
          >
            ›
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-[9px]"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            TODAY
          </Button>
        </div>

        <div className="mono flex flex-wrap items-center gap-3 text-[10px] text-ink-40">
          <span>{monthTotals.present} PRESENT</span>
          <span>{monthTotals.late} LATE</span>
          <span>{monthTotals.absent} ABSENT</span>
          <span>{monthTotals.leave} LEAVE</span>
        </div>
      </div>

      <section className="mt-6 border border-ink bg-paper">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink px-5 py-3">
          <div>
            <h2 className="mono text-[11px] font-bold">ATTENDANCE OVERVIEW</h2>
            <p className="mono mt-1 text-[9px] text-ink-40">
              {monthLabel} · {allMode ? 'ALL EMPLOYEES' : (search || employeeRef).toUpperCase()}
            </p>
          </div>
          <div className="mono flex flex-wrap items-center gap-3 text-[9px] text-ink-40">
            {CHART_ORDER.map((key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2.5 w-2.5 border border-ink/30 ${CHART_FILL[key]}`}
                />
                {CHART_LABEL[key].toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="p-5">
          {chartRows.length === 0 ? (
            <p className="mono text-[10px] text-ink-40">NO ATTENDANCE DATA FOR THIS MONTH YET.</p>
          ) : (
            <div className="space-y-2">
              {chartRows.map((row) => (
                <div
                  key={row.ref}
                  className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 sm:grid-cols-[10rem_1fr_3rem]"
                >
                  <span className="truncate text-sm" title={row.name}>
                    {row.name}
                  </span>
                  <div className="flex h-3 w-full overflow-hidden border border-ink/30 bg-paper-soft">
                    {CHART_ORDER.map((key) =>
                      row.counts[key] > 0 ? (
                        <span
                          key={key}
                          className={CHART_FILL[key]}
                          style={{ width: `${(row.counts[key] / chartMax) * 100}%` }}
                          title={`${CHART_LABEL[key]}: ${row.counts[key]}`}
                        />
                      ) : null,
                    )}
                  </div>
                  <span className="mono text-right text-[10px] text-ink-40">{row.total}</span>
                </div>
              ))}

              <div className="grid grid-cols-[7rem_1fr_2.5rem] items-center gap-3 border-t border-ink pt-3 sm:grid-cols-[10rem_1fr_3rem]">
                <span className="mono text-[10px] font-bold">TOTAL</span>
                <div className="flex h-3 w-full overflow-hidden border border-ink/30 bg-paper-soft">
                  {CHART_ORDER.map((key) =>
                    monthTotals[key] > 0 ? (
                      <span
                        key={key}
                        className={CHART_FILL[key]}
                        style={{ width: `${(monthTotals[key] / chartMax) * 100}%` }}
                        title={`${CHART_LABEL[key]}: ${monthTotals[key]}`}
                      />
                    ) : null,
                  )}
                </div>
                <span className="mono text-right text-[10px] font-bold">
                  {totalOf(monthTotals)}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {attendanceQuery.isError && (
        <div className="mono mt-6 border border-hazard bg-hazard/5 px-4 py-3 text-[10px] text-hazard">
          {extractErrorMessage(attendanceQuery.error, 'FAILED TO LOAD ATTENDANCE').toUpperCase()}
          <button
            type="button"
            onClick={() => void attendanceQuery.refetch()}
            className="ml-3 underline underline-offset-2"
          >
            RETRY
          </button>
        </div>
      )}

      <section className="mt-6 overflow-hidden border border-ink bg-paper">
        <div className="grid grid-cols-7 border-b border-ink">
          {WEEKDAYS.map((day) => (
            <div key={day} className="mono px-2 py-2 text-center text-[9px] text-ink-40">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const key = dayKey(date);
            const dayRecords = byDay.get(key) ?? [];
            const inMonth = date.getMonth() === month.getMonth();
            const isToday = key === todayKey;
            const active = key === selectedKey;

            return (
              <button
                key={key}
                type="button"
                data-day={key}
                onClick={() => setSelectedKey(key)}
                className={[
                  'min-h-28 border-b border-r border-ink/15 p-2 text-left align-top last:border-r-0',
                  inMonth ? 'bg-paper' : 'bg-paper-soft text-ink-40',
                  active ? 'ring-2 ring-inset ring-ink' : 'hover:bg-paper-soft',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={[
                      'mono flex h-5 w-5 items-center justify-center text-[10px]',
                      isToday ? 'bg-hazard text-white' : '',
                    ].join(' ')}
                  >
                    {date.getDate()}
                  </span>
                  {dayRecords.length > 0 && (
                    <span className="mono text-[9px] text-ink-40">{dayRecords.length}</span>
                  )}
                </div>

                <div className="mt-1 space-y-1">
                  {dayRecords.slice(0, 3).map((record) => {
                    const status = (record.status ?? 'present') as AttendanceStatus;
                    const flagged = status === 'late' || status === 'absent';
                    const label =
                      employeeRef && !allMode
                        ? `${CHART_LABEL[status]} ${formatTime(record.clockIn)}`
                        : (record.employee?.fullName ?? 'Unknown');

                    return (
                      <span
                        key={record.id}
                        className={`mono block truncate border px-1 py-0.5 text-[8px] ${
                          flagged ? 'border-hazard/40 text-hazard' : 'border-ink/20 text-ink-80'
                        }`}
                        title={`${record.employee?.fullName ?? ''} — ${CHART_LABEL[status]} ${formatTime(record.clockIn)}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                  {dayRecords.length > 3 && (
                    <span
                      className="mono block truncate text-[8px] text-ink-40"
                      title={dayRecords
                        .slice(3)
                        .map((record) => record.employee?.fullName ?? 'Unknown')
                        .join(', ')}
                    >
                      +{dayRecords.length - 3} MORE
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {attendanceQuery.isLoading && (
        <div className="mt-6">
          <LoadingBlock label="Loading attendance" />
        </div>
      )}

      <section className="mt-6 border border-ink bg-paper">
        <div className="border-b border-ink px-5 py-3">
          <h2 className="mono text-[11px] font-bold">
            {selectedKey
              ? new Date(`${selectedKey}T00:00:00`)
                  .toLocaleDateString([], {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })
                  .toUpperCase()
              : 'PICK A DAY'}
          </h2>
        </div>

        {!selectedKey ? (
          <p className="mono px-5 py-5 text-[10px] text-ink-40">
            SELECT A DAY IN THE CALENDAR TO SEE WHO WAS IN.
          </p>
        ) : selectedRecords.length === 0 ? (
          <p className="mono px-5 py-5 text-[10px] text-ink-40">
            NO ATTENDANCE RECORDS FOR THIS DAY.
          </p>
        ) : (
          <ul>
            {selectedRecords.map((record) => (
              <li
                key={record.id}
                className="flex flex-wrap items-center gap-3 border-b border-ink/15 px-5 py-3 last:border-0"
              >
                <span className="text-sm">{record.employee?.fullName ?? 'Unknown'}</span>
                <span className="mono text-[9px] text-ink-40">{record.employee?.employeeRef}</span>
                <span className="mono ml-auto text-[10px] text-ink-40">
                  IN {formatTime(record.clockIn)}
                  {record.clockOut ? ` · OUT ${formatTime(record.clockOut)}` : ''}
                </span>
                <StatusLabel kind="attendance" value={record.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
