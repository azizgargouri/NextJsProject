/**
 * Runnable self-check for layout-packer.ts:
 *   yarn tsx server/modules/room-layout/layout-packer.check.ts
 */
import assert from 'node:assert/strict';
import {
  describeSpot,
  packLayout,
  placeUnit,
  spotProblem,
  type PackRoom,
  type PackUnit,
  type Rect,
} from './layout-packer';

const bedroom: PackRoom = {
  id: 'bed',
  name: 'Bedroom',
  type: 'BEDROOM',
  widthCm: 300,
  lengthCm: 300,
  openings: [
    { kind: 'DOOR', wall: 'S', offsetCm: 20, widthCm: 80 },
    { kind: 'WINDOW', wall: 'N', offsetCm: 100, widthCm: 120 },
  ],
};
const kitchen: PackRoom = {
  id: 'kitchen',
  name: 'Kitchen',
  type: 'KITCHEN',
  widthCm: 200,
  lengthCm: 180,
  openings: [{ kind: 'DOOR', wall: 'W', offsetCm: 0, widthCm: 80 }],
};
const rooms = [bedroom, kitchen];

const units: PackUnit[] = [
  { unitId: 'bed-1', itemId: 'bed', name: 'Double Bed', widthCm: 160, depthCm: 200 },
  { unitId: 'wardrobe-1', itemId: 'wardrobe', name: 'Wardrobe', widthCm: 120, depthCm: 60 },
  { unitId: 'wardrobe-2', itemId: 'wardrobe', name: 'Wardrobe', widthCm: 120, depthCm: 60 },
  { unitId: 'fridge-1', itemId: 'fridge', name: 'Fridge', widthCm: 60, depthCm: 65 },
  { unitId: 'sofa-1', itemId: 'sofa', name: 'Sofa', widthCm: 250, depthCm: 260 },
  { unitId: 'chair-1', itemId: 'chair', name: 'Chair', widthCm: 50, depthCm: 50 },
];

const result = packLayout(rooms, units, [
  { unitId: 'bed-1', roomId: 'bed', wall: 'N', reason: 'Head against the north wall.' },
  { unitId: 'wardrobe-1', roomId: 'bed', wall: 'E', reason: 'Long free wall.' },
  { unitId: 'wardrobe-2', roomId: 'bed', wall: 'E', reason: 'Next to the first one.' },
  // Wall-only item sent to CENTER by the AI → must end up on a wall.
  { unitId: 'fridge-1', roomId: 'kitchen', wall: 'CENTER', reason: 'Kitchen.' },
  { unitId: 'sofa-1', roomId: 'kitchen', wall: 'N', reason: 'Too big on purpose.' },
  // chair-1 deliberately missing → MoveUp fallback room (KITCHEN for chairs).
]);

const byId = Object.fromEntries(result.placed.map((unit) => [unit.unitId, unit]));

// Everything placed is inside its room and overlaps nothing.
for (const unit of result.placed) {
  const room = rooms.find((candidate) => candidate.id === unit.roomId)!;
  assert.ok(unit.x >= 0 && unit.y >= 0, `${unit.unitId} inside (top-left)`);
  assert.ok(
    unit.x + unit.w <= room.widthCm && unit.y + unit.h <= room.lengthCm,
    `${unit.unitId} inside`,
  );
  for (const other of result.placed) {
    if (other === unit || other.roomId !== unit.roomId) continue;
    const apart =
      unit.x + unit.w <= other.x ||
      other.x + other.w <= unit.x ||
      unit.y + unit.h <= other.y ||
      other.y + other.h <= unit.y;
    assert.ok(apart, `${unit.unitId} must not overlap ${other.unitId}`);
  }
}

// Bed against the north wall; the door swing (x 20–100, y 220–300) stays free.
assert.equal(byId['bed-1']!.wall, 'N');
assert.equal(byId['bed-1']!.y, 0);
for (const unit of result.placed.filter((candidate) => candidate.roomId === 'bed')) {
  const inSwing = unit.x < 100 && unit.x + unit.w > 20 && unit.y + unit.h > 220;
  assert.ok(!inSwing, `${unit.unitId} must not block the bedroom door`);
}

// Two wardrobes: first on the east wall, the second moves elsewhere with a note.
assert.equal(byId['wardrobe-1']!.wall, 'E');
assert.ok(byId['wardrobe-2'], 'second wardrobe still placed');

// Tall wardrobe never in front of the north window (x 100–220, first 40 cm).
for (const id of ['wardrobe-1', 'wardrobe-2']) {
  const unit = byId[id]!;
  const blocksWindow = unit.y < 40 && unit.x < 220 && unit.x + unit.w > 100;
  assert.ok(!blocksWindow, `${id} must not block the window`);
}

