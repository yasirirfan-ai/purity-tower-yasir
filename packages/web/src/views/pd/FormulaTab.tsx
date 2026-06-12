import { num1, money } from '../../lib/format';
import { wtPctSum, wtPctValid, totalFormulaCost, naturalOriginPct } from '../../lib/formulaUtils';
import type { FormulaDetail } from './types';
import { PhaseTag, PdSection } from './ui';

export function FormulaTab({ detail }: { detail: FormulaDetail }) {
  const v = detail.version;
  const ings = detail.ingredients;
  const fill = Number(v?.fillWeight ?? 0);
  const lines = ings.map((i) => ({ wtPct: i.wtPct ?? 0, pricePerKg: i.pricePerKg, shippingCost: i.shippingCost, naturalOriginPct: i.naturalOriginPct }));
  const sum = wtPctSum(lines);
  const valid = wtPctValid(lines);
  const cogs = totalFormulaCost(lines, fill);
  const natural = naturalOriginPct(lines);

  return (
    <>
      {/* ingredient grid */}
      <PdSection title="Ingredients" hint={`${ings.length} lines · fill ${fill} g`}>
        <div className="tbl-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th><th>Phase</th><th>Trade name</th><th>INCI</th><th>Code</th>
                <th className="num">wt%</th><th className="num">$/kg</th><th className="num">Cost/unit</th><th>Allergens</th>
              </tr>
            </thead>
            <tbody>
              {ings.map((i) => (
                <tr key={i.id}>
                  <td className="muted">{i.sNo}</td>
                  <td><PhaseTag phase={i.phase} /></td>
                  <td>{i.tradeNameRef}</td>
                  <td className="muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.inciDisplay}</td>
                  <td className="sku-cell">{i.ingredientCode}</td>
                  <td className="num">{num1(i.wtPct)}</td>
                  <td className="num">{money(i.pricePerKg)}</td>
                  <td className="num">{i.costPerUnit != null ? `$${i.costPerUnit.toFixed(4)}` : '—'}</td>
                  <td>{(i.allergenComponents ?? []).length ? <span className="pill warn">{(i.allergenComponents ?? []).join(', ')}</span> : <span className="faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={5} style={{ textAlign: 'right', padding: '11px 14px' }}>Total</td>
                <td className="num" style={{ color: valid ? 'var(--good)' : 'var(--crit)' }}>{num1(sum)}{valid ? '' : ' ⚠'}</td>
                <td></td>
                <td className="num">${cogs.toFixed(4)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!valid && <div className="pill crit" style={{ marginTop: 12 }}>wt% must sum to 100.0000 — currently {num1(sum)}</div>}
      </PdSection>

      <div className="grid-2">
        {/* physical properties */}
        <PdSection title="Physical properties">
          <div className="metric-grid">
            <Spec k="pH" target={v?.phTarget} min={v?.phMin} max={v?.phMax} />
            <Spec k="Viscosity (cP)" target={v?.viscosityTarget} min={v?.viscosityMin} max={v?.viscosityMax} />
            <M k="Density (g/mL)" val={v?.density} />
            <M k="Appearance" val={v?.appearance} />
            <M k="Odor" val={v?.odorProfile} />
            <M k="Overfill" val={v?.overfill != null ? `${v.overfill}%` : undefined} />
          </div>
          {v?.directions && <div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}><b>Directions:</b> {v.directions}</div>}
        </PdSection>

        {/* cost + COSMOS */}
        <PdSection title="Cost & origin">
          <div className="metric-grid">
            <M k="COGS / unit" val={`$${cogs.toFixed(4)}`} big />
            <M k="Fill weight" val={`${fill} g`} />
            <M k="Batch size" val={v?.batchSize != null ? `${v.batchSize} kg` : undefined} />
            <M k="Natural origin" val={`${natural.toFixed(1)}%`} />
          </div>
          <div style={{ marginTop: 12 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>COSMOS natural-origin meter</div>
            <div className="bar-track" style={{ height: 10 }}>
              <div className="bar-fill" style={{ width: `${Math.min(100, natural)}%`, background: natural >= 95 ? 'var(--good)' : natural >= 50 ? 'var(--warn)' : 'var(--crit)' }} />
            </div>
            <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>COSMOS Natural typically requires high natural-origin content; ≥95% shown green (simplified).</div>
          </div>
        </PdSection>
      </div>
    </>
  );
}

function M({ k, val, big }: { k: string; val?: string | number | null; big?: boolean }) {
  return <div className="m"><div className="k">{k}</div><div className="v" style={{ fontSize: big ? 20 : 15 }}>{val == null || val === '' ? '—' : val}</div></div>;
}
function Spec({ k, target, min, max }: { k: string; target?: number; min?: number; max?: number }) {
  return (
    <div className="m">
      <div className="k">{k}</div>
      <div className="v" style={{ fontSize: 15 }}>{target ?? '—'}</div>
      {(min != null || max != null) && <div className="faint" style={{ fontSize: 10.5 }}>spec {min ?? '—'}–{max ?? '—'}</div>}
    </div>
  );
}
