import { useMemo, useState } from 'react';
import { useFetch, type SkuSummary } from '../lib/api';
import { num, money } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { useOpenSku } from '../App';
import { Ic } from '../lib/icons';

interface SkuList {
  count: number;
  total: number;
  skus: SkuSummary[];
}

type SortKey = 'sku' | 'product_name' | 'risk_band' | 'finished_goods_on_hand' | 'days_of_cover_estimate' | 'units_60d' | 'total_revenue' | 'stars_avg' | 'expiry_date';

const BAND_DEFS = [
  { id: 'all',      label: 'All' },
  { id: 'stockout', label: 'Stockouts' },
  { id: 'crit',     label: '<30d cover' },
  { id: 'warn',     label: '30–60d' },
  { id: 'over',     label: 'Overstock' },
  { id: 'exp',      label: 'Expiring' },
  { id: 'disco',    label: 'Discontinued' },
  { id: 'revissue', label: '★ Review issues' },
  { id: 'reggaps',  label: 'Regulatory gaps' },
];

function matchBand(s: SkuSummary, id: string): boolean {
  const b = String(s.risk_band ?? '').toLowerCase();
  switch (id) {
    case 'all':      return true;
    case 'stockout': return b === 'stockout';
    case 'crit':     return b === 'critical' || b === 'crit';
    case 'warn':     return b === 'warning' || b === 'warn';
    case 'over':     return b === 'overstock' || b === 'over';
    case 'exp':      return b === 'expiring' || b === 'exp';
    case 'disco':    return b === 'discontinued' || b === 'disco';
    case 'revissue': return !!(s as Record<string, unknown>)['has_review_issues'] || b === 'revissue';
    case 'reggaps':  return !!(s as Record<string, unknown>)['has_reg_gaps'] || b === 'reggaps';
    default:         return true;
  }
}

const bandTone: Record<string, string> = {
  stockout: 'crit', crit: 'crit', critical: 'crit',
  warn: 'warn', warning: 'warn',
  good: 'good',
  over: 'cap', overstock: 'cap',
  exp: 'warn', expiring: 'warn',
  disco: 'neutral', discontinued: 'neutral',
};

function Stars({ val, size = 11 }: { val: number; size?: number }) {
  const full = Math.round(val);
  return (
    <span style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={{ color: i <= full ? '#f1a500' : 'var(--hairline)' }}>★</span>
      ))}
    </span>
  );
}

const Arrow = ({ dir }: { dir: 1 | -1 | 0 }) =>
  dir === 0 ? <span style={{ color: 'var(--faint)', fontSize: 9, marginLeft: 4 }}>↕</span>
  : dir === -1 ? <span style={{ color: 'var(--accent)', fontSize: 9, marginLeft: 4 }}>▼</span>
  : <span style={{ color: 'var(--accent)', fontSize: 9, marginLeft: 4 }}>▲</span>;

export function Inventory() {
  const { data, loading, error } = useFetch<SkuList>('/api/skus?limit=5000');
  const openSku = useOpenSku();
  const [search, setSearch] = useState('');
  const [band, setBand] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'total_revenue', dir: -1 });

  const rows = useMemo(() => {
    let r = data?.skus ?? [];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((s) => String(s.sku ?? s.id).toLowerCase().includes(q) || String(s.product_name ?? '').toLowerCase().includes(q));
    if (band !== 'all') r = r.filter((s) => matchBand(s, band));
    const { key, dir } = sort;
    return [...r].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key] as number | string | null | undefined;
      const bv = (b as Record<string, unknown>)[key] as number | string | null | undefined;
      if (typeof av === 'number' || typeof bv === 'number') return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [data, search, band, sort]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const th = (key: SortKey, label: string, n = false) => {
    const active = sort.key === key;
    const dir = active ? sort.dir : 0;
    return (
      <th
        className={n ? 'num' : ''}
        style={{ cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
        onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === -1 ? 1 : -1 }))}
      >
        {label}<Arrow dir={active ? dir : 0} />
      </th>
    );
  };

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search" style={{ maxWidth: 340 }}>
          {Ic.search({ style: { width: 15, height: 15, color: 'var(--faint)', flex: 'none' } })}
          <input placeholder="Search SKU or product…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} style={{ color: 'var(--faint)', display: 'flex' }}>
              {Ic.x({ style: { width: 14, height: 14 } })}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {BAND_DEFS.map((b) => (
            <button key={b.id} className={`tag${band === b.id ? ' on' : ''}`} onClick={() => setBand(b.id)}>{b.label}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }} className="tnum">
          {num(rows.length)} of {num(data?.total ?? 0)} SKUs
        </span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                {th('sku', 'SKU')}
                {th('product_name', 'Product')}
                {th('risk_band', 'Status')}
                {th('finished_goods_on_hand', 'On hand', true)}
                {th('days_of_cover_estimate', 'Days cover', true)}
                {th('units_60d', '60d units', true)}
                {th('total_revenue', '60d revenue', true)}
                <th className="num" style={{ whiteSpace: 'nowrap' }}>Reviews</th>
                {th('expiry_date', 'Expires')}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((s) => {
                const rb = String(s.risk_band ?? '').toLowerCase();
                const tone = bandTone[rb] ?? 'neutral';
                const stars = (s as Record<string, unknown>)['stars_avg'] as number | null | undefined;
                const flaggedReviews = (s as Record<string, unknown>)['flagged_reviews'] as number | null | undefined;
                const expiry = (s as Record<string, unknown>)['expiry_date'] as string | null | undefined;
                return (
                  <tr className="row" key={s.id} onClick={() => openSku(String(s.sku ?? s.id))}>
                    <td className="sku-cell">{String(s.sku ?? s.id)}</td>
                    <td className="name-cell">{String(s.product_name ?? '').replace(/\n/g, ' ')}</td>
                    <td>
                      <span className={`pill ${tone}`} style={{ textTransform: 'capitalize', fontSize: 11 }}>
                        {rb === 'critical' ? '<30d' : rb === 'warning' ? '30–60d' : rb === 'overstock' ? 'Overstock' : rb === 'stockout' ? 'Stockout' : rb === 'good' ? 'Healthy' : rb || '—'}
                      </span>
                    </td>
                    <td className="num">{num(s.finished_goods_on_hand)}</td>
                    <td className="num">{s.days_of_cover_estimate == null ? '—' : num(s.days_of_cover_estimate)}</td>
                    <td className="num">{s.units_60d == null ? '—' : num(s.units_60d)}</td>
                    <td className="num">{money(s.total_revenue)}</td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {stars != null ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Stars val={stars} />
                          {flaggedReviews ? <span className="pill crit" style={{ fontSize: 9.5, padding: '0 4px' }}>{flaggedReviews} flagged</span> : null}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--faint)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: expiry ? 'var(--ink)' : 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
                      {expiry ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            No SKUs match this filter.
          </div>
        )}
      </div>
      {rows.length > 200 && (
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Showing first 200 — refine your search to narrow.</div>
      )}
    </div>
  );
}
