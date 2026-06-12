/* global React, ReactDOM, LIB, VIEWS, VIEWS2, VIEWS3, VIEWS4, VIEWS5, VIEWS6, VIEWS7, VIEWS8, VIEWS9, VIEWS10, useTweaks, TweaksPanel, TweakSection, TweakSlider */
const { useData, Ic, useState } = LIB;
const { Overview } = VIEWS;
const { Predictor } = VIEWS2;
const { Inventory, Channels, Recon } = VIEWS3;
const { OrderPlanner } = VIEWS4;
const { ProductDevelopment } = VIEWS5;
const { ComponentVendors } = VIEWS6;
const { IngredientVendors } = VIEWS7;
const { CashPlanner } = VIEWS8;
const { Finance } = VIEWS9;
const { Intercompany } = VIEWS10;

const NAV = [
  { id: "overview", label: "Overview", icon: Ic.grid },
  { id: "predictor", label: "Match-rate predictor", icon: Ic.scale, star: true },
  { id: "planner", label: "What to order", icon: Ic.recon },
  { id: "cash", label: "Cash planner", icon: Ic.scale },
  { id: "finance", label: "Finance", icon: Ic.trend },
  { id: "intercompany", label: "Intercompany", icon: Ic.recon },
  { id: "inventory", label: "Inventory", icon: Ic.box },
  { id: "channels", label: "Channels", icon: Ic.channels },
  { id: "vendors", label: "Component vendors", icon: Ic.channels },
  { id: "ingvendors", label: "Ingredient vendors", icon: Ic.flask },
  { id: "recon", label: "Reconciliation", icon: Ic.recon },
  { id: "proddev", label: "Product development", icon: Ic.flask, group: "Develop" },
];
const TITLES = {
  overview: ["Total Available Inventory", "Live position across the 3PL pool"],
  predictor: ["Match-rate predictor", "Ingredients vs. packaging — what you can actually ship"],
  planner: ["What to order", "Vendor lead times scheduled backward from each stock-out"],
  cash: ["Cash planner", "Vendor payables for ingredients & packaging, dated by net terms"],
  finance: ["Finance", "Float, working capital, stranded cash & brand P&L"],
  intercompany: ["Intercompany", "Transfer pricing, AR aging & cash settlement between Babylon & Purity"],
  inventory: ["Inventory", "Every SKU, sortable by velocity, cover and expiry"],
  channels: ["Sales channels", "Unified inventory split — awaiting channel feeds"],
  vendors: ["Component vendors", "Active component suppliers — terms, country & incoterms"],
  ingvendors: ["Ingredient vendors", "Active raw-material suppliers — ingredients, country & lead time"],
  recon: ["Lot reconciliation", "Production lots matched against the warehouse"],
  proddev: ["Product development", "Formulate new SKUs and push them to production"],
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "compound": 12,
  "fill": 8,
  "cover": 120
}/*EDITMODE-END*/;

function App() {
  const data = useData();
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const settings = { compound: t.compound, fill: t.fill, cover: t.cover };
  const [view, setView] = useState("overview");
  const [navArg, setNavArg] = useState(null);

  const go = (v, arg) => { setView(v); setNavArg(arg || null); window.scrollTo(0, 0); };
  const critCount = data.flags.stockout.length + data.flags.critical.length;
  const [title, sub] = TITLES[view];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">
            <div className="glyph">
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M7 7h10M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7z" /></svg>
            </div>
            <div>
              <div className="name">Inventory Sync</div>
              <div className="sub">Babylon × Purity</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          <div className="nav-label">Operations</div>
          {NAV.map((n) => (
            <React.Fragment key={n.id}>
              {n.group && <div className="nav-label" style={{ marginTop: 10 }}>{n.group}</div>}
              <button className={"nav-item" + (view === n.id ? " active" : "")} onClick={() => go(n.id)}>
                {n.icon({})}
                <span>{n.label}</span>
                {n.id === "inventory" && critCount > 0 && <span className="badge">{critCount}</span>}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-foot">
          Data as of {data.meta.generated}<br />
          {data.meta.totalSkus} SKUs · 60-day window
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="crumb">{sub}</div>
            <h1>{title}</h1>
          </div>
          <div className="meta">
            <span><span className="dot" />3PL feed connected</span>
            <span className="mono">Updated 02 Jun 2026</span>
          </div>
        </header>
        <div className="content">
          {view === "overview" && <Overview data={data} go={go} />}
          {view === "predictor" && <Predictor data={data} />}
          {view === "planner" && <OrderPlanner data={data} settings={settings} />}
          {view === "cash" && <CashPlanner data={data} settings={settings} />}
          {view === "finance" && <Finance data={data} settings={settings} />}
          {view === "intercompany" && <Intercompany data={data} settings={settings} />}
          {view === "inventory" && <Inventory data={data} initial={navArg} key={navArg ? navArg.band : "all"} />}
          {view === "channels" && <Channels data={data} />}
          {view === "vendors" && <ComponentVendors />}
          {view === "ingvendors" && <IngredientVendors />}
          {view === "recon" && <Recon data={data} />}
          {view === "proddev" && <ProductDevelopment />}
        </div>
      </main>

      <TweaksPanel>
        <TweakSection label="Production lead times" />
        <TweakSlider label="Compounding + QC" value={t.compound} min={5} max={30} step={1} unit="d" onChange={(v) => setTweak("compound", v)} />
        <TweakSlider label="Fill & release" value={t.fill} min={3} max={21} step={1} unit="d" onChange={(v) => setTweak("fill", v)} />
        <TweakSection label="Replenishment" />
        <TweakSlider label="Target cover window" value={t.cover} min={60} max={240} step={10} unit="d" onChange={(v) => setTweak("cover", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
