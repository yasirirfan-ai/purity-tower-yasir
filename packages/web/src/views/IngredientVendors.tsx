import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { Ic } from '../lib/icons';
import { num, money } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';

interface IngLine { code: string; inci: string; pricePerKg: number | null; allergens: string[]; leadTime?: string; naturalOriginPct?: number }
interface IngredientVendor {
  vendor: string; count: number; avgPricePerKg: number | null; ingredients: IngLine[];
  country?: string; imported?: boolean; freightPerKg?: number | null; contactEmail?: string | null;
}
interface VendorsData { component: unknown[]; ingredient: IngredientVendor[] }

const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };

export function IngredientVendors() {
  const { data, loading, error } = useFetch<VendorsData>('/api/vendors');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [term, setTerm] = useState('all');

  const { rows, ingTotal, withAllergens, countries } = useMemo(() => {
    const all = data?.ingredient ?? [];
    const ingTotal = all.reduce((a, v) => a + v.count, 0);
    const withAllergens = all.reduce((a, v) => a + v.ingredients.filter((i) => (i.allergens ?? []).length > 0).length, 0);
    const cs: Record<string, number> = {};
    all.forEach((v) => {
      const c = v.country ?? (v.imported ? 'China' : 'US');
      cs[c] = (cs[c] ?? 0) + 1;
    });
    let r = all;
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((v) => (v.vendor + ' ' + v.ingredients.map((i) => i.inci).join(' ')).toLowerCase().includes(t));
    if (term === 'allergen') r = r.filter((v) => v.ingredients.some((i) => (i.allergens ?? []).length > 0));
    if (country !== 'all') r = r.filter((v) => (v.country ?? (v.imported ? 'China' : 'US')) === country);
    return { rows: r, ingTotal, withAllergens, countries: cs };
  }, [data, q, term, country]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const all = data?.ingredient ?? [];
  const prices = all.map((v) => v.avgPricePerKg).filter((p): p is number => p != null);
  const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

  const kpis = [
    { label: 'Ingredient vendors', value: num(all.length), sub: `${ingTotal} ingredients supplied`, edge: 'var(--ink)', icon: Ic.flask },
    { label: 'Avg price / kg', value: avgPrice != null ? money(avgPrice) : '—', sub: 'across active ingredients', edge: 'var(--cap)', icon: Ic.scale },
    { label: 'With allergens', value: num(withAllergens), sub: 'flagged ingredient lines', edge: 'var(--warn)', icon: Ic.alert },
    { label: 'Total ingredients', value: num(ingTotal), sub: `${all.length} supplier${all.length !== 1 ? 's' : ''}`, edge: 'var(--good)', icon: Ic.box },
  ];

  return (
    <div className="fade-in">
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="accent-edge" style={{ background: k.edge }} />
            <div className="label">{k.icon(ICO)}{k.label}</div>
            <div className="value">{k.value}</div>
            <div className="sub">{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '22px 0 16px', flexWrap: 'wrap' }}>
        <div className="search">
          {Ic.search({ style: { width: 15, height: 15, color: 'var(--faint)', flex: 'none' } })}
          <input placeholder="Search vendor or INCI…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button onClick={() => setQ('')} style={{ color: 'var(--faint)', display: 'flex' }}>
              {Ic.x({ style: { width: 14, height: 14 } })}
            </button>
          )}
        </div>
        {Object.keys(countries).length > 1 && (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <button className={`tag${country === 'all' ? ' on' : ''}`} onClick={() => setCountry('all')}>All</button>
            {Object.entries(countries).map(([c, n]) => (
              <button key={c} className={`tag${country === c ? ' on' : ''}`} onClick={() => setCountry(c)}>{c} ({n})</button>
            ))}
          </div>
        )}
        <div className="seg">
          <button className={term === 'all' ? 'on' : ''} onClick={() => setTerm('all')}>All vendors</button>
          <button className={term === 'allergen' ? 'on' : ''} onClick={() => setTerm('allergen')}>Has allergens</button>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }} className="tnum">{num(rows.length)} of {num(all.length)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 14 }}>
        {rows.map((v) => <IngCard key={v.vendor} v={v} />)}
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', gridColumn: '1/-1' }}>
            No vendors match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function IngCard({ v }: { v: IngredientVendor }) {
  const [open, setOpen] = useState(false);
  const [bol, setBol] = useState<{ name: string; uploaded: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem('babylon_bol_' + v.vendor) ?? 'null') as { name: string; uploaded: string } | null; }
    catch { return null; }
  });

  const show = open ? v.ingredients : v.ingredients.slice(0, 8);
  const allergenCount = v.ingredients.filter((i) => (i.allergens ?? []).length > 0).length;
  const isImported = v.imported ?? false;

  const onBol = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rec = { name: file.name, uploaded: new Date().toISOString().slice(0, 10) };
    try { localStorage.setItem('babylon_bol_' + v.vendor, JSON.stringify(rec)); } catch {}
    setBol(rec);
  };
  const clearBol = () => {
    try { localStorage.removeItem('babylon_bol_' + v.vendor); } catch {}
    setBol(null);
  };

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isImported
              ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: '#fbeee6', color: '#9a5418', borderRadius: 3, padding: '1px 5px' }}>IMP</span>
              : <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--cap-tint)', color: 'var(--cap)', borderRadius: 3, padding: '1px 5px' }}>DOM</span>
            }
            {v.country ?? (isImported ? 'China' : 'US')}
            {allergenCount > 0 && <span className="pill warn" style={{ marginLeft: 4, fontSize: 10 }}>⚠ {allergenCount} allergen</span>}
          </div>
        </div>
        {v.avgPricePerKg != null && (
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>{money(v.avgPricePerKg)}<span style={{ fontSize: 10.5, color: 'var(--muted)', fontWeight: 400 }}>/kg</span></div>
            {v.freightPerKg != null && <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>+{money(v.freightPerKg)}/kg freight</div>}
          </div>
        )}
      </div>

      {/* Ingredients */}
      <div>
        <div className="eyebrow" style={{ marginBottom: 6 }}>{v.count} ingredient{v.count !== 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {show.map((g, i) => (
            <span
              key={i}
              title={(g.allergens ?? []).length ? 'Allergens: ' + (g.allergens ?? []).join(', ') : g.inci}
              style={{ fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}
            >
              {g.inci}{(g.allergens ?? []).length ? ' ⚠' : ''}
            </span>
          ))}
          {v.ingredients.length > 8 && (
            <button className="tag" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => setOpen(!open)}>
              {open ? 'Show less' : `+${v.ingredients.length - 8} more`}
              {Ic.down({ style: { width: 11, height: 11, marginLeft: 3, transform: open ? 'rotate(180deg)' : 'none' } })}
            </button>
          )}
        </div>
      </div>

      {/* Contact info */}
      {v.contactEmail && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid var(--hairline)', paddingTop: 9 }}>
          {Ic.channels({ style: { width: 13, height: 13, color: 'var(--faint)', flex: 'none' } })}
          <span>{v.contactEmail}</span>
        </div>
      )}

      {/* BOL */}
      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Bill of Lading</div>
        {bol ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
            <span style={{ width: 20, height: 20, borderRadius: 5, background: 'var(--good-tint)', color: 'var(--good)', display: 'grid', placeItems: 'center', flex: 'none' }}>
              {Ic.check({ style: { width: 12, height: 12 } })}
            </span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {bol.name} <span style={{ color: 'var(--faint)' }}>· {bol.uploaded}</span>
            </span>
            <button className="tag" style={{ fontSize: 10.5, padding: '2px 8px' }} onClick={clearBol}>Remove</button>
          </div>
        ) : (
          <label className="tag" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {Ic.plus({ style: { width: 13, height: 13 } })} Upload BOL
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" style={{ display: 'none' }} onChange={onBol} />
          </label>
        )}
      </div>
    </div>
  );
}
