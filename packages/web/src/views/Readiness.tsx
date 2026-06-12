import { useMemo, useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { Ic } from '../lib/icons';
import { useOpenSku } from '../App';

const ING_C = '#2f7d52', PKG_C = '#3f51b5';

const numK = (n: number) => {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  return String(Math.round(n));
};

export function Readiness() {
  const { data, loading, error } = useFetch<Array<Dict & { id: string }>>('/api/readiness');
  const openSku = useOpenSku();
  const [filter, setFilter] = useState('all');

  const { rows, balanced, constrained, avgRate } = useMemo(() => {
    const all = data ?? [];
    const balanced = all.filter((d) => Number(d.match_rate ?? 0) >= 85).length;
    const constrained = all.length - balanced;
    const avgRate = all.length
      ? Math.round(all.reduce((a, d) => a + Number(d.match_rate ?? 0), 0) / all.length)
      : 0;
    let r = all;
    if (filter !== 'all') r = r.filter((d) => String(d.readiness_band ?? '').toLowerCase() === filter);
    return {
      rows: [...r].sort((a, b) => (Number(a.match_rate ?? 0) - Number(b.match_rate ?? 0)) || (Number(b.recent_units_sold ?? 0) - Number(a.recent_units_sold ?? 0))),
      balanced,
      constrained,
      avgRate,
    };
  }, [data, filter]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const filters = ['all', 'blocked', 'partial', 'ready', 'unknown'];

  return (
    <div className="fade-in">
      {/* How to read + stats */}
      <div className="card" style={{ marginBottom: 22, background: 'var(--surface-2)' }}>
        <div className="card-pad" style={{ display: 'flex', gap: 26, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <div className="eyebrow">How to read this</div>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: '8px 0 0', maxWidth: 540 }}>
              For every finished good, we compute how many sellable units the{' '}
              <strong style={{ color: ING_C }}>ingredients</strong> can support versus the{' '}
              <strong style={{ color: PKG_C }}>packaging</strong> components.{' '}
              <strong>You can only build the smaller of the two.</strong> A low match rate means capital is stranded on one side — hold those POs and unblock the constraint instead.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <Stat label="Balanced (≥85%)" value={num(balanced)} tone="var(--good)" />
            <Stat label="Constrained" value={num(constrained)} tone="var(--crit)" />
            <Stat label="Avg match rate" value={avgRate + '%'} tone="var(--cap)" mono />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="legend" style={{ marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap', fontSize: 12.5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dotmark" style={{ background: ING_C }} />Ingredient capacity
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dotmark" style={{ background: PKG_C }} />Packaging capacity
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 18, borderTop: '2px dashed var(--muted)', verticalAlign: 'middle' }} />60-day demand
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dotmark" style={{ background: 'var(--crit)' }} />Bottleneck component
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="seg">
          {filters.map((f) => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{titleCase(f)}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }} className="tnum">{num(rows.length)} SKUs</span>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {rows.slice(0, 60).map((d) => {
          const rate = Number(d.match_rate ?? 0);
          const buildable = Number(d.buildable_units_estimate ?? 0);
          const finishedGoods = Number(d.finished_goods_on_hand ?? 0);
          const sellable = Number(d.sellable_units_estimate ?? finishedGoods + buildable);
          const demand = Number(d.recent_units_sold ?? 0);
          const bottlenecks = (d.bottleneck_components as Dict[] | undefined) ?? [];
          const tone = rate >= 85 ? 'good' : rate >= 50 ? 'warn' : 'crit';
          const toneC = tone === 'good' ? 'var(--good)' : tone === 'warn' ? 'var(--warn)' : 'var(--crit)';

          // Compute ingredient capacity (unconstrained side)
          const ingCapacity = rate > 0 && rate < 100
            ? Math.round(buildable / (rate / 100))
            : buildable;
          const maxBar = Math.max(ingCapacity, buildable, demand * 1.1, 1);
          const ingPct = Math.min(100, (ingCapacity / maxBar) * 100);
          const pkgPct = Math.min(100, (buildable / maxBar) * 100);
          const demandPct = demand > 0 ? Math.min(98, (demand / maxBar) * 100) : 0;

          const cover = demand > 0 ? (sellable / demand).toFixed(1) : null;

          return (
            <div className="match-card" key={d.id} style={{ cursor: 'pointer' }} onClick={() => openSku(String(d.sku ?? d.id))}>
              {/* Header row */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 5, alignSelf: 'stretch', borderRadius: 4, background: toneC, flex: 'none' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, letterSpacing: '-.01em' }}>
                      {String(d.product_name ?? '').replace(/\n/g, ' ')}
                    </h3>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{String(d.sku ?? d.id)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    {bottlenecks.length > 0 ? (
                      <>
                        Limited by{' '}
                        <strong style={{ color: toneC }}>
                          {bottlenecks.length} component{bottlenecks.length > 1 ? 's' : ''}
                        </strong>
                        {' '}—{' '}
                        {bottlenecks.slice(0, 2).map((c) => (
                          <span key={String(c.sku)} className="mono" style={{ fontSize: 11, background: 'rgba(0,0,0,.05)', borderRadius: 4, padding: '1px 5px', marginRight: 4 }}>
                            {String(c.sku)}
                          </span>
                        ))}
                        {bottlenecks.length > 2 && <span style={{ color: 'var(--faint)', fontSize: 11 }}>+{bottlenecks.length - 2} more</span>}
                      </>
                    ) : (
                      'Ingredients and packaging are matched.'
                    )}
                  </div>
                </div>
                {/* Match rate — right side */}
                <div style={{ textAlign: 'right', flex: 'none', paddingLeft: 16 }}>
                  <div className="mono" style={{ fontSize: 28, fontWeight: 700, color: toneC, lineHeight: 1 }}>{Math.round(rate)}%</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.06em', marginTop: 3, textTransform: 'uppercase' }}>Match Rate</div>
                </div>
              </div>

              {/* Capacity bars with demand marker */}
              <div style={{ paddingLeft: 17, marginTop: 16, position: 'relative' }}>
                {/* Demand marker */}
                {demandPct > 0 && (
                  <div style={{ position: 'absolute', left: `calc(17px + ${demandPct}%)`, top: 0, bottom: 0, width: 0, borderLeft: '2px dashed var(--muted)', pointerEvents: 'none', zIndex: 1 }}>
                    <span style={{ position: 'absolute', top: -18, left: 4, fontSize: 10.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      demand {numK(demand)}
                    </span>
                  </div>
                )}
                <CapBar2 label="Ingredient capacity" pct={ingPct} value={ingCapacity} color={ING_C} tint="#e6f2ea" />
                <CapBar2 label="Packaging capacity" pct={pkgPct} value={buildable} color={PKG_C} tint="#eaecf8" />
              </div>

              {/* Bottom stats */}
              <div style={{ paddingLeft: 17, marginTop: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13.5 }}>
                <span><strong>{num(buildable)}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>buildable now</span></span>
                <span style={{ color: 'var(--faint)' }}>+</span>
                <span><strong>{num(finishedGoods)}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>finished in 3PL</span></span>
                <span style={{ color: 'var(--faint)' }}>=</span>
                <span><strong>{num(sellable)}</strong> <span style={{ color: 'var(--muted)', fontSize: 12 }}>sellable{demand > 0 ? ` vs ${numK(demand)} demand` : ''}</span></span>
                {cover && (
                  <span className={`pill ${Number(cover) >= 1 ? 'good' : 'crit'}`} style={{ marginLeft: 6, fontSize: 12 }}>{cover}× cover</span>
                )}
              </div>

              {/* Recommendation */}
              {bottlenecks.length > 0 && (
                <div style={{ marginTop: 12, paddingLeft: 17 }}>
                  <div style={{ padding: '11px 14px', borderRadius: 9, background: tone === 'crit' ? 'var(--crit-tint)' : 'var(--warn-tint)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {Ic.alert({ style: { width: 16, height: 16, color: toneC, marginTop: 1, flex: 'none' } })}
                    <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      {rate > 0 && rate < 100 ? (
                        <>
                          Ingredients can build <strong>{num(ingCapacity)}</strong> but packaging caps you at <strong>{num(buildable)}</strong>.{' '}
                          Hold ingredient POs and order bottleneck components to unlock build capacity.
                        </>
                      ) : (
                        <>
                          <strong>{bottlenecks.length} component{bottlenecks.length > 1 ? 's' : ''} missing or constrained.</strong>{' '}
                          Check open POs and reorder bottleneck components to unlock build capacity.
                        </>
                      )}
                      {bottlenecks.slice(0, 3).map((c, i) => (
                        <span key={i} className="mono" style={{ display: 'inline-block', marginLeft: 6, fontSize: 11, background: 'rgba(0,0,0,.06)', borderRadius: 4, padding: '1px 5px' }}>{String(c.sku)}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, mono }: { label: string; value: string; tone: string; mono?: boolean }) {
  return (
    <div>
      <div className={mono ? 'mono' : ''} style={{ fontSize: 27, fontWeight: 700, color: tone, lineHeight: 1, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function CapBar2({ label, pct, value, color, tint }: { label: string; pct: number; value: number; color: string; tint: string }) {
  return (
    <div style={{ margin: '7px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span className="mono" style={{ fontWeight: 700, color, fontSize: 12 }}>{num(value)} units</span>
      </div>
      <div style={{ height: 14, borderRadius: 5, background: tint, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 5, transition: 'width .4s' }} />
      </div>
    </div>
  );
}
