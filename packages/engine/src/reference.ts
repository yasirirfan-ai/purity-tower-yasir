// ─────────────────────────────────────────────────────────────────────
// Reference / master-data tables — SEED DEFAULTS.
// These are illustrative placeholder values from the prototype. In production
// they become editable master data; real values OVERRIDE these. Kept verbatim
// from the Inventory Sync framework so behavior matches the prototype.
// ─────────────────────────────────────────────────────────────────────
import type { Component, Hts, VendorOriginInfo, CarrierLeg } from './types.js';

// Cover bands + expiry threshold (days)
export const COVER = { crit: 30, warn: 60, over: 365 } as const;
export const EXP_SOON = 180;

// Production & logistics durations (days)
export const PLAN_TODAY = Date.UTC(2026, 5, 2); // 2026-06-02, pinned for deterministic offsets
export const COMPOUND_DAYS = 12;
export const FILL_DAYS = 8;
export const MICRO_DAYS = 14;
export const FREIGHT_DAYS = 9;
export const RECEIVE_DAYS = 3;
export const LASTMILE_DAYS = 4;
export const TARGET_COVER_DAYS = 120;

// Placeholder blended unit costs
export const OVERSTOCK_UNIT_COST = 9.5;
export const STRANDED_UNIT_COST = 4.2;
export const CARTON_PACK = 24;
export const PALLET_PACK = 48;

// Carrier master (logistics legs)
export const FREIGHT_CARRIER: CarrierLeg = { carrier: 'Old Dominion', scac: 'ODFL', mode: 'Ground · LTL', service: 'Plant → Deposco DC', cpu: 0.38, lane: 'Ventura, CA → Reno, NV', equipment: "53′ dry van · LTL", incoterms: 'FCA origin', sla: '2–3 transit days', accessorials: 'Liftgate · delivery appt', contact: 'freight@babylon.example' };
export const WH_OPERATOR: CarrierLeg = { carrier: 'UFSI · Deposco 3PL', scac: '—', mode: 'Receive · lot scan · putaway', service: 'Inbound dock → bin', cpu: 0.22, lane: 'Deposco DC — Reno, NV', equipment: 'Dock-to-stock', incoterms: '—', sla: '24–72h dock-to-stock', accessorials: 'Lot/expiry capture · QC hold · ASN', contact: 'inbound@deposco.example' };
export const LASTMILE_CARRIER: CarrierLeg = { carrier: 'UPS Ground / USPS', scac: 'UPSN', mode: 'Parcel', service: 'DC → customer', cpu: 1.25, lane: 'Reno, NV → US zones 2–8', equipment: 'Parcel · ground', incoterms: 'DAP', sla: '3–5 business days', accessorials: 'Dim-weight · signature optional', contact: 'ship@purity.example' };

// Vendor net payment terms (days; 0 = prepay)
export const VENDOR_TERMS: Record<string, number> = {
  BotaniSource: 45, 'Making Cosmetics': 30, 'Actives Lab (DSM)': 60, 'Sun Chemical': 30,
  'Kobo Products': 45, 'Sun Glass Co.': 60, 'Hangzhou Pumps': 0, 'Shenzhen Cosmetics': 0, 'Pacific Print': 30,
};
export const vendorTerms = (v: string): number => (VENDOR_TERMS[v] != null ? VENDOR_TERMS[v]! : 30);

// Vendor origin / import profile
export const VENDOR_ORIGIN: Record<string, VendorOriginInfo> = {
  BotaniSource: { country: 'United States', imported: false },
  'Making Cosmetics': { country: 'United States', imported: false },
  'Actives Lab (DSM)': { country: 'Switzerland', imported: true, mode: 'Air freight', port: 'JFK · New York', broker: 'Flexport Customs' },
  'Sun Chemical': { country: 'United States', imported: false },
  'Kobo Products': { country: 'United States', imported: false },
  'Sun Glass Co.': { country: 'United States', imported: false },
  'Hangzhou Pumps': { country: 'China', imported: true, mode: 'Ocean FCL', port: 'Long Beach · LA', broker: 'Flexport Customs' },
  'Shenzhen Cosmetics': { country: 'China', imported: true, mode: 'Ocean FCL', port: 'Long Beach · LA', broker: 'Flexport Customs' },
  'Pacific Print': { country: 'United States', imported: false },
};
export const vendorOrigin = (v: string): VendorOriginInfo => VENDOR_ORIGIN[v] ?? { country: 'United States', imported: false };

