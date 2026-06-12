// ─────────────────────────────────────────────────────────────────────
// Finance / cash engine — pure functions ported from lib.jsx LIB_CASH/LIB_FIN.
// No I/O. Callers assemble inputs (payables, SKU revenue) from real data and
// feed them in. Dollar figures depend on a cost master that may be MODELED —
// the constants below are labeled placeholder defaults.
// ─────────────────────────────────────────────────────────────────────

// Placeholder finance constants (override when real cost/terms data lands).
export const FIN_TRANSFER_MARKUP = 1.45; // Babylon → Purity transfer price = landed × this
export const FIN_ING_COST = 4.2;         // blended ingredient $/unit (stranded capital)
export const FIN_PKG_COST = 1.1;         // blended packaging $/unit
export const FIN_LABOR_UNIT = 0.12;      // fill/assembly labor $/unit
export const FIN_EQUIP_CAPEX = 302_000;  // equipment capex (lease-vs-buy)
export const FIN_DSO_DAYS = 38;          // days sales outstanding (intercompany AR)
export const FIN_MEMBER_FACILITY = 70_000;
export const FIN_COGS_CAP = 0.6;         // COGS clamped to ≤60% of ASP when modeled
export const FIN_ING_SHARE = 0.55;       // goods split: ingredient share
export const FIN_PKG_SHARE = 0.45;       // goods split: packaging share

// ── Cash forecasting ──────────────────────────────────────────────────
export interface CashEvent {
  vendor: string;
  type: 'ingredient' | 'packaging';
  sku?: string;
  product?: string;
  component?: string;
  amount: number;
  goods?: number;
  duty?: number;
  freight?: number;
  terms?: number;
  orderOff?: number;
  dueOff: number;          // day offset from PLAN_TODAY when the invoice is due
  prepaid?: boolean;
  imported?: boolean;
}
export interface CashBucket {
  label: string;
  loOff: number;
  hiOff: number;
  ing: number;
  pkg: number;
  total: number;
  count: number;
  balance: number;         // running cash balance after this bucket's outflows
}

const sumBucket = (events: CashEvent[], lo: number, hi: number) => {
  let ing = 0, pkg = 0, count = 0;
  for (const e of events) {
    if (e.dueOff >= lo && e.dueOff < hi) {
      if (e.type === 'ingredient') ing += e.amount; else pkg += e.amount;
      count += 1;
    }
  }
  return { ing, pkg, total: ing + pkg, count };
};

