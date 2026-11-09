/**
 * The physical pieces of a move request, as Smart Room Layout places them:
 * one unit per piece of furniture, moving boxes grouped in stacks. Shared by
 * the server (planning) and the house page (choosing a room per piece), so a
 * `unitId` means the same piece on both sides.
 */
export interface LayoutSourceItem {
  id: string;
  name: string;
  quantity: number;
  footprint: { widthCm: number; depthCm: number; stackable: boolean };
}

export interface LayoutUnit {
  unitId: string;
  itemId: string;
  name: string;
  /** Side that goes along the wall. */
  widthCm: number;
  /** Side that goes into the room. */
  depthCm: number;
}

export function buildLayoutUnits(items: LayoutSourceItem[], boxStack: number): LayoutUnit[] {
  return items.flatMap((item) => {
    const { widthCm, depthCm, stackable } = item.footprint;
    if (stackable) {
      const stacks = Math.ceil(item.quantity / boxStack);
      return Array.from({ length: stacks }, (_, index) => {
        const inStack = Math.min(boxStack, item.quantity - index * boxStack);
        return {
          unitId: `${item.id}-stack-${index + 1}`,
          itemId: item.id,
          name: `${item.name} (stack of ${inStack})`,
          widthCm,
          depthCm,
        };
      });
    }
    return Array.from({ length: item.quantity }, (_, index) => ({
      unitId: `${item.id}-${index + 1}`,
      itemId: item.id,
      name: item.quantity > 1 ? `${item.name} #${index + 1}` : item.name,
      widthCm,
      depthCm,
    }));
  });
}
