import type { SkuRecord, SkuDerived, CoverBand, Flags } from './types.js';
import { COVER, EXP_SOON, OVERSTOCK_UNIT_COST, PLAN_TODAY } from './reference.js';

/** Days-of-cover band. */
export function coverBand(doc: number | null): CoverBand {
  if (doc == null) return 'none';
  if (doc === 0) return 'stockout';
  if (doc <= COVER.crit) return 'crit';
  if (doc <= COVER.warn) return 'warn';
  if (doc >= COVER.over) return 'over';
  return 'good';
}

/** Whole days from `today` until an ISO date (null-safe). */
export function daysUntil(iso: string | null, today: number = PLAN_TODAY): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Math.round((t - today) / 86_400_000);
}

/** Derive band + expDays for each SKU. */
export function deriveSkus(skus: SkuRecord[], today: number = PLAN_TODAY): SkuDerived[] {
  return skus.map((s) => ({ ...s, band: coverBand(s.doc), expDays: daysUntil(s.earliestExp, today) }));
}

/** Early-warning flag sets over derived SKUs. */
export function computeFlags(derived: SkuDerived[]): Flags {
  return {
    stockout: derived.filter((s) => s.onHand === 0 && s.units60 > 0),
    critical: derived.filter((s) => s.band === 'crit'),
    warn: derived.filter((s) => s.band === 'warn'),
    over: derived.filter((s) => s.band === 'over' && s.onHand > 0),
    dead: derived.filter((s) => s.onHand > 0 && s.units60 === 0),
    disco: derived.filter((s) => s.status === 'DISCO' && s.onHand > 0),
    expiring: derived.filter((s) => s.expDays != null && s.expDays <= EXP_SOON && s.onHand > 0),
  };
}

/** Capital tied up in overstock (units beyond ~365d cover × blended unit cost). */
export function overstockCapital(over: SkuDerived[]): number {
  return over.reduce((a, s) => {
    const daily = s.units60 / 60;
    const keepUnits = daily * COVER.over;
    return a + Math.max(0, s.onHand - keepUnits) * OVERSTOCK_UNIT_COST;
  }, 0);
}
