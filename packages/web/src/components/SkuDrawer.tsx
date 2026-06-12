import { useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, money, num1, titleCase } from '../lib/format';
import { fmtDate, parseISO } from '../lib/dates';
import { Pill } from './ui';
import { Gantt } from './Gantt';
import { buildLifecycle, type LifecycleOrder, type LifecyclePlan } from '../lib/lifecycle';

interface SalesOrderWithPlan extends LifecycleOrder {
  ordered_quantity?: number | null;
  status?: string | null;
  plan: LifecyclePlan;
}
interface SkuDetail {
  sku: string;
  summary: Dict | null;
  readiness: Dict | null;
  plan: Dict | null;
  exceptions: Dict[];
  actions: Dict[];
  lots: Dict[];
  sales: Dict[];
  salesOrders: SalesOrderWithPlan[];
  projected: { order: SalesOrderWithPlan; plan: LifecyclePlan } | null;
}

export function SkuDrawer({ sku, onClose }: { sku: string; onClose: () => void }) {
  const { data, loading, error } = useFetch<SkuDetail>(`/api/skus/${encodeURIComponent(sku)}`);
  const s = data?.summary ?? {};
  const r = data?.readiness ?? {};
  const p = data?.plan ?? {};

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`SKU ${sku}`}>
        <div className="drawer-head">
          <div className="row-between">
            <div>
              <div className="mono muted" style={{ fontSize: 12 }}>{sku}</div>
              <h2 style={{ margin: '4px 0 0', fontSize: 18 }}>
                {String((s.product_name as string) || (r.product_name as string) || sku)}
              </h2>
            </div>
            <button className="btn" onClick={onClose}>Close ✕</button>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {s.risk_band != null && <Pill band={s.risk_band}>{titleCase(String(s.risk_band))}</Pill>}
            {r.readiness_band != null && <Pill band={r.readiness_band}>readiness: {titleCase(String(r.readiness_band))}</Pill>}
            {p.status != null && <Pill band={p.status}>plan: {titleCase(String(p.status))}</Pill>}
          </div>
        </div>
        <div className="drawer-body">
          {loading && <div className="muted">Loading detail…</div>}
          {error && <div style={{ color: 'var(--crit)' }} className="mono">{error}</div>}
          {data && (
            <>
              <div className="metric-grid">
                <Metric k="On hand" v={num(s.finished_goods_on_hand)} />
                <Metric k="Days of cover" v={s.days_of_cover_estimate == null ? '—' : num(s.days_of_cover_estimate)} />
                <Metric k="Daily velocity (30d)" v={s.daily_velocity_estimate == null ? '—' : num1(s.daily_velocity_estimate)} />
                <Metric k="Velocity 60d / 90d" v={`${s.velocity_60d == null ? '—' : num1(s.velocity_60d)} / ${s.velocity_90d == null ? '—' : num1(s.velocity_90d)}`} />
                <Metric k="Units sold (30d)" v={s.units_30d == null ? '—' : num(s.units_30d)} />
                <Metric k="Units sold (60d)" v={s.units_60d == null ? '—' : num(s.units_60d)} />
                <Metric k="Units sold (all-time)" v={num(s.total_units ?? s.recent_units_sold)} />
                <Metric k="Revenue (all-time)" v={money(s.total_revenue ?? s.recent_revenue)} />
                <Metric k="Match rate" v={r.match_rate != null ? `${num(r.match_rate)}%` : '—'} />
                <Metric k="Buildable now" v={num(r.buildable_units_estimate)} />
                <Metric k="Suggested build" v={num(p.suggested_build_quantity)} />
              </div>

              <LifecycleSection salesOrders={data.salesOrders ?? []} projected={data.projected ?? null} />

              {Array.isArray(r.bottleneck_components) && (r.bottleneck_components as Dict[]).length > 0 && (
                <Section title={`Bottleneck components (${(r.missing_component_count as number) ?? '—'} missing of ${(r.component_count as number) ?? '—'})`}>
                  <div className="stack">
                    {(r.bottleneck_components as Dict[]).slice(0, 12).map((c, i) => (
                      <div key={i} className="row-between" style={{ fontSize: 13 }}>
                        <span className="mono">{String(c.sku)}</span>
                        <span className="muted">on hand: {num(c.quantity_on_hand)}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {data.lots.length > 0 && (
                <Section title={`Inventory by lot / channel (${data.lots.length})`}>
                  <div className="tbl-wrap">
                    <table className="data">
                      <thead>
                        <tr><th>Channel</th><th>Lot</th><th className="num">On hand</th><th>Expires</th><th>Snapshot</th></tr>
                      </thead>
                      <tbody>
                        {data.lots.slice(0, 30).map((l, i) => (
                          <tr key={i}>
                            <td>{String(l.channel ?? '')}</td>
                            <td className="mono" style={{ fontSize: 11 }}>{String(l.lot_number ?? '—')}</td>
                            <td className="num">{num(l.quantity_on_hand)}</td>
                            <td>{String(l.expiration_date ?? '—')}</td>
                            <td className="muted">{String(l.snapshot_date ?? '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {data.sales.length > 0 && (
                <Section title="Monthly sales">
                  <div className="tbl-wrap">
                    <table className="data">
                      <thead><tr><th>Month</th><th>Channel</th><th className="num">Units</th><th className="num">Revenue</th></tr></thead>
                      <tbody>
                        {data.sales.slice(-18).map((m, i) => (
                          <tr key={i}>
                            <td className="mono" style={{ fontSize: 12 }}>{String(m.sale_month)}</td>
                            <td>{String(m.channel ?? '')}</td>
                            <td className="num">{num(m.units)}</td>
                            <td className="num">{money(m.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {data.actions.length > 0 && (
                <Section title="Recommended actions">
                  <div className="stack">
                    {data.actions.map((a, i) => (
                      <div key={i} className="card card-pad">
                        <div className="row-between">
                          <Pill band={a.priority}>{titleCase(String(a.action_type ?? a.priority ?? 'action'))}</Pill>
                          <span className="muted" style={{ fontSize: 12 }}>urgency {num(a.urgency_score)}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>{String(a.recommended_action ?? '')}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {p.recommended_action != null && (
                <Section title="Production plan">
                  <div style={{ fontSize: 13 }}>{String(p.recommended_action)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Constraint: {String(p.constraint ?? '—')} · Scheduled week: {String(p.scheduled_week ?? '—')} · Earliest required: {String(p.earliest_required_date ?? '—')}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Metric({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="m">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section-gap">
      <div className="eyebrow" style={{ marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

/**
 * Product lifecycle Gantt for this SKU: how to procure packaging + ingredients so they
 * arrive together in time to fill and meet the order's need-by. Uses real open orders
 * when present, otherwise a projected timeline from the SKU's days-of-cover.
 */
function LifecycleSection({ salesOrders, projected }: { salesOrders: SalesOrderWithPlan[]; projected: { order: SalesOrderWithPlan; plan: LifecyclePlan } | null }) {
  const hasOrders = salesOrders.length > 0;
  const list = hasOrders ? salesOrders : (projected ? [projected.order] : []);
  const [sel, setSel] = useState(0);

  if (list.length === 0) {
    return (
      <Section title="Product lifecycle">
        <div className="muted" style={{ fontSize: 13 }}>
          No open production order and no days-of-cover available, so a backward-scheduled timeline can't be drawn for this SKU
          (often a bundle or a SKU with no BOM).
        </div>
      </Section>
    );
  }

  const order = list[Math.min(sel, list.length - 1)]!;
  const plan = order.plan;
  const { rows, markers } = buildLifecycle(order, plan);

  return (
    <Section title={hasOrders ? `Product lifecycle — order ${order.order_id}` : 'Product lifecycle (projected)'}>
      {!hasOrders && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          No open production order — projected from days-of-cover (need-by ≈ stock-out date). Lead times & carriers are modeled.
        </div>
      )}
      {hasOrders && list.length > 1 && (
        <div className="chip-bar" style={{ marginBottom: 10 }}>
          {list.map((o, i) => (
            <button key={o.order_id} className={`tag${i === sel ? ' on' : ''}`} onClick={() => setSel(i)}>
              {o.order_id} · need-by {fmtDate(parseISO(o.required_date))}
            </button>
          ))}
        </div>
      )}
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 14 }}>
        <Metric k="Order now by" v={fmtDate(parseISO(plan.orderNow))} />
        <Metric k="Arrive together" v={fmtDate(parseISO(plan.targetArrival))} />
        <Metric k="Fill & ready" v={`${plan.fillDays} days`} />
        <Metric k="Need-by" v={fmtDate(parseISO(plan.needBy))} />
      </div>
      <Gantt rows={rows} markers={markers} />
      <div className="faint" style={{ fontSize: 11, marginTop: 8 }}>
        Packaging (CN · Ocean) and ingredients/compound are scheduled to arrive the same day, then filled ({plan.fillDays}d) by need-by.
      </div>
    </Section>
  );
}
