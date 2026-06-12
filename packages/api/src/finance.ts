import type { Request, Response } from 'express';
import {
  cashWeeks, cashMonths, skuEconomics, leaseVsBuy, intercompanyStats,
  FIN_ING_COST, FIN_PKG_COST, FIN_LABOR_UNIT,
  DAY_MS, parseISODate, todayUtcMs, isIngredientSku, CHINA_VENDOR_RE,
  type CashEvent, type SkuEcon,
} from '@pct/engine';
import { bqQuery, fetchCollection, RAW } from './clients.js';

/** Shared: build per-SKU unit economics from sku_summaries + the BigQuery 60d velocity. */
async function buildEconomics(): Promise<{ economics: SkuEcon[]; fgOnHand: number }> {
  const [skuSummaries, bqRows] = await Promise.all([
    fetchCollection('sku_summaries', 60_000),
    bqQuery<{ sku: string; daily_velocity_60d: number; recent_units_sold: number; recent_revenue: number }>(
      `SELECT sku, daily_velocity_60d, recent_units_sold, recent_revenue FROM \`control_tower_summary.sku_summaries\``,
      {}, 60_000,
    ),
  ]);
  const bq = new Map(bqRows.map((r) => [r.sku, r]));
  const econInput = skuSummaries.map((s) => {
    const sku = String(s.sku ?? s.id);
    const b = bq.get(sku);
    const allUnits = Number(b?.recent_units_sold ?? s.recent_units_sold ?? 0);
    const allRev = Number(b?.recent_revenue ?? s.recent_revenue ?? 0);
    const asp = allUnits > 0 ? allRev / allUnits : 0;
    const u60 = Number(b?.daily_velocity_60d ?? 0) * 60; // keep unrounded for revenue
    return { sku, name: String(s.product_name ?? sku), units60: Math.round(u60), rev60: Math.round(asp * u60) };
  });
  const fgOnHand = skuSummaries.reduce((a, s) => a + Number(s.finished_goods_on_hand ?? 0), 0);
  return { economics: skuEconomics(econInput), fgOnHand };
}

const isChina = (v: string | null | undefined) => !!v && CHINA_VENDOR_RE.test(v) && !/llc/i.test(v);

// ── Vendors: component (from real RM POs) + ingredient (from ingredients coll) ──
export async function vendorsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const [rm, ings] = await Promise.all([
      bqQuery<{ vendor: string; pos: number; lines: number; open_qty: number; ordered_qty: number; earliest: string; latest_eta: string; sample: string }>(
        `SELECT vendor,
                COUNT(DISTINCT order_id) pos, COUNT(*) lines,
                ROUND(SUM(open_quantity)) open_qty, ROUND(SUM(ordered_quantity)) ordered_qty,
                MIN(order_date) earliest, MAX(expected_arrival_date) latest_eta,
                ANY_VALUE(description) sample
         FROM \`${RAW}.raw_material_orders_placed\`
         WHERE vendor IS NOT NULL AND vendor != ''
         GROUP BY vendor ORDER BY open_qty DESC`,
        {}, 5 * 60_000,
      ),
      fetchCollection('ingredients', 5 * 60_000),
    ]);

    const component = rm.map((v) => ({
      vendor: v.vendor,
      country: isChina(v.vendor) ? 'China' : 'United States',
      imported: isChina(v.vendor),
      poCount: Number(v.pos ?? 0),
      lineCount: Number(v.lines ?? 0),
      openQty: Number(v.open_qty ?? 0),
      orderedQty: Number(v.ordered_qty ?? 0),
      earliestOrder: v.earliest ?? null,
      latestEta: v.latest_eta ?? null,
      sample: v.sample ?? null,
    }));

    // group ingredient master by vendor
    const byVendor = new Map<string, { vendor: string; count: number; prices: number[]; ingredients: Array<Record<string, unknown>> }>();
    for (const d of ings) {
      const vendor = String(d.vendor ?? 'Unknown');
      const e = byVendor.get(vendor) ?? { vendor, count: 0, prices: [], ingredients: [] };
      e.count += 1;
      if (typeof d.pricePerKg === 'number') e.prices.push(d.pricePerKg);
      e.ingredients.push({
        code: d.ingredientCode, inci: d.susieInci ?? d.inci, pricePerKg: d.pricePerKg,
        allergens: d.allergenComponents ?? [], leadTime: d.leadTime, naturalOriginPct: d.naturalOriginPct,
      });
      byVendor.set(vendor, e);
    }
    const ingredient = [...byVendor.values()]
      .map((e) => ({ vendor: e.vendor, count: e.count, avgPricePerKg: e.prices.length ? e.prices.reduce((a, b) => a + b, 0) / e.prices.length : null, ingredients: e.ingredients }))
      .sort((a, b) => b.count - a.count);

    res.json({ component, ingredient });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Cash planner: payables from real open POs (modeled $) → weekly/monthly forecast ──
