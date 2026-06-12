/* global React, LIB */
const { fmt:f5, fmtK:fk5, usd:usd5, usdK:uk5, fmtDate:fd5, Ic:I5, Pill:P5, useState:uS5, useMemo:uM5, useEffect:uE5,
  proddevProducts:PDP5, computeDevProduct:CDP5, saveDevStore:SAVE5, PRODDEV_STAGES:STAGES5, GATE_TONE:GT5, GATE_LABEL:GL5 } = LIB;
const BRIEF5 = window.LIB_BRIEF;

const STAGE_COLOR = { "Concept": "#8a8580", "Formulation": "#3f51b5", "Stability": "#0d7d8a", "Compliance": "#b46a09", "Pre-production": "#8a2d5a", "Production": "#2f7d52" };
const DevDetail = (props) => window.VIEWS5B.DevDetail(props);

function persistProducts(products) {
  const seedIds = new Set((window.INV_PRODDEV.products || []).map((p) => p.id));
  const created = products.filter((p) => !seedIds.has(p.id));
  const over = {};
  products.filter((p) => seedIds.has(p.id)).forEach((p) => { over[p.id] = p; });
  SAVE5({ created, over });
}

function ProductDevelopment() {
  const [products, setProducts] = uS5(() => PDP5());
  const [selId, setSelId] = uS5(null);
  const [creating, setCreating] = uS5(false);
  const [briefing, setBriefing] = uS5(false);
  const stages = STAGES5();

  const update = (next) => { setProducts(next); persistProducts(next); };
  const updateOne = (id, patch) => update(products.map((p) => p.id === id ? { ...p, ...patch } : p));

  const sel = products.find((p) => p.id === selId);
  if (sel) return <DevDetail p={sel} stages={stages} onBack={() => setSelId(null)} onChange={(patch) => updateOne(sel.id, patch)} />;

  return (
    <div className="fade-in">
      <DevSummary products={products} />
      <div className="section-title" style={{ marginTop: 24 }}>
        <h2>Development pipeline</h2><div className="line" />
        <button className="btn" onClick={() => setBriefing(true)}>{I5.flask({})} Build from brief</button>
        <button className="btn primary" onClick={() => setCreating(true)}>{I5.plus({})} New SKU</button>
      </div>
      <div className="pd-board">
        {stages.map((st) => {
          const items = products.filter((p) => p.stage === st);
          return (
            <div className="pd-col" key={st}>
              <div className="pd-col-head">
                <span className="dotmark" style={{ background: STAGE_COLOR[st] }} />
                <span>{st}</span>
                <span className="pd-count">{items.length}</span>
              </div>
              <div className="pd-col-body">
                {items.map((p) => <DevCard key={p.id} p={p} onClick={() => setSelId(p.id)} />)}
                {items.length === 0 && <div className="pd-empty">—</div>}
              </div>
            </div>
          );
        })}
      </div>
      {creating && <NewSkuModal stages={stages} onClose={() => setCreating(false)} onCreate={(np) => { const next = [np, ...products]; update(next); setCreating(false); setSelId(np.id); }} />}
      {briefing && <BriefWizard onClose={() => setBriefing(false)} onCreate={(np) => { const next = [np, ...products]; update(next); setBriefing(false); setSelId(np.id); }} />}
    </div>
  );
}

function DevSummary({ products }) {
  const active = products.filter((p) => p.stage !== "Production");
  const readyToPush = products.filter((p) => CDP5(p).canPush).length;
  const blocked = products.filter((p) => { const c = CDP5(p); return p.stage !== "Production" && !c.canPush; }).length;
  const avgCogs = products.length ? products.reduce((a, p) => a + CDP5(p).cogs, 0) / products.length : 0;
  const kpis = [
    { label: "Products in development", value: f5(active.length), sub: `${products.length} total records`, edge: "var(--ink)", icon: I5.flask },
    { label: "Ready to push", value: f5(readyToPush), sub: "all production gates green", edge: "var(--good)", icon: I5.rocket },
    { label: "Blocked on a gate", value: f5(blocked), sub: "stability / test / artwork / IFRA", edge: "var(--warn)", icon: I5.alert },
    { label: "Avg formula COGS", value: "$" + avgCogs.toFixed(2), sub: "1.4×ingredient + 1.6×labor", edge: "var(--cap)", icon: I5.scale },
  ];
  return (
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
  );
}

