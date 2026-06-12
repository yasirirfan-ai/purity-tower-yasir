import type { Request, Response } from 'express';
import { bqQuery, fetchCollection, RAW } from './clients.js';

// Per-channel SKU detail:
//  - on-hand per channel  -> Firestore sku_summaries.inventory_channels (pipeline-computed, reliable;
//    raw on_hand snapshots are per-SKU-dated and awkward to roll up live).
//  - sales (30d / 60d / all-time units + revenue) -> BigQuery finished_goods_sales, real & windowed.
//  China sales live under sub-channels (china_tiktok, china_tmall, …) so we normalize them to "china".
interface SalesRow { sku: string; name: string | null; u30: number | null; u60: number | null; u_all: number | null; rev_all: number | null }
interface OutRow {
  sku: string; product_name: string | null; risk_band: string | null;
  on_hand: number; units_30d: number; units_60d: number; units_alltime: number; revenue_alltime: number;
}

export async function channelDetailHandler(req: Request, res: Response): Promise<void> {
  const ch = req.params.channel;
  if (!ch) {
    res.status(400).json({ error: 'channel required' });
    return;
  }
  try {
    const [skuDocs, sales] = await Promise.all([
      fetchCollection('sku_summaries'),
      // No WHERE date filter (some channels — notably Amazon — have empty sale_date,
      // and we still want their all-time units/revenue). Windowed sums use SAFE.CAST
      // so undated rows simply don't count toward 30d/60d.
      bqQuery<SalesRow>(
        `SELECT sku, ANY_VALUE(product_name) AS name,
            ROUND(SUM(IF(SAFE_CAST(sale_date AS DATE) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY), net_quantity_sold, 0))) AS u30,
            ROUND(SUM(IF(SAFE_CAST(sale_date AS DATE) > DATE_SUB(CURRENT_DATE(), INTERVAL 60 DAY), net_quantity_sold, 0))) AS u60,
            ROUND(SUM(net_quantity_sold)) AS u_all,
            -- gross_sales is the only revenue field consistently populated across ALL channels
            -- (Amazon's net_sales is near-empty). Reported as gross revenue.
            ROUND(SUM(gross_sales)) AS rev_all
         FROM \`${RAW}.finished_goods_sales\`
         WHERE (CASE WHEN channel LIKE 'china%' THEN 'china' ELSE channel END) = @ch
         GROUP BY sku`,
        { ch }, 5 * 60_000,
      ),
    ]);

    const rows = new Map<string, OutRow>();

    // On-hand (and presence) from Firestore inventory/sales channel maps.
    for (const d of skuDocs) {
      const inv = (d.inventory_channels as Record<string, number> | undefined)?.[ch];
      const sal = (d.sales_channels as Record<string, number> | undefined)?.[ch];
      if (inv == null && sal == null) continue;
      const sku = String(d.sku ?? d.id);
      rows.set(sku, {
        sku,
        product_name: (d.product_name as string) ?? null,
        risk_band: (d.risk_band as string) ?? null,
        on_hand: Number(inv ?? 0),
        units_30d: 0, units_60d: 0, units_alltime: Number(sal ?? 0), revenue_alltime: 0,
      });
    }

    // Overlay real windowed sales from BigQuery.
    for (const s of sales) {
      const sku = String(s.sku);
      const r = rows.get(sku) ?? {
        sku, product_name: s.name ?? null, risk_band: null,
        on_hand: 0, units_30d: 0, units_60d: 0, units_alltime: 0, revenue_alltime: 0,
      };
      r.units_30d = Number(s.u30 ?? 0);
      r.units_60d = Number(s.u60 ?? 0);
      r.units_alltime = Number(s.u_all ?? 0);
      r.revenue_alltime = Number(s.rev_all ?? 0);
      if (!r.product_name) r.product_name = s.name ?? null;
      rows.set(sku, r);
    }

    const list = [...rows.values()].sort((a, b) => b.revenue_alltime - a.revenue_alltime);
    const totals = {
      skuCount: list.length,
      onHand: list.reduce((a, r) => a + r.on_hand, 0),
      units30d: list.reduce((a, r) => a + r.units_30d, 0),
      units60d: list.reduce((a, r) => a + r.units_60d, 0),
      unitsAllTime: list.reduce((a, r) => a + r.units_alltime, 0),
      revenueAllTime: list.reduce((a, r) => a + r.revenue_alltime, 0),
    };
    res.json({ channel: ch, totals, skus: list });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
