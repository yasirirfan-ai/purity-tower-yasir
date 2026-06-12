import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { Ic } from '../lib/icons';
import { num } from '../lib/format';
import { Loading, ErrorState } from '../components/ui';

interface ComponentVendor {
  vendor: string; country: string; imported: boolean; poCount: number; lineCount: number;
  openQty: number; orderedQty: number; earliestOrder: string | null; latestEta: string | null; sample: string | null;
}
interface VendorsData { component: ComponentVendor[]; ingredient: unknown[] }

const ICO = { style: { width: 14, height: 14, color: 'var(--faint)' } };

export function ComponentVendors() {
  const { data, loading, error } = useFetch<VendorsData>('/api/vendors');
  const [q, setQ] = useState('');
  const [country, setCountry] = useState('all');
  const [terms, setTerms] = useState<'all' | 'prepaid' | 'net'>('all');

  const { rows, countries, imported, domestic } = useMemo(() => {
    const all = data?.component ?? [];
    const cs: Record<string, number> = {};
    all.forEach((v) => { cs[v.country] = (cs[v.country] ?? 0) + 1; });
    const imported = all.filter((v) => v.imported).length;
    const domestic = all.length - imported;
    let r = all;
    if (country !== 'all') r = r.filter((v) => v.country === country);
    if (terms === 'prepaid') r = r.filter((v) => v.imported);
    else if (terms === 'net') r = r.filter((v) => !v.imported);
    const t = q.trim().toLowerCase();
    if (t) r = r.filter((v) => (v.vendor + ' ' + (v.sample ?? '')).toLowerCase().includes(t));
    return { rows: r, countries: cs, imported, domestic };
  }, [data, q, country, terms]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;

  const all = data?.component ?? [];
  const compLines = all.reduce((a, v) => a + v.lineCount, 0);
  const countryCount = Object.keys(countries).length;

  const kpis = [
    { label: 'Component vendors', value: num(all.length), sub: `${compLines} component lines`, edge: 'var(--ink)', icon: Ic.channels },
    { label: 'Countries', value: num(countryCount), sub: Object.entries(countries).map(([c, n]) => `${c} ${n}`).join(' · '), edge: 'var(--cap)', icon: Ic.box },
    { label: 'Imported vendors', value: num(imported), sub: 'freight + HTS risk', edge: 'var(--crit)', icon: Ic.scale },
    { label: 'Domestic vendors', value: num(domestic), sub: 'no import duties', edge: 'var(--good)', icon: Ic.recon },
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
          <input placeholder="Search vendor or component…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button onClick={() => setQ('')} style={{ color: 'var(--faint)', display: 'flex' }}>
              {Ic.x({ style: { width: 14, height: 14 } })}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          <button className={`tag${country === 'all' ? ' on' : ''}`} onClick={() => setCountry('all')}>All</button>
          {Object.entries(countries).map(([c, n]) => (
            <button key={c} className={`tag${country === c ? ' on' : ''}`} onClick={() => setCountry(c)}>{c} ({n})</button>
          ))}
        </div>
        <div className="seg">
          <button className={terms === 'all' ? 'on' : ''} onClick={() => setTerms('all')}>All</button>
          <button className={terms === 'prepaid' ? 'on' : ''} onClick={() => setTerms('prepaid')}>Prepaid</button>
          <button className={terms === 'net' ? 'on' : ''} onClick={() => setTerms('net')}>Net terms</button>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }} className="tnum">{num(rows.length)} of {num(all.length)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
        {rows.map((v) => <CompCard key={v.vendor} v={v} />)}
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', gridColumn: '1/-1' }}>
            No vendors match these filters.
          </div>
        )}
      </div>
    </div>
  );
}

function CompCard({ v }: { v: ComponentVendor }) {
  const sample = v.sample?.replace(/^\[[^\]]+\]\s*/, '') ?? '';
  const components = sample ? sample.split(/[,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 8) : [];
  const payTerm = v.imported ? 'Prepay' : 'Net 30';
  const payTone = v.imported ? 'crit' : 'good';

  return (
    <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 11 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>{v.vendor}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
            {v.imported
              ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: '#fbeee6', color: '#9a5418', borderRadius: 3, padding: '1px 5px' }}>CN</span>
              : <span className="mono" style={{ fontSize: 9.5, fontWeight: 800, background: 'var(--cap-tint)', color: 'var(--cap)', borderRadius: 3, padding: '1px 5px' }}>US</span>
            }
            {v.country}
          </div>
        </div>
        <span className={`pill ${payTone}`} style={{ fontSize: 10.5 }}>{payTerm}</span>
      </div>

      {components.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Components supplied</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {components.map((c, i) => (
              <span key={i} style={{ fontSize: 11.5, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px' }}>{c}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--hairline)', paddingTop: 9, fontSize: 11.5, color: 'var(--muted)', display: 'flex', gap: 7, alignItems: 'center' }}>
        {Ic.scale({ style: { width: 13, height: 13, color: 'var(--faint)', flex: 'none' } })}
        <span className="tnum">{num(v.openQty)} open · {num(v.lineCount)} lines · {v.poCount} PO{v.poCount !== 1 ? 's' : ''}</span>
        {v.latestEta && (
          <span style={{ marginLeft: 'auto', fontSize: 11 }}>ETA {v.latestEta.slice(0, 10)}</span>
        )}
      </div>
    </div>
  );
}
