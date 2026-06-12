const DAY = 86_400_000;

/** Parse an ISO 'YYYY-MM-DD' string to epoch ms (UTC midnight), or null. */
export function parseISO(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function todayMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const daysBetween = (a: number, b: number): number => Math.round((b - a) / DAY);

/** Short label like "Jul ’25". */
export function fmtMonth(ms: number): string {
  const d = new Date(ms);
  return `${d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })} ’${String(d.getUTCFullYear()).slice(2)}`;
}
export function fmtDate(ms: number | null): string {
  if (ms == null) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' });
}

/** Month-start tick marks spanning [start,end]. */
export function monthTicks(start: number, end: number): number[] {
  const ticks: number[] = [];
  const d = new Date(start);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  // step to first of next month if not already on the 1st
  if (d.getUTCDate() !== 1) { m += 1; if (m > 11) { m = 0; y += 1; } }
  let t = Date.UTC(y, m, 1);
  while (t <= end) {
    ticks.push(t);
    m += 1; if (m > 11) { m = 0; y += 1; }
    t = Date.UTC(y, m, 1);
  }
  return ticks;
}
