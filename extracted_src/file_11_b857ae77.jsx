/* global React, LIB */
const { fmt:f9, fmtK:fk9, usd:usd9, usdK:uk9, Ic:I9, Pill:P9, useState:uS9, useMemo:uM9 } = LIB;
const { finStats:FS9, FIN_CHANNELS:CH9, FIN_PURITY_SHARE:PS9, skuLandedCost:SLC9, skuEconomics:SE9, lifecycleCapital:LC9, skuLifecycle:SLF9, lifecycleRows:LFR9, FIN_TRANSFER_MARKUP:TM9 } = window.LIB_FIN;

const ING9 = "#2f7d52", PKG9 = "#3f51b5";
const PURITY_C = "#8a2d5a", BABYLON_C = "#2a5f8f";

function Finance({ data, settings }) {
  const [investor, setInvestor] = uS9(false);
  const [company, setCompany] = uS9("purity");
  const fin = uM9(() => FS9(data, settings), [data, settings]);
  const wc = fin.wc;
  const ratioTone = wc.capitalRatio == null ? "neutral" : wc.capitalRatio >= 1.2 ? "good" : wc.capitalRatio >= 1 ? "warn" : "crit";
  const purityTone = PS9 > 0.6 ? "crit" : "good";
  const annualize = (v) => investor ? v * (365 / 60) : v;
  const co = company === "purity" ? fin.purity : fin.babylon;
  const coC = company === "purity" ? PURITY_C : BABYLON_C;
  const pct = (x) => x == null ? "—" : Math.round(x * 100) + "%";

  return (
    <div className="fade-in">
      {/* company toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="seg" style={{ borderColor: coC }}>
            <button className={company === "purity" ? "on" : ""} onClick={() => setCompany("purity")} style={company === "purity" ? { background: PURITY_C, color: "#fff" } : null}>Purity (brand)</button>
            <button className={company === "babylon" ? "on" : ""} onClick={() => setCompany("babylon")} style={company === "babylon" ? { background: BABYLON_C, color: "#fff" } : null}>Babylon (manufacturer)</button>
          </div>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>intercompany lens</span>
        </div>
        <div className="seg">
          <button className={!investor ? "on" : ""} onClick={() => setInvestor(false)}>Operating view</button>
          <button className={investor ? "on" : ""} onClick={() => setInvestor(true)}>Investor view</button>
        </div>
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)", maxWidth: 640, lineHeight: 1.5 }}>
        {company === "purity"
          ? <>Viewing <strong style={{ color: PURITY_C }}>Purity</strong> — the brand that owns demand &amp; sales channels. It buys finished goods from Babylon at a transfer price. The rule: <strong style={{ color: "var(--ink)" }}>sell before you pay.</strong></>
          : <>Viewing <strong style={{ color: BABYLON_C }}>Babylon</strong> — the manufacturer that owns ingredients, packaging &amp; production. It bills Purity a transfer price (cost × {TM9}). The rule: <strong style={{ color: "var(--ink)" }}>never strand cash on half a product.</strong></>}
      </p>

      {/* hero stat cards */}
      <div className="kpi-grid">
        <FinCard label="Net float position" value={fin.inverted.length === 0 ? "Positive" : fin.inverted.length + " inverted"} sub={`${fin.float.length} SKUs · ${fin.critical.length} critical`} edge={fin.inverted.length === 0 ? "var(--good)" : "var(--crit)"} icon={I9.trend} />
        <FinCard label="Stranded capital" value={uk9(fin.strandedTotal)} sub={company === "babylon" ? "Babylon owns this raw material" : `${fin.stranded.length} SKUs blocked on packaging`} edge="var(--cap)" icon={I9.scale} />
        <FinCard label={company === "purity" ? "Purity gross margin" : "Babylon transfer margin"} value={pct(co.margin)} sub={`${uk9(annualize(co.gross60))} gross · ${Math.round(fin.pl.bomCoverage * 100)}% BOM-costed`} edge={coC} icon={I9.box} />
        <FinCard label="Capital-efficiency ratio" value={wc.capitalRatio != null ? wc.capitalRatio.toFixed(2) + "×" : "—"} sub="(AR + FG) ÷ AP · target ≥ 1.0" edge={{ good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", neutral: "var(--ink)" }[ratioTone]} icon={I9.box} />
      </div>

      {/* Float engine */}
      <div className="section-title"><h2>Float engine</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>cash-in (ready at 3PL) vs. cash-out (invoice due) per SKU</span><div className="line" /></div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>SKU</th><th>Product</th><th className="num">Cash-out (pay)</th><th className="num">Cash-in (ready)</th><th className="num">Float gap</th><th>Status</th></tr></thead>
            <tbody>
              {fin.float.filter((f) => f.gap != null).sort((a, b) => a.gap - b.gap).map((f, i) => {
                const tone = f.gap >= 0 ? "good" : f.gap >= -14 ? "warn" : "crit";
                return (
                  <tr key={i} className="row">
                    <td className="sku-cell">{f.sku}</td>
                    <td className="name-cell" style={{ maxWidth: 240 }}>{f.name}</td>
                    <td className="num">day {f.payByOff}</td>
                    <td className="num">day {f.readyOff}</td>
                    <td className="num" style={{ fontWeight: 700, color: { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[tone] }}>{f.gap > 0 ? "+" : ""}{f.gap}d</td>
                    <td><P9 tone={tone}>{f.gap >= 0 ? "Sell before pay" : f.gap >= -14 ? "Tight" : "Inverted"}</P9></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "10px 16px", fontSize: 11, color: "var(--faint)", borderTop: "1px solid var(--hairline)" }}>Float gap = ready-at-3PL date − latest supplier invoice date. Positive = revenue can begin before payment is due. PO values use placeholder unit costs.</div>
      </div>

      {/* Stranded capital */}
      <div className="section-title"><h2>Stranded capital tracker</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>ingredient $ that can't be built today — packaging-limited</span><div className="line" /></div>
      {fin.stranded.length === 0 ? (
        <div className="card"><div className="card-pad" style={{ color: "var(--muted)", fontSize: 13 }}>No packaging-stranded ingredient capital right now.</div></div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>SKU</th><th>Product</th><th className="num">Ingredient cap</th><th className="num">Packaging cap</th><th className="num">Match</th><th className="num">Stranded units</th><th className="num">Stranded $</th><th>Bottleneck</th></tr></thead>
              <tbody>
                {fin.stranded.map((s, i) => (
                  <tr key={i} className="row">
                    <td className="sku-cell">{s.sku}</td>
                    <td className="name-cell" style={{ maxWidth: 200 }}>{s.name}</td>
                    <td className="num" style={{ color: ING9 }}>{fk9(s.ingCeil)}</td>
                    <td className="num" style={{ color: PKG9 }}>{fk9(s.pkgCeil)}</td>
                    <td className="num"><P9 tone={s.matchRate >= 0.85 ? "good" : s.matchRate >= 0.5 ? "warn" : "crit"}>{Math.round(s.matchRate * 100)}%</P9></td>
                    <td className="num">{f9(s.strandedUnits)}</td>
                    <td className="num" style={{ fontWeight: 700, color: "var(--cap)" }}>{usd9(s.value)}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.bottleneck}{s.value > 5000 ? " ⚑" : ""}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{ fontWeight: 700, background: "var(--surface-2)" }}><td colSpan="6">Total stranded capital</td><td className="num" style={{ color: "var(--cap)" }}>{usd9(fin.strandedTotal)}</td><td></td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Working capital */}
      <div className="section-title"><h2>Working capital health</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>how cash is deployed across the supply chain</span><div className="line" /></div>
      <div className="card"><div className="card-pad">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 1, background: "var(--hairline)", marginBottom: 16 }}>
          <WcCell label="Ingredients on hand" value={uk9(annualize(wc.ingOnHand) / (investor ? 365 / 60 : 1))} tone={ING9} />
          <WcCell label="Packaging on hand" value={uk9(wc.pkgOnHand)} tone={PKG9} />
          <WcCell label="Finished goods" value={uk9(wc.fgValue)} tone="var(--ink)" />
          <WcCell label="Est. receivables" value={uk9(wc.ar)} tone="var(--good)" />
          <WcCell label="Accounts payable" value={uk9(wc.ap)} tone="var(--crit)" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">Capital-efficiency ratio</div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)", neutral: "var(--ink)" }[ratioTone], lineHeight: 1, marginTop: 6 }}>{wc.capitalRatio != null ? wc.capitalRatio.toFixed(2) + "×" : "—"}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
            <strong>(AR + sellable FG) ÷ AP outstanding.</strong> Above 1.0 the operation can self-fund supplier payments from inventory + receivables; below 1.0 it's structurally cash-negative.
          </div>
          <P9 tone={ratioTone}>{ratioTone === "good" ? "Healthy" : ratioTone === "warn" ? "Watch" : "Cash-negative"}</P9>
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>AR, AP and component values use placeholder costs &amp; collection assumptions — awaiting the AP feed + real BOM costs.</div>
      </div></div>

      {/* Power ratios */}
      <div className="section-title"><h2>Key ratios</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>the metrics PE buyers anchor on</span><div className="line" /></div>
      <div className="kpi-grid">
        <FinCard label="Inventory turns" value={fin.ratios.invTurns != null ? fin.ratios.invTurns.toFixed(1) + "×" : "—"} sub={fin.ratios.daysInventory != null ? Math.round(fin.ratios.daysInventory) + " days on hand · target 4–6×" : "annual COGS ÷ avg inventory"} edge={fin.ratios.invTurns >= 4 ? "var(--good)" : fin.ratios.invTurns >= 2 ? "var(--warn)" : "var(--crit)"} icon={I9.box} />
        <FinCard label="Return on assets" value={fin.ratios.roa != null ? Math.round(fin.ratios.roa * 100) + "%" : "—"} sub={`${uk9(fin.ratios.annualEbitda)} EBITDA ÷ ${uk9(fin.ratios.assetBase)} assets`} edge={fin.ratios.roa >= 0.15 ? "var(--good)" : "var(--warn)"} icon={I9.trend} />
        <FinCard label="Avg inventory value" value={uk9(fin.ratios.avgInventory)} sub={`${uk9(fin.ratios.rawInvValue)} raw + ${uk9(wc.fgValue)} finished`} edge="var(--cap)" icon={I9.scale} />
        <FinCard label="CapEx intensity" value={fin.ratios.capexPctRev != null ? Math.round(fin.ratios.capexPctRev * 100) + "%" : "—"} sub={`${uk9(fin.ratios.capex)} equipment ÷ annual revenue`} edge="var(--ink)" icon={I9.recon} />
      </div>

      {/* Lease vs buy */}
      <div className="section-title" style={{ marginTop: 22 }}><h2>Equipment: lease vs. buy</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{uk9(fin.leaseVsBuy.capex)} Sipuxin buildout · 5-year horizon</span><div className="line" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[fin.leaseVsBuy.buy, fin.leaseVsBuy.lease].map((o) => {
          const favored = (o.owns && fin.leaseVsBuy.favors === "buy") || (!o.owns && fin.leaseVsBuy.favors === "lease");
          return (
            <div key={o.label} className="card" style={{ outline: favored ? "2px solid var(--good)" : "none" }}><div className="card-pad">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{o.label}</h3>
                {favored && <P9 tone="good">Lower 5-yr cost</P9>}
              </div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 700, margin: "10px 0 2px" }}>{uk9(o.monthly)}<span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>/mo</span></div>
              <div style={{ marginTop: 10 }}>
                <PLRow label="Upfront / down" value={uk9(o.down)} />
                {o.owns ? <PLRow label="Total interest (5y)" value={uk9(o.interest)} /> : <PLRow label="FMV buyout" value={uk9(o.buyout)} />}
                {o.owns ? <PLRow label="Residual value (owned)" value={"−" + uk9(o.salvage).replace("$", "$")} accent="var(--good)" /> : <PLRow label="Asset owned?" value="No (until buyout)" muted />}
                <PLRow label="Net 5-year cost" value={uk9(o.net5y)} bold accent={favored ? "var(--good)" : null} />
              </div>
            </div></div>
          );
        })}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Buying via SBA 504 (6.5%, 10% down) builds an owned asset with residual value and a stronger balance sheet for the PE story; leasing preserves cash and keeps the equipment off the books. Rates &amp; residuals are placeholder — confirm with the lender.</div>

      {/* PO lifecycle capital */}
      <div className="section-title"><h2>PO lifecycle — capital by state</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>where the open-PO book's cash sits: ingredient → component → finished</span><div className="line" /></div>
      <LifecycleCapital />

      {/* SKU financial lifecycle */}
      <SkuLifecycleSection data={data} investor={investor} company={company} />

      {/* Brand P&L */}
      <div className="section-title"><h2>{company === "purity" ? "Brand P&L — Purity" : "Manufacturer P&L — Babylon"}</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{investor ? "annualized run-rate" : "trailing 60 days"}</span><div className="line" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
        <div className="card"><div className="card-pad">
          {company === "purity" ? (
            <>
              <PLRow label="Net revenue (end-customer sales)" value={uk9(annualize(co.rev60))} bold />
              <PLRow label={co.label} value={uk9(annualize(co.cogs60))} />
              <PLRow label="Gross profit" value={uk9(annualize(co.gross60))} bold accent={PURITY_C} />
              <PLRow label="Gross margin" value={pct(co.margin)} muted />
            </>
          ) : (
            <>
              <PLRow label={"Intercompany revenue (transfer to Purity ×" + TM9 + ")"} value={uk9(annualize(co.rev60))} bold />
              <PLRow label={co.label} value={uk9(annualize(co.cogs60))} />
              <PLRow label="Gross profit (transfer margin)" value={uk9(annualize(co.gross60))} bold accent={BABYLON_C} />
              <PLRow label="Gross margin" value={pct(co.margin)} muted />
            </>
          )}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--hairline)", fontSize: 11.5, color: "var(--faint)" }}>
            COGS rolled up from real BOM unit costs across {fin.pl.costedSkus} of {fin.pl.totalSoldSkus} selling SKUs ({Math.round(fin.pl.bomCoverage * 100)}% costed), scaled to full net revenue. {investor ? "Annualized ×6.08. " : ""}Transfer price = landed cost × {TM9} (placeholder intercompany markup).
          </div>
        </div></div>
        <div className="card"><div className="card-pad">
          {/* landed-cost waterfall for the active company */}
          <div className="eyebrow" style={{ marginBottom: 10 }}>{company === "purity" ? "Channel mix" : "Landed cost structure"} <span style={{ color: "var(--faint)", textTransform: "none", fontWeight: 400 }}>{company === "purity" ? "· awaiting per-channel feed" : "· blended per unit"}</span></div>
          {company === "purity" ? CH9.map((c) => (
            <div key={c.name} style={{ marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{c.name}</span><span className="mono" style={{ color: "var(--muted)" }}>{uk9(annualize(fin.pl.netRev60) * c.share)} · {Math.round(c.share * 100)}%</span></div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--hairline)", overflow: "hidden" }}><div style={{ width: (c.share * 100) + "%", height: "100%", background: "var(--accent)" }} /></div>
            </div>
          )) : <CostStructure />}
        </div></div>
      </div>

      {/* diversification */}
      <div className="card" style={{ marginTop: 16, background: purityTone === "crit" ? "var(--warn-tint)" : "var(--surface-2)" }}><div className="card-pad" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {I9.alert({ style: { width: 20, height: 20, color: "var(--warn)", flex: "none" } })}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="eyebrow">Client diversification — the key PE-readiness metric</div>
          <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 5, lineHeight: 1.5 }}>Purity is <strong>{Math.round(PS9 * 100)}%</strong> of Babylon revenue. Diversifying below <strong>60%</strong> within 24 months is the most critical narrative for a PE buyer.</div>
        </div>
        <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: purityTone === "crit" ? "var(--warn)" : "var(--good)" }}>{Math.round(PS9 * 100)}%</div>
      </div></div>

      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 16 }}>Finance is a lens over existing Inventory, Match-rate and Procurement data. Float gaps &amp; stranded units are computed from real plans; unit costs, vendor terms, AR estimates and channel mix are placeholder until the AP / BOM / channel feeds connect.</div>
    </div>
  );
}

