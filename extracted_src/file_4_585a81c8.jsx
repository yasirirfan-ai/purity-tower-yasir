/* global React, LIB */
const { fmt:f3, fmtK:fk3, usd:usd3, usdK:uk3, fmtDate:fd3, daysUntil:du3, COVER:CV3, EXP_SOON:ES3, Ic:I3, Pill:P3, CoverPill:CP3, Bar:B3, useState:uS3, useMemo:uM3, Pager:PG3, pageSlice:PSL3, artworkFor:AW3, proofSummary:PS3, PROOF_STAGE:PST3, reviewsFor:RV3, reviewHealth:RH3, REVIEW_STATUS:RST3, Stars:STARS3, formulaFor:FM3, regulatoryDossier:RD3, DOSSIER_STATUS:DS3, DOSSIER_HEALTH:DH3, ingredientListFor:IL3 } = LIB;

/* ===================================================================== */
/* INVENTORY  — sortable / filterable / drill-down                       */
/* ===================================================================== */
const STATUS_TONE = { ACTIVE: "good", DISCO: "neutral", "NOT STOCKED": "crit", "OLD SAMPLE PACKET": "neutral" };

function Inventory({ data, initial }) {
  const [q, setQ] = uS3("");
  const [limit, setLimit] = uS3(25);
  const [band, setBand] = uS3(initial && initial.band ? initial.band : "all");
  const [sort, setSort] = uS3({ key: "rev60", dir: -1 });
  const [sel, setSel] = uS3(null);

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "stockout", label: "Stockouts" },
    { id: "crit", label: "<30d cover" },
    { id: "warn", label: "30–60d" },
    { id: "over", label: "Overstock" },
    { id: "exp", label: "Expiring" },
    { id: "disco", label: "Discontinued" },
    { id: "revissue", label: "★ Review issues" },
    { id: "reggaps", label: "Regulatory gaps" },
  ];

  const rows = uM3(() => {
    let r = data.skus;
    if (band === "stockout") r = r.filter(s => s.onHand === 0 && s.units60 > 0);
    else if (band === "crit") r = r.filter(s => s.band === "crit");
    else if (band === "warn") r = r.filter(s => s.band === "warn");
    else if (band === "over") r = r.filter(s => s.band === "over" && s.onHand > 0);
    else if (band === "exp") r = r.filter(s => s.expDays != null && s.expDays <= ES3 && s.onHand > 0);
    else if (band === "disco") r = r.filter(s => s.status === "DISCO" && s.onHand > 0);
    else if (band === "revissue") r = r.filter(s => { const rv = RV3(s.sku); if (!rv) return false; const st = RH3(rv).status; return st === "issue" || st === "watch"; });
    else if (band === "reggaps") r = r.filter(s => RD3(s).status === "gaps");
    if (q.trim()) {
      const t = q.toLowerCase();
      r = r.filter(s => s.sku.toLowerCase().includes(t) || (s.name || "").toLowerCase().includes(t));
    }
    const { key, dir } = sort;
    r = [...r].sort((a, b) => {
      let av = a[key], bv = b[key];
      if (key === "doc") { av = av == null ? 1e12 : av; bv = bv == null ? 1e12 : bv; }
      if (key === "earliestExp") { av = a.expDays == null ? 1e9 : a.expDays; bv = b.expDays == null ? 1e9 : b.expDays; }
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return r;
  }, [data, q, band, sort]);

  const setSortKey = (key) => setSort(s => s.key === key ? { key, dir: -s.dir } : { key, dir: key === "name" || key === "sku" ? 1 : -1 });
  const Arrow = ({ k }) => sort.key === k ? <span className="arr">{sort.dir === 1 ? "▲" : "▼"}</span> : <span className="arr">↕</span>;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="search">
          {I3.search({})}
          <input placeholder="Search SKU or product…" value={q} onChange={e => setQ(e.target.value)} />
          {q && <button onClick={() => setQ("")} style={{ color: "var(--faint)" }}>{I3.x({ style: { width: 14, height: 14 } })}</button>}
        </div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {FILTERS.map(ff => <button key={ff.id} className={"tag" + (band === ff.id ? " on" : "")} onClick={() => setBand(ff.id)}>{ff.label}</button>)}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "var(--muted)" }} className="tnum">{f3(rows.length)} of {f3(data.skus.length)} SKUs</span>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th onClick={() => setSortKey("sku")}>SKU <Arrow k="sku" /></th>
                <th onClick={() => setSortKey("name")}>Product <Arrow k="name" /></th>
                <th onClick={() => setSortKey("status")}>Status <Arrow k="status" /></th>
                <th className="num" onClick={() => setSortKey("onHand")}>On hand <Arrow k="onHand" /></th>
                <th className="num" onClick={() => setSortKey("doc")}>Days cover <Arrow k="doc" /></th>
                <th className="num" onClick={() => setSortKey("units60")}>60d units <Arrow k="units60" /></th>
                <th className="num" onClick={() => setSortKey("rev60")}>60d revenue <Arrow k="rev60" /></th>
                <th>Reviews</th>
                <th className="num" onClick={() => setSortKey("earliestExp")}>Expires <Arrow k="earliestExp" /></th>
              </tr>
            </thead>
            <tbody>
              {PSL3(rows, limit).map((s) => (
                <tr className="row" key={s.sku} onClick={() => setSel(s)}>
                  <td className="sku-cell">{s.sku}</td>
                  <td className="name-cell">{s.name}</td>
                  <td><P3 tone={STATUS_TONE[s.status] || "neutral"}>{s.status}</P3></td>
                  <td className="num">{s.onHand === 0 ? <span style={{ color: "var(--crit)" }}>0</span> : f3(s.onHand)}</td>
                  <td className="num"><CP3 doc={s.doc} band={s.band} /></td>
                  <td className="num">{s.units60 ? f3(s.units60) : "—"}</td>
                  <td className="num">{s.rev60 ? usd3(s.rev60) : "—"}</td>
                  <td><ReviewCell sku={s.sku} /></td>
                  <td className="num" style={{ color: s.expDays != null && s.expDays <= ES3 ? "var(--warn)" : "var(--muted)" }}>{fd3(s.earliestExp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PG3 total={rows.length} limit={limit} setLimit={setLimit} />
        {rows.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>No SKUs match these filters.</div>}
      </div>

      {sel && <SkuDrawer s={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

function ReviewCell({ sku }) {
  const rec = RV3(sku);
  if (!rec) return <span style={{ color: "var(--faint)", fontSize: 11.5 }}>—</span>;
  const st = RST3[RH3(rec).status];
  const dot = { crit: "var(--crit)", warn: "var(--warn)", good: "var(--good)", neutral: "#b6b1a9" }[st.tone];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }} title={st.label + " · " + rec.avg + "★ · " + rec.count + " reviews" + (rec.critical ? " · " + rec.critical + " flagged" : "")}>
      <span className="dotmark" style={{ background: dot }} />
      <STARS3 value={rec.avg} size={11} />
      <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{rec.avg.toFixed(1)}</span>
      {rec.critical > 0 && <span className="mono" style={{ fontSize: 10, color: "var(--crit)", fontWeight: 700 }}>⚑{rec.critical}</span>}
    </span>
  );
}
function SkuDrawer({ s, onClose }) {
  const daily = s.units60 / 60;
  const rec = s.onHand === 0 && s.units60 > 0
    ? { tone: "crit", t: "Stockout with live demand", d: `Selling ~${f3(daily)} units/day with nothing in the 3PL. Expedite replenishment or pause channel listings to avoid oversell.` }
    : s.band === "crit"
      ? { tone: "crit", t: "Below safe cover", d: `${f3(s.doc)} days of stock against current velocity. Reorder now — most components carry 28–60 day lead times.` }
      : s.band === "over"
        ? { tone: "cap", t: "Overstocked — capital tied up", d: `Over a year of cover. Hold POs; this capital could fund packaging on constrained SKUs instead.` }
        : s.band === "none"
          ? { tone: "neutral", t: "No recent sales", d: "Sitting in the warehouse with no 60-day velocity. Review for clearance or discontinuation." }
          : { tone: "good", t: "Healthy position", d: "Stock and velocity are in balance for this SKU." };
  const toneC = { crit: "var(--crit)", cap: "var(--cap)", good: "var(--good)", neutral: "var(--muted)" }[rec.tone];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="slideover">
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{s.sku}</div>
            <h2 style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{s.name}</h2>
            <div style={{ marginTop: 9, display: "flex", gap: 7 }}>
              <P3 tone={STATUS_TONE[s.status] || "neutral"}>{s.status}</P3>
              <CP3 doc={s.doc} band={s.band} />
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I3.x({})}</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Metric label="On hand" value={f3(s.onHand)} unit="units" />
            <Metric label="Lots" value={f3(s.lots)} unit="in 3PL" />
            <Metric label="60-day sales" value={s.units60 ? f3(s.units60) : "—"} unit="units" />
            <Metric label="60-day revenue" value={s.rev60 ? uk3(s.rev60) : "—"} unit="" />
            <Metric label="Daily velocity" value={daily ? daily.toFixed(1) : "—"} unit="units/day" />
            <Metric label="Earliest expiry" value={fd3(s.earliestExp)} unit={s.expDays != null ? `${f3(s.expDays)}d` : ""} />
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="eyebrow">Days of cover</div>
            <div style={{ marginTop: 8 }}>
              <B3 value={Math.min(s.doc || 0, 540)} max={540} tone={s.band === "crit" || s.band === "stockout" ? "var(--crit)" : s.band === "warn" ? "var(--warn)" : s.band === "over" ? "var(--cap)" : "var(--good)"} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--faint)", marginTop: 5 }}>
                <span>0</span><span>30d</span><span>60d</span><span>365d</span><span>540d+</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 10, background: { crit: "var(--crit-tint)", cap: "var(--cap-tint)", good: "var(--good-tint)", neutral: "var(--surface-2)" }[rec.tone] }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: toneC, display: "flex", alignItems: "center", gap: 8 }}>{I3.alert({ style: { width: 15, height: 15 } })}{rec.t}</div>
            <p style={{ fontSize: 12.5, lineHeight: 1.55, margin: "8px 0 0", color: "var(--ink)" }}>{rec.d}</p>
          </div>

          <ArtworkProofs sku={s.sku} />
          <RegulatoryPanel s={s} />
          <FormulaPanel sku={s.sku} />
          <ReviewsPanel sku={s.sku} />
        </div>
      </div>
    </>
  );
}
function Metric({ label, value, unit }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{value} {unit && <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 400 }}>{unit}</span>}</div>
    </div>
  );
}

