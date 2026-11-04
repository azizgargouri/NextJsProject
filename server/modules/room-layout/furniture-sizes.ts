/**
 * Floor footprint (top-down width × depth, cm) per catalogue item id.
 * Ids match the teammate's booking catalogue; anything else (e.g. items found
 * by their load scanner) gets a footprint estimated from its volume.
 */
export interface Footprint {
  widthCm: number;
  depthCm: number;
  /** Items that can be stacked (moving boxes) — counted in stacks of BOX_STACK. */
  stackable: boolean;
  source: 'catalogue' | 'estimated';
}

const CATALOGUE: Record<string, Pick<Footprint, 'widthCm' | 'depthCm'> & { stackable?: true }> = {
  box: { widthCm: 50, depthCm: 35, stackable: true },
  chair: { widthCm: 50, depthCm: 50 },
  sofa: { widthCm: 200, depthCm: 90 },
  bed: { widthCm: 160, depthCm: 200 },
  fridge: { widthCm: 60, depthCm: 65 },
  washer: { widthCm: 60, depthCm: 60 },
  table: { widthCm: 160, depthCm: 90 },
  wardrobe: { widthCm: 120, depthCm: 60 },
  desk: { widthCm: 120, depthCm: 60 },
  'tv-stand': { widthCm: 150, depthCm: 40 },
  bookshelf: { widthCm: 80, depthCm: 30 },
};

export const BOX_STACK = 3;

/**
 * ponytail: unknown items are treated as a 1 m tall square block (floor m² ≈ m³),
 * clamped to 30–250 cm per side. Upgrade path: per-category height or real
 * dimensions from the load scanner once it reports them.
 */
const ASSUMED_HEIGHT_M = 1;
const MIN_SIDE_CM = 30;
const MAX_SIDE_CM = 250;

export function footprintFor(item: { id: string; volume: number }): Footprint {
  const known = CATALOGUE[item.id];
  if (known) {
    return {
      widthCm: known.widthCm,
      depthCm: known.depthCm,
      stackable: known.stackable ?? false,
      source: 'catalogue',
    };
  }
  const areaM2 = Math.max(item.volume, 0) / ASSUMED_HEIGHT_M;
  const side = Math.round(Math.min(Math.max(Math.sqrt(areaM2) * 100, MIN_SIDE_CM), MAX_SIDE_CM));
  return { widthCm: side, depthCm: side, stackable: false, source: 'estimated' };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Totals for a list of items; stackable items take floor space once per stack. */
export function summarizeItems(
  items: { id: string; volume: number; weight: number; quantity: number }[],
) {
  let floorCm2 = 0;
  for (const item of items) {
    const footprint = footprintFor(item);
    const units = footprint.stackable ? Math.ceil(item.quantity / BOX_STACK) : item.quantity;
    floorCm2 += footprint.widthCm * footprint.depthCm * units;
  }
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    volumeM3: round1(items.reduce((sum, item) => sum + item.volume * item.quantity, 0)),
    weightKg: Math.round(items.reduce((sum, item) => sum + item.weight * item.quantity, 0)),
    floorM2: round1(floorCm2 / 10_000),
  };
}
