/**
 * Runnable self-check for furniture-sizes.ts (no test framework in the repo):
 *   yarn tsx server/modules/room-layout/furniture-sizes.check.ts
 */
import assert from 'node:assert/strict';
import { footprintFor, summarizeItems } from './furniture-sizes';

// Catalogue ids use fixed sizes.
assert.deepEqual(footprintFor({ id: 'bed', volume: 1.8 }), {
  widthCm: 160,
  depthCm: 200,
  stackable: false,
  source: 'catalogue',
});
assert.equal(footprintFor({ id: 'box', volume: 0.08 }).stackable, true);

// Unknown ids are estimated from volume (1 m tall square): 0.5 m³ → ~71 cm side.
assert.deepEqual(footprintFor({ id: 'scan-7f3a', volume: 0.5 }), {
  widthCm: 71,
  depthCm: 71,
  stackable: false,
  source: 'estimated',
});
// Clamped both ways.
assert.equal(footprintFor({ id: 'tiny', volume: 0.001 }).widthCm, 30);
assert.equal(footprintFor({ id: 'huge', volume: 99 }).widthCm, 250);

// Totals: 7 boxes stack into 3 stacks of 50×35 → 0.525 m²; bed 3.2 m² → 3.7 m² floor.
assert.deepEqual(
  summarizeItems([
    { id: 'bed', volume: 1.8, weight: 55, quantity: 1 },
    { id: 'box', volume: 0.08, weight: 12, quantity: 7 },
  ]),
  { itemCount: 8, volumeM3: 2.4, weightKg: 139, floorM2: 3.7 },
);

console.log('furniture-sizes: all checks passed');
