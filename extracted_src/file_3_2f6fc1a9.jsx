/* global React, LIB */
const { fmt:f2, fmtK:fk2, usd:usd2, usdK:uk2, fmtDate:fd2, Ic:I2, Pill:P2, CoverPill:CP2, useState:uS2, useMemo:uM2, componentVendorInfo:CVI2 } = LIB;
const INGc = "#2f7d52", PKGc = "#3f51b5";

/* ===================================================================== */
/* MATCH-RATE PREDICTOR (the star)                                       */
/* ===================================================================== */
function Predictor({ data }) {
  const builds = uM2(() => [...data.builds].sort((a, b) => a.matchRate - b.matchRate), [data]);
  const balanced = builds.filter(b => b.matchRate >= 0.85).length;
  const constrained = builds.length - balanced;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 22, background: "var(--surface-2)" }}>
        <div className="card-pad" style={{ display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 300px" }}>
            <div className="eyebrow">How to read this</div>
            <p style={{ fontSize: 14, lineHeight: 1.55, margin: "8px 0 0", maxWidth: 540 }}>
              For every finished good, we compute how many sellable units the <strong style={{ color: INGc }}>ingredients</strong> can support versus the <strong style={{ color: PKGc }}>packaging</strong> components. <strong>You can only build the smaller of the two.</strong> A low match rate means capital is stranded on one side — hold those POs and unblock the constraint instead.
            </p>
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            <Stat2 big={balanced} label="Balanced (≥85%)" tone="var(--good)" />
            <Stat2 big={constrained} label="Constrained" tone="var(--crit)" />
            <Stat2 big={uk2(data.strandedCapital)} label="Stranded ingredient $" tone="var(--cap)" mono />
          </div>
        </div>
      </div>

      <div className="legend" style={{ marginBottom: 16 }}>
        <span><span className="dotmark" style={{ background: INGc }} />Ingredient capacity</span>
        <span><span className="dotmark" style={{ background: PKGc }} />Packaging capacity</span>
        <span><span style={{ width: 14, borderTop: "2px dashed var(--ink)", display: "inline-block" }} />60-day demand</span>
        <span><span className="dotmark" style={{ background: "var(--crit)" }} />Bottleneck component</span>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        {builds.map((b) => <MatchCard key={b.sku} b={b} />)}
      </div>
    </div>
  );
}

