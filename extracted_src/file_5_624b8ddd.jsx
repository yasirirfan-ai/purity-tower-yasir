/* global React, LIB */
const { fmt:f4, fmtK:fk4, usd:usd4, usdK:uk4, fmtDate:fd4, Ic:I4, Pill:P4, computeSchedule:CS4, PLAN_TODAY:T4, addDays:AD4, vendorTerms:VT4, useState:uS4, useMemo:uM4 } = LIB;
const ING4 = "#2f7d52", PKG4 = "#3f51b5", PROD4 = "#1a1714", LOG4 = "#0d7d8a";

const shortDate = (off) => AD4(T4, off).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const relLabel = (off) => off < 0 ? `${-off}d overdue` : off === 0 ? "today" : `in ${off}d`;
const termsLabel = (n) => n === 0 ? "Prepay" : "Net " + n;

/* ===================================================================== */
/* WHAT TO ORDER                                                         */
/* ===================================================================== */
function OrderPlanner({ data, settings }) {
  const plans = uM4(() => data.builds.map(b => CS4(b, settings, "synced")).filter(p => p.orderItems.length)
    .sort((a, b) => (a.earliestOrderOff ?? 1e9) - (b.earliestOrderOff ?? 1e9)), [data, settings]);
  const [selSku, setSelSku] = uS4(plans[0] ? plans[0].sku : null);
  const sel = plans.find(p => p.sku === selSku) || plans[0];

  const queue = uM4(() => {
    const rows = [];
    plans.forEach(p => p.orderItems.forEach(it => rows.push({ ...it, parent: p })));
    return rows.sort((a, b) => a.startOff - b.startOff);
  }, [plans]);

  // vendor batching
  const vendors = uM4(() => {
    const m = {};
    plans.forEach(p => p.orderItems.forEach(it => {
      const v = m[it.vendor] || (m[it.vendor] = { vendor: it.vendor, netTerms: it.netTerms, lines: [], value: 0, earliest: 1e9, leadMax: 0 });
      v.lines.push({ ...it, parent: p }); v.value += it.value; v.earliest = Math.min(v.earliest, it.startOff); v.leadMax = Math.max(v.leadMax, it.leadTimeDays);
    }));
    return Object.values(m).sort((a, b) => a.earliest - b.earliest);
  }, [plans]);

  const orderNow = queue.filter(q => q.startOff <= 7).length;
  const totalValue = queue.reduce((a, q) => a + q.value, 0);
  const earliestStockout = plans.reduce((m, p) => Math.min(m, p.needByOff), 1e9);

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        <KPI label="POs to place within 7 days" value={f4(orderNow)} edge="var(--crit)" sub={`across ${plans.length} finished goods`} icon={I4.alert} />
        <KPI label="Open order value" value={uk4(totalValue)} edge="var(--cap)" sub={`to reach ~${settings.cover}-day cover`} icon={I4.scale} />
        <KPI label="Earliest stock-out" value={shortDate(earliestStockout)} edge="var(--warn)" sub={relLabel(earliestStockout)} icon={I4.clock} />
        <KPI label="Vendors to engage" value={f4(vendors.length)} edge="var(--ink)" sub={`${queue.length} line items`} icon={I4.channels} />
      </div>

      <div className="card" style={{ marginTop: 20, background: "var(--surface-2)" }}>
        <div className="card-pad" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {I4.recon({ style: { width: 18, height: 18, color: "var(--accent)", marginTop: 1, flex: "none" } })}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55, maxWidth: 780 }}>
            Orders are scheduled <strong>backward from each SKU's stock-out date</strong>. The ideal is <strong>every material landing just in time for the build</strong> — nothing arrives early to sit idle and tie up cash. Use the toggle on the timeline to compare a synced plan against ordering everything today. With <strong>net terms</strong> layered on, the goal is to <strong>sell the finished units before the supplier invoice comes due</strong>.
          </p>
        </div>
      </div>

      {/* Gantt */}
      <div className="section-title"><h2>Order timeline &amp; sync</h2><div className="line" /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {plans.map(p => (
          <button key={p.sku} className={"tag" + (p.sku === sel.sku ? " on" : "")} onClick={() => setSelSku(p.sku)}>
            {p.name.length > 34 ? p.name.slice(0, 33) + "…" : p.name}
            <span className="mono" style={{ fontSize: 10, opacity: .7, marginLeft: 2 }}>{relLabel(p.earliestOrderOff)}</span>
          </button>
        ))}
      </div>
      {sel && <GanttCard build={data.builds.find(b => b.sku === sel.sku)} settings={settings} />}

      {/* Vendor PO summary */}
      <div className="section-title"><h2>Vendor PO summary</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Batch line items into one PO per supplier</span><div className="line" /></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {vendors.map(v => <VendorCard key={v.vendor} v={v} onPick={setSelSku} />)}
      </div>

      {/* Procurement queue */}
      <div className="section-title"><h2>Procurement queue</h2><span style={{ fontSize: 11.5, color: "var(--muted)" }}>Every line, sorted by order-by date</span><div className="line" /></div>
      <div className="card" style={{ overflow: "hidden" }}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr><th>Order by</th><th>Component</th><th>Vendor</th><th>Terms</th><th>For</th><th className="num">Order qty</th><th className="num">Lead</th><th className="num">Value</th><th>Status</th></tr>
            </thead>
            <tbody>
              {queue.map((q, i) => {
                const status = q.startOff < 0 ? ["crit", "Overdue"] : q.startOff <= 7 ? ["warn", "Order now"] : q.startOff <= 30 ? ["cap", "Soon"] : ["neutral", "Scheduled"];
                return (
                  <tr key={i} className="row" onClick={() => setSelSku(q.parent.sku)}>
                    <td><div style={{ fontWeight: 600 }}>{shortDate(q.startOff)}</div><div style={{ fontSize: 11, color: q.startOff < 0 ? "var(--crit)" : "var(--muted)" }}>{relLabel(q.startOff)}</div></td>
                    <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="dotmark" style={{ background: q.isIng ? ING4 : PKG4 }} /><span><span style={{ fontWeight: 500 }}>{q.name}</span><span className="mono" style={{ display: "block", fontSize: 10, color: "var(--faint)" }}>HTS {q.hts.code}</span></span></div></td>
                    <td style={{ color: "var(--muted)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{q.origin.imported && <span className="mono" style={{ fontSize: 9, fontWeight: 800, background: "#fbeee6", color: "#9a5418", borderRadius: 3, padding: "1px 4px" }}>{cc(q.origin.country)}</span>}{q.vendor}</span></td>
                    <td><P4 tone={q.netTerms === 0 ? "crit" : q.netTerms >= 60 ? "good" : "neutral"}>{termsLabel(q.netTerms)}</P4></td>
                    <td className="name-cell" style={{ maxWidth: 180, color: "var(--muted)" }}>{q.parent.name}</td>
                    <td className="num">{f4(q.orderQty)} <span style={{ color: "var(--faint)", fontSize: 11 }}>{q.unit}</span></td>
                    <td className="num">{q.leadTimeDays}d</td>
                    <td className="num">{uk4(q.value)}</td>
                    <td><P4 tone={status[0]}>{status[1]}</P4></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 12 }}>Component supply, vendor lead times, net terms and unit costs are placeholder — awaiting the BOM + vendor master. Lifecycle: compounding {settings.compound}d → fill &amp; release {settings.fill}d → inbound freight to 3PL 9d → receive &amp; lot putaway 3d → last-mile to customer 4d.</p>
    </div>
  );
}

function KPI({ label, value, sub, edge, icon }) {
  return (
    <div className="kpi">
      <div className="accent-edge" style={{ background: edge }} />
      <div className="label">{icon({ style: { width: 14, height: 14, color: "var(--faint)" } })}{label}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

function VendorCard({ v, onPick }) {
  const termsTone = v.netTerms === 0 ? "crit" : v.netTerms >= 60 ? "good" : "neutral";
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{v.lines.length} line{v.lines.length > 1 ? "s" : ""} · {v.leadMax}d max lead</div>
        </div>
        <P4 tone={termsTone}>{termsLabel(v.netTerms)}</P4>
      </div>
      <div style={{ display: "flex", gap: 18, margin: "13px 0 11px" }}>
        <div><div className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{uk4(v.value)}</div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>PO value</div></div>
        <div><div className="mono" style={{ fontSize: 19, fontWeight: 700, color: v.earliest <= 7 ? "var(--crit)" : "var(--ink)" }}>{shortDate(v.earliest)}</div><div style={{ fontSize: 10.5, color: "var(--muted)" }}>order by · {relLabel(v.earliest)}</div></div>
      </div>
      <div style={{ borderTop: "1px solid var(--hairline)", paddingTop: 9, display: "flex", flexDirection: "column", gap: 4 }}>
        {v.lines.map((l, i) => (
          <button key={i} onClick={() => onPick(l.parent.sku)} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, textAlign: "left", width: "100%", minHeight: 22 }}>
            <span className="dotmark" style={{ background: l.isIng ? ING4 : PKG4, flex: "none" }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>{l.name}</span>
            <span className="mono" style={{ color: "var(--faint)", flex: "none", whiteSpace: "nowrap" }}>{f4(l.orderQty)} {l.unit}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

window.VIEWS4 = { OrderPlanner };

/* ===================================================================== */
/* GANTT + SYNC + CASH                                                   */
/* ===================================================================== */
function GanttCard({ build, settings }) {
  const [mode, setMode] = uS4("synced");
  const [legSel, setLegSel] = uS4(null);
  const [compSel, setCompSel] = uS4(null);
  const plan = uM4(() => CS4(build, settings, mode), [build, settings, mode]);
  const synced = uM4(() => CS4(build, settings, "synced"), [build, settings]);

  const lo = Math.min(0, plan.earliestOrderOff ?? 0, ...plan.orderItems.map(i => i.payByOff)) - 6;
  const hi = Math.max(plan.needByOff, plan.readyOff, plan.customerOff, ...plan.orderItems.map(i => i.payByOff)) + 12;
  const span = Math.max(1, hi - lo);
  const xp = (off) => ((Math.max(lo, Math.min(hi, off)) - lo) / span) * 100;
  const wp = (a, b) => Math.max(1.6, xp(b) - xp(a));

  const ticks = [];
  for (let o = Math.ceil(lo / 7) * 7; o <= hi; o += 14) ticks.push(o);

  const ings = plan.orderItems.filter(i => i.isIng).length ? plan.items.filter(i => i.isIng) : plan.items.filter(i => i.isIng);
  const pkgs = plan.items.filter(i => !i.isIng);

  const Row = ({ item, color }) => {
    if (item.orderUnits === 0) {
      return (
        <div className="gtrack" onClick={() => setCompSel(item)} style={{ cursor: "pointer" }}>
          <div style={{ position: "absolute", left: xp(0) + "%", top: 7, display: "flex", alignItems: "center", gap: 6, color: "var(--muted)", fontSize: 11 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid var(--good)", display: "grid", placeItems: "center", color: "var(--good)", flex: "none" }}>{I4.check({ style: { width: 8, height: 8 } })}</span>
            in stock — covers {fk4(item.capacity)} units · no order needed
          </div>
        </div>
      );
    }
    const overdue = item.startOff < 0;
    const idle = item.idleDays > 0;
    const hasShip = item.shipLeadDays > 0 && item.prodLeadDays > 0;
    const prodEnd = hasShip ? item.startOff + item.prodLeadDays : item.endOff;
    return (
      <div className="gtrack">
        {/* idle waiting bar (naive) */}
        {idle && <div style={{ position: "absolute", top: 13, height: 8, left: xp(item.landOff) + "%", width: wp(item.landOff, item.consumeOff) + "%", background: "repeating-linear-gradient(90deg,#f0d9d9,#f0d9d9 4px,transparent 4px,transparent 8px)", borderRadius: 4 }} title="idle — waiting" />}
        {/* production segment */}
        <div className={"gbar" + (overdue ? " overdue" : "")} onClick={() => setCompSel(item)} style={{ left: xp(item.startOff) + "%", width: wp(item.startOff, prodEnd) + "%", background: color, cursor: "pointer", borderTopRightRadius: hasShip ? 0 : 5, borderBottomRightRadius: hasShip ? 0 : 5 }}>
          {item.origin.imported && <span style={{ fontSize: 8.5, fontWeight: 800, background: "rgba(255,255,255,.25)", borderRadius: 3, padding: "0 3px", marginRight: 4 }}>{cc(item.origin.country)}</span>}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.vendor} · {hasShip ? "make " + item.prodLeadDays + "d" : item.leadTimeDays + "d"}</span>
        </div>
        {/* shipment segment (Ocean/Air) */}
        {hasShip && (
          <div onClick={() => setCompSel(item)} title={item.shipMethod + " freight · " + item.shipLeadDays + "d"} style={{ position: "absolute", top: 7, height: 20, left: xp(prodEnd) + "%", width: wp(prodEnd, item.endOff) + "%", background: "repeating-linear-gradient(45deg," + color + "," + color + " 5px,rgba(255,255,255,.45) 5px,rgba(255,255,255,.45) 10px)", borderTopRightRadius: 5, borderBottomRightRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff" }}>
            {item.shipMethod === "Air" ? "✈" : "🚢"}
          </div>
        )}
        {/* arrival diamond */}
        <div style={{ position: "absolute", left: xp(item.landOff) + "%", top: 11, width: 12, height: 12, background: color, transform: "translateX(-50%) rotate(45deg)", border: "2px solid var(--surface)", borderRadius: 2, zIndex: 3 }} title={"lands " + shortDate(item.landOff)} />
      </div>
    );
  };
  const PhaseBar = ({ ph, label, color, onClick }) => (
    <div className="gtrack">
      <div className="gbar" onClick={onClick} style={{ left: xp(ph.startOff) + "%", width: wp(ph.startOff, ph.endOff) + "%", background: color || PROD4, cursor: onClick ? "pointer" : "default" }}>{label}</div>
    </div>
  );

  const cashTone = plan.cashGap >= 0 ? "good" : "crit";

  return (
    <>
    <div className="card">
      <div className="card-pad" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{build.name}</h3>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 3 }}>Target build {fk4(plan.targetBuild)} units · {plan.orderItems.length} POs · {uk4(plan.totalValue)}</div>
        </div>
        <div className="seg">
          <button className={mode === "synced" ? "on" : ""} onClick={() => setMode("synced")}>Synced (JIT)</button>
          <button className={mode === "naive" ? "on" : ""} onClick={() => setMode("naive")}>Order all today</button>
        </div>
      </div>

      {/* sync + cash metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, background: "var(--hairline)", borderBottom: "1px solid var(--hairline)" }}>
        <SyncMetric label="Sellable at 3PL" value={shortDate(plan.readyOff)} sub={relLabel(plan.readyOff)} />
        <SyncMetric label="Arrival spread" value={plan.arrivalSpread + "d"} sub={mode === "synced" ? "tight — lands JIT" : "scattered"} tone={plan.arrivalSpread <= synced.arrivalSpread ? "var(--good)" : "var(--crit)"} />
        <SyncMetric label="Idle material-days" value={f4(plan.idleDays)} sub={plan.idleDays === 0 ? "nothing waiting — ideal" : "cash sitting in WIP"} tone={plan.idleDays === 0 ? "var(--good)" : "var(--crit)"} />
        <SyncMetric label="Cash gap vs revenue" value={(plan.cashGap >= 0 ? "+" : "") + plan.cashGap + "d"} sub={plan.cashGap >= 0 ? "sell before invoice due" : "pay before you earn"} tone={cashTone === "good" ? "var(--good)" : "var(--crit)"} />
      </div>

      <div className="card-pad">
        {/* axis */}
        <div style={{ display: "grid", gridTemplateColumns: "210px 1fr" }}>
          <div />
          <div style={{ position: "relative", height: 18 }}>
            {ticks.filter(o => Math.abs(xp(o) - xp(plan.needByOff)) > 6).map(o => <span key={o} className="mono" style={{ position: "absolute", left: xp(o) + "%", transform: "translateX(-50%)", fontSize: 10, color: "var(--faint)" }}>{shortDate(o)}</span>)}
          </div>
        </div>

        <div className="gantt" style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 210, right: 0, top: 0, bottom: 0, pointerEvents: "none" }}>
            {/* production landing zone */}
            <div style={{ position: "absolute", left: xp(plan.phases.compound.startOff) + "%", width: wp(plan.phases.compound.startOff, plan.phases.fill.endOff) + "%", top: 0, bottom: 0, background: "rgba(138,45,90,.05)", borderLeft: "1px dashed rgba(138,45,90,.4)", borderRight: "1px dashed rgba(138,45,90,.4)" }}>
              <span style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--accent)", whiteSpace: "nowrap" }}>BUILD WINDOW</span>
            </div>
            {ticks.map(o => <div key={o} style={{ position: "absolute", left: xp(o) + "%", top: 0, bottom: 0, width: 1, background: "var(--hairline)" }} />)}
            <div style={{ position: "absolute", left: xp(0) + "%", top: -2, bottom: 0, width: 2, background: "var(--ink)", zIndex: 4 }}><span style={{ position: "absolute", top: -15, left: 3, fontSize: 10, fontWeight: 700, color: "var(--ink)" }}>TODAY</span></div>
            <div style={{ position: "absolute", left: xp(plan.needByOff) + "%", top: -2, bottom: 0, width: 0, borderLeft: "2px dashed var(--crit)", zIndex: 4 }}><span style={{ position: "absolute", top: -15, left: 4, fontSize: 10, fontWeight: 700, color: "var(--crit)", whiteSpace: "nowrap" }}>STOCK-OUT</span></div>
          </div>

          <div style={{ position: "relative", paddingTop: 8 }}>
            <div className="gphase-label">① Procure ingredients <span style={{ color: ING4 }}>◆</span> diamond = lands · <span style={{ color: "var(--faint)", fontWeight: 600 }}>HTS + origin shown per row · click for full customs</span></div>
            {ings.map((it, i) => <div className="grow" key={"i" + i} onClick={() => setCompSel(it)}><MatLabel item={it} color={ING4} /><Row item={it} color={ING4} /></div>)}
            <div className="gphase-label">② Compound &amp; QC</div>
            <div className="grow"><div className="glabel"><span className="dotmark" style={{ background: PROD4 }} /><span className="truncate">Bulk compounding</span></div><PhaseBar ph={plan.phases.compound} label="compound + QC" /></div>
            <div className="gphase-label">③ Procure packaging <span style={{ color: PKG4 }}>◆</span></div>
            {pkgs.map((it, i) => <div className="grow" key={"p" + i} onClick={() => setCompSel(it)}><MatLabel item={it} color={PKG4} /><Row item={it} color={PKG4} /></div>)}
            <div className="gphase-label">④ Fill, assemble &amp; release</div>
            <div className="grow"><div className="glabel"><span className="dotmark" style={{ background: PROD4 }} /><span className="truncate">Fill &amp; assembly</span></div><PhaseBar ph={plan.phases.fill} label="fill + release" /></div>
            <div className="gphase-label" style={{ color: "var(--warn)" }}>⑤ Awaiting micro — PET / micro QC hold</div>
            <div className="grow"><div className="glabel"><span className="dotmark" style={{ background: "var(--warn)" }} /><span className="truncate">Awaiting micro ({plan.phases.micro.days}d)</span></div><PhaseBar ph={plan.phases.micro} label="micro hold" color="var(--warn)" /></div>

            {/* logistics lane */}
            <div className="gphase-label" style={{ color: LOG4 }}>⑥ Logistics — plant → 3PL (Deposco / UFSI) → customer · <span style={{ color: "var(--faint)", fontWeight: 600 }}>click a leg for detail</span></div>
            <div className="grow"><LogLabel name="Inbound freight → 3PL" carrier={plan.logistics.freight.carrier} onClick={() => setLegSel(plan.logistics.freight)} /><PhaseBar ph={plan.logistics.freight} label="freight" color={LOG4} onClick={() => setLegSel(plan.logistics.freight)} /></div>
            <div className="grow">
              <LogLabel name="3PL receive · scan lot" carrier={plan.logistics.receive.carrier} onClick={() => setLegSel(plan.logistics.receive)} />
              <div className="gtrack">
                <div className="gbar" onClick={() => setLegSel(plan.logistics.receive)} style={{ left: xp(plan.logistics.receive.startOff) + "%", width: wp(plan.logistics.receive.startOff, plan.logistics.receive.endOff) + "%", background: LOG4, cursor: "pointer" }}>receive + lot</div>
                <div style={{ position: "absolute", left: xp(plan.availOff) + "%", top: 0, bottom: 0, width: 0, borderLeft: "2px solid var(--good)", zIndex: 4 }}><span style={{ position: "absolute", top: -14, left: 4, fontSize: 9.5, fontWeight: 700, color: "var(--good)", whiteSpace: "nowrap" }}>SELLABLE @ 3PL</span></div>
              </div>
            </div>
            <div className="grow">
              <LogLabel name="Outbound → customer" carrier={plan.logistics.lastmile.carrier} onClick={() => setLegSel(plan.logistics.lastmile)} />
              <div className="gtrack">
                <div className="gbar" onClick={() => setLegSel(plan.logistics.lastmile)} style={{ left: xp(plan.logistics.lastmile.startOff) + "%", width: wp(plan.logistics.lastmile.startOff, plan.logistics.lastmile.endOff) + "%", background: LOG4, opacity: .82, cursor: "pointer" }}>last mile</div>
                <span style={{ position: "absolute", left: xp(plan.customerOff) + "%", top: -14, transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 700, color: LOG4, whiteSpace: "nowrap" }}>LOT @ CUSTOMER</span>
                <div style={{ position: "absolute", left: xp(plan.customerOff) + "%", top: 8, transform: "translateX(-50%)", zIndex: 5 }} title={"lot delivered " + shortDate(plan.customerOff)}>
                  <div style={{ width: 17, height: 17, borderRadius: "50%", background: LOG4, border: "2px solid var(--surface)", display: "grid", placeItems: "center", color: "#fff" }}>{I4.check({ style: { width: 9, height: 9 } })}</div>
                </div>
              </div>
            </div>

            {/* cash lane */}
            <div className="gphase-label" style={{ color: "var(--cap)" }}>⑦ Cash — supplier invoices (net terms) vs revenue</div>
            <div className="grow">
              <div className="glabel"><span className="dotmark" style={{ background: "var(--cap)" }} /><span className="truncate">Payments due / revenue</span></div>
              <div className="gtrack" style={{ height: 30 }}>
                {plan.orderItems.map((it, i) => (
                  <div key={i} style={{ position: "absolute", left: xp(it.payByOff) + "%", top: 6, transform: "translateX(-50%)", zIndex: 3 }} title={it.vendor + " invoice " + shortDate(it.payByOff)}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: it.netTerms === 0 ? "var(--crit)" : "var(--cap)", border: "2px solid var(--surface)", display: "grid", placeItems: "center", color: "#fff", fontSize: 8.5, fontWeight: 700 }}>$</div>
                  </div>
                ))}
                {/* revenue begins */}
                <div style={{ position: "absolute", left: xp(plan.readyOff) + "%", top: 2, bottom: 2, width: 0, borderLeft: "2px solid var(--good)", zIndex: 4 }}>
                  <span style={{ position: "absolute", top: 16, left: 4, fontSize: 9.5, fontWeight: 700, color: "var(--good)", whiteSpace: "nowrap" }}>REVENUE →</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="eyebrow" style={{ color: LOG4 }}>Who's shipping — logistics legs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 9 }}>
            <LegCard leg={plan.logistics.freight} label="① Inbound freight" onClick={() => setLegSel(plan.logistics.freight)} />
            <LegCard leg={plan.logistics.receive} label="② 3PL receive" onClick={() => setLegSel(plan.logistics.receive)} />
            <LegCard leg={plan.logistics.lastmile} label="③ Outbound to customer" onClick={() => setLegSel(plan.logistics.lastmile)} />
          </div>
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 9 }}>Total landed logistics ≈ <strong className="mono">{uk4(plan.logisticsCost)}</strong> for {fk4(plan.targetBuild)} units · carriers and rates are placeholder.</div>
          {plan.importedItems.length > 0 && (
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 4 }}>Imports: <strong>{plan.importedItems.length}</strong> component{plan.importedItems.length > 1 ? "s" : ""} ({[...new Set(plan.importedItems.map(i => i.origin.country))].join(", ")}) · est. duty <strong className="mono">{uk4(plan.dutyTotal)}</strong> incl. Section 301 · click a material bar for its HTS code.</div>
          )}
        </div>

        <div className="legend" style={{ marginTop: 16 }}>
          <span><span className="dotmark" style={{ background: ING4 }} />Ingredient PO</span>
          <span><span className="dotmark" style={{ background: PKG4 }} />Packaging PO</span>
          <span><span style={{ width: 14, height: 9, display: "inline-block", background: "repeating-linear-gradient(45deg,#3f51b5,#3f51b5 4px,rgba(255,255,255,.5) 4px,rgba(255,255,255,.5) 8px)", borderRadius: 2 }} />Ocean/Air freight</span>
          <span><span className="dotmark" style={{ background: PROD4 }} />Production</span>
          <span><span className="dotmark" style={{ background: LOG4 }} />Logistics · 3PL</span>
          <span><span style={{ width: 11, height: 11, background: "var(--faint)", display: "inline-block", transform: "rotate(45deg)", borderRadius: 2 }} />Material lands</span>
          <span><span style={{ width: 12, height: 12, borderRadius: "50%", background: "var(--cap)", display: "inline-block" }} />Invoice due</span>
          <span><span style={{ width: 14, borderTop: "2px solid var(--good)", display: "inline-block" }} />Sellable / revenue</span>
        </div>
      </div>
    </div>
    {legSel && <LogisticsDrawer leg={legSel} onClose={() => setLegSel(null)} />}
    {compSel && <ComponentDrawer item={compSel} onClose={() => setCompSel(null)} />}
    </>
  );
}
function SyncMetric({ label, value, sub, tone }) {
  return (
    <div style={{ background: "var(--surface)", padding: "12px 16px" }}>
      <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".03em", textTransform: "uppercase" }}>{label}</div>
      <div className="mono" style={{ fontSize: 19, fontWeight: 700, marginTop: 4, color: tone || "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
const LogLabel = ({ name, carrier, onClick }) => (
  <div className="glabel" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
    <span className="dotmark" style={{ background: LOG4, flex: "none" }} />
    <span style={{ minWidth: 0 }}>
      <span className="truncate" style={{ display: "block" }}>{name}</span>
      <span style={{ display: "block", fontSize: 10, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{carrier}</span>
    </span>
  </div>
);
function LegCard({ leg, label, onClick }) {
  return (
    <button onClick={onClick} style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "11px 13px", background: "var(--surface-2)", textAlign: "left", width: "100%", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, letterSpacing: ".03em", textTransform: "uppercase", color: LOG4, fontWeight: 700 }}>{label}</span>
        <span className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{leg.days}d</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>{leg.carrier} {I4.arrowR({ style: { width: 13, height: 13, color: "var(--faint)" } })}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>{leg.mode} · {leg.service}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>est. {usd4(leg.cost)} <span style={{ color: "var(--faint)" }}>(${leg.cpu.toFixed(2)}/unit)</span></div>
    </button>
  );
}
function LogisticsDrawer({ leg, onClose }) {
  const rows = [
    ["Carrier / operator", leg.carrier], ["SCAC", leg.scac], ["Mode", leg.mode], ["Route", leg.lane],
    ["Equipment", leg.equipment], ["Incoterms", leg.incoterms], ["Transit SLA", leg.sla],
    ["Accessorials", leg.accessorials], ["Booking contact", leg.contact],
  ];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="slideover">
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="dotmark" style={{ background: LOG4, width: 9, height: 9 }} /><span style={{ fontSize: 12, color: "var(--muted)" }}>{leg.name}</span></div>
            <h2 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>{leg.carrier}</h2>
            <div style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" }}>
              <span className="pill" style={{ background: "#e2f0f2", color: LOG4 }}>{leg.mode}</span>
              <P4 tone="neutral">{leg.days}-day transit</P4>
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I4.x({})}</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <DMetric label="Depart" value={shortDate(leg.startOff)} />
            <DMetric label="Arrive" value={shortDate(leg.endOff)} />
            <DMetric label="Est. cost" value={usd4(leg.cost)} />
            <DMetric label="Cost / unit" value={"$" + leg.cpu.toFixed(2)} />
            <DMetric label="Units" value={f4(leg.units)} />
            <DMetric label="Cartons / pallets" value={f4(leg.cartons) + " / " + f4(leg.pallets)} />
          </div>
          <div style={{ marginTop: 20, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {rows.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 14px", borderBottom: i < rows.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5 }}>
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {leg.key === "freight" && "Inbound move from the fill site to the Deposco DC. Booked FCA origin; the finished lot travels under one BOL and is reconciled against the ASN on arrival."}
            {leg.key === "receive" && "Deposco / UFSI receives against the ASN, scans the lot & expiry into WMS, runs any QC hold, and putaway makes the SKU sellable — this is when Total Available Inventory updates."}
            {leg.key === "lastmile" && "Parcel fulfillment from the DC to the end customer. Rate varies by zone and dim-weight; the lot number on the carton ties the delivered unit back to its production batch."}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>Carrier, rates and SLAs are placeholder — awaiting the carrier master / Deposco feed.</div>
        </div>
      </div>
    </>
  );
}
function DMetric({ label, value }) {
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>{label}</div>
      <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 3 }}>{value}</div>
    </div>
  );
}
const cc = (country) => ({ "China": "CN", "Switzerland": "CH", "United States": "US" }[country] || country.slice(0, 2).toUpperCase());

