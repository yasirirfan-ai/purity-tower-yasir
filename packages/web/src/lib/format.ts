export const nf = new Intl.NumberFormat('en-US');
export const num = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? nf.format(Math.round(n)) : '—';
};
export const num1 = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '—';
};
export const money = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k`;
  return `$${nf.format(Math.round(n))}`;
};
export const moneyFull = (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `$${nf.format(Math.round(n))}` : '—';
};
export const pct = (v: unknown, digits = 0): string => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('en-US', { maximumFractionDigits: digits })}%` : '—';
};
export const titleCase = (s: string): string =>
  s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** Map a risk/readiness band to a pill color class. */
export const bandClass = (band: unknown): 'crit' | 'warn' | 'good' | 'cap' | 'neutral' => {
  const b = String(band ?? '').toLowerCase();
  if (['stockout', 'critical', 'crit', 'blocked', 'high'].includes(b)) return 'crit';
  if (['warning', 'warn', 'partial', 'low_confidence', 'medium', 'at_risk'].includes(b)) return 'warn';
  if (['good', 'ready', 'ready_to_schedule', 'healthy', 'low'].includes(b)) return 'good';
  if (['overstock', 'over'].includes(b)) return 'cap';
  return 'neutral';
};
export const bandColor = (band: unknown): string => {
  const c = bandClass(band);
  return c === 'crit' ? 'var(--crit)' : c === 'warn' ? 'var(--warn)' : c === 'good' ? 'var(--good)' : c === 'cap' ? 'var(--cap)' : 'var(--faint)';
};
