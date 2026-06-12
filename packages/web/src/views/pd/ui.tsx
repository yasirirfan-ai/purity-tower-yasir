import type { ReactNode } from 'react';
import { PHASE_COLORS, RESULT_COLORS } from './types';

/** Status/result badge using the module's explicit color map (falls back to neutral gray). */
export function PdBadge({ value }: { value?: string | null }) {
  const key = String(value ?? '').toUpperCase();
  const c = RESULT_COLORS[key] ?? { bg: '#F1EFE8', text: '#888780' };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
      {String(value ?? '—')}
    </span>
  );
}

export function PhaseTag({ phase }: { phase?: string }) {
  const c = PHASE_COLORS[phase ?? ''] ?? { bg: '#F1EFE8', text: '#888780' };
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
      {phase ?? '—'}
    </span>
  );
}

export function PdSection({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="card section-gap" style={{ marginTop: 0, marginBottom: 18 }}>
      <div className="card-head"><h3>{title}</h3>{hint && <span className="hint">{hint}</span>}</div>
      <div className="card-pad">{children}</div>
    </div>
  );
}
