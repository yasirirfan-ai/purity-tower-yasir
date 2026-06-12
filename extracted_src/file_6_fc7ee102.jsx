/* global React, LIB */
const { fmt:f5b, fmtK:fk5b, usd:usd5b, usdK:uk5b, fmtDate:fd5b, Ic:I5b, Pill:P5b, useState:uS5b, useMemo:uM5b,
  computeDevProduct:CDP5b, PRODDEV_STAGES:STG5b, GATE_TONE:GT5b, GATE_LABEL:GL5b } = LIB;

const PHASE_COLOR = { "Water": "#3f51b5", "Oil": "#b46a09", "Cool-down": "#0d7d8a", "Actives": "#8a2d5a", "pH": "#8a8580" };
const SC5 = { "Concept": "#8a8580", "Formulation": "#3f51b5", "Stability": "#0d7d8a", "Compliance": "#b46a09", "Pre-production": "#8a2d5a", "Production": "#2f7d52" };

function DevDetail({ p, stages, onBack, onChange }) {
  const c = uM5b(() => CDP5b(p), [p]);
  const [tab, setTab] = uS5b("formula");

  const setStage = (stage) => {
    const tl = (p.timeline || []).slice();
    onChange({ stage, timeline: tl });
  };
  const editWt = (idx, val) => {
    const formula = p.formula.map((r, i) => i === idx ? { ...r, wt: val === "" ? 0 : parseFloat(val) } : r);
    onChange({ formula });
  };
  const editField = (idx, key, val, numeric) => {
    const formula = p.formula.map((r, i) => i === idx ? { ...r, [key]: numeric ? (val === "" ? 0 : parseFloat(val)) : val } : r);
    onChange({ formula });
  };
  const pushToProduction = () => {
    const stamp = new Date().toISOString().slice(0, 7);
    const tl = [...(p.timeline || []), { version: "→ Production", date: stamp, by: "Pushed from Product Dev", note: "All production gates green. Promoted to Production." }];
    onChange({ stage: "Production", timeline: tl });
  };

  const TABS = [["formula", "Formula"], ["label", "Label concept"], ["manufacturing", "Manufacturing directions"], ["physical", "Physical"], ["stability", "Stability"], ["challenge", "Challenge test"], ["ifra", "IFRA / allergens"], ["claims", "Claims"], ["timeline", "Version history"]];

  return (
    <div className="fade-in">
      <button className="btn" onClick={onBack} style={{ marginBottom: 16 }}>{I5b.back({})} Pipeline</button>

      {/* header */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ minWidth: 260 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{p.devCode}</span>
              <span className="pill" style={{ background: SC5[p.stage] + "22", color: SC5[p.stage] }}>{p.stage}</span>
            </div>
            <h2 style={{ margin: "7px 0 4px", fontSize: 21, fontWeight: 700, letterSpacing: "-.02em" }}>{p.name}</h2>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{p.category} · {p.owner} · {p.applicationCategory}{p.targetLaunch ? " · launch " + fd5b(p.targetLaunch) : ""}</div>
            {p.brief && p.brief.benchmark && <div style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 4 }}>★ Benchmarked to {p.brief.benchmark.name}{p.brief.benchmark.brand ? " · " + p.brief.benchmark.brand : ""}{p.brief.benchmark.retail ? " · $" + p.brief.benchmark.retail + " retail" : ""}</div>}
          </div>
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>${c.cogs.toFixed(2)}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>COGS / unit</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: Math.abs(c.wtTotal - 100) <= 0.5 ? "var(--good)" : "var(--crit)" }}>{c.wtTotal.toFixed(1)}%</div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>formula total</div>
            </div>
          </div>
        </div>

        {/* stage stepper */}
        <div style={{ display: "flex", gap: 0, padding: "0 20px 16px", flexWrap: "wrap" }}>
          {stages.map((st, i) => {
            const cur = stages.indexOf(p.stage);
            const done = i < cur, active = i === cur;
            return (
              <button key={st} onClick={() => setStage(st)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 0", opacity: done || active ? 1 : .5 }}>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: active ? SC5[st] : done ? "var(--good)" : "var(--surface-2)", border: "1.5px solid " + (active ? SC5[st] : done ? "var(--good)" : "var(--border)"), color: "#fff", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{done ? "✓" : i + 1}</span>
                <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? "var(--ink)" : "var(--muted)" }}>{st}</span>
                {i < stages.length - 1 && <span style={{ width: 16, height: 1, background: "var(--border)", marginLeft: 4 }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* production gate */}
      <div className="card" style={{ marginBottom: 18, background: c.canPush ? "var(--good-tint)" : "var(--surface-2)" }}>
        <div className="card-pad">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">Production readiness</div>
              <div style={{ fontSize: 13.5, color: "var(--ink)", marginTop: 4 }}>{c.canPush ? "All critical gates are green — ready to push to production." : p.stage === "Production" ? "This SKU is in production." : "Blocked — clear the red gates below before pushing."}</div>
            </div>
            <button className="btn primary" onClick={pushToProduction} disabled={!c.canPush} style={{ opacity: c.canPush ? 1 : .45, cursor: c.canPush ? "pointer" : "not-allowed" }}>{I5b.rocket({})} Push to production</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 14 }}>
            {c.gates.map((g) => {
              const tone = GT5b[g.status];
              const col = { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[tone];
              const ic = g.status === "ok" ? I5b.check : (g.status === "pending" || g.status === "watch") ? I5b.clock : I5b.x;
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 9 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 6, background: { good: "var(--good-tint)", warn: "var(--warn-tint)", crit: "var(--crit-tint)" }[tone], color: col, display: "grid", placeItems: "center", flex: "none" }}>{ic({ style: { width: 12, height: 12 } })}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</div>
                    <div style={{ fontSize: 10, color: col, fontWeight: 600 }}>{GL5b[g.status]}{g.detail ? " · " + g.detail : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="seg" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map(([id, l]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{l}</button>)}
      </div>

      {tab === "formula" && <FormulaTab p={p} c={c} editWt={editWt} editField={editField} />}
      {tab === "label" && <LabelTab p={p} />}
      {tab === "manufacturing" && <ManufacturingTab p={p} onChange={onChange} />}
      {tab === "physical" && <PhysicalTab p={p} />}
      {tab === "stability" && <StabilityTab p={p} />}
      {tab === "challenge" && <ChallengeTab p={p} />}
      {tab === "ifra" && <IfraTab p={p} />}
      {tab === "claims" && <ClaimsTab p={p} />}
      {tab === "timeline" && <TimelineTab p={p} />}
    </div>
  );
}

function LabelTab({ p }) {
  const [art, setArt] = uS5b(() => { try { return localStorage.getItem("babylon_label_" + p.id) || null; } catch (e) { return null; } });
  const brief = p.brief || {};
  const claims = (brief.targetClaims || (p.claims && [...(p.claims.validated || []), ...(p.claims.pending || [])]) || []).slice(0, 6);
  const actives = brief.actives || [];
  const inci = (p.formula || []).map((r) => r.inci).filter(Boolean).join(", ");
  const onArt = (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { const d = rd.result; try { localStorage.setItem("babylon_label_" + p.id, d); } catch (er) {} setArt(d); };
    rd.readAsDataURL(f);
  };
  const clearArt = () => { try { localStorage.removeItem("babylon_label_" + p.id); } catch (e) {} setArt(null); };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
      {/* mock label */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Concept label (front of pack)</div>
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", overflow: "hidden", boxShadow: "var(--sh-pop)", background: "#fff" }}>
          <div style={{ height: 150, position: "relative", background: art ? "#000" : "linear-gradient(150deg,#f3ece6,#e7dccf)", display: "grid", placeItems: "center" }}>
            {art ? <img src={art} alt="concept" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 11, color: "var(--faint)", letterSpacing: ".1em", textTransform: "uppercase" }}>Concept imagery</span>}
            {p.cosmos && <span className="pill" style={{ position: "absolute", top: 10, right: 10, background: "var(--good)", color: "#fff", fontSize: 9.5 }}>COSMOS</span>}
          </div>
          <div style={{ padding: "18px 18px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", color: "#8a2d5a", fontWeight: 700 }}>100% PURE</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", margin: "8px 0 4px", lineHeight: 1.15 }}>{p.name}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", fontStyle: "italic" }}>{brief.category || p.category}{brief.vehicle ? " · " + brief.vehicle : ""}</div>
            {actives.length > 0 && (
              <div style={{ margin: "13px 0", paddingTop: 12, borderTop: "1px solid var(--hairline)", fontSize: 11.5, color: "var(--ink)" }}>
                <div style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>Powered by</div>
                {actives.slice(0, 4).join(" · ")}
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "center", marginTop: 10 }}>
              {claims.map((c) => <span key={c} style={{ fontSize: 9, border: "1px solid #d8c4d0", color: "#8a2d5a", borderRadius: 999, padding: "2px 8px" }}>{c}</span>)}
            </div>
            <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 14 }}>{p.fillWeight}g / {(p.fillWeight / 29.57).toFixed(1)} fl oz</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <label className="btn" style={{ cursor: "pointer", flex: 1, justifyContent: "center" }}>
            {I5b.plus({ style: { width: 14, height: 14 } })} {art ? "Replace art" : "Upload concept art"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={onArt} />
          </label>
          {art && <button className="btn" onClick={clearArt}>Remove</button>}
        </div>
      </div>

      {/* back-of-pack / regulatory copy */}
      <div className="card"><div className="card-pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Back-of-pack copy (draft)</div>
        <LabelBlock title="Product">{p.name} — {brief.vehicle || p.category}{brief.absorption ? ", " + brief.absorption.toLowerCase() + " finish" : ""}{brief.color ? ", " + brief.color.toLowerCase() : ""}.</LabelBlock>
        {claims.length > 0 && <LabelBlock title="Claims">{claims.join(" · ")}</LabelBlock>}
        <LabelBlock title="Ingredients (INCI)">{inci || "—"}</LabelBlock>
        <LabelBlock title="Net weight">{p.fillWeight} g ℮ / {(p.fillWeight / 29.57).toFixed(1)} fl oz</LabelBlock>
        <LabelBlock title="Made for">100% PURE · manufactured by Babylon LLC, San Jose CA</LabelBlock>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>Mock concept for creative review — not final regulated artwork. INCI auto-built from the formula; verify ordering &amp; allergen declarations before print.</div>
      </div></div>
    </div>
  );
}
function LabelBlock({ title, children }) {
  return (
    <div style={{ padding: "9px 0", borderBottom: "1px solid var(--hairline)" }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

function FormulaTab({ p, c, editWt, editField }) {
  const landedKg = (r) => (r.costKg || 0) + (r.freightKg || 0);
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head"><h3>Formula table</h3><span className="hint">{p.formula.length} ingredients · {p.fillWeight}g fill · {p.overfill}% overfill · batch {p.batchSize}kg · fields are editable</span></div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>#</th><th>Trade name</th><th>INCI</th><th className="num">wt%</th><th>Vendor</th><th className="num">Lead (wk)</th><th className="num">$/kg</th><th className="num">Freight $/kg</th><th className="num">Landed $/kg</th><th className="num">$/unit</th><th>Phase</th></tr></thead>
          <tbody>
            {p.formula.map((r, i) => {
              const unit = (r.wt / 100) * landedKg(r) * (p.fillWeight / 1000);
              return (
                <tr key={i}>
                  <td className="num" style={{ color: "var(--faint)" }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{r.trade}</td>
                  <td style={{ color: "var(--muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.inci}</td>
                  <td className="num"><input className="pd-wt" type="number" step="0.05" value={r.wt} onChange={(e) => editWt(i, e.target.value)} /></td>
                  <td><input className="pd-wt" style={{ width: 120, textAlign: "left", fontFamily: "var(--sans)" }} value={r.vendor || ""} placeholder="—" onChange={(e) => editField(i, "vendor", e.target.value, false)} /></td>
                  <td className="num"><input className="pd-wt" style={{ width: 48 }} type="number" step="0.5" value={r.leadWeeks != null ? r.leadWeeks : ""} placeholder="—" onChange={(e) => editField(i, "leadWeeks", e.target.value, true)} /></td>
                  <td className="num"><input className="pd-wt" type="number" step="0.1" value={r.costKg} onChange={(e) => editField(i, "costKg", e.target.value, true)} /></td>
                  <td className="num"><input className="pd-wt" type="number" step="0.05" value={r.freightKg != null ? r.freightKg : ""} placeholder="0" onChange={(e) => editField(i, "freightKg", e.target.value, true)} /></td>
                  <td className="num" style={{ fontWeight: 600 }}>${landedKg(r).toFixed(2)}</td>
                  <td className="num">${unit.toFixed(3)}</td>
                  <td><span className="pill" style={{ background: (PHASE_COLOR[r.phase] || "#888") + "1e", color: PHASE_COLOR[r.phase] || "#888" }}>{r.phase}</span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, background: "var(--surface-2)" }}>
              <td></td><td>Total</td><td></td>
              <td className="num" style={{ color: Math.abs(c.wtTotal - 100) <= 0.5 ? "var(--good)" : "var(--crit)" }}>{c.wtTotal.toFixed(2)}%</td>
              <td colSpan="5"></td><td className="num">${c.ingCostUnit.toFixed(3)}</td><td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="card-pad" style={{ display: "flex", gap: 24, flexWrap: "wrap", borderTop: "1px solid var(--hairline)" }}>
        <CostBit label="Ingredient cost" value={"$" + c.ingCostUnit.toFixed(3)} sub="per unit (landed)" />
        <CostBit label="Labor" value={"$" + c.labor.toFixed(2)} sub="per unit (model)" />
        <CostBit label="COGS / unit" value={"$" + c.cogs.toFixed(2)} sub="1.4×ingredient + 1.6×labor" big />
        {Math.abs(c.wtTotal - 100) > 0.5 && <div style={{ alignSelf: "center", color: "var(--crit)", fontSize: 12.5, fontWeight: 600 }}>⚠ Formula must total 100% (currently {c.wtTotal.toFixed(2)}%)</div>}
      </div>
    </div>
  );
}
function ManufacturingTab({ p, onChange }) {
  const steps = p.mfgDirections || [];
  const setSteps = (next) => onChange({ mfgDirections: next });
  const edit = (i, val) => setSteps(steps.map((s, idx) => idx === i ? { ...s, text: val } : s));
  const editPhase = (i, val) => setSteps(steps.map((s, idx) => idx === i ? { ...s, phase: val } : s));
  const add = () => setSteps([...steps, { phase: "Water", text: "" }]);
  const del = (i) => setSteps(steps.filter((_, idx) => idx !== i));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= steps.length) return; const a = steps.slice(); const t = a[i]; a[i] = a[j]; a[j] = t; setSteps(a); };
  const PHASES = ["Water", "Oil", "Cool-down", "Actives", "pH", "QC"];
  return (
    <div className="card">
      <div className="card-head"><h3>Manufacturing directions</h3><span className="hint">batch / compounding instructions · {steps.length} steps</span></div>
      <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {steps.length === 0 && <div style={{ fontSize: 12.5, color: "var(--muted)", padding: "6px 0" }}>No directions yet. Add the first step below.</div>}
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flex: "none", marginTop: 4 }}>{i + 1}</span>
            <select className="pd-input" style={{ width: 110, flex: "none" }} value={s.phase} onChange={(e) => editPhase(i, e.target.value)}>{PHASES.map((ph) => <option key={ph}>{ph}</option>)}</select>
            <textarea className="pd-input" style={{ flex: 1, minHeight: 38, resize: "vertical", fontFamily: "var(--sans)" }} value={s.text} placeholder="Describe this step…" onChange={(e) => edit(i, e.target.value)} />
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "none" }}>
              <button className="tag" style={{ padding: "2px 7px" }} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button className="tag" style={{ padding: "2px 7px" }} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>↓</button>
            </div>
            <button className="tag" style={{ padding: "2px 7px", flex: "none", marginTop: 0 }} onClick={() => del(i)}>{I5b.x ? I5b.x({ style: { width: 12, height: 12 } }) : "✕"}</button>
          </div>
        ))}
        <button className="btn" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={add}>{I5b.plus ? I5b.plus({}) : "+"} Add step</button>
      </div>
      <div className="card-pad" style={{ borderTop: "1px solid var(--hairline)", fontSize: 11, color: "var(--faint)" }}>Directions are saved with the SKU (locally). Group by phase to mirror the compounding order.</div>
    </div>
  );
}
function CostBit({ label, value, sub, big }) {
  return <div><div className="mono" style={{ fontSize: big ? 22 : 17, fontWeight: 700, color: big ? "var(--accent)" : "var(--ink)" }}>{value}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div><div style={{ fontSize: 10, color: "var(--faint)" }}>{sub}</div></div>;
}

