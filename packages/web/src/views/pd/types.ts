// Shapes returned by /api/pd/* (loose — mirrors the Firestore model in CLAUDE.md §4).
export interface FormulaListItem {
  id: string; name?: string; sku?: string; category?: string; subcategory?: string;
  mocraCategory?: string; versionCount?: number; currentLabel?: string;
}
export interface Version {
  id: string; versionNumber?: number; label?: string; fillWeight?: number; overfill?: number;
  batchSize?: number; directions?: string; phTarget?: number; phMin?: number; phMax?: number;
  viscosityTarget?: number; viscosityMin?: number; viscosityMax?: number; density?: number;
  appearance?: string; odorProfile?: string; notes?: string; createdAt?: string;
}
export interface Ingredient {
  id: string; sNo?: number; phase?: string; ingredientCode?: string; tradeNameRef?: string;
  inciDisplay?: string; wtPct?: number; pricePerKg?: number; shippingCost?: number;
  costPerUnit?: number; naturalOriginPct?: number; allergenComponents?: string[];
  ifraComponents?: Record<string, number>;
}
export interface StabilityRow {
  id: string; condition?: string; timepoint?: string; result?: string; pH?: number | null;
  viscosity?: number | null; appearance?: string; odorChange?: boolean; notes?: string;
}
export interface Organism { name: string; day14LogReduction?: number; day28LogReduction?: number; categoryLimit?: string; result?: string }
export interface ChallengeTest {
  id: string; standard?: string; category?: string; preservativeSystem?: string; lab?: string;
  reportNumber?: string; testedAt?: string; overallResult?: string; organisms?: Organism[]; notes?: string;
}
export interface Claim {
  id: string; claimText?: string; claimType?: string; status?: string; evidence?: string;
  validatedAt?: string | null; expiresAt?: string;
}
export interface FormulaDetail {
  id: string;
  head: FormulaListItem;
  versions: Version[];
  selectedVersionId: string | null;
  version: Version | null;
  ingredients: Ingredient[];
  stability: StabilityRow[];
  challengeTests: ChallengeTest[];
  claims: Claim[];
}

// Domain color maps (CLAUDE.md §6 — module-specific semantics).
export const PHASE_COLORS: Record<string, { bg: string; text: string }> = {
  Water: { bg: '#E6F1FB', text: '#185FA5' },
  Oil: { bg: '#FAEEDA', text: '#854F0B' },
  'Cool-down': { bg: '#E1F5EE', text: '#0F6E56' },
  Actives: { bg: '#EEEDFE', text: '#3C3489' },
  Pigment: { bg: '#FCEBEB', text: '#A32D2D' },
};
export const RESULT_COLORS: Record<string, { bg: string; text: string }> = {
  PASS: { bg: '#E1F5EE', text: '#0F6E56' },
  PRODUCTION: { bg: '#E6F1FB', text: '#185FA5' },
  VALIDATED: { bg: '#E1F5EE', text: '#0F6E56' },
  COMPLIANT: { bg: '#E1F5EE', text: '#0F6E56' },
  DEVELOPMENT: { bg: '#E1F5EE', text: '#0F6E56' },
  WARNING: { bg: '#FAEEDA', text: '#854F0B' },
  PENDING: { bg: '#F1EFE8', text: '#888780' },
  ARCHIVED: { bg: '#FAEEDA', text: '#854F0B' },
  DECLARE: { bg: '#E6F1FB', text: '#185FA5' },
  FAIL: { bg: '#FCEBEB', text: '#A32D2D' },
  FAILED: { bg: '#FCEBEB', text: '#A32D2D' },
  EXCEEDED: { bg: '#FCEBEB', text: '#A32D2D' },
};
