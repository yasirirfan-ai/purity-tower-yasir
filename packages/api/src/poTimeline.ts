import type { Request, Response } from 'express';
import {
  COMPOUND_DAYS, FILL_DAYS, MICRO_DAYS,
  DAY_MS, parseISODate, isoFromMs, isIngredientSku, originFromVendor,
} from '@pct/engine';
import { bqQuery, RAW, cached } from './clients.js';

// Per-PO dependency timeline (models the prototype's POGanttDrawer).
// FG-order-centric: each sales order → components with real PO status, scheduled
// backward from need-by. See @pct/engine computeSchedule for Build-centric JIT.

const MODELED_LEAD = { ocean: 61, domestic: 30, internal: COMPOUND_DAYS + 21 };

interface FgRow { order_id: string; sku: string; product_name: string; ordered_quantity: number; status: string; order_date: string; required_date: string; formula: string; components: string[] | null }
interface RmAgg { sku: string; vendor: string; min_order: string; max_eta: string; lines: number }

export async function poTimelineHandler(_req: Request, res: Response): Promise<void> {
  try {
    const data = await cached('po-timeline', 5 * 60_000, async () => {
      const [orders, rm] = await Promise.all([
        bqQuery<FgRow>(
          `SELECT order_id, sku, product_name, ordered_quantity, status, order_date, required_date, formula, components
           FROM \`${RAW}.finished_goods_orders_placed\`
           WHERE status IN ('Allocated','Greenlit','Scheduled','Released','Batched','Staged','Packed')
             AND required_date != ''
           ORDER BY required_date`,
        ),
        bqQuery<RmAgg>(
          `SELECT sku, ANY_VALUE(vendor) vendor, MIN(order_date) min_order, MAX(expected_arrival_date) max_eta, COUNT(*) lines
           FROM \`${RAW}.raw_material_orders_placed\`
           WHERE sku IS NOT NULL AND sku != '' GROUP BY sku`,
        ),
      ]);
      const poMap = new Map(rm.map((r) => [r.sku, r]));

      const realLead = (r: RmAgg | undefined): number | null => {
        if (!r) return null;
        const o = parseISODate(r.min_order), e = parseISODate(r.max_eta);
        return o != null && e != null && e >= o ? Math.round((e - o) / DAY_MS) : null;
      };

      const built = orders.map((o) => {
        const needBy = parseISODate(o.required_date)!;
        const ready = needBy;
        const microStart = ready - MICRO_DAYS * DAY_MS;
        const fillEnd = microStart;
        const fillStart = fillEnd - FILL_DAYS * DAY_MS;
        const compoundEnd = fillStart;
        const compoundStart = compoundEnd - COMPOUND_DAYS * DAY_MS;

        const mkItem = (code: string, type: 'ingredient' | 'packaging', forceVendor?: string) => {
          const po = poMap.get(code);
          const ordered = !!po;
          const vendor = po?.vendor ?? forceVendor ?? null;
          const org = originFromVendor(vendor);
          const rl = realLead(po);
          const leadDays = rl ?? (org.imported ? MODELED_LEAD.ocean : type === 'ingredient' ? MODELED_LEAD.internal : MODELED_LEAD.domestic);
          const landBy = type === 'ingredient' ? compoundStart : fillStart;
          const orderBy = landBy - leadDays * DAY_MS;
          return {
            code, type, ordered, vendor, mode: org.mode, badge: org.badge, leadDays,
            leadReal: rl != null,
            orderBy: isoFromMs(orderBy), arrival: isoFromMs(landBy),
          };
        };

        const packaging = (o.components ?? []).filter((c) => !isIngredientSku(c)).map((c) => mkItem(c, 'packaging'));
        const compFromComponents = (o.components ?? []).filter((c) => isIngredientSku(c)).map((c) => mkItem(c, 'ingredient'));
        const bulk = mkItem(o.sku, 'ingredient', 'Our Babylon, LLC');
        const ingredients = [bulk, ...compFromComponents];

        const counts = {
          packagingOrdered: packaging.filter((i) => i.ordered).length, packagingTotal: packaging.length,
          ingredientOrdered: ingredients.filter((i) => i.ordered).length, ingredientTotal: ingredients.length,
        };
        return {
          orderId: o.order_id, sku: o.sku, name: o.product_name, units: o.ordered_quantity,
          status: o.status, orderDate: o.order_date, needBy: o.required_date, formula: o.formula,
          ingredients, packaging, counts,
          phases: {
            compound: { start: isoFromMs(compoundStart), end: isoFromMs(compoundEnd) },
            fill: { start: isoFromMs(fillStart), end: isoFromMs(fillEnd) },
            micro: { start: isoFromMs(microStart), end: isoFromMs(ready), days: MICRO_DAYS },
            ready: isoFromMs(ready),
          },
        };
      });
      return { orders: built, meta: { compoundDays: COMPOUND_DAYS, fillDays: FILL_DAYS, microDays: MICRO_DAYS } };
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