// Ingredient vendor mapping (by component name) — packaging keeps its own supplier.
export function componentVendor(c: Component): string {
  if (c.type !== 'ingredient') return c.supplier;
  const n = c.name.toLowerCase();
  if (/retinol|vitamin|antioxidant|serum/.test(n)) return 'Actives Lab (DSM)';
  if (/caffeine|coffee/.test(n)) return 'BotaniSource';
  if (/shea|jojoba|base/.test(n)) return 'Making Cosmetics';
  if (/pigment|wax/.test(n)) return 'Sun Chemical';
  if (/mascara/.test(n)) return 'Kobo Products';
  if (/conditioner/.test(n)) return 'BotaniSource';
  return 'Making Cosmetics';
}

// Unit cost (USD per unit) by component name — first match wins.
export function componentCost(c: Component): number {
  const n = c.name.toLowerCase();
  if (c.type === 'ingredient') {
    if (/retinol/.test(n)) return 1.65;
    if (/vitamin|vit-c|antioxidant/.test(n)) return 1.40;
    if (/serum/.test(n)) return 1.15;
    if (/caffeine|coffee/.test(n)) return 0.95;
    if (/conditioner/.test(n)) return 0.55;
    if (/pigment|wax|mascara/.test(n)) return 0.70;
    return 0.80;
  }
  if (/airless|pump|dropper/.test(n)) return 1.05;
  if (/jar/.test(n)) return 0.85;
  if (/bottle|barrel/.test(n)) return 0.78;
  if (/tube/.test(n)) return 0.70;
  if (/carton/.test(n)) return 0.42;
  if (/blister|card/.test(n)) return 0.32;
  if (/brush|wand|wiper/.test(n)) return 0.35;
  if (/lid|cap|overcap/.test(n)) return 0.18;
  if (/label/.test(n)) return 0.12;
  return 0.40;
}

// Harmonized Tariff Schedule classification by component.
export function htsFor(c: Component): Hts {
  const n = c.name.toLowerCase();
  if (c.type === 'ingredient') {
    if (/caffeine|coffee/.test(n)) return { code: '2939.79.00', desc: 'Alkaloids — caffeine', duty: 0 };
    if (/vitamin-c|vitamin c|vit-c|antioxidant/.test(n)) return { code: '2936.27.00', desc: 'Vitamin C & derivatives', duty: 0 };
    if (/retinol|vitamin/.test(n)) return { code: '2936.21.00', desc: 'Vitamins A & derivatives', duty: 0 };
    if (/shea|jojoba|base|coconut/.test(n)) return { code: '1516.20.90', desc: 'Vegetable fats & oils, modified', duty: 3.2 };
    if (/pigment|wax/.test(n)) return { code: '3204.17.00', desc: 'Synthetic organic pigments', duty: 6.5 };
    if (/conditioner/.test(n)) return { code: '3305.90.00', desc: 'Hair preparations', duty: 0 };
    if (/mascara/.test(n)) return { code: '3304.20.00', desc: 'Eye make-up preparations', duty: 0 };
    return { code: '3304.99.50', desc: 'Beauty / skin-care preparations', duty: 0 };
  }
  if (/glass|jar|bottle/.test(n)) return { code: '7010.90.50', desc: 'Glass containers for packing', duty: 5.2 };
  if (/airless|pump|dropper/.test(n)) return { code: '9616.10.00', desc: 'Scent / cosmetic sprayers & pumps', duty: 0 };
  if (/cap|lid|overcap|barrel|tube/.test(n)) return { code: '3923.50.00', desc: 'Plastic stoppers, lids & caps', duty: 5.3 };
  if (/carton/.test(n)) return { code: '4819.20.00', desc: 'Folding cartons, paperboard', duty: 0 };
  if (/label/.test(n)) return { code: '4821.10.00', desc: 'Printed paper labels', duty: 0 };
  if (/brush|wand|wiper/.test(n)) return { code: '9603.30.40', desc: "Cosmetic / artists' brushes", duty: 0 };
  if (/blister|card/.test(n)) return { code: '3923.10.00', desc: 'Plastic packing articles', duty: 3 };
  return { code: '3923.90.00', desc: 'Plastic packing articles', duty: 3 };
}

export const SECTION_301_RATE = 25; // % surcharge on China-origin goods
