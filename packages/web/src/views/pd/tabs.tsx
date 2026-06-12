import { useState } from 'react';
import { allergenUseLevelInFormula, naturalOriginPct } from '../../lib/formulaUtils';
import { IFRA_CATEGORIES, IFRA_DECLARATION_ONLY, ifraStatus } from '../../lib/ifraData';
import type { FormulaDetail } from './types';
import { PdBadge, PdSection } from './ui';

const TIMEPOINTS = ['T0', '1M', '3M', '6M', '12M', '24M', '36M'];

// ── Stability matrix ──────────────────────────────────────────────────
export function StabilityTab({ detail }: { detail: FormulaDetail }) {
  const rows = detail.stability;
  if (rows.length === 0) return <Empty msg="No stability data yet for this formula." />;
  const conditions = [...new Set(rows.map((r) => r.condition ?? ''))];
  const times = TIMEPOINTS.filter((t) => rows.some((r) => r.timepoint === t));
  const cell = (cond: string, t: string) => rows.find((r) => r.condition === cond && r.timepoint === t);
  const fails = rows.filter((r) => r.result === 'FAIL');

  return (
    <>
      {fails.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16, background: '#FCEBEB', borderColor: '#E24B4A' }}>
          <b style={{ color: '#A32D2D' }}>⚠ {fails.length} stability failure(s)</b>
          <div style={{ fontSize: 12.5, marginTop: 4, color: '#A32D2D' }}>
            {fails.map((f) => `${f.condition} @ ${f.timepoint}: ${f.notes || 'failed'}`).join(' · ')}
          </div>
        </div>
      )}
      <PdSection title="Stability matrix" hint="condition × timepoint — click a cell for measured values">
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Condition</th>{times.map((t) => <th key={t} style={{ textAlign: 'center' }}>{t}</th>)}</tr></thead>
            <tbody>
              {conditions.map((cond) => (
                <tr key={cond}>
                  <td className="mono" style={{ fontWeight: 600 }}>{cond}</td>
                  {times.map((t) => {
                    const c = cell(cond, t);
                    return (
                      <td key={t} style={{ textAlign: 'center' }} title={c ? `pH ${c.pH ?? '—'} · visc ${c.viscosity ?? '—'} · ${c.appearance ?? ''}` : 'not tested'}>
                        {c ? <PdBadge value={c.result} /> : <span className="faint">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PdSection>
    </>
  );
}

// ── Challenge test ────────────────────────────────────────────────────
export function ChallengeTab({ detail }: { detail: FormulaDetail }) {
  const tests = detail.challengeTests;
  if (tests.length === 0) return <Empty msg="No challenge (preservative efficacy) tests yet." />;
  return (
    <>
      {tests.map((t) => (
        <PdSection key={t.id} title={`${t.standard ?? 'Challenge test'} — Category ${t.category ?? '—'}`} hint={<PdBadge value={t.overallResult} />}>
          <div className="metric-grid" style={{ marginBottom: 14 }}>
            <M k="Preservative system" v={t.preservativeSystem} />
            <M k="Lab" v={t.lab} />
            <M k="Report #" v={t.reportNumber} />
            <M k="Tested" v={t.testedAt?.slice(0, 10)} />
          </div>
          <div className="tbl-wrap">
            <table className="data">
              <thead><tr><th>Organism</th><th className="num">Day 14 log↓</th><th className="num">Day 28 log↓</th><th>Limit</th><th>Result</th></tr></thead>
              <tbody>
                {(t.organisms ?? []).map((o, i) => (
                  <tr key={i}>
                    <td>{o.name}</td>
                    <td className="num">{o.day14LogReduction}</td>
                    <td className="num">{o.day28LogReduction}</td>
                    <td className="muted">{o.categoryLimit}</td>
                    <td><PdBadge value={o.result} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {t.notes && <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{t.notes}</div>}
        </PdSection>
      ))}
    </>
  );
}

// ── Claims + auto compliance ──────────────────────────────────────────
const EU_ANNEX_II_BANNED = ['hydroquinone', 'lilial', 'mercury'];
const PROP65 = ['retinyl palmitate', 'titanium dioxide', 'coffee'];

export function ClaimsTab({ detail }: { detail: FormulaDetail }) {
  const claims = detail.claims;
  const ings = detail.ingredients;
  const inciBlob = ings.map((i) => `${i.inciDisplay} ${i.tradeNameRef}`.toLowerCase()).join(' | ');
  const banned = EU_ANNEX_II_BANNED.filter((b) => inciBlob.includes(b));
  const prop65 = PROP65.filter((p) => inciBlob.includes(p));
  const natural = naturalOriginPct(ings.map((i) => ({ wtPct: i.wtPct ?? 0, naturalOriginPct: i.naturalOriginPct })));

  return (
    <>
      <PdSection title="Claims" hint={`${claims.filter((c) => c.status === 'VALIDATED').length} validated / ${claims.length}`}>
        {claims.length === 0 ? <Empty msg="No claims recorded." /> : (
          <div className="chip-bar">
            {claims.map((c) => (
              <span key={c.id} title={c.evidence} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <PdBadge value={c.status} /> <span style={{ fontSize: 13 }}>{c.claimText}</span>
                {c.expiresAt && <span className="faint" style={{ fontSize: 10.5 }}>exp {c.expiresAt.slice(0, 10)}</span>}
              </span>
            ))}
          </div>
        )}
      </PdSection>

      <PdSection title="Auto compliance">
        <div className="stack">
          <ComplianceRow label="EU Annex II (banned)" ok={banned.length === 0} detail={banned.length ? `Contains: ${banned.join(', ')}` : 'No banned ingredients detected'} />
          <ComplianceRow label="Prop 65" ok={prop65.length === 0} detail={prop65.length ? `Flagged: ${prop65.join(', ')}` : 'No Prop 65 substances detected'} />
          <ComplianceRow label="COSMOS natural origin" ok={natural >= 95} detail={`${natural.toFixed(1)}% natural origin (simplified)`} />
        </div>
        <div className="faint" style={{ fontSize: 11, marginTop: 10 }}>Checks run against a small hardcoded reference list — not a substitute for regulatory review.</div>
      </PdSection>
    </>
  );
}

// ── IFRA / allergens ──────────────────────────────────────────────────
export function IfraTab({ detail }: { detail: FormulaDetail }) {
  const [catId, setCatId] = useState('cat4');
  const cat = IFRA_CATEGORIES.find((c) => c.id === catId) ?? IFRA_CATEGORIES[0]!;
  const ings = detail.ingredients;

  // aggregate allergen use levels across all ingredients
  const useLevels: Record<string, number> = {};
  for (const ing of ings) {
    for (const [allergen, pctInIng] of Object.entries(ing.ifraComponents ?? {})) {
      useLevels[allergen] = (useLevels[allergen] ?? 0) + allergenUseLevelInFormula(ing.wtPct ?? 0, pctInIng);
    }
  }
  const allergens = Object.keys(useLevels).sort();

  return (
    <PdSection title="IFRA 51st Amendment — allergens" hint="use level vs category limit">
      <div className="chip-bar" style={{ marginBottom: 14 }}>
        {IFRA_CATEGORIES.map((c) => <button key={c.id} className={`tag${c.id === catId ? ' on' : ''}`} onClick={() => setCatId(c.id)}>{c.label}</button>)}
      </div>
      {allergens.length === 0 ? <Empty msg="No declarable fragrance allergens in this formula." /> : (
        <div className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Allergen</th><th className="num">Use level %</th><th className="num">Limit %</th><th className="num">% of limit</th><th>Status</th></tr></thead>
            <tbody>
              {allergens.map((a) => {
                const use = useLevels[a]!;
                const hasLimit = a in cat.limits;
                const limit = cat.limits[a];
                const declareOnly = IFRA_DECLARATION_ONLY.includes(a);
                const status = hasLimit ? ifraStatus(use, limit!) : (declareOnly ? 'DECLARE' : 'DECLARE');
                const pctOfLimit = hasLimit && limit! > 0 ? (use / limit!) * 100 : null;
                return (
                  <tr key={a}>
                    <td>{a}</td>
                    <td className="num">{use.toFixed(4)}</td>
                    <td className="num">{hasLimit ? (limit === 0 ? 'banned' : limit) : '—'}</td>
                    <td className="num">{pctOfLimit != null ? `${pctOfLimit.toFixed(0)}%` : '—'}</td>
                    <td><PdBadge value={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="faint" style={{ fontSize: 11, marginTop: 10 }}>
        Limits are illustrative seed values for {cat.label}. Declaration-only allergens (Limonene, Linalool, …) have no concentration limit but must appear on the label. Confirm against official IFRA standards before filing.
      </div>
    </PdSection>
  );
}

// ── Dev timeline ──────────────────────────────────────────────────────
export function DevTimelineTab({ detail }: { detail: FormulaDetail }) {
  const versions = [...detail.versions].sort((a, b) => Number(b.versionNumber ?? 0) - Number(a.versionNumber ?? 0));
  if (versions.length === 0) return <Empty msg="No version history." />;
  return (
    <PdSection title="Developer timeline" hint={`${versions.length} version(s)`}>
      <div className="stack">
        {versions.map((v) => (
          <div key={v.id} style={{ display: 'flex', gap: 12, borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
            <div style={{ minWidth: 80 }}>
              <div style={{ fontWeight: 700 }}>v{v.versionNumber}</div>
              <PdBadge value={v.label} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="muted" style={{ fontSize: 12 }}>{v.createdAt?.slice(0, 10)} · fill {v.fillWeight}g · pH {v.phTarget}</div>
              {v.notes && <div style={{ fontSize: 13, marginTop: 3 }}>{v.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </PdSection>
  );
}

// ── Artwork (placeholder — artworkComponents not seeded yet) ───────────
export function ArtworkTab() {
  return <Empty msg="Artwork / packaging components aren't loaded yet. Seed the artworkComponents collection to populate this tab." />;
}

// ── small helpers ─────────────────────────────────────────────────────
function Empty({ msg }: { msg: string }) {
  return <div className="card card-pad muted" style={{ fontSize: 13 }}>{msg}</div>;
}
function M({ k, v }: { k: string; v?: string | number | null }) {
  return <div className="m"><div className="k">{k}</div><div className="v" style={{ fontSize: 15 }}>{v == null || v === '' ? '—' : v}</div></div>;
}
function ComplianceRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="row-between" style={{ fontSize: 13 }}>
      <span>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="muted" style={{ fontSize: 12 }}>{detail}</span>
        <PdBadge value={ok ? 'PASS' : 'WARNING'} />
      </span>
    </div>
  );
}
