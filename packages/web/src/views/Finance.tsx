import { useMemo, useState, type ReactNode } from 'react';
import { useFetch, type Dict } from '../lib/api';
import { Ic } from '../lib/icons';
import { Loading, ErrorState } from '../components/ui';
import { useOpenSku } from '../App';

interface Econ {
  sku: string; name: string; units60: number; rev60: number; asp: number;
  cogs: number; ing: number; pkg: number; labor: number; grossU: number; margin: number; gross60: number;
}
interface LeaseSide { label: string; monthly: number; down: number; interest?: number; buyout?: number; salvage?: number; net5y: number; owns: boolean }
interface FinanceData {
  modeled: boolean;
  economics: Econ[];
  totals: { rev60: number; cogs60: number; gross60: number; grossMargin: number; annualRevEst: number };
  workingCapital: { fgValue: number; ar: number; ap: number; capitalRatio: number | null; blendedUnitCost: number };
  leaseVsBuy: { buy: LeaseSide; lease: LeaseSide; favors: string; capex: number };
}

const PURITY_C = '#8a2d5a';
const BABYLON_C = '#2a5f8f';
const ING_C = '#2f7d52';
const PKG_C = '#3f51b5';

const usdK = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};
const pct = (x: number | null | undefined) => x == null ? '—' : Math.round(x * 100) + '%';

