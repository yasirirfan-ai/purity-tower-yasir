import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { fmtDate, parseISO } from '../lib/dates';
import { Loading, ErrorState, Pill } from '../components/ui';
import { Gantt } from '../components/Gantt';
import { PoGantt, type PoTimeline } from '../components/PoGantt';
import { buildLifecycle } from '../lib/lifecycle';
import { useOpenSku } from '../App';
import { Ic } from '../lib/icons';

const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };
const ING_C = '#2f7d52', PKG_C = '#3f51b5';

interface StreamPlan {
  stream: 'packaging' | 'ingredients';
  country: string; imported: boolean; mode: string; carrier: string; port: string; leadDays: number; modeled: true;
  orderBy: string | null; arrival: string | null; componentCount?: number; components: string[]; formula?: string | null;
}
interface Plan {
  needBy: string | null; targetArrival: string | null; fillDays: number;
  orderNow: string | null; overdue: boolean; arrivalSpreadDays: number;
  packaging: StreamPlan; ingredients: StreamPlan;
}
interface SalesOrder {
  order_id: string; sku: string | null; product_name: string | null; ordered_quantity: number | null;
  status: string | null; order_date: string | null; required_date: string | null;
  formula: string | null; components: string[]; high_priority: boolean | null; plan: Plan;
}
interface SalesData {
  meta: { packagingLeadDays: number; ingredientLeadDays: number; fillDays: number; today: string };
  kpis: { openOrders: number; unitsToBuild: number; orderNowCount: number; earliestNeedBy: string | null };
  orders: SalesOrder[];
}

interface RawMaterial {
  order_id: string; vendor: string; sku: string | null; description: string | null;
  ordered_quantity: number | null; open_quantity: number | null;
  status: string | null; order_date: string | null; eta_date: string | null; expected_arrival_date: string | null;
  logistics: { country: string; imported: boolean; mode: string; carrier: string; modeled: boolean };
}
interface OrdersData {
  kpis: { openPoCount: number; openLineCount: number; openUnits: number };
  rawMaterials: RawMaterial[];
}

interface SkuGroup {
  key: string;
  orders: SalesOrder[];
  urgent: SalesOrder;
  productName: string;
  totalUnits: number;
}

interface VendorGroup {
  vendor: string; imported: boolean; country: string;
  lines: RawMaterial[]; totalUnits: number; earliestEta: string | null; earliestOrderBy: string | null;
  maxLeadDays: number | null;
}

const relLabel = (d: string | null, short = false) => {
  if (!d) return '—';
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return short ? `${-diff}d overdue` : `${-diff}d overdue`;
  if (diff === 0) return 'today';
  return `in ${diff}d`;
};

const daysDiff = (a: string | null, b: string | null) => {
  const am = parseISO(a), bm = parseISO(b);
  if (am == null || bm == null) return null;
  return Math.abs(Math.round((am - bm) / 86400000));
};