function DevCard({ p, onClick }) {
  const c = CDP5(p);
  return (
    <button className="pd-card" onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)" }}>{p.devCode}</span>
        {c.canPush ? <P5 tone="good">{I5.rocket({ style: { width: 10, height: 10 } })}Ready</P5> : <span className="mono" style={{ fontSize: 10, color: "var(--faint)" }}>{Math.round(c.readyPct * 100)}%</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, margin: "6px 0 4px", lineHeight: 1.25 }}>{p.name}</div>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.category} · {p.owner}</div>
      <div style={{ display: "flex", gap: 3, marginTop: 9 }}>
        {c.gates.map((g) => <span key={g.id} title={g.label + ": " + GL5[g.status]} style={{ flex: 1, height: 4, borderRadius: 2, background: { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[GT5[g.status]] }} />)}
      </div>
    </button>
  );
}

function NewSkuModal({ stages, onClose, onCreate }) {
  const [name, setName] = uS5("");
  const [category, setCategory] = uS5("Face serum");
  const [code, setCode] = uS5("");
  const [fill, setFill] = uS5(30);
  const [owner, setOwner] = uS5("Nicky Lei");
  const cats = ["Face serum", "Moisturizer", "Cleanser", "Eye cream", "Body care", "Hair care", "Cosmetics"];
  const create = () => {
    if (!name.trim()) return;
    const id = "DEV-" + Date.now().toString(36).toUpperCase();
    onCreate({
      id, devCode: code.trim() || id, name: name.trim(), category, stage: "Concept", owner,
      started: new Date().toISOString().slice(0, 10), targetLaunch: null, applicationCategory: "Leave-on face (IFRA Cat 4)",
      fillWeight: parseFloat(fill) || 30, overfill: 2, batchSize: 20,
      physical: { pH: { val: null, min: 4.5, max: 5.5 }, viscosity: { val: null, min: 2000, max: 3500, unit: "cP" }, density: null, appearance: "", odor: "" },
      formula: [
        { n: 1, trade: "Aloe Vera Juice (organic)", inci: "Organic Aloe Barbadensis Leaf Juice", wt: 70, costKg: 0.51, phase: "Water", allergens: [] },
        { n: 2, trade: "Glycerin (vegetable)", inci: "Glycerin (Vegetable)", wt: 5, costKg: 3.20, phase: "Water", allergens: [] },
        { n: 3, trade: "BenzylAlcohol-DHA", inci: "Dehydroacetic Acid, Benzyl Alcohol, Aqua", wt: 0.8, costKg: 19.55, phase: "Cool-down", allergens: ["Benzyl Alcohol"] },
        { n: 4, trade: "Aqua (q.s.)", inci: "Aqua (Water)", wt: 24.2, costKg: 0.02, phase: "Water", allergens: [] },
      ],
      stability: { conditions: ["25°C / 60% RH", "40°C / 75% RH", "Freeze-thaw ×3", "Photostability"].map((name) => ({ name, points: { T0: "pending", "1M": "pending", "3M": "pending", "6M": "pending", "12M": "pending", "24M": "pending" } })), note: "New SKU — not yet submitted for stability." },
      challenge: { standard: "ISO 11930:2019", category: "Category 2", preservative: "BenzylAlcohol-DHA @ 0.80%", lab: "—", report: "—", date: null, status: "not-started", organisms: [] },
      claims: { validated: [], pending: [] },
      allergenCheck: [{ name: "Benzyl Alcohol", useLevel: 0.80, limit: null, pctOfLimit: null, status: "review", note: "Preservative" }],
      artwork: { status: "not-started", note: "New SKU." },
      timeline: [{ version: "V0", date: new Date().toISOString().slice(0, 7), by: owner, note: "Concept created." }],
    });
  };
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="pd-modal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>New SKU</h2>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I5.x({})}</button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>Start a development record at the Concept stage. You can edit the formula and advance it through the pipeline.</p>
        <Field label="Product name"><input className="pd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Niacinamide Pore Serum" autoFocus /></Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category"><select className="pd-input" value={category} onChange={(e) => setCategory(e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Dev code (optional)"><input className="pd-input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="auto" /></Field>
          <Field label="Fill weight (g)"><input className="pd-input" type="number" value={fill} onChange={(e) => setFill(e.target.value)} /></Field>
          <Field label="Owner"><input className="pd-input" value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={create} disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : .5 }}>{I5.plus({})} Create SKU</button>
        </div>
      </div>
    </>
  );
}
function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 12 }}><span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 5 }}>{label}</span>{children}</label>;
}