function PhysicalTab({ p }) {
  const ph = p.physical || {};
  const specRow = (label, o, unit) => {
    if (!o) return null;
    const inSpec = o.val != null && (o.min == null || o.val >= o.min) && (o.max == null || o.val <= o.max);
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--hairline)" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontWeight: 700 }}>{o.val != null ? o.val + (unit || "") : "—"}</span>
          {(o.min != null || o.max != null) && <span style={{ fontSize: 11, color: "var(--faint)" }}>spec {o.min}–{o.max}{unit || ""}</span>}
          {o.val != null && <P5b tone={inSpec ? "good" : "crit"}>{inSpec ? "In spec" : "Out"}</P5b>}
        </span>
      </div>
    );
  };
  return (
    <div className="card">
      <div className="card-head"><h3>Physical properties</h3><span className="hint">measured vs. spec</span></div>
      <div>
        {specRow("pH", ph.pH, "")}
        {specRow("Viscosity", ph.viscosity, " " + (ph.viscosity && ph.viscosity.unit || ""))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--hairline)" }}><span style={{ fontSize: 12.5, color: "var(--muted)" }}>Density</span><span className="mono" style={{ fontWeight: 700 }}>{ph.density != null ? ph.density + " g/mL" : "—"}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--hairline)", gap: 16 }}><span style={{ fontSize: 12.5, color: "var(--muted)" }}>Appearance</span><span style={{ fontWeight: 500, textAlign: "right" }}>{ph.appearance || "—"}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", gap: 16 }}><span style={{ fontSize: 12.5, color: "var(--muted)" }}>Fragrance / odor</span><span style={{ fontWeight: 500, textAlign: "right" }}>{ph.odor || "—"}</span></div>
      </div>
    </div>
  );
}

