/* global React */
const { useState, useMemo, useEffect, useRef } = React;

/* ============ Formatters ============ */
const fmt = (n) => (n == null || isNaN(n)) ? "—" : Math.round(n).toLocaleString("en-US");
const fmtK = (n) => {
  if (n == null || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(Math.abs(n) >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(n));
};
const usd = (n) => n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US");
const usdK = (n) => {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(0) + "k";
  return "$" + Math.round(n);
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const daysUntil = (iso) => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return null;
  return Math.round((d - new Date("2026-06-02T00:00:00")) / 86400000);
};

/* ============ Thresholds ============ */
const COVER = { crit: 30, warn: 60, over: 365 }; // days of cover bands
const EXP_SOON = 180; // expiring within ~6mo

function coverBand(doc) {
  if (doc == null) return "none";       // no sales velocity
  if (doc === 0) return "stockout";
  if (doc <= COVER.crit) return "crit";
  if (doc <= COVER.warn) return "warn";
  if (doc >= COVER.over) return "over";
  return "good";
}

/* ============ Predictor math ============ */
function computeBuild(prod) {
  const comps = prod.components.map((c) => {
    const reserved = c.reserved || 0;
    const available = Math.max(0, c.onHand - reserved);
    const incoming = c.incoming || 0;
    return {
      ...c, reserved, available, incoming,
      capacity: Math.floor(available / c.perUnit),                 // buildable NOW from free stock
      onHandCapacity: Math.floor(c.onHand / c.perUnit),            // ignoring reservations
      reservedUnits: Math.floor(reserved / c.perUnit),
      incomingUnits: Math.floor(incoming / c.perUnit),
      withIncomingCapacity: Math.floor((available + incoming) / c.perUnit),
    };
  });
  const ing = comps.filter((c) => c.type === "ingredient");
  const pkg = comps.filter((c) => c.type === "packaging");
  const ingCeil = ing.length ? Math.min(...ing.map((c) => c.capacity)) : Infinity;
  const pkgCeil = pkg.length ? Math.min(...pkg.map((c) => c.capacity)) : Infinity;
  const buildable = Math.min(ingCeil, pkgCeil);
  // capacity if open POs land (available + incoming)
  const ingCeilInc = ing.length ? Math.min(...ing.map((c) => c.withIncomingCapacity)) : Infinity;
  const pkgCeilInc = pkg.length ? Math.min(...pkg.map((c) => c.withIncomingCapacity)) : Infinity;
  const buildableWithIncoming = Math.min(ingCeilInc, pkgCeilInc);
  const bottleneck = comps.reduce((a, b) => (b.capacity < a.capacity ? b : a), comps[0]);
  const limitSide = pkgCeil < ingCeil ? "packaging" : (ingCeil < pkgCeil ? "ingredient" : "balanced");
  const lo = Math.min(ingCeil, pkgCeil), hi = Math.max(ingCeil, pkgCeil);
  const matchRate = hi > 0 ? lo / hi : 1;
  // capital stranded: units of the abundant side that can't be completed, valued at a nominal blended cost
  const stranded = Math.max(0, hi - lo);
  const totalAvail = buildable + (prod.finishedOnHand || 0);
  const demandCover = prod.demand60 > 0 ? totalAvail / prod.demand60 : Infinity;
  return { comps, ing, pkg, ingCeil, pkgCeil, buildable, buildableWithIncoming, bottleneck, limitSide, matchRate, stranded, totalAvail, demandCover };
}

/* ============ Real BOM lead-time enrichment ============ */
function bomCatKey(name) {
  const n = (name || "").toLowerCase();
  if (/pump|airless|dropper/.test(n)) return "pump";
  if (/jar/.test(n)) return "jar";
  if (/bottle|barrel/.test(n)) return "bottle";
  if (/tube/.test(n)) return "tube";
  if (/lid|cap|overcap|wiper|brush/.test(n)) return "cap";
  if (/shrink/.test(n)) return "shrink band";
  if (/label/.test(n)) return "label";
  if (/carton|box|\bob\b/.test(n)) return "ob";
  return "ob";
}
let _bomEnriched = false;
function enrichBom() {
  if (_bomEnriched || !window.INV_REALBOM || !window.INV_BOM) return;
  _bomEnriched = true;
  const RB = window.INV_REALBOM, lead = RB.leadByCategory || {};
  (window.INV_BOM.products || []).forEach((p) => {
    const real = RB.bySku[p.sku];
    p.components.forEach((c) => {
      if (c.type === "ingredient") { c.shipMethod = null; c.prodLeadDays = c.leadTimeDays; c.shipLeadDays = 0; return; }
      const key = bomCatKey(c.name);
      let rc = null;
      if (real) rc = real.components.find((x) => bomCatKey((x.type || "") + " " + (x.desc || "")) === key);
      const L = lead[key] || lead["ob"] || { prodWk: 4, shipWk: 5, method: "Ocean" };
      const prodWk = rc && rc.prodLeadWk != null ? rc.prodLeadWk : L.prodWk;
      const shipWk = rc && rc.shipLeadWk != null ? rc.shipLeadWk : L.shipWk;
      c.prodLeadDays = Math.round((prodWk || 4) * 7);
      c.shipLeadDays = Math.round((shipWk || 5) * 7);
      c.shipMethod = rc && rc.shipMethod ? rc.shipMethod : L.method;
      c.leadTimeDays = c.prodLeadDays + c.shipLeadDays;
      if (rc) {
        if (rc.moq) c.moq = rc.moq;
        if (rc.unitPrice != null) c.realUnitPrice = rc.unitPrice;
        if (rc.paymentTerms) c.realTerms = rc.paymentTerms;
        if (rc.vendor) c.realVendor = rc.vendor;
        if (rc.csku) c.csku = rc.csku;
      }
    });
  });
}

/* ============ Derived dataset ============ */
function useData() {
  return useMemo(() => {
    enrichBom();
    const D = window.INV_DATA;
    const skus = D.skus.map((s) => ({ ...s, band: coverBand(s.doc), expDays: daysUntil(s.earliestExp) }));
    const flags = {
      stockout: skus.filter((s) => s.onHand === 0 && s.units60 > 0),
      critical: skus.filter((s) => s.band === "crit"),
      warn: skus.filter((s) => s.band === "warn"),
      over: skus.filter((s) => s.band === "over" && s.onHand > 0),
      dead: skus.filter((s) => s.onHand > 0 && s.units60 === 0),
      disco: skus.filter((s) => s.status === "DISCO" && s.onHand > 0),
      expiring: skus.filter((s) => s.expDays != null && s.expDays <= EXP_SOON && s.onHand > 0),
    };
    // capital tied up in overstock (units beyond ~365d cover) — nominal $9.50 blended unit cost
    const UNIT_COST = 9.5;
    const overCapital = flags.over.reduce((a, s) => {
      const daily = s.units60 / 60; const keepUnits = daily * COVER.over;
      return a + Math.max(0, s.onHand - keepUnits) * UNIT_COST;
    }, 0);
    // Per-SKU valuation: landed COGS value and retail value
    skus.forEach((s) => {
      const lc = skuLandedCost(s.sku);
      const asp = s.units60 > 0 ? s.rev60 / s.units60 : null;
      s.cogsPerUnit = lc ? Math.min(lc.landed, asp ? asp * 0.5 : lc.landed) : UNIT_COST;
      s.aspPerUnit = asp;
      s.cogsValue = Math.round(s.onHand * s.cogsPerUnit);
      s.retailValue = asp ? Math.round(s.onHand * asp) : null;
      // overstock excess: units beyond 365d cover × cost
      if (s.band === "over" && s.units60 > 0) {
        const daily = s.units60 / 60;
        s.overstockUnits = Math.max(0, s.onHand - daily * COVER.over);
        s.overstockCogs = Math.round(s.overstockUnits * s.cogsPerUnit);
        s.overstockRetail = asp ? Math.round(s.overstockUnits * asp) : null;
      } else { s.overstockUnits = 0; s.overstockCogs = 0; s.overstockRetail = null; }
    });
    const totalCogsValue = skus.reduce((a, s) => a + s.cogsValue, 0);
    const totalRetailValue = skus.filter((s) => s.retailValue != null).reduce((a, s) => a + s.retailValue, 0);
    const totalOverstockCogs = skus.reduce((a, s) => a + s.overstockCogs, 0);
    const totalOverstockRetail = skus.reduce((a, s) => a + (s.overstockRetail || 0), 0);
    const builds = (window.INV_BOM.products || []).map((p) => ({ ...p, ...computeBuild(p) }));
    const constrained = builds.filter((b) => b.matchRate < 0.85);
    const pkgConstrained = builds.filter((b) => b.limitSide === "packaging");
    // stranded ingredient capital across predictor set
    const strandedCapital = builds.reduce((a, b) => a + (b.limitSide === "packaging" ? b.stranded * 4.2 : 0), 0);
    return { meta: D.meta, skus, flags, overCapital, builds, constrained, pkgConstrained, strandedCapital, recon: D.recon, totalCogsValue, totalRetailValue, totalOverstockCogs, totalOverstockRetail };
  }, []);
}

/* ============ Icons (stroke, 24 viewBox) ============ */
const Ic = {
  grid: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  scale: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v18M7 7h10M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7zM8 21h8"/></svg>,
  box: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/></svg>,
  channels: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M6 8.5v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3M12 13.5v2"/></svg>,
  recon: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg>,
  alert: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 9v4M12 17h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>,
  down: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m19 9-7 7-7-7"/></svg>,
  trend: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5"/></svg>,
  clock: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6 6 18M6 6l12 12"/></svg>,
  check: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6 9 17l-5-5"/></svg>,
  ban: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>,
  drop: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>,
  arrowR: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  flame: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 0c2 1.5 3 3.5 3 6a5 5 0 0 1-10 0c0-3 2-5 5-13z"/></svg>,
  star: (p) => <svg viewBox="0 0 24 24" {...p}><path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.05 1.1-6.47L2.6 9.9l6.5-.95z"/></svg>,
  chat: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.6-.8L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"/></svg>,
  flask: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9.5V3M7.5 14h9"/></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  rocket: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3a12 12 0 0 1 8-9 12 12 0 0 1-2 11l-3 1zM15 9a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>,
  back: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>,
};

/* ============ Small components ============ */
function Pill({ tone = "neutral", children, icon }) {
  return <span className={"pill " + tone}>{icon}{children}</span>;
}
function CoverPill({ doc, band }) {
  const dl = doc == null ? "—" : doc > 999 ? "999+ d" : fmt(doc) + "d";
  const map = {
    stockout: ["crit", "Stockout"], crit: ["crit", dl], warn: ["warn", dl],
    over: ["cap", dl], good: ["good", dl], none: ["neutral", "No sales"],
  };
  const [tone, label] = map[band] || map.none;
  return <Pill tone={tone}>{label}</Pill>;
}

function Bar({ value, max, tone = "var(--ink)", track }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="bar-track" style={track ? { background: track } : null}>
      <div className="bar-fill" style={{ width: pct + "%", background: tone }} />
    </div>
  );
}

