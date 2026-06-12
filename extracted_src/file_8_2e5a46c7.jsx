/* global React, LIB */
const { fmt:f6, Ic:I6, Pill:P6, useState:uS6, useMemo:uM6 } = LIB;

const clean6 = (s) => (s || "").replace(/\r/g, "").trim();
const termTone6 = (t) => t === "Prepaid" ? "crit" : /Net\s*(\d+)/.test(t) && parseInt(t.match(/\d+/)[0]) >= 30 ? "good" : "neutral";

function ComponentVendors() {
  const data = window.INV_VENDORS || { vendors: [], meta: {} };
  const [q, setQ] = uS6("");
  const [country, setCountry] = uS6("all");
  const [term, setTerm] = uS6("all");

  const countries = uM6(() => { const s = {}; data.vendors.forEach((v) => s[v.country] = (s[v.country] || 0) + 1); return s; }, [data]);
  const prepaid = data.vendors.filter((v) => v.termType === "Prepaid").length;
  const net = data.vendors.length - prepaid;
  const compTotal = data.vendors.reduce((a, v) => a + v.components.length, 0);

  const rows = uM6(() => {
    let r = data.vendors;
    if (country !== "all") r = r.filter((v) => v.country === country);
    if (term === "prepaid") r = r.filter((v) => v.termType === "Prepaid");
    else if (term === "net") r = r.filter((v) => v.termType !== "Prepaid");
    if (q.trim()) { const t = q.toLowerCase(); r = r.filter((v) => v.vendor.toLowerCase().includes(t) || v.componentsRaw.toLowerCase().includes(t) || (v.incoterm || "").toLowerCase().includes(t)); }
    return r;
  }, [data, q, country, term]);

  const kpis = [
    { label: "Component vendors", value: f6(data.vendors.length), sub: `${compTotal} component lines`, edge: "var(--ink)", icon: I6.channels },
    { label: "Countries", value: f6(Object.keys(countries).length), sub: Object.entries(countries).map(([c, n]) => `${c} ${n}`).join(" · "), edge: "var(--cap)", icon: I6.box },
    { label: "Prepaid vendors", value: f6(prepaid), sub: "cash out before shipping", edge: "var(--crit)", icon: I6.scale },
    { label: "Net-terms vendors", value: f6(net), sub: "pay after delivery", edge: "var(--good)", icon: I6.recon },
  ];

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="accent-edge" style={{ background: k.edge }} />
            <div className="label">{k.icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{k.label}</div>
            <div className="value">{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "22px 0 16px", flexWrap: "wrap" }}>
        <div className="search">
          {I6.search({})}
          <input placeholder="Search vendor, component or location…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ("")} style={{ color: "var(--faint)" }}>{I6.x({ style: { width: 14, height: 14 } })}</button>}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <button className={"tag" + (country === "all" ? " on" : "")} onClick={() => setCountry("all")}>All countries</button>
          {Object.keys(countries).map((c) => <button key={c} className={"tag" + (country === c ? " on" : "")} onClick={() => setCountry(c)}>{c}</button>)}
        </div>
        <div className="seg">
          {[["all", "All terms"], ["prepaid", "Prepaid"], ["net", "Net terms"]].map(([id, l]) => <button key={id} className={term === id ? "on" : ""} onClick={() => setTerm(id)}>{l}</button>)}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }} className="tnum">{f6(rows.length)} of {f6(data.vendors.length)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {rows.map((v) => <CompVendorCard key={v.vendor} v={v} />)}
        {rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", gridColumn: "1/-1" }}>No vendors match these filters.</div>}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>Source: Active Components Supplier list. {data.meta.note}</div>
    </div>
  );
}

function CompVendorCard({ v }) {
  const tone = termTone6(v.termType);
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
            {v.country === "China" && <span className="pill" style={{ background: "#fbeee6", color: "#9a5418", fontSize: 9.5, padding: "0 6px" }}>CN</span>}
            {v.country === "US" && <span className="pill" style={{ background: "var(--cap-tint)", color: "var(--cap)", fontSize: 9.5, padding: "0 6px" }}>US</span>}
            {I6.box({ style: { width: 12, height: 12, color: "var(--faint)" } })} {v.incoterm}
          </div>
        </div>
        <P6 tone={tone}>{v.termType}</P6>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Components supplied</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {v.components.map((c, i) => <span key={i} style={{ fontSize: 11.5, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>{clean6(c)}</span>)}
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 9, fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 7, alignItems: "flex-start" }}>
        {I6.scale({ style: { width: 13, height: 13, color: "var(--faint)", flex: "none", marginTop: 1 } })}
        <span>{clean6(v.paymentTerm)}</span>
      </div>
    </div>
  );
}

window.VIEWS6 = { ComponentVendors };