/* ===== Build-from-brief wizard (for non-formulators) ===== */
function BriefWizard({ onClose, onCreate }) {
  const B = window.INV_BRIEF;
  const [name, setName] = uS5("");
  const [category, setCategory] = uS5(B.categories[0]);
  const [vehicle, setVehicle] = uS5("light-cream");
  const [color, setColor] = uS5(B.colors[0]);
  const [absorption, setAbsorption] = uS5(B.absorption[0]);
  const [fragrance, setFragrance] = uS5("none");
  const [cosmos, setCosmos] = uS5(false);
  const [actives, setActives] = uS5([]);
  const [customActives, setCustomActives] = uS5([]);
  const [cName, setCName] = uS5("");
  const [cInci, setCInci] = uS5("");
  const [cWt, setCWt] = uS5(2);
  const [owner, setOwner] = uS5("Marketing");
  const [benchName, setBenchName] = uS5("");
  const [benchBrand, setBenchBrand] = uS5("");
  const [benchPrice, setBenchPrice] = uS5("");

  const toggleActive = (id) => setActives((a) => a.includes(id) ? a.filter((x) => x !== id) : (a.length < 4 ? [...a, id] : a));
  const addCustom = () => { if (!cName.trim()) return; setCustomActives((c) => [...c, { label: cName.trim(), inci: cInci.trim() || cName.trim(), wt: +cWt || 2 }]); setCName(""); setCInci(""); setCWt(2); };
  const removeCustom = (i) => setCustomActives((c) => c.filter((_, idx) => idx !== i));
  const preview = uM5(() => BRIEF5.briefToProduct({ vehicle, color, absorption, fragrance, category, cosmos, actives, customActives, claims: [] }), [vehicle, fragrance, category, cosmos, actives, customActives, color, absorption]);
  const wtTotal = preview.formula.reduce((a, r) => a + (r.wt || 0), 0);

  const create = () => {
    if (!name.trim()) return;
    const id = "DEV-" + Date.now().toString(36).toUpperCase();
    const p = BRIEF5.briefToProduct({ vehicle, color, absorption, fragrance, category, cosmos, actives, customActives, claims: [] });
    const benchmark = benchName.trim() ? { name: benchName.trim(), brand: benchBrand.trim() || null, retail: benchPrice ? +benchPrice : null } : null;
    onCreate({
      id, devCode: id, name: name.trim(), category, stage: "Concept", owner,
      started: new Date().toISOString().slice(0, 10), targetLaunch: null, applicationCategory: p.applicationCategory,
      fillWeight: p.fill, overfill: 3, batchSize: 20,
      physical: { pH: { val: null, min: 4.5, max: 5.5 }, viscosity: { val: null, min: 2000, max: 3500, unit: "cP" }, density: null, appearance: color, odor: p.brief.fragrance },
      formula: p.formula,
      brief: { ...p.brief, benchmark },
      stability: { conditions: ["25°C / 60% RH", "40°C / 75% RH", "Freeze-thaw ×3", "Photostability"].map((nm) => ({ name: nm, points: { T0: "pending", "1M": "pending", "3M": "pending", "6M": "pending", "12M": "pending", "24M": "pending" } })), note: "Generated from brief — not yet submitted for stability." },
      challenge: { standard: "ISO 11930:2019", category: "Category 2", preservative: "BenzylAlcohol-DHA @ 0.80%", lab: "—", report: "—", date: null, status: "not-started", organisms: [] },
      claims: p.claims, allergenCheck: p.allergenCheck,
      artwork: { status: "not-started", note: "From brief." },
      cosmos,
      timeline: [{ version: "V0", date: new Date().toISOString().slice(0, 7), by: owner, note: "Created from product brief: " + p.vehicleLabel + (actives.length ? " · actives: " + p.brief.actives.join(", ") : "") + (benchmark ? " · benchmarked to " + benchmark.name + (benchmark.brand ? " (" + benchmark.brand + ")" : "") : "") }],
    });
  };

  const sel = (val, set, opts, keyLabel) => (
    <select className="pd-input" value={val} onChange={(e) => set(e.target.value)}>
      {opts.map((o) => keyLabel ? <option key={o.id} value={o.id}>{o.label}</option> : <option key={o}>{o}</option>)}
    </select>
  );

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="pd-modal" style={{ width: "min(840px,96vw)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Build from brief</h2>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I5.x({})}</button>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--muted)", margin: "0 0 16px" }}>Describe the product you want — no formulation experience needed. We translate it into a starter formula a chemist can refine into an MVP.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 }}>
          {/* left: the brief */}
          <div>
            <Field label="Product name"><input className="pd-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Glow Drops Brightening Serum" autoFocus /></Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Category">{sel(category, setCategory, B.categories)}</Field>
              <Field label="Owner"><input className="pd-input" value={owner} onChange={(e) => setOwner(e.target.value)} /></Field>
            </div>
            <Field label="Texture / vehicle">{sel(vehicle, setVehicle, B.vehicles, true)}</Field>
            <div style={{ fontSize: 11, color: "var(--faint)", margin: "-8px 0 12px" }}>{(B.vehicles.find((v) => v.id === vehicle) || {}).desc}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Color / appearance">{sel(color, setColor, B.colors)}</Field>
              <Field label="Absorption / feel">{sel(absorption, setAbsorption, B.absorption)}</Field>
            </div>
            <Field label="Fragrance">{sel(fragrance, setFragrance, B.fragrances, true)}</Field>
            <Field label="Targeted actives (pick up to 4)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {B.actives.map((a) => (
                  <button key={a.id} type="button" className={"tag" + (actives.includes(a.id) ? " on" : "")} onClick={() => toggleActive(a.id)} style={{ fontSize: 11.5 }}>{a.label}</button>
                ))}
              </div>
            </Field>
            <Field label="Custom active (not in library)">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input className="pd-input" style={{ flex: "2 1 130px" }} value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Active name" />
                <input className="pd-input" style={{ flex: "2 1 130px" }} value={cInci} onChange={(e) => setCInci(e.target.value)} placeholder="INCI (optional)" />
                <input className="pd-input" style={{ flex: "0 1 70px" }} type="number" step="0.1" value={cWt} onChange={(e) => setCWt(e.target.value)} placeholder="wt%" />
                <button type="button" className="btn" onClick={addCustom} disabled={!cName.trim()} style={{ opacity: cName.trim() ? 1 : .5 }}>{I5.plus({ style: { width: 14, height: 14 } })}</button>
              </div>
              {customActives.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {customActives.map((c, i) => (
                    <span key={i} className="pill" style={{ background: "var(--accent-tint)", color: "var(--accent)", fontSize: 11 }}>{c.label} {c.wt}% <button onClick={() => removeCustom(i)} style={{ marginLeft: 4, color: "var(--accent)", fontWeight: 700 }}>×</button></span>
                  ))}
                </div>
              )}
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={cosmos} onChange={(e) => setCosmos(e.target.checked)} />
              COSMOS / clean-beauty approved (restrict to compliant inputs)
            </label>
            <Field label="Benchmark — a product we want to be similar to">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <input className="pd-input" style={{ flex: "2 1 150px" }} value={benchName} onChange={(e) => setBenchName(e.target.value)} placeholder="Reference product (e.g. C-Firma Serum)" />
                <input className="pd-input" style={{ flex: "1 1 110px" }} value={benchBrand} onChange={(e) => setBenchBrand(e.target.value)} placeholder="Brand" />
                <input className="pd-input" style={{ flex: "0 1 90px" }} type="number" value={benchPrice} onChange={(e) => setBenchPrice(e.target.value)} placeholder="Retail $" />
              </div>
            </Field>
          </div>

          {/* right: live MVP preview */}
          <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Suggested MVP formula</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>{preview.vehicleLabel} · {preview.fill}g fill · {preview.applicationCategory}</div>
            <div style={{ maxHeight: 230, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)" }}>
              <table className="data" style={{ fontSize: 12 }}>
                <thead><tr><th>Ingredient (INCI)</th><th className="num">wt%</th><th>Phase</th></tr></thead>
                <tbody>
                  {preview.formula.map((r, i) => (
                    <tr key={i}><td style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.inci}{r.allergens && r.allergens.length ? " ⚠" : ""}</td><td className="num">{(+r.wt).toFixed(2)}</td><td style={{ color: "var(--muted)" }}>{r.phase}</td></tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ fontWeight: 700, background: "var(--surface-2)" }}><td>Total</td><td className="num" style={{ color: Math.abs(wtTotal - 100) < 0.5 ? "var(--good)" : "var(--warn)" }}>{wtTotal.toFixed(1)}%</td><td></td></tr></tfoot>
              </table>
            </div>
            {preview.brief.targetClaims.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>Implied claims</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{preview.brief.targetClaims.map((c) => <span key={c} className="pill" style={{ background: "var(--good-tint)", color: "var(--good)", fontSize: 10 }}>{c}</span>)}</div>
              </div>
            )}
            <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 10 }}>Starter skeleton from the brief. A formulator refines %, confirms stability &amp; preservation, then advances it through the pipeline.</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18, justifyContent: "flex-end" }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={create} disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : .5 }}>{I5.flask({})} Create MVP draft</button>
        </div>
      </div>
    </>
  );
}

window.VIEWS5 = { ProductDevelopment };
