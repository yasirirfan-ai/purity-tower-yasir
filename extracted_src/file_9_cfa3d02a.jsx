/* global React, LIB */
const { fmt:f7, Ic:I7, Pill:P7, useState:uS7, useMemo:uM7 } = LIB;

const cc7 = (country) => country === "United States" ? "US" : country === "China" ? "CN" : country === "Canada" ? "CA" : (country || "").slice(0, 2).toUpperCase();
const ccTone7 = (country) => country === "China" ? { bg: "#fbeee6", fg: "#9a5418" } : { bg: "var(--cap-tint)", fg: "var(--cap)" };

function IngredientVendors() {
  const data = window.INV_INGVENDORS || { vendors: [], meta: {} };
  const [q, setQ] = uS7("");
  const [country, setCountry] = uS7("all");
  const [term, setTerm] = uS7("all");

  const countries = uM7(() => { const s = {}; data.vendors.forEach((v) => s[v.country] = (s[v.country] || 0) + 1); return Object.entries(s).sort((a, b) => b[1] - a[1]); }, [data]);
  const ingTotal = data.vendors.reduce((a, v) => a + v.count, 0);
  const imported = data.vendors.filter((v) => v.country && v.country !== "United States" && v.country !== "—").length;

  const rows = uM7(() => {
    let r = data.vendors;
    if (country !== "all") r = r.filter((v) => v.country === country);
    if (term === "prepay") r = r.filter((v) => v.termDays === 0);
    else if (term === "net") r = r.filter((v) => v.termDays != null && v.termDays >= 30);
    if (q.trim()) { const t = q.toLowerCase(); r = r.filter((v) => v.vendor.toLowerCase().includes(t) || (v.termLabel || "").toLowerCase().includes(t) || v.ingredients.some((g) => (g.ingredient || "").toLowerCase().includes(t) || (g.inci || "").toLowerCase().includes(t))); }
    return r;
  }, [data, q, country, term]);

  const kpis = [
    { label: "Ingredient vendors", value: f7(data.vendors.length), sub: `${ingTotal} ingredients supplied`, edge: "var(--ink)", icon: I7.flask },
    { label: "Countries", value: f7(countries.length), sub: countries.slice(0, 3).map(([c, n]) => `${cc7(c)} ${n}`).join(" · "), edge: "var(--cap)", icon: I7.box },
    { label: "Domestic vendors", value: f7(data.vendors.filter((v) => v.country === "United States").length), sub: `${data.vendors.filter((v) => v.termDays === 0).length} prepay · ${data.vendors.filter((v) => v.termDays >= 30).length} on terms`, edge: "var(--good)", icon: I7.recon },
    { label: "Imported vendors", value: f7(imported), sub: "freight + HTS · we pay", edge: "var(--warn)", icon: I7.channels },
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
          {I7.search({})}
          <input placeholder="Search vendor, ingredient or INCI…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ("")} style={{ color: "var(--faint)" }}>{I7.x({ style: { width: 14, height: 14 } })}</button>}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          <button className={"tag" + (country === "all" ? " on" : "")} onClick={() => setCountry("all")}>All countries</button>
          {countries.map(([c, n]) => <button key={c} className={"tag" + (country === c ? " on" : "")} onClick={() => setCountry(c)}>{c === "—" ? "Unknown" : c} ({n})</button>)}
        </div>
        <div className="seg">
          {[["all", "All terms"], ["prepay", "Prepay"], ["net", "Net terms"]].map(([id, l]) => <button key={id} className={term === id ? "on" : ""} onClick={() => setTerm(id)}>{l}</button>)}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }} className="tnum">{f7(rows.length)} of {f7(data.vendors.length)}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
        {rows.map((v) => <IngVendorCard key={v.vendor} v={v} />)}
        {rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", gridColumn: "1/-1" }}>No vendors match these filters.</div>}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14 }}>{data.meta.note}</div>
    </div>
  );
}

