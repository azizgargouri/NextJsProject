/**
 * STATIC move requests — the single swap point until the teammate's
 * `requests-and-inventory` branch (Move model) is merged.
 *
 * Items use exactly their `MoveDoc.items` shape: { id, name, volume (m³ each),
 * weight (kg each), quantity }, with ids from their booking catalogue
 * (box, chair, sofa, bed, fridge, washer, table) plus a few extras and one
 * "scanned" item that is not in any catalogue.
 *
 * Static data cannot know Mongo ids, so ownership is by account email here;
 * the real Move model filters by `clientId` instead.
 */
export interface StaticMoveItem {
  id: string;
  name: string;
  volume: number;
  weight: number;
  quantity: number;
}

export interface StaticMoveRequest {
  reference: string;
  clientEmail: string;
  pickupAddress: string;
  destinationAddress: string;
  moveDate: string;
  items: StaticMoveItem[];
}

export const STATIC_MOVE_REQUESTS: readonly StaticMoveRequest[] = [
  {
    reference: 'MU-2026-DEMO01',
    clientEmail: 'omar.client@moveup.tn',
    pickupAddress: '12 Rue du Lac, Les Berges du Lac, Tunis',
    destinationAddress: '45 Avenue Habib Bourguiba, Sfax',
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
    clientEmail: 'omar.client@moveup.tn',
    pickupAddress: '3 Rue Ibn Khaldoun, Ariana',
    destinationAddress: '18 Rue de Marseille, Tunis',
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
    clientEmail: 'client@moveup.tn',
    pickupAddress: '8 Avenue Habib Bourguiba, La Marsa',
    destinationAddress: '27 Rue de Carthage, Bizerte',
    moveDate: '2026-11-28',
    items: [
      { id: 'bed', name: 'Double Bed', volume: 1.8, weight: 55, quantity: 1 },
      { id: 'sofa', name: '3-Seater Sofa', volume: 1.6, weight: 65, quantity: 1 },
      { id: 'box', name: 'Moving box', volume: 0.08, weight: 12, quantity: 10 },
    ],
  },
];
