import type { ReactNode } from 'react';
import { bandClass } from '../lib/format';

export function Pill({ band, children }: { band?: unknown; children: ReactNode }) {
  return <span className={`pill ${bandClass(band)}`}>{children}</span>;
}

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  edge,
  onClick,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  edge?: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`kpi${onClick ? ' kpi-btn' : ''}`} onClick={onClick}>
      {edge && <span className="accent-edge" style={{ background: edge }} />}
      <div className="label">{label}</div>
      <div className="value">
        {value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className="sub">{sub}</div>}
    </Tag>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center-state">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

export function ErrorState({ error }: { error: string }) {
  return (
    <div className="center-state">
      <div style={{ color: 'var(--crit)', fontWeight: 600 }}>Could not load data</div>
      <div className="mono" style={{ fontSize: 12 }}>{error}</div>
      <div className="faint" style={{ fontSize: 12 }}>Is the API running on :8080? Try <code>npm run dev:api</code>.</div>
    </div>
  );
}

export function CountStat({ label, value, band }: { label: string; value: ReactNode; band?: unknown }) {
  return (
    <div className="card card-pad" style={{ flex: 1 }}>
      <div className="eyebrow">{label}</div>
      <div className="bignum" style={{ marginTop: 6, color: band ? `var(--${bandClass(band)})` : 'var(--ink)' }}>
        {value}
      </div>
    </div>
  );
}