export function Finance() {
  const { data, loading, error } = useFetch<FinanceData>('/api/finance/summary');
  const { data: readinessRaw } = useFetch<Array<Dict & { id: string }>>('/api/readiness');
  const openSku = useOpenSku();
  const [company, setCompany] = useState<'purity' | 'babylon'>('purity');
  const [investor, setInvestor] = useState(false);
  const [econLimit, setEconLimit] = useState<number | 'all'>(10);

  const stranded = useMemo(() => {
    if (!readinessRaw) return { rows: [], total: 0 };
    const rows = readinessRaw
      .filter((d) => {
        const rate = Number(d.match_rate ?? 0);
        return rate > 0 && rate < 100;
      })
      .map((d) => {
        const rate = Number(d.match_rate ?? 0) / 100;
        const buildable = Number(d.buildable_units_estimate ?? 0);
        const ingCeil = rate > 0 ? Math.round(buildable / rate) : buildable;
        const pkgCeil = buildable;
        const strandedUnits = Math.max(0, ingCeil - pkgCeil);
        const blendedCost = data?.workingCapital?.blendedUnitCost ?? 8;
        const value = strandedUnits * blendedCost;
        const bottlenecks = (d.bottleneck_components as Dict[] | undefined) ?? [];
        return {
          sku: String(d.sku ?? d.id),
          name: String(d.product_name ?? '').replace(/\n/g, ' '),
          ingCeil, pkgCeil, matchRate: rate, strandedUnits, value,
          bottleneck: bottlenecks.length > 0 ? String(bottlenecks[0]?.sku ?? '') : '—',
        };
      })
      .filter((r) => r.strandedUnits > 0)
      .sort((a, b) => b.value - a.value);
    const total = rows.reduce((a, r) => a + r.value, 0);
    return { rows, total };
  }, [readinessRaw, data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const { totals: t, workingCapital: wc, leaseVsBuy: lb, economics } = data;
  const coC = company === 'purity' ? PURITY_C : BABYLON_C;
  const ratioTone = wc.capitalRatio == null ? 'neutral' : wc.capitalRatio >= 1.2 ? 'good' : wc.capitalRatio >= 1 ? 'warn' : 'crit';
  const ann = (v: number) => investor ? v * (365 / 60) : v;
  const shown = econLimit === 'all' ? economics : economics.slice(0, econLimit as number);
  const inverted = economics.filter((e) => e.margin < 0);

  // Key ratios
  const annRevEst = t.annualRevEst;
  const invTurns = wc.fgValue > 0 ? (annRevEst / wc.fgValue) : null;
  const daysInventory = invTurns != null ? Math.round(365 / invTurns) : null;
  const assetBase = wc.fgValue + wc.ar;
  const annEbitda = ann(t.gross60) * 0.7;
  const roa = assetBase > 0 ? (annEbitda / assetBase) : null;

  return (
    <div className="fade-in">
      {/* Company + investor toggles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div className="seg" style={{ borderColor: coC }}>
            <button
              className={company === 'purity' ? 'on' : ''}
              onClick={() => setCompany('purity')}
              style={company === 'purity' ? { background: PURITY_C, color: '#fff' } : undefined}
            >Purity (brand)</button>
            <button
              className={company === 'babylon' ? 'on' : ''}
              onClick={() => setCompany('babylon')}
              style={company === 'babylon' ? { background: BABYLON_C, color: '#fff' } : undefined}
            >Babylon (manufacturer)</button>
          </div>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>intercompany lens</span>
        </div>
        <div className="seg">
          <button className={!investor ? 'on' : ''} onClick={() => setInvestor(false)}>Operating view</button>
          <button className={investor ? 'on' : ''} onClick={() => setInvestor(true)}>Investor view</button>
        </div>
      </div>

      <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--muted)', maxWidth: 640, lineHeight: 1.5 }}>
        {company === 'purity'
          ? <><strong style={{ color: PURITY_C }}>Purity</strong> — the brand that owns demand &amp; sales channels. It buys finished goods from Babylon at a transfer price. The rule: <strong style={{ color: 'var(--ink)' }}>sell before you pay.</strong></>
          : <><strong style={{ color: BABYLON_C }}>Babylon</strong> — the manufacturer that owns ingredients, packaging &amp; production. It bills Purity a transfer price. The rule: <strong style={{ color: 'var(--ink)' }}>never strand cash on half a product.</strong></>}
      </p>

      {/* KPI grid */}
      <div className="kpi-grid">
        <FinCard
          label="Net float position"
          value={inverted.length === 0 ? 'Positive' : inverted.length + ' inverted'}
          sub={`${economics.length} SKUs · ${inverted.length} with negative margin`}
          edge={inverted.length === 0 ? 'var(--good)' : 'var(--crit)'}
          icon={Ic.trend({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label="Stranded capital"
          value={usdK(stranded.total)}
          sub={`${stranded.rows.length} SKUs blocked on packaging`}
          edge="var(--cap)"
          icon={Ic.scale({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label={company === 'purity' ? 'Purity gross margin' : 'Babylon transfer margin'}
          value={pct(t.grossMargin)}
          sub={`${usdK(ann(t.gross60))} gross · ${investor ? 'annualized' : 'trailing 60d'}`}
          edge={coC}
          icon={Ic.box({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label="Capital-efficiency ratio"
          value={wc.capitalRatio != null ? wc.capitalRatio.toFixed(2) + '×' : '—'}
          sub="(AR + FG) ÷ AP · target ≥ 1.0"
          edge={{ good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)', neutral: 'var(--ink)' }[ratioTone]}
          icon={Ic.box({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
      </div>

      {/* Stranded capital */}
      <div className="section-title">
        <h2>Stranded capital tracker</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>ingredient $ that can't be built today — packaging-limited</span>
        <div className="line" />
      </div>
      {stranded.rows.length === 0 ? (
        <div className="card"><div className="card-pad" style={{ color: 'var(--muted)', fontSize: 13 }}>No packaging-stranded ingredient capital right now.</div></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tbl-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th><th>Product</th>
                  <th className="num">Ingredient cap</th>
                  <th className="num">Packaging cap</th>
                  <th className="num">Match</th>
                  <th className="num">Stranded units</th>
                  <th className="num">Stranded $</th>
                  <th>Bottleneck</th>
                </tr>
              </thead>
              <tbody>
                {stranded.rows.map((s) => (
                  <tr key={s.sku} className="row" onClick={() => openSku(s.sku)}>
                    <td className="sku-cell">{s.sku}</td>
                    <td className="name-cell" style={{ maxWidth: 200 }}>{s.name}</td>
                    <td className="num" style={{ color: ING_C }}>{s.ingCeil.toLocaleString()}</td>
                    <td className="num" style={{ color: PKG_C }}>{s.pkgCeil.toLocaleString()}</td>
                    <td className="num">
                      <span className={`pill ${s.matchRate >= 0.85 ? 'good' : s.matchRate >= 0.5 ? 'warn' : 'crit'}`}>{Math.round(s.matchRate * 100)}%</span>
                    </td>
                    <td className="num">{s.strandedUnits.toLocaleString()}</td>
                    <td className="num" style={{ fontWeight: 700, color: 'var(--cap)' }}>{usdK(s.value)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.bottleneck}{s.value > 5000 ? ' ⚑' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: 'var(--surface-2)' }}>
                  <td colSpan={6}>Total stranded capital</td>
                  <td className="num" style={{ color: 'var(--cap)' }}>{usdK(stranded.total)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Working capital */}
      <div className="section-title">
        <h2>Working capital health</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>how cash is deployed across the supply chain</span>
        <div className="line" />
      </div>
      <div className="card"><div className="card-pad">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 1, background: 'var(--hairline)', marginBottom: 16 }}>
          <WcCell label="Finished goods" value={usdK(wc.fgValue)} tone="var(--ink)" />
          <WcCell label="Est. receivables" value={usdK(wc.ar)} tone="var(--good)" />
          <WcCell label="Accounts payable" value={usdK(wc.ap)} tone="var(--crit)" />
          <WcCell label="Capital ratio" value={wc.capitalRatio != null ? wc.capitalRatio.toFixed(2) + '×' : '—'} tone={{ good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)', neutral: 'var(--muted)' }[ratioTone]} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div className="eyebrow">Capital-efficiency ratio</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: { good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)', neutral: 'var(--ink)' }[ratioTone], lineHeight: 1, marginTop: 6 }}>
              {wc.capitalRatio != null ? wc.capitalRatio.toFixed(2) + '×' : '—'}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
            <strong>(AR + sellable FG) ÷ AP outstanding.</strong> Above 1.0 the operation can self-fund supplier payments from inventory + receivables; below 1.0 it's structurally cash-negative.
          </div>
          <span className={`pill ${ratioTone}`}>{ratioTone === 'good' ? 'Healthy' : ratioTone === 'warn' ? 'Watch' : ratioTone === 'neutral' ? 'No data' : 'Cash-negative'}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>AR, AP and FG values use modeled costs — awaiting AP feed + real BOM costs.</div>
      </div></div>

      {/* Key ratios */}
      <div className="section-title">
        <h2>Key ratios</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>the metrics PE buyers anchor on</span>
        <div className="line" />
      </div>
      <div className="kpi-grid">
        <FinCard
          label="Inventory turns"
          value={invTurns != null ? invTurns.toFixed(1) + '×' : '—'}
          sub={daysInventory != null ? `${daysInventory} days on hand · target 4–6×` : 'annual COGS ÷ avg inventory'}
          edge={invTurns != null ? (invTurns >= 4 ? 'var(--good)' : invTurns >= 2 ? 'var(--warn)' : 'var(--crit)') : 'var(--ink)'}
          icon={Ic.box({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label="Return on assets"
          value={roa != null ? Math.round(roa * 100) + '%' : '—'}
          sub={`${usdK(annEbitda)} est. EBITDA ÷ ${usdK(assetBase)} assets`}
          edge={roa != null && roa >= 0.15 ? 'var(--good)' : 'var(--warn)'}
          icon={Ic.trend({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label="Avg inventory value"
          value={usdK(wc.fgValue)}
          sub={`${usdK(wc.ap)} AP outstanding`}
          edge="var(--cap)"
          icon={Ic.scale({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
        <FinCard
          label="Equipment financing"
          value={lb.favors === 'buy' ? 'Buy' : 'Lease'}
          sub={`buy ${usdK(lb.buy.net5y)} vs lease ${usdK(lb.lease.net5y)} · 5-yr net`}
          edge="var(--ink)"
          icon={Ic.recon({ style: { width: 14, height: 14, color: 'var(--faint)', flexShrink: 0 } })}
        />
      </div>

      {/* Brand P&L */}
      <div className="section-title">
        <h2>{company === 'purity' ? 'Brand P&L — Purity' : 'Manufacturer P&L — Babylon'}</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{investor ? 'annualized run-rate' : 'trailing 60 days'}</span>
        <div className="line" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className="card"><div className="card-pad">
          {company === 'purity' ? (
            <>
              <PLRow label="Net revenue (end-customer sales)" value={usdK(ann(t.rev60))} bold />
              <PLRow label="COGS (transfer price paid to Babylon)" value={usdK(ann(t.cogs60))} />
              <PLRow label="Gross profit" value={usdK(ann(t.gross60))} bold accent={PURITY_C} />
              <PLRow label="Gross margin" value={pct(t.grossMargin)} muted />
            </>
          ) : (
            <>
              <PLRow label="Intercompany revenue (transfer to Purity)" value={usdK(ann(t.rev60))} bold />
              <PLRow label="Manufacturing COGS" value={usdK(ann(t.cogs60))} />
              <PLRow label="Gross profit (transfer margin)" value={usdK(ann(t.gross60))} bold accent={BABYLON_C} />
              <PLRow label="Gross margin" value={pct(t.grossMargin)} muted />
            </>
          )}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--hairline)', fontSize: 11.5, color: 'var(--faint)' }}>
            COGS = blended ${wc.blendedUnitCost.toFixed(2)}/unit model. {investor ? 'Annualized ×6.08. ' : ''}Real BOM costs pending.
          </div>
        </div></div>

        <div className="card"><div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {company === 'purity' ? 'Channel mix' : 'Landed cost structure'}
            {' '}<span style={{ color: 'var(--faint)', textTransform: 'none', fontWeight: 400 }}>· awaiting per-channel feed</span>
          </div>
          {[['Direct (DTC)', 0.48], ['Amazon', 0.32], ['Wholesale', 0.20]].map(([name, share]) => (
            <div key={String(name)} style={{ marginBottom: 9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span>{name}</span>
                <span className="mono" style={{ color: 'var(--muted)' }}>{usdK(ann(t.rev60) * (share as number))} · {Math.round((share as number) * 100)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--hairline)', overflow: 'hidden' }}>
                <div style={{ width: `${(share as number) * 100}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
            </div>
          ))}
        </div></div>
      </div>

      {/* Equipment: lease vs buy */}
      <div className="section-title" style={{ marginTop: 22 }}>
        <h2>Equipment: lease vs. buy</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{usdK(lb.capex)} Sipuxin buildout · 5-year horizon</span>
        <div className="line" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[lb.buy, lb.lease].map((o) => {
          const favored = lb.favors === (o.owns ? 'buy' : 'lease');
          return (
            <div key={o.label} className="card" style={{ outline: favored ? '2px solid var(--good)' : 'none' }}>
              <div className="card-pad">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{o.label}</h3>
                  {favored && <span className="pill good">Lower 5-yr cost</span>}
                </div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, margin: '10px 0 2px' }}>
                  {usdK(o.monthly)}<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>/mo</span>
                </div>
                <PLRow label="Upfront / down" value={usdK(o.down)} />
                {o.owns
                  ? <PLRow label="Total interest (5y)" value={usdK(o.interest)} />
                  : <PLRow label="FMV buyout" value={usdK(o.buyout)} />}
                {o.owns
                  ? <PLRow label="Residual value (owned)" value={'−' + usdK(o.salvage)} accent="var(--good)" />
                  : <PLRow label="Asset owned?" value="No (until buyout)" muted />}
                <PLRow label="Net 5-year cost" value={usdK(o.net5y)} bold accent={favored ? 'var(--good)' : undefined} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10 }}>
        Buying via SBA 504 (6.5%, 10% down) builds an owned asset with residual value and a stronger balance sheet for the PE story; leasing preserves cash and keeps the equipment off the books. Rates &amp; residuals are placeholder — confirm with the lender.
      </div>

      {/* SKU unit economics */}
      <div className="section-title">
        <h2>SKU unit economics</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>top {economics.length} SKUs by 60d gross · {investor ? 'annualized' : 'trailing 60d'}</span>
        <div className="line" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th>
                <th className="num">ASP</th><th className="num">COGS</th>
                <th className="num">Gross/unit</th><th className="num">Margin</th>
                <th className="num">{investor ? 'Annual gross' : 'Gross (60d)'}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e) => (
                <tr className="row" key={e.sku} onClick={() => openSku(e.sku)}>
                  <td className="sku-cell">{e.sku}</td>
                  <td className="name-cell">{e.name.replace(/\n/g, ' ')}</td>
                  <td className="num">${e.asp.toFixed(2)}</td>
                  <td className="num">${e.cogs.toFixed(2)}</td>
                  <td className="num" style={{ color: e.grossU >= 0 ? 'var(--good)' : 'var(--crit)' }}>${e.grossU.toFixed(2)}</td>
                  <td className="num">
                    <span className={`pill ${e.margin >= 0.4 ? 'good' : e.margin >= 0.2 ? 'warn' : 'crit'}`}>{pct(e.margin)}</span>
                  </td>
                  <td className="num" style={{ fontWeight: 600 }}>{usdK(investor ? e.gross60 * (365 / 60) : e.gross60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {economics.length > 10 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--muted)' }}>
            <span className="tnum">Showing {econLimit === 'all' ? economics.length : Math.min(econLimit as number, economics.length)} of {economics.length}</span>
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
              {([10, 25, 'all'] as (number | 'all')[]).map((o) => (
                <button key={String(o)} onClick={() => setEconLimit(o)} className={`tag${econLimit === o ? ' on' : ''}`} style={{ fontSize: 11, padding: '3px 10px' }}>{o === 'all' ? 'All' : o}</button>
              ))}
            </span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 10 }}>
        Finance is a lens over existing inventory and procurement data. Unit costs are modeled (blended ${wc.blendedUnitCost.toFixed(2)}, COGS capped at 60% of ASP) until a real BOM cost master lands.
      </div>
    </div>
  );
}

function FinCard({ label, value, sub, edge, icon }: { label: string; value: string; sub: string; edge: string; icon: ReactNode }) {
  return (
    <div className="kpi">
      <div className="accent-edge" style={{ background: edge }} />
      <div className="label">{icon}{label}</div>
      <div className="value" style={{ fontSize: 22 }}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
function WcCell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: tone }}>{value}</div>
    </div>
  );
}
function PLRow({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--hairline)', fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: muted ? 'var(--faint)' : accent || 'var(--ink)' }}>{label}</span>
      <span className="mono" style={{ color: muted ? 'var(--faint)' : accent || 'var(--ink)' }}>{value}</span>
    </div>
  );
}
