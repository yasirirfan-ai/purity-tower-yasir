import { useMemo, useState } from 'react';
import { useFetch } from '../lib/api';
import { num, pct, titleCase } from '../lib/format';
import { Kpi, Loading, ErrorState, Pill } from '../components/ui';
import { useOpenSku } from '../App';

interface Section { id: string; label: string; status: 'on-file' | 'pending' | 'missing' }
interface Dossier {
  sku: string; name: string; category: string; sections: Section[];
  onFile: number; total: number; missing: number; pct: number; dossierStatus: string;
}
interface RegData { dossiers: Dossier[]; note: string }

const statusBand = (s: string) => (s === 'on-file' ? 'good' : s === 'pending' ? 'warning' : 'critical');
const dossierBand = (s: string) => (s === 'complete' ? 'good' : s === 'partial' ? 'warning' : 'critical');

export function Regulatory() {
  const { data, loading, error } = useFetch<RegData>('/api/regulatory');
  const openSku = useOpenSku();
  const [filter, setFilter] = useState('all');

  const { rows, sectionLabels } = useMemo(() => {
    const all = data?.dossiers ?? [];
    const rows = filter === 'all' ? all : all.filter((d) => d.dossierStatus === filter);
    const sectionLabels = all[0]?.sections?.map((s) => s.label) ?? [];
    return { rows, sectionLabels };
  }, [data, filter]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const all = data?.dossiers ?? [];
  const avgPct = all.length ? all.reduce((a, d) => a + d.pct, 0) / all.length : 0;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="Dossiers" value={num(all.length)} edge="var(--accent)" />
        <Kpi label="Complete" value={num(all.filter((d) => d.dossierStatus === 'complete').length)} edge="var(--good)" />
        <Kpi label="Partial / gaps" value={num(all.filter((d) => d.dossierStatus !== 'complete').length)} edge="var(--warn)" />
        <Kpi label="Avg readiness" value={pct(avgPct * 100, 0)} edge="var(--cap)" />
      </div>

      <div className="card card-pad section-gap" style={{ background: 'var(--surface-2)' }}>
        <div className="eyebrow">Regulatory dossier</div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>{data?.note}</p>
      </div>

      <div className="chip-bar section-gap" style={{ marginBottom: 14 }}>
        {['all', 'complete', 'partial', 'gaps'].map((f) => <button key={f} className={`tag${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{titleCase(f)}</button>)}
      </div>

      <div className="card">
        <div className="card-head"><h3>Compliance records by formula</h3><span className="hint">{num(rows.length)} · click a row</span></div>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>SKU</th><th>Product</th><th className="num">Readiness</th>
                {sectionLabels.map((l) => <th key={l} style={{ writingMode: 'horizontal-tb' }}>{l}</th>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr className="row" key={d.sku} onClick={() => openSku(d.sku)}>
                  <td className="sku-cell">{d.sku}</td>
                  <td className="name-cell">{d.name}</td>
                  <td className="num">{pct(d.pct * 100, 0)} <span className="faint">({d.onFile}/{d.total})</span></td>
                  {(d.sections ?? []).map((s) => (
                    <td key={s.id} title={`${s.label}: ${s.status}`}>
                      <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: `var(--${statusBand(s.status)})`, opacity: s.status === 'missing' ? 0.35 : 1 }} />
                    </td>
                  ))}
                  <td><Pill band={dossierBand(d.dossierStatus)}>{titleCase(d.dossierStatus)}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="legend section-gap">
        <span><span className="sw" style={{ background: 'var(--good)' }} />on-file</span>
        <span><span className="sw" style={{ background: 'var(--warn)' }} />pending</span>
        <span><span className="sw" style={{ background: 'var(--crit)', opacity: 0.35 }} />missing</span>
      </div>
    </>
  );
}
