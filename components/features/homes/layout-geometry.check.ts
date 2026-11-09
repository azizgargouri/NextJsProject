/** Run: npx tsx components/features/homes/layout-geometry.check.ts */
import assert from 'node:assert/strict';
import { openingSpot } from './layout-geometry';

const room = { widthCm: 400, lengthCm: 300 };

// Nearest wall wins; the opening is centred on the pointer and snapped to 5 cm.
assert.deepEqual(openingSpot(room, { x: 200, y: 10 }, 80), { wall: 'N', offsetCm: 160 });
assert.deepEqual(openingSpot(room, { x: 203, y: 295 }, 80), { wall: 'S', offsetCm: 165 });
assert.deepEqual(openingSpot(room, { x: 5, y: 150 }, 100), { wall: 'W', offsetCm: 100 });
assert.deepEqual(openingSpot(room, { x: 390, y: 150 }, 100), { wall: 'E', offsetCm: 100 });

// Kept fully on the wall at both ends; dragged past a corner, the wall you went beyond wins.
assert.deepEqual(openingSpot(room, { x: 20, y: -30 }, 80), { wall: 'N', offsetCm: 0 });
assert.deepEqual(openingSpot(room, { x: 395, y: -20 }, 80), { wall: 'N', offsetCm: 320 });
assert.deepEqual(openingSpot(room, { x: -20, y: 290 }, 80), { wall: 'W', offsetCm: 220 });
assert.deepEqual(openingSpot(room, { x: 410, y: 290 }, 120), { wall: 'E', offsetCm: 180 });

// Wider than the wall: pinned to the corner (the form then says it does not fit).
assert.deepEqual(openingSpot(room, { x: 10, y: 150 }, 500), { wall: 'W', offsetCm: 0 });

// Bad input: no spot.
assert.equal(openingSpot({ widthCm: Number.NaN, lengthCm: 300 }, { x: 1, y: 1 }, 80), null);

console.log('layout-geometry: openingSpot checks passed');