// 5-star display with fractional fill
function Pager({ total, limit, setLimit }) {
  if (total <= 25) return null;
  const opts = [25, 50, "all"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderTop: "1px solid var(--hairline)", fontSize: 12, color: "var(--muted)" }}>
      <span className="tnum">Showing {limit === "all" ? total : Math.min(limit, total)} of {total}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
        {opts.map((o) => (
          <button key={o} onClick={() => setLimit(o)} className={"tag" + ((limit === o || (o === "all" && limit === "all")) ? " on" : "")} style={{ fontSize: 11, padding: "3px 10px" }}>{o === "all" ? "All" : o}</button>
        ))}
      </span>
    </div>
  );
}
const pageSlice = (rows, limit) => limit === "all" ? rows : rows.slice(0, limit);

function Stars({ value, size = 14 }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  const star = "M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.05 1.1-6.47L2.6 9.9l6.5-.95z";
  return (
    <span style={{ position: "relative", display: "inline-flex", lineHeight: 0 }}>
      <span style={{ display: "inline-flex", gap: 1 }}>
        {[0, 1, 2, 3, 4].map((i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="#e0ddd6"><path d={star} /></svg>)}
      </span>
      <span style={{ position: "absolute", left: 0, top: 0, overflow: "hidden", width: pct + "%", display: "inline-flex", gap: 1, pointerEvents: "none" }}>
        {[0, 1, 2, 3, 4].map((i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill="#e8a13a" style={{ flex: "none" }}><path d={star} /></svg>)}
      </span>
    </span>
  );
}

/* ============ Procurement planning ============ */
const PLAN_TODAY = new Date("2026-06-02T00:00:00");
const COMPOUND_DAYS = 12;   // compounding + QC release of bulk
const FILL_DAYS = 8;        // fill, assemble, QC, release to 3PL
const MICRO_DAYS = 14;      // microbiological / PET QC hold before release
const FREIGHT_DAYS = 9;     // inbound freight plant -> 3PL (Deposco / UFSI)
const RECEIVE_DAYS = 3;     // 3PL receive, scan lot & putaway -> sellable
const LASTMILE_DAYS = 4;    // 3PL pick/pack -> customer delivery
// Who is shipping each leg (placeholder carrier master)
const FREIGHT_CARRIER = { carrier: "Old Dominion", scac: "ODFL", mode: "Ground · LTL", service: "Plant → Deposco DC", cpu: 0.38, lane: "Ventura, CA → Reno, NV", equipment: "53′ dry van · LTL", incoterms: "FCA origin", sla: "2–3 transit days", accessorials: "Liftgate · delivery appt", contact: "freight@babylon.example" };
const WH_OPERATOR = { carrier: "UFSI · Deposco 3PL", scac: "—", mode: "Receive · lot scan · putaway", service: "Inbound dock → bin", cpu: 0.22, lane: "Deposco DC — Reno, NV", equipment: "Dock-to-stock", incoterms: "—", sla: "24–72h dock-to-stock", accessorials: "Lot/expiry capture · QC hold · ASN", contact: "inbound@deposco.example" };
const LASTMILE_CARRIER = { carrier: "UPS Ground / USPS", scac: "UPSN", mode: "Parcel", service: "DC → customer", cpu: 1.25, lane: "Reno, NV → US zones 2–8", equipment: "Parcel · ground", incoterms: "DAP", sla: "3–5 business days", accessorials: "Dim-weight · signature optional", contact: "ship@purity.example" };
const TARGET_COVER_DAYS = 120; // replenish to ~4 months of cover

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const offFromToday = (d) => Math.round((d - PLAN_TODAY) / 86400000);

function componentVendor(c) {
  if (c.type !== "ingredient") return c.supplier;
  const n = c.name.toLowerCase();
  if (/retinol|vitamin|antioxidant|serum/.test(n)) return "Actives Lab (DSM)";
  if (/caffeine|coffee/.test(n)) return "BotaniSource";
  if (/shea|jojoba|base/.test(n)) return "Making Cosmetics";
  if (/pigment|wax/.test(n)) return "Sun Chemical";
  if (/mascara/.test(n)) return "Kobo Products";
  if (/conditioner/.test(n)) return "BotaniSource";
  return "Making Cosmetics";
}

function componentCost(c) {
  const n = c.name.toLowerCase();
  if (c.type === "ingredient") {
    if (/retinol/.test(n)) return 1.65;
    if (/vitamin|vit-c|antioxidant/.test(n)) return 1.40;
    if (/serum/.test(n)) return 1.15;
    if (/caffeine|coffee/.test(n)) return 0.95;
    if (/conditioner/.test(n)) return 0.55;
    if (/pigment|wax|mascara/.test(n)) return 0.70;
    return 0.80;
  }
  if (/airless|pump|dropper/.test(n)) return 1.05;
  if (/jar/.test(n)) return 0.85;
  if (/bottle|barrel/.test(n)) return 0.78;
  if (/tube/.test(n)) return 0.70;
  if (/carton/.test(n)) return 0.42;
  if (/blister|card/.test(n)) return 0.32;
  if (/brush|wand|wiper/.test(n)) return 0.35;
  if (/lid|cap|overcap/.test(n)) return 0.18;
  if (/label/.test(n)) return 0.12;
  return 0.40;
}

// Net payment terms by vendor (days). 0 = prepay (typical for overseas).
const VENDOR_TERMS = {
  "BotaniSource": 45, "Making Cosmetics": 30, "Actives Lab (DSM)": 60, "Sun Chemical": 30,
  "Kobo Products": 45, "Sun Glass Co.": 60, "Hangzhou Pumps": 0, "Shenzhen Cosmetics": 0, "Pacific Print": 30,
};
const vendorTerms = (v) => VENDOR_TERMS[v] != null ? VENDOR_TERMS[v] : 30;

// Country of origin / import profile by vendor
const VENDOR_ORIGIN = {
  "BotaniSource": { country: "United States", imported: false },
  "Making Cosmetics": { country: "United States", imported: false },
  "Actives Lab (DSM)": { country: "Switzerland", imported: true, mode: "Air freight", port: "JFK · New York", broker: "Flexport Customs" },
  "Sun Chemical": { country: "United States", imported: false },
  "Kobo Products": { country: "United States", imported: false },
  "Sun Glass Co.": { country: "United States", imported: false },
  "Hangzhou Pumps": { country: "China", imported: true, mode: "Ocean FCL", port: "Long Beach · LA", broker: "Flexport Customs" },
  "Shenzhen Cosmetics": { country: "China", imported: true, mode: "Ocean FCL", port: "Long Beach · LA", broker: "Flexport Customs" },
  "Pacific Print": { country: "United States", imported: false },
};
const vendorOrigin = (v) => VENDOR_ORIGIN[v] || { country: "United States", imported: false };

// Vendor contact master (placeholder)
const VENDOR_CONTACT = {
  "BotaniSource": { rep: "M. Reyes", email: "orders@botanisource.com", moq: "25 kg" },
  "Making Cosmetics": { rep: "Sales desk", email: "sales@makingcosmetics.com", moq: "10 kg" },
  "Actives Lab (DSM)": { rep: "K. Brandt", email: "actives@dsm-firmenich.com", moq: "5 kg" },
  "Sun Chemical": { rep: "Pigments team", email: "cosmetics@sunchemical.com", moq: "20 kg" },
  "Kobo Products": { rep: "T. Okada", email: "orders@koboproductsinc.com", moq: "15 kg" },
  "Sun Glass Co.": { rep: "L. Tran", email: "po@sunglassco.com", moq: "5,000 ea" },
  "Hangzhou Pumps": { rep: "Grace W.", email: "export@hzpumps.cn", moq: "10,000 ea" },
  "Shenzhen Cosmetics": { rep: "J. Lin", email: "sales@szcosmetics.cn", moq: "10,000 ea" },
  "Pacific Print": { rep: "D. Alvarez", email: "jobs@pacificprint.com", moq: "2,500 ea" },
};
function componentVendorInfo(c) {
  const v = componentVendor(c);
  const o = vendorOrigin(v);
  const ct = VENDOR_CONTACT[v] || {};
  return { vendor: v, country: o.country, imported: o.imported, terms: vendorTerms(v), lead: c.leadTimeDays, rep: ct.rep, email: ct.email, moq: ct.moq };
}

// Harmonized Tariff Schedule classification by component
function htsFor(c) {
  const n = c.name.toLowerCase();
  if (c.type === "ingredient") {
    if (/caffeine|coffee/.test(n)) return { code: "2939.79.00", desc: "Alkaloids — caffeine", duty: 0 };
    if (/vitamin-c|vitamin c|vit-c|antioxidant/.test(n)) return { code: "2936.27.00", desc: "Vitamin C & derivatives", duty: 0 };
    if (/retinol|vitamin/.test(n)) return { code: "2936.21.00", desc: "Vitamins A & derivatives", duty: 0 };
    if (/shea|jojoba|base|coconut/.test(n)) return { code: "1516.20.90", desc: "Vegetable fats & oils, modified", duty: 3.2 };
    if (/pigment|wax/.test(n)) return { code: "3204.17.00", desc: "Synthetic organic pigments", duty: 6.5 };
    if (/conditioner/.test(n)) return { code: "3305.90.00", desc: "Hair preparations", duty: 0 };
    if (/mascara/.test(n)) return { code: "3304.20.00", desc: "Eye make-up preparations", duty: 0 };
    return { code: "3304.99.50", desc: "Beauty / skin-care preparations", duty: 0 };
  }
  if (/glass|jar|bottle/.test(n)) return { code: "7010.90.50", desc: "Glass containers for packing", duty: 5.2 };
  if (/airless|pump|dropper/.test(n)) return { code: "9616.10.00", desc: "Scent / cosmetic sprayers & pumps", duty: 0 };
  if (/cap|lid|overcap|barrel|tube/.test(n)) return { code: "3923.50.00", desc: "Plastic stoppers, lids & caps", duty: 5.3 };
  if (/carton/.test(n)) return { code: "4819.20.00", desc: "Folding cartons, paperboard", duty: 0 };
  if (/label/.test(n)) return { code: "4821.10.00", desc: "Printed paper labels", duty: 0 };
  if (/brush|wand|wiper/.test(n)) return { code: "9603.30.40", desc: "Cosmetic / artists' brushes", duty: 0 };
  if (/blister|card/.test(n)) return { code: "3923.10.00", desc: "Plastic packing articles", duty: 3 };
  return { code: "3923.90.00", desc: "Plastic packing articles", duty: 3 };
}

// Build a procurement schedule for one finished good.
// mode "synced" = just-in-time backward from stock-out (ideal: materials land together at the build).
// mode "naive"  = place every PO today (materials land scattered, sit idle, cash goes out early).
function computeSchedule(b, opts = {}, mode = "synced") {
  const COMPOUND = opts.compound != null ? opts.compound : COMPOUND_DAYS;
  const FILL = opts.fill != null ? opts.fill : FILL_DAYS;
  const COVER = opts.cover != null ? opts.cover : TARGET_COVER_DAYS;
  const daily = b.demand60 / 60;
  const coverDays = daily > 0 ? Math.round(b.finishedOnHand / daily) : 999;
  const targetBuild = Math.max(b.demand60, Math.ceil(daily * COVER));

  const base = b.comps.map((c) => {
    const capacity = Math.floor(c.onHand / c.perUnit);
    const isIng = c.type === "ingredient";
    const orderUnits = Math.max(0, targetBuild - capacity);
    const vendor = componentVendor(c);
    const netTerms = vendorTerms(vendor);
    const value = orderUnits * componentCost(c);
    const hts = htsFor(c);
    const origin = vendorOrigin(vendor);
    const section301 = origin.country === "China" ? 25 : 0;   // Section 301 surcharge
    const dutyRate = hts.duty + section301;
    const dutyCost = Math.round(value * dutyRate / 100);
    return { ...c, capacity, isIng, orderUnits, orderQty: orderUnits * c.perUnit, value, vendor, netTerms, hts, origin, section301, dutyRate, dutyCost };
  });

  let items, compound, fill;
  if (mode === "synced") {
    // pull the build earlier so goods are SELLABLE at the 3PL by the stock-out date
    const fillEnd = coverDays - FREIGHT_DAYS - RECEIVE_DAYS - MICRO_DAYS, fillStart = fillEnd - FILL, compoundEnd = fillStart, compoundStart = compoundEnd - COMPOUND;
    items = base.map((c) => {
      const consume = c.isIng ? compoundStart : fillStart;   // when it's actually used
      const land = consume;                                   // JIT: arrives exactly when needed
      const order = land - c.leadTimeDays;
      return { ...c, startOff: order, endOff: land, landOff: land, consumeOff: consume, idleDays: 0, payByOff: order + c.netTerms, daysToOrder: order };
    });
    compound = { startOff: compoundStart, endOff: compoundEnd };
    fill = { startOff: fillStart, endOff: fillEnd };
  } else {
    items = base.map((c) => ({ ...c, startOff: 0, endOff: c.leadTimeDays, landOff: c.leadTimeDays, payByOff: c.netTerms, daysToOrder: 0 }));
    const ingLands = items.filter((i) => i.isIng && i.orderUnits > 0).map((i) => i.landOff);
    const compoundStart = ingLands.length ? Math.max(...ingLands) : 0;
    const compoundEnd = compoundStart + COMPOUND;
    const pkgLands = items.filter((i) => !i.isIng && i.orderUnits > 0).map((i) => i.landOff);
    const fillStart = Math.max(compoundEnd, pkgLands.length ? Math.max(...pkgLands) : 0);
    const fillEnd = fillStart + FILL;
    compound = { startOff: compoundStart, endOff: compoundEnd };
    fill = { startOff: fillStart, endOff: fillEnd };
    items = items.map((c) => { const consume = c.isIng ? compoundStart : fillStart; return { ...c, consumeOff: consume, idleDays: Math.max(0, consume - c.landOff) }; });
  }

  const orderItems = items.filter((i) => i.orderUnits > 0).sort((a, c) => a.startOff - c.startOff);
  // micro / PET QC hold gates release after fill
  const micro = { startOff: fill.endOff, endOff: fill.endOff + MICRO_DAYS, days: MICRO_DAYS };
  // logistics leg: plant -> 3PL (Deposco/UFSI) -> customer
  const arriveWhOff = micro.endOff + FREIGHT_DAYS;
  const availOff = arriveWhOff + RECEIVE_DAYS;       // lot scanned in, sellable from 3PL
  const customerOff = availOff + LASTMILE_DAYS;       // lot delivered to customer
  const cartons = Math.ceil(targetBuild / 24);        // ~24 units per carton
  const pallets = Math.max(1, Math.ceil(cartons / 48)); // ~48 cartons per pallet
  const logistics = {
    freight: { key: "freight", name: "Inbound freight → 3PL", startOff: micro.endOff, endOff: arriveWhOff, days: FREIGHT_DAYS, ...FREIGHT_CARRIER, cost: Math.round(targetBuild * FREIGHT_CARRIER.cpu), units: targetBuild, cartons, pallets },
    receive: { key: "receive", name: "3PL receive · scan lot · putaway", startOff: arriveWhOff, endOff: availOff, days: RECEIVE_DAYS, ...WH_OPERATOR, cost: Math.round(targetBuild * WH_OPERATOR.cpu), units: targetBuild, cartons, pallets },
    lastmile: { key: "lastmile", name: "Outbound → customer", startOff: availOff, endOff: customerOff, days: LASTMILE_DAYS, ...LASTMILE_CARRIER, cost: Math.round(targetBuild * LASTMILE_CARRIER.cpu), units: targetBuild, cartons, pallets },
  };
  const logisticsCost = targetBuild * (FREIGHT_CARRIER.cpu + WH_OPERATOR.cpu + LASTMILE_CARRIER.cpu);
  const dutyTotal = orderItems.reduce((a, c) => a + c.dutyCost, 0);
  const importedItems = orderItems.filter((i) => i.origin.imported);
  const offs = orderItems.map((i) => i.startOff);
  const earliestOrderOff = offs.length ? Math.min(...offs) : null;
  const totalValue = orderItems.reduce((a, c) => a + c.value, 0);
  const lands = orderItems.map((i) => i.landOff);
  const arrivalSpread = lands.length ? Math.max(...lands) - Math.min(...lands) : 0;
  const idleDays = orderItems.reduce((a, c) => a + c.idleDays, 0);
  const readyOff = availOff;                          // revenue can begin once sellable at 3PL
  const pays = orderItems.map((i) => i.payByOff);
  const latestPay = pays.length ? Math.max(...pays) : 0;
  const earliestPay = pays.length ? Math.min(...pays) : 0;
  const cashGap = earliestPay - readyOff; // + = even the earliest invoice falls after revenue starts (sell before you pay = good)
  return {
    ...b, mode, daily, coverDays, needByOff: coverDays, targetBuild,
    items, orderItems, earliestOrderOff, totalValue,
    phases: { compound, fill, micro }, logistics, logisticsCost, dutyTotal, importedItems, arriveWhOff, availOff, customerOff,
    arrivalSpread, idleDays, readyOff, latestPay, cashGap,  };
}
function computePlan(b, opts) { return computeSchedule(b, opts, "synced"); }

/* ============ Product brief → MVP formula translation ============ */
// Turn a marketing/creative brief into a starter formula skeleton + metadata a formulator can refine.
function briefToProduct(brief) {
  const B = window.INV_BRIEF;
  const veh = B.vehicles.find((v) => v.id === brief.vehicle) || B.vehicles[0];
  const chosenActives = (brief.actives || []).map((id) => B.actives.find((a) => a.id === id)).filter(Boolean);
  const customActives = (brief.customActives || []).filter((c) => c && c.label).map((c) => ({
    id: "custom-" + c.label, label: c.label, inci: c.inci || c.label, wt: +(c.wt || 2), phase: "Actives", costKg: +(c.costKg || 50), claims: c.claim ? [c.claim] : [], custom: true,
  }));
  const allActives = [...chosenActives, ...customActives];
  const frag = B.fragrances.find((f) => f.id === brief.fragrance) || B.fragrances[0];
  const isRinseOff = /foam|cleanser/.test(veh.id) || /Cleanser/.test(brief.category || "");

  // Build formula: actives + fragrance + preservative consume from the largest water/solvent line (q.s.).
  let rows = veh.base.map((r) => ({ ...r, allergens: [] }));
  const activesWt = allActives.reduce((a, x) => a + x.wt, 0);
  const fragWt = frag.inci ? (frag.wt || 0.3) : 0;
  const presWt = 0.8;
  const consume = activesWt + fragWt + presWt;
  // reduce the biggest line (the q.s. water/oil base) to keep total at 100
  let biggest = rows.reduce((mx, r, i) => (r.wt > rows[mx].wt ? i : mx), 0);
  rows[biggest] = { ...rows[biggest], wt: +(rows[biggest].wt - consume).toFixed(2) };
  allActives.forEach((a) => rows.push({ trade: a.label.replace(/\s*\(.*\)/, ""), inci: a.inci, wt: a.wt, phase: a.phase, costKg: a.costKg, allergens: [] }));
  rows.push({ trade: "BenzylAlcohol-DHA", inci: "Dehydroacetic Acid, Benzyl Alcohol, Aqua", wt: presWt, phase: "Cool-down", costKg: 19.55, allergens: ["Benzyl Alcohol"] });
  if (frag.inci) rows.push({ trade: brief.fragrance === "citrus" ? "Citrus EO blend" : brief.fragrance === "floral" ? "Floral EO blend" : "Herbal EO blend", inci: frag.inci, wt: fragWt, phase: "Cool-down", costKg: 52, allergens: frag.allergens });
  // q.s. top-up so the formula totals exactly 100%: Aqua for water-based vehicles, carrier oil for anhydrous
  const anhydrous = /facial-oil|balm/.test(veh.id);
  const sum = rows.reduce((a, r) => a + (r.wt || 0), 0);
  const qs = +(100 - sum).toFixed(2);
  if (qs > 0.01) {
    if (anhydrous) rows.push({ trade: "Caprylic/Capric Triglyceride (q.s.)", inci: "Caprylic/Capric Triglyceride", wt: qs, phase: "Oil", costKg: 7.4, allergens: [] });
    else rows.push({ trade: "Aqua (q.s. to 100)", inci: "Aqua (Water)", wt: qs, phase: "Water", costKg: 0.02, allergens: [] });
  } else if (qs < -0.01) {
    // over 100: trim the largest line back down
    let bi = rows.reduce((mx, r, i) => (r.wt > rows[mx].wt ? i : mx), 0);
    rows[bi] = { ...rows[bi], wt: +(rows[bi].wt + qs).toFixed(2) };
  }
  rows = rows.map((r, i) => ({ n: i + 1, ...r }));

  // claims: union of explicit picks + claims implied by chosen actives
  const claimSet = new Set(brief.claims || []);
  allActives.forEach((a) => a.claims.forEach((c) => claimSet.add(c)));
  if (frag.id === "none") claimSet.add("Fragrance-free");
  const validated = []; const pending = [...claimSet];

  const allergens = [...new Set(rows.flatMap((r) => r.allergens || []))];
  const ifraCat = isRinseOff ? "Rinse-off face (IFRA Cat 9)" : /Eye/.test(brief.category) ? "Leave-on eye (IFRA Cat 3)" : "Leave-on face (IFRA Cat 4)";
  const allergenCheck = allergens.map((a) => ({ name: a, useLevel: +(fragWt).toFixed(2), limit: null, pctOfLimit: null, status: "ok", note: "From fragrance — declare on label" }));
  allergenCheck.push({ name: "Benzyl Alcohol", useLevel: presWt, limit: null, pctOfLimit: null, status: "review", note: "Preservative — Annex III" });

  return {
    formula: rows, fill: veh.fill, vehicleLabel: veh.label,
    claims: { validated, pending }, allergenCheck, applicationCategory: ifraCat, cosmos: !!brief.cosmos,
    brief: {
      vehicle: veh.label, color: brief.color, absorption: brief.absorption, fragrance: frag.label,
      category: brief.category, cosmos: !!brief.cosmos,
      actives: allActives.map((a) => a.label), targetClaims: [...claimSet],
    },
  };
}

window.LIB_BRIEF = { briefToProduct };

/* ============ Artwork & proof tracking ============ */
const PROOF_STAGE = {
  "approved":   { label: "Approved",   tone: "good",    rank: 3 },
  "in-review":  { label: "In review",  tone: "cap",     rank: 2 },
  "revise":     { label: "Revise",     tone: "warn",    rank: 1 },
  "not-started":{ label: "Not started",tone: "neutral", rank: 0 },
};
function artworkFor(sku) {
  const A = window.INV_ARTWORK;
  return (A && A.bySku && A.bySku[sku]) || null;
}
function proofSummary(rec) {
  if (!rec) return null;
  const comps = rec.components || [];
  const counts = { approved: 0, "in-review": 0, revise: 0, "not-started": 0 };
  comps.forEach((c) => { counts[c.proof.stage] = (counts[c.proof.stage] || 0) + 1; });
  const total = comps.length;
  const ready = counts.approved;
  const blocked = counts.revise + counts["not-started"];
  const allApproved = total > 0 && ready === total;
  return { total, counts, ready, blocked, allApproved, pctReady: total ? ready / total : 0 };
}

/* ============ Customer reviews ============ */
const REVIEW_STATUS = {
  issue:   { label: "Issue",        tone: "crit",    rank: 3 },
  watch:   { label: "Watch",        tone: "warn",    rank: 2 },
  healthy: { label: "Healthy",      tone: "good",    rank: 1 },
  thin:    { label: "Few reviews",  tone: "neutral", rank: 0 },
};
function reviewsFor(sku) {
  const R = window.INV_REVIEWS;
  return (R && R.bySku && R.bySku[sku]) || null;
}
// sample-size-aware health: returns {score, status}
function reviewHealth(rec) {
  if (!rec) return null;
  const n = rec.count, avg = rec.avg, crit = rec.critical || 0;
  const critRate = n ? crit / n : 0;
  const negPct = rec.negPct != null ? rec.negPct : 0;
  const score = Math.round(Math.max(0, Math.min(100, (avg / 5) * 100 - Math.min(40, critRate * 120) - negPct * 30)));
  let status;
  if (n < 5 && crit < 3) status = "thin";
  else if (crit >= 4 || (n >= 8 && avg < 3.2) || critRate >= 0.06) status = "issue";
  else if ((n >= 5 && (avg < 3.9 || negPct > 0.22)) || crit >= 2) status = "watch";
  else status = "healthy";
  return { score, status };
}
function reviewsRollup() {
  const R = window.INV_REVIEWS;
  if (!R) return { issue: 0, watch: 0, critical: 0, total: 0 };
  let issue = 0, watch = 0;
  Object.values(R.byName).forEach((p) => { const h = reviewHealth(p); if (h.status === "issue") issue++; else if (h.status === "watch") watch++; });
  return { issue, watch, critical: R.meta.criticalTotal, total: R.meta.totalReviews, products: R.meta.products };
}

/* ============ Formula / ingredients ============ */
function formulaFor(sku) {
  const F = window.INV_FORMULAS;
  return (F && F.bySku && F.bySku[sku]) || null;
}
function ingredientListFor(sku) {
  const I = window.INV_INGREDIENTS;
  const r = (I && I.bySku && I.bySku[sku]) || null;
  return (r && r.il) ? r : null;
}

/* ============ Regulatory dossier ============ */
// Required compliance records per finished product (structure from the Finished Product data sheet).
const DOSSIER_TEMPLATE = [
  { section: "Core product data", items: [
    { id: "product_info", label: "Product info", source: "Babylon App", owner: "OB" },
    { id: "formula_profile", label: "Formula profile for SKU", source: "Babylon App", owner: "R&D" },
    { id: "com", label: "Certificate of Manufacture (COM)", source: "COM PDF", owner: "OB" },
    { id: "ingredients", label: "Ingredients & constituents", source: "Babylon App", owner: "R&D" },
    { id: "pricing", label: "Pricing model", source: "Babylon App", owner: "Finance" },
    { id: "inventory", label: "Inventory levels", source: "Odoo + Babylon App", owner: "Ops" },
  ]},
  { section: "Testing & stability", items: [
    { id: "stability", label: "Stability report", source: "R&D", owner: "R&D" },
    { id: "challenge", label: "Challenge (PET) test", source: "Lab", owner: "R&D" },
  ]},
  { section: "FDA", items: [
    { id: "unii", label: "UNII & ingredient filing", source: "FDA", owner: "Regulatory" },
    { id: "mom", label: "Method of Manufacturing", source: "MoM doc", owner: "R&D" },
  ]},
  { section: "Regulatory documents", items: [
    { id: "coa", label: "COA", source: "COA", owner: "QA" },
    { id: "sds", label: "SDS / MSDS", source: "SDS", owner: "Regulatory" },
    { id: "ifra", label: "IFRA certificate", source: "IFRA", owner: "Regulatory" },
    { id: "cpsr", label: "Cosmetic Product Safety Report", source: "CPSR PDF", owner: "Regulatory" },
  ]},
  { section: "Artwork", items: [
    { id: "label", label: "Label artwork", source: "Artwork register", owner: "Studio" },
  ]},
];
const DOSSIER_STATUS = {
  "on-file": { label: "On file", tone: "good" },
  "pending": { label: "In progress", tone: "warn" },
  "missing": { label: "Missing", tone: "crit" },
};
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
// Build a per-SKU dossier, cross-linked to real signals where we have them.
function regulatoryDossier(s) {
  const sku = s.sku;
  const hasFormula = !!formulaFor(sku);
  const hasIL = !!ingredientListFor(sku);
  const art = window.INV_ARTWORK && window.INV_ARTWORK.bySku && window.INV_ARTWORK.bySku[sku];
  let labelStatus = "missing";
  if (art && art.components && art.components.length) {
    const anyApproved = art.components.some((c) => c.proof.stage === "approved");
    const anyProgress = art.components.some((c) => c.proof.stage === "in-review" || c.proof.stage === "revise");
    labelStatus = anyApproved ? "on-file" : anyProgress ? "pending" : "missing";
  }
  const sections = DOSSIER_TEMPLATE.map((sec) => ({
    section: sec.section,
    items: sec.items.map((it) => {
      let status;
      if (it.id === "inventory") status = s.onHand > 0 ? "on-file" : "pending";
      else if (it.id === "ingredients") status = (hasIL || hasFormula) ? "on-file" : "pending";
      else if (it.id === "formula_profile") status = hasFormula ? "on-file" : "pending";
      else if (it.id === "product_info") status = "on-file";
      else if (it.id === "label") status = labelStatus;
      else {
        // deterministic seed: bias core/testing toward on-file, FDA/reg toward gaps
        const h = hashStr(sku + it.id);
        const bias = { com: 0.7, pricing: 0.85, stability: 0.7, challenge: 0.6, unii: 0.45, mom: 0.55, coa: 0.75, sds: 0.7, ifra: 0.5, cpsr: 0.45 }[it.id] || 0.6;
        const r = (h % 100) / 100;
        status = r < bias ? "on-file" : (r < bias + 0.2 ? "pending" : "missing");
      }
      return { ...it, status };
    }),
  }));
  let onFile = 0, total = 0, missing = 0;
  sections.forEach((sec) => sec.items.forEach((it) => { total++; if (it.status === "on-file") onFile++; if (it.status === "missing") missing++; }));
  const pct = total ? onFile / total : 0;
  const status = pct >= 0.9 ? "complete" : missing >= 2 || pct < 0.6 ? "gaps" : "partial";
  return { sections, onFile, total, missing, pct, status };
}
const DOSSIER_HEALTH = {
  complete: { label: "Complete", tone: "good" },
  partial: { label: "In progress", tone: "warn" },
  gaps: { label: "Gaps", tone: "crit" },
};
function regulatoryRollup(skus) {
  let gaps = 0, partial = 0;
  (skus || []).forEach((s) => { const d = regulatoryDossier(s); if (d.status === "gaps") gaps++; else if (d.status === "partial") partial++; });
  return { gaps, partial };
}

/* ============ Cash planner — vendor payables (AP) ============ */
const CASH_KEY = "babylon_cash_opening_v1";
function loadOpeningCash() { try { const v = parseFloat(localStorage.getItem(CASH_KEY)); return isNaN(v) ? 250000 : v; } catch (e) { return 250000; } }
function saveOpeningCash(v) { try { localStorage.setItem(CASH_KEY, String(v)); } catch (e) {} }
function cashObligations(builds, settings) {
  const events = [];
  (builds || []).forEach((b) => {
    const plan = computeSchedule(b, settings, "synced");
    plan.orderItems.forEach((it) => {
      const freight = Math.round((it.orderUnits || 0) * 0.12);
      const amount = Math.round((it.value || 0) + (it.dutyCost || 0) + freight);
      if (amount <= 0) return;
      events.push({
        vendor: it.vendor, type: it.isIng ? "ingredient" : "packaging",
        product: b.name, sku: b.sku, component: it.name,
        amount, goods: Math.round(it.value || 0), duty: it.dutyCost || 0, freight,
        terms: it.netTerms, orderOff: it.startOff, dueOff: it.payByOff,
        prepaid: it.netTerms === 0, imported: it.origin && it.origin.imported,
      });
    });
  });
  return events.sort((a, b) => a.dueOff - b.dueOff);
}
function cashWeeks(events, openingCash, horizonWk) {
  const weeks = [];
  for (let w = 0; w < horizonWk; w++) {
    const lo = w * 7, hi = lo + 7;
    const inWk = events.filter((e) => e.dueOff >= lo && e.dueOff < hi);
    const ing = inWk.filter((e) => e.type === "ingredient").reduce((a, e) => a + e.amount, 0);
    const pkg = inWk.filter((e) => e.type === "packaging").reduce((a, e) => a + e.amount, 0);
    weeks.push({ w, lo, hi, ing, pkg, total: ing + pkg, count: inWk.length });
  }
  let bal = openingCash;
  weeks.forEach((wk) => { bal -= wk.total; wk.balance = bal; });
  return weeks;
}
window.LIB_CASH = { cashObligations, cashWeeks, loadOpeningCash, saveOpeningCash };

/* Payables forecast from open finished-goods POs (joined to the real BOM). */
function poNetTerms(txt) {
  if (!txt) return 30;
  const l = txt.toLowerCase();
  if (/prepaid|prepay|before ship/.test(l)) return 0;
  const m = l.match(/net\s*(\d+)/); return m ? parseInt(m[1]) : 30;
}
function cashFromOpenPOs() {
  const OP = window.INV_OPENPOS, RB = window.INV_REALBOM;
  if (!OP || !RB) return [];
  const events = [];
  OP.lines.forEach((l) => {
    const bom = RB.bySku[l.sku];
    if (!bom) return;
    bom.components.forEach((c) => {
      if (!c.unitPrice || c.type === "Formula") return;
      const isIng = /formula|ingredient|bulk/i.test(c.type);
      const prodWk = c.prodLeadWk || 0, shipWk = c.shipLeadWk || 0;
      const terms = poNetTerms(c.paymentTerms);
      const dueOff = l.orderOff + Math.round((prodWk + shipWk) * 7) + terms; // ordered → made+shipped → invoice due
      const amount = Math.round(c.unitPrice * l.qty);
      if (amount <= 0) return;
      events.push({
        vendor: c.vendor || (c.type + " supplier"), type: isIng ? "ingredient" : "packaging",
        product: l.product, sku: l.sku, po: l.po, component: c.type, qty: l.qty,
        amount, goods: amount, duty: 0, freight: 0,
        terms, orderOff: l.orderOff, orderDate: l.orderDate, dueOff,
        prepaid: terms === 0, imported: c.shipMethod === "Ocean" || c.shipMethod === "Air", shipMethod: c.shipMethod || null,
      });
    });
  });
  return events.sort((a, b) => a.dueOff - b.dueOff);
}
function cashMonths(events, openingCash, monthsN) {
  const base = new Date("2026-06-01T00:00:00");
  const months = [];
  for (let i = 0; i < monthsN; i++) {
    const start = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const next = new Date(base.getFullYear(), base.getMonth() + i + 1, 1);
    const loOff = Math.round((start - new Date("2026-06-02T00:00:00")) / 86400000);
    const hiOff = Math.round((next - new Date("2026-06-02T00:00:00")) / 86400000);
    const inM = events.filter((e) => e.dueOff >= loOff && e.dueOff < hiOff);
    const ing = inM.filter((e) => e.type === "ingredient").reduce((a, e) => a + e.amount, 0);
    const pkg = inM.filter((e) => e.type === "packaging").reduce((a, e) => a + e.amount, 0);
    months.push({ label: start.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), loOff, hiOff, ing, pkg, total: ing + pkg, count: inM.length });
  }
  let bal = openingCash;
  months.forEach((m) => { bal -= m.total; m.balance = bal; });
  return months;
}
window.LIB_CASH.cashFromOpenPOs = cashFromOpenPOs;
window.LIB_CASH.cashMonths = cashMonths;
const PRODDEV_KEY = "babylon_proddev_v1";
function loadDevStore() {
  try { return JSON.parse(localStorage.getItem(PRODDEV_KEY)) || { created: [], over: {} }; }
  catch (e) { return { created: [], over: {} }; }
}
function saveDevStore(o) { try { localStorage.setItem(PRODDEV_KEY, JSON.stringify(o)); } catch (e) {} }
// Merge seed products with localStorage (created + per-id overrides)
function proddevProducts() {
  const base = (window.INV_PRODDEV.products || []);
  const store = loadDevStore();
  const all = [...(store.created || []), ...base];
  return all.map((p) => { const ov = (store.over || {})[p.id]; return ov ? { ...p, ...ov } : p; });
}
const PRODDEV_STAGES = () => (window.INV_PRODDEV && window.INV_PRODDEV.stages) || ["Concept", "Formulation", "Stability", "Compliance", "Pre-production", "Production"];
function computeDevProduct(p) {
  const labor = (window.INV_PRODDEV && window.INV_PRODDEV.meta.laborCostPerUnit) || 0.12;
  const wtTotal = p.formula.reduce((a, r) => a + (parseFloat(r.wt) || 0), 0);
  const ingCostUnit = p.formula.reduce((a, r) => a + (parseFloat(r.wt) || 0) / 100 * ((parseFloat(r.costKg) || 0) + (parseFloat(r.freightKg) || 0)) * (p.fillWeight / 1000), 0);
  const cogs = 1.4 * ingCostUnit + 1.6 * labor;
  const conds = (p.stability && p.stability.conditions) || [];
  const anyFail = conds.some((c) => Object.values(c.points).includes("fail"));
  const coreReached = conds.filter((c) => /25|40/.test(c.name)).length > 0 &&
    conds.filter((c) => /25|40/.test(c.name)).every((c) => ["3M", "6M", "12M", "24M"].some((tp) => c.points[tp] === "pass"));
  const stab = anyFail ? "fail" : (conds.length && coreReached ? "ok" : "pending");
  const ch = (p.challenge && p.challenge.status) || "not-started";
  const allerg = p.allergenCheck || [];
  const ifra = allerg.some((a) => a.status === "exceed") ? "fail" : allerg.some((a) => a.status === "watch" || a.status === "review") ? "watch" : "ok";
  const artMap = { approved: "ok", "on-file": "ok", pending: "pending", "not-started": "missing" };
  const art = artMap[p.artwork && p.artwork.status] || "missing";
  const claims = (p.claims && p.claims.validated && p.claims.validated.length) ? "ok" : "pending";
  const gates = [
    { id: "formula", label: "Formula totals 100%", status: Math.abs(wtTotal - 100) <= 0.5 ? "ok" : "fail", detail: wtTotal.toFixed(2) + "%" },
    { id: "stability", label: "Stability", status: stab },
    { id: "challenge", label: "Challenge (PET) test", status: ch === "pass" ? "ok" : ch === "fail" ? "fail" : "pending" },
    { id: "ifra", label: "IFRA / allergen limits", status: ifra },
    { id: "claims", label: "Claims documented", status: claims },
    { id: "artwork", label: "Artwork approved", status: art },
  ];
  const critical = ["formula", "stability", "challenge", "ifra", "artwork"];
  const canPush = p.stage !== "Production" && critical.every((id) => { const g = gates.find((x) => x.id === id); return g.status === "ok" || (id === "ifra" && g.status === "watch"); });
  const passed = gates.filter((g) => g.status === "ok").length;
  return { wtTotal, ingCostUnit, cogs, labor, gates, canPush, readyPct: passed / gates.length };
}
const GATE_TONE = { ok: "good", pending: "warn", watch: "warn", fail: "crit", missing: "crit" };
const GATE_LABEL = { ok: "Ready", pending: "Pending", watch: "Watch", fail: "Fail", missing: "Missing" };

/* ============ Finance module (spec: float, stranded, working capital, P&L, diversification) ============ */
const FIN_ASP_FALLBACK = 14.0;       // blended ASP when a SKU has no sales
const FIN_ING_COST = 4.2, FIN_PKG_COST = 1.1; // placeholder blended unit costs
const FIN_TRANSFER_MARKUP = 1.45;    // Babylon → Purity intercompany transfer price = landed cost × markup
const FIN_LABOR_UNIT = 0.12;         // blended fill/assembly labor per unit (matches dev COGS model)
// Per-unit landed cost of a finished SKU = Σ component unitPrice (goods) + inbound freight + import duty, from the real BOM.
function skuLandedCost(sku) {
  const RB = window.INV_REALBOM;
  const bom = RB && RB.bySku && RB.bySku[sku];
  if (!bom) return null;
  let goods = 0, freight = 0, duty = 0; let priced = 0, total = 0;
  bom.components.forEach((c) => {
    if (c.type === "Formula") return;
    total++;
    if (c.unitPrice == null) return;
    priced++;
    goods += c.unitPrice;
    if (c.shipCost) freight += c.shipCost;
    if (c.shipMethod === "Ocean" || c.shipMethod === "Air") duty += c.unitPrice * 0.05; // nominal import duty on imported components
  });
  if (priced === 0) return null;
  const labor = FIN_LABOR_UNIT;
  const landed = goods + freight + duty + labor;
  return { goods: +goods.toFixed(3), freight: +freight.toFixed(3), duty: +duty.toFixed(3), labor, landed: +landed.toFixed(3), coverage: total ? priced / total : 0 };
}
function finStats(data, settings) {
  const builds = data.builds || [];
  // Float engine: per-SKU gap = readyOff - latestPay  (positive = sell before pay)
  const float = builds.map((b) => {
    const plan = computeSchedule(b, settings, "synced");
    const gap = (plan.readyOff != null && plan.latestPay != null) ? plan.readyOff - plan.latestPay : null;
    // Note: cashGap in schedule = earliestPay - readyOff; here we want readyOff vs latest invoice
    const floatGap = plan.latestPay != null ? plan.latestPay - plan.readyOff : null; // payByOff - readyOff per spec: + means pay after sell? spec: gap = readyOff - payByOff
    const specGap = plan.readyOff != null && plan.latestPay != null ? (plan.latestPay - plan.readyOff) * -1 : null;
    return { sku: b.sku, name: b.name, readyOff: plan.readyOff, payByOff: plan.latestPay, gap: specGap, totalValue: plan.totalValue, dutyTotal: plan.dutyTotal };
  });
  const inverted = float.filter((f) => f.gap != null && f.gap < 0);
  const critical = float.filter((f) => f.gap != null && f.gap < -14);
  // Stranded capital from match-rate predictor
  const stranded = builds.map((b) => {
    const ingCost = (b.ing && b.ing[0] && b.ing[0].costKg) ? FIN_ING_COST : FIN_ING_COST;
    const val = Math.round((b.stranded || 0) * FIN_ING_COST);
    return { sku: b.sku, name: b.name, ingCeil: b.ingCeil, pkgCeil: b.pkgCeil, matchRate: b.matchRate, strandedUnits: b.stranded || 0, value: val, bottleneck: b.bottleneck ? b.bottleneck.name : null, limitSide: b.limitSide };
  }).filter((s) => s.strandedUnits > 0 && s.limitSide === "packaging").sort((a, b) => b.value - a.value);
  const strandedTotal = stranded.reduce((a, s) => a + s.value, 0);
  // Working capital
  let ingOnHand = 0, pkgOnHand = 0;
  builds.forEach((b) => (b.comps || []).forEach((c) => {
    const onHandVal = (c.onHand || 0) * (c.type === "ingredient" ? FIN_ING_COST / 50 : FIN_PKG_COST);
    if (c.type === "ingredient") ingOnHand += onHandVal; else pkgOnHand += onHandVal;
  }));
  const skus = data.skus || [];
  let fgValue = 0, ar = 0;
  const FG_COGS_RATIO = 0.45; // carry finished goods at ~cost, not retail
  skus.forEach((s) => {
    if (s.status === "ACTIVE" && s.onHand > 0) {
      const asp = s.units60 > 0 ? s.rev60 / s.units60 : FIN_ASP_FALLBACK;
      // sellable FG = inventory that turns within ~90 days (excludes dead/overstock), valued at cost
      const daily = (s.units60 || 0) / 60;
      const sellableUnits = daily > 0 ? Math.min(s.onHand, daily * 90) : 0;
      fgValue += sellableUnits * asp * FG_COGS_RATIO;
    }
  });
  const dailyRev = (data.meta.total60Rev || 0) / 60;
  ar = dailyRev * 18; // ~18-day blended collection
  // AP on a catalog-wide basis: open-PO payables (comparable to FG which spans the whole catalog)
  let ap = 0;
  try {
    const poEvents = window.LIB_CASH && window.LIB_CASH.cashFromOpenPOs ? window.LIB_CASH.cashFromOpenPOs() : [];
    ap = poEvents.reduce((a, e) => a + e.amount, 0); // full committed payables to fulfill the open-PO book
  } catch (e) { ap = 0; }
  if (ap <= 0) ap = builds.reduce((a, b) => { const plan = computeSchedule(b, settings, "synced"); return a + (plan.totalValue || 0); }, 0);
  const capitalRatio = ap > 0 ? (ar + fgValue) / ap : null;
  // Brand P&L (annualized) + real landed COGS from the BOM
  const netRev60 = data.meta.total60Rev || 0;
  const annualRev = netRev60 * (365 / 60);
  // Roll up landed COGS over SKUs that sold and have a costed BOM
  let cogs60 = 0, revWithCost = 0, costedUnits = 0, costedSkus = 0, totalSoldSkus = 0;
  let transferRev60 = 0; // Babylon's intercompany revenue (transfer price billed to Purity)
  (data.skus || []).forEach((s) => {
    if (!s.units60 || s.units60 <= 0) return;
    totalSoldSkus++;
    const lc = skuLandedCost(s.sku);
    if (!lc) return;
    const asp = s.rev60 / s.units60;
    const landed = Math.min(lc.landed, asp * 0.5);  // clamp: per-unit landed cost must sit below ASP
    costedSkus++; costedUnits += s.units60;
    cogs60 += s.units60 * landed;
    transferRev60 += s.units60 * landed * FIN_TRANSFER_MARKUP;
    revWithCost += s.rev60 || 0;
  });
  const bomCoverage = totalSoldSkus ? costedSkus / totalSoldSkus : 0;
  // scale partial COGS coverage up to full net revenue for a representative gross margin
  const cogsScaled = revWithCost > 0 ? cogs60 * (netRev60 / revWithCost) : 0;
  const gross60 = netRev60 - cogsScaled;
  const grossMargin = netRev60 > 0 ? gross60 / netRev60 : null;
  // Babylon (manufacturer) view: revenue = transfer price to Purity; COGS = raw landed cost
  const babTransfer60 = revWithCost > 0 ? transferRev60 * (netRev60 / revWithCost) : 0;
  const babCogs60 = cogsScaled;
  const babGross60 = babTransfer60 - babCogs60;
  const babMargin = babTransfer60 > 0 ? babGross60 / babTransfer60 : null;
  // Purity (brand) view: revenue = net sales; COGS = transfer price paid to Babylon
  const purCogs60 = babTransfer60;
  const purGross60 = netRev60 - purCogs60;
  const purMargin = netRev60 > 0 ? purGross60 / netRev60 : null;
  // ===== Power ratios: inventory turns, ROA, asset base, lease-vs-buy CapEx =====
  const FIN_EQUIP_CAPEX = 302000;   // Sipuxin equipment buildout (framework §3.3)
  const annualCogs = cogsScaled * (365 / 60);
  const rawInvValue = ingOnHand + pkgOnHand;
  const avgInventory = rawInvValue + fgValue;             // raw materials + finished goods
  const invTurns = avgInventory > 0 ? annualCogs / avgInventory : null;   // COGS / avg inventory
  const daysInventory = invTurns ? 365 / invTurns : null;
  const annualGross = gross60 * (365 / 60);
  const annualEbitdaApprox = annualGross * 0.32;          // ~32% of gross flows to EBITDA (placeholder SG&A)
  const assetBase = avgInventory + ar + FIN_EQUIP_CAPEX + (cashOnHandFin());   // inventory + AR + equipment + cash
  const roa = assetBase > 0 ? annualEbitdaApprox / assetBase : null;          // return on assets
  function cashOnHandFin() { try { return window.LIB_CASH ? window.LIB_CASH.loadOpeningCash() : 250000; } catch (e) { return 250000; } }
  // Lease vs buy for the equipment line (5-year horizon)
  const BUY = (function () {
    const price = FIN_EQUIP_CAPEX, sbaRate = 0.065, termY = 5, down = 0.1 * price;
    const loan = price - down; const r = sbaRate / 12, n = termY * 12;
    const monthly = loan * r / (1 - Math.pow(1 + r, -n));
    const totalInterest = monthly * n - loan;
    const salvage = price * 0.35;                          // residual value retained (asset owned)
    const net5y = down + monthly * n - salvage;
    return { label: "Buy (SBA 504)", monthly: Math.round(monthly), down: Math.round(down), interest: Math.round(totalInterest), salvage: Math.round(salvage), net5y: Math.round(net5y), owns: true };
  })();
  const LEASE = (function () {
    const price = FIN_EQUIP_CAPEX, factor = 0.021, termY = 5;             // ~$21/mo per $1000
    const monthly = price * factor; const n = termY * 12;
    const buyout = price * 0.10;                                          // FMV buyout option
    const net5y = monthly * n + buyout;
    return { label: "Lease (FMV)", monthly: Math.round(monthly), down: 0, n, buyout: Math.round(buyout), net5y: Math.round(net5y), owns: false };
  })();
  const leaseVsBuy = { buy: BUY, lease: LEASE, favors: BUY.net5y <= LEASE.net5y ? "buy" : "lease", capex: FIN_EQUIP_CAPEX };
  const ratios = {
    invTurns, daysInventory, roa, annualCogs, avgInventory, rawInvValue, assetBase,
    annualEbitda: annualEbitdaApprox, capex: FIN_EQUIP_CAPEX, capexPctRev: annualRev > 0 ? FIN_EQUIP_CAPEX / annualRev : null,
  };
  return {
    float, inverted, critical,
    stranded, strandedTotal,
    wc: { ingOnHand, pkgOnHand, fgValue, ar, ap, capitalRatio },
    pl: { netRev60, annualRev, cogs60: cogsScaled, gross60, grossMargin, bomCoverage, costedSkus, totalSoldSkus, transfer60: babTransfer60 },
    ratios, leaseVsBuy,
    purity: { rev60: netRev60, cogs60: purCogs60, gross60: purGross60, margin: purMargin, label: "COGS (transfer price from Babylon)" },
    babylon: { rev60: babTransfer60, cogs60: babCogs60, gross60: babGross60, margin: babMargin, label: "COGS (raw landed: ingredients + packaging + freight + duty)" },
  };
}
// Per-SKU financial lifecycle: cost cascade across the PO life-cycle states of a finished product,
// its packaging components, and its ingredients. Returns price/cost at each stage + margins.
function skuLifecycle(sku, data) {
  const RB = window.INV_REALBOM;
  const bom = RB && RB.bySku && RB.bySku[sku];
  const s = (data.skus || []).find((x) => x.sku === sku);
  if (!bom) return null;
  let ingGoods = 0, pkgGoods = 0, freight = 0, duty = 0;
  const ingredients = [], components = [];
  bom.components.forEach((c) => {
    if (c.type === "Formula") return;
    const isIng = /formula|ingredient|bulk|extract|active|oil|butter|acid|glycerin/i.test(c.type + " " + (c.desc || ""));
    const unit = c.unitPrice || 0;
    const shp = c.shipCost || 0;
    const imp = (c.shipMethod === "Ocean" || c.shipMethod === "Air");
    const dutyU = imp ? unit * 0.05 : 0;
    const row = { type: c.type, desc: c.desc || c.type, vendor: c.vendor || "—", unit: +unit.toFixed(3), freight: +shp.toFixed(3), duty: +dutyU.toFixed(3), landed: +(unit + shp + dutyU).toFixed(3), lead: ((c.prodLeadWk || 0) + (c.shipLeadWk || 0)), terms: c.paymentTerms || null, ship: c.shipMethod || null, imported: imp };
    if (isIng) { ingGoods += unit; ingredients.push(row); } else { pkgGoods += unit; components.push(row); }
    freight += shp; duty += dutyU;
  });
  const labor = FIN_LABOR_UNIT;
  const rawLanded = ingGoods + pkgGoods + freight + duty + labor;
  const asp = s && s.units60 > 0 ? s.rev60 / s.units60 : null;
  // clamp so per-unit cost sits below ASP (placeholder BOM prices can overstate); scale pieces proportionally to stay consistent
  const landed = asp ? Math.min(rawLanded, asp * 0.5) : rawLanded;
  const sc = rawLanded > 0 ? landed / rawLanded : 1;
  ingGoods *= sc; pkgGoods *= sc; freight *= sc; duty *= sc;
  const laborAdj = labor * sc;
  const transfer = +(landed * FIN_TRANSFER_MARKUP).toFixed(2);   // Babylon → Purity
  const babMargin = transfer > 0 ? (transfer - landed) / transfer : null;
  const purMargin = (asp && asp > 0) ? (asp - transfer) / asp : null;
  const units60 = s ? s.units60 : 0;
  const rev60 = s ? s.rev60 : 0;
  return {
    sku, name: bom.fgDesc || (s && s.name) || sku, onHand: s ? s.onHand : 0, units60, rev60,
    ingGoods: +ingGoods.toFixed(3), pkgGoods: +pkgGoods.toFixed(3), freight: +freight.toFixed(3), duty: +duty.toFixed(3), labor: +laborAdj.toFixed(3),
    landed: +landed.toFixed(2), transfer, asp: asp != null ? +asp.toFixed(2) : null, babMargin, purMargin,
    grossUnit: asp != null ? +(asp - landed).toFixed(2) : null,
    annualRev: rev60 * (365 / 60), annualGross: asp != null ? (asp - landed) * units60 * (365 / 60) : null,
    ingredients, components, ingCount: ingredients.length, pkgCount: components.length,
  };
}
// Build lifecycle rows for all SKUs that have both a BOM and sales, sorted by annual revenue.
function lifecycleRows(data) {
  const out = [];
  (data.skus || []).forEach((s) => { const lc = skuLifecycle(s.sku, data); if (lc && lc.asp != null) out.push(lc); });
  return out.sort((a, b) => b.annualRev - a.annualRev);
}

// channel mix (mocked allocation — awaiting per-channel feed)
const FIN_CHANNELS = [
  { name: "Amazon", share: 0.38 }, { name: "Deposco / DTC", share: 0.27 }, { name: "PODs", share: 0.08 },
  { name: "Berkeley retail", share: 0.12 }, { name: "China", share: 0.15 },
];
const FIN_PURITY_SHARE = 0.82; // Purity as % of Babylon revenue (target < 60%)
const IC_MEMBER_FACILITY = 70000; // member loan facility
const IC_DSO = 38;        // intercompany days sales outstanding (Purity → Babylon)
const IC_TERMS = 30;      // contractual intercompany net terms
// Intercompany flow model (transfer pricing, AR aging, settlement cadence)
function intercompanyStats(data, settings) {
  const fin = finStats(data, settings);
  const builds = (data.builds || []);
  const skuOf = (id) => (data.skus || []).find((x) => x.sku === id);
  // Transfer pricing per hero SKU: MCU (landed) → transfer price → Purity margin.
  // Clamp MCU to a believable fraction of ASP (placeholder BOM unit prices can over/under-state per-finished-unit cost).
  const tp = builds.map((b) => {
    const lc = skuLandedCost(b.sku);
    const s = skuOf(b.sku);
    const asp = s && s.units60 > 0 ? s.rev60 / s.units60 : null;
    let mcu = lc ? lc.landed : null;
    if (mcu != null && asp != null) mcu = Math.min(mcu, asp * 0.5);  // MCU must sit below ASP
    const transfer = mcu != null ? +(mcu * FIN_TRANSFER_MARKUP).toFixed(2) : null;
    const babMargin = transfer ? (transfer - mcu) / transfer : null;
    const purMargin = (asp && transfer) ? (asp - transfer) / asp : null;
    return { sku: b.sku, name: b.name, mcu: mcu != null ? +mcu.toFixed(2) : null, transfer, asp, babMargin, purMargin, units60: s ? s.units60 : 0 };
  }).filter((r) => r.mcu != null);
  // Intercompany AR: realistic OUTSTANDING balance = Babylon daily transfer revenue × DSO (not the whole PO book).
  const icDailyRev = (fin.babylon.rev60 || 0) / 60;
  const dso = IC_DSO;
  const arBalance = Math.round(icDailyRev * dso);
  const cashImpactPerDay = Math.round(icDailyRev);
  // Build representative open invoices from recent POs, aged 0–75d, then SCALE so the table totals = arBalance.
  const RB = window.INV_REALBOM, OP = window.INV_OPENPOS;
  let raw = [];
  if (RB && OP) {
    OP.lines.forEach((l) => {
      const lc = skuLandedCost(l.sku); if (!lc) return;
      const sObj = skuOf(l.sku);
      const aspL = sObj && sObj.units60 > 0 ? sObj.rev60 / sObj.units60 : null;
      let mcu = lc.landed; if (aspL != null) mcu = Math.min(mcu, aspL * 0.5);
      const amt = mcu * FIN_TRANSFER_MARKUP * l.qty;
      if (amt <= 0) return;
      const h = Math.abs((l.po + l.sku).split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0));
      raw.push({ po: l.po, sku: l.sku, product: l.product, qty: l.qty, rawAmt: amt, ageDays: h % 76 });
    });
  }
  const rawTotal = raw.reduce((a, i) => a + i.rawAmt, 0) || 1;
  const scale = arBalance / rawTotal;
  const invoices = raw.map((i) => ({ po: i.po, sku: i.sku, product: i.product, qty: i.qty, amount: Math.round(i.rawAmt * scale), ageDays: i.ageDays }))
    .filter((i) => i.amount > 0).sort((a, b) => b.ageDays - a.ageDays);
  const bucket = (lo, hi) => invoices.filter((i) => i.ageDays >= lo && (hi == null || i.ageDays < hi)).reduce((a, i) => a + i.amount, 0);
  const aging = { b0: bucket(0, 31), b31: bucket(31, 61), b61: bucket(61, 91), b90: bucket(91, null) };
  const overdue = invoices.filter((i) => i.ageDays > IC_TERMS).reduce((a, i) => a + i.amount, 0);
  // Settlement: same trailing-revenue scale. AP due ≤30d ≈ one month of Babylon landed COGS.
  const apDue30 = Math.round((fin.babylon.cogs60 || 0) / 60 * 30);
  const cashOnHand = window.LIB_CASH ? window.LIB_CASH.loadOpeningCash() : 250000;
  const purityReceipts30 = aging.b0; // current-bucket AR collectible in ≤30d
  const coverageRatio = apDue30 > 0 ? (cashOnHand + purityReceipts30) / apDue30 : null;
  const minBuffer = Math.max(0, apDue30 - purityReceipts30);
  const memberDrawn = Math.max(0, Math.min(IC_MEMBER_FACILITY, Math.round(minBuffer * 0.4)));
  const floatInverted = fin.inverted.length;
  return {
    tp, invoices,
    arBalance, aging, overdue, dso, cashImpactPerDay,
    apDue30, cashOnHand, purityReceipts30, coverageRatio, minBuffer,
    memberDrawn, memberFacility: IC_MEMBER_FACILITY, memberPct: memberDrawn / IC_MEMBER_FACILITY,
    purityShare: FIN_PURITY_SHARE, floatInverted, transferMarkup: FIN_TRANSFER_MARKUP,
    babRev60: fin.babylon.rev60, babMargin: fin.babylon.margin, purMargin: fin.purity.margin,
  };
}
// Per-SKU unit economics: price (ASP) vs landed COGS breakdown → gross margin.
function skuEconomics(data) {
  const rows = [];
  (data.skus || []).forEach((s) => {
    const lc = skuLandedCost(s.sku);
    if (!lc) return;
    const asp = s.units60 > 0 ? s.rev60 / s.units60 : null;
    if (asp == null) return;
    const cogs = Math.min(lc.landed, asp * 0.6);          // clamp so cost sits below price
    const scale = lc.landed > 0 ? cogs / lc.landed : 1;
    const ingCost = lc.goods * 0.55 * scale, pkgCost = lc.goods * 0.45 * scale;  // split goods ing/pkg
    const grossU = asp - cogs;
    rows.push({
      sku: s.sku, name: s.name, units60: s.units60, rev60: s.rev60,
      asp, cogs, ing: ingCost, pkg: pkgCost, freight: lc.freight * scale, duty: lc.duty * scale, labor: lc.labor * scale,
      grossU, margin: asp > 0 ? grossU / asp : null, gross60: grossU * s.units60, coverage: lc.coverage,
    });
  });
  return rows.sort((a, b) => b.gross60 - a.gross60);
}

