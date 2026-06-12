import { createContext, useContext, useState, useEffect } from 'react';
import { useFetch, type Summary } from './lib/api';
import { Ic } from './lib/icons';
import { titleCase } from './lib/format';
import { SkuDrawer } from './components/SkuDrawer';
import { Overview } from './views/Overview';
import { Inventory } from './views/Inventory';
import { Readiness } from './views/Readiness';
import { WhatToOrder } from './views/WhatToOrder';
import { Channels } from './views/Channels';
import { ChannelDetail } from './views/ChannelDetail';
import { ProductDevelopment } from './views/ProductDevelopment';
import { ComponentVendors } from './views/ComponentVendors';
import { IngredientVendors } from './views/IngredientVendors';
import { CashPlanner } from './views/CashPlanner';
import { Finance } from './views/Finance';
import { Intercompany } from './views/Intercompany';

const SkuCtx = createContext<(sku: string) => void>(() => {});
export const useOpenSku = () => useContext(SkuCtx);

const ChannelCtx = createContext<(channel: string) => void>(() => {});
export const useOpenChannel = () => useContext(ChannelCtx);

const NavCtx = createContext<(id: ViewId) => void>(() => {});
export const useGoView = () => useContext(NavCtx);

type ViewId =
  | 'overview' | 'predictor' | 'planner' | 'cash' | 'finance'
  | 'intercompany' | 'inventory' | 'channels' | 'vendors' | 'ingvendors'
  | 'recon' | 'proddev';

type IconFn = typeof Ic.grid;

interface NavEntry {
  id: ViewId;
  label: string;
  crumb: string;
  title: string;
  icon: IconFn;
  star?: boolean;
  group?: string;
  badge?: (s: Summary | null) => number | undefined;
}

const NAV: NavEntry[] = [
  {
    id: 'overview', label: 'Overview',
    crumb: 'Live position across the 3PL pool', title: 'Total Available Inventory',
    icon: Ic.grid,
  },
  {
    id: 'predictor', label: 'Match-rate predictor',
    crumb: 'Ingredients vs. packaging — what you can actually ship', title: 'Match-rate predictor',
    icon: Ic.scale, star: true,
  },
  {
    id: 'planner', label: 'What to order',
    crumb: 'Vendor lead times scheduled backward from each stock-out', title: 'What to order',
    icon: Ic.recon,
  },
  {
    id: 'cash', label: 'Cash planner',
    crumb: 'Vendor payables for ingredients & packaging, dated by net terms', title: 'Cash planner',
    icon: Ic.scale,
  },
  {
    id: 'finance', label: 'Finance',
    crumb: 'Float, working capital, stranded cash & brand P&L', title: 'Finance',
    icon: Ic.trend,
  },
  {
    id: 'intercompany', label: 'Intercompany',
    crumb: 'Transfer pricing, AR aging & cash settlement between Babylon & Purity', title: 'Intercompany',
    icon: Ic.recon,
  },
  {
    id: 'inventory', label: 'Inventory',
    crumb: 'Every SKU, sortable by velocity, cover and expiry', title: 'Inventory',
    icon: Ic.box,
    badge: (s) => (s?.exception_counts?.stockout ?? 0) + (s?.exception_counts?.critical ?? 0),
  },
  {
    id: 'channels', label: 'Channels',
    crumb: 'Unified inventory split — awaiting channel feeds', title: 'Sales channels',
    icon: Ic.channels,
  },
  {
    id: 'vendors', label: 'Component vendors',
    crumb: 'Active component suppliers — terms, country & incoterms', title: 'Component vendors',
    icon: Ic.channels,
  },
  {
    id: 'ingvendors', label: 'Ingredient vendors',
    crumb: 'Active raw-material suppliers — ingredients, country & lead time', title: 'Ingredient vendors',
    icon: Ic.flask,
  },
  {
    id: 'recon', label: 'Reconciliation',
    crumb: 'Production lots matched against the warehouse', title: 'Lot reconciliation',
    icon: Ic.recon,
  },
  {
    id: 'proddev', label: 'Product development',
    crumb: 'Formulate new SKUs and push them to production', title: 'Product development',
    icon: Ic.flask, group: 'Develop',
  },
];

