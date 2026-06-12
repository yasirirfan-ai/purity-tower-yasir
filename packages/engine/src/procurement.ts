// Shared procurement helpers used by @pct/api (FG-order-centric scheduling) and the
// engine's Build-centric computeSchedule. API routes model sales orders backward from
// need-by; the engine models a single Build with component-level JIT/synced arrival.

export const DAY_MS = 86_400_000;

export function parseISODate(s: string | null | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s ?? ''));
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function todayUtcMs(): number {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** IN- and CM-prefixed SKUs are ingredients; CP, CT, CS, etc. are packaging. */
export function isIngredientSku(code: string): boolean {
  return /^(IN|CM)/i.test(code);
}

export const CHINA_VENDOR_RE =
  /jiangsu|shenzhen|hangzhou|hong kong|guangzhou|ningbo|hanhui|hexu|lecos|glory|green and innovative|mig packaging|right team|\bltd\b|limited/i;

export type VendorBadge = 'CN' | 'US';

export interface VendorOrigin {
  mode: string;
  imported: boolean;
  badge: VendorBadge;
}

export function originFromVendor(v: string | null | undefined): VendorOrigin {
  const s = (v ?? '').toLowerCase();
  if (s.includes('babylon')) return { mode: 'Internal compound', imported: false, badge: 'US' };
  if (CHINA_VENDOR_RE.test(s) && !s.includes('llc')) return { mode: 'Ocean vendor', imported: true, badge: 'CN' };
  return { mode: 'Domestic vendor', imported: false, badge: 'US' };
}
