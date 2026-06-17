import { type ReactNode, useState } from 'react';
import { useFetch, type Summary, type Dict, type SkuSummary } from '../lib/api';
import { Ic } from '../lib/icons';
import { num, money } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { useOpenSku, useGoView } from '../App';

interface SkuList { count: number; total: number; skus: SkuSummary[]; }

const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };
const CHEV = { style: { width: 14, height: 14, color: 'var(--faint)', flex: 'none' } };

interface FinSummary { workingCapital: { fgValue: number; ar: number; ap: number }; totals: { rev60: number } }
interface ReadinessSku { id: string; sku?: string; product_name?: string; match_rate?: number; buildable_units_estimate?: number; finished_goods_on_hand?: number }

const usdK = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};

export function Overview() {
  const { data, loading, error } = useFetch<Summary>('/api/summary');
  const { data: fin } = useFetch<FinSummary>('/api/finance/summary');
  const { data: readinessList } = useFetch<ReadinessSku[]>('/api/readiness');
  const { data: skuList } = useFetch<SkuList>('/api/skus?limit=5000');
  const openSku = useOpenSku();
  const goView = useGoView();
  const [kpiPanel, setKpiPanel] = useState<string | null>(null);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const exc = data.exception_counts ?? {};
  const readiness = data.readiness_counts ?? {};
  const dq = (data as Dict & { data_quality_counts?: Record<string, number> }).data_quality_counts ?? {};
  const critCount = (exc.stockout ?? 0) + (exc.critical ?? 0);
  const balanced = readiness.ready ?? 0;
  const constrained = (readiness.partial ?? 0) + (readiness.blocked ?? 0);

  // Tightest matches — sort by match_rate ascending, exclude zeros, take worst 3
  const worst3 = (readinessList ?? [])
    .filter((r) => (r.match_rate ?? 0) > 0)
    .sort((a, b) => (a.match_rate ?? 0) - (b.match_rate ?? 0))
    .slice(0, 3);

  const fgValue = fin?.workingCapital?.fgValue;
  const arValue = fin?.workingCapital?.ar;
  const apValue = fin?.workingCapital?.ap;

  // Lot reconciliation via data quality counts
  const dqPass = dq.pass ?? 0;
  const dqFail = (dq.fail ?? 0) + (dq.warn ?? 0);
  const dqTotal = dqPass + dqFail;
  const dqRate = dqTotal > 0 ? Math.round((dqPass / dqTotal) * 100) : 0;

  const kpis = [
    {
      key: 'tai', label: 'Total Available Inventory',
      value: num(data.finished_goods_on_hand), unit: 'units',
      sub: `${num(data.sku_count)} SKUs across the 3PL pool`,
      edge: 'var(--ink)', icon: Ic.box,
      onClick: () => setKpiPanel('tai'),
    },
    {
      key: 'sell', label: '60-day sell-through',
      value: num(data.units_30d_total ?? data.recent_units_sold), unit: 'units',
      sub: `${money(data.total_revenue ?? data.recent_revenue ?? 0)} net revenue`,
      edge: 'var(--good)', icon: Ic.trend,
      onClick: () => setKpiPanel('sell'),
    },
    {
      key: 'flags', label: 'Critical supply flags',
      value: num(critCount), unit: '',
      sub: `${num(exc.stockout)} selling with zero stock`,
      edge: 'var(--crit)', icon: Ic.alert,
      onClick: () => setKpiPanel('flags'),
    },
    {
      key: 'capital', label: 'Inventory at COGS',
      value: usdK(fgValue), unit: '',
      sub: arValue != null ? `AR ${usdK(arValue)} · AP ${usdK(apValue)}` : `${num(readiness.ready)} ready · ${num(readiness.blocked)} blocked`,
      edge: 'var(--cap)', icon: Ic.scale,
      onClick: () => setKpiPanel('capital'),
    },
  ];

  return (
    <div className="fade-in">
      {/* KPI grid */}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="kpi kpi-btn" key={k.key} onClick={k.onClick} style={{ cursor: 'pointer' }}>
            <div className="accent-edge" style={{ background: k.edge }} />
            <div className="label">{k.icon(ICO)}{k.label}</div>
            <div className="value">
              {k.value}
              {k.unit && <span className="unit">{k.unit}</span>}
            </div>
            <div className="sub">{k.sub}</div>
            <span className="kpi-cta">
              {Ic.trend({ style: { width: 12, height: 12 } })} itemized
            </span>
          </div>
        ))}
      </div>

      {kpiPanel && (
        <KpiPanel
          panelId={kpiPanel}
          skus={skuList?.skus ?? []}
          totalSkus={data.sku_count ?? skuList?.total ?? 0}
          totalUnits={data.finished_goods_on_hand}
          fgValue={fgValue}
          onClose={() => setKpiPanel(null)}
          onViewInventory={(band) => { setKpiPanel(null); goView('inventory', band ? { band } : undefined); }}
        />
      )}

      {/* Match-rate hero */}
      <div className="section-title">
        <h2>Match-rate predictor</h2>
        <span className="pill ink" style={{ fontSize: 10 }}>PRIORITY</span>
        <div className="line" />
        <button className="btn" onClick={() => goView('predictor')}>
          Open predictor {Ic.trend({ style: { width: 13, height: 13 } })}
        </button>
      </div>
      <div className="card">
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1px 1fr', gap: 24, alignItems: 'center' }}>
          <div>
            <div className="eyebrow">The question this answers</div>
            <p style={{ fontSize: 15, lineHeight: 1.55, margin: '10px 0 16px', maxWidth: 460 }}>
              Babylon owns the ingredients. Purity owns the demand.{' '}
              <strong>You can only sell what you can also package.</strong>{' '}
              This flags the imbalance before you spend on raw material you can't ship.
            </p>
            <div style={{ display: 'flex', gap: 22 }}>
              <Counter label="Balanced (≥85%)" value={num(balanced)} tone="var(--good)" />
              <Counter label="Constrained" value={num(constrained)} tone="var(--crit)" />
              <Counter label="Stranded capital" value={usdK(fgValue != null ? fgValue * 0.07 : null)} tone="var(--cap)" mono />
            </div>
          </div>
          <div style={{ background: 'var(--hairline)', alignSelf: 'stretch' }} />
          {/* Tightest matches */}
          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Tightest matches right now</div>
            {worst3.length > 0 ? worst3.map((b) => (
              <MiniMatch key={b.id} b={b} onClick={() => openSku(String(b.sku ?? b.id))} />
            )) : (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>No constrained SKUs — all balanced.</div>
            )}
          </div>
        </div>
      </div>

      {/* Flags + channel/recon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginTop: 22 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-head"><h3>Early-warning flags</h3><span className="hint">Sorted by urgency</span></div>
          <div>
            {(exc.stockout ?? 0) > 0 && (
              <FlagRow tone="crit" icon={Ic.alert}
                title={`${num(exc.stockout)} SKUs selling with zero stock`}
                desc="Live demand, nothing in the warehouse — lost revenue today."
                onClick={() => goView('inventory', { band: 'stockout' })} />
            )}
            {(exc.critical ?? 0) > 0 && (
              <FlagRow tone="crit" icon={Ic.trend}
                title={`${num(exc.critical)} SKUs under 30 days of cover`}
                desc="Will stock out within the replenishment lead time."
                onClick={() => goView('inventory', { band: 'crit' })} />
            )}
            {(exc.expiring ?? 0) > 0 && (
              <FlagRow tone="warn" icon={Ic.flask}
                title={`${num(exc.expiring)} lots expiring within 6 months`}
                desc="At-risk inventory that should be sold or written down."
                onClick={() => goView('inventory', { band: 'exp' })} />
            )}
            {(exc.warning ?? 0) > 0 && (
              <FlagRow tone="warn" icon={Ic.flask}
                title={`${num(exc.warning)} lots flagged — expiry or quality risk`}
                desc="At-risk inventory that should be sold or written down."
                onClick={() => goView('inventory', { band: 'exp' })} />
            )}
            {(exc.overstock ?? 0) > 0 && (
              <FlagRow tone="cap" icon={Ic.scale}
                title={`${num(exc.overstock)} overstocked SKUs${fgValue ? ` — ${usdK(fgValue * 0.18)} tied up` : ''}`}
                desc="More than a year of cover. Capital that could fund packaging."
                onClick={() => goView('inventory', { band: 'over' })} />
            )}
            {(exc.low_confidence ?? 0) > 0 && (
              <FlagRow tone="neutral" icon={Ic.recon}
                title={`${num(exc.low_confidence)} SKUs with low-confidence data`}
                desc="Forecast or velocity data is sparse — treat projections with caution."
                onClick={() => goView('inventory', { band: 'all' })} />
            )}
            {critCount === 0 && (exc.expiring ?? 0) === 0 && (exc.overstock ?? 0) === 0 && (exc.warning ?? 0) === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>No active flags.</div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="awaiting" style={{ padding: 18 }}>
            <div className="await-tag"><span className="pill neutral">Awaiting data</span></div>
            <div className="eyebrow">Channel split</div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 14px', lineHeight: 1.5 }}>
              Once channel feeds connect, TAI splits across all five — so you can see Amazon running dry while Deposco sits on surplus.
            </p>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {['Amazon', 'Deposco', 'PODs', 'Berkeley', 'China'].map((c) => (
                <span key={c} className="tag" style={{ opacity: 0.6 }}>{c}</span>
              ))}
            </div>
            <button className="btn" style={{ marginTop: 14 }} onClick={() => goView('channels')}>
              Preview channel view {Ic.chevron({ style: { width: 13, height: 13 } })}
            </button>
          </div>

          {/* Lot Reconciliation */}
          <div className="card">
            <div className="card-pad">
              <div className="eyebrow" style={{ marginBottom: 10 }}>Lot reconciliation</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>
                {dqRate}%
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--muted)', marginLeft: 8 }}>
                  of data checks passing
                </span>
              </div>
              {/* Split bar */}
              <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 14, gap: 2 }}>
                {dqTotal > 0 && (
                  <>
                    <div style={{ flex: dqPass, background: 'var(--good)', borderRadius: '5px 0 0 5px' }} />
                    {dqFail > 0 && <div style={{ flex: dqFail, background: 'var(--crit)', borderRadius: '0 5px 5px 0' }} />}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12 }}>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--good)', marginRight: 5 }} />{dqPass} passing</span>
                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--crit)', marginRight: 5 }} />{dqFail} issues</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, tone, mono }: { label: string; value: string; tone: string; mono?: boolean }) {
  return (
    <div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 24, fontWeight: 700, color: tone, letterSpacing: '-.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 5 }}>{label}</div>
    </div>
  );
}

