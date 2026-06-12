/* global React, LIB */
const { fmt, fmtK, usd, usdK, fmtDate, COVER, Ic, Pill, CoverPill, Bar, useState, useMemo, reviewsRollup, regulatoryRollup } = LIB;

const ING_C = "#2f7d52", ING_T = "#e6f2ea";
const PKG_C = "#3f51b5", PKG_T = "#eaecf8";

/* ===================================================================== */
/* OVERVIEW                                                              */
/* ===================================================================== */
function Overview({ data, go }) {
  const { meta, flags, overCapital, builds, strandedCapital, totalCogsValue, totalRetailValue, totalOverstockCogs, totalOverstockRetail } = data;
  const critCount = flags.stockout.length + flags.critical.length;
  const rev = reviewsRollup();
  const reg = regulatoryRollup(data.skus);
  const worst = [...builds].sort((a, b) => a.matchRate - b.matchRate).slice(0, 3);
  const [kpiSel, setKpiSel] = useState(null);

  const kpis = [
    { key: "tai", label: "Total Available Inventory", value: fmtK(meta.totalOnHand), unit: "units", sub: `${meta.totalSkus} SKUs across the 3PL pool`, edge: "var(--ink)", icon: Ic.box },
    { key: "sell", label: "60-day sell-through", value: fmtK(meta.total60Units), unit: "units", sub: `${usdK(meta.total60Rev)} net revenue`, edge: "var(--good)", icon: Ic.trend },
    { key: "flags", label: "Critical supply flags", value: fmt(critCount), unit: "", sub: `${flags.stockout.length} selling with zero stock`, edge: "var(--crit)", icon: Ic.alert },
    { key: "capital", label: "Inventory at COGS", value: usdK(totalCogsValue), unit: "", sub: `vs ${usdK(totalRetailValue)} retail · ${usdK(totalOverstockCogs)} overstock`, edge: "var(--cap)", icon: Ic.scale },
  ];

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        {kpis.map((k) => (
          <button className="kpi kpi-btn" key={k.key} onClick={() => setKpiSel(k.key)}>
            <div className="accent-edge" style={{ background: k.edge }} />
            <div className="label">{k.icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{k.label}</div>
            <div className="value">{k.value}{k.unit && <span className="unit">{k.unit}</span>}</div>
            <div className="sub">{k.sub}</div>
            <span className="kpi-cta">{Ic.arrowR({ style: { width: 13, height: 13 } })} itemized</span>
          </button>
        ))}
      </div>
      {kpiSel && <KpiDrawer kpi={kpiSel} data={data} go={go} onClose={() => setKpiSel(null)} />}

      {/* Match-rate hero */}
      <div className="section-title"><h2>Match-rate predictor</h2><span className="pill ink" style={{ fontSize: 10 }}>PRIORITY</span><div className="line" /><button className="btn" onClick={() => go("predictor")}>Open predictor {Ic.arrowR({})}</button></div>
      <div className="card">
        <div className="card-pad" style={{ display: "grid", gridTemplateColumns: "1.1fr 1px 1fr", gap: 24, alignItems: "center" }}>
          <div>
            <div className="eyebrow">The question this answers</div>
            <p style={{ fontSize: 15.5, lineHeight: 1.5, margin: "10px 0 14px", maxWidth: 460 }}>
              Babylon owns the ingredients. Purity owns the demand. <strong>You can only sell what you can also package.</strong> This flags the imbalance before you spend on raw material you can't ship.
            </p>
            <div style={{ display: "flex", gap: 22 }}>
              <Counter label="Balanced" value={builds.filter(b => b.matchRate >= 0.85).length} tone="var(--good)" />
              <Counter label="Constrained" value={data.constrained.length} tone="var(--crit)" />
              <Counter label="Stranded ingredient $" value={usdK(strandedCapital)} tone="var(--cap)" mono />
            </div>
          </div>
          <div style={{ background: "var(--hairline)", alignSelf: "stretch" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="eyebrow">Tightest matches right now</div>
            {worst.map((b) => <MiniMatch key={b.sku} b={b} onClick={() => go("predictor")} />)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 22 }}>
        {/* Early warning */}
        <div className="card" style={{ overflow: "hidden" }}>
          <div className="card-head"><h3>Early-warning flags</h3><span className="hint">Sorted by urgency</span></div>
          <div>
            <FlagRow tone="crit" icon={Ic.ban} title={`${flags.stockout.length} SKUs selling with zero stock`} desc="Live demand, nothing in the warehouse — lost revenue today." onClick={() => go("inventory", { band: "stockout" })} />
            <FlagRow tone="crit" icon={Ic.flame} title={`${flags.critical.length} SKUs under 30 days of cover`} desc="Will stock out within the replenishment lead time." onClick={() => go("inventory", { band: "crit" })} />
            <FlagRow tone="warn" icon={Ic.clock} title={`${flags.expiring.length} lots expiring within 6 months`} desc="At-risk inventory that should be sold or written down." onClick={() => go("inventory", { band: "exp" })} />
            <FlagRow tone="cap" icon={Ic.scale} title={`${flags.over.length} overstocked SKUs — ${usdK(overCapital)} tied up`} desc="More than a year of cover. Capital that could fund packaging." onClick={() => go("inventory", { band: "over" })} />
            <FlagRow tone="neutral" icon={Ic.x} title={`${flags.disco.length} discontinued SKUs still holding stock`} desc="DISCO status with units on the floor — clear or repurpose." onClick={() => go("inventory", { band: "disco" })} />
            <FlagRow tone="crit" icon={Ic.chat} title={`${rev.issue} products flagged in customer reviews`} desc={`${rev.critical} reviews flag an adverse reaction or quality issue. ${rev.watch} more on watch.`} onClick={() => go("inventory", { band: "revissue" })} />
            <FlagRow tone="warn" icon={Ic.recon} title={`${reg.gaps} SKUs with regulatory-dossier gaps`} desc={`Missing compliance records (COA, SDS, IFRA, CPSR…). ${reg.partial} more in progress.`} onClick={() => go("inventory", { band: "reggaps" })} />
          </div>
        </div>

        {/* Channels teaser + reconciliation */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="awaiting" style={{ padding: 18 }}>
            <div className="await-tag"><Pill tone="neutral">Awaiting data</Pill></div>
            <div className="eyebrow">Channel split</div>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 14px", lineHeight: 1.5 }}>Once channel feeds connect, TAI splits across all five — so you can see Amazon running dry while Deposco sits on surplus.</p>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["Amazon", "Deposco", "PODs", "Berkeley", "China"].map((c) => <span key={c} className="tag" style={{ opacity: .6 }}>{c}</span>)}
            </div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => go("channels")}>Preview channel view {Ic.arrowR({})}</button>
          </div>
          <div className="card" style={{ cursor: "pointer" }} onClick={() => go("recon")}>
            <div className="card-pad">
              <div className="eyebrow">Lot reconciliation</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                <span className="mono" style={{ fontSize: 26, fontWeight: 600 }}>{Math.round(meta.reconFound / meta.reconTotal * 100)}%</span>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>of conditioner lots found in warehouse</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
                <div style={{ flex: meta.reconFound, height: 8, borderRadius: 4, background: "var(--good)" }} />
                <div style={{ flex: meta.reconMissing, height: 8, borderRadius: 4, background: "var(--crit)" }} />
              </div>
              <div className="legend" style={{ marginTop: 10, fontSize: 11.5 }}>
                <span><span className="dotmark" style={{ background: "var(--good)" }} />{meta.reconFound} found</span>
                <span><span className="dotmark" style={{ background: "var(--crit)" }} />{meta.reconMissing} missing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, tone, mono }) {
  return (
    <div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 24, fontWeight: 700, color: tone, letterSpacing: "-.02em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 5 }}>{label}</div>
    </div>
  );
}
function MiniMatch({ b, onClick }) {
  const tone = b.matchRate >= 0.85 ? "good" : b.matchRate >= 0.5 ? "warn" : "crit";
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", textAlign: "left", padding: "7px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Build {fmt(b.buildable)} · ingredients hold {fmtK(b.ingCeil)}</div>
      </div>
      <Pill tone={tone}>{Math.round(b.matchRate * 100)}%</Pill>
    </button>
  );
}
function FlagRow({ tone, icon, title, desc, onClick }) {
  const bg = { crit: "var(--crit-tint)", warn: "var(--warn-tint)", cap: "var(--cap-tint)", neutral: "var(--surface-2)" }[tone];
  const fg = { crit: "var(--crit)", warn: "var(--warn)", cap: "var(--cap)", neutral: "var(--muted)" }[tone];
  return (
    <div className="flag-item" onClick={onClick}>
      <div className="flag-ic" style={{ background: bg, color: fg }}>{icon({})}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{desc}</div>
      </div>
      {Ic.arrowR({ style: { width: 16, height: 16, color: "var(--faint)", alignSelf: "center" } })}
    </div>
  );
}

