/**
 * Reference volumes for common household items, in m³ (typical sizes used by
 * removal firms to size a truck). Shared by the server, which maps an AI
 * inventory onto these keys, and the landing UI, which totals and edits it.
 *
 * The model never does arithmetic: it only names items and counts them. Every
 * cubic metre shown to the customer comes from this table, or is flagged as
 * an estimate when the item has no entry here.
 */
export type InventoryRoom = 'living' | 'bedroom' | 'kitchen' | 'office' | 'other';

export interface CatalogueItem {
  key: string;
  room: InventoryRoom;
  m3: number;
  en: string;
  fr: string;
}

export const INVENTORY_CATALOGUE: CatalogueItem[] = [
  // Living
  { key: 'sofa_3', room: 'living', m3: 2.0, en: '3-seat sofa', fr: 'Canapé 3 places' },
  { key: 'sofa_2', room: 'living', m3: 1.5, en: '2-seat sofa', fr: 'Canapé 2 places' },
  { key: 'corner_sofa', room: 'living', m3: 3.0, en: 'Corner sofa', fr: "Canapé d'angle" },
  { key: 'armchair', room: 'living', m3: 0.8, en: 'Armchair', fr: 'Fauteuil' },
  { key: 'coffee_table', room: 'living', m3: 0.3, en: 'Coffee table', fr: 'Table basse' },
  { key: 'tv_unit', room: 'living', m3: 0.6, en: 'TV unit', fr: 'Meuble TV' },
  { key: 'tv', room: 'living', m3: 0.2, en: 'Television', fr: 'Téléviseur' },
  { key: 'bookcase', room: 'living', m3: 1.0, en: 'Bookcase', fr: 'Bibliothèque' },
  { key: 'sideboard', room: 'living', m3: 1.0, en: 'Sideboard', fr: 'Buffet' },
  { key: 'dining_table', room: 'living', m3: 1.0, en: 'Dining table', fr: 'Table à manger' },
  { key: 'dining_chair', room: 'living', m3: 0.2, en: 'Dining chair', fr: 'Chaise' },
  { key: 'rug', room: 'living', m3: 0.2, en: 'Rug (rolled)', fr: 'Tapis (roulé)' },
  { key: 'piano_upright', room: 'living', m3: 1.5, en: 'Upright piano', fr: 'Piano droit' },
  { key: 'mirror', room: 'living', m3: 0.1, en: 'Mirror or framed art', fr: 'Miroir ou cadre' },
  { key: 'plant', room: 'living', m3: 0.2, en: 'Large plant', fr: 'Grande plante' },
  // Bedroom
  { key: 'double_bed', room: 'bedroom', m3: 2.0, en: 'Double bed', fr: 'Lit double' },
  { key: 'single_bed', room: 'bedroom', m3: 1.2, en: 'Single bed', fr: 'Lit simple' },
  { key: 'bunk_bed', room: 'bedroom', m3: 1.8, en: 'Bunk bed', fr: 'Lit superposé' },
  { key: 'crib', room: 'bedroom', m3: 0.6, en: 'Cot', fr: 'Lit bébé' },
  { key: 'wardrobe_2', room: 'bedroom', m3: 1.5, en: '2-door wardrobe', fr: 'Armoire 2 portes' },
  { key: 'wardrobe_3', room: 'bedroom', m3: 2.2, en: '3-door wardrobe', fr: 'Armoire 3 portes' },
  { key: 'chest_drawers', room: 'bedroom', m3: 0.6, en: 'Chest of drawers', fr: 'Commode' },
  { key: 'bedside_table', room: 'bedroom', m3: 0.2, en: 'Bedside table', fr: 'Table de chevet' },
  { key: 'dressing_table', room: 'bedroom', m3: 0.6, en: 'Dressing table', fr: 'Coiffeuse' },
  // Kitchen
  { key: 'fridge', room: 'kitchen', m3: 1.0, en: 'Fridge', fr: 'Réfrigérateur' },
  {
    key: 'fridge_large',
    room: 'kitchen',
    m3: 1.6,
    en: 'American fridge',
    fr: 'Réfrigérateur américain',
  },
  { key: 'freezer', room: 'kitchen', m3: 0.8, en: 'Freezer', fr: 'Congélateur' },
  { key: 'cooker', room: 'kitchen', m3: 0.5, en: 'Cooker', fr: 'Cuisinière' },
  { key: 'washing_machine', room: 'kitchen', m3: 0.6, en: 'Washing machine', fr: 'Lave-linge' },
  { key: 'dishwasher', room: 'kitchen', m3: 0.5, en: 'Dishwasher', fr: 'Lave-vaisselle' },
  { key: 'microwave', room: 'kitchen', m3: 0.1, en: 'Microwave', fr: 'Micro-ondes' },
  { key: 'kitchen_table', room: 'kitchen', m3: 0.6, en: 'Kitchen table', fr: 'Table de cuisine' },
  // Office
  { key: 'desk', room: 'office', m3: 0.8, en: 'Desk', fr: 'Bureau' },
  { key: 'office_chair', room: 'office', m3: 0.3, en: 'Office chair', fr: 'Chaise de bureau' },
  { key: 'filing_cabinet', room: 'office', m3: 0.5, en: 'Filing cabinet', fr: 'Classeur' },
  {
    key: 'computer',
    room: 'office',
    m3: 0.15,
    en: 'Computer and screen',
    fr: 'Ordinateur et écran',
  },
  // Other
  { key: 'box', room: 'other', m3: 0.1, en: 'Moving box', fr: 'Carton' },
  { key: 'box_wardrobe', room: 'other', m3: 0.5, en: 'Wardrobe box', fr: 'Carton penderie' },
  { key: 'suitcase', room: 'other', m3: 0.15, en: 'Suitcase', fr: 'Valise' },
  { key: 'bicycle', room: 'other', m3: 0.5, en: 'Bicycle', fr: 'Vélo' },
  {
    key: 'air_conditioner',
    room: 'other',
    m3: 0.3,
    en: 'Air conditioner',
    fr: 'Climatiseur',
  },
  {
    key: 'garden_set',
    room: 'other',
    m3: 1.5,
    en: 'Garden table and chairs',
    fr: 'Salon de jardin',
  },
];

export const CATALOGUE_BY_KEY = new Map(INVENTORY_CATALOGUE.map((item) => [item.key, item]));

/** Bounds for items the catalogue does not know; the model's guess is clamped. */
export const CUSTOM_ITEM_M3 = { min: 0.05, max: 4 };

export interface InventoryLine {
  /** Catalogue key, or `custom` for an item outside the catalogue. */
  key: string;
  /** Display label in the request locale (catalogue label when known). */
  label: string;
  room: InventoryRoom;
  quantity: number;
  /** Volume of one unit, m³. */
  unitM3: number;
  /** True when the volume is the model's guess rather than a catalogue value. */
  estimated: boolean;
  /** True when the item was inferred from the home size, not stated or seen. */
  assumed: boolean;
}

export interface InventoryResult {
  lines: InventoryLine[];
  totalM3: number;
  /** Optional one-line note from the assistant (e.g. what it could not identify). */
  note: string | null;
  model: string;
}

export const roundM3 = (value: number) => Math.round(value * 10) / 10;

export function inventoryTotal(lines: Pick<InventoryLine, 'quantity' | 'unitM3'>[]): number {
  return roundM3(lines.reduce((sum, line) => sum + line.quantity * line.unitM3, 0));
}
