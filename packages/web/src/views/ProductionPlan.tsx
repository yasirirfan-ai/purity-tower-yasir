import { useMemo, useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { Loading, ErrorState, Pill, CountStat } from '../components/ui';
import { useOpenSku } from '../App';

export function ProductionPlan() {
  const { data, loading, error } = useFetch<Array<Dict & { id: string }>>('/api/production-plan');
  const openSku = useOpenSku();
  const [filter, setFilter] = useState('all');

  const { rows, statuses } = useMemo(() => {
    const all = data ?? [];
    const statuses = ['all', ...Array.from(new Set(all.map((d) => String(d.status ?? 'unknown'))))];
    let r = all;
    if (filter !== 'all') r = r.filter((d) => String(d.status) === filter);
    r = [...r].sort((a, b) => Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0));
    return { rows: r, statuses };
  }, [data, filter]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const ready = (data ?? []).filter((d) => d.status === 'ready_to_schedule').length;
  const blocked = (data ?? []).filter((d) => d.status === 'blocked').length;
  const suggested = (data ?? []).reduce((a, d) => a + Number(d.suggested_build_quantity ?? 0), 0);

  return (
    <>
      <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
        <CountStat label="Ready to schedule" value={num(ready)} band="ready" />
        <CountStat label="Blocked on materials" value={num(blocked)} band="blocked" />
        <CountStat label="Suggested build units" value={num(suggested)} />
        <CountStat label="Plans" value={num((data ?? []).length)} />
      </div>

      <div className="row-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div className="chip-bar">
          {statuses.map((s) => <button key={s} className={`tag${filter === s ? ' on' : ''}`} onClick={() => setFilter(s)}>{titleCase(s)}</button>)}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Build queue</h3><span className="hint">Sorted by priority · click a row for detail</span></div>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th><th>Status</th><th>Constraint</th>
                <th className="num">Priority</th><th className="num">On hand</th>
                <th className="num">Suggested build</th><th className="num">Open orders</th>
                <th>Scheduled wk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr className="row" key={d.id} onClick={() => openSku(String(d.sku ?? d.id))}>
                  <td className="sku-cell">{String(d.sku ?? d.id)}</td>
                  <td className="name-cell">{String(d.product_name ?? '').replace(/\n/g, ' ')}</td>
                  <td><Pill band={d.status}>{titleCase(String(d.status ?? ''))}</Pill></td>
                  <td className="muted">{titleCase(String(d.constraint ?? '—'))}</td>
                  <td className="num">{num(d.priority_score)}</td>
                  <td className="num">{num(d.finished_goods_on_hand)}</td>
                  <td className="num">{num(d.suggested_build_quantity)}</td>
                  <td className="num">{num(d.open_finished_goods_order_quantity)}</td>
                  <td className="muted">{String(d.scheduled_week ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