export function WhatToOrder() {
  const { data, loading, error } = useFetch<SalesData>('/api/sales-orders');
  const { data: ordersData } = useFetch<OrdersData>('/api/orders');
  const openSku = useOpenSku();
  const [search, setSearch] = useState('');
  const [selKey, setSelKey] = useState<string | null>(null);
  const [queuePage, setQueuePage] = useState(0);
  const PAGE_SIZE = 25;

  // All orders sorted by urgency
  const orders = useMemo(() => {
    let r = data?.orders ?? [];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((o) => `${o.order_id} ${o.sku} ${o.product_name}`.toLowerCase().includes(q));
    return [...r].sort((a, b) => (a.plan.orderNow ?? '9999').localeCompare(b.plan.orderNow ?? '9999'));
  }, [data, search]);

  // Deduplicate by SKU — one tab per product, pick most urgent order per group
  const skuGroups = useMemo<SkuGroup[]>(() => {
    const map = new Map<string, SalesOrder[]>();
    for (const o of orders) {
      const key = o.sku ?? o.order_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return [...map.values()]
      .map((group) => {
        const sorted = [...group].sort((a, b) => (a.plan.orderNow ?? '9999').localeCompare(b.plan.orderNow ?? '9999'));
        const urgent = sorted[0]!;
        return {
          key: urgent.sku ?? urgent.order_id,
          orders: sorted,
          urgent,
          productName: String(urgent.product_name ?? urgent.sku ?? urgent.order_id).replace(/\n/g, ' '),
          totalUnits: group.reduce((s, o) => s + (o.ordered_quantity ?? 0), 0),
        };
      })
      .sort((a, b) => (a.urgent.plan.orderNow ?? '9999').localeCompare(b.urgent.plan.orderNow ?? '9999'));
  }, [orders]);

  const selectedGroup = useMemo(
    () => skuGroups.find((g) => g.key === selKey) ?? skuGroups[0] ?? null,
    [skuGroups, selKey],
  );
  const selected = selectedGroup?.urgent ?? null;

  const vendors = useMemo<VendorGroup[]>(() => {
    const map = new Map<string, VendorGroup>();
    for (const m of ordersData?.rawMaterials ?? []) {
      let v = map.get(m.vendor);
      if (!v) {
        v = { vendor: m.vendor, imported: m.logistics.imported, country: m.logistics.country, lines: [], totalUnits: 0, earliestEta: null, earliestOrderBy: null, maxLeadDays: null };
        map.set(m.vendor, v);
      }
      v.lines.push(m);
      v.totalUnits += m.open_quantity ?? 0;
      const eta = m.eta_date ?? m.expected_arrival_date;
      if (eta && (!v.earliestEta || eta < v.earliestEta)) v.earliestEta = eta;
    }
    return [...map.values()].sort((a, b) => (a.earliestEta ?? '9999').localeCompare(b.earliestEta ?? '9999'));
  }, [ordersData]);

  const queue = useMemo(() => {
    return [...(ordersData?.rawMaterials ?? [])].sort((a, b) => {
      const da = a.eta_date ?? a.expected_arrival_date ?? '9999';
      const db = b.eta_date ?? b.expected_arrival_date ?? '9999';
      return da.localeCompare(db);
    });
  }, [ordersData]);

  const po = useFetch<{ orders: PoTimeline[] }>('/api/po-timeline');
  const poMap = useMemo(() => new Map((po.data?.orders ?? []).map((o) => [o.orderId, o])), [po.data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;
  const k = data.kpis;
  const ok = ordersData?.kpis;

  return (
    <div className="fade-in">
      {/* KPI grid */}
      <div className="kpi-grid">
        {[
          { label: 'POs to place within 7 days', value: num(k.orderNowCount), sub: `across ${num(skuGroups.length)} finished goods`, edge: 'var(--crit)', icon: Ic.alert },
          { label: 'Open order value', value: `${num(ok?.openPoCount ?? 0)} POs`, sub: `${num(ok?.openLineCount ?? 0)} lines · ${num(ok?.openUnits ?? 0)} open units`, edge: 'var(--cap)', icon: Ic.scale },
          { label: 'Earliest stock-out', value: fmtDate(parseISO(k.earliestNeedBy)), sub: relLabel(k.earliestNeedBy), edge: 'var(--warn)', icon: Ic.clock },
          { label: 'Vendors to engage', value: num(vendors.length), sub: `${num(queue.length)} line items`, edge: 'var(--ink)', icon: Ic.channels },
        ].map((kpi, i) => (
          <div className="kpi" key={i}>
            <div className="accent-edge" style={{ background: kpi.edge }} />
            <div className="label">{kpi.icon(ICO)}{kpi.label}</div>
            <div className="value">{kpi.value}</div>
            <div className="sub">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* How to read */}
      <div className="card" style={{ marginTop: 20, background: 'var(--surface-2)' }}>
        <div className="card-pad" style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {Ic.recon({ style: { width: 18, height: 18, color: 'var(--accent)', marginTop: 1, flex: 'none' } })}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, maxWidth: 780 }}>
            Orders are scheduled <strong>backward from each SKU's stock-out date</strong>. The ideal is <strong>every material landing just in time for the build</strong> — nothing arrives early to sit idle and tie up cash. Use the toggle on the timeline to compare a synced plan against ordering everything today. With <strong>net terms</strong> layered on, the goal is to <strong>sell the finished units before the supplier invoice comes due</strong>.
          </p>
        </div>
      </div>

      {/* Order timeline */}
      <div className="section-title" style={{ marginTop: 24 }}>
        <h2>Order timeline &amp; sync</h2>
        <div className="line" />
      </div>

      {/* SKU tabs — deduplicated by product */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div className="search" style={{ width: 220 }}>
          <span className="muted">⌕</span>
          <input placeholder="Filter orders…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {skuGroups.slice(0, 30).map((g) => {
          const sel = selectedGroup?.key === g.key;
          const label = relLabel(g.urgent.plan.orderNow);
          const overdue = g.urgent.plan.overdue;
          const name = g.productName.length > 32 ? g.productName.slice(0, 31) + '…' : g.productName;
          return (
            <button
              key={g.key}
              className={`tag${sel ? ' on' : ''}`}
              onClick={() => setSelKey(g.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <span style={{ fontSize: 10, color: overdue ? 'var(--crit)' : 'var(--muted)', fontWeight: 600, flex: 'none' }}>
                {label}
              </span>
            </button>
          );
        })}
        {skuGroups.length > 30 && (
          <span style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'center' }}>+{skuGroups.length - 30} more</span>
        )}
      </div>

      {/* Selected order Gantt */}
      {selected && selectedGroup && (
        <OrderPlan
          group={selectedGroup}
          order={selected}
          openSku={openSku}
          poTimeline={poMap.get(selected.order_id) ?? null}
          poLoading={po.loading}
        />
      )}

      {/* Vendor PO summary */}
      <div className="section-title" style={{ marginTop: 28 }}>
        <h2>Vendor PO summary</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Batch line items into one PO per supplier</span>
        <div className="line" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {vendors.map((v) => <VendorCard key={v.vendor} v={v} />)}
      </div>

      {/* Procurement queue */}
      <div className="section-title" style={{ marginTop: 28 }}>
        <h2>Procurement queue</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Every line, sorted by order-by date</span>
        <div className="line" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order by</th>
                <th>Component</th>
                <th>Vendor</th>
                <th>For</th>
                <th className="num">Order qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.slice(queuePage * PAGE_SIZE, (queuePage + 1) * PAGE_SIZE).map((m, i) => {
                const orderBy = m.order_date ?? m.eta_date ?? m.expected_arrival_date;
                const eta = m.eta_date ?? m.expected_arrival_date;
                const overdue = orderBy ? new Date(orderBy) < new Date() : false;
                const isImported = m.logistics.imported;
                const desc = String(m.description ?? m.sku ?? '').replace(/^\[[^\]]+\]\s*/, '').replace(/\n/g, ' ');
                const daysUntil = orderBy ? Math.round((new Date(orderBy).getTime() - Date.now()) / 86400000) : null;
                const statusTone = overdue ? 'crit' : daysUntil != null && daysUntil <= 0 ? 'warn' : daysUntil != null && daysUntil <= 7 ? 'cap' : 'neutral';
                const statusLabel = overdue ? 'Overdue' : daysUntil === 0 ? 'Order now' : daysUntil != null && daysUntil <= 7 ? 'Soon' : titleCase(String(m.status ?? 'Scheduled'));
                return (
                  <tr key={i} className="row">
                    <td>
                      <div style={{ fontWeight: 600 }}>{fmtDate(parseISO(orderBy))}</div>
                      <div style={{ fontSize: 11, color: overdue ? 'var(--crit)' : 'var(--muted)' }}>{relLabel(orderBy)}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="dotmark" style={{ background: isImported ? PKG_C : ING_C, flex: 'none' }} />
                        <span>
                          <span style={{ fontWeight: 500 }}>{desc.length > 38 ? desc.slice(0, 37) + '…' : desc}</span>
                          {eta && <span className="mono" style={{ display: 'block', fontSize: 10, color: 'var(--faint)' }}>ETA {fmtDate(parseISO(eta))}</span>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {isImported && (
                          <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: '#fbeee6', color: '#9a5418', borderRadius: 3, padding: '1px 4px' }}>
                            {m.logistics.country === 'China' ? 'CN' : m.logistics.country.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span style={{ fontSize: 12.5 }}>{m.vendor}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', maxWidth: 180 }}>
                        {String(m.sku ?? '—')}
                      </span>
                    </td>
                    <td className="num">{num(m.ordered_quantity ?? m.open_quantity)}</td>
                    <td><Pill band={statusTone}>{statusLabel}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {queue.length > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderTop: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {queuePage * PAGE_SIZE + 1}–{Math.min((queuePage + 1) * PAGE_SIZE, queue.length)} of {num(queue.length)} lines
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn"
                disabled={queuePage === 0}
                onClick={() => setQueuePage((p) => p - 1)}
                style={{ opacity: queuePage === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, Math.ceil(queue.length / PAGE_SIZE)) }, (_, i) => {
                const totalPages = Math.ceil(queue.length / PAGE_SIZE);
                const mid = Math.min(Math.max(queuePage, 2), totalPages - 3);
                const page = totalPages <= 5 ? i : mid - 2 + i;
                return page >= 0 && page < totalPages ? (
                  <button
                    key={page}
                    className="btn"
                    onClick={() => setQueuePage(page)}
                    style={{ minWidth: 32, background: page === queuePage ? 'var(--ink)' : undefined, color: page === queuePage ? '#fff' : undefined, borderColor: page === queuePage ? 'var(--ink)' : undefined }}
                  >
                    {page + 1}
                  </button>
                ) : null;
              })}
              <button
                className="btn"
                disabled={queuePage >= Math.ceil(queue.length / PAGE_SIZE) - 1}
                onClick={() => setQueuePage((p) => p + 1)}
                style={{ opacity: queuePage >= Math.ceil(queue.length / PAGE_SIZE) - 1 ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 12 }}>
        Carrier assignments and net terms are modeled — awaiting the vendor master. Lifecycle: packaging {data.meta.packagingLeadDays}d (CN ocean) · compound + fill {data.meta.ingredientLeadDays + data.meta.fillDays}d · inbound freight 9d · receive &amp; putaway 3d.
      </p>
    </div>
  );
}

function VendorCard({ v }: { v: VendorGroup }) {
  const overdue = v.earliestEta ? new Date(v.earliestEta) < new Date() : false;
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{v.lines.length} line{v.lines.length !== 1 ? 's' : ''}</div>
        </div>
        <span className={`origin-badge ${v.imported ? 'cn' : 'us'}`}>{v.imported ? 'CN' : 'US'}</span>
      </div>
      <div style={{ display: 'flex', gap: 20, margin: '13px 0 11px', alignItems: 'flex-end' }}>
        <div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{num(v.totalUnits)}</div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>open units</div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: overdue ? 'var(--crit)' : 'var(--ink)' }}>
            {fmtDate(parseISO(v.earliestEta))}
          </div>
          <div style={{ fontSize: 10.5, color: overdue ? 'var(--crit)' : 'var(--muted)' }}>
            earliest ETA · {relLabel(v.earliestEta)}
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {v.lines.slice(0, 5).map((l, i) => {
          const desc = String(l.description ?? l.sku ?? '').replace(/^\[[^\]]+\]\s*/, '').replace(/\n/g, ' ');
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span className="dotmark" style={{ background: l.logistics.imported ? PKG_C : ING_C, flex: 'none' }} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
              <span className="mono" style={{ color: 'var(--faint)', flex: 'none' }}>{num(l.open_quantity)}</span>
            </div>
          );
        })}
        {v.lines.length > 5 && <div style={{ fontSize: 11, color: 'var(--faint)', paddingLeft: 16 }}>+{v.lines.length - 5} more lines</div>}
      </div>
    </div>
  );
}

