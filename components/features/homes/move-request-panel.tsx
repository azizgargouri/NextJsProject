'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Link2, Link2Off, Loader2, PackageOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import { useClientMoveRequests, useUpdateHome } from '@/hooks/content/homes';
import { cn } from '@/lib/utils';
import {
  BOX_STACK,
  type ClientMoveRequestDto,
  type HomeDetailDto,
  type MoveItemDto,
} from '@/types/homes';
import { NativeSelect } from './form-controls';
import { apiErrorMessage } from './home-schemas';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Floor m² one row takes (stackable items once per stack), one decimal. */
function rowFloorM2(item: MoveItemDto) {
  const units = item.footprint.stackable ? Math.ceil(item.quantity / BOX_STACK) : item.quantity;
  return Math.round((item.footprint.widthCm * item.footprint.depthCm * units) / 1000) / 10;
}

/**
 * ponytail: furniture usually covers ~30–40% of a room's floor; above 40% it
 * feels tight, above 60% it rarely fits. Rough guide only — step 3's layout
 * check is the real answer.
 */
function fitTone(percent: number) {
  if (percent > 60) return { label: 'Very tight', className: 'border-hazard bg-hazard text-white' };
  if (percent > 40) return { label: 'Tight', className: 'border-hazard text-hazard' };
  return { label: 'Comfortable', className: 'border-ink text-ink' };
}

/** "Moving in." — link one of the client's move requests and review its items. */
export function MoveRequestPanel({ home }: { home: HomeDetailDto }) {
  const [changing, setChanging] = useState(false);
  const updateHome = useUpdateHome(home.id);
  const linked = home.moveRequest;
  const showPicker = !home.moveReference || changing;

  const link = (reference: string | null) =>
    updateHome.mutate(
      { moveReference: reference },
      {
        onSuccess: () => {
          toast.success(reference ? `${reference} linked` : 'Move request unlinked');
          setChanging(false);
        },
        onError: (error) => toast.error(apiErrorMessage(error)),
      },
    );

  return (
    <section aria-labelledby="move-request-title" className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
        <div>
          <h2 id="move-request-title" className="display text-3xl md:text-4xl">
            Moving in.
          </h2>
          <p className="mt-2 text-sm text-ink-80">
            The items from your move request that are coming to this house.
          </p>
        </div>
        {home.moveReference && !changing && (
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
              <Link2 aria-hidden /> Change request
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={updateHome.isPending}
              onClick={() => link(null)}
            >
              <Link2Off aria-hidden /> Unlink
            </Button>
          </div>
        )}
      </div>

      {showPicker && (
        <RequestPicker
          homeId={home.id}
          current={home.moveReference}
          pending={updateHome.isPending}
          onLink={link}
          onCancel={changing ? () => setChanging(false) : undefined}
        />
      )}

      {home.moveReference && !linked && !changing && (
        <p
          role="alert"
          className="mono mt-6 border border-hazard bg-hazard/5 px-3 py-2 text-[11px] text-hazard"
        >
          {home.moveReference} is no longer available. Unlink it or choose another request.
        </p>
      )}

      {linked && !changing && <LinkedRequest home={home} />}
    </section>
  );
}

