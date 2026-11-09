'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  useMoverAvailability,
  useMoverProfile,
  useSetAvailability,
  useUpdateMoverProfile,
} from '@/hooks/content/mover';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/types';
import {
  apiErrorMessage,
  ErrorState,
  formatDay,
  LoadingState,
  Notice,
  PageTitle,
  Panel,
  SLOT_LABELS,
} from './mover-ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHORT_SLOT: Record<TimeSlot, string> = { MORNING: 'AM', AFTERNOON: 'PM', FULL_DAY: 'DAY' };
const SLOTS: TimeSlot[] = ['MORNING', 'AFTERNOON', 'FULL_DAY'];

function todayTunis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(new Date());
}

function iso(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function useMonthGrid(year: number, month: number) {
  return useMemo(() => {
    const first = new Date(Date.UTC(year, month, 1));
    const total = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leading = (first.getUTCDay() + 6) % 7; // Weeks start on Monday.
    const days = Array.from({ length: total }, (_, index) => iso(year, month, index + 1));
    return {
      leading,
      days,
      from: iso(year, month, 1),
      to: iso(year, month, total),
      label: new Intl.DateTimeFormat('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(first),
    };
  }, [year, month]);
}

function CalendarPanel() {
  const today = todayTunis();
  const [cursor, setCursor] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)) - 1,
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const grid = useMonthGrid(cursor.year, cursor.month);
  const availability = useMoverAvailability(grid.from, grid.to);
  const setDay = useSetAvailability();
  const slotByDate = useMemo(
    () => new Map((availability.data ?? []).map((day) => [day.date, day.slot])),
    [availability.data],
  );
  const canGoBack = grid.from.slice(0, 7) > today.slice(0, 7);

  const move = (delta: number) => {
    setSelected(null);
    setCursor(({ year, month }) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  };

  const choose = (date: string, slot: TimeSlot | null) => {
    setDay.mutate({ date, slot }, { onError: (error) => toast.error(apiErrorMessage(error)) });
  };

  const selectedSlot = selected ? (slotByDate.get(selected) ?? null) : null;

  return (
    <Panel title="Calendar">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => move(-1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="font-bold" aria-live="polite">
          {grid.label}
        </p>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => move(1)}>
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {availability.isError ? (
        <ErrorState error={availability.error} onRetry={() => void availability.refetch()} />
      ) : (
        <div className="grid grid-cols-7 gap-px border border-ink bg-ink">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="mono bg-paper-soft py-2 text-center text-[9px] tracking-normal"
            >
              {day}
            </div>
          ))}
          {Array.from({ length: grid.leading }, (_, index) => (
            <div key={`empty-${index}`} className="bg-paper-soft" />
          ))}
          {grid.days.map((date) => {
            const slot = slotByDate.get(date);
            const past = date < today;
            return (
              <button
                key={date}
                type="button"
                disabled={past}
                aria-pressed={selected === date}
                aria-label={`${formatDay(date)}: ${slot ? SLOT_LABELS[slot] : 'not available'}`}
                onClick={() => setSelected(date)}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 bg-paper text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hazard md:min-h-16',
                  past && 'cursor-not-allowed bg-paper-soft text-ink-40',
                  slot && !past && 'bg-ink text-paper',
                  selected === date && 'outline-2 -outline-offset-2 outline-hazard',
                  date === today && 'font-black underline underline-offset-2',
                )}
              >
                {Number(date.slice(8))}
                <span className="mono text-[9px] leading-none tracking-normal">
                  {slot ? SHORT_SLOT[slot] : ''}
                </span>
              </button>
            );
          })}
          {Array.from({ length: (7 - ((grid.leading + grid.days.length) % 7)) % 7 }, (_, index) => (
            <div key={`trailing-${index}`} className="bg-paper-soft" />
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-ink pt-4">
        {selected ? (
          <>
            <p className="font-bold">{formatDay(selected)}</p>
            <div
              role="group"
              aria-label="Availability for this day"
              className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {SLOTS.map((slot) => (
                <Button
                  key={slot}
                  size="sm"
                  variant={selectedSlot === slot ? 'primary' : 'outline'}
                  aria-pressed={selectedSlot === slot}
                  disabled={setDay.isPending}
                  onClick={() => choose(selected, slot)}
                >
                  {SLOT_LABELS[slot]}
                </Button>
              ))}
              <Button
                size="sm"
                variant={selectedSlot === null ? 'primary' : 'outline'}
                aria-pressed={selectedSlot === null}
                disabled={setDay.isPending}
                onClick={() => choose(selected, null)}
              >
                Not available
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-80">Pick a day to set when you are free.</p>
        )}
      </div>
    </Panel>
  );
}

function ZonesPanel() {
  const profile = useMoverProfile();
  const update = useUpdateMoverProfile();

  return (
    <Panel title="Service zones" className="self-start">
      {profile.isPending ? (
        <LoadingState label="Loading zones" />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-80">
            You get offers for moves that start in these zones.
          </p>
          {profile.data.zones.length === 0 ? (
            <div className="mb-3">
              <Notice>Choose at least one zone to receive offers.</Notice>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            {profile.data.availableZones.map((zone) => {
              const checked = profile.data.zones.includes(zone.code);
              return (
                <label
                  key={zone.code}
                  className="flex min-h-11 cursor-pointer items-center gap-3 border border-ink px-3 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-hazard"
                >
                  <input
                    type="checkbox"
                    className="size-5 accent-ink"
                    checked={checked}
                    disabled={update.isPending}
                    onChange={() =>
                      update.mutate(
                        {
                          zones: checked
                            ? profile.data.zones.filter((code) => code !== zone.code)
                            : [...profile.data.zones, zone.code],
                        },
                        { onError: (error) => toast.error(apiErrorMessage(error)) },
                      )
                    }
                  />
                  <span className="text-sm font-bold">{zone.label}</span>
                </label>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}

/** Item 4: free days and slots, and the zones covered (M-03). */
export function AvailabilityPortal() {
  return (
    <>
      <PageTitle
        title="Availability"
        description="Offers only come for days and zones you set here."
      />
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <CalendarPanel />
        <ZonesPanel />
      </div>
    </>
  );
}
