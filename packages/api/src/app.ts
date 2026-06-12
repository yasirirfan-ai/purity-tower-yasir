import express from 'express';
import cors from 'cors';
import { CORS_ORIGIN } from './env.js';
import { apiKeyAuth } from './auth.js';
import { fetchCollection, fetchCollectionWhere, fetchDoc, bqQuery, RAW } from './clients.js';
import { ordersHandler, salesOrdersHandler, buildPlan, packagingLeadDays, planToday, planIso, PLAN_DAY, FG_OPEN, type FgRow } from './orders.js';
import { bqVelocityMap, applyVelocity } from './velocity.js';
import { channelDetailHandler } from './channels.js';
import { pdFormulasHandler, pdFormulaDetailHandler, pdIngredientsHandler } from './productDev.js';
import { vendorsHandler, cashHandler, financeSummaryHandler, intercompanyHandler } from './finance.js';
import { reviewsHandler, artworkHandler, regulatoryHandler } from './extras.js';
import { poTimelineHandler } from './poTimeline.js';

const ok =
  <T>(fn: () => Promise<T>) =>
  async (_req: express.Request, res: express.Response) => {
    try {
      res.json(await fn());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error(message);
      res.status(500).json({ error: message });
    }
  };

export function createApp() {
  const app = express();
  app.use(cors(CORS_ORIGIN?.length ? { origin: CORS_ORIGIN } : {}));
  app.use(apiKeyAuth);

  app.get('/api/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  app.get(
    '/api/summary',
    ok(async () => {
      const [doc, vmap] = await Promise.all([fetchDoc('control_tower_summary', 'current'), bqVelocityMap()]);
      let units30d = 0;
      for (const v of vmap.values()) if (v.d30) units30d += v.d30 * 30;
      return { ...(doc ?? {}), total_units: doc?.recent_units_sold ?? null, total_revenue: doc?.recent_revenue ?? null, units_30d_total: Math.round(units30d) };
    }),
  );

  app.get('/api/skus', async (req, res) => {
    try {
      const [allRaw, vmap] = await Promise.all([fetchCollection('sku_summaries'), bqVelocityMap()]);
      const all = allRaw.map((r) => applyVelocity(r, vmap.get(String(r.sku ?? r.id))));
      const search = String(req.query.search ?? '').trim().toLowerCase();
      const band = String(req.query.band ?? '').trim().toLowerCase();
      const limit = Math.min(Number(req.query.limit ?? 2000), 5000);

      let rows = all;
      if (search) {
        rows = rows.filter((r) => {
          const sku = String(r.sku ?? r.id ?? '').toLowerCase();
          const name = String(r.product_name ?? '').toLowerCase();
          return sku.includes(search) || name.includes(search);
        });
      }
      if (band && band !== 'all') {
        rows = rows.filter((r) => String(r.risk_band ?? '').toLowerCase() === band);
      }
      res.json({ count: rows.length, total: all.length, skus: rows.slice(0, limit) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/skus/:sku', async (req, res) => {
    try {
      const sku = req.params.sku;
      const [summary, readiness, plan, exceptions, actions, lots, sales, fgOrders, productRows, pkgLead] = await Promise.all([
        fetchDoc('sku_summaries', sku),
        fetchDoc('material_readiness_summaries', sku),
        fetchDoc('production_plan_summaries', sku),
        fetchCollectionWhere('exception_summaries', 'sku', sku),
        fetchCollectionWhere('action_recommendations', 'sku', sku),
        bqQuery(
          `SELECT channel, facility, lot_number, quantity_on_hand, available_quantity,
                  expiration_date, snapshot_date
           FROM \`${RAW}.finished_goods_on_hand\`
           WHERE sku = @sku
           ORDER BY snapshot_date DESC
           LIMIT 200`,
          { sku },
        ),
        bqQuery(
          `SELECT SUBSTR(sale_date, 1, 7) AS sale_month, channel,
                  SUM(net_quantity_sold) AS units,
                  ROUND(SUM(net_sales)) AS revenue
           FROM \`${RAW}.finished_goods_sales\`
           WHERE sku = @sku AND sale_date IS NOT NULL AND sale_date != ''
           GROUP BY sale_month, channel
           ORDER BY sale_month`,
          { sku },
        ),
        bqQuery<FgRow>(
          `SELECT order_id, sku, product_name, ordered_quantity, status,
                  order_date, required_date, formula, components, high_priority
           FROM \`${RAW}.finished_goods_orders_placed\`
           WHERE sku = @sku AND status IN UNNEST(@open)
           ORDER BY required_date`,
          { sku, open: FG_OPEN },
        ),
        bqQuery<{ sku: string; product_name: string | null; formula: string | null; components: string[] | null }>(
          `SELECT sku, product_name, formula, components FROM \`${RAW}.products\` WHERE sku = @sku LIMIT 1`,
          { sku },
        ),
        packagingLeadDays(),
      ]);
      if (!summary && !readiness && !plan) {
        res.status(404).json({ error: `SKU ${sku} not found` });
        return;
      }
      const vmap = await bqVelocityMap();
      const vel = vmap.get(sku);
      const summaryFixed = summary ? applyVelocity(summary, vel) : summary;
      const today = planToday();

      const salesOrders = (fgOrders as FgRow[]).map((o) => ({ ...o, plan: buildPlan(o, pkgLead, today) }));
      let projected: { order: FgRow; plan: ReturnType<typeof buildPlan> } | null = null;
      if (salesOrders.length === 0) {
        const docRaw = vel?.doc ?? (summary?.days_of_cover_estimate != null ? Number(summary.days_of_cover_estimate) : null);
        const doc = docRaw != null && Number.isFinite(docRaw) ? docRaw : null;
        const prod = (productRows as Array<{ product_name: string | null; formula: string | null; components: string[] | null }>)[0];
        const readinessComps = [
          ...((readiness?.missing_components as string[]) ?? []),
          ...(((readiness?.bottleneck_components as Array<{ sku?: string }>) ?? []).map((b) => b.sku).filter((x): x is string => !!x)),
        ];
        const components = (prod?.components?.length ? prod.components : readinessComps) ?? [];
        if (doc != null) {
          const order: FgRow = {
            order_id: 'projected', sku,
            product_name: prod?.product_name ?? (summaryFixed?.product_name as string) ?? (readiness?.product_name as string) ?? null,
            ordered_quantity: Number(plan?.suggested_build_quantity ?? 0) || null,
            status: 'projected', order_date: planIso(today),
            required_date: planIso(today + Math.round(doc) * PLAN_DAY),
            formula: prod?.formula ?? null, components, high_priority: null,
          };
          projected = { order, plan: buildPlan(order, pkgLead, today) };
        }
      }

      res.json({ sku, summary: summaryFixed, readiness, plan, exceptions, actions, lots, sales, salesOrders, projected });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/readiness', ok(() => fetchCollection('material_readiness_summaries')));
  app.get('/api/production-plan', ok(() => fetchCollection('production_plan_summaries')));
  app.get('/api/exceptions', ok(() => fetchCollection('exception_summaries')));
  app.get('/api/actions', ok(() => fetchCollection('action_recommendations')));
  app.get('/api/data-quality', ok(() => fetchCollection('data_quality_checks')));
  app.get('/api/forecast', ok(() => fetchCollection('sales_forecasts_6m')));

  app.get('/api/sales-orders', salesOrdersHandler);
  app.get('/api/orders', ordersHandler);

  app.get(
    '/api/channels',
    ok(async () => {
      const [channels, monthly] = await Promise.all([
        fetchCollection('channel_summaries'),
        fetchCollection('sales_monthly_actuals'),
      ]);
      return { channels, monthly };
    }),
  );

  app.get('/api/channels/:channel', channelDetailHandler);
  app.get('/api/pd/formulas', pdFormulasHandler);
  app.get('/api/pd/ingredients', pdIngredientsHandler);
  app.get('/api/pd/formulas/:id', pdFormulaDetailHandler);
  app.get('/api/vendors', vendorsHandler);
  app.get('/api/finance/cash', cashHandler);
  app.get('/api/finance/summary', financeSummaryHandler);
  app.get('/api/finance/intercompany', intercompanyHandler);
  app.get('/api/reviews', reviewsHandler);
  app.get('/api/artwork', artworkHandler);
  app.get('/api/regulatory', regulatoryHandler);
  app.get('/api/po-timeline', poTimelineHandler);

  return app;
}
