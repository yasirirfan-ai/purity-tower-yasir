// ─────────────────────────────────────────────────────────────────────
// Domain model for the Babylon × Purity engine.
// These are the canonical TYPES (the contract). Real data — Odoo, Shopify,
// BigQuery, Firestore — maps onto these shapes; nothing here does I/O.
// Ported from the Inventory Sync framework (window.INV_* + lib.jsx).
// ─────────────────────────────────────────────────────────────────────

// ── Inventory (real extracted data) ───────────────────────────────────
export interface Meta {
  generated: string;       // ISO snapshot date
  windowDays: number;      // sales window (e.g. 60)
  totalSkus: number;
  totalOnHand: number;
  total60Units: number;
  total60Rev: number;
  reconFound?: number;
  reconMissing?: number;
  reconTotal?: number;
}

export type SkuStatus = 'ACTIVE' | 'DISCO' | 'OLD SAMPLE PACKET' | 'NOT STOCKED' | string;
export type CoverBand = 'none' | 'stockout' | 'crit' | 'warn' | 'good' | 'over';

export interface SkuRecord {
  sku: string;
  name: string;
  onHand: number;          // summed across lots
  lots: number;            // count of distinct lots
  status: SkuStatus;
  earliestExp: string | null;
  units60: number;
  rev60: number;
  doc: number | null;      // days of cover (null when no sales velocity)
}
/** SkuRecord after deriving band + expDays (output of computeFlags). */
export interface SkuDerived extends SkuRecord {
  band: CoverBand;
  expDays: number | null;
}

// ── Bill of materials + match-rate ────────────────────────────────────
export type ComponentType = 'ingredient' | 'packaging';
export interface Component {
  name: string;
  type: ComponentType;
  onHand: number;          // in `unit`
  perUnit: number;         // component consumed per finished unit
  unit: 'g' | 'ml' | 'ea' | string;
  supplier: string;
  leadTimeDays: number;
  reserved?: number;       // committed to open orders
  incoming?: number;       // on open POs
  incomingEta?: string | null;
  incomingPO?: string | null;
  // optional enrichment from the real BOM feed
  prodLeadDays?: number;
  shipLeadDays?: number;
  shipMethod?: string | null;
  moq?: number;
  realUnitPrice?: number;
  realTerms?: string;
  realVendor?: string;
  csku?: string;
}
export interface ProductBOM {
  sku: string;
  name: string;
  finishedOnHand: number;
  demand60: number;
  components: Component[];
}
/** A component after capacity computation (inside Build). */
export interface BuiltComponent extends Component {
  available: number;
  capacity: number;            // buildable now from free stock
  onHandCapacity: number;      // ignoring reservations
  reservedUnits: number;
  incomingUnits: number;
  withIncomingCapacity: number;
}
export interface Build extends ProductBOM {
  comps: BuiltComponent[];
  ing: BuiltComponent[];
  pkg: BuiltComponent[];
  ingCeil: number;
  pkgCeil: number;
  buildable: number;
  buildableWithIncoming: number;
  bottleneck: BuiltComponent;
  limitSide: 'packaging' | 'ingredient' | 'balanced';
  matchRate: number;           // 0..1 (1 = perfectly balanced)
  stranded: number;            // abundant-side units that can't be completed
  totalAvail: number;
  demandCover: number;
}

// ── Procurement schedule ──────────────────────────────────────────────
export interface Hts { code: string; desc: string; duty: number }
export interface VendorOriginInfo { country: string; imported: boolean; mode?: string; port?: string; broker?: string }
export interface CarrierLeg {
  carrier: string; scac: string; mode: string; service?: string; cpu: number;
  lane: string; equipment?: string; incoterms?: string; sla?: string; accessorials?: string; contact?: string;
}
export interface ScheduleItem extends BuiltComponent {
  capacity: number;
  isIng: boolean;
  orderUnits: number;
  orderQty: number;
  value: number;
  vendor: string;
  netTerms: number;
  hts: Hts;
  origin: VendorOriginInfo;
  section301: number;
  dutyRate: number;
  dutyCost: number;
  startOff: number;        // order-by, day offset from PLAN_TODAY
  endOff: number;
  landOff: number;
  consumeOff?: number;
  idleDays: number;
  payByOff: number;
  daysToOrder: number;
}
export interface Phase { startOff: number; endOff: number; days?: number }
export interface LogisticsLeg extends CarrierLeg {
  key: string; name: string; startOff: number; endOff: number; days: number;
  cost: number; units: number; cartons: number; pallets: number;
}
export type ScheduleMode = 'synced' | 'naive';
export interface ScheduleOpts { compound?: number; fill?: number; cover?: number }
export interface Schedule extends Build {
  mode: ScheduleMode;
  daily: number;
  coverDays: number;
  needByOff: number;
  targetBuild: number;
  items: ScheduleItem[];
  orderItems: ScheduleItem[];
  earliestOrderOff: number | null;
  totalValue: number;
  phases: { compound: Phase; fill: Phase; micro: Phase };
  logistics: { freight: LogisticsLeg; receive: LogisticsLeg; lastmile: LogisticsLeg };
  logisticsCost: number;
  dutyTotal: number;
  importedItems: ScheduleItem[];
  arriveWhOff: number;
  availOff: number;
  customerOff: number;
  arrivalSpread: number;
  idleDays: number;
  readyOff: number;
  latestPay: number;
  cashGap: number;
}

