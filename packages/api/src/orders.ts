import type { Request, Response } from 'express';
import { FILL_DAYS, DAY_MS, parseISODate, isoFromMs, todayUtcMs, isIngredientSku } from '@pct/engine';
import { bqQuery, cached, RAW } from './clients.js';

// FG-order-centric procurement plan (sales order → two synced streams). The engine's
// computeSchedule/computePlan model a Build with per-component JIT arrivals instead.

// ── Modeled logistics ────────────────────────────────────────────────
// The source data has NO carrier / freight-mode / origin field. We infer a
// plausible logistics profile per procurement stream. Lead times for
// PACKAGING are derived from the REAL average order→arrival gap in
// raw_material_orders_placed; ingredient/compound timing is modeled.
export interface Logistics {
  stream: 'packaging' | 'ingredients';
  country: string;
  imported: boolean;
  mode: string;
  carrier: string;
  port: string;
  leadDays: number;
  modeled: true;
}

const INGREDIENT_LEAD_DAYS = 35; // modeled: raw-ingredient sourcing + compounding
const PACKAGING_LEAD_FALLBACK = 60;

/** Real packaging lead = avg(expected_arrival - order_date) over China-origin component POs. */
async function packagingLeadDays(): Promise<number> {
  return cached('pkgLead', 30 * 60_000, async () => {
    const rows = await bqQuery<{ avg_lead: number | null }>(
      `SELECT ROUND(AVG(DATE_DIFF(DATE(expected_arrival_date), DATE(order_date), DAY))) AS avg_lead
       FROM \`${RAW}.raw_material_orders_placed\`
       WHERE order_date!='' AND expected_arrival_date!=''
         AND DATE(expected_arrival_date) >= DATE(order_date)
         AND REGEXP_CONTAINS(LOWER(vendor), 'jiangsu|shenzhen|hangzhou|hong kong|ltd|limited|glory|hexu|lecos')`,
    );
    const v = Number(rows[0]?.avg_lead);
    return Number.isFinite(v) && v > 0 ? v : PACKAGING_LEAD_FALLBACK;
  });
}

function packagingLogistics(leadDays: number): Logistics {
  return { stream: 'packaging', country: 'China', imported: true, mode: 'Ocean FCL', carrier: 'Ocean FCL · Flexport', port: 'Long Beach · LA', leadDays, modeled: true };
}
function ingredientLogistics(): Logistics {
  return { stream: 'ingredients', country: 'United States', imported: false, mode: 'Compound + domestic sourcing', carrier: 'Babylon compounding → 3PL', port: '—', leadDays: INGREDIENT_LEAD_DAYS, modeled: true };
}

export interface FgRow {
  order_id: string; sku: string | null; product_name: string | null; ordered_quantity: number | null;
  status: string | null; order_date: string | null; required_date: string | null;
  formula: string | null; components: string[] | null; high_priority: boolean | null;
}

export const FG_OPEN = ['Allocated', 'Greenlit', 'Scheduled', 'Released', 'Batched', 'Staged', 'Packed'];
export { packagingLeadDays, todayUtcMs as planToday, isoFromMs as planIso, DAY_MS as PLAN_DAY };

/** Build the synced procurement plan for one sales order. */
export function buildPlan(o: FgRow, pkgLead: number, today: number) {
  const needBy = parseISODate(o.required_date);
  const targetArrival = needBy != null ? needBy - FILL_DAYS * DAY_MS : null; // both streams must land here
  const comps = o.components ?? [];
  const packagingComps = comps.filter((c) => !isIngredientSku(c));
  const ingredientComps = comps.filter(isIngredientSku);

  const pkg = packagingLogistics(pkgLead);
  const ing = ingredientLogistics();

  const pkgOrderBy = targetArrival != null ? targetArrival - pkg.leadDays * DAY_MS : null;
  const ingOrderBy = targetArrival != null ? targetArrival - ing.leadDays * DAY_MS : null;
  const orderNow = pkgOrderBy != null && ingOrderBy != null ? Math.min(pkgOrderBy, ingOrderBy) : (pkgOrderBy ?? ingOrderBy);

  return {
    needBy: needBy != null ? isoFromMs(needBy) : null,
    targetArrival: targetArrival != null ? isoFromMs(targetArrival) : null,
    fillDays: FILL_DAYS,
    orderNow: orderNow != null ? isoFromMs(orderNow) : null,
    overdue: orderNow != null && orderNow < today,
    arrivalSpreadDays: 0, // synced by construction
    packaging: {
      ...pkg,
      orderBy: pkgOrderBy != null ? isoFromMs(pkgOrderBy) : null,
      arrival: targetArrival != null ? isoFromMs(targetArrival) : null,
      componentCount: packagingComps.length,
      components: packagingComps,
    },
    ingredients: {
      ...ing,
      orderBy: ingOrderBy != null ? isoFromMs(ingOrderBy) : null,
      arrival: targetArrival != null ? isoFromMs(targetArrival) : null,
      formula: o.formula ?? null,
      components: ingredientComps,
    },
  };
}

