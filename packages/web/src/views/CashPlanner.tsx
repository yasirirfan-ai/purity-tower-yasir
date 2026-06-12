import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { Ic } from '../lib/icons';
import { titleCase } from '../lib/format';
import { fmtDate } from '../lib/dates';
import { Loading, ErrorState } from '../components/ui';

const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };
const ING_C = '#2f7d52';
const PKG_C = '#3f51b5';

interface CashBucket { label: string; loOff: number; hiOff: number; ing: number; pkg: number; total: number; count: number; balance: number }
interface CashEvent { vendor: string; type: 'ingredient' | 'packaging'; sku?: string; product?: string; po?: string; amount: number; dueOff: number; imported?: boolean; terms?: number; prepaid?: boolean; shipMethod?: string }
interface VendorRoll { vendor: string; amount: number; lines: number; firstDueOff: number; imported: boolean; terms?: number; prepaid?: boolean }
interface CashData {
  opening: number; modeled: boolean;
  kpis: { totalPayable: number; due30: number; overdue: number; lowestBalance: number };
  weeks: CashBucket[]; months: CashBucket[]; vendors: VendorRoll[]; events: CashEvent[];
}

const today = () => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); };
const offToDate = (off: number) => fmtDate(today() + off * 86_400_000);
const relLabel = (off: number) => off < 0 ? `${-off}d overdue` : off === 0 ? 'today' : `in ${off}d`;
const usdK = (n: number) => {
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};