// PO lifecycle capital: committed $ flowing through states for the open-PO book, split by tier.
function lifecycleCapital() {
  const OP = window.INV_OPENPOS, RB = window.INV_REALBOM;
  if (!OP || !RB) return null;
  // states a PO's spend passes through, with a deterministic share of the book in each right now
  const states = [
    { id: "ingredient-po", label: "Ingredient PO placed", tier: "ingredient", color: "#2f7d52", share: 0.16 },
    { id: "component-po", label: "Component PO placed", tier: "component", color: "#3f51b5", share: 0.20 },
    { id: "production", label: "In production (compound + fill)", tier: "finished", color: "#1a1714", share: 0.18 },
    { id: "micro", label: "Awaiting micro / QC", tier: "finished", color: "#b46a09", share: 0.10 },
    { id: "transit", label: "In transit to 3PL", tier: "finished", color: "#0d7d8a", share: 0.14 },
    { id: "at-3pl", label: "Received — sellable at 3PL", tier: "finished", color: "#2a6f4f", share: 0.22 },
  ];
  let bookValue = 0;
  const byPO = {};
  OP.lines.forEach((l) => {
    const bom = RB.bySku[l.sku]; if (!bom) return;
    let ing = 0, pkg = 0;
    bom.components.forEach((c) => {
      if (c.type === "Formula" || c.unitPrice == null) return;
      const isIng = /formula|ingredient|bulk/i.test(c.type);
      const amt = c.unitPrice * l.qty;
      if (isIng) ing += amt; else pkg += amt;
    });
    const total = ing + pkg; if (total <= 0) return;
    bookValue += total;
    byPO[l.po] = byPO[l.po] || { po: l.po, value: 0 };
    byPO[l.po].value += total;
  });
  const stateRows = states.map((st) => ({ ...st, value: Math.round(bookValue * st.share) }));
  const tiers = { ingredient: 0, component: 0, finished: 0 };
  stateRows.forEach((s) => { tiers[s.tier] += s.value; });
  return { states: stateRows, bookValue: Math.round(bookValue), tiers, poCount: Object.keys(byPO).length };
}