function StabilityTab({ p }) {
  const tps = ["T0", "1M", "3M", "6M", "12M", "24M"];
  const conds = (p.stability && p.stability.conditions) || [];
  const cell = (v) => {
    if (v === "pass") return <span style={{ color: "var(--good)", fontWeight: 700 }}>✓</span>;
    if (v === "fail") return <span style={{ color: "var(--crit)", fontWeight: 700 }}>✗</span>;
    return <span style={{ color: "var(--faint)" }}>·</span>;
  };
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head"><h3>Stability matrix</h3><span className="hint">ICH-adjacent conditions · pass / fail per timepoint</span></div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Condition</th>{tps.map((t) => <th key={t} className="num">{t}</th>)}</tr></thead>
          <tbody>
            {conds.map((cd, i) => (
              <tr key={i}><td style={{ fontWeight: 600 }}>{cd.name}</td>{tps.map((t) => <td key={t} className="num">{cell(cd.points[t])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {p.stability && p.stability.note && (
        <div className="card-pad" style={{ borderTop: "1px solid var(--hairline)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 9, background: /fail/i.test(JSON.stringify(conds)) ? "var(--warn-tint)" : "var(--surface-2)" }}>
            {I5b.alert({ style: { width: 15, height: 15, color: "var(--warn)", flex: "none", marginTop: 1 } })}
            <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>{p.stability.note}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChallengeTab({ p }) {
  const ch = p.challenge || {};
  if (ch.status === "not-started" || !ch.organisms || ch.organisms.length === 0) {
    return (
      <div className="card"><div className="card-pad">
        <div className="eyebrow">Challenge (PET) test — {ch.standard || "ISO 11930"}</div>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "8px 0 0" }}>Preservative system: {ch.preservative || "—"}. Status: <strong>{ch.status === "pending" ? "submitted, awaiting results" : "not started"}</strong>{ch.lab && ch.lab !== "—" ? " · " + ch.lab : ""}.</p>
      </div></div>
    );
  }
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head"><h3>Challenge test — {ch.standard}</h3><P5b tone={ch.status === "pass" ? "good" : "warn"}>{ch.status === "pass" ? "PASS" : ch.status}</P5b></div>
      <div className="card-pad" style={{ borderBottom: "1px solid var(--hairline)", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <Meta5 label="Category" value={ch.category} />
        <Meta5 label="Preservative" value={ch.preservative} />
        <Meta5 label="Lab" value={ch.lab} />
        <Meta5 label="Report" value={ch.report} />
        <Meta5 label="Test date" value={ch.date ? fd5b(ch.date) : "—"} />
      </div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Organism</th><th className="num">14-day</th><th className="num">28-day</th><th>Limit</th><th>Result</th></tr></thead>
          <tbody>
            {ch.organisms.map((o, i) => (
              <tr key={i}><td style={{ fontWeight: 500 }}>{o.name}</td><td className="num">{o.r14}</td><td className="num">{o.r28}</td><td style={{ color: "var(--muted)" }}>{o.limit}</td><td><P5b tone="good">{o.result}</P5b></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function Meta5({ label, value }) { return <div><div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div><div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 3 }}>{value || "—"}</div></div>; }

function IfraTab({ p }) {
  const rows = p.allergenCheck || [];
  const tone = { ok: "good", watch: "warn", review: "warn", exceed: "crit" };
  const lab = { ok: "OK", watch: "Watch", review: "Review", exceed: "Exceed" };
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="card-head"><h3>IFRA 51st Amendment / allergen check</h3><span className="hint">{p.applicationCategory}</span></div>
      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Allergen</th><th className="num">Use level</th><th>IFRA limit</th><th className="num">% of limit</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                <td className="num">{a.useLevel}%</td>
                <td style={{ color: "var(--muted)" }}>{a.limit != null ? a.limit + "%" : (a.note || "Not restricted*")}</td>
                <td className="num">{a.pctOfLimit != null ? a.pctOfLimit + "%" : "—"}</td>
                <td><P5b tone={tone[a.status] || "neutral"}>{lab[a.status] || a.status}</P5b></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="5" style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>No fragrance allergens in this formula.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card-pad" style={{ borderTop: "1px solid var(--hairline)", fontSize: 11, color: "var(--faint)" }}>* Limonene, Linalool, Citronellol: no IFRA concentration limit, but must be declared on label if &gt;0.001% (leave-on) or &gt;0.01% (rinse-off) per EU 1223/2009 Annex III.</div>
    </div>
  );
}

function ClaimsTab({ p }) {
  const cl = p.claims || { validated: [], pending: [] };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <div className="card"><div className="card-head"><h3>Validated</h3><P5b tone="good">{cl.validated.length}</P5b></div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cl.validated.map((c, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 12.5 }}><span style={{ color: "var(--good)" }}>{I5b.check({ style: { width: 14, height: 14 } })}</span>{c}</div>)}
          {cl.validated.length === 0 && <span style={{ color: "var(--muted)", fontSize: 12.5 }}>None yet.</span>}
        </div>
      </div>
      <div className="card"><div className="card-head"><h3>Pending</h3><P5b tone="warn">{cl.pending.length}</P5b></div>
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cl.pending.map((c, i) => <div key={i} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 12.5, color: "var(--muted)" }}><span style={{ color: "var(--warn)" }}>{I5b.clock({ style: { width: 14, height: 14 } })}</span>{c}</div>)}
          {cl.pending.length === 0 && <span style={{ color: "var(--muted)", fontSize: 12.5 }}>None.</span>}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ p }) {
  const tl = p.timeline || [];
  return (
    <div className="card"><div className="card-head"><h3>Version history</h3><span className="hint">regulatory change control</span></div>
      <div className="card-pad">
        {tl.map((t, i) => (
          <div key={i} style={{ display: "flex", gap: 14, paddingBottom: i < tl.length - 1 ? 16 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: "var(--accent)", flex: "none", marginTop: 3 }} />
              {i < tl.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--hairline)", marginTop: 3 }} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 9, alignItems: "baseline" }}><strong style={{ fontSize: 13 }}>{t.version}</strong><span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{t.date}</span><span style={{ fontSize: 11, color: "var(--muted)" }}>· {t.by}</span></div>
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.5 }}>{t.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.VIEWS5B = { DevDetail };
