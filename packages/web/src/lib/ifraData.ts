// IFRA 51st Amendment reference data (CLAUDE.md §7).
// Concentration limits are % in the finished product for the given product category.
// NOTE: these are illustrative seed values — confirm against the official IFRA standards
// (and the correct category) before any regulatory filing.

export interface IfraCategory {
  id: string;
  label: string;
  limits: Record<string, number>; // allergen -> max % in finished product
}

// Category 4 (leave-on face) limits — the primary seeded category.
export const IFRA_LIMITS_CAT4: Record<string, number> = {
  Geraniol: 0.2,
  Citral: 0.07,
  Isoeugenol: 0.01,
  Eugenol: 0.5,
  Cinnamaldehyde: 0.05,
  'Cinnamyl alcohol': 0.2,
  Farnesol: 0.2,
  Coumarin: 0.2,
  Lilial: 0.0, // banned
  Hydroxymethylpentylcyclohexenecarboxaldehyde: 0.02,
};

// Allergens with no concentration limit but a label-declaration requirement (EU 26 allergens subset).
export const IFRA_DECLARATION_ONLY: string[] = [
  'Limonene',
  'Linalool',
  'Citronellol',
  'Benzyl Alcohol',
  'Benzyl Benzoate',
  'Benzyl Salicylate',
  'Benzyl Cinnamate',
];

// Selectable product categories (only Cat 4 has seeded limits for now).
export const IFRA_CATEGORIES: IfraCategory[] = [
  { id: 'cat4', label: 'Leave-on face (Cat 4)', limits: IFRA_LIMITS_CAT4 },
  { id: 'cat5', label: 'Leave-on body (Cat 5)', limits: IFRA_LIMITS_CAT4 },
  { id: 'cat1', label: 'Rinse-off (Cat 1)', limits: IFRA_LIMITS_CAT4 },
  { id: 'cat6', label: 'Hair leave-on (Cat 6)', limits: IFRA_LIMITS_CAT4 },
];

export type IfraStatus = 'COMPLIANT' | 'WARNING' | 'EXCEEDED' | 'DECLARE';

/** Classify a use level against its limit. >80% of limit = warning, > limit = exceeded. */
export function ifraStatus(useLevel: number, limit: number): IfraStatus {
  if (limit <= 0) return useLevel > 0 ? 'EXCEEDED' : 'COMPLIANT';
  const pct = (useLevel / limit) * 100;
  if (pct > 100) return 'EXCEEDED';
  if (pct > 80) return 'WARNING';
  return 'COMPLIANT';
}