/* ===== Artwork & proof tracking (per SKU) ===== */
function ArtworkProofs({ sku }) {
  const rec = AW3(sku);
  if (!rec || !rec.components || rec.components.length === 0) {
    return (
      <div style={{ marginTop: 22 }}>
        <div className="section-title" style={{ margin: "0 0 10px" }}><h2 style={{ fontSize: 14 }}>Artwork &amp; proofs</h2><div className="line" /></div>
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12.5, color: "var(--muted)" }}>No artwork components on file for this SKU.</div>
      </div>
    );
  }
  const sum = PS3(rec);
  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title" style={{ margin: "0 0 10px" }}>
        <h2 style={{ fontSize: 14 }}>Artwork &amp; proofs</h2>
        {sum.allApproved
          ? <P3 tone="good">{I3.check({ style: { width: 11, height: 11 } })}All approved</P3>
          : <P3 tone={sum.blocked ? "warn" : "cap"}>{sum.ready}/{sum.total} approved</P3>}
        <div className="line" />
        {rec.upc && <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>UPC {rec.upc}</span>}
      </div>

      {/* readiness bar */}
      <div style={{ display: "flex", height: 7, borderRadius: 4, overflow: "hidden", gap: 2, marginBottom: 14 }}>
        {["approved", "in-review", "revise", "not-started"].map((st) => sum.counts[st] > 0 && (
          <div key={st} title={PST3[st].label + ": " + sum.counts[st]} style={{ flex: sum.counts[st], background: { good: "var(--good)", cap: "var(--cap)", warn: "var(--warn)", neutral: "#d8d4ce" }[PST3[st].tone] }} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rec.components.map((c, i) => <ProofCard key={i} c={c} />)}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Artwork specs are from the Artwork Master Data file. Proof status, version &amp; owner are a tracking layer — placeholder until a proofing-system feed is connected.</div>
    </div>
  );
}
function ProofCard({ c }) {
  const st = PST3[c.proof.stage] || PST3["not-started"];
  const specs = [c.dims, c.material, c.finish, c.printColor, c.foil && c.foil !== "-" ? c.foil : null].filter(Boolean);
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: "var(--surface-2)" }}>
        <span className="dotmark" style={{ background: { good: "var(--good)", cap: "var(--cap)", warn: "var(--warn)", neutral: "#b6b1a9" }[st.tone] }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{c.type}</div>
          {c.cid && <div className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{c.cid}</div>}
        </div>
        <P3 tone={st.tone}>{c.proof.version !== "—" ? c.proof.version + " · " : ""}{st.label}</P3>
      </div>
      <div style={{ padding: "9px 13px" }}>
        {specs.length > 0 && <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{specs.join(" · ")}</div>}
        <div style={{ display: "flex", gap: 16, marginTop: specs.length ? 8 : 0, fontSize: 11, color: "var(--faint)", flexWrap: "wrap" }}>
          <span>Owner <strong style={{ color: "var(--muted)" }}>{c.proof.owner}</strong></span>
          <span>Printer <strong style={{ color: "var(--muted)" }}>{c.proof.printer}</strong></span>
          <span>Rounds <strong style={{ color: "var(--muted)" }}>{c.proof.proofRounds}</strong></span>
          {c.proof.updated && <span>Updated <strong style={{ color: "var(--muted)" }}>{fd3(c.proof.updated)}</strong></span>}
        </div>
      </div>
    </div>
  );
}

