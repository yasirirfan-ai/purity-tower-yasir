import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { Loading, ErrorState } from '../components/ui';
import type { FormulaListItem, FormulaDetail } from './pd/types';
import { PdBadge } from './pd/ui';
import { FormulaTab } from './pd/FormulaTab';
import { StabilityTab, ChallengeTab, ClaimsTab, IfraTab, DevTimelineTab, ArtworkTab } from './pd/tabs';

const TABS = ['Formula', 'Stability', 'Challenge', 'Claims', 'IFRA / Allergens', 'Artwork / Pkg', 'Dev timeline'] as const;
type Tab = (typeof TABS)[number];

export function ProductDevelopment() {
  const { data: formulas, loading, error } = useFetch<FormulaListItem[]>('/api/pd/formulas');
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('Formula');

  const list = useMemo(() => {
    let r = formulas ?? [];
    const q = search.trim().toLowerCase();
    if (q) r = r.filter((f) => `${f.name} ${f.sku} ${f.category}`.toLowerCase().includes(q));
    return r;
  }, [formulas, search]);

  const selected = selId ?? list[0]?.id ?? null;

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="order-layout">
      {/* Formulas browser */}
      <div className="card order-list">
        <div className="card-head" style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 }}>
          <h3>Formulas</h3><span className="hint">{list.length}</span>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div className="search" style={{ maxWidth: 'none' }}>
            <span className="muted">⌕</span>
            <input placeholder="Search name / SKU / category…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="order-list-scroll">
          {list.map((f) => (
            <button key={f.id} className={`order-item${selected === f.id ? ' sel' : ''}`} onClick={() => { setSelId(f.id); setTab('Formula'); }}>
              <div className="row-between">
                <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>{f.sku}</span>
                <PdBadge value={f.currentLabel} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3 }}>{f.name}</div>
              <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{f.category}{f.subcategory ? ` · ${f.subcategory}` : ''} · {f.versionCount} ver.</div>
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div>
        {selected ? <Editor formulaId={selected} tab={tab} setTab={setTab} /> : <div className="card card-pad muted">Select a formula.</div>}
      </div>
    </div>
  );
}

function Editor({ formulaId, tab, setTab }: { formulaId: string; tab: Tab; setTab: (t: Tab) => void }) {
  const { data, loading, error } = useFetch<FormulaDetail>(`/api/pd/formulas/${encodeURIComponent(formulaId)}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;
  const h = data.head;

  return (
    <>
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="mono muted" style={{ fontSize: 12 }}>{h.sku}</div>
            <h2 style={{ margin: '4px 0 0', fontSize: 19 }}>{h.name}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{h.category}{h.subcategory ? ` · ${h.subcategory}` : ''} · MoCRA: {h.mocraCategory ?? '—'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <PdBadge value={data.version?.label} />
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>v{data.version?.versionNumber} · {data.versions.length} version(s)</div>
          </div>
        </div>
      </div>

      {/* tab strip */}
      <div className="chip-bar" style={{ marginBottom: 16 }}>
        {TABS.map((t) => <button key={t} className={`tag${t === tab ? ' on' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Formula' && <FormulaTab detail={data} />}
      {tab === 'Stability' && <StabilityTab detail={data} />}
      {tab === 'Challenge' && <ChallengeTab detail={data} />}
      {tab === 'Claims' && <ClaimsTab detail={data} />}
      {tab === 'IFRA / Allergens' && <IfraTab detail={data} />}
      {tab === 'Artwork / Pkg' && <ArtworkTab />}
      {tab === 'Dev timeline' && <DevTimelineTab detail={data} />}
    </>
  );
}
