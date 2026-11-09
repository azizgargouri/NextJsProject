'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  useAddRoom,
  useDeleteHome,
  useHome,
  useRemoveRoom,
  useUpdateHome,
  useUpdateRoom,
} from '@/hooks/content/homes';
import { HOME_LIMITS, type HomeDetailDto, type RoomDto } from '@/types/homes';
import { ConfirmDialog } from './confirm-dialog';
import { HomeForm } from './home-form';
import { apiErrorMessage, HOME_TYPE_LABELS, ROOM_TYPE_LABELS } from './home-schemas';
import { HomesPageHeader } from './homes-page-header';
import { LayoutPanel } from './layout-panel';
import { MoveRequestPanel } from './move-request-panel';
import { RoomForm } from './room-form';
import { RoomOutline } from './room-outline';

type RoomEditor = { mode: 'add' } | { mode: 'edit'; room: RoomDto } | null;
type PendingDelete = { kind: 'home' } | { kind: 'room'; room: RoomDto } | null;

const TRAIL_ROOT = [
  { label: 'Workspace', href: '/dashboard' },
  { label: 'New houses', href: '/dashboard/homes' },
];

/** /dashboard/homes/[id] — house details + full rooms CRUD. */
export function HomeDetailPortal({ homeId }: { homeId: string }) {
  const { data: home, isLoading, isError, error, refetch } = useHome(homeId);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6" aria-busy>
        <div className="h-3 w-40 animate-pulse bg-paper-soft motion-reduce:animate-none" />
        <div className="mt-8 h-14 w-2/3 animate-pulse bg-paper-soft motion-reduce:animate-none" />
        <div className="mt-12 h-64 animate-pulse bg-paper-soft motion-reduce:animate-none" />
      </main>
    );
  }

  if (isError || !home) {
    const notFound = isAxiosError(error) && [400, 404].includes(error.response?.status ?? 0);
    return (
      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <HomesPageHeader
          trail={[...TRAIL_ROOT, { label: 'Error' }]}
          title={notFound ? 'Not found.' : 'Error.'}
        />
        <div role="alert" className="mt-8 border border-hazard bg-hazard/5 p-6">
          <p className="mono text-[11px] text-hazard">
            {notFound ? 'This house does not exist or was deleted.' : apiErrorMessage(error)}
          </p>
          <div className="mt-4 flex gap-3">
            {!notFound && (
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            )}
            <Link
              href="/dashboard/homes"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Back to my houses
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return <HomeDetail home={home} />;
}

function HomeDetail({ home }: { home: HomeDetailDto }) {
  const router = useRouter();
  const [editingHome, setEditingHome] = useState(false);
  const [roomEditor, setRoomEditor] = useState<RoomEditor>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const updateHome = useUpdateHome(home.id);
  const deleteHome = useDeleteHome(home.id);
  const addRoom = useAddRoom(home.id);
  const updateRoom = useUpdateRoom(home.id);
  const removeRoom = useRemoveRoom(home.id);

  const roomMutation = roomEditor?.mode === 'edit' ? updateRoom : addRoom;
  const atRoomLimit = home.rooms.length >= HOME_LIMITS.roomsPerHome;

  const confirmDelete = () => {
    if (pendingDelete?.kind === 'home') {
      deleteHome.mutate(undefined, {
        onSuccess: () => {
          toast.success(`“${home.label}” deleted`);
          router.replace('/dashboard/homes');
        },
        onError: (error) => toast.error(apiErrorMessage(error)),
      });
    } else if (pendingDelete?.kind === 'room') {
      const { room } = pendingDelete;
      removeRoom.mutate(room.id, {
        onSuccess: () => {
          toast.success(`${room.name} removed`);
          setPendingDelete(null);
          if (roomEditor?.mode === 'edit' && roomEditor.room.id === room.id) setRoomEditor(null);
        },
        onError: (error) => toast.error(apiErrorMessage(error)),
      });
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <HomesPageHeader
        trail={[...TRAIL_ROOT, { label: home.label }]}
        title={home.label}
        description={
          <span className="mono text-[11px]">
            {HOME_TYPE_LABELS[home.type]} · {home.city} · Floor {home.floor} ·{' '}
            {home.hasElevator ? 'Elevator' : 'No elevator'}
          </span>
        }
        actions={
          !editingHome && (
            <>
              <Button variant="outline" onClick={() => setEditingHome(true)}>
                <Pencil aria-hidden /> Edit house
              </Button>
              <Button variant="ghost" onClick={() => setPendingDelete({ kind: 'home' })}>
                <Trash2 aria-hidden /> Delete
              </Button>
            </>
          )
        }
      />

      {editingHome && (
        <section aria-label="Edit house" className="mt-8 border-2 border-ink p-5 md:p-8">
          <p className="mono mb-6 text-[10px] text-hazard">Edit house</p>
          <HomeForm
            defaultValues={{
              label: home.label,
              city: home.city,
              type: home.type,
              floor: home.floor,
              hasElevator: home.hasElevator,
              notes: home.notes,
            }}
            submitLabel="Save changes"
            pending={updateHome.isPending}
            error={updateHome.error}
            onCancel={() => {
              updateHome.reset();
              setEditingHome(false);
            }}
            onSubmit={(values) =>
              updateHome.mutate(values, {
                onSuccess: () => {
                  toast.success('House updated');
                  setEditingHome(false);
                },
              })
            }
          />
        </section>
      )}

      <dl className="mono mt-8 grid grid-cols-2 gap-px border border-ink bg-ink text-[10px] md:grid-cols-4">
        {[
          ['Rooms', `${home.rooms.length} / ${HOME_LIMITS.roomsPerHome}`],
          ['Total area', `${home.totalAreaM2} m²`],
          [
            'Doors',
            String(
              home.rooms.flatMap((room) => room.openings).filter((o) => o.kind === 'DOOR').length,
            ),
          ],
          [
            'Windows',
            String(
              home.rooms.flatMap((room) => room.openings).filter((o) => o.kind === 'WINDOW').length,
            ),
          ],
        ].map(([term, value]) => (
          <div key={term} className="bg-paper p-4">
            <dt className="text-ink-40">{term}</dt>
            <dd className="display mt-2 text-2xl">{value}</dd>
          </div>
        ))}
      </dl>
      {home.notes && <p className="mt-6 max-w-3xl text-sm text-ink-80">{home.notes}</p>}

      <MoveRequestPanel home={home} />

      <section aria-labelledby="rooms-title" className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
          <h2 id="rooms-title" className="display text-3xl md:text-4xl">
            Rooms.
          </h2>
          {!roomEditor && (
            <Button onClick={() => setRoomEditor({ mode: 'add' })} disabled={atRoomLimit}>
              <Plus aria-hidden /> {atRoomLimit ? 'Room limit reached' : 'Add room'}
            </Button>
          )}
        </div>

        {roomEditor && (
          <div className="mt-6">
            <RoomForm
              key={roomEditor.mode === 'edit' ? roomEditor.room.id : 'new'}
              title={roomEditor.mode === 'edit' ? `Edit ${roomEditor.room.name}` : 'New room'}
              submitLabel={roomEditor.mode === 'edit' ? 'Save room' : 'Add room'}
              defaultValues={
                roomEditor.mode === 'edit'
                  ? {
                      name: roomEditor.room.name,
                      type: roomEditor.room.type,
                      widthCm: roomEditor.room.widthCm,
                      lengthCm: roomEditor.room.lengthCm,
                      notes: roomEditor.room.notes,
                      openings: roomEditor.room.openings.map(
                        ({ kind, wall, offsetCm, widthCm }) => ({
                          kind,
                          wall,
                          offsetCm,
                          widthCm,
                        }),
                      ),
                    }
                  : undefined
              }
              pending={roomMutation.isPending}
              error={roomMutation.error}
              onCancel={() => {
                addRoom.reset();
                updateRoom.reset();
                setRoomEditor(null);
              }}
              onSubmit={(payload) => {
                const done = () => {
                  toast.success(
                    roomEditor.mode === 'edit' ? 'Room saved' : `${payload.name} added`,
                  );
                  setRoomEditor(null);
                };
                if (roomEditor.mode === 'edit') {
                  updateRoom.mutate({ roomId: roomEditor.room.id, payload }, { onSuccess: done });
                } else {
                  addRoom.mutate(payload, { onSuccess: done });
                }
              }}
            />
          </div>
        )}

        {home.rooms.length === 0 && !roomEditor ? (
          <div className="mt-6 flex flex-col items-center border border-ink px-6 py-14 text-center">
            <LayoutGrid aria-hidden className="size-10 text-ink-40" />
            <p className="display mt-6 text-2xl">No rooms yet.</p>
            <p className="mt-3 max-w-md text-sm text-ink-80">
              Add each room with its size, doors and windows. The layout assistant needs them to
              place your items.
            </p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 pt-px pl-px sm:grid-cols-2 lg:grid-cols-3">
            {home.rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onEdit={() => setRoomEditor({ mode: 'edit', room })}
                onDelete={() => setPendingDelete({ kind: 'room', room })}
              />
            ))}
          </ul>
        )}
      </section>

      <LayoutPanel home={home} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete?.kind === 'room'
            ? `Remove ${pendingDelete.room.name}?`
            : 'Delete this house?'
        }
        description={
          pendingDelete?.kind === 'room'
            ? 'The room, its doors and its windows will be removed from this house.'
            : `“${home.label}” and its ${home.rooms.length} room(s) will no longer appear in your workspace.`
        }
        confirmLabel={pendingDelete?.kind === 'room' ? 'Remove room' : 'Delete house'}
        pending={deleteHome.isPending || removeRoom.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </main>
  );
}