/* ===== Regulatory dossier (per SKU) ===== */
function RegulatoryPanel({ s }) {
  const d = RD3(s);
  const h = DH3[d.status];
  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title" style={{ margin: "0 0 12px" }}>
        <h2 style={{ fontSize: 14 }}>Regulatory dossier</h2>
        <P3 tone={h.tone}>{h.label}</P3>
        <div className="line" />
        <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>{d.onFile}/{d.total} on file</span>
      </div>
      {/* compliance bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: "var(--hairline)", overflow: "hidden" }}>
          <div style={{ width: Math.round(d.pct * 100) + "%", height: "100%", background: h.tone === "good" ? "var(--good)" : h.tone === "warn" ? "var(--warn)" : "var(--crit)" }} />
        </div>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{Math.round(d.pct * 100)}%</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {d.sections.map((sec) => (
          <div key={sec.section}>
            <div className="eyebrow" style={{ marginBottom: 7 }}>{sec.section}</div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              {sec.items.map((it, i) => {
                const st = DS3[it.status];
                const ic = it.status === "on-file" ? I3.check : it.status === "pending" ? I3.clock : I3.x;
                const col = { good: "var(--good)", warn: "var(--warn)", crit: "var(--crit)" }[st.tone];
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 13px", borderBottom: i < sec.items.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                    <span style={{ width: 18, height: 18, borderRadius: 5, background: { good: "var(--good-tint)", warn: "var(--warn-tint)", crit: "var(--crit-tint)" }[st.tone], color: col, display: "grid", placeItems: "center", flex: "none" }}>{ic({ style: { width: 11, height: 11 } })}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{it.label}</div>
                      <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{it.source} · {it.owner}</div>
                    </div>
                    <P3 tone={st.tone}>{st.label}</P3>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Required compliance records per finished product. Inventory, ingredients &amp; label status are linked to live data; the rest is a tracking layer — placeholder until the regulatory document store is connected.</div>
    </div>
  );
}

/* ===== Formula & ingredients (per SKU) ===== */
function FormulaPanel({ sku }) {
  const [open, setOpen] = uS3(false);
  const [showFull, setShowFull] = uS3(false);
  const il = IL3(sku);   // published INCI declaration (customer-facing)
  const f = FM3(sku);    // production formula with % W/W
  if (!il && !f) {
    return (
      <div style={{ marginTop: 22 }}>
        <div className="section-title" style={{ margin: "0 0 10px" }}><h2 style={{ fontSize: 14 }}>Ingredients</h2><div className="line" /></div>
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12.5, color: "var(--muted)" }}>No ingredient list on file for this SKU.</div>
      </div>
    );
  }
  // ingredient declaration list + count come from the published IL when present, else from the formula
  const ilItems = il ? il.ingredients : (f ? f.ingredients.map((x) => x.inci) : []);
  const inciString = il ? il.il : (f ? f.inciString : "");
  const count = il ? il.count : (f ? f.count : 0);
  const allergens = (il && il.allergens && il.allergens.length) ? il.allergens : (f ? f.allergens : []);

  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title" style={{ margin: "0 0 12px" }}>
        <h2 style={{ fontSize: 14 }}>Ingredients</h2>
        <P3 tone="neutral">{count} ingredients</P3>
        {f && f.isFFP && <P3 tone="good">Production formula</P3>}
        <div className="line" />
        {il && il.updated && <span className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>IL {fd3(il.updated)}</span>}
      </div>

      {/* allergens */}
      {allergens.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>EU-listed fragrance allergens</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allergens.map((a) => <span key={a} className="pill warn" style={{ textTransform: "capitalize" }}>{a}</span>)}
          </div>
        </div>
      )}

      {/* production formula % breakdown (when available) */}
      {f && (
        <div style={{ marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Formula breakdown (% W/W){f.fillWeight ? " · " + f.fillWeight + "g fill" : ""}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(open ? f.ingredients : f.ingredients.slice(0, 6)).map((ing, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.inci}</div>
                  {ing.name !== ing.inci && <div style={{ fontSize: 10.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.name}</div>}
                </div>
                <div style={{ width: 90, display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--hairline)", overflow: "hidden" }}>
                    <div style={{ width: Math.min(100, ing.pct) + "%", height: "100%", background: "var(--accent)" }} />
                  </div>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", width: 38, textAlign: "right" }}>{ing.pct}%</span>
                </div>
              </div>
            ))}
          </div>
          {f.ingredients.length > 6 && (
            <button className="tag" style={{ marginTop: 10 }} onClick={() => setOpen(!open)}>{open ? "Show top 6" : "Show all " + f.ingredients.length} {I3.down({ style: { width: 12, height: 12, transform: open ? "rotate(180deg)" : "none" } })}</button>
          )}
        </div>
      )}

      {/* INCI declaration (customer-facing) */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>INCI declaration (as on label)</div>
        {ilItems.length > 0 && !showFull ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {ilItems.slice(0, 14).map((ing, i) => (
              <span key={i} style={{ fontSize: 11.5, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 8px", color: "var(--ink)" }}>{ing}</span>
            ))}
            {ilItems.length > 14 && <button className="tag" style={{ fontSize: 11, padding: "3px 9px" }} onClick={() => setShowFull(true)}>+{ilItems.length - 14} more</button>}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px", maxHeight: 150, overflowY: "auto" }}>{inciString}</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>
        {il ? "Published ingredient declaration (INCI), as on the product label/site." : "From the production formula sheet."}
        {allergens.length > 0 && " Allergens auto-detected against the EU fragrance-allergen list — confirm before label use."}
      </div>
    </div>
  );
}

/* ===== Customer reviews (per SKU) ===== */
function ReviewsPanel({ sku }) {
  const [filter, setFilter] = uS3("notable");
  const rec = RV3(sku);
  if (!rec) {
    return (
      <div style={{ marginTop: 22 }}>
        <div className="section-title" style={{ margin: "0 0 10px" }}><h2 style={{ fontSize: 14 }}>Customer reviews</h2><div className="line" /></div>
        <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12.5, color: "var(--muted)" }}>No reviews matched to this SKU.</div>
      </div>
    );
  }
  const h = RH3(rec); const st = RST3[h.status];
  const maxDist = Math.max(...[1, 2, 3, 4, 5].map((k) => rec.dist[k]), 1);
  const trendDelta = rec.recentAvg != null ? +(rec.recentAvg - rec.avg).toFixed(1) : null;
  const list = filter === "critical" ? rec.reviews.filter((r) => r.flag === "CRITICAL")
    : filter === "low" ? rec.reviews.filter((r) => r.stars <= 2)
    : rec.reviews;

  return (
    <div style={{ marginTop: 22 }}>
      <div className="section-title" style={{ margin: "0 0 12px" }}>
        <h2 style={{ fontSize: 14 }}>Customer reviews</h2>
        <P3 tone={st.tone}>{st.label}</P3>
        <div className="line" />
        <span style={{ fontSize: 11, color: "var(--faint)" }}>{f3(rec.count)} reviews</span>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 14 }}>
        <div style={{ textAlign: "center", flex: "none" }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1 }}>{rec.avg.toFixed(2)}</div>
          <div style={{ marginTop: 5 }}><STARS3 value={rec.avg} size={13} /></div>
          {trendDelta != null && (
            <div style={{ fontSize: 10.5, marginTop: 5, color: trendDelta < -0.2 ? "var(--crit)" : trendDelta > 0.2 ? "var(--good)" : "var(--muted)" }}>
              90d {trendDelta >= 0 ? "▲" : "▼"} {Math.abs(trendDelta).toFixed(1)} ({rec.recentAvg})
            </div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          {[5, 4, 3, 2, 1].map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)", width: 8 }}>{k}</span>
              <div style={{ flex: 1, height: 7, borderRadius: 4, background: "var(--hairline)", overflow: "hidden" }}>
                <div style={{ width: (rec.dist[k] / maxDist * 100) + "%", height: "100%", background: k >= 4 ? "var(--good)" : k === 3 ? "#cdb86a" : "var(--crit)" }} />
              </div>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--muted)", width: 28, textAlign: "right" }}>{rec.dist[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {rec.critical > 0 && (
        <div style={{ padding: "10px 13px", borderRadius: 9, background: "var(--crit-tint)", display: "flex", gap: 9, alignItems: "center", marginBottom: 12 }}>
          {I3.alert({ style: { width: 15, height: 15, color: "var(--crit)", flex: "none" } })}
          <span style={{ fontSize: 12.5, color: "var(--ink)" }}><strong style={{ color: "var(--crit)" }}>{rec.critical} flagged review{rec.critical > 1 ? "s" : ""}</strong> — adverse reaction or quality complaint. Review before reordering.</span>
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["notable", "Notable"], ["critical", "Flagged (" + rec.critical + ")"], ["low", "1–2★"]].map(([id, l]) => (
          <button key={id} className={"tag" + (filter === id ? " on" : "")} onClick={() => setFilter(id)} style={{ fontSize: 11.5, padding: "4px 10px" }}>{l}</button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {list.length === 0 && <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>No reviews in this filter.</div>}
        {list.map((r, i) => <ReviewCard key={i} r={r} />)}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>Showing notable reviews (flagged, lowest &amp; recent). Full set: {f3(rec.count)} reviews from the source export.</div>
    </div>
  );
}
function ReviewCard({ r }) {
  const tone = r.flag === "CRITICAL" ? "crit" : r.stars >= 4 ? "good" : r.stars <= 2 ? "warn" : "neutral";
  const edge = { crit: "var(--crit)", good: "var(--good)", warn: "var(--warn)", neutral: "var(--border)" }[tone];
  return (
    <div style={{ border: "1px solid var(--border)", borderLeft: "3px solid " + edge, borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <STARS3 value={r.stars} size={12} />
        {r.flag === "CRITICAL" && <P3 tone="crit">{I3.alert({ style: { width: 10, height: 10 } })}Flagged</P3>}
        {r.recent && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--cap)" }}>recent</span>}
        <span className="mono" style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--faint)" }}>{fd3(r.date)}</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.5 }}>{r.text || <span style={{ color: "var(--faint)" }}>(no text)</span>}</div>
    </div>
  );
}

/* ===================================================================== */
/* CHANNELS — awaiting data design                                       */
/* ===================================================================== */
const CHANNELS = [
  { name: "Amazon", note: "FBA + Seller Fulfilled", icon: I3.box },
  { name: "Deposco", note: "3PL warehouse (live source)", icon: I3.box, live: true },
  { name: "PODs", note: "Print-on-demand / pop-up", icon: I3.box },
  { name: "Berkeley retail", note: "Flagship store", icon: I3.box },
  { name: "China", note: "Cross-border / Tmall", icon: I3.box },
];
function Channels({ data }) {
  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-pad" style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ maxWidth: 560 }}>
            <div className="eyebrow">Unified Total Available Inventory</div>
            <h2 style={{ margin: "8px 0 6px", fontSize: 19, fontWeight: 700, letterSpacing: "-.02em" }}>{fk3(data.meta.totalOnHand)} units — one pool today</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55, margin: 0 }}>The file gives us a single combined 3PL position. When the five channel feeds connect, this bar splits — so you'll instantly see Amazon running dry while Deposco sits on surplus.</p>
          </div>
          <P3 tone="neutral">Awaiting channel feeds</P3>
        </div>
        <div style={{ padding: "0 20px 20px" }}>
          <div style={{ display: "flex", height: 30, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
            {CHANNELS.map((c, i) => (
              <div key={c.name} style={{ flex: 1, background: c.live ? "var(--ink)" : "repeating-linear-gradient(135deg,var(--surface-2),var(--surface-2) 7px,#ececea 7px,#ececea 14px)", borderRight: i < 4 ? "1px solid var(--border)" : "none", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, color: c.live ? "#fff" : "var(--faint)" }}>{c.name}</div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
        {CHANNELS.map((c) => (
          <div key={c.name} className={c.live ? "channel-card" : "awaiting"} style={{ padding: 17, minHeight: 160 }}>
            {!c.live && <div className="await-tag"><P3 tone="neutral">No feed</P3></div>}
            {c.live && <div style={{ position: "absolute", top: 14, right: 14 }}><P3 tone="good">Live</P3></div>}
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--muted)" }}>{c.icon({ style: { width: 16, height: 16 } })}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{c.note}</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              {c.live ? (
                <>
                  <div className="mono" style={{ fontSize: 23, fontWeight: 600 }}>{fk3(data.meta.totalOnHand)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>units · all SKUs</div>
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {["TAI by SKU", "Low-stock alerts", "Transfer suggestions"].map(x => (
                    <div key={x} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--faint)" }}>
                      <span style={{ width: 60, height: 7, borderRadius: 4, background: "#e7e4df" }} />{x}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================================================================== */
/* RECONCILIATION — conditioner lots vs warehouse (real)                 */
/* ===================================================================== */
function Recon({ data }) {
  const [filter, setFilter] = uS3("all");
  const [reconLimit, setReconLimit] = uS3(25);
  const recon = data.recon;
  const found = recon.filter(r => r.match === "found");
  const missing = recon.filter(r => r.match === "missing");
  const rows = filter === "found" ? found : filter === "missing" ? missing : recon;
  const tone = { found: "good", missing: "crit", unknown: "warn" };
  const icon = { found: I3.check, missing: I3.x, unknown: I3.alert };

  return (
    <div className="fade-in">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <RStat n={found.length} t="Found in warehouse" c="var(--good)" sub="Production lot matched to 3PL stock" onClick={() => setFilter("found")} on={filter === "found"} />
        <RStat n={missing.length} t="Not in warehouse" c="var(--crit)" sub="Produced but no matching 3PL lot" onClick={() => setFilter("missing")} on={filter === "missing"} />
        <RStat n={Math.round(found.length / recon.length * 100) + "%"} t="Match rate" c="var(--ink)" sub="Real reconciliation, May 28" onClick={() => setFilter("all")} on={filter === "all"} />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-head">
          <h3>Conditioner production lots vs. 3PL</h3>
          <div className="seg">
            {[["all", "All"], ["found", "Found"], ["missing", "Missing"]].map(([id, l]) => (
              <button key={id} className={filter === id ? "on" : ""} onClick={() => setFilter(id)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr><th>Match</th><th>Product</th><th>Size</th><th>Lot #</th><th className="num">3PL qty</th><th className="num">Expires</th></tr>
            </thead>
            <tbody>
              {PSL3(rows, reconLimit).map((r, i) => (
                <tr key={i}>
                  <td><P3 tone={tone[r.match]}>{icon[r.match]({ style: { width: 11, height: 11 } })}{r.match === "found" ? "Found" : r.match === "missing" ? "Missing" : "Unknown"}</P3></td>
                  <td className="name-cell">{r.name}</td>
                  <td style={{ color: "var(--muted)" }}>{r.size}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{r.lot || "—"}</td>
                  <td className="num">{r.qty ? f3(r.qty) : "—"}</td>
                  <td className="num" style={{ color: "var(--muted)" }}>{fd3(r.exp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PG3 total={rows.length} limit={reconLimit} setLimit={setReconLimit} />
      </div>
      <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 12, maxWidth: 640 }}>Source: formulation team lot log cross-referenced against 3PL inventory. A missing lot means product was formulated but never reconciled into the warehouse — the manual version of the match-rate the predictor automates.</p>
    </div>
  );
}
function RStat({ n, t, c, sub, onClick, on }) {
  return (
    <button className="card" onClick={onClick} style={{ textAlign: "left", padding: "16px 18px", outline: on ? "2px solid var(--ink)" : "none" }}>
      <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: c, lineHeight: 1 }}>{n}</div>
      <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 8 }}>{t}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
    </button>
  );
}

window.VIEWS3 = { Inventory, Channels, Recon };