function RequestPicker({
  homeId,
  current,
  pending,
  onLink,
  onCancel,
}: {
  homeId: string;
  current: string | null;
  pending: boolean;
  onLink: (reference: string) => void;
  onCancel?: () => void;
}) {
  const { data: requests, isLoading, isError, error, refetch } = useClientMoveRequests();
  const usable = (request: ClientMoveRequestDto) =>
    !request.linkedHome || request.linkedHome.id === homeId;
  const firstFree = requests?.find((request) => usable(request) && request.reference !== current);
  const [selected, setSelected] = useState<string>('');
  const value = selected || firstFree?.reference || '';

  if (isLoading) {
    return (
      <div className="mt-6 h-24 animate-pulse bg-paper-soft motion-reduce:animate-none" aria-busy />
    );
  }

  if (isError) {
    return (
      <div role="alert" className="mt-6 border border-hazard bg-hazard/5 p-4">
        <p className="mono text-[11px] text-hazard">
          {apiErrorMessage(error, 'Could not load your move requests.')}
        </p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!requests?.length) {
    return (
      <div className="mt-6 flex flex-col items-center border border-ink px-6 py-12 text-center">
        <PackageOpen aria-hidden className="size-10 text-ink-40" />
        <p className="display mt-5 text-2xl">No move request yet.</p>
        <p className="mt-3 max-w-md text-sm text-ink-80">
          When you request a move, it appears here so its items can be placed in this house.
        </p>
      </div>
    );
  }

  return (
    <form
      className="mt-6 flex flex-col gap-4 border-2 border-ink p-5 md:flex-row md:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (value) onLink(value);
      }}
    >
      <div className="min-w-0 flex-1">
        <Label htmlFor="move-request-select">Move request</Label>
        <NativeSelect
          id="move-request-select"
          value={value}
          onChange={(event) => setSelected(event.target.value)}
        >
          {!value && <option value="">All your requests are linked to other houses</option>}
          {requests.map((request) => (
            <option
              key={request.reference}
              value={request.reference}
              disabled={!usable(request) || request.reference === current}
            >
              {request.reference} · {formatDate(request.moveDate)} · {request.itemCount} item
              {request.itemCount === 1 ? '' : 's'}
              {request.reference === current
                ? ' (linked here)'
                : request.linkedHome && !usable(request)
                  ? ` (linked to ${request.linkedHome.label})`
                  : ''}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={!value || pending}>
          {pending ? <Loader2 className="animate-spin" aria-label="Linking" /> : 'Link request'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

function LinkedRequest({ home }: { home: HomeDetailDto }) {
  const request = home.moveRequest!;
  const { totals } = request;
  const percent =
    home.totalAreaM2 > 0 ? Math.round((totals.floorM2 / home.totalAreaM2) * 100) : null;
  const tone = percent === null ? null : fitTone(percent);
  const hasStackable = request.items.some((item) => item.footprint.stackable);
  const hasEstimated = request.items.some((item) => item.footprint.source === 'estimated');

  return (
    <div className="mt-6 space-y-6">
      <p className="mono text-[11px] text-ink-80">
        <span className="text-hazard">{request.reference}</span> · {formatDate(request.moveDate)} ·{' '}
        {request.pickupAddress} → {request.destinationAddress}
      </p>

      <dl className="mono grid grid-cols-2 gap-px border border-ink bg-ink text-[10px] md:grid-cols-4">
        {[
          ['Items', String(totals.itemCount)],
          ['Volume', `${totals.volumeM3} m³`],
          ['Weight', `${totals.weightKg} kg`],
          ['Floor needed', `${totals.floorM2} m²`],
        ].map(([term, value]) => (
          <div key={term} className="bg-paper p-4">
            <dt className="text-ink-40">{term}</dt>
            <dd className="display mt-2 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>

      {percent === null || !tone ? (
        <p className="text-sm text-ink-80">
          Add rooms to compare these items with the floor space you will have.
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-3 text-sm text-ink-80">
          <span className={cn('mono border px-2 py-1 text-[10px]', tone.className)}>
            {tone.label}
          </span>
          Your items cover about {percent}% of the rooms&apos; floor ({totals.floorM2} of{' '}
          {home.totalAreaM2} m²).
        </p>
      )}

      <div className="overflow-x-auto border border-ink">
        <table className="mono w-full min-w-[560px] border-collapse text-left text-[11px]">
          <caption className="sr-only">Items coming to {home.label}</caption>
          <thead>
            <tr className="border-b border-ink text-[10px] text-ink-40">
              <th scope="col" className="px-3 py-2 font-normal">
                Item
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Qty
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Size each (W × D)
              </th>
              <th scope="col" className="px-3 py-2 text-right font-normal">
                Floor
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Size from
              </th>
            </tr>
          </thead>
          <tbody>
            {request.items.map((item) => (
              <tr key={item.id} className="border-b border-ink/15 last:border-b-0">
                <th
                  scope="row"
                  className="px-3 py-2 font-normal normal-case tracking-normal text-ink"
                >
                  {item.name}
                  {item.footprint.stackable && (
                    <span className="ml-2 text-ink-40">stacks of {BOX_STACK}</span>
                  )}
                </th>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-right">
                  {item.footprint.widthCm} × {item.footprint.depthCm} cm
                </td>
                <td className="px-3 py-2 text-right">{rowFloorM2(item)} m²</td>
                <td className="px-3 py-2">
                  {item.footprint.source === 'estimated' ? (
                    <span className="border border-hazard px-1.5 py-0.5 text-[10px] text-hazard">
                      Estimated
                    </span>
                  ) : (
                    <span className="text-ink-40">Catalogue</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasStackable || hasEstimated) && (
        <ul className="space-y-1 text-xs text-ink-80">
          {hasStackable && (
            <li>Moving boxes are counted in stacks of {BOX_STACK}, so they take less floor.</li>
          )}
          {hasEstimated && (
            <li>
              “Estimated” items are not in the catalogue: their size is worked out from their
              volume.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
