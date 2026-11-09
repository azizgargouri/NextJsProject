import mongoose from 'mongoose';
import { connectMongo } from '../shared/database/mongoose';
import { UserModel } from '../shared/database/models/user.model';
import { MoveModel } from '../shared/database/models/move.model';
import { MoveRequestModel } from '../shared/database/models/move-request.model';
import { HomeModel } from '../shared/database/models/home.model';
import { movesService } from '../modules/moves/moves.service';
import { homesService } from '../modules/homes/homes.service';
import type { MoveCreateInput } from '../modules/moves/moves.schema';
import type { RoomCreateInput } from '../modules/homes/homes.schema';

try {
  process.loadEnvFile();
} catch {
  // Missing .env — fall back to the caller's own environment.
}

/**
 * STATIC demo move requests for the demo client, for testing Smart Room Layout,
 * tracking and the rest of the client workspace before real bookings exist.
 * They go through the normal booking service (dispatched to movers), with
 * a fixed `MU-2026-DEMO0x` reference. Idempotent: existing references are kept.
 *
 *   yarn db:seed && yarn db:seed:demo-moves
 */
const CLIENT_EMAIL = 'client@moveup.tn';

const DEMO_MOVES: (MoveCreateInput & { reference: string })[] = [
  {
    reference: 'MU-2026-DEMO01',
    pickupAddress: '12 Rue du Lac, Les Berges du Lac, Tunis',
    destinationAddress: '45 Avenue Habib Bourguiba, Sfax',
    distance: 270,
    moveDate: '2026-11-20',
    items: [
      { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 2 },
      { id: 'wardrobe', name: 'Wardrobe (2 doors)', volume: 1.4, weight: 70, quantity: 2 },
      { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
      { id: 'tv-stand', name: 'TV stand', volume: 0.4, weight: 20, quantity: 1 },
      { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, quantity: 1 },
      { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 6 },
      { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85, quantity: 1 },
      { id: 'washer', name: 'Washing machine', volume: 0.65, weight: 72, quantity: 1 },
      { id: 'desk', name: 'Office desk', volume: 0.6, weight: 30, quantity: 1 },
      { id: 'scan-7f3a', name: 'Bookshelf (scanned)', volume: 0.5, weight: 25, quantity: 1 },
      { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 20 },
    ],
  },
  {
    reference: 'MU-2026-DEMO02',
    pickupAddress: '3 Rue Ibn Khaldoun, Ariana',
    destinationAddress: '18 Rue de Marseille, Tunis',
    distance: 9,
    moveDate: '2026-12-05',
    items: [
      { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
      { id: 'table', name: 'Dining Table', volume: 1.25, weight: 35, quantity: 1 },
      { id: 'chair', name: 'Chair / Armchair', volume: 0.18, weight: 8, quantity: 2 },
      { id: 'fridge', name: 'Fridge / Freezer', volume: 1.1, weight: 85, quantity: 1 },
      { id: 'desk', name: 'Office desk', volume: 0.6, weight: 30, quantity: 1 },
      { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 8 },
    ],
  },
  {
    reference: 'MU-2026-DEMO03',
    pickupAddress: '8 Avenue Habib Bourguiba, La Marsa',
    destinationAddress: '27 Rue de Carthage, Bizerte',
    distance: 62,
    moveDate: '2026-11-28',
    items: [
      { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
      { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
      { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 10 },
    ],
  },
];

/** The house that receives MU-2026-DEMO01: rooms sized for its furniture. */
const DEMO_HOME = {
  label: 'Demo flat, Sfax',
  city: 'Sfax',
  type: 'APARTMENT' as const,
  floor: 2,
  hasElevator: true,
  notes: 'Static demo house linked to MU-2026-DEMO01.',
  moveReference: 'MU-2026-DEMO01',
  rooms: [
    {
      name: 'Living room',
      type: 'LIVING',
      widthCm: 520,
      lengthCm: 480,
      notes: '',
      openings: [
        { kind: 'DOOR', wall: 'S', offsetCm: 60, widthCm: 90 },
        { kind: 'WINDOW', wall: 'N', offsetCm: 150, widthCm: 180 },
      ],
    },
    {
      name: 'Main bedroom',
      type: 'BEDROOM',
      widthCm: 400,
      lengthCm: 380,
      notes: '',
      openings: [
        { kind: 'DOOR', wall: 'W', offsetCm: 40, widthCm: 80 },
        { kind: 'WINDOW', wall: 'E', offsetCm: 120, widthCm: 140 },
      ],
    },
    {
      name: 'Second bedroom',
      type: 'BEDROOM',
      widthCm: 360,
      lengthCm: 340,
      notes: '',
      openings: [{ kind: 'DOOR', wall: 'S', offsetCm: 30, widthCm: 80 }],
    },
    {
      name: 'Kitchen',
      type: 'KITCHEN',
      widthCm: 320,
      lengthCm: 300,
      notes: '',
      openings: [
        { kind: 'DOOR', wall: 'W', offsetCm: 30, widthCm: 80 },
        { kind: 'WINDOW', wall: 'N', offsetCm: 100, widthCm: 120 },
      ],
    },
    {
      name: 'Office',
      type: 'OFFICE',
      widthCm: 300,
      lengthCm: 280,
      notes: '',
      openings: [{ kind: 'DOOR', wall: 'S', offsetCm: 20, widthCm: 80 }],
    },
  ] satisfies RoomCreateInput[],
};

async function seed() {
  await connectMongo();

  const client = await UserModel.findOne({ email: CLIENT_EMAIL, deletedAt: null }).lean();
  if (!client) throw new Error(`${CLIENT_EMAIL} not found: run \`yarn db:seed\` first.`);
  const clientRef = { id: String(client._id) };

  for (const { reference, ...input } of DEMO_MOVES) {
    if ((await MoveRequestModel.exists({ reference })) || (await MoveModel.exists({ reference }))) {
      console.log(`  ${reference} already exists`);
      continue;
    }
    // The booking service prices the move, picks the vehicle and builds the stages.
    // Bookings are dispatched to movers like any client booking; only the reference is fixed.
    const created = await movesService.create(input, clientRef.id);
    await MoveRequestModel.updateOne({ _id: created.id }, { $set: { reference } });
    console.log(`  ${reference} created (${input.items.length} item lines)`);
  }

  const existingHome = await HomeModel.findOne({
    clientId: clientRef.id,
    label: DEMO_HOME.label,
    deletedAt: null,
  }).lean();
  if (existingHome) {
    console.log(`  "${DEMO_HOME.label}" already exists`);
  } else {
    const { rooms, moveReference, ...homeInput } = DEMO_HOME;
    const home = await homesService.createMine(clientRef, homeInput);
    for (const room of rooms) await homesService.addRoom(clientRef, home.id, room);
    await homesService.updateMine(clientRef, home.id, { moveReference });
    console.log(
      `  "${DEMO_HOME.label}" created with ${rooms.length} rooms, linked to ${moveReference}`,
    );
  }

  console.log(`Demo moves ready for ${CLIENT_EMAIL}.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
