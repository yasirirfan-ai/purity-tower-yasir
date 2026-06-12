import { useMemo, useState } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { num, money, titleCase } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';

interface MonthRow { month: string; units: number; revenue: number; confidence?: number }

export function Forecast() {
  const { data, loading, error } = useFetch<Array<Dict & { id: string }>>('/api/forecast');
  const [channel, setChannel] = useState('all');

  const { channels, byMonth } = useMemo(() => {
    const all = data ?? [];
    // channel-scope, sku == 'all' rows give the aggregate per channel per month
    const agg = all.filter((d) => d.scope === 'channel' && d.sku === 'all');
    const channels = ['all', ...Array.from(new Set(agg.map((d) => String(d.channel))))];
    const rows: MonthRow[] = channel === 'all'
      ? sumByMonth(agg) // sum across channels
      : agg.filter((d) => d.channel === channel).map((d) => ({ month: String(d.month), units: Number(d.forecast_units ?? 0), revenue: Number(d.forecast_revenue ?? 0), confidence: Number(d.confidence ?? 0) }));
    rows.sort((a, b) => a.month.localeCompare(b.month));
    return { channels, byMonth: rows };
  }, [data, channel]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const maxU = Math.max(1, ...byMonth.map((m) => m.units));
  const totalU = byMonth.reduce((a, m) => a + m.units, 0);
  const totalR = byMonth.reduce((a, m) => a + m.revenue, 0);

  return (
    <>
      <div className="row-between" style={{ marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div className="chip-bar">
          {channels.map((c) => <button key={c} className={`tag${channel === c ? ' on' : ''}`} onClick={() => setChannel(c)}>{titleCase(c)}</button>)}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          6-month total: <b>{num(totalU)}</b> units · <b>{money(totalR)}</b>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Forecast by month — {titleCase(channel)}</h3><span className="hint">weighted 30/60/90-day velocity</span></div>
        <div className="card-pad">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 200 }}>
            {byMonth.map((m) => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 11 }}>{num(m.units)}</span>
                <div title={`${m.month}: ${num(m.units)} units · ${money(m.revenue)}`} style={{ width: '70%', height: `${(m.units / maxU) * 100}%`, background: 'linear-gradient(180deg,var(--accent),#bd5a89)', borderRadius: '5px 5px 0 0', minHeight: 3 }} />
                <span className="faint" style={{ fontSize: 11 }}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card section-gap">
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Month</th><th className="num">Forecast units</th><th className="num">Forecast revenue</th>{channel !== 'all' && <th className="num">Confidence</th>}</tr></thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="mono">{m.month}</td>
                  <td className="num">{num(m.units)}</td>
                  <td className="num">{money(m.revenue)}</td>
                  {channel !== 'all' && <td className="num">{num((m.confidence ?? 0) * 100)}%</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function sumByMonth(rows: Dict[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const d of rows) {
    const month = String(d.month);
    const e = map.get(month) ?? { month, units: 0, revenue: 0 };
    e.units += Number(d.forecast_units ?? 0);
    e.revenue += Number(d.forecast_revenue ?? 0);
    map.set(month, e);
  }
  return [...map.values()];
}