export async function cashHandler(req: Request, res: Response): Promise<void> {
  try {
    const opening = Number(req.query.opening ?? 250_000);
    const rows = await bqQuery<{ order_id: string; vendor: string; sku: string; description: string; open_quantity: number; expected_arrival_date: string }>(
      `SELECT order_id, vendor, sku, description, open_quantity, expected_arrival_date
       FROM \`${RAW}.raw_material_orders_placed\`
       WHERE open_quantity > 0 AND expected_arrival_date != ''`,
      {}, 5 * 60_000,
    );
    const today = todayUtcMs();
    const events: (CashEvent & { product?: string; po?: string })[] = rows.map((r) => {
      const type: 'ingredient' | 'packaging' = isIngredientSku(r.sku) ? 'ingredient' : 'packaging';
      const unitCost = type === 'ingredient' ? FIN_ING_COST : FIN_PKG_COST;
      const amount = Math.round(Number(r.open_quantity ?? 0) * unitCost);
      const eta = parseISODate(r.expected_arrival_date);
      const dueOff = eta != null ? Math.round((eta - today) / DAY_MS) : 0;
      return { vendor: r.vendor ?? 'Unknown', type, sku: r.sku, product: r.description, po: r.order_id, amount, dueOff, imported: isChina(r.vendor) };
    });

    const weeks = cashWeeks(events, opening, 16);
    const months = cashMonths(events, opening, 9);
    const totalPayable = events.reduce((a, e) => a + e.amount, 0);
    const due30 = events.filter((e) => e.dueOff >= 0 && e.dueOff <= 30).reduce((a, e) => a + e.amount, 0);
    const overdue = events.filter((e) => e.dueOff < 0).reduce((a, e) => a + e.amount, 0);
    const lowestBalance = Math.min(opening, ...months.map((m) => m.balance));

    // vendor rollup
    const vmap = new Map<string, { vendor: string; amount: number; lines: number; firstDueOff: number; imported: boolean }>();
    for (const e of events) {
      const v = vmap.get(e.vendor) ?? { vendor: e.vendor, amount: 0, lines: 0, firstDueOff: Infinity, imported: !!e.imported };
      v.amount += e.amount; v.lines += 1; v.firstDueOff = Math.min(v.firstDueOff, e.dueOff);
      vmap.set(e.vendor, v);
    }
    const vendors = [...vmap.values()].sort((a, b) => b.amount - a.amount);

    res.json({
      opening, modeled: true,
      kpis: { totalPayable, due30, overdue, lowestBalance },
      weeks, months, vendors,
      events: events.sort((a, b) => a.dueOff - b.dueOff).slice(0, 400),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Finance summary: unit economics + modeled working capital + lease-vs-buy ──
export async function financeSummaryHandler(_req: Request, res: Response): Promise<void> {
  try {
    const { economics, fgOnHand } = await buildEconomics();
    const totalRev60 = economics.reduce((a, e) => a + e.rev60, 0);
    const totalCogs60 = economics.reduce((a, e) => a + e.cogs * e.units60, 0);
    const totalGross60 = economics.reduce((a, e) => a + e.gross60, 0);

    // Modeled working capital: FG value at blended unit cost.
    const blendedUnitCost = FIN_ING_COST + FIN_PKG_COST + FIN_LABOR_UNIT;
    const fgValue = Math.round(fgOnHand * blendedUnitCost);
    const ar = Math.round((totalRev60 / 60) * 38);          // ~38d DSO
    const ap = Math.round((totalCogs60 / 60) * 30);          // ~30d payables
    const capitalRatio = ap > 0 ? (ar + fgValue) / ap : null;

    res.json({
      modeled: true,
      economics: economics.slice(0, 60),
      totals: {
        rev60: Math.round(totalRev60), cogs60: Math.round(totalCogs60), gross60: Math.round(totalGross60),
        grossMargin: totalRev60 > 0 ? totalGross60 / totalRev60 : 0,
        annualRevEst: Math.round(totalRev60 * (365 / 60)),
      },
      workingCapital: { fgValue, ar, ap, capitalRatio, blendedUnitCost },
      leaseVsBuy: leaseVsBuy(),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Intercompany: transfer pricing + AR aging (Babylon → Purity) ─────
export async function intercompanyHandler(req: Request, res: Response): Promise<void> {
  try {
    const cashOnHand = Number(req.query.cash ?? 250_000);
    const { economics } = await buildEconomics();
    const ic = intercompanyStats(economics, cashOnHand);
    // top transfer-pricing rows by transfer revenue contribution
    const transferPricing = [...ic.transferPricing]
      .map((r, i) => ({ ...r, units60: economics[i]?.units60 ?? 0, transferRev60: r.transfer * (economics[i]?.units60 ?? 0) }))
      .sort((a, b) => b.transferRev60 - a.transferRev60)
      .slice(0, 60);
    res.json({ modeled: true, ...ic, transferPricing });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