// Fridge: AI said CENTER, packer keeps it on a wall.
assert.notEqual(byId['fridge-1']!.wall, 'CENTER');

// Oversized sofa is reported, not forced in.
assert.equal(result.unplaced.length, 1);
assert.equal(result.unplaced[0]!.unitId, 'sofa-1');
assert.match(result.unplaced[0]!.reason, /Too big for Kitchen/);

// Missing AI choice → MoveUp fallback with a warning.
assert.equal(byId['chair-1']!.source, 'moveup');
assert.equal(byId['chair-1']!.roomId, 'kitchen');
assert.equal(result.warnings.length, 1);

// --- placeUnit (manual edits) ------------------------------------------------
const bed = units[0]!;
const bedSpot = byId['bed-1']!;
const othersInBedroom: Rect[] = result.placed
  .filter((unit) => unit.roomId === 'bed' && unit.unitId !== 'bed-1')
  .map(({ x, y, w, h }) => ({ x, y, w, h }));

// Normal orientation on a wall: width along the wall, not rotated.
assert.equal(bedSpot.rotated, false);
assert.equal(bedSpot.w, 160);

// Rotate in place: same wall, 200 along / 160 deep, close to where it was.
const rotated = placeUnit(bedroom, bed, 'N', othersInBedroom, {
  orientations: ['rotated'],
  near: { x: bedSpot.x + bedSpot.w / 2, y: bedSpot.y + bedSpot.h / 2 },
});
assert.ok(rotated, 'bed can rotate on the north wall');
assert.equal(rotated.rotated, true);
assert.deepEqual([rotated.rect.w, rotated.rect.h, rotated.rect.y], [200, 160, 0]);

// A full wall refuses the item (null), it is never forced in.
const fullEastWall: Rect[] = [{ x: 240, y: 0, w: 60, h: 300 }];
assert.equal(placeUnit(bedroom, bed, 'E', fullEastWall), null);

// "near" picks the free spot closest to a point: a chair asked near x=250 on the north wall.
const chair = units[5]!;
const nearSpot = placeUnit(bedroom, chair, 'N', [], { near: { x: 250, y: 0 } });
assert.ok(nearSpot && nearSpot.rect.x >= 200, `chair near x=250, got x=${nearSpot?.rect.x}`);

// Free-standing works and stays off the walls.
const centre = placeUnit(bedroom, chair, 'CENTER', []);
assert.ok(centre && centre.rect.x >= 40 && centre.rect.y >= 40);

// --- spotProblem / describeSpot (drag and drop) -------------------------------
const wardrobe = units[1]!;
// Free spot against the east wall, away from the door and the window.
assert.equal(spotProblem(bedroom, wardrobe, { x: 240, y: 100, w: 60, h: 120 }, []), null);
// Outside the room.
assert.match(
  spotProblem(bedroom, wardrobe, { x: 260, y: 100, w: 60, h: 120 }, []) ?? '',
  /Outside/,
);
// In the door swing (S wall, x 20–100, last 80 cm).
assert.equal(spotProblem(bedroom, chair, { x: 30, y: 240, w: 50, h: 50 }, []), 'Blocks the door.');
// Tall wardrobe in front of the north window; a low chair there is fine.
assert.match(spotProblem(bedroom, wardrobe, { x: 120, y: 0, w: 120, h: 60 }, []) ?? '', /window/);
assert.equal(spotProblem(bedroom, chair, { x: 120, y: 0, w: 50, h: 50 }, []), null);
// Too close to another item (5 cm gap).
assert.equal(
  spotProblem(bedroom, chair, { x: 0, y: 0, w: 50, h: 50 }, [
    { name: 'Double Bed', rect: { x: 52, y: 0, w: 160, h: 200 } },
  ]),
  'Too close to Double Bed.',
);
// Which wall a dropped rectangle stands against, and whether it is turned.
assert.deepEqual(describeSpot(bedroom, bed, { x: 50, y: 0, w: 160, h: 200 }), {
  wall: 'N',
  rotated: false,
});
assert.deepEqual(describeSpot(bedroom, bed, { x: 0, y: 50, w: 200, h: 160 }), {
  wall: 'W',
  rotated: false,
});
assert.deepEqual(describeSpot(bedroom, bed, { x: 50, y: 0, w: 200, h: 160 }), {
  wall: 'N',
  rotated: true,
});
assert.deepEqual(describeSpot(bedroom, chair, { x: 120, y: 120, w: 50, h: 50 }), {
  wall: 'CENTER',
  rotated: false,
});

console.log('layout-packer: all checks passed');