// Material row label for the Gantt — name + HTS code + country of origin, shown for every component.
const MatLabel = ({ item, color }) => (
  <div className="glabel" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, justifyContent: "center", cursor: "pointer" }}>
    <span style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", minWidth: 0 }}>
      <span className="dotmark" style={{ background: color, flex: "none" }} />
      <span className="truncate">{item.name}</span>
    </span>
    <span style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 16, minWidth: 0 }}>
      <span className="mono" style={{ fontSize: 9.5, color: "var(--faint)", whiteSpace: "nowrap" }}>HTS {item.hts.code}</span>
      <span className="mono" title={item.origin.country + (item.origin.imported ? " · imported" : " · domestic")} style={{ fontSize: 8.5, fontWeight: 800, padding: "0 4px", borderRadius: 3, flex: "none", background: item.origin.imported ? "#fbeee6" : "var(--good-tint)", color: item.origin.imported ? "#9a5418" : "var(--good)" }}>{cc(item.origin.country)}</span>
    </span>
  </div>
);
function ComponentDrawer({ item, onClose }) {
  const imp = item.origin.imported;
  const customs = [
    ["HTS code", item.hts.code], ["Classification", item.hts.desc],
    ["Country of origin", item.origin.country], ["Base duty rate", item.hts.duty + "%"],
    ["Section 301", item.section301 ? item.section301 + "% (China)" : "—"],
    ["Total duty rate", item.dutyRate + "%"], ["Est. duty", usd4(item.dutyCost)],
    ["Freight mode", imp ? item.origin.mode : "Domestic ground"],
    ["Port of entry", imp ? item.origin.port : "—"], ["Customs broker", imp ? item.origin.broker : "—"],
  ];
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="slideover">
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--hairline)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="dotmark" style={{ background: item.isIng ? ING4 : PKG4, width: 9, height: 9 }} /><span style={{ fontSize: 12, color: "var(--muted)" }}>{item.isIng ? "Ingredient" : "Packaging component"}</span></div>
            <h2 style={{ margin: "6px 0 0", fontSize: 18, fontWeight: 700, letterSpacing: "-.01em", lineHeight: 1.25 }}>{item.name}</h2>
            <div style={{ marginTop: 9, display: "flex", gap: 7, flexWrap: "wrap" }}>
              <P4 tone="neutral">{item.vendor}</P4>
              {imp ? <span className="pill" style={{ background: "#fbeee6", color: "#9a5418" }}>Imported · {item.origin.country}</span> : <P4 tone="good">Domestic</P4>}
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ padding: 8 }}>{I4.x({})}</button>
        </div>
        <div style={{ padding: 24, overflowY: "auto", flex: 1, minHeight: 0 }}>
          <div className="eyebrow">Purchase order</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 9 }}>
            <DMetric label="Order qty" value={f4(item.orderQty) + " " + item.unit} />
            <DMetric label="Order value" value={usd4(item.value)} />
            <DMetric label="Production lead" value={item.prodLeadDays ? item.prodLeadDays + " days" : "—"} />
            <DMetric label={"Shipment (" + (item.shipMethod || "—") + ")"} value={item.shipLeadDays ? item.shipLeadDays + " days" : "—"} />
            <DMetric label="Total lead time" value={item.leadTimeDays + " days"} />
            <DMetric label="Net terms" value={item.netTerms === 0 ? "Prepay" : "Net " + item.netTerms} />
            {item.moq ? <DMetric label="MOQ" value={f4(item.moq) + " " + item.unit} /> : null}
            {item.realUnitPrice != null ? <DMetric label="Unit price" value={"$" + item.realUnitPrice.toFixed(3)} /> : null}
          </div>
          <div className="eyebrow" style={{ marginTop: 20 }}>Import &amp; customs</div>
          <div style={{ marginTop: 9, border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            {customs.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "10px 14px", borderBottom: i < customs.length - 1 ? "1px solid var(--hairline)" : "none", fontSize: 12.5, background: (k === "Total duty rate" || k === "Est. duty") ? "var(--surface-2)" : "transparent" }}>
                <span style={{ color: "var(--muted)" }}>{k}</span>
                <span className={/code|duty|301|rate/i.test(k) ? "mono" : ""} style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 10, background: "var(--surface-2)", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {imp
              ? `Imported from ${item.origin.country} via ${item.origin.mode}, clearing customs at ${item.origin.port}. Landed cost must include the ${item.dutyRate}% duty${item.section301 ? " (incl. Section 301)" : ""} plus MPF/HMF and brokerage — fold these into the unit cost before the match-rate and cash math.`
              : `Domestic-sourced — no import duty or customs clearance. HTS ${item.hts.code} shown for catalog consistency.`}
          </div>
          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>HTS codes, duty rates and origins are placeholder — confirm against a licensed customs broker before filing.</div>
        </div>
      </div>
    </>
  );
}