/** Rolling weekly cash forecast over `horizonWk` weeks from today (offset 0). */
export function cashWeeks(events: CashEvent[], openingCash: number, horizonWk = 16): CashBucket[] {
  const out: CashBucket[] = [];
  let balance = openingCash;
  for (let w = 0; w < horizonWk; w++) {
    const lo = w * 7;
    const hi = lo + 7;
    const b = sumBucket(events, lo, hi);
    balance -= b.total;
    out.push({ label: `Wk ${w + 1}`, loOff: lo, hiOff: hi, ...b, balance });
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Monthly cash forecast. `baseYear`/`baseMonth` (0-based) anchor the calendar (default 2026-06). */
export function cashMonths(
  events: CashEvent[],
  openingCash: number,
  monthsN = 9,
  baseYear = 2026,
  baseMonth = 5,
): CashBucket[] {
  const out: CashBucket[] = [];
  let balance = openingCash;
  const base = Date.UTC(baseYear, baseMonth, 1);
  let lo = 0;
  for (let i = 0; i < monthsN; i++) {
    const endMs = Date.UTC(baseYear, baseMonth + i + 1, 1);
    const hi = Math.round((endMs - base) / 86_400_000);
    const b = sumBucket(events, lo, hi);
    balance -= b.total;
    const my = baseMonth + i;
    const label = `${MONTHS[((my % 12) + 12) % 12]} ’${String((baseYear + Math.floor(my / 12)) % 100).padStart(2, '0')}`;
    out.push({ label, loOff: lo, hiOff: hi, ...b, balance });
    lo = hi;
  }
  return out;
}

// ── SKU unit economics (modeled COGS until a real cost master lands) ──
export interface SkuEconInput { sku: string; name?: string; units60: number; rev60: number }
export interface SkuEcon {
  sku: string; name: string; units60: number; rev60: number;
  asp: number; cogs: number; ing: number; pkg: number; freight: number; duty: number; labor: number;
  grossU: number; margin: number; gross60: number;
}

/**
 * Per-SKU unit economics. ASP = rev60/units60; COGS modeled as ≤60% of ASP,
 * split ingredient/packaging by FIN_ING_SHARE/FIN_PKG_SHARE plus labor.
 * MODELED until real landed cost is supplied.
 */
export function skuEconomics(skus: SkuEconInput[]): SkuEcon[] {
  return skus
    .filter((s) => s.units60 > 0 && s.rev60 > 0)
    .map((s) => {
      const asp = s.rev60 / s.units60;
      const labor = FIN_LABOR_UNIT;
      const cogs = Math.min(asp * FIN_COGS_CAP, asp); // modeled cap
      const goods = Math.max(0, cogs - labor);
      const ing = goods * FIN_ING_SHARE;
      const pkg = goods * FIN_PKG_SHARE;
      const grossU = asp - cogs;
      return {
        sku: s.sku, name: s.name ?? s.sku, units60: s.units60, rev60: s.rev60,
        asp, cogs, ing, pkg, freight: 0, duty: 0, labor,
        grossU, margin: asp > 0 ? grossU / asp : 0, gross60: grossU * s.units60,
      };
    })
    .sort((a, b) => b.gross60 - a.gross60);
}

// ── Intercompany (Babylon manufacturer → Purity brand) ───────────────
export interface TransferRow {
  sku: string; name: string; mcu: number; transfer: number; asp: number;
  babylonMargin: number; purityMargin: number;
}
export interface Aging { b0: number; b31: number; b61: number; b90: number }
export interface Intercompany {
  transferPricing: TransferRow[];
  arBalance: number; dso: number; aging: Aging;
  apDue30: number; cashOnHand: number; purityReceipts30: number; coverageRatio: number | null;
  memberDrawn: number; memberFacility: number;
  babRev60: number; purRev60: number; purityShare: number; transferMarkup: number;
}
// AR aging distribution (deterministic shares of the balance)
const AGING_SHARES = { b0: 0.55, b31: 0.25, b61: 0.12, b90: 0.08 };

/**
 * Intercompany transfer-pricing + AR model. econ rows supply MCU (landed cost, modeled)
 * and ASP; transfer price = MCU × markup. AR balance = daily transfer revenue × DSO.
 * MODELED until real landed cost + intercompany invoices exist.
 */
export function intercompanyStats(econ: SkuEcon[], cashOnHand = 250_000, dso = FIN_DSO_DAYS): Intercompany {
  const transferPricing: TransferRow[] = econ.map((e) => {
    const mcu = e.cogs;
    const transfer = mcu * FIN_TRANSFER_MARKUP;
    return {
      sku: e.sku, name: e.name, mcu, transfer, asp: e.asp,
      babylonMargin: transfer > 0 ? (transfer - mcu) / transfer : 0,
      purityMargin: e.asp > 0 ? (e.asp - transfer) / e.asp : 0,
    };
  });
  const babRev60 = transferPricing.reduce((a, r, i) => a + r.transfer * (econ[i]?.units60 ?? 0), 0);
  const purRev60 = econ.reduce((a, e) => a + e.rev60, 0);
  const dailyTransfer = babRev60 / 60;
  const arBalance = dailyTransfer * dso;
  const aging: Aging = {
    b0: arBalance * AGING_SHARES.b0, b31: arBalance * AGING_SHARES.b31,
    b61: arBalance * AGING_SHARES.b61, b90: arBalance * AGING_SHARES.b90,
  };
  const dailyCogs = econ.reduce((a, e) => a + e.cogs * e.units60, 0) / 60;
  const apDue30 = dailyCogs * 30;
  const purityReceipts30 = arBalance * (30 / dso);
  const coverageRatio = apDue30 > 0 ? (cashOnHand + purityReceipts30) / apDue30 : null;
  const shortfall = Math.max(0, apDue30 - (cashOnHand + purityReceipts30));
  const memberDrawn = Math.min(FIN_MEMBER_FACILITY, shortfall * 0.4);
  return {
    transferPricing, arBalance, dso, aging, apDue30, cashOnHand, purityReceipts30, coverageRatio,
    memberDrawn, memberFacility: FIN_MEMBER_FACILITY,
    babRev60, purRev60, purityShare: babRev60 > 0 ? purRev60 / babRev60 : 0, transferMarkup: FIN_TRANSFER_MARKUP,
  };
}

// ── Lease vs buy (equipment financing) ────────────────────────────────
export interface LeaseVsBuy { buy: number; lease: number; favors: 'buy' | 'lease'; capex: number }
export function leaseVsBuy(capex = FIN_EQUIP_CAPEX, years = 5, rate = 0.065): LeaseVsBuy {
  const down = capex * 0.1;
  const principal = capex - down;
  const monthlyRate = rate / 12;
  const n = years * 12;
  const pmt = (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));
  const buyNet = down + pmt * n - capex * 0.2; // less ~20% salvage/owned value
  const leaseMonthly = (capex / 1000) * 21; // FMV lease: $21/mo per $1k
  const leaseNet = leaseMonthly * n;
  return { buy: Math.round(buyNet), lease: Math.round(leaseNet), favors: buyNet <= leaseNet ? 'buy' : 'lease', capex };
}
