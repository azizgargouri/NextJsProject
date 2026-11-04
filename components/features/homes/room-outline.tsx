import type { ReactNode } from 'react';
import type { OpeningDto, Wall } from '@/types/homes';
import { cn } from '@/lib/utils';

type Opening = Pick<OpeningDto, 'kind' | 'wall' | 'offsetCm' | 'widthCm'>;
type Vec = [number, number];

interface RoomOutlineProps {
  widthCm: number;
  lengthCm: number;
  openings: Opening[];
  label: string;
  className?: string;
  /** Extra shapes drawn in room coordinates (cm, origin = north-west corner). */
  children?: ReactNode;
}

/** Where a wall starts, which way it runs, and which way points into the room. */
function wallGeometry(wall: Wall, width: number, length: number, offset: number) {
  switch (wall) {
    case 'N':
      return {
        start: [offset, 0] as Vec,
        along: [1, 0] as Vec,
        inward: [0, 1] as Vec,
        length: width,
      };
    case 'S':
      return {
        start: [offset, length] as Vec,
        along: [1, 0] as Vec,
        inward: [0, -1] as Vec,
        length: width,
      };
    case 'W':
      return { start: [0, offset] as Vec, along: [0, 1] as Vec, inward: [1, 0] as Vec, length };
    case 'E':
      return {
        start: [width, offset] as Vec,
        along: [0, 1] as Vec,
        inward: [-1, 0] as Vec,
        length,
      };
  }
}

const safe = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

/**
 * Top-down room drawing to scale (1 SVG unit = 1 cm). Doors cut the wall and
 * show their swing in hazard red; windows use the architectural double line.
 */
export function RoomOutline({
  widthCm,
  lengthCm,
  openings,
  label,
  className,
  children,
}: RoomOutlineProps) {
  const width = safe(widthCm, 100);
  const length = safe(lengthCm, 100);
  const size = Math.max(width, length);
  const wall = Math.min(Math.max(size * 0.025, 6), 25);
  const pad = size * 0.14;
  const fontSize = size * 0.05;

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${width + pad * 2} ${length + pad * 2}`}
      role="img"
      aria-label={label}
      className={cn('block h-full w-full', className)}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={length}
        fill="var(--color-paper-soft)"
        stroke="var(--color-ink)"
        strokeWidth={wall}
      />
      {children}
      {openings.map((opening, index) => {
        const wallLength = opening.wall === 'N' || opening.wall === 'S' ? width : length;
        const offset = Number.isFinite(opening.offsetCm)
          ? Math.min(Math.max(opening.offsetCm, 0), wallLength)
          : 0;
        const span = Math.min(safe(opening.widthCm, 1), wallLength - offset);
        if (span <= 0) return null;
        const { start, along, inward } = wallGeometry(opening.wall, width, length, offset);
        const end: Vec = [start[0] + along[0] * span, start[1] + along[1] * span];
        const cut = (
          <line
            x1={start[0]}
            y1={start[1]}
            x2={end[0]}
            y2={end[1]}
            stroke="var(--color-paper)"
            strokeWidth={wall * 1.3}
          />
        );

        if (opening.kind === 'WINDOW') {
          return (
            <g key={index}>
              {cut}
              <line
                x1={start[0]}
                y1={start[1]}
                x2={end[0]}
                y2={end[1]}
                stroke="var(--color-ink)"
                strokeWidth={wall}
              />
              <line
                x1={start[0]}
                y1={start[1]}
                x2={end[0]}
                y2={end[1]}
                stroke="var(--color-paper)"
                strokeWidth={wall * 0.45}
              />
            </g>
          );
        }

        const leaf: Vec = [start[0] + inward[0] * span, start[1] + inward[1] * span];
        const sweep = along[0] * inward[1] - along[1] * inward[0] > 0 ? 1 : 0;
        return (
          <g key={index} stroke="var(--color-hazard)" fill="none">
            {cut}
            <line x1={start[0]} y1={start[1]} x2={leaf[0]} y2={leaf[1]} strokeWidth={wall * 0.4} />
            <path
              d={`M ${end[0]} ${end[1]} A ${span} ${span} 0 0 ${sweep} ${leaf[0]} ${leaf[1]}`}
              strokeWidth={wall * 0.2}
              strokeDasharray={`${wall * 0.8} ${wall * 0.6}`}
            />
          </g>
        );
      })}
      <g className="mono" fill="var(--color-ink-80)" fontSize={fontSize}>
        <text x={width / 2} y={-pad * 0.38} textAnchor="middle">
          {width} cm
        </text>
        <text transform={`translate(${-pad * 0.38} ${length / 2}) rotate(-90)`} textAnchor="middle">
          {length} cm
        </text>
        <text x={width + pad * 0.5} y={-pad * 0.38} textAnchor="middle" fill="var(--color-hazard)">
          N↑
        </text>
      </g>
    </svg>
  );
}