function OrderPlan({ group, order, openSku, poTimeline, poLoading }: {
  group: SkuGroup; order: SalesOrder; openSku: (s: string) => void;
  poTimeline: PoTimeline | null; poLoading: boolean;
}) {
  const p = order.plan;
  const noNeedBy = !p.targetArrival;
  const { rows, markers } = buildLifecycle(order, p);

  // Sync metrics
  const spreadDays = daysDiff(p.packaging.arrival, p.ingredients.arrival) ?? 0;
  const pkgMs = parseISO(p.packaging.arrival), ingMs = parseISO(p.ingredients.arrival);
  const laterMs = pkgMs != null && ingMs != null ? Math.max(pkgMs, ingMs) : null;
  const targetMs = parseISO(p.targetArrival);
  const idleDays = laterMs != null && targetMs != null ? Math.max(0, Math.round((targetMs - laterMs) / 86400000)) : 0;

  return (
    <>
      <div className="card card-pad">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>{group.productName}</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Target build {num(group.totalUnits)} units · {group.orders.length} PO{group.orders.length !== 1 ? 's' : ''}
              {group.orders.length > 1 && (
                <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--faint)' }}>
                  ({group.orders.map((o) => o.order_id).join(', ')})
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
            <button className="btn" style={{ background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' }}>
              Synced (JIT)
            </button>
            <button className="btn" onClick={() => order.sku && openSku(order.sku)}>
              Order all today
            </button>
          </div>
        </div>

        {noNeedBy ? (
          <div style={{ marginTop: 14, fontSize: 13, color: 'var(--muted)' }}>
            No required date — backward-scheduled timeline unavailable. Status: {titleCase(String(order.status ?? ''))}.
          </div>
        ) : (
          <>
            {/* Sync metrics — design style */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--hairline)', border: '1px solid var(--hairline)', borderRadius: 9, overflow: 'hidden', marginTop: 16 }}>
              <SyncMetric
                label="Sellable at 3PL"
                value={fmtDate(parseISO(p.needBy))}
                sub={relLabel(p.needBy)}
                tone={p.overdue ? 'var(--crit)' : undefined}
              />
              <SyncMetric
                label="Arrival spread"
                value={`${spreadDays}d`}
                sub={spreadDays === 0 ? 'tight — lands JIT' : `${spreadDays}d gap between streams`}
                tone={spreadDays > 7 ? 'var(--warn)' : undefined}
              />
              <SyncMetric
                label="Idle material-days"
                value={String(idleDays)}
                sub={idleDays === 0 ? 'nothing waiting — ideal' : `${idleDays}d sitting before fill`}
                tone={idleDays > 0 ? 'var(--warn)' : undefined}
              />
              <SyncMetric
                label="Fill & ready"
                value={`${p.fillDays}d`}
                sub={`${fmtDate(parseISO(p.targetArrival))} → ${fmtDate(parseISO(p.needBy))}`}
              />
            </div>
            <div style={{ marginTop: 18 }}>
              <Gantt rows={rows} markers={markers} />
            </div>
          </>
        )}
      </div>

      {/* Two procurement streams */}
      {!noNeedBy && (
        <div className="grid-2" style={{ marginTop: 14 }}>
          <StreamCard title="② Packaging" color={PKG_C} badge="CN" s={p.packaging} openSku={openSku} />
          <StreamCard title="③ Ingredients / compound" color={ING_C} badge="US" s={p.ingredients} openSku={openSku} formula={order.formula} />
        </div>
      )}

      {!noNeedBy && (
        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="eyebrow">Per-component PO timeline</div>
          <p style={{ margin: '8px 0 14px', fontSize: 13, color: 'var(--muted)' }}>
            Each packaging and ingredient line for this order — <b>real ordered-status</b> from raw-material POs, scheduled backward from need-by.
          </p>
          {poLoading ? (
            <div style={{ color: 'var(--muted)' }}>Loading PO timeline…</div>
          ) : poTimeline ? (
            <PoGantt t={poTimeline} />
          ) : (
            <div style={{ color: 'var(--muted)' }}>No per-component timeline available for this order.</div>
          )}
        </div>
      )}
    </>
  );
}

function SyncMetric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '14px 16px' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: tone ?? 'var(--ink)', letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function StreamCard({ title, color, badge, s, openSku, formula }: { title: string; color: string; badge: string; s: StreamPlan; openSku: (x: string) => void; formula?: string | null }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: color, marginRight: 8 }} />{title}</h3>
        <span className={`origin-badge ${badge === 'CN' ? 'cn' : 'us'}`}>{badge}</span>
      </div>
      <div className="card-pad">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <M k="Order by" v={fmtDate(parseISO(s.orderBy))} />
          <M k="Arrives" v={fmtDate(parseISO(s.arrival))} />
          <M k="Lead time" v={`${s.leadDays} days`} />
          <M k="Mode" v={s.mode} />
        </div>
        <div className="logi-note">
          🚢 <b>{s.carrier}</b>{s.port !== '—' ? ` · ${s.port}` : ''}{' '}
          <span className="pill neutral" style={{ marginLeft: 6 }}>modeled</span>
        </div>
        {formula && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10 }}>Formula: <b>{formula}</b></div>}
        {s.components.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              {s.stream === 'packaging' ? 'Packaging components' : 'Material components'} ({s.components.length})
            </div>
            <div className="chip-bar">
              {s.components.map((c) => (
                <button key={c} className="tag" onClick={() => openSku(c)} title="Open component">{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function M({ k, v, crit }: { k: string; v: React.ReactNode; crit?: boolean }) {
  return (
    <div className="m">
      <div className="k">{k}</div>
      <div className="v" style={{ color: crit ? 'var(--crit)' : undefined, fontSize: 15 }}>{v}</div>
    </div>
  );
}