function RoomCard({
  room,
  onEdit,
  onDelete,
}: {
  room: RoomDto;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const doors = room.openings.filter((opening) => opening.kind === 'DOOR').length;
  const windows = room.openings.length - doors;
  const area = Math.round((room.widthCm * room.lengthCm) / 1000) / 10;

  return (
    <li className="-mt-px -ml-px flex flex-col border border-ink bg-paper p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono text-[10px] text-ink-40">{ROOM_TYPE_LABELS[room.type]}</p>
          <h3 className="display mt-2 break-words text-2xl">{room.name}</h3>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={`Edit ${room.name}`} onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${room.name}`} onClick={onDelete}>
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      <div className="mt-4 aspect-[4/3] border border-ink/20 p-2">
        <RoomOutline
          widthCm={room.widthCm}
          lengthCm={room.lengthCm}
          openings={room.openings}
          label={`${room.name}: ${room.widthCm} by ${room.lengthCm} cm, ${doors} door(s), ${windows} window(s)`}
        />
      </div>
      <p className="mono mt-4 text-[10px] text-ink-80">
        {room.widthCm} × {room.lengthCm} cm · {area} m² · {doors} door{doors === 1 ? '' : 's'} ·{' '}
        {windows} window{windows === 1 ? '' : 's'}
      </p>
      {room.notes && <p className="mt-2 text-xs text-ink-80">{room.notes}</p>}
    </li>
  );
}
