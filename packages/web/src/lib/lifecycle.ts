import type { GanttRow, GanttMarker } from '../components/Gantt';
import { fmtDate, parseISO } from './dates';

// Shape of the synced procurement plan the API returns (per sales order / projection).
export interface LifecycleStream {
  orderBy: string | null;
  arrival: string | null;
  leadDays: number;
  carrier: string;
  port: string;
  mode: string;
  componentCount?: number;
  components: string[];
  formula?: string | null;
}
export interface LifecyclePlan {
  needBy: string | null;
  targetArrival: string | null;
  fillDays: number;
  orderNow: string | null;
  overdue: boolean;
  packaging: LifecycleStream;
  ingredients: LifecycleStream;
}
export interface LifecycleOrder {
  order_id: string;
  sku?: string | null;
  product_name?: string | null;
  order_date: string | null;
  required_date: string | null;
  formula?: string | null;
}

/**
 * Turn a sales order + its synced plan into Gantt lanes + milestone markers.
 * Lanes: ① sales order, ② procure packaging, ③ compound + ingredients, ④ fill & ready.
 * The two material streams are scheduled to arrive on the same day ("arrive together").
 */
export function buildLifecycle(order: LifecycleOrder, plan: LifecyclePlan): { rows: GanttRow[]; markers: GanttMarker[] } {
  if (!plan?.packaging || !plan?.ingredients) return { rows: [], markers: [] };
  const rows: GanttRow[] = [
    {
      id: 'so', label: '① Sales order', sublabel: `ordered ${fmtDate(parseISO(order.order_date))}`,
      color: 'var(--ink)', start: order.order_date, end: order.required_date,
      tooltip: `Sales order ${order.order_id}\nordered ${order.order_date} · need-by ${order.required_date}`,
    },
    {
      id: 'pkg', label: '② Procure packaging',
      sublabel: `${plan.packaging.componentCount ?? plan.packaging.components.length} components`,
      badge: 'CN', color: 'var(--warn)', start: plan.packaging.orderBy, end: plan.packaging.arrival,
      carrier: `${plan.packaging.carrier} · ${plan.packaging.port} (${plan.packaging.leadDays}d)`,
      tooltip: `Packaging — order by ${plan.packaging.orderBy} → arrive ${plan.packaging.arrival}\n${plan.packaging.mode} (modeled)`,
    },
    {
      id: 'ing', label: '③ Compound + ingredients', sublabel: order.formula ?? plan.ingredients.formula ?? 'bulk',
      badge: 'US', color: 'var(--accent)', start: plan.ingredients.orderBy, end: plan.ingredients.arrival,
      carrier: `${plan.ingredients.carrier} (${plan.ingredients.leadDays}d)`,
      tooltip: `Ingredients/compound — order by ${plan.ingredients.orderBy} → ready ${plan.ingredients.arrival}\n${plan.ingredients.mode} (modeled)`,
    },
    {
      id: 'fill', label: '④ Fill & ready', sublabel: `${plan.fillDays}d fill / QC`,
      color: 'var(--good)', start: plan.targetArrival, end: plan.needBy,
      tooltip: `Fill & release: ${plan.targetArrival} → ${plan.needBy}`,
    },
  ];
  const markers: GanttMarker[] = [
    { date: plan.targetArrival, label: 'arrive together', color: 'var(--cap)' },
    { date: plan.needBy, label: 'need-by', color: 'var(--crit)' },
  ];
  return { rows, markers };
}
