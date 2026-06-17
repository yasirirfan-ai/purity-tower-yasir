import { useFetch, type Dict } from '../lib/api';
import { num } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { useOpenChannel } from '../App';

interface ChannelsData {
  channels: Array<Dict & { id: string }>;
  monthly: Array<Dict & { id: string }>;
}

const CHANNEL_ORDER = ['amazon', 'deposco', 'pod', 'berkeley', 'china'];

const CHANNEL_META: Record<string, { label: string; sub: string; live: boolean }> = {
  amazon:   { label: 'Amazon',         sub: 'FBA + Seller Fulfilled',     live: false },
  deposco:  { label: 'Deposco',        sub: '3PL warehouse (live source)', live: true  },
  pod:      { label: 'PODs',           sub: 'Print-on-demand / pop-up',    live: false },
  berkeley: { label: 'Berkeley retail',sub: 'Flagship store',              live: false },
  china:    { label: 'China',          sub: 'Cross-border / Tmall',        live: false },
};

const HATCH_CSS = `
  repeating-linear-gradient(
    -45deg,
    var(--hairline) 0px,
    var(--hairline) 1px,
    transparent 1px,
    transparent 8px
  )
`;

export function Channels() {
  const { data, loading, error } = useFetch<ChannelsData>('/api/channels');
  const openChannel = useOpenChannel();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const byId = Object.fromEntries(data.channels.map((c) => [c.id, c]));
  const deposco = byId['deposco'];
  const totalOnHand = Number(deposco?.finished_goods_on_hand ?? deposco?.recent_units_sold ?? 0);
  const allSkuCount = Number(deposco?.inventory_sku_count ?? 0);

  const channelUnits = (id: string) => {
    const c = byId[id];
    return Number(c?.finished_goods_on_hand ?? c?.recent_units_sold ?? 0);
  };

  return (
    <div className="fade-in">
      {/* unified pool card */}
      <div className="card" style={{ padding: '24px 28px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
              Unified Total Available Inventory
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.5px', marginBottom: 12 }}>
              {num(totalOnHand)} units — one pool today
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 560 }}>
              The file gives us a single combined 3PL position. When the five channel feeds connect,
              this bar splits — so you'll instantly see Amazon running dry while Deposco sits on surplus.
            </p>
          </div>
          <button className="btn-ghost" style={{ whiteSpace: 'nowrap', marginTop: 4, flexShrink: 0, fontSize: 12, padding: '6px 14px', border: '1px solid var(--hairline)', borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', cursor: 'default' }}>
            Awaiting channel feeds
          </button>
        </div>

        {/* segmented bar */}
        <div style={{ display: 'flex', height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--hairline)' }}>
          {CHANNEL_ORDER.map((id) => {
            const meta = CHANNEL_META[id];
            const isLive = meta?.live;
            const segStyle: React.CSSProperties = isLive
              ? { flex: 1, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 600 }
              : { flex: 1, background: HATCH_CSS, backgroundColor: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13, borderRight: '1px solid var(--hairline)' };
            return (
              <div key={id} style={segStyle}>
                {meta?.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* channel cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {CHANNEL_ORDER.map((id) => {
          const meta = CHANNEL_META[id];
          const ch = byId[id];
          const isLive = meta?.live;
          const onHand = Number(ch?.finished_goods_on_hand ?? ch?.recent_units_sold ?? 0);
          return (
            <button
              key={id}
              className="card"
              onClick={() => openChannel(id)}
              style={{ padding: '16px 18px', textAlign: 'left', cursor: 'pointer', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 10 }}
            >
              {/* card header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--hairline)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                {isLive
                  ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--good)', background: 'color-mix(in srgb, var(--good) 12%, transparent)', padding: '2px 7px', borderRadius: 99 }}>Live</span>
                  : <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>No feed</span>
                }
              </div>

              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{meta?.label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>{meta?.sub}</div>

              {onHand > 0 ? (
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px', lineHeight: 1.1 }}>{num(isLive ? (onHand || totalOnHand) : onHand)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {(() => {
                      const skus = Number(ch?.inventory_sku_count ?? ch?.sales_sku_count ?? 0);
                      const rev = Number(ch?.recent_revenue ?? 0);
                      const parts: string[] = ['units'];
                      if (skus) parts.push(`${num(skus)} SKUs`);
                      if (rev && !isLive) parts.push(`$${num(Math.round(rev / 1000))}k rev`);
                      return parts.join(' · ');
                    })()}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {['TAI by SKU', 'Low-stock alerts', 'Transfer suggestions'].map((label) => (
                    <div key={label} style={{ height: 10, borderRadius: 4, background: 'var(--hairline)', maxWidth: label.length * 7 }} title={label} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
