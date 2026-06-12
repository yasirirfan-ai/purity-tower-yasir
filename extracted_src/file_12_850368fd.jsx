/* global React, LIB */
const { fmt:f10, fmtK:fk10, usd:usd10, usdK:uk10, Ic:I10, Pill:P10, useState:uS10, useMemo:uM10, Pager:PG10, pageSlice:PSL10 } = LIB;
const { intercompanyStats:ICS10, IC_TERMS:ICT10 } = window.LIB_FIN;

const PURITY_C = "#8a2d5a", BABYLON_C = "#2a5f8f";
const pct10 = (x) => x == null ? "—" : Math.round(x * 100) + "%";

function Intercompany({ data, settings }) {
  const ic = uM10(() => ICS10(data, settings), [data, settings]);
  const [arLimit, setArLimit] = uS10(25);
  const [tpLimit, setTpLimit] = uS10(25);

  const covTone = ic.coverageRatio == null ? "neutral" : ic.coverageRatio >= 1.2 ? "good" : ic.coverageRatio >= 1 ? "warn" : "crit";
  const dsoTone = ic.dso <= ICT10 ? "good" : ic.dso <= 45 ? "warn" : "crit";
  const concTone = ic.purityShare > 0.6 ? "crit" : "good";

  return (
    <div className="fade-in">
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <span className="pill" style={{ background: BABYLON_C + "1e", color: BABYLON_C }}>Babylon — manufacturer</span>
        <span style={{ color: "var(--faint)" }}>{I10.arrowR({ style: { width: 15, height: 15 } })}</span>
        <span className="pill" style={{ background: PURITY_C + "1e", color: PURITY_C }}>Purity — brand / channels</span>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>cash &amp; goods flowing between the two entities</span>
      </div>

      {/* hero KPIs */}
      <div className="kpi-grid">
        <KPI10 label="Intercompany AR balance" value={uk10(ic.arBalance)} sub={`Purity owes Babylon · ${ic.invoices.length} open invoices`} edge={BABYLON_C} icon={I10.scale} />
        <KPI10 label="Days sales outstanding" value={ic.dso + " d"} sub={`target ≤ ${ICT10}d · ${ic.overdue > 0 ? uk10(ic.overdue) + " overdue" : "none overdue"}`} edge={{ good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[dsoTone]} icon={I10.clock} />
        <KPI10 label="Cash coverage ratio (30d)" value={ic.coverageRatio != null ? ic.coverageRatio.toFixed(2) + "×" : "—"} sub="(cash + Purity receipts) ÷ AP due" edge={{ good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", neutral: "var(--ink)" }[covTone]} icon={I10.trend} />
        <KPI10 label="Purity concentration" value={pct10(ic.purityShare)} sub="of Babylon revenue · target < 60%" edge={concTone === "crit" ? "var(--warn)" : "var(--good)"} icon={I10.channels} />
      </div>

      {/* Transfer pricing */}
      <div className="section-title"><h2>Transfer pricing model</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>MCU → transfer price (×{ic.transferMarkup}) → Purity margin</span><div className="line" /></div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>SKU</th><th>Product</th><th className="num">MCU (landed)</th><th className="num">Transfer price</th><th className="num">Babylon margin</th><th className="num">ASP</th><th className="num">Purity margin</th></tr></thead>
            <tbody>
              {PSL10(ic.tp, tpLimit).map((r) => (
                <tr key={r.sku} className="row">
                  <td className="sku-cell">{r.sku}</td>
                  <td className="name-cell" style={{ maxWidth: 230 }}>{r.name}</td>
                  <td className="num">${r.mcu.toFixed(2)}</td>
                  <td className="num" style={{ fontWeight: 700, color: BABYLON_C }}>${r.transfer.toFixed(2)}</td>
                  <td className="num">{pct10(r.babMargin)}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{r.asp ? "$" + r.asp.toFixed(2) : "—"}</td>
                  <td className="num" style={{ fontWeight: 700, color: r.purMargin != null && r.purMargin < 0 ? "var(--crit)" : PURITY_C }}>{pct10(r.purMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PG10 total={ic.tp.length} limit={tpLimit} setLimit={setTpLimit} />
      </div>

      {/* AR aging + settlement */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="card"><div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Intercompany AR aging</div>
          {[["0–30 days", ic.aging.b0, "var(--good)"], ["31–60 days", ic.aging.b31, "var(--warn)"], ["61–90 days", ic.aging.b61, "#c0392b"], ["90+ days", ic.aging.b90, "var(--crit)"]].map(([lbl, val, c]) => {
            const w = ic.arBalance > 0 ? (val / ic.arBalance) * 100 : 0;
            return (
              <div key={lbl} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{lbl}</span><span className="mono" style={{ fontWeight: 600 }}>{uk10(val)} · {Math.round(w)}%</span></div>
                <div style={{ height: 8, borderRadius: 4, background: "var(--hairline)", overflow: "hidden" }}><div style={{ width: w + "%", height: "100%", background: c }} /></div>
              </div>
            );
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--hairline)", fontSize: 12, color: "var(--muted)" }}>A 1-day DSO change moves Babylon's cash by <strong className="mono" style={{ color: "var(--ink)" }}>{uk10(ic.cashImpactPerDay)}</strong>. Concentration risk: <strong>{pct10(ic.purityShare)}</strong> of Babylon AR is Purity.</div>
        </div></div>

        <div className="card"><div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 12 }}>Cash settlement cadence</div>
          <SettleRow label="Cash on hand (Mercury)" value={uk10(ic.cashOnHand)} />
          <SettleRow label="Purity receipts due ≤30d" value={uk10(ic.purityReceipts30)} accent={PURITY_C} />
          <SettleRow label="Vendor AP due ≤30d" value={uk10(ic.apDue30)} accent={BABYLON_C} />
          <SettleRow label="Cash coverage ratio" value={ic.coverageRatio != null ? ic.coverageRatio.toFixed(2) + "×" : "—"} bold tone={covTone} />
          <SettleRow label="Min operating cash buffer" value={uk10(ic.minBuffer)} />
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>Member loan utilization</span><span className="mono" style={{ fontWeight: 600 }}>{uk10(ic.memberDrawn)} / {uk10(ic.memberFacility)}</span></div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--hairline)", overflow: "hidden" }}><div style={{ width: (ic.memberPct * 100) + "%", height: "100%", background: ic.memberPct > 0.8 ? "var(--crit)" : "var(--cap)" }} /></div>
          </div>
          {ic.floatInverted > 0 && <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 8, background: "var(--crit-tint)", fontSize: 12, color: "var(--crit)", fontWeight: 600 }}>{I10.alert({ style: { width: 13, height: 13, verticalAlign: "-2px", marginRight: 5 } })}{ic.floatInverted} SKUs pay vendors before Purity pays — float inverted</div>}
        </div></div>
      </div>

      {/* AR detail */}
      <div className="section-title"><h2>Intercompany receivables</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>open invoices, oldest first</span><div className="line" /></div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>PO</th><th>Product</th><th>SKU</th><th className="num">Qty</th><th className="num">Invoice (transfer)</th><th className="num">Age</th><th>Status</th></tr></thead>
            <tbody>
              {PSL10(ic.invoices, arLimit).map((inv, i) => {
                const od = inv.ageDays > ICT10;
                return (
                  <tr key={i} className="row">
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{inv.po}</td>
                    <td className="name-cell" style={{ maxWidth: 220 }}>{inv.product}</td>
                    <td className="sku-cell">{inv.sku}</td>
                    <td className="num">{f10(inv.qty)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{uk10(inv.amount)}</td>
                    <td className="num">{inv.ageDays}d</td>
                    <td><P10 tone={od ? "crit" : inv.ageDays > 0 ? "warn" : "good"}>{od ? "Overdue" : inv.ageDays > 0 ? "Aging" : "Current"}</P10></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <PG10 total={ic.invoices.length} limit={arLimit} setLimit={setArLimit} />
      </div>

      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>Transfer price = manufactured cost (real landed BOM) × {ic.transferMarkup} markup. Intercompany invoices derive from open POs aged from order date; DSO, settlement cadence &amp; member-loan figures are placeholder until the Purity billing + Mercury feeds connect. Source: Babylon × Purity Financial Modeling Framework §2.</div>
    </div>
  );
}

function KPI10({ label, value, sub, edge, icon }) {
  return (
    <div className="kpi">
      <div className="accent-edge" style={{ background: edge }} />
      <div className="label">{icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
function SettleRow({ label, value, bold, muted, accent, tone }) {
  const c = tone ? { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", neutral: "var(--ink)" }[tone] : accent;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--hairline)", fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: muted ? "var(--faint)" : c || "var(--ink)" }}>{label}</span>
      <span className="mono" style={{ color: c || "var(--ink)" }}>{value}</span>
    </div>
  );
}

window.VIEWS10 = { Intercompany };