function IngVendorCard({ v }) {
  const [open, setOpen] = uS7(false);
  const [bol, setBol] = uS7(() => { try { return JSON.parse(localStorage.getItem("babylon_bol_" + v.vendor)) || null; } catch (e) { return null; } });
  const ct = ccTone7(v.country);
  const show = open ? v.ingredients : v.ingredients.slice(0, 8);
  const lead = v.leadMin != null ? (v.leadMin === v.leadMax ? v.leadMin + " wk" : v.leadMin + "–" + v.leadMax + " wk") : null;
  const termTone = v.termDays === 0 ? "crit" : v.termDays >= 60 ? "good" : "neutral";
  const onBol = (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const rec = { name: file.name, size: file.size, uploaded: new Date().toISOString().slice(0, 10) };
    try { localStorage.setItem("babylon_bol_" + v.vendor, JSON.stringify(rec)); } catch (err) {}
    setBol(rec);
  };
  const clearBol = () => { try { localStorage.removeItem("babylon_bol_" + v.vendor); } catch (e) {} setBol(null); };
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 11 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {v.country && v.country !== "—" && <span className="pill" style={{ background: ct.bg, color: ct.fg, fontSize: 9.5, padding: "0 6px" }}>{cc7(v.country)}</span>}
            {v.imported && <span className="pill" style={{ background: "#fbeee6", color: "#9a5418", fontSize: 9.5, padding: "0 6px" }}>Imported</span>}
            {(v.city || v.state) && <span>{[v.city, v.state].filter(Boolean).join(", ")}</span>}
          </div>
        </div>
        {lead && <P7 tone="neutral">{lead} lead</P7>}
      </div>
      {v.termLabel && <div style={{ marginTop: -2 }}><span className="pill" style={{ background: termTone === "crit" ? "var(--crit-tint)" : termTone === "good" ? "var(--good-tint)" : "var(--surface-2)", color: termTone === "crit" ? "var(--crit)" : termTone === "good" ? "var(--good)" : "var(--muted)", fontSize: 10.5, border: "1px solid var(--border)" }}>{I7.scale({ style: { width: 11, height: 11 } })} {v.termLabel}</span></div>}

      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{v.count} ingredient{v.count > 1 ? "s" : ""} supplied</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {show.map((g, i) => <span key={i} title={(g.inci || "") + (g.pricePerKg ? " · $" + g.pricePerKg + "/kg" : "") + (g.hts ? " · HTS " + g.hts.code : "")} style={{ fontSize: 11.5, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px" }}>{g.ingredient}{g.allergen ? " ⚠" : ""}</span>)}
          {v.ingredients.length > 8 && <button className="tag" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => setOpen(!open)}>{open ? "Show less" : "+" + (v.ingredients.length - 8) + " more"}</button>}
        </div>
      </div>

      {/* freight (we pay) */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--muted)" }}>
        {I7.scale({ style: { width: 13, height: 13, color: "var(--faint)", flex: "none" } })}
        <span>Freight <strong style={{ color: "var(--ink)" }}>${v.freightPerKg.toFixed(2)}/kg</strong> <span style={{ color: "var(--faint)" }}>({v.imported ? (v.country === "Canada" ? "cross-border" : "ocean import") : "domestic"} · we pay)</span></span>
      </div>

      {/* HTS for imported */}
      {v.imported && v.htsCodes.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Freight HTS codes (import)</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {v.htsCodes.map((h, i) => <span key={i} className="mono" title={h.desc + " · duty " + h.duty + "%"} style={{ fontSize: 10.5, background: "var(--cap-tint)", color: "var(--cap)", borderRadius: 6, padding: "2px 7px" }}>{h.code}{h.duty ? " · " + h.duty + "%" : ""}</span>)}
          </div>
        </div>
      )}

      {/* BOL upload */}
      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Bill of Lading</div>
        {bol ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, background: "var(--good-tint)", color: "var(--good)", display: "grid", placeItems: "center", flex: "none" }}>{I7.check({ style: { width: 12, height: 12 } })}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bol.name} <span style={{ color: "var(--faint)" }}>· {bol.uploaded}</span></span>
            <button className="tag" style={{ fontSize: 10.5, padding: "2px 8px" }} onClick={clearBol}>Remove</button>
          </div>
        ) : (
          <label className="tag" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {I7.plus({ style: { width: 13, height: 13 } })} Upload BOL
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" style={{ display: "none" }} onChange={onBol} />
          </label>
        )}
      </div>

      {(v.contactPerson || v.email || v.website) && (
        <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 9, fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 7, alignItems: "flex-start" }}>
          {I7.channels({ style: { width: 13, height: 13, color: "var(--faint)", flex: "none", marginTop: 1 } })}
          <span>{[v.contactPerson, v.email, v.website].filter(Boolean).join(" · ")}</span>
        </div>
      )}
    </div>
  );
}

window.VIEWS7 = { IngredientVendors };
