import { useState } from 'react';
import { useFetch } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { Kpi, Loading, ErrorState, Pill } from '../components/ui';
import { useOpenSku } from '../App';

interface ReviewItem { stars: number; date: string; flag?: string; text: string }
interface ReviewProduct {
  id: string; sku?: string; name: string; count: number; avg: number; dist: Record<string, number>;
  critical: number; recent90?: number; negPct?: number; health: number; status: string; reviews?: ReviewItem[];
}

const healthBand = (h: number) => (h >= 80 ? 'good' : h >= 65 ? 'warning' : 'critical');

export function Reviews() {
  const { data, loading, error } = useFetch<ReviewProduct[]>('/api/reviews');
  const openSku = useOpenSku();
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const products = (data ?? []).slice().sort((a, b) => a.health - b.health);
  const avgHealth = products.length ? products.reduce((a, p) => a + p.health, 0) / products.length : 0;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Products reviewed" value={num(products.length)} edge="var(--accent)" />
        <Kpi label="Avg health" value={num(avgHealth)} unit="/100" edge="var(--good)" />
        <Kpi label="With issues" value={num(products.filter((p) => p.status === 'issue').length)} edge="var(--crit)" />
        <Kpi label="Critical reviews" value={num(products.reduce((a, p) => a + p.critical, 0))} edge="var(--warn)" />
      </div>

      <div className="card card-pad section-gap" style={{ background: 'var(--surface-2)' }}>
        <div className="eyebrow">Customer reviews & health</div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Sample review data (seeded). Health blends rating, sample size, and critical/adverse flags. Click a card to drill into the SKU.</p>
      </div>

      <div className="grid-2">
        {products.map((p) => {
          const dist = p.dist ?? {};
          const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
          return (
            <div className="card card-pad" key={p.id}>
              <div className="row-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <button className="linklike mono" style={{ fontSize: 11 }} onClick={() => openSku(p.sku ?? p.id)}>{p.sku ?? p.id}</button>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="bignum" style={{ fontSize: 22, color: `var(--${healthBand(p.health)})` }}>{num(p.health)}</div>
                  <Pill band={healthBand(p.health)}>{titleCase(p.status)}</Pill>
                </div>
              </div>
              <div className="metric-row" style={{ marginTop: 10, fontSize: 13 }}>
                <span>★ {p.avg.toFixed(1)} · {num(p.count)} reviews</span>
                <span className="muted">{p.critical} critical</span>
              </div>
              {/* star distribution */}
              <div className="stack" style={{ marginTop: 8, gap: 3 }}>
                {[5, 4, 3, 2, 1].map((s) => { const v = dist[String(s)] ?? 0; const w = (v / total) * 100; return (
                  <div key={s} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 36px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                    <span className="muted">{s}★</span>
                    <div className="bar-track" style={{ height: 7 }}><div className="bar-fill" style={{ width: `${w}%`, background: s >= 4 ? 'var(--good)' : s === 3 ? 'var(--warn)' : 'var(--crit)' }} /></div>
                    <span className="mono faint" style={{ textAlign: 'right' }}>{num(v)}</span>
                  </div>
                ); })}
              </div>
              {p.reviews && p.reviews.length > 0 && (
                <>
                  <button className="tag" style={{ marginTop: 10 }} onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide' : 'Show'} sample reviews</button>
                  {open === p.id && (
                    <div className="stack" style={{ marginTop: 8 }}>
                      {p.reviews.map((r, i) => (
                        <div key={i} style={{ fontSize: 12.5, borderLeft: `2px solid ${r.flag === 'CRITICAL' ? 'var(--crit)' : 'var(--border)'}`, paddingLeft: 10 }}>
                          <div className="muted" style={{ fontSize: 11 }}>★{r.stars} · {r.date} {r.flag === 'CRITICAL' && <span className="pill crit" style={{ marginLeft: 4 }}>CRITICAL</span>}</div>
                          <div>{r.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
