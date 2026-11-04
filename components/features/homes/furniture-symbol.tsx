import type { LayoutPlacementDto, PlacementWall, Wall } from '@/types/homes';

const TURNED: Record<PlacementWall, Wall> = { N: 'W', E: 'N', S: 'E', W: 'S', CENTER: 'W' };

/**
 * Top-down furniture drawing inside a placed item's rectangle (room cm units).
 * Each symbol is drawn in a local frame — `along` (x) by `depth` (y) with the
 * item's BACK at y = 0 — then turned so the back faces the wall it stands on.
 * Unknown items draw nothing extra (the plain rectangle stays).
 */
export function FurnitureSymbol({
  placement,
  stroke,
}: {
  placement: Pick<LayoutPlacementDto, 'itemId' | 'wall' | 'rotated' | 'x' | 'y' | 'w' | 'h'>;
  stroke: number;
}) {
  const { x, y, w, h } = placement;
  // A turned item's back faces the next wall round (e.g. a turned bed's headboard
  // is on its short end, not along the wall it stands against).
  const facing = placement.rotated
    ? TURNED[placement.wall]
    : placement.wall === 'CENTER'
      ? 'N'
      : placement.wall;
  const sideways = facing === 'W' || facing === 'E';
  const along = sideways ? h : w;
  const depth = sideways ? w : h;
  const transform =
    facing === 'S'
      ? `translate(${x + w} ${y + h}) rotate(180)`
      : facing === 'W'
        ? `translate(${x} ${y + h}) rotate(-90)`
        : facing === 'E'
          ? `translate(${x + w} ${y}) rotate(90)`
          : `translate(${x} ${y})`;

  const details = drawDetails(placement.itemId, along, depth, stroke);
  if (!details) return null;
  return (
    <g
      transform={transform}
      fill="none"
      stroke="var(--color-ink)"
      strokeWidth={stroke * 0.6}
      pointerEvents="none"
      aria-hidden
    >
      {details}
    </g>
  );
}

function drawDetails(itemId: string, L: number, D: number, stroke: number) {
  const m = Math.min(L, D) * 0.08;
  switch (itemId) {
    case 'bed': {
      const pillowH = D * 0.14;
      const two = L >= 120;
      const pillowW = two ? (L - 3 * m) / 2 : L - 2 * m;
      return (
        <>
          <rect
            x={m}
            y={m}
            width={pillowW}
            height={pillowH}
            rx={pillowH * 0.3}
            fill="var(--color-paper-soft)"
          />
          {two && (
            <rect
              x={2 * m + pillowW}
              y={m}
              width={pillowW}
              height={pillowH}
              rx={pillowH * 0.3}
              fill="var(--color-paper-soft)"
            />
          )}
          <line x1={0} y1={D * 0.32} x2={L} y2={D * 0.32} />
          <line x1={0} y1={D * 0.38} x2={L} y2={D * 0.38} />
        </>
      );
    }
    case 'sofa': {
      const back = D * 0.26;
      const arm = L * 0.09;
      const seats = L >= 180 ? 3 : 2;
      const seatW = (L - 2 * arm) / seats;
      return (
        <>
          <rect x={0} y={0} width={L} height={back} />
          <rect x={0} y={back} width={arm} height={D - back} />
          <rect x={L - arm} y={back} width={arm} height={D - back} />
          {Array.from({ length: seats - 1 }, (_, index) => (
            <line
              key={index}
              x1={arm + seatW * (index + 1)}
              y1={back}
              x2={arm + seatW * (index + 1)}
              y2={D}
            />
          ))}
        </>
      );
    }
    case 'chair':
      return (
        <>
          <rect x={0} y={0} width={L} height={D * 0.22} />
          <rect x={m} y={D * 0.22 + m} width={L - 2 * m} height={D * 0.78 - 2 * m} />
        </>
      );
    case 'table':
      return <rect x={m} y={m} width={L - 2 * m} height={D - 2 * m} />;
    case 'desk':
      return <rect x={L * 0.7} y={m} width={L * 0.3 - m} height={D - 2 * m} />;
    case 'fridge':
      return (
        <>
          <line x1={0} y1={D * 0.85} x2={L} y2={D * 0.85} />
          <line x1={L * 0.65} y1={D * 0.93} x2={L * 0.9} y2={D * 0.93} strokeWidth={stroke * 1.2} />
        </>
      );
    case 'washer': {
      const r = Math.min(L, D) * 0.3;
      return (
        <>
          <circle cx={L / 2} cy={D * 0.55} r={r} />
          <circle cx={L / 2} cy={D * 0.55} r={r * 0.55} />
        </>
      );
    }
    case 'wardrobe':
      return (
        <>
          <line
            x1={m}
            y1={D * 0.45}
            x2={L - m}
            y2={D * 0.45}
            strokeDasharray={`${stroke * 3} ${stroke * 2}`}
          />
          <line x1={0} y1={D * 0.88} x2={L} y2={D * 0.88} />
          <line x1={L / 2} y1={D * 0.88} x2={L / 2} y2={D} />
        </>
      );
    case 'bookshelf':
      return (
        <>
          <line x1={L / 3} y1={0} x2={L / 3} y2={D} />
          <line x1={(2 * L) / 3} y1={0} x2={(2 * L) / 3} y2={D} />
        </>
      );
    case 'tv-stand':
      return (
        <rect
          x={L * 0.15}
          y={D * 0.15}
          width={L * 0.7}
          height={D * 0.2}
          fill="var(--color-ink)"
          stroke="none"
        />
      );
    case 'box':
      return (
        <>
          <line x1={m} y1={m} x2={L - m} y2={D - m} />
          <line x1={L - m} y1={m} x2={m} y2={D - m} />
        </>
      );
    default:
      return null;
  }
}
