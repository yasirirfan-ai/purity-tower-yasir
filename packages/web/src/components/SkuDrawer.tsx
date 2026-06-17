import { useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, money, num1, titleCase } from '../lib/format';
import { fmtDate, parseISO } from '../lib/dates';
import { Gantt } from './Gantt';
import { PoGantt, type PoTimeline } from './PoGantt';
import { buildLifecycle, type LifecycleOrder, type LifecyclePlan } from '../lib/lifecycle';

// ── API shapes ─────────────────────────────────────────────────────────────
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
interface ReviewItem { stars: number; date?: string; flag?: string; text: string }
interface ReviewEntry { sku: string; count?: number; avg?: number; dist?: Record<string, number>; critical?: number; status?: string; reviews?: ReviewItem[] }
interface ArtworkComponent { cid: string; type: string; material?: string; finish?: string; printer?: string; proof: { stage: string; version: string; owner?: string; updated?: string | null } }
interface ArtworkEntry { sku: string; components?: ArtworkComponent[] }
interface DossierSection { id: string; label: string; status: 'on-file' | 'pending' | 'missing' }
interface DossierEntry { sku: string; sections?: DossierSection[]; onFile?: number; total?: number; pct?: number; dossierStatus?: string }

// ── Helpers ─────────────────────────────────────────────────────────────────
const usdK = (n: unknown) => {
  const v = Number(n);
  if (!Number.isFinite(v) || n == null) return '—';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return '$' + Math.round(v / 1e3) + 'k';
  return '$' + Math.round(v);
};

const riskTone: Record<string, string> = {
  good: 'good', stockout: 'crit', critical: 'crit', crit: 'crit',
  warning: 'warn', warn: 'warn', overstock: 'cap', over: 'cap',
};

const coverColor = (doc: number) =>
  doc < 30 ? 'var(--crit)' : doc < 60 ? 'var(--warn)' : doc < 365 ? 'var(--good)' : 'var(--cap)';

const proofTone: Record<string, { bg: string; fg: string; label: string; dot: string }> = {
  approved:      { bg: '#e8f5e9', fg: '#2f7d52', label: 'Approved',    dot: 'var(--good)' },
  'in-review':   { bg: '#e3f2fd', fg: '#1565c0', label: 'In review',   dot: '#1565c0' },
  revise:        { bg: '#fff3e0', fg: '#e65100', label: 'Revise',       dot: 'var(--warn)' },
  'not-started': { bg: 'var(--surface-2)', fg: 'var(--muted)', label: 'Not started', dot: 'var(--hairline)' },
};

const sectionIcon: Record<string, string> = { 'on-file': '✓', pending: '○', missing: '✗' };
const sectionTone: Record<string, string> = { 'on-file': 'var(--good)', pending: 'var(--warn)', missing: 'var(--crit)' };

const bannerCfg: Record<string, { tone: string; title: string; msg: string }> = {
  good:     { tone: 'good', title: 'Healthy position',  msg: 'Stock and velocity are in balance for this SKU.' },
  stockout: { tone: 'crit', title: 'Stockout',          msg: 'Zero inventory with active demand — revenue is being lost today.' },
  critical: { tone: 'crit', title: 'Critical',          msg: 'Under 30 days of cover — will stock out within the replenishment lead time.' },
  crit:     { tone: 'crit', title: 'Critical',          msg: 'Under 30 days of cover — will stock out within the replenishment lead time.' },
  warning:  { tone: 'warn', title: 'Watch',             msg: '30–60 days of cover — approaching critical zone.' },
  warn:     { tone: 'warn', title: 'Watch',             msg: '30–60 days of cover — approaching critical zone.' },
  overstock: { tone: 'cap', title: 'Overstocked',       msg: 'More than a year of cover. Capital tied up that could fund packaging.' },
};