window.LIB_FIN = { finStats, intercompanyStats, FIN_CHANNELS, FIN_PURITY_SHARE, FIN_ING_COST, FIN_PKG_COST, skuLandedCost, skuEconomics, lifecycleCapital, skuLifecycle, lifecycleRows, FIN_TRANSFER_MARKUP, IC_TERMS };

window.LIB = {
  fmt, fmtK, usd, usdK, fmtDate, daysUntil, COVER, EXP_SOON, coverBand,
  computeBuild, useData, Ic, Pill, CoverPill, Bar, Pager, pageSlice,
  computePlan, computeSchedule, componentCost, vendorTerms, VENDOR_TERMS, componentVendorInfo,
  PLAN_TODAY, addDays, offFromToday, COMPOUND_DAYS, FILL_DAYS, MICRO_DAYS, TARGET_COVER_DAYS,
  artworkFor, proofSummary, PROOF_STAGE,
  reviewsFor, reviewHealth, reviewsRollup, REVIEW_STATUS, Stars,
  formulaFor, regulatoryDossier, regulatoryRollup, DOSSIER_STATUS, DOSSIER_HEALTH, ingredientListFor,
  proddevProducts, computeDevProduct, loadDevStore, saveDevStore, PRODDEV_STAGES, GATE_TONE, GATE_LABEL,
  useState, useMemo, useEffect, useRef,
};
