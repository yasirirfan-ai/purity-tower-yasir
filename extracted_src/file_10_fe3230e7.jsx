/* global React, LIB */
const { fmt:f8, fmtK:fk8, usd:usd8, usdK:uk8, fmtDate:fd8, addDays:AD8, PLAN_TODAY:T8, Ic:I8, Pill:P8, useState:uS8, useMemo:uM8, Pager:PG8, pageSlice:PSL8 } = LIB;
const { cashObligations:CO8, cashWeeks:CW8, loadOpeningCash:LOC8, saveOpeningCash:SOC8, cashFromOpenPOs:CFP8, cashMonths:CM8 } = window.LIB_CASH;

const ING8 = "#2f7d52", PKG8 = "#3f51b5";
const sd8 = (off) => AD8(T8, off).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const rel8 = (off) => off < 0 ? `${-off}d overdue` : off === 0 ? "today" : `in ${off}d`;
const HORIZON_WK = 16, HORIZON_MO = 9;

function CashPlanner({ data, settings }) {
  const [opening, setOpening] = uS8(() => LOC8());
  const [type, setType] = uS8("all");
  const [source, setSource] = uS8("pos");   // "pos" = open POs (what's wanted), "plan" = replenishment plan
  const [grain, setGrain] = uS8("month");    // "month" | "week"

  const events = uM8(() => source === "pos" ? CFP8() : CO8(data.builds, settings), [data, settings, source]);
  const isPO = source === "pos";
  const weeks = uM8(() => CW8(events, opening, HORIZON_WK), [events, opening]);
  const months = uM8(() => CM8(events, opening, HORIZON_MO), [events, opening]);
  const buckets = grain === "month" ? months : weeks;

  const horizonDays = grain === "month" ? HORIZON_MO * 30 : HORIZON_WK * 7;
  const inHorizon = events.filter((e) => e.dueOff < horizonDays && e.dueOff >= -120);
  const totalAP = inHorizon.reduce((a, e) => a + e.amount, 0);
  const due30 = events.filter((e) => e.dueOff <= 30).reduce((a, e) => a + e.amount, 0);
  const overdue = events.filter((e) => e.dueOff < 0).reduce((a, e) => a + e.amount, 0);
  const ingAP = inHorizon.filter((e) => e.type === "ingredient").reduce((a, e) => a + e.amount, 0);
  const pkgAP = inHorizon.filter((e) => e.type === "packaging").reduce((a, e) => a + e.amount, 0);
  const lowest = buckets.reduce((m, b) => Math.min(m, b.balance), opening);
  const lowB = buckets.find((b) => b.balance === lowest);

  const rows = type === "all" ? events : events.filter((e) => e.type === type);
  const setOpen = (v) => { const n = Math.round(v) || 0; setOpening(n); SOC8(n); };
  const setSrc = (s) => { setSource(s); };

  const maxB = Math.max(...buckets.map((b) => b.total), 1);
  const minBal = Math.min(0, lowest), maxBal = Math.max(opening, ...buckets.map((b) => b.balance));
  const balY = (b) => 160 - ((b - minBal) / (maxBal - minBal || 1)) * 160;
  const bLabel = (b) => grain === "month" ? b.label : sd8(b.lo);

  const byVendor = uM8(() => {
    const m = {};
    inHorizon.forEach((e) => { const v = m[e.vendor] || (m[e.vendor] = { vendor: e.vendor, amount: 0, prepaid: e.prepaid, terms: e.terms, lines: 0, earliest: 1e9 }); v.amount += e.amount; v.lines++; v.earliest = Math.min(v.earliest, e.dueOff); });
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  }, [events, grain]);

  // per-finished-PO rollup (cost to fulfill each open order)
  const byPO = uM8(() => {
    if (!isPO) return [];
    const m = {};
    events.forEach((e) => {
      if (!e.po) return;
      const k = e.po + "|" + e.sku;
      const o = m[k] || (m[k] = { po: e.po, sku: e.sku, product: e.product, qty: e.qty, orderDate: e.orderDate, orderOff: e.orderOff, ing: 0, pkg: 0, total: 0, firstDue: 1e9 });
      o[e.type === "ingredient" ? "ing" : "pkg"] += e.amount; o.total += e.amount; o.firstDue = Math.min(o.firstDue, e.dueOff);
    });
    return Object.values(m).sort((a, b) => a.orderOff - b.orderOff);
  }, [events, source]);
  const [poType, setPoType] = uS8("");
  const [poLimit, setPoLimit] = uS8(25);
  const [schedLimit, setSchedLimit] = uS8(25);
  const [poGantt, setPoGantt] = uS8(null);
  const [poQuery, setPoQuery] = uS8("");
  const poRows = uM8(() => {
    const t = poQuery.trim().toLowerCase();
    if (!t) return byPO;
    return byPO.filter((p) => (p.po || "").toLowerCase().includes(t) || (p.product || "").toLowerCase().includes(t) || (p.sku || "").toLowerCase().includes(t));
  }, [byPO, poQuery]);
  const ganttIdx = poGantt ? poRows.findIndex((p) => p.po === poGantt.po && p.sku === poGantt.sku) : -1;

  return (
    <div className="fade-in">
      {/* source + grain toggles */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <div className="seg">
          <button className={isPO ? "on" : ""} onClick={() => setSrc("pos")}>Open POs (what's wanted)</button>
          <button className={!isPO ? "on" : ""} onClick={() => setSrc("plan")}>Replenishment plan</button>
        </div>
        <div className="seg">
          <button className={grain === "month" ? "on" : ""} onClick={() => setGrain("month")}>By month</button>
          <button className={grain === "week" ? "on" : ""} onClick={() => setGrain("week")}>By week</button>
        </div>
        {isPO && window.INV_OPENPOS && <span style={{ fontSize: 12, color: "var(--muted)" }}>{window.INV_OPENPOS.meta.distinctPOs} open POs · {f8(window.INV_OPENPOS.meta.totalUnits)} units → {window.INV_OPENPOS.meta.manufacturer}</span>}
      </div>

      <div className="kpi-grid">
        <KPI8 label="Total payable (horizon)" value={uk8(totalAP)} sub={`${uk8(ingAP)} ingredients · ${uk8(pkgAP)} packaging`} edge="var(--ink)" icon={I8.scale} />
        <KPI8 label="Due within 30 days" value={uk8(due30)} sub={`${events.filter((e) => e.dueOff <= 30 && e.dueOff >= 0).length} invoices`} edge="var(--crit)" icon={I8.clock} />
        <KPI8 label={overdue > 0 ? "Past due" : "Prepaid soon"} value={uk8(overdue > 0 ? overdue : events.filter((e) => e.prepaid && e.dueOff <= 14).reduce((a, e) => a + e.amount, 0))} sub={overdue > 0 ? "invoices already due" : "prepaid POs landing"} edge="var(--warn)" icon={I8.alert} />
        <KPI8 label="Lowest cash balance" value={uk8(lowest)} sub={lowB ? bLabel(lowB) : "—"} edge={lowest < 0 ? "var(--crit)" : "var(--good)"} icon={I8.trend} />
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-pad" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div className="eyebrow">Opening cash balance</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: "var(--muted)" }}>$</span>
              <input className="pd-input" style={{ width: 150, fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700 }} type="number" step="10000" value={opening} onChange={(e) => setOpen(parseFloat(e.target.value))} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: "var(--muted)", lineHeight: 1.5, maxWidth: 560 }}>
            {isPO
              ? <>Forecasting from the <strong>{window.INV_OPENPOS ? window.INV_OPENPOS.meta.manufacturer : "manufacturer"} open POs</strong> — each finished-goods order explodes into its component &amp; ingredient buys, dated by lead time + vendor <strong>net terms</strong>. This is what you'll owe to fulfill what's been ordered.</>
              : <>Forecasting from the <strong>replenishment plan</strong> (reorder to target cover). Payables dated by each PO's net terms — prepaid overseas hits immediately, domestic Net 30/60 is financed.</>}
          </div>
          {lowest < 0 && <P8 tone="crit">{I8.alert({ style: { width: 12, height: 12 } })}Projected shortfall</P8>}
        </div>
      </div>

      {/* open finished-goods POs */}
      {isPO && byPO.length > 0 && (
        <>
          <div className="section-title"><h2>Open finished-goods POs</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{f8(byPO.length)} orders → {window.INV_OPENPOS.meta.manufacturer} · click a PO for its order Gantt</span><div className="line" /></div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div className="search" style={{ maxWidth: 360 }}>
              {I8.search ? I8.search({}) : null}
              <input placeholder="Search PO #, product or SKU…" value={poQuery} onChange={(e) => setPoQuery(e.target.value)} />
              {poQuery && <button onClick={() => setPoQuery("")} style={{ color: "var(--faint)" }}>{I8.x({ style: { width: 14, height: 14 } })}</button>}
            </div>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }} className="tnum">{f8(poRows.length)} of {f8(byPO.length)}</span>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-wrap">
              <table className="data">
                <thead><tr><th>PO</th><th>Ordered</th><th>Product</th><th>SKU</th><th className="num">Qty</th><th className="num">Ingredients</th><th className="num">Packaging</th><th className="num">Total to fulfill</th><th className="num">$/unit</th></tr></thead>
                <tbody>
                  {PSL8(poRows, poLimit).map((p, i) => (
                    <tr key={p.po + p.sku} className="row" onClick={() => setPoGantt(p)} style={{ cursor: "pointer" }}>
                      <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{p.po}</td>
                      <td className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{fd8(p.orderDate)}</td>
                      <td className="name-cell" style={{ maxWidth: 240 }}>{p.product}</td>
                      <td className="sku-cell">{p.sku}</td>
                      <td className="num">{f8(p.qty)}</td>
                      <td className="num" style={{ color: ING8 }}>{uk8(p.ing)}</td>
                      <td className="num" style={{ color: PKG8 }}>{uk8(p.pkg)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{uk8(p.total)}</td>
                      <td className="num" style={{ color: "var(--muted)" }}>${p.qty ? (p.total / p.qty).toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                  {poRows.length === 0 && <tr><td colSpan="9" style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>No POs match “{poQuery}”.</td></tr>}
                </tbody>
              </table>
            </div>
            <PG8 total={poRows.length} limit={poLimit} setLimit={setPoLimit} />
          </div>
        </>
      )}

      {/* forecast chart */}
      <div className="section-title"><h2>Cash-outflow forecast</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{grain === "month" ? HORIZON_MO + " months" : HORIZON_WK + " weeks"} · ingredient vs. packaging</span><div className="line" /></div>
      <div className="card"><div className="card-pad">
        <div style={{ position: "relative", height: 200, display: "flex", alignItems: "flex-end", gap: grain === "month" ? 10 : 4 }}>
          {buckets.map((b, idx) => {
            const h = (b.total / maxB) * 150;
            const ingH = b.total ? (b.ing / b.total) * h : 0;
            const pkgH = b.total ? (b.pkg / b.total) * h : 0;
            return (
              <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: 170, position: "relative" }} title={`${bLabel(b)} · ${uk8(b.total)} (${b.count}) · balance ${uk8(b.balance)}`}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "var(--muted)", marginBottom: 2 }}>{b.total > 0 ? uk8(b.total) : ""}</span>
                <div style={{ width: grain === "month" ? "62%" : "78%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 150 }}>
                  <div style={{ height: pkgH + "px", background: PKG8, borderRadius: pkgH && !ingH ? "3px 3px 0 0" : 0 }} />
                  <div style={{ height: ingH + "px", background: ING8, borderRadius: ingH && !pkgH ? "3px 3px 0 0" : 0, borderTop: pkgH ? "1px solid rgba(255,255,255,.4)" : "none" }} />
                </div>
                <span style={{ fontSize: 9, color: "var(--faint)", marginTop: 4, whiteSpace: "nowrap", transform: grain === "week" ? "rotate(-40deg)" : "none" }}>{bLabel(b)}</span>
              </div>
            );
          })}
          <svg style={{ position: "absolute", left: 0, top: 0, right: 0, height: 160, pointerEvents: "none", overflow: "visible" }} preserveAspectRatio="none" viewBox={`0 0 ${buckets.length} 160`}>
            <polyline fill="none" stroke="var(--ink)" strokeWidth={grain === "month" ? "0.04" : "0.06"} points={buckets.map((b, i) => `${i + 0.5},${balY(b.balance)}`).join(" ")} />
            {buckets.map((b, i) => <circle key={i} cx={i + 0.5} cy={balY(b.balance)} r={grain === "month" ? "0.09" : "0.12"} fill={b.balance < 0 ? "var(--crit)" : "var(--ink)"} />)}
          </svg>
        </div>
        <div className="legend" style={{ marginTop: 14 }}>
          <span><span className="dotmark" style={{ background: ING8 }} />Ingredient payments</span>
          <span><span className="dotmark" style={{ background: PKG8 }} />Packaging payments</span>
          <span><span style={{ width: 14, borderTop: "2px solid var(--ink)", display: "inline-block" }} />Projected cash balance</span>
        </div>
      </div></div>

      {/* monthly summary table (when by month) */}
      {grain === "month" && (
        <div className="card" style={{ overflow: "hidden", marginTop: 16 }}>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>Month</th><th className="num">Ingredients</th><th className="num">Packaging</th><th className="num">Total out</th><th className="num">Invoices</th><th className="num">Projected balance</th></tr></thead>
              <tbody>
                {months.map((m, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{m.label}</td>
                    <td className="num">{uk8(m.ing)}</td>
                    <td className="num">{uk8(m.pkg)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{uk8(m.total)}</td>
                    <td className="num" style={{ color: "var(--muted)" }}>{m.count}</td>
                    <td className="num" style={{ fontWeight: 700, color: m.balance < 0 ? "var(--crit)" : "var(--good)" }}>{uk8(m.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* vendor rollup */}
      <div className="section-title"><h2>Payables by vendor</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>over the horizon</span><div className="line" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12 }}>
        {byVendor.slice(0, 9).map((v) => (
          <div key={v.vendor} className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{v.vendor}</div>
              <P8 tone={v.prepaid ? "crit" : v.terms >= 60 ? "good" : "neutral"}>{v.prepaid ? "Prepay" : "Net " + v.terms}</P8>
            </div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, marginTop: 7 }}>{uk8(v.amount)}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{v.lines} line{v.lines > 1 ? "s" : ""} · first due {sd8(v.earliest)}</div>
          </div>
        ))}
      </div>

      {/* schedule */}
      <div className="section-title"><h2>Payables schedule</h2>
        <div className="seg" style={{ marginLeft: 8 }}>{[["all", "All"], ["ingredient", "Ingredients"], ["packaging", "Packaging"]].map(([id, l]) => <button key={id} className={type === id ? "on" : ""} onClick={() => setType(id)}>{l}</button>)}</div>
        <div className="line" /><span style={{ fontSize: 11.5, color: "var(--muted)" }}>{f8(rows.length)} lines</span></div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Due</th>{isPO && <th>PO</th>}<th>Ordered</th><th>Vendor</th><th>Type</th><th>For</th>{isPO && <th className="num">Qty</th>}<th>Terms</th><th className="num">Amount</th></tr></thead>
            <tbody>
              {PSL8(rows, schedLimit).map((e, i) => (
                <tr key={i} className="row">
                  <td><div style={{ fontWeight: 600 }}>{sd8(e.dueOff)}</div><div style={{ fontSize: 11, color: e.dueOff < 0 ? "var(--crit)" : e.dueOff <= 14 ? "var(--warn)" : "var(--muted)" }}>{rel8(e.dueOff)}</div></td>
                  {isPO && <td className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.po}</td>}
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{e.orderDate ? fd8(e.orderDate) : sd8(e.orderOff)}</td>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{e.imported && <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "#fbeee6", color: "#9a5418", borderRadius: 3, padding: "1px 4px" }}>{e.shipMethod === "Air" ? "AIR" : "IMP"}</span>}{e.vendor}</span></td>
                  <td><span className="dotmark" style={{ background: e.type === "ingredient" ? ING8 : PKG8, display: "inline-block", marginRight: 6 }} />{e.type === "ingredient" ? "Ingredient" : "Packaging"}</td>
                  <td className="name-cell" style={{ maxWidth: 200, color: "var(--muted)" }}>{e.component} <span style={{ color: "var(--faint)" }}>· {e.product}</span></td>
                  {isPO && <td className="num">{f8(e.qty)}</td>}
                  <td><P8 tone={e.prepaid ? "crit" : e.terms >= 60 ? "good" : "neutral"}>{e.prepaid ? "Prepay" : "Net " + e.terms}</P8></td>
                  <td className="num" style={{ fontWeight: 700 }}>{uk8(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PG8 total={rows.length} limit={schedLimit} setLimit={setSchedLimit} />
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
        {isPO
          ? <>Forecast from {window.INV_OPENPOS ? window.INV_OPENPOS.meta.manufacturer : "manufacturer"} open POs exploded through the BOM. Due date = order date + production + shipment lead + vendor net terms. PO order dates are synthesized until real dates are fed in; amounts use BOM unit prices.</>
          : <>Payables from the synced replenishment plan. Amount = goods + duty + inbound freight. </>}
        Opening balance is editable and saved locally.
      </div>
      {poGantt && <POGanttDrawer po={poGantt} list={poRows} idx={ganttIdx} onNav={(d) => { const ni = ganttIdx + d; if (ni >= 0 && ni < poRows.length) setPoGantt(poRows[ni]); }} onClose={() => setPoGantt(null)} />}
    </div>
  );
}

const PROD_COMPOUND = 12, PROD_FILL = 8;
function poHash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function poNetT(txt) { if (!txt) return 30; const l = txt.toLowerCase(); if (/prepaid|prepay|before ship/.test(l)) return 0; const m = l.match(/net\s*(\d+)/); return m ? parseInt(m[1]) : 30; }

function POGanttDrawer({ po, list, idx, onNav, onClose }) {
  const RB = window.INV_OPENPOS && window.INV_REALBOM;
  const bom = (window.INV_REALBOM && window.INV_REALBOM.bySku[po.sku]) || null;
  const comps = bom ? bom.components.filter((c) => c.type !== "Formula" && (c.unitPrice != null)) : [];
  // anchor: finished goods ready ~90d after the PO order date
  const readyOff = po.orderOff + 90;
  const MICRO_DAYS = 14; // microbiological / challenge QC hold before release
  const microEnd = readyOff, microStart = microEnd - MICRO_DAYS;
  const fillEnd = microStart, fillStart = fillEnd - PROD_FILL, compoundEnd = fillStart, compoundStart = compoundEnd - PROD_COMPOUND;
  const items = comps.map((c) => {
    const isIng = /tube|cap|bottle|box|label|jar|pump|carton|wiper|brush|band|component/i.test(c.type) ? false : true;
    const pkg = !isIng;
    const prodD = Math.round((c.prodLeadWk || 4) * 7), shipD = Math.round((c.shipLeadWk || 5) * 7);
    const lead = prodD + shipD;
    const land = pkg ? fillStart : compoundStart;
    const orderBy = land - lead;
    const ordered = (poHash(po.po + c.type + c.csku) % 100) < 55; // seeded: ~55% already ordered
    return { type: c.type, isIng, pkg, vendor: c.vendor || (c.shipMethod ? c.shipMethod + " vendor" : "vendor"), shipMethod: c.shipMethod, terms: poNetT(c.paymentTerms), prodD, shipD, lead, orderBy, land, ordered, qty: po.qty, amount: Math.round((c.unitPrice || 0) * po.qty) };
  }).sort((a, b) => a.orderBy - b.orderBy);
  const ings = items.filter((i) => i.isIng), pkgs = items.filter((i) => i.pkg);
  const ingOrderBy = ings.length ? Math.min(...ings.map((i) => i.orderBy)) : null;
  const pkgOrderBy = pkgs.length ? Math.min(...pkgs.map((i) => i.orderBy)) : null;
  const lo = Math.min(...items.map((i) => i.orderBy), po.orderOff) - 5;
  const hi = readyOff + 5;
  const span = Math.max(1, hi - lo);
  const xp = (off) => ((Math.max(lo, Math.min(hi, off)) - lo) / span) * 100;
  const ticks = []; for (let o = Math.ceil(lo / 14) * 14; o <= hi; o += 28) ticks.push(o);
  const pkgOrdered = pkgs.filter((i) => i.ordered).length, ingOrdered = ings.filter((i) => i.ordered).length;

  const Row = ({ it, color }) => {
    const prodEnd = it.orderBy + it.prodD;
    return (
      <div className="grow">
        <div className="glabel">
          <span className="dotmark" style={{ background: it.ordered ? color : "transparent", border: it.ordered ? "none" : "1.5px dashed " + color, flex: "none" }} />
          <span style={{ minWidth: 0 }}>
            <span className="truncate" style={{ display: "block" }}>{it.type}</span>
            <span style={{ display: "block", fontSize: 10, color: it.ordered ? "var(--good)" : "var(--crit)", fontWeight: 600 }}>{it.ordered ? "✓ Ordered" : "● Not ordered"} · {it.vendor}</span>
          </span>
        </div>
        <div className="gtrack">
          <div className="gbar" style={{ left: xp(it.orderBy) + "%", width: Math.max(2, xp(prodEnd) - xp(it.orderBy)) + "%", background: color, opacity: it.ordered ? 1 : .4, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>{it.vendor.slice(0, 14)} · {it.prodD}d</div>
          {it.shipD > 0 && <div style={{ position: "absolute", top: 7, height: 20, left: xp(prodEnd) + "%", width: Math.max(2, xp(it.land) - xp(prodEnd)) + "%", background: "repeating-linear-gradient(45deg," + color + "," + color + " 5px,rgba(255,255,255,.5) 5px,rgba(255,255,255,.5) 10px)", borderTopRightRadius: 5, borderBottomRightRadius: 5, opacity: it.ordered ? 1 : .4, display: "grid", placeItems: "center", fontSize: 9, color: "#fff" }}>{it.shipMethod === "Air" ? "✈" : "🚢"}</div>}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="slideover" style={{ width: "min(720px,96vw)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>{po.po} · ordered {fd8(po.orderDate)}</div>
            <h2 style={{ margin: "5px 0 0", fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{po.product}</h2>
            <div style={{ marginTop: 8, display: "flex", gap: 7, flexWrap: "wrap" }}>
              <P8 tone="neutral">{f8(po.qty)} units</P8>
              <P8 tone={pkgOrdered === pkgs.length ? "good" : "crit"}>Packaging {pkgOrdered}/{pkgs.length} ordered</P8>
              <P8 tone={ingOrdered === ings.length ? "good" : "warn"}>Ingredients {ingOrdered}/{ings.length} ordered</P8>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I8.x({})}</button>
        </div>
        {list && idx >= 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 24px", borderBottom: "1px solid var(--hairline)", background: "var(--surface-2)" }}>
            <button className="btn" onClick={() => onNav(-1)} disabled={idx <= 0} style={{ padding: "5px 10px", opacity: idx <= 0 ? .4 : 1, cursor: idx <= 0 ? "not-allowed" : "pointer" }}>{I8.back ? I8.back({ style: { width: 14, height: 14 } }) : "‹"} Prev</button>
            <span style={{ fontSize: 11.5, color: "var(--muted)" }} className="tnum">PO {idx + 1} of {f8(list.length)}</span>
            <button className="btn" onClick={() => onNav(1)} disabled={idx >= list.length - 1} style={{ marginLeft: "auto", padding: "5px 10px", opacity: idx >= list.length - 1 ? .4 : 1, cursor: idx >= list.length - 1 ? "not-allowed" : "pointer" }}>Next {I8.arrowR ? I8.arrowR({ style: { width: 14, height: 14 } }) : "›"}</button>
          </div>
        )}
        <div style={{ padding: 20, overflowY: "auto", flex: 1, minHeight: 0 }}>
          {!bom ? <div style={{ color: "var(--muted)", fontSize: 13 }}>No BOM linked to this SKU.</div> : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "210px 1fr" }}>
                <div /><div style={{ position: "relative", height: 16 }}>{ticks.map((o) => <span key={o} className="mono" style={{ position: "absolute", left: xp(o) + "%", transform: "translateX(-50%)", fontSize: 10, color: "var(--faint)" }}>{sd8(o)}</span>)}</div>
              </div>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 210, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
                  {/* awaiting micro QC band */}
                  <div style={{ position: "absolute", left: xp(microStart) + "%", width: Math.max(0, xp(microEnd) - xp(microStart)) + "%", top: -2, bottom: 0, background: "repeating-linear-gradient(45deg,rgba(180,106,9,.09),rgba(180,106,9,.09) 6px,rgba(180,106,9,.16) 6px,rgba(180,106,9,.16) 12px)", borderLeft: "1.5px dashed var(--warn)", borderRight: "1.5px dashed var(--warn)" }}>
                    <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontSize: 9, fontWeight: 700, color: "var(--warn)", whiteSpace: "nowrap" }}>AWAITING MICRO</span>
                  </div>
                  {ingOrderBy != null && <Marker xp={xp} off={ingOrderBy} color={ING8} label="INGREDIENT PO" />}
                  {pkgOrderBy != null && <Marker xp={xp} off={pkgOrderBy} color={PKG8} label="PACKAGING PO" />}
                  <div style={{ position: "absolute", left: xp(readyOff) + "%", top: -2, bottom: 0, width: 0, borderLeft: "2px solid var(--good)" }}><span style={{ position: "absolute", top: -14, left: 4, fontSize: 9.5, fontWeight: 700, color: "var(--good)", whiteSpace: "nowrap" }}>READY</span></div>
                </div>
                <div style={{ paddingTop: 22 }}>
                  <div className="gphase-label">① Ingredient POs <span style={{ color: ING8 }}>◆</span></div>
                  {ings.map((it, i) => <Row key={"i" + i} it={it} color={ING8} />)}
                  {ings.length === 0 && <div style={{ fontSize: 12, color: "var(--faint)", padding: "4px 0 4px 6px" }}>No ingredient lines in BOM.</div>}
                  <div className="gphase-label">② Packaging POs <span style={{ color: PKG8 }}>◆</span></div>
                  {pkgs.map((it, i) => <Row key={"p" + i} it={it} color={PKG8} />)}
                  {/* production → micro → release */}
                  <div className="gphase-label">③ Production &amp; micro QC</div>
                  <div className="grow">
                    <div className="glabel"><span className="dotmark" style={{ background: "var(--warn)", flex: "none" }} /><span style={{ minWidth: 0 }}><span className="truncate" style={{ display: "block" }}>Awaiting micro (PET)</span><span style={{ display: "block", fontSize: 10, color: "var(--warn)", fontWeight: 600 }}>{MICRO_DAYS}-day hold before release</span></span></div>
                    <div className="gtrack">
                      <div className="gbar" style={{ left: xp(fillStart) + "%", width: Math.max(2, xp(microStart) - xp(fillStart)) + "%", background: "#1a1714", borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>compound + fill</div>
                      <div style={{ position: "absolute", top: 7, height: 20, left: xp(microStart) + "%", width: Math.max(2, xp(microEnd) - xp(microStart)) + "%", background: "var(--warn)", borderTopRightRadius: 5, borderBottomRightRadius: 5, display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>micro</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="legend" style={{ marginTop: 16 }}>
                <span><span className="dotmark" style={{ background: ING8 }} />Ingredient PO</span>
                <span><span className="dotmark" style={{ background: PKG8 }} />Packaging PO</span>
                <span><span className="dotmark" style={{ border: "1.5px dashed var(--faint)", background: "transparent" }} />Not yet ordered</span>
                <span><span style={{ width: 12, height: 9, display: "inline-block", background: "var(--warn)", borderRadius: 2 }} />Awaiting micro (QC hold)</span>
                <span><span style={{ width: 14, borderTop: "2px solid var(--good)", display: "inline-block" }} />Finished goods ready</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>Order-by = ready date − (production + shipment lead). After fill, a {MICRO_DAYS}-day <strong>micro / PET</strong> hold gates release. Ordered status is seeded for demo until the live PO feed connects.</div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
function Marker({ xp, off, color, label }) {
  return (
    <div style={{ position: "absolute", left: xp(off) + "%", top: -2, bottom: 0, width: 0, borderLeft: "2px dashed " + color, zIndex: 4 }}>
      <span style={{ position: "absolute", top: 6, left: 4, fontSize: 9.5, fontWeight: 700, color, whiteSpace: "nowrap", background: "var(--surface)", padding: "0 3px" }}>{label}</span>
    </div>
  );
}

function KPI8({ label, value, sub, edge, icon }) {
  return (
    <div className="kpi">
      <div className="accent-edge" style={{ background: edge }} />
      <div className="label">{icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

window.VIEWS8 = { CashPlanner };