export function App() {
  const [view, setView] = useState<ViewId>('overview');
  const [openSkuId, setOpenSkuId] = useState<string | null>(null);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: summary } = useFetch<Summary>('/api/summary');
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const entry = NAV.find((n) => n.id === view) ?? NAV[0]!;

  const goView = (id: ViewId) => { setChannelId(null); setView(id); setSidebarOpen(false); window.scrollTo(0, 0); };

  useEffect(() => {
    const handler = () => { if (window.innerWidth > 768) setSidebarOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const navItem = (n: NavEntry) => {
    const badge = n.badge?.(summary);
    return (
      <button
        key={n.id}
        className={`nav-item${n.id === view && !channelId ? ' active' : ''}`}
        onClick={() => goView(n.id)}
      >
        {n.icon({})}
        <span>{n.label}</span>
        {badge ? <span className="badge">{badge}</span> : null}
      </button>
    );
  };

  const opsNav = NAV.filter((n) => !n.group);
  const devNav = NAV.filter((n) => n.group === 'Develop');

  return (
    <NavCtx.Provider value={goView}>
      <SkuCtx.Provider value={setOpenSkuId}>
      <ChannelCtx.Provider value={setChannelId}>
        <div className="app">

          {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

          <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
            <div className="brand">
              <div className="mark">
                <div className="glyph">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18M7 7h10M5 7l-2.5 6a3 3 0 0 0 5 0L5 7zM19 7l-2.5 6a3 3 0 0 0 5 0L19 7z" />
                  </svg>
                </div>
                <div>
                  <div className="name">Inventory Sync</div>
                  <div className="sub">Babylon × Purity</div>
                </div>
              </div>
            </div>

            <nav className="nav">
              <div className="nav-label">Operations</div>
              {opsNav.map(navItem)}

              {devNav.length > 0 && (
                <>
                  <div className="nav-label" style={{ marginTop: 10 }}>Develop</div>
                  {devNav.map(navItem)}
                </>
              )}
            </nav>

            <div className="sidebar-foot">
              Data as of {String(summary?.latest_ingestion_date ?? '…')}<br />
              {summary?.sku_count ?? '—'} SKUs · 60-day window
            </div>
          </aside>

          <main className="main">
            <header className="topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <button
                  className="mobile-menu-btn"
                  onClick={() => setSidebarOpen((o) => !o)}
                  aria-label="Toggle menu"
                >
                  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4.5" x2="16" y2="4.5" />
                    <line x1="2" y1="9" x2="16" y2="9" />
                    <line x1="2" y1="13.5" x2="16" y2="13.5" />
                  </svg>
                </button>
                <div style={{ minWidth: 0 }}>
                  <div className="crumb">{channelId ? 'Channels' : entry.crumb}</div>
                  <h1>{channelId ? `Channel · ${titleCase(channelId)}` : entry.title}</h1>
                </div>
              </div>
              <div className="meta">
                <span><span className="dot" />3PL feed connected</span>
                <span className="mono meta-skus">Updated {String(summary?.latest_ingestion_date ?? '…')}</span>
              </div>
            </header>

            <div className="content">
              {channelId
                ? <ChannelDetail channel={channelId} onBack={() => setChannelId(null)} />
                : (
                  <>
                    {view === 'overview'     && <Overview />}
                    {view === 'predictor'    && <Readiness />}
                    {view === 'planner'      && <WhatToOrder />}
                    {view === 'cash'         && <CashPlanner />}
                    {view === 'finance'      && <Finance />}
                    {view === 'intercompany' && <Intercompany />}
                    {view === 'inventory'    && <Inventory />}
                    {view === 'channels'     && <Channels />}
                    {view === 'vendors'      && <ComponentVendors />}
                    {view === 'ingvendors'   && <IngredientVendors />}
                    {view === 'recon'        && <Inventory />}
                    {view === 'proddev'      && <ProductDevelopment />}
                  </>
                )}
            </div>
          </main>
        </div>

        {openSkuId && <SkuDrawer sku={openSkuId} onClose={() => setOpenSkuId(null)} />}
      </ChannelCtx.Provider>
    </SkuCtx.Provider>
    </NavCtx.Provider>
  );
}
