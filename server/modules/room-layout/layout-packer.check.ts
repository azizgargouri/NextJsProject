/**
 * Runnable self-check for layout-packer.ts:
 *   yarn tsx server/modules/room-layout/layout-packer.check.ts
 */
import assert from 'node:assert/strict';
import { packLayout, type PackRoom, type PackUnit } from './layout-packer';

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

console.log('layout-packer: all checks passed');
