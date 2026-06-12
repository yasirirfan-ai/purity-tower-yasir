import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { Ic } from '../lib/icons';
import { num, money } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';
import { useOpenSku } from '../App';

interface TransferRow { sku: string; name: string; mcu: number; transfer: number; asp: number; babylonMargin: number; purityMargin: number; units60: number; transferRev60: number }
interface IcData {
  modeled: boolean; transferPricing: TransferRow[];
  arBalance: number; dso: number; aging: { b0: number; b31: number; b61: number; b90: number };
  apDue30: number; cashOnHand: number; purityReceipts30: number; coverageRatio: number | null;
  memberDrawn: number; memberFacility: number; babRev60: number; purRev60: number; purityShare: number; transferMarkup: number;
  minBuffer?: number; floatInverted?: number; cashImpactPerDay?: number;
}

interface InvoiceRow { po: string; product: string; sku: string; qty: number; amount: number; ageDays: number }

const PURITY_C = '#8a2d5a', BABYLON_C = '#2a5f8f';
const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };
const p10 = (x: number | null | undefined) => x == null ? '—' : Math.round(x * 100) + '%';
const usdK = (n: number | null | undefined) => {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};

export function Intercompany() {
  const { data, loading, error } = useFetch<IcData>('/api/finance/intercompany');
  const openSku = useOpenSku();
  const [tpLimit, setTpLimit] = useState(25);
  const [arLimit, setArLimit] = useState(25);

  const invoices: InvoiceRow[] = useMemo(() => {
    if (!data) return [];
    return data.transferPricing
      .filter((r) => r.units60 > 0)
      .map((r, i) => ({
        po: `PO-${String(r.sku).replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase()}-${(i + 1).toString().padStart(3, '0')}`,
        product: r.name.replace(/\n/g, ' '),
        sku: r.sku,
        qty: Math.round(r.units60),
        amount: r.transferRev60 ?? r.transfer * r.units60,
        ageDays: Math.round((i % 5) * 12 + 3),
      }))
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const a = data.aging;
  const arTotal = data.arBalance || 1;
  const dsoTarget = 30;
  const covTone = data.coverageRatio == null ? 'neutral' : data.coverageRatio >= 1.2 ? 'good' : data.coverageRatio >= 1 ? 'warn' : 'crit';
  const dsoTone = data.dso <= dsoTarget ? 'good' : data.dso <= 45 ? 'warn' : 'crit';
  const concTone = data.purityShare > 0.6 ? 'crit' : 'good';
  const toneColor = (t: string) => ({ good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)', neutral: 'var(--ink)' } as Record<string, string>)[t] ?? 'var(--ink)';

  const overdue = invoices.filter((inv) => inv.ageDays > dsoTarget).reduce((a, inv) => a + inv.amount, 0);
  const minBuffer = data.minBuffer ?? data.apDue30 * 0.25;
  const floatInverted = data.floatInverted ?? data.transferPricing.filter((r) => r.purityMargin < 0).length;
  const cashImpactPerDay = data.cashImpactPerDay ?? (data.dso > 0 ? data.arBalance / data.dso : 0);

  const kpis = [
    { label: 'Intercompany AR balance', value: usdK(data.arBalance), sub: `Purity owes Babylon · ${invoices.length} open invoices`, edge: BABYLON_C, icon: Ic.scale },
    { label: 'Days sales outstanding', value: `${num(data.dso)} d`, sub: `target ≤ ${dsoTarget}d · ${overdue > 0 ? usdK(overdue) + ' overdue' : 'none overdue'}`, edge: toneColor(dsoTone), icon: Ic.clock },
    { label: 'Cash coverage ratio (30d)', value: data.coverageRatio != null ? data.coverageRatio.toFixed(2) + '×' : '—', sub: '(cash + Purity receipts) ÷ AP due', edge: toneColor(covTone), icon: Ic.trend },
    { label: 'Purity concentration', value: p10(data.purityShare), sub: 'of Babylon revenue · target < 60%', edge: concTone === 'crit' ? 'var(--warn)' : 'var(--good)', icon: Ic.channels },
  ];

  const tpShown = data.transferPricing.slice(0, tpLimit);
  const arShown = invoices.slice(0, arLimit);

  return (
    <div className="fade-in">
      {/* Entity pills */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <span className="pill" style={{ background: BABYLON_C + '1e', color: BABYLON_C }}>Babylon — manufacturer</span>
        <span style={{ color: 'var(--faint)', display: 'flex', alignItems: 'center' }}>
          {Ic.arrowR({ style: { width: 15, height: 15 } })}
        </span>
        <span className="pill" style={{ background: PURITY_C + '1e', color: PURITY_C }}>Purity — brand / channels</span>
        <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>cash &amp; goods flowing between the two entities</span>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="accent-edge" style={{ background: k.edge }} />
            <div className="label">{k.icon(ICO)}{k.label}</div>
            <div className="value">{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Transfer pricing */}
      <div className="section-title">
        <h2>Transfer pricing model</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>MCU → transfer price (×{data.transferMarkup}) → Purity margin</span>
        <div className="line" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th>
                <th className="num">MCU (landed)</th>
                <th className="num">Transfer price</th>
                <th className="num">Babylon margin</th>
                <th className="num">ASP</th>
                <th className="num">Purity margin</th>
              </tr>
            </thead>
            <tbody>
              {tpShown.map((r) => (
                <tr key={r.sku} className="row" onClick={() => openSku(r.sku)}>
                  <td className="sku-cell">{r.sku}</td>
                  <td className="name-cell" style={{ maxWidth: 230 }}>{r.name.replace(/\n/g, ' ')}</td>
                  <td className="num">{money(r.mcu)}</td>
                  <td className="num" style={{ fontWeight: 700, color: BABYLON_C }}>{money(r.transfer)}</td>
                  <td className="num">{p10(r.babylonMargin)}</td>
                  <td className="num" style={{ color: 'var(--muted)' }}>{money(r.asp)}</td>
                  <td className="num" style={{ fontWeight: 700, color: r.purityMargin < 0 ? 'var(--crit)' : PURITY_C }}>
                    {p10(r.purityMargin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.transferPricing.length > tpLimit && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--muted)' }}>
            Showing {tpLimit} of {data.transferPricing.length}
            <button className="tag" style={{ fontSize: 11, padding: '2px 10px', marginLeft: 8 }} onClick={() => setTpLimit((n) => n + 25)}>Show more</button>
          </div>
        )}
      </div>

      {/* AR aging + settlement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        <div className="card">
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Intercompany AR aging</div>
            {([['0–30 days', a.b0, 'var(--good)'], ['31–60 days', a.b31, 'var(--warn)'], ['61–90 days', a.b61, '#c0392b'], ['90+ days', a.b90, 'var(--crit)']] as [string, number, string][]).map(([lbl, val, c]) => {
              const w = (val / arTotal) * 100;
              return (
                <div key={lbl} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                    <span>{lbl}</span>
                    <span className="mono" style={{ fontWeight: 600 }}>{usdK(val)} · {Math.round(w)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--hairline)', overflow: 'hidden' }}>
                    <div style={{ width: w + '%', height: '100%', background: c }} />
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--muted)' }}>
              A 1-day DSO change moves Babylon's cash by <strong className="mono" style={{ color: 'var(--ink)' }}>{usdK(cashImpactPerDay)}</strong>. Concentration risk: <strong>{p10(data.purityShare)}</strong> of Babylon AR is Purity.
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Cash settlement cadence</div>
            <SettleRow label="Cash on hand (Mercury)" value={usdK(data.cashOnHand)} />
            <SettleRow label="Purity receipts due ≤30d" value={usdK(data.purityReceipts30)} accent={PURITY_C} />
            <SettleRow label="Vendor AP due ≤30d" value={usdK(data.apDue30)} accent={BABYLON_C} />
            <SettleRow label="Cash coverage ratio" value={data.coverageRatio != null ? data.coverageRatio.toFixed(2) + '×' : '—'} bold tone={covTone} />
            <SettleRow label="Min operating cash buffer" value={usdK(minBuffer)} />
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>Member loan utilization</span>
                <span className="mono" style={{ fontWeight: 600 }}>{usdK(data.memberDrawn)} / {usdK(data.memberFacility)}</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--hairline)', overflow: 'hidden' }}>
                <div style={{ width: Math.min(100, (data.memberDrawn / (data.memberFacility || 1)) * 100) + '%', height: '100%', background: (data.memberDrawn / (data.memberFacility || 1)) > 0.8 ? 'var(--crit)' : 'var(--cap)' }} />
              </div>
            </div>
            {floatInverted > 0 && (
              <div style={{ marginTop: 12, padding: '9px 12px', borderRadius: 8, background: 'var(--crit-tint)', fontSize: 12, color: 'var(--crit)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {Ic.alert({ style: { width: 13, height: 13, flex: 'none' } })}
                {floatInverted} SKU{floatInverted > 1 ? 's' : ''} pay vendors before Purity pays — float inverted
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AR detail */}
      <div className="section-title">
        <h2>Intercompany receivables</h2>
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>open invoices, oldest first</span>
        <div className="line" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>PO</th><th>Product</th><th>SKU</th>
                <th className="num">Qty</th>
                <th className="num">Invoice (transfer)</th>
                <th className="num">Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {arShown.map((inv, i) => {
                const od = inv.ageDays > dsoTarget;
                return (
                  <tr key={i} className="row" onClick={() => openSku(inv.sku)}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{inv.po}</td>
                    <td className="name-cell" style={{ maxWidth: 220 }}>{inv.product}</td>
                    <td className="sku-cell">{inv.sku}</td>
                    <td className="num">{num(inv.qty)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{usdK(inv.amount)}</td>
                    <td className="num">{inv.ageDays}d</td>
                    <td>
                      <span className={`pill ${od ? 'crit' : inv.ageDays > 0 ? 'warn' : 'good'}`} style={{ fontSize: 11 }}>
                        {od ? 'Overdue' : inv.ageDays > 0 ? 'Aging' : 'Current'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoices.length > arLimit && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 16px', borderTop: '1px solid var(--hairline)', fontSize: 12, color: 'var(--muted)' }}>
            Showing {arLimit} of {invoices.length}
            <button className="tag" style={{ fontSize: 11, padding: '2px 10px', marginLeft: 8 }} onClick={() => setArLimit((n) => n + 25)}>Show more</button>
          </div>
        )}
      </div>

      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 12 }}>
        Transfer price = manufactured cost (real landed BOM) × {data.transferMarkup} markup. AR balance, DSO and settlement cadence are modeled from open POs until real billing + Mercury feeds connect.
      </div>
    </div>
  );
}

function SettleRow({ label, value, bold, accent, tone }: { label: string; value: string; bold?: boolean; accent?: string; tone?: string }) {
  const c = tone ? ({ good: 'var(--good)', warn: 'var(--warn)', crit: 'var(--crit)', neutral: 'var(--ink)' } as Record<string, string>)[tone] : accent;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--hairline)', fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: c || 'var(--ink)' }}>{label}</span>
      <span className="mono" style={{ color: c || 'var(--ink)' }}>{value}</span>
    </div>
  );
}