export function CashPlanner() {
  const { data, loading, error } = useFetch<CashData>('/api/finance/cash');
  const [grain, setGrain] = useState<'month' | 'week'>('month');
  const [eventType, setEventType] = useState<'all' | 'ingredient' | 'packaging'>('all');
  const [opening, setOpening] = useState<number | null>(null);

  const buckets = useMemo(() => (data ? (grain === 'month' ? data.months : data.weeks) : []), [data, grain]);

  const openingVal = opening ?? data?.opening ?? 0;

  const adjustedBuckets = useMemo(() => {
    if (!data || opening == null) return buckets;
    const diff = opening - (data.opening ?? 0);
    return buckets.map((b) => ({ ...b, balance: b.balance + diff }));
  }, [buckets, data, opening]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const k = data.kpis;
  const ingAP = data.events.filter((e) => e.type === 'ingredient').reduce((a, e) => a + e.amount, 0);
  const pkgAP = data.events.filter((e) => e.type === 'packaging').reduce((a, e) => a + e.amount, 0);

  const displayBuckets = adjustedBuckets;
  const maxOut = Math.max(1, ...displayBuckets.map((b) => b.total));
  const minBal = Math.min(0, openingVal, ...displayBuckets.map((b) => b.balance));
  const maxBal = Math.max(openingVal, ...displayBuckets.map((b) => b.balance));
  const balRange = maxBal - minBal || 1;
  const balY = (b: number) => 160 - ((b - minBal) / balRange) * 160;

  const lowest = Math.min(...displayBuckets.map((b) => b.balance));
  const lowBucket = displayBuckets.find((b) => b.balance === lowest);

  const filteredEvents = eventType === 'all' ? data.events : data.events.filter((e) => e.type === eventType);

  return (
    <div className="fade-in">
      {/* Toggles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="seg">
          <button className="on">Open POs (what's wanted)</button>
          <button disabled style={{ opacity: 0.5 }}>Replenishment plan</button>
        </div>
        <div className="seg">
          <button className={grain === 'month' ? 'on' : ''} onClick={() => setGrain('month')}>By month</button>
          <button className={grain === 'week' ? 'on' : ''} onClick={() => setGrain('week')}>By week</button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        <div className="kpi">
          <div className="accent-edge" style={{ background: 'var(--ink)' }} />
          <div className="label">{Ic.scale(ICO)}Total payable (horizon)</div>
          <div className="value">{usdK(k.totalPayable)}</div>
          <div className="sub">{usdK(ingAP)} ingredients · {usdK(pkgAP)} packaging</div>
        </div>
        <div className="kpi">
          <div className="accent-edge" style={{ background: 'var(--crit)' }} />
          <div className="label">{Ic.clock(ICO)}Due within 30 days</div>
          <div className="value">{usdK(k.due30)}</div>
          <div className="sub">{data.events.filter((e) => e.dueOff <= 30 && e.dueOff >= 0).length} invoices</div>
        </div>
        <div className="kpi">
          <div className="accent-edge" style={{ background: 'var(--warn)' }} />
          <div className="label">{Ic.alert(ICO)}{k.overdue > 0 ? 'Past due' : 'Prepaid soon'}</div>
          <div className="value">{usdK(k.overdue > 0 ? k.overdue : data.events.filter((e) => e.prepaid && (e.dueOff ?? 999) <= 14).reduce((a, e) => a + e.amount, 0))}</div>
          <div className="sub">{k.overdue > 0 ? 'invoices already due' : 'prepaid POs landing'}</div>
        </div>
        <div className="kpi">
          <div className="accent-edge" style={{ background: lowest < 0 ? 'var(--crit)' : 'var(--good)' }} />
          <div className="label">{Ic.trend(ICO)}Lowest cash balance</div>
          <div className="value">{usdK(lowest)}</div>
          <div className="sub">{lowBucket ? lowBucket.label : '—'}</div>
        </div>
      </div>

      {/* Opening cash balance editor */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-pad" style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Opening cash balance</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--muted)' }}>$</span>
              <input
                style={{ width: 150, fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, border: '1.5px solid var(--border)', borderRadius: 7, padding: '5px 10px', background: 'var(--surface)', color: 'var(--ink)' }}
                type="number"
                step="10000"
                value={openingVal}
                onChange={(e) => setOpening(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 560 }}>
            Forecasting from open POs — each finished-goods order explodes into its component &amp; ingredient buys, dated by lead time + vendor <strong>net terms</strong>. This is what you'll owe to fulfill what's been ordered.
          </div>
          {lowest < 0 && (
            <span className="pill crit" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {Ic.alert({ style: { width: 12, height: 12 } })}Projected shortfall
            </span>
          )}
        </div>
      </div>

      {/* Cash-outflow forecast chart */}
      <div className="section-title" style={{ marginTop: 20 }}>
        <h2>Cash-outflow forecast</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {grain === 'month' ? displayBuckets.length + ' months' : displayBuckets.length + ' weeks'} · ingredient vs. packaging
        </span>
        <div className="line" />
      </div>
      <div className="card"><div className="card-pad">
        <div style={{ position: 'relative', height: 200, display: 'flex', alignItems: 'flex-end', gap: grain === 'month' ? 10 : 4 }}>
          {displayBuckets.map((b, idx) => {
            const h = (b.total / maxOut) * 150;
            const ingH = b.total ? (b.ing / b.total) * h : 0;
            const pkgH = b.total ? (b.pkg / b.total) * h : 0;
            return (
              <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 170, position: 'relative' }}
                title={`${b.label} · ${usdK(b.total)} (${b.count}) · balance ${usdK(b.balance)}`}>
                <span className="mono" style={{ fontSize: 9, fontWeight: 600, color: 'var(--muted)', marginBottom: 2 }}>{b.total > 0 ? usdK(b.total) : ''}</span>
                <div style={{ width: grain === 'month' ? '62%' : '78%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 150 }}>
                  <div style={{ height: pkgH + 'px', background: PKG_C, borderRadius: pkgH && !ingH ? '3px 3px 0 0' : 0 }} />
                  <div style={{ height: ingH + 'px', background: ING_C, borderRadius: ingH && !pkgH ? '3px 3px 0 0' : 0, borderTop: pkgH ? '1px solid rgba(255,255,255,.4)' : 'none' }} />
                </div>
                <span className="mono" style={{ fontSize: 9, color: 'var(--faint)', marginTop: 4, whiteSpace: 'nowrap', transform: grain === 'week' ? 'rotate(-40deg)' : 'none' }}>{b.label}</span>
              </div>
            );
          })}
          {/* SVG balance line overlay */}
          {displayBuckets.length > 1 && (
            <svg style={{ position: 'absolute', left: 0, top: 0, right: 0, height: 160, pointerEvents: 'none', overflow: 'visible' }} preserveAspectRatio="none" viewBox={`0 0 ${displayBuckets.length} 160`}>
              <polyline fill="none" stroke="var(--ink)" strokeWidth={grain === 'month' ? '0.04' : '0.06'}
                points={displayBuckets.map((b, i) => `${i + 0.5},${balY(b.balance)}`).join(' ')} />
              {displayBuckets.map((b, i) => (
                <circle key={i} cx={i + 0.5} cy={balY(b.balance)} r={grain === 'month' ? '0.09' : '0.12'} fill={b.balance < 0 ? 'var(--crit)' : 'var(--ink)'} />
              ))}
            </svg>
          )}
        </div>
        <div className="legend" style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dotmark" style={{ background: ING_C }} />Ingredient payments</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span className="dotmark" style={{ background: PKG_C }} />Packaging payments</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: '2px solid var(--ink)', display: 'inline-block' }} />Projected cash balance</span>
        </div>
      </div></div>

      {/* Monthly summary table */}
      {grain === 'month' && (
        <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}>
          <div className="tbl-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="num">Ingredients</th>
                  <th className="num">Packaging</th>
                  <th className="num">Total out</th>
                  <th className="num">Invoices</th>
                  <th className="num">Projected balance</th>
                </tr>
              </thead>
              <tbody>
                {displayBuckets.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                    <td className="num" style={{ color: ING_C }}>{usdK(m.ing)}</td>
                    <td className="num" style={{ color: PKG_C }}>{usdK(m.pkg)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{usdK(m.total)}</td>
                    <td className="num" style={{ color: 'var(--muted)' }}>{m.count}</td>
                    <td className="num" style={{ fontWeight: 700, color: m.balance < 0 ? 'var(--crit)' : 'var(--good)' }}>{usdK(m.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payables by vendor */}
      <div className="section-title">
        <h2>Payables by vendor</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>over the horizon</span>
        <div className="line" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 12 }}>
        {data.vendors.slice(0, 9).map((v) => (
          <div key={v.vendor} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.vendor}</div>
              <span className={`pill ${v.prepaid ? 'crit' : (v.terms ?? 30) >= 60 ? 'good' : 'neutral'}`} style={{ fontSize: 10.5, flex: 'none' }}>
                {v.prepaid ? 'Prepay' : `Net ${v.terms ?? 30}`}
              </span>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 7 }}>{usdK(v.amount)}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {v.lines} line{v.lines > 1 ? 's' : ''} · first due {offToDate(v.firstDueOff)}
            </div>
          </div>
        ))}
      </div>

      {/* Payables schedule */}
      <div className="section-title">
        <h2>Payables schedule</h2>
        <div className="seg" style={{ marginLeft: 8 }}>
          {([['all', 'All'], ['ingredient', 'Ingredients'], ['packaging', 'Packaging']] as const).map(([id, l]) => (
            <button key={id} className={eventType === id ? 'on' : ''} onClick={() => setEventType(id)}>{l}</button>
          ))}
        </div>
        <div className="line" />
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{filteredEvents.length} lines</span>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Due</th><th>PO</th><th>Ordered</th><th>Vendor</th><th>Type</th><th>For</th>
                <th>Terms</th><th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.slice(0, 200).map((e, i) => (
                <tr key={i} className="row">
                  <td>
                    <div style={{ fontWeight: 600 }}>{offToDate(e.dueOff)}</div>
                    <div style={{ fontSize: 11, color: e.dueOff < 0 ? 'var(--crit)' : e.dueOff <= 14 ? 'var(--warn)' : 'var(--muted)' }}>
                      {relLabel(e.dueOff)}
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{e.po ?? '—'}</td>
                  <td className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>—</td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {e.imported && (
                        <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: '#fbeee6', color: '#9a5418', borderRadius: 3, padding: '1px 4px' }}>
                          {e.shipMethod === 'Air' ? 'AIR' : 'IMP'}
                        </span>
                      )}
                      {e.vendor}
                    </span>
                  </td>
                  <td>
                    <span className="dotmark" style={{ background: e.type === 'ingredient' ? ING_C : PKG_C, display: 'inline-block', marginRight: 6 }} />
                    {titleCase(e.type)}
                  </td>
                  <td className="name-cell" style={{ maxWidth: 200, color: 'var(--muted)' }}>
                    {String(e.product ?? '').replace(/^\[[^\]]+\]\s*/, '')}
                    {e.sku && <span style={{ color: 'var(--faint)' }}> · {e.sku}</span>}
                  </td>
                  <td>
                    <span className={`pill ${e.prepaid ? 'crit' : (e.terms ?? 30) >= 60 ? 'good' : 'neutral'}`} style={{ fontSize: 10.5 }}>
                      {e.prepaid ? 'Prepay' : `Net ${e.terms ?? 30}`}
                    </span>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{usdK(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEvents.length > 200 && (
          <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--muted)', borderTop: '1px solid var(--hairline)' }}>
            Showing 200 of {filteredEvents.length} — use filters to narrow.
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>
        Forecast from open POs exploded through the BOM. Due date = order date + production + shipment lead + vendor net terms. Opening balance is editable and saved in-session.
      </div>
    </div>
  );
}
