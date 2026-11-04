'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toast } from 'sonner';
import { useUpdateLayoutItem } from '@/hooks/content/homes';
import type { LayoutPlacementDto, LayoutPlanDto, RoomDto } from '@/types/homes';
import { apiErrorMessage } from './home-schemas';
import { snapRect, spotProblem, type Rect } from './layout-geometry';

export interface DragTarget {
  roomId: string;
  rect: Rect;
  /** null = free spot (green); otherwise why it does not fit (red). */
  problem: string | null;
}

export interface DragState {
  unitId: string;
  itemId: string;
  name: string;
  /** Current footprint in cm (R swaps them). */
  w: number;
  h: number;
  /** Where the pointer holds the item, in cm from its top-left corner. */
  grabX: number;
  grabY: number;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  /** False until the pointer travels a few pixels: a plain click selects instead. */
  moved: boolean;
  target: DragTarget | null;
}

const DRAG_THRESHOLD_PX = 4;

/** Client px → room cm, through the drawing's own viewBox transform. */
function roomPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const matrix = svg.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

function roomDrawingAt(clientX: number, clientY: number): SVGSVGElement | null {
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    const svg = element.closest('svg[data-layout-room]');
    if (svg) return svg as SVGSVGElement;
  }
  return null;
}

/**
 * Drag an item inside or between room drawings. While dragging, the target
 * spot is snapped and checked with the server's rules (green = free, red =
 * not allowed); dropping on a free spot saves it with `action: 'place'`.
 */
export function useLayoutDrag({
  homeId,
  plan,
  rooms,
}: {
  homeId: string;
  plan: LayoutPlanDto;
  rooms: RoomDto[];
}) {
  const update = useUpdateLayoutItem(homeId);
  const [drag, setDragState] = useState<DragState | null>(null);
  const [dropping, setDropping] = useState<(DragTarget & { unitId: string }) | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** True right after a real drag: the click that follows the release is not a selection. */
  const draggedRef = useRef(false);
  const latest = useRef({ plan, rooms, mutate: update.mutate });
  latest.current = { plan, rooms, mutate: update.mutate };

  const setDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDragState(next);
  };

  const active = drag !== null;

  useEffect(() => {
    if (!active) return;

    const evaluate = (state: DragState, clientX: number, clientY: number): DragTarget | null => {
      const svg = roomDrawingAt(clientX, clientY);
      const room = latest.current.rooms.find(
        (candidate) => candidate.id === svg?.dataset.layoutRoom,
      );
      const point = svg && room ? roomPoint(svg, clientX, clientY) : null;
      if (!room || !point) return null;
      const rect = snapRect(room, {
        x: point.x - state.grabX,
        y: point.y - state.grabY,
        w: state.w,
        h: state.h,
      });
      const others = latest.current.plan.placements
        .filter((placement) => placement.roomId === room.id && placement.unitId !== state.unitId)
        .map(({ name, x, y, w, h }) => ({ name, rect: { x, y, w, h } }));
      return { roomId: room.id, rect, problem: spotProblem(room, state.itemId, rect, others) };
    };

    const finish = (state: DragState) => {
      if (!state.target) {
        toast(`Drop ${state.name} inside one of the room drawings.`);
        return;
      }
      if (state.target.problem) {
        toast.error(`${state.name} can't go there: ${state.target.problem}`);
        return;
      }
      const { roomId, rect } = state.target;
      setDropping({ unitId: state.unitId, roomId, rect, problem: null });
      latest.current.mutate(
        { action: 'place', unitId: state.unitId, roomId, ...rect },
        {
          onSuccess: () => toast.success(`${state.name} placed`),
          onError: (error) => toast.error(apiErrorMessage(error)),
          onSettled: () => setDropping(null),
        },
      );
    };

    const onMove = (event: PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      const travelled = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (!state.moved && travelled < DRAG_THRESHOLD_PX) return;
      event.preventDefault();
      setDrag({
        ...state,
        moved: true,
        lastX: event.clientX,
        lastY: event.clientY,
        target: evaluate(state, event.clientX, event.clientY),
      });
    };

    const onUp = () => {
      const state = dragRef.current;
      setDrag(null);
      if (!state) return;
      if (state.moved) {
        // Swallow only the click the browser fires right after this release.
        draggedRef.current = true;
        window.setTimeout(() => (draggedRef.current = false), 0);
        finish(state);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      const state = dragRef.current;
      if (!state?.moved) return;
      if (event.key === 'Escape') {
        setDrag(null);
        toast('Move cancelled');
      } else if (event.key === 'r' || event.key === 'R') {
        const turned = { ...state, w: state.h, h: state.w, grabX: state.h / 2, grabY: state.w / 2 };
        setDrag({ ...turned, target: evaluate(turned, state.lastX, state.lastY) });
      }
    };

    const cancel = () => setDrag(null);

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey);
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey);
      document.body.style.userSelect = '';
    };
  }, [active]);

  const begin = (
    event: ReactPointerEvent<Element>,
    item: { unitId: string; itemId: string; name: string; w: number; h: number },
    grab: { x: number; y: number },
  ) => {
    if (event.button !== 0 || update.isPending) return;
    draggedRef.current = false;
    setDrag({
      ...item,
      grabX: grab.x,
      grabY: grab.y,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      moved: false,
      target: null,
    });
  };

  /** Pointer down on a placed item inside a room drawing. */
  const startFromPlacement = (
    event: ReactPointerEvent<SVGGElement>,
    placement: LayoutPlacementDto,
  ) => {
    const svg = event.currentTarget.ownerSVGElement;
    const point = svg ? roomPoint(svg, event.clientX, event.clientY) : null;
    if (!point) return;
    begin(event, placement, { x: point.x - placement.x, y: point.y - placement.y });
  };

  /** Pointer down on an item that is not in the layout (held by its centre). */
  const startFromList = (
    event: ReactPointerEvent<HTMLElement>,
    unit: { unitId: string; itemId: string; name: string },
    footprint: { widthCm: number; depthCm: number },
  ) =>
    begin(
      event,
      { ...unit, w: footprint.widthCm, h: footprint.depthCm },
      { x: footprint.widthCm / 2, y: footprint.depthCm / 2 },
    );

  /** Use in onClick: false when the click only ended a drag (then do not select). */
  const isClick = () => {
    const wasDrag = draggedRef.current;
    draggedRef.current = false;
    return !wasDrag;
  };

  return {
    drag: drag?.moved ? drag : null,
    isClick,
    dropping,
    startFromPlacement,
    startFromList,
    busy: update.isPending,
  };
}