window.VIEWS = { Overview };

/* ===== KPI drilldown drawer (was referenced but undefined → caused blank page on click) ===== */
function KpiDrawer({ kpi, data, go, onClose }) {
  const { meta, flags } = data;
  const byOnHand = [...data.skus].filter(s => s.onHand > 0).sort((a, b) => b.onHand - a.onHand);
  const bySell = [...data.skus].filter(s => s.rev60 > 0).sort((a, b) => b.rev60 - a.rev60);
  const overItems = flags.over.map(s => {
    const daily = s.units60 / 60; const excess = Math.max(0, s.onHand - daily * 365);
    return { ...s, tied: Math.round(excess * 9.5) };
  }).sort((a, b) => b.tied - a.tied);

  const CFG = {
    tai: {
      title: "Total Available Inventory", value: fmtK(meta.totalOnHand) + " units",
      blurb: `${meta.totalSkus} SKUs in the combined 3PL pool. Largest holdings first.`,
      rows: byOnHand.slice(0, 12).map(s => ({ sku: s.sku, name: s.name, right: fmt(s.onHand) + " u", sub: s.units60 ? fmt(s.units60) + " sold/60d" : "no recent sales" })),
      cta: ["View full inventory", () => { onClose(); go("inventory"); }],
    },
    sell: {
      title: "60-day sell-through", value: fmtK(meta.total60Units) + " units · " + usdK(meta.total60Rev),
      blurb: "Top sellers by net revenue in the trailing 60 days.",
      rows: bySell.slice(0, 12).map(s => ({ sku: s.sku, name: s.name, right: usdK(s.rev60), sub: fmt(s.units60) + " units" })),
      cta: ["Open inventory", () => { onClose(); go("inventory"); }],
    },
    flags: {
      title: "Critical supply flags", value: fmt(flags.stockout.length + flags.critical.length) + " SKUs",
      blurb: `${flags.stockout.length} selling with zero stock · ${flags.critical.length} under 30 days of cover.`,
      rows: [...flags.stockout, ...flags.critical].slice(0, 14).map(s => ({ sku: s.sku, name: s.name, right: s.onHand === 0 ? "Stockout" : fmt(s.doc) + "d", tone: s.onHand === 0 ? "crit" : "warn", sub: s.units60 ? fmt(s.units60) + " sold/60d" : "" })),
      cta: ["Triage in inventory", () => { onClose(); go("inventory", { band: "crit" }); }],
    },
    capital: {
      title: "Capital exposed", value: usdK(data.overCapital + data.strandedCapital),
      blurb: `${usdK(data.overCapital)} in overstock + ${usdK(data.strandedCapital)} stranded on un-packageable ingredients.`,
      rows: overItems.slice(0, 12).map(s => ({ sku: s.sku, name: s.name, right: usdK(s.tied), tone: "cap", sub: (s.doc ? fmt(s.doc) + "d cover" : "") })),
      cta: ["See overstock", () => { onClose(); go("inventory", { band: "over" }); }],
    },
  };
  const c = CFG[kpi]; if (!c) return null;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="slideover">
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Itemized</div>
            <h2 style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 700, letterSpacing: "-.01em" }}>{c.title}</h2>
            <div className="mono" style={{ fontSize: 14, color: "var(--muted)", marginTop: 4 }}>{c.value}</div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{Ic.x({})}</button>
        </div>
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 14px" }}>{c.blurb}</p>
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {c.rows.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nothing to itemize.</div>}
            {c.rows.map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: i < c.rows.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{r.sku}{r.sub ? " · " + r.sub : ""}</div>
                </div>
                {r.tone ? <Pill tone={r.tone}>{r.right}</Pill> : <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{r.right}</span>}
              </div>
            ))}
          </div>
          <button className="btn primary" style={{ marginTop: 16, width: "100%", justifyContent: "center" }} onClick={c.cta[1]}>{c.cta[0]} {Ic.arrowR({})}</button>
        </div>
      </div>
    </>
  );
}