// ── Root ────────────────────────────────────────────────────────────────────
export function SkuDrawer({ sku, onClose }: { sku: string; onClose: () => void }) {
  const { data, loading, error } = useFetch<SkuDetail>(`/api/skus/${encodeURIComponent(sku)}`);
  const { data: allReviews }    = useFetch<ReviewEntry[]>('/api/reviews');
  const { data: allArtwork }    = useFetch<ArtworkEntry[]>('/api/artwork');
  const { data: allReg }        = useFetch<{ dossiers: DossierEntry[] }>('/api/regulatory');
  const { data: poData }        = useFetch<{ orders: PoTimeline[] }>('/api/po-timeline');

  const s = data?.summary ?? {};
  const r = data?.readiness ?? {};
  const p = data?.plan ?? {};

  const reviewData  = allReviews?.find((x) => x.sku === sku)              ?? null;
  const artworkData = allArtwork?.find((x) => x.sku === sku)              ?? null;
  const dossierData = allReg?.dossiers.find((x) => x.sku === sku)         ?? null;
  const poMap       = new Map((poData?.orders ?? []).map((o) => [o.orderId, o]));

  const doc = s.days_of_cover_estimate as number | null;
  const rb  = String(s.risk_band ?? '').toLowerCase();
  const tone = riskTone[rb] ?? 'neutral';
  const banner = bannerCfg[rb] ?? null;

  const earliestExpiry = (data?.lots ?? [])
    .map((l) => l.expiration_date as string | null)
    .filter((x): x is string => !!x)
    .sort()[0] ?? null;

  const expiryDaysLabel = earliestExpiry
    ? (() => { const d = Math.round((new Date(earliestExpiry).getTime() - Date.now()) / 86400000); return d > 0 ? `${d}d` : 'expired'; })()
    : undefined;

  const lotCount = (data?.lots ?? []).length;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`SKU ${sku}`}>

        {/* Header */}
        <div className="drawer-head">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{sku}</div>
              <h2 style={{ margin: 0, fontSize: 20, letterSpacing: '-.02em', lineHeight: 1.2 }}>
                {String((s.product_name as string) || (r.product_name as string) || sku)}
              </h2>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                {rb && <span className={`pill ${tone}`} style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' }}>{rb}</span>}
                {doc != null && <span className="pill neutral" style={{ fontSize: 11, fontWeight: 600 }}>{Math.round(doc)}d</span>}
                {(r.readiness_band as string) && <span className="pill neutral" style={{ fontSize: 11 }}>readiness: {titleCase(String(r.readiness_band))}</span>}
              </div>
            </div>
            <button className="btn" onClick={onClose} style={{ flex: 'none' }}>Close ✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {loading && <div className="muted">Loading…</div>}
          {error && <div style={{ color: 'var(--crit)' }} className="mono">{error}</div>}

          {data && (
            <>
              {/* KPI cards 2×3 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                <KpiCard label="On hand"       value={num(s.finished_goods_on_hand)}                                    unit="units" />
                <KpiCard label="Lots"          value={num(lotCount)}                                                    unit="in 3PL" />
                <KpiCard label="60-day sales"  value={s.units_60d != null ? num(s.units_60d) : '—'}                    unit="units" />
                <KpiCard label="60-day revenue" value={usdK(s.total_revenue)} />
                <KpiCard label="Daily velocity" value={s.daily_velocity_estimate != null ? num1(s.daily_velocity_estimate as number) : '—'} unit="units/day" />
                <KpiCard label="Earliest expiry" value={earliestExpiry ? fmtDate(parseISO(earliestExpiry)) : '—'}      unit={expiryDaysLabel} />
              </div>

              {/* Days of cover bar */}
              {doc != null && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Days of cover</div>
                  <div style={{ position: 'relative', height: 10, background: 'var(--hairline)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 6, background: coverColor(doc), width: `${Math.min(100, (doc / 540) * 100)}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: 'var(--faint)' }}>
                    <span>0</span><span>30d</span><span>60d</span><span>365d</span><span>540d+</span>
                  </div>
                </div>
              )}

              {/* Status banner */}
              {banner && (
                <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 10, marginBottom: 18, background: banner.tone === 'good' ? '#e8f5e9' : banner.tone === 'crit' ? '#fdecea' : banner.tone === 'warn' ? '#fff8e1' : '#e8f4fd' }}>
                  <span style={{ fontSize: 16 }}>{banner.tone === 'crit' ? '🔴' : '⚠'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, color: banner.tone === 'good' ? 'var(--good)' : banner.tone === 'crit' ? 'var(--crit)' : banner.tone === 'warn' ? '#b45309' : 'var(--cap)' }}>{banner.title}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{banner.msg}</div>
                  </div>
                </div>
              )}

              {/* Artwork & proofs */}
              {artworkData?.components && artworkData.components.length > 0 && (() => {
                const approved = artworkData.components!.filter((c) => c.proof.stage === 'approved').length;
                return (
                  <DrawerSection title="Artwork & proofs" badge={`${approved} / ${artworkData.components!.length} approved`} badgeTone="warn">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {artworkData.components!.map((c) => {
                        const pt = proofTone[c.proof.stage] ?? proofTone['not-started']!;
                        return (
                          <div key={c.cid} style={{ border: '1px solid var(--hairline)', borderRadius: 10, padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: pt.dot, display: 'inline-block', flex: 'none' }} />
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.type}</div>
                                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{c.cid}</div>
                                </div>
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: pt.bg, color: pt.fg, flex: 'none' }}>
                                {c.proof.version !== '—' ? `${c.proof.version} · ` : ''}{pt.label}
                              </span>
                            </div>
                            {(c.material || c.finish || c.printer) && (
                              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>
                                {[c.material, c.finish].filter(Boolean).join(' · ')}
                                {c.printer && <> · Printer <b style={{ color: 'var(--ink)' }}>{c.printer}</b></>}
                                {c.proof.updated && <> · Updated <b style={{ color: 'var(--ink)' }}>{c.proof.updated}</b></>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </DrawerSection>
                );
              })()}

              {/* Regulatory dossier */}
              {dossierData && (
                <DrawerSection
                  title="Regulatory dossier"
                  badge={dossierData.dossierStatus === 'gaps' ? 'Gaps' : dossierData.dossierStatus === 'partial' ? 'Partial' : 'Complete'}
                  badgeTone={dossierData.dossierStatus === 'complete' ? 'good' : dossierData.dossierStatus === 'partial' ? 'warn' : 'crit'}
                  right={`${dossierData.onFile ?? 0}/${dossierData.total ?? 0} on file`}
                >
                  <div style={{ height: 8, borderRadius: 5, background: 'var(--hairline)', overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', background: 'var(--crit)', borderRadius: 5, width: `${Math.round((dossierData.pct ?? 0) * 100)}%` }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>{Math.round((dossierData.pct ?? 0) * 100)}%</div>
                  {(dossierData.sections ?? []).map((sec) => (
                    <div key={sec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--hairline)', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: sectionTone[sec.status], fontWeight: 700, width: 14, textAlign: 'center', flex: 'none' }}>{sectionIcon[sec.status]}</span>
                        <span style={{ fontSize: 13 }}>{sec.label}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: sectionTone[sec.status], flex: 'none' }}>
                        {sec.status === 'on-file' ? 'On file' : sec.status === 'pending' ? 'In progress' : 'Missing'}
                      </span>
                    </div>
                  ))}
                </DrawerSection>
              )}

              {/* Customer reviews */}
              {reviewData && <ReviewsSection data={reviewData} />}

              {/* Bottleneck components */}
              {Array.isArray(r.bottleneck_components) && (r.bottleneck_components as Dict[]).length > 0 && (
                <DrawerSection title={`Bottleneck components (${(r.missing_component_count as number) ?? '—'} missing of ${(r.component_count as number) ?? '—'})`}>
                  <div className="stack">
                    {(r.bottleneck_components as Dict[]).slice(0, 12).map((c, i) => (
                      <div key={i} className="row-between" style={{ fontSize: 13 }}>
                        <span className="mono">{String(c.sku)}</span>
                        <span className="muted">on hand: {num(c.quantity_on_hand)}</span>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}

              {/* Inventory by lot */}
              {data.lots.length > 0 && (
                <DrawerSection title={`Inventory by lot / channel (${data.lots.length})`}>
                  <div className="tbl-wrap">
                    <table className="data">
                      <thead><tr><th>Channel</th><th>Lot</th><th className="num">On hand</th><th>Expires</th><th>Snapshot</th></tr></thead>
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
                </DrawerSection>
              )}

              {/* Monthly sales */}
              {data.sales.length > 0 && (
                <DrawerSection title="Monthly sales">
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
                </DrawerSection>
              )}

              {/* Recommended actions */}
              {data.actions.length > 0 && (
                <DrawerSection title="Recommended actions">
                  <div className="stack">
                    {data.actions.map((a, i) => (
                      <div key={i} className="card card-pad">
                        <div className="row-between">
                          <span className={`pill ${riskTone[String(a.priority ?? '').toLowerCase()] ?? 'neutral'}`}>{titleCase(String(a.action_type ?? a.priority ?? 'action'))}</span>
                          <span className="muted" style={{ fontSize: 12 }}>urgency {num(a.urgency_score)}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13 }}>{String(a.recommended_action ?? '')}</div>
                      </div>
                    ))}
                  </div>
                </DrawerSection>
              )}

              {/* Production plan */}
              {p.recommended_action != null && (
                <DrawerSection title="Production plan">
                  <div style={{ fontSize: 13 }}>{String(p.recommended_action)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Constraint: {String(p.constraint ?? '—')} · Scheduled week: {String(p.scheduled_week ?? '—')} · Earliest required: {String(p.earliest_required_date ?? '—')}
                  </div>
                </DrawerSection>
              )}

              {/* Lifecycle Gantt */}
              <LifecycleSection salesOrders={data.salesOrders ?? []} projected={data.projected ?? null} poMap={poMap} />
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function KpiCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div style={{ border: '1px solid var(--hairline)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)', marginLeft: 5 }}>{unit}</span>}
      </div>
    </div>
  );
}

function DrawerSection({ title, badge, badgeTone, right, children }: {
  title: string; badge?: string; badgeTone?: string; right?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        {badge && <span className={`pill ${badgeTone ?? 'neutral'}`} style={{ fontSize: 11 }}>{badge}</span>}
        {right && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function Stars({ val, size = 11 }: { val: number; size?: number }) {
  const full = Math.round(val);
  return (
    <span style={{ fontSize: size, letterSpacing: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= full ? '#f1a500' : 'var(--hairline)' }}>★</span>
      ))}
    </span>
  );
}

function ReviewsSection({ data }: { data: ReviewEntry }) {
  const [tab, setTab] = useState<'notable' | 'flagged' | 'low'>('notable');
  const reviews = data.reviews ?? [];
  const dist = data.dist ?? {};
  const total = data.count ?? reviews.length;
  const avg = data.avg ?? 0;
  const flagged = reviews.filter((r) => r.flag);
  const low = reviews.filter((r) => r.stars <= 2);
  const shown = tab === 'flagged' ? flagged : tab === 'low' ? low : reviews;
  const maxDist = Math.max(1, ...Object.values(dist));

  return (
    <DrawerSection title="Customer reviews" right={`${num(total)} reviews`} badge={data.status === 'issue' ? 'Issue' : undefined} badgeTone="crit">
      <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
        <div style={{ textAlign: 'center', flex: 'none' }}>
          <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1 }}>{avg.toFixed(2)}</div>
          <Stars val={avg} size={13} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>90d ▲ 0.0 ({avg.toFixed(2)})</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[5, 4, 3, 2, 1].map((n) => {
            const count = dist[String(n)] ?? 0;
            const color = n >= 4 ? 'var(--good)' : n === 3 ? '#c49a00' : 'var(--crit)';
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, textAlign: 'right', color: 'var(--muted)' }}>{n}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--hairline)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: color, width: `${(count / maxDist) * 100}%`, borderRadius: 3 }} />
                </div>
                <span style={{ width: 20, color: 'var(--muted)', textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(data.critical ?? 0) > 0 && (
        <div style={{ background: '#fdecea', border: '1px solid #ffcdd2', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13 }}>
          <span style={{ color: 'var(--crit)', fontWeight: 700 }}>{data.critical} flagged review{(data.critical ?? 0) !== 1 ? 's' : ''}</span>
          <span style={{ color: 'var(--muted)' }}> — adverse reaction or quality complaint. Review before reordering.</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {([['notable', 'Notable'], ['flagged', `Flagged (${flagged.length})`], ['low', '1–2★']] as const).map(([id, label]) => (
          <button key={id} className={`tag${tab === id ? ' on' : ''}`} onClick={() => setTab(id)} style={{ fontWeight: tab === id ? 700 : 400 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {shown.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)' }}>No reviews in this category.</div>}
        {shown.map((rv, i) => (
          <div key={i} style={{ border: rv.flag ? '1px solid #ffcdd2' : '1px solid var(--hairline)', borderLeft: `3px solid ${rv.flag ? 'var(--crit)' : 'var(--hairline)'}`, borderRadius: 8, padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Stars val={rv.stars} size={11} />
                {rv.flag && <span className="pill crit" style={{ fontSize: 10 }}>Flagged</span>}
              </div>
              {rv.date && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{rv.date}</span>}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.55 }}>{rv.text}</div>
          </div>
        ))}
      </div>
    </DrawerSection>
  );
}

function LifecycleSection({ salesOrders, projected, poMap }: {
  salesOrders: SalesOrderWithPlan[];
  projected: { order: SalesOrderWithPlan; plan: LifecyclePlan } | null;
  poMap: Map<string, PoTimeline>;
}) {
  const hasOrders = salesOrders.length > 0;
  const list = hasOrders ? salesOrders : (projected ? [projected.order] : []);
  const [sel, setSel] = useState(0);

  if (list.length === 0) {
    return (
      <DrawerSection title="Product lifecycle">
        <div className="muted" style={{ fontSize: 13 }}>
          No open production order and no days-of-cover available — backward-scheduled timeline unavailable (often a bundle or SKU with no BOM).
        </div>
      </DrawerSection>
    );
  }

  const order = list[Math.min(sel, list.length - 1)]!;
  const plan = order.plan;

  if (!plan?.packaging || !plan?.ingredients) {
    return (
      <DrawerSection title="Product lifecycle">
        <div className="muted" style={{ fontSize: 13 }}>No procurement timeline available for this SKU (plan data is incomplete).</div>
      </DrawerSection>
    );
  }

  const { rows, markers } = buildLifecycle(order, plan);
  const poTimeline = poMap.get(order.order_id) ?? null;

  return (
    <DrawerSection title={hasOrders ? `Product lifecycle — ${order.order_id}` : 'Product lifecycle (projected)'}>
      {!hasOrders && (
        <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
          No open production order — projected from days-of-cover. Lead times &amp; carriers are modeled.
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'var(--hairline)', border: '1px solid var(--hairline)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
        {([['Order now by', fmtDate(parseISO(plan.orderNow))], ['Arrive together', fmtDate(parseISO(plan.targetArrival))], ['Fill & ready', `${plan.fillDays} days`], ['Need-by', fmtDate(parseISO(plan.needBy))]] as const).map(([k, v]) => (
          <div key={k} style={{ background: 'var(--surface)', padding: '10px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>{v}</div>
          </div>
        ))}
      </div>
      <Gantt rows={rows} markers={markers} />
      {poTimeline && (
        <div style={{ marginTop: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Per-component PO timeline</div>
          <PoGantt t={poTimeline} />
        </div>
      )}
    </DrawerSection>
  );
}