export async function salesOrdersHandler(_req: Request, res: Response): Promise<void> {
  try {
    const today = todayUtcMs();
    const [rows, pkgLead] = await Promise.all([
      bqQuery<FgRow>(
        `SELECT order_id, sku, product_name, ordered_quantity, status,
                order_date, required_date, formula, components, high_priority
         FROM \`${RAW}.finished_goods_orders_placed\`
         WHERE status IN UNNEST(@open)
         ORDER BY required_date`,
        { open: FG_OPEN },
        5 * 60_000,
      ),
      packagingLeadDays(),
    ]);

    const orders = rows.map((o) => ({
      order_id: o.order_id,
      sku: o.sku,
      product_name: o.product_name,
      ordered_quantity: o.ordered_quantity,
      status: o.status,
      order_date: o.order_date,
      required_date: o.required_date,
      formula: o.formula,
      components: o.components ?? [],
      high_priority: o.high_priority,
      plan: buildPlan(o, pkgLead, today),
    }));

    const unitsToBuild = orders.reduce((a, o) => a + Number(o.ordered_quantity ?? 0), 0);
    const orderNowCount = orders.filter((o) => o.plan.overdue).length;
    const needBys = orders.map((o) => o.plan.needBy).filter((d): d is string => !!d);
    const earliestNeedBy = needBys.length ? needBys.reduce((a, b) => (a < b ? a : b)) : null;

    res.json({
      meta: { packagingLeadDays: pkgLead, ingredientLeadDays: INGREDIENT_LEAD_DAYS, fillDays: FILL_DAYS, today: isoFromMs(today) },
      kpis: { openOrders: orders.length, unitsToBuild, orderNowCount, earliestNeedBy },
      orders,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Open purchase orders (reference) — real RM PO lines + vendor rollup ─
const CHINA_HINTS = ['jiangsu', 'shenzhen', 'hangzhou', 'hong kong', 'guangzhou', 'ningbo', 'hanhui', 'hexu', 'lecos', 'ever glory', 'green and innovative', 'mig packaging', 'right team'];
function vendorOrigin(vendorRaw: string | null | undefined): { country: string; imported: boolean; mode: string; carrier: string } {
  const v = (vendorRaw ?? '').toLowerCase();
  if (v.includes('babylon')) return { country: 'United States', imported: false, mode: 'Internal transfer', carrier: 'Babylon compounding → 3PL' };
  if (CHINA_HINTS.some((h) => v.includes(h)) || (/\bltd\b|limited/.test(v) && !v.includes('llc'))) return { country: 'China', imported: true, mode: 'Ocean FCL', carrier: 'Ocean FCL · Flexport' };
  return { country: 'United States', imported: false, mode: 'Ground · LTL', carrier: 'Old Dominion (ODFL)' };
}

interface RmRow {
  order_id: string; vendor: string | null; sku: string | null; description: string | null;
  ordered_quantity: number | null; received_quantity: number | null; open_quantity: number | null;
  uom: string | null; status: string | null;
  order_date: string | null; eta_date: string | null; expected_arrival_date: string | null; arrival_date: string | null;
}

export async function ordersHandler(_req: Request, res: Response): Promise<void> {
  try {
    const rmRows = await bqQuery<RmRow>(
      `SELECT order_id, vendor, sku, description, ordered_quantity, received_quantity, open_quantity, uom, status,
              order_date, eta_date, expected_arrival_date, arrival_date
       FROM \`${RAW}.raw_material_orders_placed\` ORDER BY expected_arrival_date`,
      {}, 5 * 60_000,
    );
    const rawMaterials = rmRows.map((r) => ({ ...r, logistics: { ...vendorOrigin(r.vendor), modeled: true as const } }));
    const open = rawMaterials.filter((r) => Number(r.open_quantity ?? 0) > 0);
    const openPoCount = new Set(open.map((r) => r.order_id)).size;
    const openUnits = open.reduce((a, r) => a + Number(r.open_quantity ?? 0), 0);
    res.json({ kpis: { openPoCount, openLineCount: open.length, openUnits }, rawMaterials });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
