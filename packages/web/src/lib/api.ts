import { useEffect, useState } from 'react';

export type Dict = Record<string, unknown>;

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`);
  return (await res.json()) as T;
}

/** Generic data-fetch hook with loading/error state. */
export function useFetch<T>(path: string | null): { data: T | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setError(null);
    get<T>(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, loading, error };
}

// ── Typed shapes for the bits we actually use (loose; we follow real data) ──
export interface Summary extends Dict {
  sku_count?: number;
  channel_count?: number;
  finished_goods_on_hand?: number;
  recent_units_sold?: number;
  recent_revenue?: number;
  units_30d_total?: number;   // real trailing-30d units (sum of per-SKU 30d velocity x 30)
  total_units?: number;       // all-time (the doc's "recent_*" are actually all-time)
  total_revenue?: number;
  average_component_match_rate?: number;
  forecast_units_6m?: number;
  forecast_revenue_6m?: number;
  open_finished_goods_order_quantity?: number;
  open_raw_material_order_quantity?: number;
  production_suggested_build_quantity?: number;
  data_quality_score?: number;
  latest_ingestion_date?: string;
  exception_counts?: Record<string, number>;
  readiness_counts?: Record<string, number>;
  production_plan_counts?: Record<string, number>;
  action_recommendation_counts?: Record<string, number>;
  top_risk_skus?: Array<Dict>;
}

export interface SkuSummary extends Dict {
  id: string;
  sku?: string;
  product_name?: string;
  finished_goods_on_hand?: number;
  recent_units_sold?: number;
  recent_revenue?: number;
  daily_velocity_estimate?: number | null;
  days_of_cover_estimate?: number | null;
  risk_band?: string;
  sales_channels?: Record<string, number>;
  inventory_channels?: Record<string, number>;
  // corrected / honest fields added by the API velocity overlay
  velocity_30d?: number | null;
  velocity_60d?: number | null;
  velocity_90d?: number | null;
  units_30d?: number | null;
  units_60d?: number | null;
  total_units?: number | null;     // all-time (was mislabeled "recent")
  total_revenue?: number | null;   // all-time
  velocity_source?: string;
}
