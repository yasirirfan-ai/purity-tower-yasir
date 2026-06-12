import { useMemo, useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { Loading, ErrorState, Pill } from '../components/ui';
import { useOpenSku } from '../App';

export function Exceptions() {
  const exc = useFetch<Array<Dict & { id: string }>>('/api/exceptions');
  const dq = useFetch<Array<Dict & { id: string }>>('/api/data-quality');
  const openSku = useOpenSku();
  const [type, setType] = useState('all');

  const { rows, types } = useMemo(() => {
    const all = exc.data ?? [];
    const types = ['all', ...Array.from(new Set(all.map((d) => String(d.exception_type ?? 'other'))))];
    let r = type === 'all' ? all : all.filter((d) => String(d.exception_type) === type);
    const sev: Record<string, number> = { high: 0, medium: 1, low: 2 };
    r = [...r].sort((a, b) => (sev[String(a.severity)] ?? 9) - (sev[String(b.severity)] ?? 9));
    return { rows: r, types };
  }, [exc.data, type]);

  if (exc.loading) return <Loading />;
  if (exc.error) return <ErrorState error={exc.error} />;

  return (
    <>
      {dq.data && dq.data.length > 0 && (
        <div className="card section-gap" style={{ marginTop: 0, marginBottom: 18 }}>
          <div className="card-head"><h3>Data quality</h3><span className="hint">{dq.data.filter((c) => c.status === 'pass').length}/{dq.data.length} checks passing</span></div>
          <div className="card-pad grid-3">
            {dq.data.map((c) => (
              <div key={c.id} className="row-between" style={{ fontSize: 12.5, alignItems: 'flex-start', gap: 8 }}>
                <span style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{String(c.title ?? c.id)}</div>
                  <div className="muted truncate">{String(c.message ?? '')}</div>
                </span>
                <Pill band={c.status === 'pass' ? 'good' : c.status === 'warn' ? 'warning' : 'critical'}>{titleCase(String(c.status))}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="row-between" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div className="chip-bar">
          {types.map((t) => <button key={t} className={`tag${type === t ? ' on' : ''}`} onClick={() => setType(t)}>{titleCase(t)}</button>)}
        </div>
        <span className="muted" style={{ fontSize: 12 }}>{num(rows.length)} exceptions</span>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>SKU</th><th>Product</th><th>Type</th><th>Severity</th><th>Message</th><th className="num">On hand</th><th className="num">Days cover</th></tr></thead>
            <tbody>
              {rows.slice(0, 250).map((d) => (
                <tr className="row" key={d.id} onClick={() => openSku(String(d.sku))}>
                  <td className="sku-cell">{String(d.sku)}</td>
                  <td className="name-cell">{String(d.product_name ?? '').replace(/\n/g, ' ')}</td>
                  <td><Pill band={d.exception_type}>{titleCase(String(d.exception_type ?? ''))}</Pill></td>
                  <td><Pill band={d.severity}>{titleCase(String(d.severity ?? ''))}</Pill></td>
                  <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(d.message ?? '')}</td>
                  <td className="num">{num(d.finished_goods_on_hand)}</td>
                  <td className="num">{d.days_of_cover_estimate == null ? '—' : num(d.days_of_cover_estimate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > 250 && <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>Showing first 250 of {num(rows.length)}.</div>}
    </>
  );
}
