import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { num, money, titleCase } from '../lib/format';
import { Kpi, Loading, ErrorState, Pill } from '../components/ui';
import { useOpenSku } from '../App';

interface ChSku {
  sku: string; product_name: string | null; risk_band: string | null;
  on_hand: number; units_30d: number; units_60d: number; units_alltime: number; revenue_alltime: number;
}
interface ChData {
  channel: string;
  totals: { skuCount: number; onHand: number; units30d: number; units60d: number; unitsAllTime: number; revenueAllTime: number };
  skus: ChSku[];
}

type SortKey = keyof Pick<ChSku, 'sku' | 'product_name' | 'on_hand' | 'units_30d' | 'units_60d' | 'units_alltime' | 'revenue_alltime' | 'risk_band'>;

export function ChannelDetail({ channel, onBack }: { channel: string; onBack: () => void }) {
  const { data, loading, error } = useFetch<ChData>(`/api/channels/${encodeURIComponent(channel)}`);
  const openSku = useOpenSku();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'revenue_alltime', dir: -1 });

  const rows = useMemo(() => {
    let r = data?.skus ?? [];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((s) => `${s.sku} ${s.product_name}`.toLowerCase().includes(q));
    const { key, dir } = sort;
    return [...r].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === 'number' || typeof bv === 'number') return (((av as number) ?? -Infinity) - ((bv as number) ?? -Infinity)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
    });
  }, [data, search, sort]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;
  const t = data.totals;

  const th = (key: SortKey, label: string, n = false) => (
    <th className={n ? 'num' : ''} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === -1 ? 1 : -1 }))}>
      {label}{sort.key === key && <span className="arr">{sort.dir === -1 ? '▼' : '▲'}</span>}
    </th>
  );

  return (
    <>
      <button className="btn" style={{ marginBottom: 16 }} onClick={onBack}>← All channels</button>

      <div className="kpi-grid">
        <Kpi label="SKUs in channel" value={num(t.skuCount)} edge="var(--accent)" />
        <Kpi label="On hand" value={num(t.onHand)} unit="units" edge="var(--cap)" />
        <Kpi label="Units sold (30d / 60d)" value={`${num(t.units30d)}`} edge="var(--good)" sub={<>{num(t.units60d)} in 60d · {num(t.unitsAllTime)} all-time</>} />
        <Kpi label="Revenue (gross, all-time)" value={money(t.revenueAllTime)} edge="var(--warn)" />
      </div>

      <div className="row-between section-gap" style={{ marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div className="search">
          <span className="muted">⌕</span>
          <input placeholder="Search SKU or product…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{num(rows.length)} of {num(t.skuCount)} SKUs</span>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>{titleCase(channel)} — SKUs</h3>
          <span className="hint">on-hand from inventory feed · sales from BigQuery · click a row for detail</span>
        </div>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                {th('sku', 'SKU')}
                {th('product_name', 'Product')}
                {th('risk_band', 'Band')}
                {th('on_hand', 'On hand', true)}
                {th('units_30d', '30d units', true)}
                {th('units_60d', '60d units', true)}
                {th('units_alltime', 'All-time units', true)}
                {th('revenue_alltime', 'Revenue (gross)', true)}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 250).map((s) => (
                <tr className="row" key={s.sku} onClick={() => openSku(s.sku)}>
                  <td className="sku-cell">{s.sku}</td>
                  <td className="name-cell">{String(s.product_name ?? '').replace(/\n/g, ' ')}</td>
                  <td>{s.risk_band ? <Pill band={s.risk_band}>{titleCase(s.risk_band)}</Pill> : <span className="faint">—</span>}</td>
                  <td className="num">{num(s.on_hand)}</td>
                  <td className="num">{num(s.units_30d)}</td>
                  <td className="num">{num(s.units_60d)}</td>
                  <td className="num">{num(s.units_alltime)}</td>
                  <td className="num">{money(s.revenue_alltime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > 250 && <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Showing first 250 — refine your search to narrow.</div>}
    </>
  );
}