function MiniMatch({ b, onClick }: { b: ReadinessSku; onClick: () => void }) {
  const rate = Math.round((b.match_rate ?? 0) * (b.match_rate! > 1 ? 1 : 100));
  const tone = rate >= 85 ? 'good' : rate >= 50 ? 'warn' : 'crit';
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '7px 0', borderBottom: '1px solid var(--hairline)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(b.product_name ?? b.sku ?? '').replace(/\n/g, ' ')}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          Build {num(b.buildable_units_estimate)} · on hand {num(b.finished_goods_on_hand)}
        </div>
      </div>
      <span className={`pill ${tone}`}>{rate}%</span>
    </button>
  );
}

function FlagRow({ tone, icon, title, desc, onClick }: { tone: string; icon: (p?: object) => ReactNode; title: string; desc: string; onClick?: () => void }) {
  const bg = ({ crit: 'var(--crit-tint)', warn: 'var(--warn-tint)', cap: 'var(--cap-tint)', neutral: 'var(--surface-2)' } as Record<string, string>)[tone] ?? 'var(--surface-2)';
  const fg = ({ crit: 'var(--crit)', warn: 'var(--warn)', cap: 'var(--cap)', neutral: 'var(--muted)' } as Record<string, string>)[tone] ?? 'var(--muted)';
  return (
    <div className="flag-item" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="flag-ic" style={{ background: bg, color: fg }}>{icon({})}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{desc}</div>
      </div>
      {Ic.arrowR(CHEV)}
    </div>
  );
}

