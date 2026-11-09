'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Camera, Check, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/field';
import {
  useAddJobPhoto,
  useConfirmLoad,
  useJobMessages,
  useJobPhotos,
  useMoverJob,
  useMoverJobs,
  useSendJobMessage,
  useUpdateJobStatus,
} from '@/hooks/content/mover';
import { cn } from '@/lib/utils';
import type {
  JobAction,
  JobDetailDto,
  MessageThread,
  MoveAddressDto,
  MoveAreaDto,
  MoverPhotoStage,
} from '@/types';
import {
  apiErrorMessage,
  EmptyState,
  ErrorState,
  formatDateTime,
  formatDay,
  formatMoney,
  JobRow,
  jobStatusLabel,
  LoadingState,
  Notice,
  PageTitle,
  Panel,
  SLOT_LABELS,
  Tag,
  TextInput,
} from './mover-ui';

export function JobsPortal() {
  const jobs = useMoverJobs();
  if (jobs.isPending) return <LoadingState label="Loading jobs" />;
  if (jobs.isError) return <ErrorState error={jobs.error} onRetry={() => void jobs.refetch()} />;

  return (
    <>
      <PageTitle title="Jobs" />
      {jobs.data.active.length === 0 ? (
        <Panel>
          <EmptyState title="No active jobs" body="Accepted offers become jobs here." />
        </Panel>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {jobs.data.active.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
      {jobs.data.past.length > 0 ? (
        <section className="mt-8">
          <h2 className="mono mb-3 text-[11px] font-bold">Past jobs</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {jobs.data.past.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

const STEPS: { action: JobAction; label: string; button: string }[] = [
  { action: 'EN_ROUTE', label: 'On the way', button: "I'm on the way" },
  { action: 'LOADING', label: 'Loading', button: 'Start loading' },
  { action: 'IN_TRANSIT', label: 'In transit', button: 'Loaded, leaving now' },
  { action: 'DELIVERED', label: 'Delivered', button: 'Mark as delivered' },
];

function isFullAddress(address: MoveAddressDto | MoveAreaDto): address is MoveAddressDto {
  return 'street' in address;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const boxCount = (count: number) => `${count} ${count === 1 ? 'box' : 'boxes'}`;

/** What is still missing before the next status button unlocks, if anything. */
function proofBlocker(job: JobDetailDto): string | null {
  const { proof, nextAction } = job;
  if (nextAction === 'IN_TRANSIT') {
    const missing = proof.minLoadPhotos - proof.loadPhotos;
    if (missing > 0) return `Add ${plural(missing, 'more photo')} of the loaded vehicle.`;
    if (!proof.loadCheck) return 'Confirm your load count to unlock this button.';
  }
  if (nextAction === 'DELIVERED' && proof.deliveryPhotos < proof.minDeliveryPhotos) {
    return 'Add a photo of everything delivered to unlock this button.';
  }
  return null;
}

function LoadCountForm({ job, onDone }: { job: JobDetailDto; onDone: () => void }) {
  const confirm = useConfirmLoad(job.id);
  const { proof } = job;
  const [boxes, setBoxes] = useState(proof.loadCheck ? String(proof.loadCheck.boxes) : '');
  const [furniture, setFurniture] = useState(
    proof.loadCheck ? String(proof.loadCheck.furniture) : '',
  );
  const [note, setNote] = useState(proof.loadCheck?.note ?? '');
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photosReady = proof.loadPhotos >= proof.minLoadPhotos;
  const { expectedLoad: expected } = proof;
  const counted = boxes !== '' && furniture !== '';
  const differs =
    expected !== null &&
    counted &&
    (Number(boxes) !== expected.boxes || Number(furniture) !== expected.furniture);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!counted)
      return setError('Enter the number of boxes and furniture. Use 0 if there are none.');
    if (!checked) return setError('Tick the box to confirm the photos and counts.');
    setError(null);
    confirm.mutate(
      {
        boxes: Number(boxes),
        furniture: Number(furniture),
        note: note.trim() || undefined,
        confirmed: true,
      },
      { onSuccess: onDone, onError: (saveError) => setError(apiErrorMessage(saveError)) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <h3 className="font-bold">Count what is loaded</h3>
      {expected ? (
        <p className="text-sm text-ink-80">
          The client listed {boxCount(expected.boxes)} and {plural(expected.furniture, 'piece')} of
          furniture.
        </p>
      ) : (
        <p className="text-sm text-ink-80">The client did not list individual items.</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="load-boxes">Boxes</Label>
          <TextInput
            id="load-boxes"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={boxes}
            onChange={(event) => setBoxes(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="load-furniture">Furniture</Label>
          <TextInput
            id="load-furniture"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={furniture}
            onChange={(event) => setFurniture(event.target.value)}
          />
        </div>
      </div>
      {differs ? (
        <Notice>
          Your count differs from the client&apos;s list. Check it, and explain why below.
        </Notice>
      ) : null}
      <div>
        <Label htmlFor="load-note">Note (optional)</Label>
        <TextInput
          id="load-note"
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          id="load-confirmed"
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-ink"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        I checked the photos, and these counts match what is on the vehicle.
      </label>
      {error ? (
        <p role="alert" className="text-sm text-hazard-dark">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={confirm.isPending || !photosReady}>
        {confirm.isPending ? 'Saving…' : 'Confirm load'}
      </Button>
    </form>
  );
}

/** The space opened by "Start loading": photos from several angles, then the mover's count. */
function LoadProof({ job }: { job: JobDetailDto }) {
  const { proof } = job;
  const [editing, setEditing] = useState(false);

  return (
    <div className="mt-4 flex flex-col gap-4 border-t border-ink pt-4">
      <div>
        <PhotoStage job={job} stage="LOAD" title="Photos of the loaded vehicle" open />
        <p className="mt-2 text-sm text-ink-80">
          Take at least {proof.minLoadPhotos} from different angles, so all the boxes and furniture
          can be seen. {proof.loadPhotos} of {proof.minLoadPhotos} added.
        </p>
      </div>
      <div className="border-t border-ink pt-4">
        {proof.loadCheck && !editing ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 font-bold">
                <Check className="size-4" aria-hidden /> Load confirmed
              </h3>
              <p className="text-sm">
                {boxCount(proof.loadCheck.boxes)}, {plural(proof.loadCheck.furniture, 'piece')} of
                furniture
              </p>
              {proof.loadCheck.note ? (
                <p className="text-sm text-ink-80">{proof.loadCheck.note}</p>
              ) : null}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
        ) : (
          <LoadCountForm job={job} onDone={() => setEditing(false)} />
        )}
      </div>
    </div>
  );
}

function StatusStepper({ job }: { job: JobDetailDto }) {
  const update = useUpdateJobStatus(job.id);
  const [confirming, setConfirming] = useState(false);
  const nextIndex = job.nextAction
    ? STEPS.findIndex((step) => step.action === job.nextAction)
    : ['DELIVERED', 'COMPLETED', 'DISPUTED'].includes(job.status)
      ? STEPS.length
      : -1;
  const next = STEPS[nextIndex];
  const blocker = proofBlocker(job);

  const send = (action: JobAction) => {
    setConfirming(false);
    update.mutate(action, {
      onError: (error) => toast.error(apiErrorMessage(error)),
    });
  };

  return (
    <Panel title="Progress">
      <ol className="flex flex-col gap-2">
        {STEPS.map((step, index) => {
          const done = nextIndex > index;
          return (
            <li key={step.action} className="flex items-center gap-3 text-sm">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center border border-ink',
                  done && 'bg-ink text-paper',
                )}
                aria-hidden
              >
                {done ? <Check className="size-4" /> : null}
              </span>
              <span className={cn(done && 'font-bold', nextIndex === index && 'font-bold')}>
                {step.label}
                <span className="sr-only">{done ? ' (done)' : ''}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {next?.action === 'IN_TRANSIT' ? <LoadProof job={job} /> : null}
      {next?.action === 'DELIVERED' ? (
        <div className="mt-4 border-t border-ink pt-4">
          <PhotoStage job={job} stage="DELIVERY" title="Photo of everything delivered" open />
        </div>
      ) : null}

      {next ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-ink pt-4">
          {next.action === 'DELIVERED' && confirming ? (
            <>
              <p className="text-sm">
                The client then has 48 hours to confirm or open a claim. This cannot be undone.
              </p>
              <Button size="lg" disabled={update.isPending} onClick={() => send('DELIVERED')}>
                Yes, goods are delivered
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
            </>
          ) : (
            <>
              <Button
                size="lg"
                className="w-full"
                disabled={update.isPending || blocker !== null}
                aria-describedby={blocker ? 'next-step-blocker' : undefined}
                onClick={() =>
                  next.action === 'DELIVERED' ? setConfirming(true) : send(next.action)
                }
              >
                {update.isPending ? 'Saving…' : next.button}
              </Button>
              {blocker ? (
                <p id="next-step-blocker" className="text-sm text-ink-80">
                  {blocker}
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {job.status === 'DELIVERED' ? (
        <p className="mt-4 border-t border-ink pt-4 text-sm text-ink-80">
          Waiting for the client to confirm. The job completes by itself after 48 hours without a
          claim.
        </p>
      ) : null}
    </Panel>
  );
}

function AddressBlock({
  label,
  address,
}: {
  label: string;
  address: MoveAddressDto | MoveAreaDto;
}) {
  const floor = address.floor === 0 ? 'Ground floor' : `Floor ${address.floor}`;
  return (
    <div>
      <p className="mono text-[10px] text-ink-80">{label}</p>
      {isFullAddress(address) ? (
        <>
          <p className="mt-1 font-bold">{address.street}</p>
          <p className="text-sm">
            {address.postalCode} {address.city}
          </p>
        </>
      ) : (
        <p className="mt-1 font-bold">{address.city}</p>
      )}
      <p className="text-sm text-ink-80">
        {floor}, {address.hasElevator ? 'elevator' : 'no elevator'}
      </p>
      {isFullAddress(address) && address.accessNotes ? (
        <p className="mt-1 text-sm">{address.accessNotes}</p>
      ) : null}
    </div>
  );
}

const THREADS: { thread: MessageThread; label: string; key: 'MOVER_CLIENT' | 'MOVER_SUPPORT' }[] = [
  { thread: 'MOVER_CLIENT', label: 'Client', key: 'MOVER_CLIENT' },
  { thread: 'MOVER_SUPPORT', label: 'Support', key: 'MOVER_SUPPORT' },
];

/** Item 8: one conversation each with the client and with support, inside the job page. */
function JobChat({ job }: { job: JobDetailDto }) {
  const [thread, setThread] = useState<MessageThread>('MOVER_CLIENT');
  const [draft, setDraft] = useState('');
  const messages = useJobMessages(job.id, thread, job.canChat);
  const send = useSendJobMessage(job.id, thread);
  const listRef = useRef<HTMLDivElement>(null);
  const count = messages.data?.length ?? 0;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [count, thread]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    send.mutate(body, {
      onSuccess: () => setDraft(''),
      onError: (error) => toast.error(apiErrorMessage(error)),
    });
  };

  const other = thread === 'MOVER_CLIENT' ? 'Client' : 'Support';

  return (
    <Panel title="Chat">
      <div
        role="tablist"
        aria-label="Conversation"
        className="grid grid-cols-2 gap-px border border-ink bg-ink"
      >
        {THREADS.map((entry) => {
          const unread = thread === entry.thread ? 0 : job.unread[entry.key];
          return (
            <button
              key={entry.thread}
              type="button"
              role="tab"
              aria-selected={thread === entry.thread}
              onClick={() => setThread(entry.thread)}
              className={cn(
                'mono min-h-11 px-3 text-[11px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-hazard',
                thread === entry.thread ? 'bg-ink text-paper' : 'bg-paper text-ink',
              )}
            >
              {entry.label}
              {unread > 0 ? ` (${unread})` : ''}
            </button>
          );
        })}
      </div>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${other}`}
        className="mt-3 flex max-h-80 min-h-32 flex-col gap-2 overflow-y-auto"
      >
        {messages.isPending ? (
          <LoadingState label="Loading messages" />
        ) : messages.isError ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : messages.data.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-80">No messages yet.</p>
        ) : (
          messages.data.map((message) => (
            <div
              key={message.id}
              className={cn(
                'max-w-[85%] border border-ink px-3 py-2 text-sm',
                message.mine ? 'self-end bg-ink text-paper' : 'self-start bg-paper',
              )}
            >
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              <p
                className={cn('mt-1 text-[11px]', message.mine ? 'text-paper-soft' : 'text-ink-80')}
              >
                {message.mine ? 'You' : other}, {formatDateTime(message.createdAt)}
              </p>
            </div>
          ))
        )}
      </div>

      {job.canChat ? (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1">
            <Label htmlFor="chat-message" className="sr-only">
              Message to {other}
            </Label>
            <TextInput
              id="chat-message"
              placeholder={`Message ${other.toLowerCase()}`}
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" className="h-12" disabled={send.isPending || !draft.trim()}>
            Send
          </Button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink-80">Chat is closed because this job has ended.</p>
      )}
    </Panel>
  );
}

function PhotoStage({
  job,
  stage,
  title,
  open,
}: {
  job: JobDetailDto;
  stage: MoverPhotoStage;
  title: string;
  open: boolean;
}) {
  const photos = useJobPhotos(job.id);
  const add = useAddJobPhoto(job.id);
  const items = (photos.data ?? []).filter((photo) => photo.stage === stage);
  const inputId = `photo-${stage}`;

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    for (const file of files) {
      add.mutate(
        { stage, file },
        {
          onSuccess: () => toast.success('Photo added'),
          onError: (error) => toast.error(apiErrorMessage(error)),
        },
      );
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        {open ? (
          <label
            htmlFor={inputId}
            className="mono inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap border-2 border-ink px-3 text-[11px] hover:bg-ink hover:text-paper focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hazard"
          >
            <Camera className="size-4" aria-hidden />
            {add.isPending ? 'Uploading…' : 'Add photo'}
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              className="sr-only"
              onChange={onFile}
              disabled={add.isPending}
            />
          </label>
        ) : null}
      </div>
      {photos.isError ? (
        <ErrorState error={photos.error} onRetry={() => void photos.refetch()} />
      ) : items.length === 0 ? (
        <p className="mt-2 text-sm text-ink-80">
          {open ? 'No photos yet.' : 'No photos added at this stage.'}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-4">
          {items.map((photo) => (
            <a
              key={photo.id}
              href={photo.url}
              target="_blank"
              rel="noreferrer"
              className="block border border-ink"
            >
              {/* Signed private URLs, so next/image optimisation does not apply. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`${title}, added ${formatDateTime(photo.createdAt)}`}
                className="aspect-square w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Item 9: proof of the goods' condition. */
function JobPhotos({ job }: { job: JobDetailDto }) {
  const pickupOpen = job.status === 'EN_ROUTE' || job.status === 'IN_PROGRESS';
  return (
    <Panel title="Proof photos">
      <div className="flex flex-col gap-5">
        <PhotoStage job={job} stage="PICKUP" title="At pickup" open={pickupOpen} />
        <div className="border-t border-ink pt-4">
          <PhotoStage job={job} stage="LOAD" title="Loaded vehicle" open={false} />
        </div>
        <div className="border-t border-ink pt-4">
          <PhotoStage
            job={job}
            stage="DELIVERY"
            title="At delivery"
            open={job.status === 'DELIVERED'}
          />
        </div>
      </div>
    </Panel>
  );
}

/** Item 7: the job page a mover works from on the road. */
export function JobDetail({ id }: { id: string }) {
  const job = useMoverJob(id);
  if (job.isPending) return <LoadingState label="Loading job" />;
  if (job.isError) return <ErrorState error={job.error} onRetry={() => void job.refetch()} />;
  const data = job.data;

  return (
    <>
      <Link
        href="/mover/jobs"
        className="mb-4 inline-flex items-center gap-1 text-sm underline-offset-2 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> All jobs
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <p className="mono text-[10px] text-ink-80">{data.reference}</p>
        <Tag tone="solid">{jobStatusLabel(data.status, data.progressStage)}</Tag>
      </div>
      <h1 className="display mt-2 text-3xl md:text-4xl">
        {data.pickupCity} to {data.dropoffCity}
      </h1>
      <p className="mt-2 text-sm text-ink-80">
        {formatDay(data.moveDate)}, {SLOT_LABELS[data.timeSlot].toLowerCase()}
        {data.finalPrice !== null ? `. Price: ${formatMoney(data.finalPrice)}` : ''}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-6">
          {!['CANCELLED', 'REFUNDED'].includes(data.status) ? <StatusStepper job={data} /> : null}

          <Panel title="Client">
            {data.client ? (
              <>
                <p className="font-bold">{data.client.name}</p>
                <a
                  href={`tel:${data.client.phone}`}
                  className={cn(
                    'mono mt-3 inline-flex h-11 items-center gap-2 border-2 border-ink px-4 text-[12px] tracking-normal hover:bg-ink hover:text-paper',
                  )}
                >
                  <Phone className="size-4" aria-hidden />
                  {data.client.phone}
                </a>
              </>
            ) : (
              <p className="text-sm text-ink-80">
                Client contact details are no longer shown because this job has ended.
              </p>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Addresses">
            <div className="grid gap-4 sm:grid-cols-2">
              <AddressBlock label="Pickup" address={data.pickup} />
              <AddressBlock label="Destination" address={data.dropoff} />
            </div>
            {data.notes ? (
              <p className="mt-4 border-t border-ink pt-3 text-sm">
                <span className="text-ink-80">Client notes: </span>
                {data.notes}
              </p>
            ) : null}
          </Panel>

          <Panel title="What to move">
            <p className="text-sm">
              {data.volumeM3} m³{data.housingType ? `, ${data.housingType}` : ''}
              {data.sizeRooms ? `, ${data.sizeRooms} rooms` : ''}
            </p>
            {data.items.length > 0 ? (
              <ul className="mt-2 divide-y divide-ink/20">
                {data.items.map((item) => (
                  <li
                    key={`${item.name}-${item.category}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {item.quantity} x {item.name}
                    </span>
                    <span className="flex gap-1">
                      {item.isFragile ? <Tag tone="alert">Fragile</Tag> : null}
                      {item.needsDisassembly ? <Tag>Disassembly</Tag> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {data.extraServices.length > 0 ? (
              <p className="mt-3 border-t border-ink pt-3 text-sm">
                <span className="text-ink-80">Extra services: </span>
                {data.extraServices.join(', ').toLowerCase()}
              </p>
            ) : null}
          </Panel>

          <JobChat job={data} />
          <JobPhotos job={data} />

          <Panel title="History">
            <ol className="flex flex-col gap-2 text-sm">
              {data.timeline.map((event) => (
                <li key={event.id} className="flex flex-wrap justify-between gap-x-4">
                  <span>
                    {event.note || jobStatusLabel(event.toStatus as JobDetailDto['status'])}
                  </span>
                  <span className="text-ink-80">{formatDateTime(event.createdAt)}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}