// ── Early-warning flags + capital (output of computeFlags) ────────────
export interface Flags {
  stockout: SkuDerived[];
  critical: SkuDerived[];
  warn: SkuDerived[];
  over: SkuDerived[];
  dead: SkuDerived[];
  disco: SkuDerived[];
  expiring: SkuDerived[];
}

// ── Reconciliation ────────────────────────────────────────────────────
export interface ReconRow {
  year: string; name: string; size: string; lot: string; pkg: string;
  match: 'found' | 'missing' | 'unknown';
  whDesc?: string; sku?: string; qty?: number; exp?: string | null;
}

// ── Broader domain models (typed contract; data wired later) ──────────

/** Real BOM feed (BOM & VENDOR LEAD TIME.xlsx). */
export interface RealBomComponent {
  type: string; status?: string; csku?: string; desc?: string; vendorItem?: string;
  vendor?: string | null; paymentTerms?: string; shipMethod?: string; moq?: number;
  prodLeadWk?: number; shipLeadWk?: number; totalLeadWk?: number; unitPrice?: number;
}
export interface RealBomSku {
  sku: string; fgDesc?: string; upc?: string; status?: string; components: RealBomComponent[];
}
export interface RealBom {
  meta: Record<string, unknown>;
  leadByCategory?: Record<string, { prodWk: number; shipWk: number; method: string }>;
  bySku: Record<string, RealBomSku>;
}

/** Open finished-goods POs (Open POs.xlsx). */
export interface OpenPoLine {
  po: string; sku: string; product: string; qty: number; orderDate: string; orderOff: number;
}
export interface OpenPos { meta: Record<string, unknown>; lines: OpenPoLine[] }

/** Production formulas (Formulas For Production.xlsx). */
export interface FormulaIngredient { name: string; code: string; inci: string; pct: number; phase?: string }
export interface FormulaSheet {
  product: string; sheet?: string; isFFP?: boolean; fillWeight?: number | null;
  count?: number; ingredients: FormulaIngredient[]; allergens?: string[];
}
export interface Formulas { meta: Record<string, unknown>; byName: Record<string, FormulaSheet> }

/** Customer-facing INCI declarations per SKU (Ingredient List.xlsx). */
export interface IngredientDeclaration {
  product: string; sku: string; il: string; count: number;
  ingredients: string[]; allergens: string[]; updated?: string | null;
}
export interface Ingredients { meta: Record<string, unknown>; bySku: Record<string, IngredientDeclaration> }

/** Artwork master + proof tracking (Artwork Master Data.xlsx). */
export interface ArtworkProof { stage: string; version: string; owner: string; printer?: string; updated?: string }
export interface ArtworkComponent {
  cid: string; type: string; material?: string; finish?: string; printColor?: string;
  foil?: string; dims?: string; proof?: ArtworkProof;
}
export interface ArtworkSku { sku: string; name: string; upc?: string; weight?: string; components: ArtworkComponent[] }
export interface Artwork { meta: Record<string, unknown>; bySku: Record<string, ArtworkSku> }

/** Product development pipeline. */
export interface ProdDevProduct {
  id: string; devCode: string; name: string; category?: string; stage: string;
  [k: string]: unknown;
}
export interface ProdDev { meta: Record<string, unknown>; stages: string[]; products: ProdDevProduct[] }

/** Customer reviews (Reviews data.xlsx). */
export interface ReviewItem { stars: number; date: string; flag?: string; text: string }
export interface ReviewProduct {
  name: string; sku?: string; count: number; avg: number; dist: Record<string, number>;
  critical: number; recent90?: number; recentAvg?: number; negPct?: number; health?: number;
  status?: string; reviews?: ReviewItem[];
}
export interface Reviews { meta: Record<string, unknown>; byName: Record<string, ReviewProduct> }

/** Active component supplier master (Active Components Supplier.xlsx). */
export interface VendorMasterRow {
  vendor: string; country: string; components: string[]; componentsRaw?: string;
  paymentTerm?: string; termType?: string; incoterm?: string;
}
export interface VendorMaster { meta: Record<string, unknown>; vendors: VendorMasterRow[] }