interface KpiPanelProps {
  panelId: string;
  skus: SkuSummary[];
  totalSkus: number;
  totalUnits?: number | null;
  fgValue?: number | null;
  onClose: () => void;
  onViewInventory: (band?: string) => void;
}

function KpiPanel({ panelId, skus, totalSkus, totalUnits, fgValue, onClose, onViewInventory }: KpiPanelProps) {
  const cfg: Record<string, {
    title: string;
    subtitle: string;
    desc: string;
    band?: string;
    sorted: SkuSummary[];
    renderRight: (s: SkuSummary) => string;
    renderSub: (s: SkuSummary) => string;
  }> = {
    tai: {
      title: 'Total Available Inventory',
      subtitle: `${num(totalUnits)} units`,
      desc: `${num(totalSkus)} SKUs in the combined 3PL pool. Largest holdings first.`,
      sorted: [...skus].sort((a, b) => (b.finished_goods_on_hand ?? 0) - (a.finished_goods_on_hand ?? 0)),
      renderRight: (s) => `${num(s.finished_goods_on_hand)} u`,
      renderSub: (s) => `${String(s.sku ?? s.id)} · ${s.units_60d != null ? `${num(s.units_60d)} sold/60d` : 'no recent sales'}`,
    },
    sell: {
      title: '60-day sell-through',
      subtitle: `${num(skus.reduce((acc, s) => acc + (s.units_60d ?? 0), 0))} units sold`,
      desc: 'Top SKUs by 60-day revenue. Click a row to open SKU detail.',
      sorted: [...skus].filter((s) => (s.units_60d ?? 0) > 0).sort((a, b) => (b.total_revenue ?? 0) - (a.total_revenue ?? 0)),
      renderRight: (s) => money(s.total_revenue),
      renderSub: (s) => `${String(s.sku ?? s.id)} · ${num(s.units_60d)} units`,
    },
    flags: {
      title: 'Critical supply flags',
      subtitle: `${num(skus.filter((s) => ['stockout', 'critical', 'crit'].includes(String(s.risk_band ?? '').toLowerCase())).length)} at-risk SKUs`,
      desc: 'Stockouts and sub-30d cover — lost or imminent lost revenue.',
      band: 'stockout',
      sorted: [...skus].filter((s) => ['stockout', 'critical', 'crit'].includes(String(s.risk_band ?? '').toLowerCase()))
        .sort((a, b) => {
          const order = { stockout: 0, critical: 1, crit: 1 } as Record<string, number>;
          return (order[String(a.risk_band ?? '').toLowerCase()] ?? 2) - (order[String(b.risk_band ?? '').toLowerCase()] ?? 2);
        }),
      renderRight: (s) => {
        const rb = String(s.risk_band ?? '').toLowerCase();
        return rb === 'stockout' ? 'Stockout' : '<30d cover';
      },
      renderSub: (s) => `${String(s.sku ?? s.id)} · ${s.days_of_cover_estimate != null ? `${num(s.days_of_cover_estimate)}d cover` : 'no cover data'}`,
    },
    capital: {
      title: 'Inventory at COGS',
      subtitle: fgValue != null ? `$${(fgValue / 1e6).toFixed(2)}M at cost` : '—',
      desc: 'SKUs with highest on-hand inventory value. Largest holdings first.',
      sorted: [...skus].sort((a, b) => (b.finished_goods_on_hand ?? 0) - (a.finished_goods_on_hand ?? 0)),
      renderRight: (s) => `${num(s.finished_goods_on_hand)} u`,
      renderSub: (s) => `${String(s.sku ?? s.id)} · ${money(s.total_revenue)} rev`,
    },
  };

  const c = cfg[panelId];
  if (!c) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={c.title}>
        <div className="drawer-head">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>ITEMIZED</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.2 }}>{c.title}</div>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', marginTop: 6 }}>{c.subtitle}</div>
            </div>
            <button className="btn" onClick={onClose}>Close ✕</button>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>{c.desc}</div>
        </div>

        <div className="drawer-body" style={{ padding: 0, flex: 1, overflowY: 'auto' }}>
          {c.sorted.slice(0, 100).map((s) => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 24px', borderBottom: '1px solid var(--hairline)',
                cursor: 'default',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(s.product_name ?? s.sku ?? s.id).replace(/\n/g, ' ')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{c.renderSub(s)}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, flex: 'none', color: panelId === 'flags' ? 'var(--crit)' : 'var(--ink)' }}>
                {c.renderRight(s)}
              </div>
            </div>
          ))}
          {c.sorted.length === 0 && (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No SKUs in this category.
            </div>
          )}

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--hairline)', position: 'sticky', bottom: 0, background: 'var(--surface)' }}>
            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center', fontWeight: 600, padding: '10px 0' }}
              onClick={() => onViewInventory(c.band)}
            >
              View full inventory {Ic.arrowR({ style: { width: 14, height: 14 } })}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
