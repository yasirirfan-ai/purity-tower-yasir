import { useFetch, type Dict } from '../lib/api';
import { num, money, titleCase } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { useOpenChannel } from '../App';

interface ChannelsData {
  channels: Array<Dict & { id: string }>;
  monthly: Array<Dict & { id: string }>;
}

const CH_COLOR: Record<string, string> = {
  amazon: '#b46a09', deposco: '#3f51b5', berkeley: '#2f7d52', china: '#c0392b', pod: '#8a2d5a',
};

export function Channels() {
  const { data, loading, error } = useFetch<ChannelsData>('/api/channels');
  const openChannel = useOpenChannel();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const channels = [...data.channels].sort((a, b) => Number(b.recent_units_sold ?? 0) - Number(a.recent_units_sold ?? 0));
  const totalUnits = channels.reduce((a, c) => a + Number(c.recent_units_sold ?? 0), 0);
  const totalOnHand = channels.reduce((a, c) => a + Number(c.finished_goods_on_hand ?? 0), 0);

  // monthly actuals for the "all" scope, by month
  const months = data.monthly
    .filter((m) => m.channel === 'all')
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const maxMonthUnits = Math.max(1, ...months.map((m) => Number(m.actual_units ?? 0)));

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 18 }}>
        <div className="row-between">
          <div>
            <div className="eyebrow">Unified total available inventory</div>
            <div className="bignum" style={{ marginTop: 6, fontSize: 28 }}>{num(totalOnHand)} <span className="faint" style={{ fontSize: 14 }}>units</span></div>
          </div>
          <div className="legend">
            {channels.map((c) => <span key={c.id}><span className="sw" style={{ background: CH_COLOR[c.id] ?? 'var(--faint)' }} />{titleCase(c.id)}</span>)}
          </div>
        </div>
        <div className="barpair" style={{ marginTop: 14 }}>
          {channels.map((c) => {
            const w = totalUnits ? (Number(c.recent_units_sold ?? 0) / totalUnits) * 100 : 0;
            return w > 0 ? <div key={c.id} title={`${titleCase(c.id)}: ${num(c.recent_units_sold)} units`} style={{ width: `${w}%`, background: CH_COLOR[c.id] ?? 'var(--faint)' }}>{w > 7 ? titleCase(c.id) : ''}</div> : null;
          })}
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Share of recent units sold by channel.</div>
      </div>

      <div className="grid-3">
        {channels.map((c) => (
          <button className="card card-pad channel-card" key={c.id} onClick={() => openChannel(c.id)}>
            <div className="row-between">
              <h3 style={{ margin: 0, fontSize: 15 }}>{titleCase(c.id)}</h3>
              <span className="sw" style={{ width: 12, height: 12, borderRadius: 4, background: CH_COLOR[c.id] ?? 'var(--faint)' }} />
            </div>
            <div className="metric-grid" style={{ marginTop: 12 }}>
              <Metric k="On hand" v={num(c.finished_goods_on_hand)} />
              <Metric k="Units (all-time)" v={num(c.recent_units_sold)} />
              <Metric k="Revenue (all-time)" v={money(c.recent_revenue)} />
              <Metric k="SKUs sales / inv." v={`${num(c.sales_sku_count)} / ${num(c.inventory_sku_count)}`} />
            </div>
            <div className="channel-cta">View SKUs →</div>
          </button>
        ))}
      </div>

      {months.length > 0 && (
        <div className="card section-gap">
          <div className="card-head"><h3>Monthly sales (all channels)</h3><span className="hint">actual units</span></div>
          <div className="card-pad">
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
              {months.map((m) => {
                const h = (Number(m.actual_units ?? 0) / maxMonthUnits) * 100;
                return (
                  <div key={m.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }} title={`${m.month}: ${num(m.actual_units)} units · ${money(m.actual_revenue)}`}>
                    <div style={{ width: '100%', height: `${h}%`, background: 'var(--accent)', borderRadius: '4px 4px 0 0', minHeight: 2 }} />
                    <div className="faint" style={{ fontSize: 9, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{String(m.month).slice(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Metric({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="m"><div className="k">{k}</div><div className="v">{v}</div></div>;
}
