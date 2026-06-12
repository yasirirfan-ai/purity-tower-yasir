import { useFetch } from '../lib/api';
import { num, titleCase } from '../lib/format';
import { Kpi, Loading, ErrorState } from '../components/ui';
import { useOpenSku } from '../App';

interface Proof { stage: string; version: string; owner: string; printer?: string; updated?: string | null }
interface ArtComponent { cid: string; type: string; material?: string; finish?: string; printer?: string; proof?: Proof }
interface ArtworkSku { id: string; sku: string; name: string; upc?: string; weight?: string; components: ArtComponent[] }

const STAGE_COLOR: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'var(--good-tint)', text: 'var(--good)' },
  'in-review': { bg: 'var(--cap-tint)', text: 'var(--cap)' },
  revise: { bg: 'var(--warn-tint)', text: 'var(--warn)' },
  'not-started': { bg: 'var(--surface-2)', text: 'var(--muted)' },
};
const StagePill = ({ stage }: { stage: string }) => {
  const c = STAGE_COLOR[stage] ?? STAGE_COLOR['not-started']!;
  return <span style={{ background: c.bg, color: c.text, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{titleCase(stage)}</span>;
};

export function Artwork() {
  const { data, loading, error } = useFetch<ArtworkSku[]>('/api/artwork');
  const openSku = useOpenSku();
  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} />;
  const skus = (data ?? []).map((s) => ({ ...s, components: s.components ?? [] }));
  const allComps = skus.flatMap((s) => s.components);
  const approved = allComps.filter((c) => c.proof?.stage === 'approved').length;
  const blocked = allComps.filter((c) => c.proof?.stage === 'revise' || c.proof?.stage === 'not-started').length;

  return (
    <>
      <div className="kpi-grid">
        <Kpi label="SKUs tracked" value={num(skus.length)} edge="var(--accent)" />
        <Kpi label="Components" value={num(allComps.length)} edge="var(--cap)" />
        <Kpi label="Proofs approved" value={num(approved)} unit={`/ ${allComps.length}`} edge="var(--good)" />
        <Kpi label="Blocked / not started" value={num(blocked)} edge="var(--warn)" />
      </div>

      <div className="card card-pad section-gap" style={{ background: 'var(--surface-2)' }}>
        <div className="eyebrow">Artwork & label proofs</div>
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Sample proof-tracking data (seeded). Each SKU's packaging components carry a proof stage; readiness = approved ÷ total components.</p>
      </div>

      <div className="grid-2">
        {skus.map((s) => {
          const total = s.components.length || 1;
          const appr = s.components.filter((c) => c.proof?.stage === 'approved').length;
          const ready = (appr / total) * 100;
          return (
            <div className="card" key={s.id}>
              <div className="card-head">
                <div>
                  <button className="linklike mono" style={{ fontSize: 11 }} onClick={() => openSku(s.sku)}>{s.sku}</button>
                  <h3 style={{ margin: '2px 0 0' }}>{s.name}</h3>
                </div>
                <span className="hint">{s.weight}</span>
              </div>
              <div className="card-pad">
                <div className="metric-row" style={{ fontSize: 12 }}><span className="muted">Dossier readiness</span><span className="mono">{appr}/{total} approved</span></div>
                <div className="bar-track" style={{ height: 8, marginTop: 5 }}><div className="bar-fill" style={{ width: `${ready}%`, background: ready === 100 ? 'var(--good)' : ready >= 50 ? 'var(--warn)' : 'var(--crit)' }} /></div>
                <div className="stack" style={{ marginTop: 12 }}>
                  {s.components.map((c) => (
                    <div className="row-between" key={c.cid} style={{ fontSize: 12.5 }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 600 }}>{c.type}</span>
                        <span className="muted"> · {c.material}{c.printer ? ` · ${c.printer}` : ''}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {c.proof?.version && c.proof.version !== '—' && <span className="faint" style={{ fontSize: 10.5 }}>{c.proof.version}</span>}
                        <StagePill stage={c.proof?.stage ?? 'not-started'} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