function FinCard({ label, value, sub, edge, icon }) {
  return (
    <div className="kpi">
      <div className="accent-edge" style={{ background: edge }} />
      <div className="label">{icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{label}</div>
      <div className="value" style={{ fontSize: 22 }}>{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}
function WcCell({ label, value, tone }) {
  return (
    <div style={{ background: "var(--surface)", padding: "12px 14px" }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: tone }}>{value}</div>
    </div>
  );
}
function PLRow({ label, value, bold, muted, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--hairline)", fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500 }}>
      <span style={{ color: muted ? "var(--faint)" : accent || "var(--ink)" }}>{label}</span>
      <span className="mono" style={{ color: muted ? "var(--faint)" : accent || "var(--ink)" }}>{value}</span>
    </div>
  );
}
function CostStructure() {
  // average landed-cost breakdown across costed hero SKUs
  const builds = (window.INV_BOM && window.INV_BOM.products) || [];
  const rows = builds.map((b) => SLC9(b.sku)).filter(Boolean);
  if (rows.length === 0) return <div style={{ fontSize: 12.5, color: "var(--muted)" }}>No costed BOMs available.</div>;
  const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const parts = [
    { label: "Goods (ingredients + packaging)", v: avg("goods"), c: ING9 },
    { label: "Inbound freight", v: avg("freight"), c: "#0d7d8a" },
    { label: "Import duty", v: avg("duty"), c: "#b46a09" },
    { label: "Fill / assembly labor", v: avg("labor"), c: "#8a8580" },
  ];
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  return (
    <div>
      {parts.map((p) => (
        <div key={p.label} style={{ marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}><span>{p.label}</span><span className="mono" style={{ color: "var(--muted)" }}>${p.v.toFixed(2)} · {Math.round(p.v / tot * 100)}%</span></div>
          <div style={{ height: 6, borderRadius: 3, background: "var(--hairline)", overflow: "hidden" }}><div style={{ width: (p.v / tot * 100) + "%", height: "100%", background: p.c }} /></div>
        </div>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--hairline)" }}><span>Avg landed cost / unit</span><span className="mono">${tot.toFixed(2)}</span></div>
    </div>
  );
}

/* ===== SKU financial lifecycle — cost cascade across the PO life cycle ===== */
function SkuLifecycleSection({ data, investor, company }) {
  const [q, setQ] = uS9("");
  const [limit, setLimit] = uS9(10);
  const [openSku, setOpenSku] = uS9(null);
  const rows = uM9(() => LFR9(data), [data]);
  const ann = (v) => investor && v != null ? v * (365 / 60) : v;

  const filtered = uM9(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => r.sku.toLowerCase().includes(t) || (r.name || "").toLowerCase().includes(t));
  }, [rows, q]);
  const shown = limit === "all" ? filtered : filtered.slice(0, limit);
  const pct = (x) => x == null ? "—" : Math.round(x * 100) + "%";

  return (
    <>
      <div className="section-title"><h2>SKU financial lifecycle</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>cost cascade: ingredients → components → landed COGS → transfer → retail · {investor ? "annualized" : "per unit / 60d"}</span><div className="line" /></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <div className="search" style={{ maxWidth: 320 }}>{I9.search ? I9.search({}) : null}<input placeholder="Search SKU or product…" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button onClick={() => setQ("")} style={{ color: "var(--faint)" }}>{I9.x({ style: { width: 14, height: 14 } })}</button>}</div>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }} className="tnum">{f9(filtered.length)} SKUs costed</span>
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr>
              <th>SKU / product</th>
              <th className="num">Ingredients</th><th className="num">Packaging</th><th className="num">Frt+duty</th>
              <th className="num">Landed COGS</th><th className="num">Transfer</th><th className="num">Retail ASP</th>
              <th className="num">Gross/unit</th><th className="num">Purity GM%</th>
              <th className="num">{investor ? "Annual gross" : "60d units"}</th>
            </tr></thead>
            <tbody>
              {shown.map((r) => {
                const open = openSku === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr className="row" onClick={() => setOpenSku(open ? null : r.sku)} style={{ cursor: "pointer" }}>
                      <td><div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><span style={{ color: "var(--faint)", fontSize: 10 }}>{open ? "▾" : "▸"}</span><span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span></div><div className="mono" style={{ fontSize: 10.5, color: "var(--faint)", paddingLeft: 16 }}>{r.sku} · {r.ingCount} ing · {r.pkgCount} pkg</div></td>
                      <td className="num" style={{ color: ING9 }}>${r.ingGoods.toFixed(2)}</td>
                      <td className="num" style={{ color: PKG9 }}>${r.pkgGoods.toFixed(2)}</td>
                      <td className="num" style={{ color: "var(--muted)" }}>${(r.freight + r.duty).toFixed(2)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>${r.landed.toFixed(2)}</td>
                      <td className="num">${r.transfer.toFixed(2)}</td>
                      <td className="num">{r.asp != null ? "$" + r.asp.toFixed(2) : "—"}</td>
                      <td className="num" style={{ color: r.grossUnit >= 0 ? "var(--good)" : "var(--crit)" }}>{r.grossUnit != null ? "$" + r.grossUnit.toFixed(2) : "—"}</td>
                      <td className="num"><P9 tone={r.purMargin >= 0.4 ? "good" : r.purMargin >= 0.2 ? "warn" : "crit"}>{pct(r.purMargin)}</P9></td>
                      <td className="num" style={{ fontWeight: 600 }}>{investor ? uk9(ann(r.annualGross)) : f9(r.units60)}</td>
                    </tr>
                    {open && (
                      <tr><td colSpan="10" style={{ background: "var(--surface-2)", padding: 0 }}>
                        <LifecycleDetail r={r} />
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager9 total={filtered.length} limit={limit} setLimit={setLimit} />
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Cost cascade per finished SKU: ingredient buys + packaging-component buys + inbound freight &amp; duty + fill labor = landed COGS → Babylon transfer price (×{TM9}) → retail ASP (from trailing sales). Click a row for the component- and ingredient-level PO economics. Unit costs from the real BOM; clamped below ASP where placeholder prices overstate.</div>
    </>
  );
}
function LifecycleDetail({ r }) {
  const Stage = ({ label, val, sub, color }) => (
    <div style={{ flex: 1, minWidth: 90 }}>
      <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: color || "var(--ink)", marginTop: 2 }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--faint)" }}>{sub}</div>}
    </div>
  );
  const tbl = (title, list, color) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>{title} ({list.length})</div>
      <table className="data" style={{ fontSize: 11.5 }}>
        <thead><tr><th>Item</th><th>Vendor</th><th className="num">$/unit</th><th className="num">Lead</th><th>Terms</th></tr></thead>
        <tbody>
          {list.map((c, i) => (
            <tr key={i}>
              <td><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="dotmark" style={{ background: color }} />{c.desc}{c.imported ? " 🚢" : ""}</span></td>
              <td style={{ color: "var(--muted)" }}>{c.vendor}</td>
              <td className="num">${c.landed.toFixed(3)}</td>
              <td className="num" style={{ color: "var(--muted)" }}>{c.lead ? c.lead + "w" : "—"}</td>
              <td style={{ color: "var(--muted)", fontSize: 10.5 }}>{c.terms || "—"}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan="5" style={{ color: "var(--faint)", textAlign: "center", padding: 10 }}>None costed</td></tr>}
        </tbody>
      </table>
    </div>
  );
  return (
    <div style={{ padding: "16px 18px" }}>
      {/* cost cascade */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <Stage label="Ingredients" val={"$" + r.ingGoods.toFixed(2)} color={ING9} />
        <Arrow9 />
        <Stage label="Packaging" val={"$" + r.pkgGoods.toFixed(2)} color={PKG9} />
        <Arrow9 />
        <Stage label="+ Frt/duty/labor" val={"$" + (r.freight + r.duty + r.labor).toFixed(2)} sub="inbound + fill" color="var(--muted)" />
        <Arrow9 />
        <Stage label="Landed COGS" val={"$" + r.landed.toFixed(2)} color="var(--ink)" />
        <Arrow9 />
        <Stage label="Transfer" val={"$" + r.transfer.toFixed(2)} sub={"Bab GM " + (r.babMargin != null ? Math.round(r.babMargin * 100) + "%" : "—")} color={BABYLON_C} />
        <Arrow9 />
        <Stage label="Retail ASP" val={r.asp != null ? "$" + r.asp.toFixed(2) : "—"} sub={"Pur GM " + (r.purMargin != null ? Math.round(r.purMargin * 100) + "%" : "—")} color={PURITY_C} />
      </div>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        {tbl("Ingredient POs", r.ingredients, ING9)}
        {tbl("Packaging component POs", r.components, PKG9)}
      </div>
    </div>
  );
}
function Arrow9() { return <span style={{ color: "var(--faint)", fontSize: 14 }}>→</span>; }
function Pager9({ total, limit, setLimit }) {
  if (total <= 10) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--hairline)", fontSize: 12, color: "var(--muted)" }}>
      <span className="tnum">Showing {limit === "all" ? total : Math.min(limit, total)} of {total}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
        {[10, 25, "all"].map((o) => <button key={o} onClick={() => setLimit(o)} className={"tag" + (limit === o ? " on" : "")} style={{ fontSize: 11, padding: "3px 10px" }}>{o === "all" ? "All" : o}</button>)}
      </span>
    </div>
  );
}

/* ===== PO lifecycle — capital by state ===== */
function LifecycleCapital() {
  const lc = LC9 ? LC9() : null;
  if (!lc) return <div className="card"><div className="card-pad" style={{ color: "var(--muted)", fontSize: 12.5 }}>Open-PO capital data unavailable.</div></div>;
  const max = Math.max(...lc.states.map((s) => s.value), 1);
  const tierC = { ingredient: ING9, component: PKG9, finished: "#2a6f4f" };
  return (
    <div className="card"><div className="card-pad">
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 16 }}>
        <div><div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>{uk9(lc.bookValue)}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>open-PO book value · {lc.poCount} POs</div></div>
        <div style={{ display: "flex", gap: 14, marginLeft: "auto", flexWrap: "wrap" }}>
          {[["ingredient", "Ingredient"], ["component", "Component"], ["finished", "Finished WIP"]].map(([k, lbl]) => (
            <div key={k}><div className="mono" style={{ fontSize: 16, fontWeight: 700, color: tierC[k] }}>{uk9(lc.tiers[k])}</div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>{lbl}</div></div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lc.states.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 190, fontSize: 12, display: "flex", alignItems: "center", gap: 7 }}><span className="dotmark" style={{ background: s.color }} />{s.label}</div>
            <div style={{ flex: 1, height: 18, background: "var(--surface-2)", borderRadius: 5, overflow: "hidden" }}><div style={{ width: (s.value / max * 100) + "%", height: "100%", background: s.color }} /></div>
            <div className="mono" style={{ width: 70, textAlign: "right", fontSize: 12.5, fontWeight: 600 }}>{uk9(s.value)}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>Committed cash from the open finished-goods PO book, by the lifecycle state each dollar currently sits in — ingredient/component buys through production, micro hold, transit, and sellable-at-3PL. Shares are a deterministic placeholder until live PO status connects.</div>
    </div></div>
  );
}

window.VIEWS9 = { Finance };