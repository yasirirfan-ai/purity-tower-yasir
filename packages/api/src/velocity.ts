import { bqQuery, cached } from './clients.js';

// The Firestore `sku_summaries.daily_velocity_estimate` is computed as
// (all-time units / 30), which inflates velocity ~10x and makes days-of-cover
// far too pessimistic. The CORRECT windowed velocities live in BigQuery
// `control_tower_summary.sku_summaries`. We overlay those onto every SKU record.
export interface Vel {
  d30: number | null;
  d60: number | null;
  d90: number | null;
  d180: number | null;
  doc: number | null; // days of cover (correct)
}

const SUMMARY = 'control_tower_summary.sku_summaries';

export async function bqVelocityMap(): Promise<Map<string, Vel>> {
  return cached('bqVelocityMap', 5 * 60_000, async () => {
    const rows = await bqQuery<{
      sku: string; daily_velocity_30d: number | null; daily_velocity_60d: number | null;
      daily_velocity_90d: number | null; daily_velocity_180d: number | null; days_of_cover_estimate: number | null;
    }>(
      `SELECT sku, daily_velocity_30d, daily_velocity_60d, daily_velocity_90d, daily_velocity_180d, days_of_cover_estimate
       FROM \`${SUMMARY}\``,
    );
    const map = new Map<string, Vel>();
    for (const r of rows) {
      map.set(r.sku, {
        d30: numOrNull(r.daily_velocity_30d),
        d60: numOrNull(r.daily_velocity_60d),
        d90: numOrNull(r.daily_velocity_90d),
        d180: numOrNull(r.daily_velocity_180d),
        doc: numOrNull(r.days_of_cover_estimate),
      });
    }
    return map;
  });
}

const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Overlay corrected velocity + days-of-cover onto a Firestore SKU record.
 * - `daily_velocity_estimate` is replaced with the real 30-day rate.
 * - `days_of_cover_estimate` is replaced with the BigQuery (correct) value.
 * - `recent_units_sold` / `recent_revenue` are actually ALL-TIME totals (kept,
 *    but exposed as `total_units` / `total_revenue` so the UI can label them honestly).
 * - `units_30d` is a genuine trailing-30-day units figure (d30 × 30).
 */
export function applyVelocity<T extends Record<string, unknown>>(rec: T, vel: Vel | undefined): T {
  const out = rec as Record<string, unknown>;
  out.total_units = rec.recent_units_sold ?? null;       // honest name: this is all-time
  out.total_revenue = rec.recent_revenue ?? null;        // honest name: this is all-time
  if (vel) {
    out.daily_velocity_estimate = vel.d30;               // corrected (was all-time/30)
    out.days_of_cover_estimate = vel.doc;                // corrected
    out.velocity_30d = vel.d30;
    out.velocity_60d = vel.d60;
    out.velocity_90d = vel.d90;
    out.velocity_180d = vel.d180;
    out.units_30d = vel.d30 != null ? Math.round(vel.d30 * 30) : null;
    out.units_60d = vel.d60 != null ? Math.round(vel.d60 * 60) : null;
    out.velocity_source = '30d (BigQuery summary)';
  } else {
    // No windowed velocity available (low/no-activity SKU): null rather than the inflated value.
    out.daily_velocity_estimate = null;
    out.days_of_cover_estimate = null;
    out.velocity_30d = null;
    out.velocity_60d = null;
    out.velocity_90d = null;
    out.units_30d = null;
    out.units_60d = null;
    out.velocity_source = 'no recent sales';
  }
  return out as T;
}