function Stat2({ big, label, tone, mono }) {
  return (
    <div>
      <div className={mono ? "mono" : ""} style={{ fontSize: 27, fontWeight: 700, color: tone, lineHeight: 1, letterSpacing: "-.02em" }}>{big}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function MatchCard({ b }) {
  const [open, setOpen] = uS2(false);
  const rate = Math.round(b.matchRate * 100);
  const tone = b.matchRate >= 0.85 ? "good" : b.matchRate >= 0.5 ? "warn" : "crit";
  const toneC = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--crit)";
  const scaleMax = Math.max(b.ingCeil === Infinity ? 0 : b.ingCeil, b.pkgCeil === Infinity ? 0 : b.pkgCeil, b.demand60) * 1.08;
  const pct = (v) => Math.max(1.5, Math.min(100, (v / scaleMax) * 100));
  const demandPct = Math.min(100, (b.demand60 / scaleMax) * 100);
  const covTone = b.demandCover >= 1.5 ? "good" : b.demandCover >= 1 ? "warn" : "crit";

  return (
    <div className="match-card">
      <div className="mc-head">
        <div style={{ width: 5, alignSelf: "stretch", borderRadius: 4, background: toneC, flex: "none" }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 700, letterSpacing: "-.01em" }}>{b.name}</h3>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--muted)" }}>{b.sku}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
            {b.limitSide === "balanced"
              ? "Ingredients and packaging are matched."
              : <>Limited by <strong style={{ color: toneC }}>{b.limitSide}</strong> — {b.bottleneck.name} ({f2(b.bottleneck.capacity)} units, {b.bottleneck.leadTimeDays}-day lead).</>}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: toneC, lineHeight: 1 }}>{rate}%</div>
          <div style={{ fontSize: 10.5, color: "var(--muted)", letterSpacing: ".05em", marginTop: 3 }}>MATCH RATE</div>
        </div>
      </div>

      {/* Opposed capacity bars */}
      <div style={{ padding: "4px 20px 16px" }}>
        <div style={{ position: "relative" }}>
          {/* demand marker */}
          {b.demand60 > 0 && demandPct < 100 && (
            <div style={{ position: "absolute", left: `calc(${demandPct}% )`, top: -2, bottom: 6, width: 0, borderLeft: "2px dashed var(--ink)", zIndex: 2 }}>
              <span style={{ position: "absolute", top: -16, left: 4, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", color: "var(--ink)" }}>demand {fk2(b.demand60)}</span>
            </div>
          )}
          <CapBar label="Ingredients support" value={b.ingCeil} pct={pct(b.ingCeil)} color={INGc} tint="#e6f2ea" />
          <CapBar label="Packaging supports" value={b.pkgCeil} pct={pct(b.pkgCeil)} color={PKGc} tint="#eaecf8" />
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span className="mono" style={{ fontSize: 19, fontWeight: 700 }}>{f2(b.buildable)}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>buildable now</span>
          </div>
          <span style={{ color: "var(--border)" }}>+</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{f2(b.finishedOnHand)}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>finished in 3PL</span>
          </div>
          <span style={{ color: "var(--border)" }}>=</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{f2(b.totalAvail)}</span>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>sellable vs {fk2(b.demand60)} demand</span>
          </div>
          <span className={"pill " + covTone} style={{ marginLeft: "auto" }}>{b.demandCover === Infinity ? "—" : b.demandCover.toFixed(1) + "× cover"}</span>
        </div>

        {/* Recommendation */}
        {b.limitSide !== "balanced" && (
          <div style={{ marginTop: 14, padding: "11px 14px", borderRadius: 9, background: tone === "crit" ? "var(--crit-tint)" : "var(--warn-tint)", display: "flex", gap: 10, alignItems: "flex-start" }}>
            {I2.alert({ style: { width: 16, height: 16, color: toneC, marginTop: 1, flex: "none" } })}
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              {b.limitSide === "packaging"
                ? <>Ingredients can build <strong>{fk2(b.ingCeil)}</strong> but packaging caps you at <strong>{fk2(b.pkgCeil)}</strong>. <strong>Hold ingredient POs</strong> and order ~{fk2(b.stranded)} more {b.bottleneck.name.toLowerCase()} to unlock the gap.</>
                : <>Packaging is ready for <strong>{fk2(b.pkgCeil)}</strong> but ingredients only support <strong>{fk2(b.ingCeil)}</strong>. Compound more {b.bottleneck.name.toLowerCase()} before it strands finished packaging.</>}
            </div>
          </div>
        )}

        <button className="tag" style={{ marginTop: 12 }} onClick={() => setOpen(!open)}>
          {open ? "Hide" : "Show"} all {b.comps.length} components {I2.down({ style: { width: 13, height: 13, transform: open ? "rotate(180deg)" : "none", transition: ".15s" } })}
        </button>

        {open && (
          <div className="ladder" style={{ marginTop: 12 }}>
            {[...b.comps].sort((a, c) => a.capacity - c.capacity).map((c, i) => {
              const isLim = c.name === b.bottleneck.name;
              const col = c.type === "ingredient" ? INGc : PKGc;
              const ohCap = c.onHandCapacity || 0;
              const resvW = ohCap > 0 ? (c.reservedUnits / ohCap) * 100 : 0;
              const availW = ohCap > 0 ? (c.capacity / ohCap) * 100 : 0;
              return (
                <div key={i} style={{ border: "1px solid var(--hairline)", borderRadius: 8, padding: "10px 12px", borderLeft: isLim ? "3px solid var(--crit)" : "1px solid var(--hairline)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                    <span className="dotmark" style={{ background: col }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</span>
                    {isLim && <span className="pill crit" style={{ fontSize: 9.5, padding: "0 6px" }}>LIMIT</span>}
                    <span style={{ fontSize: 10.5, color: "var(--faint)", marginLeft: "auto" }}>{c.leadTimeDays}d lead</span>
                  </div>
                  {/* vendor line */}
                  {(() => { const v = CVI2(c); return (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
                      {I2.channels({ style: { width: 12, height: 12, color: "var(--faint)", flex: "none" } })}
                      <strong style={{ color: "var(--ink)" }}>{v.vendor}</strong>
                      {v.imported && <span className="pill" style={{ background: "#fbeee6", color: "#9a5418", fontSize: 9.5, padding: "0 6px" }}>{v.country}</span>}
                      {c.shipMethod && <span className="pill" style={{ background: "var(--cap-tint)", color: "var(--cap)", fontSize: 9.5, padding: "0 6px" }}>{c.shipMethod}</span>}
                      <span style={{ color: "var(--faint)" }}>· {v.terms === 0 ? "Prepay" : "Net " + v.terms}</span>
                      {c.shipLeadDays > 0 ? <span style={{ color: "var(--faint)" }}>· make {c.prodLeadDays}d + ship {c.shipLeadDays}d</span> : <span style={{ color: "var(--faint)" }}>· {c.leadTimeDays}d lead</span>}
                      {c.moq ? <span style={{ color: "var(--faint)" }}>· MOQ {fk2(c.moq)}</span> : null}
                    </div>
                  ); })()}
                  {/* stacked on-hand bar: available (free) + reserved */}
                  <div style={{ display: "flex", height: 16, borderRadius: 5, overflow: "hidden", background: "var(--surface-2)", border: "1px solid var(--hairline)" }}>
                    <div style={{ width: availW + "%", background: isLim ? "var(--crit)" : col }} title={"Available: " + fk2(c.capacity) + " units"} />
                    <div style={{ width: resvW + "%", background: "repeating-linear-gradient(45deg,#cbb8c4,#cbb8c4 3px,#ded3da 3px,#ded3da 6px)" }} title={"Reserved: " + fk2(c.reservedUnits) + " units"} />
                  </div>
                  {/* numbers */}
                  <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, flexWrap: "wrap" }}>
                    <span style={{ color: "var(--muted)" }}>On hand <strong className="mono" style={{ color: "var(--ink)" }}>{f2(c.onHand)}{c.unit !== "ea" ? c.unit : ""}</strong> <span style={{ color: "var(--faint)" }}>({fk2(ohCap)} u)</span></span>
                    <span style={{ color: "var(--muted)" }}>Reserved <strong className="mono" style={{ color: "#9a5478" }}>{f2(c.reserved)}{c.unit !== "ea" ? c.unit : ""}</strong> <span style={{ color: "var(--faint)" }}>({fk2(c.reservedUnits)} u)</span></span>
                    <span style={{ color: "var(--muted)" }}>Free to build <strong className="mono" style={{ color: isLim ? "var(--crit)" : "var(--good)" }}>{fk2(c.capacity)} u</strong></span>
                  </div>
                  {/* incoming PO */}
                  {c.incoming > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 7, fontSize: 11, color: "var(--cap)" }}>
                      {I2.recon({ style: { width: 12, height: 12 } })}
                      <span><strong className="mono">+{f2(c.incoming)}{c.unit !== "ea" ? c.unit : ""}</strong> on {c.incomingPO} → unlocks {fk2(c.withIncomingCapacity)} u · ETA {fd2(c.incomingEta)}</span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 7, fontSize: 11, color: "var(--faint)" }}>No open PO</div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 10.5, color: "var(--faint)", marginTop: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 8, background: "var(--good)", borderRadius: 2, display: "inline-block" }} />Free to build</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 12, height: 8, background: "repeating-linear-gradient(45deg,#cbb8c4,#cbb8c4 3px,#ded3da 3px,#ded3da 6px)", borderRadius: 2, display: "inline-block" }} />Reserved to open orders</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>Capacity reflects free (unreserved) stock. On-hand, reserved &amp; incoming-PO quantities are placeholder — awaiting the BOM + raw-material feed.</div>
          </div>
        )}
      </div>
    </div>
  );
}
function CapBar({ label, value, pct, color, tint }) {
  return (
    <div style={{ margin: "7px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 4 }}>
        <span style={{ color: "var(--muted)" }}>{label}</span>
        <span className="mono" style={{ fontWeight: 600, color }}>{value === Infinity ? "—" : f2(value)} units</span>
      </div>
      <div style={{ height: 14, borderRadius: 5, background: tint, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 5, transition: "width .4s" }} />
      </div>
    </div>
  );
}

window.VIEWS2 = { Predictor };
