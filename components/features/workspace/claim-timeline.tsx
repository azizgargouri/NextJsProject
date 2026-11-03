import { CLAIM_STATUS_LABELS } from '@/lib/quality/constants';
import type { ClaimEventDto } from '@/types';
import { cn } from '@/lib/utils';
import { formatDate } from './workspace-blocks';

const KIND_LABEL: Record<ClaimEventDto['kind'], string> = {
  CREATED: 'Submitted',
  MESSAGE: 'Message',
  STATUS_CHANGED: 'Status',
  RESOLUTION: 'Decision',
};

/** Server Component: the claim conversation rendered on the server (no JS shipped). */
export function ClaimTimeline({ events, viewerId }: { events: ClaimEventDto[]; viewerId: string }) {
  return (
    <ol className="space-y-px border border-ink bg-ink">
      {events.map((event, index) => {
        const mine = event.author?.id === viewerId;
        return (
          <li
            key={`${event.createdAt}-${index}`}
            className={cn('bg-paper p-4', mine && 'bg-paper-soft')}
          >
            <div className="mono flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-80">
              <span
                className={cn(
                  'px-1.5 py-0.5',
                  event.kind === 'RESOLUTION' ? 'bg-hazard text-white' : 'bg-ink text-paper',
                )}
              >
                {KIND_LABEL[event.kind]}
              </span>
              <span>{mine ? 'You' : (event.author?.name ?? event.authorRole)}</span>
              <span className="text-ink-40">{formatDate(event.createdAt)}</span>
              {event.status ? <span>→ {CLAIM_STATUS_LABELS[event.status]}</span> : null}
            </div>
            {event.text ? (
              <p className="mt-2 whitespace-pre-line text-sm leading-6">{event.text}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
