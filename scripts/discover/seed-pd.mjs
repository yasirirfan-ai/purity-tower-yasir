// Seed sample Product Development (R&D) data into Firestore (current project).
// Idempotent: deterministic doc IDs, so re-running overwrites the same docs.
// Every doc is tagged `_seed: true` for easy identification/cleanup.
//
// Usage (from repo root): node scripts/discover/seed-pd.mjs
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: resolve(ROOT, 'credentials/.env') });
const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (cred && !isAbsolute(cred)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(ROOT, cred);
const db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID });
const NOW = '2026-06-06T00:00:00Z';
const tag = (o) => ({ ...o, _seed: true, updatedAt: NOW });

// ── ingredients ───────────────────────────────────────────────────────
const ingredients = [
  { ingredientCode: 'INWATER', tradeName: 'Deionized Water', inci: 'Aqua', susieInci: 'Water', vendor: 'Local', pricePerKg: 0.05, shippingCost: 0, naturalOriginPct: 100, leadTime: '1 week', allergenComponents: [], ifraComponents: {} },
  { ingredientCode: 'INGLYC', tradeName: 'Glycerin 99.7%', inci: 'Glycerin', susieInci: 'Vegetable Glycerin', vendor: 'BotaniSource', pricePerKg: 2.5, shippingCost: 0.2, naturalOriginPct: 100, leadTime: '2-3 weeks', allergenComponents: [], ifraComponents: {} },
  { ingredientCode: 'INNIAC', tradeName: 'Niacinamide PC', inci: 'Niacinamide', susieInci: 'Niacinamide (Vitamin B3)', vendor: 'Making Cosmetics', pricePerKg: 15, shippingCost: 0.5, naturalOriginPct: 0, leadTime: '2 weeks', allergenComponents: [], ifraComponents: {} },
  { ingredientCode: 'INSAP', tradeName: 'Sodium Ascorbyl Phosphate', inci: 'Sodium Ascorbyl Phosphate', susieInci: 'Stabilized Vitamin C', vendor: 'Actives Lab (DSM)', pricePerKg: 60, shippingCost: 1.2, naturalOriginPct: 0, leadTime: '4-6 weeks', allergenComponents: [], ifraComponents: {} },
  { ingredientCode: 'INXAN', tradeName: 'Xanthan Gum SF', inci: 'Xanthan Gum', susieInci: 'Xanthan Gum', vendor: 'BotaniSource', pricePerKg: 18, shippingCost: 0.6, naturalOriginPct: 100, leadTime: '2-3 weeks', allergenComponents: [], ifraComponents: {} },
  { ingredientCode: 'INPRES', tradeName: 'Geogard ECT', inci: 'Benzyl Alcohol (and) Salicylic Acid (and) Glycerin (and) Sorbic Acid', susieInci: 'Natural Preservative', vendor: 'Making Cosmetics', pricePerKg: 12, shippingCost: 0.4, naturalOriginPct: 60, leadTime: '2 weeks', allergenComponents: ['Benzyl Alcohol'], ifraComponents: { 'Benzyl Alcohol': 60 } },
  { ingredientCode: 'INFRAGCIT', tradeName: 'Citrus Garden Fragrance', inci: 'Parfum', susieInci: 'Natural Fragrance', vendor: 'Kobo Products', pricePerKg: 80, shippingCost: 2.0, naturalOriginPct: 50, leadTime: '3-4 weeks', allergenComponents: ['Geraniol', 'Citral', 'Limonene', 'Linalool'], ifraComponents: { Geraniol: 20, Citral: 5, Limonene: 10, Linalool: 8 } },
];

// ── formulas (with one version + ingredient lines that sum to 100) ─────
const formulas = [
  {
    id: '1FMBS', name: 'BRIGHTENING SERUM', sku: '1FMBS', category: 'Skincare', subcategory: 'Serum', mocraCategory: 'Skin care',
    version: { versionNumber: 0, label: 'PRODUCTION', fillWeight: 30, overfill: 2, batchSize: 50, directions: 'Apply 2-3 drops AM/PM to clean skin.', phTarget: 5.5, phMin: 5.0, phMax: 6.0, viscosityTarget: 4000, viscosityMin: 3000, viscosityMax: 5000, density: 1.02, appearance: 'Translucent amber gel', odorProfile: 'Light citrus', notes: 'V0 production formula. Stable to date.' },
    lines: [
      { phase: 'Water', code: 'INWATER', wtPct: 87.7 },
      { phase: 'Water', code: 'INGLYC', wtPct: 5.0 },
      { phase: 'Actives', code: 'INNIAC', wtPct: 4.0 },
      { phase: 'Actives', code: 'INSAP', wtPct: 1.5 },
      { phase: 'Water', code: 'INXAN', wtPct: 0.8 },
      { phase: 'Cool-down', code: 'INPRES', wtPct: 0.5 },
      { phase: 'Cool-down', code: 'INFRAGCIT', wtPct: 0.5 },
    ],
  },
  {
    id: '1FHCG', name: 'HYDRATING GEL CLEANSER', sku: '1FHCG', category: 'Skincare', subcategory: 'Cleanser', mocraCategory: 'Skin care',
    version: { versionNumber: 1, label: 'PRODUCTION', fillWeight: 120, overfill: 2, batchSize: 100, directions: 'Massage onto wet skin, rinse.', phTarget: 5.0, phMin: 4.5, phMax: 5.5, viscosityTarget: 6000, viscosityMin: 5000, viscosityMax: 7000, density: 1.03, appearance: 'Clear gel', odorProfile: 'Fresh', notes: 'V1 — surfactant rebalanced.' },
    lines: [
      { phase: 'Water', code: 'INWATER', wtPct: 90.2 },
      { phase: 'Water', code: 'INGLYC', wtPct: 6.0 },
      { phase: 'Water', code: 'INXAN', wtPct: 3.0 },
      { phase: 'Cool-down', code: 'INPRES', wtPct: 0.8 },
    ],
  },
  {
    id: '1FMVCS', name: 'VITAMIN C SERUM', sku: '1FMVCS', category: 'Skincare', subcategory: 'Serum', mocraCategory: 'Skin care',
    version: { versionNumber: 0, label: 'DEVELOPMENT', fillWeight: 30, overfill: 2, batchSize: 20, directions: 'Apply AM to clean skin.', phTarget: 4.0, phMin: 3.5, phMax: 4.5, viscosityTarget: 3500, viscosityMin: 2500, viscosityMax: 4500, density: 1.04, appearance: 'Pale yellow serum', odorProfile: 'Neutral', notes: 'V0 development — stability in progress.' },
    lines: [
      { phase: 'Water', code: 'INWATER', wtPct: 86.5 },
      { phase: 'Water', code: 'INGLYC', wtPct: 6.0 },
      { phase: 'Actives', code: 'INSAP', wtPct: 5.0 },
      { phase: 'Actives', code: 'INNIAC', wtPct: 2.0 },
      { phase: 'Cool-down', code: 'INPRES', wtPct: 0.5 },
    ],
  },
];

// ── stability (1FMBS) ─────────────────────────────────────────────────
const stability = [];
const stabRows = [
  ['25C_60RH', 'T0', 'PASS', 5.5, 4000], ['25C_60RH', '1M', 'PASS', 5.5, 3980], ['25C_60RH', '3M', 'PASS', 5.4, 3950], ['25C_60RH', '6M', 'PENDING', null, null],
  ['40C_75RH', 'T0', 'PASS', 5.5, 4000], ['40C_75RH', '1M', 'PASS', 5.4, 3900], ['40C_75RH', '3M', 'PASS', 5.3, 3820], ['40C_75RH', '6M', 'FAIL', 4.9, 3400],
];
for (const [condition, timepoint, result, pH, viscosity] of stabRows) {
  stability.push({ id: `1FMBS_${condition}_${timepoint}`, formulaId: '1FMBS', versionId: 'v0', condition, timepoint, result, pH, viscosity, appearance: result === 'FAIL' ? 'Slight separation' : 'No change', odorChange: result === 'FAIL', microAPC: 0, microYM: 0, testedAt: NOW, notes: result === 'FAIL' ? 'Phase separation at 40C/6M — reformulate emulsifier.' : '' });
}

// ── challenge tests (1FMBS) ───────────────────────────────────────────
const challengeTests = [{
  id: '1FMBS_ct1', formulaId: '1FMBS', versionId: 'v0', standard: 'ISO 11930:2019', category: '2', preservativeSystem: 'Geogard ECT 0.50%', lab: 'Microbac', reportNumber: 'MB-2026-0412', testedAt: NOW, overallResult: 'PASS',
  organisms: [
    { name: 'S. aureus ATCC 6538', day14LogReduction: 3.2, day28LogReduction: 3.5, categoryLimit: '≥3 log @14d', result: 'PASS' },
    { name: 'E. coli ATCC 8739', day14LogReduction: 3.6, day28LogReduction: 4.0, categoryLimit: '≥3 log @14d', result: 'PASS' },
    { name: 'P. aeruginosa ATCC 9027', day14LogReduction: 3.1, day28LogReduction: 3.4, categoryLimit: '≥3 log @14d', result: 'PASS' },
    { name: 'C. albicans ATCC 10231', day14LogReduction: 1.2, day28LogReduction: 2.0, categoryLimit: '≥1 log @14d', result: 'PASS' },
    { name: 'A. brasiliensis ATCC 16404', day14LogReduction: 0.5, day28LogReduction: 1.1, categoryLimit: 'no increase', result: 'PASS' },
  ],
  notes: 'Meets ISO 11930 Category 2 (Criterion A).',
}];

// ── claims ────────────────────────────────────────────────────────────
const claims = [
  { id: '1FMBS_vegan', formulaId: '1FMBS', claimText: 'Vegan', claimType: 'Certification', status: 'VALIDATED', evidence: 'No animal-derived ingredients; vendor attestations on file.', validatedAt: NOW },
  { id: '1FMBS_cf', formulaId: '1FMBS', claimText: 'Cruelty-Free', claimType: 'Certification', status: 'VALIDATED', evidence: 'Leaping Bunny certified.', validatedAt: NOW, expiresAt: '2027-06-01T00:00:00Z' },
  { id: '1FMBS_bright', formulaId: '1FMBS', claimText: 'Visibly brightens in 2 weeks', claimType: 'Clinical', status: 'PENDING', evidence: 'Consumer panel scheduled Q3.', validatedAt: null },
  { id: '1FMBS_ewg', formulaId: '1FMBS', claimText: 'EWG Verified', claimType: 'Certification', status: 'VALIDATED', evidence: 'EWG mark granted.', validatedAt: NOW, expiresAt: '2027-01-01T00:00:00Z' },
  { id: '1FMVCS_stable', formulaId: '1FMVCS', claimText: '15% Stable Vitamin C', claimType: 'Ingredient', status: 'PENDING', evidence: 'Assay pending stability completion.', validatedAt: null },
];

async function run() {
  const batch = db.batch();
  for (const ing of ingredients) batch.set(db.collection('ingredients').doc(ing.ingredientCode), tag(ing));
  for (const f of formulas) {
    const { version, lines, ...head } = f;
    batch.set(db.collection('formulas').doc(f.id), tag({ ...head, createdAt: NOW, createdBy: 'seed' }));
    batch.set(db.collection('formulas').doc(f.id).collection('versions').doc('v0'), tag({ ...version, createdAt: NOW, createdBy: 'seed' }));
    lines.forEach((ln, i) => {
      const ing = ingredients.find((x) => x.ingredientCode === ln.code);
      const costPerUnit = (ln.wtPct / 100) * ((ing?.pricePerKg ?? 0) + (ing?.shippingCost ?? 0)) * (version.fillWeight / 1000);
      batch.set(
        db.collection('formulas').doc(f.id).collection('versions').doc('v0').collection('ingredients').doc(ln.code),
        tag({ sNo: i + 1, phase: ln.phase, ingredientCode: ln.code, tradeNameRef: ing?.tradeName ?? ln.code, inciDisplay: ing?.susieInci ?? ing?.inci ?? '', wtPct: ln.wtPct, pricePerKg: ing?.pricePerKg ?? 0, shippingCost: ing?.shippingCost ?? 0, costPerUnit: Math.round(costPerUnit * 1e6) / 1e6, naturalOriginPct: ing?.naturalOriginPct ?? 0, allergenComponents: ing?.allergenComponents ?? [], ifraComponents: ing?.ifraComponents ?? {} }),
      );
    });
  }
  for (const s of stability) batch.set(db.collection('stability').doc(s.id), tag(s));
  for (const c of challengeTests) batch.set(db.collection('challengeTests').doc(c.id), tag(c));
  for (const c of claims) batch.set(db.collection('claims').doc(c.id), tag(c));
  await batch.commit();
  console.log(`✅ Seeded ${ingredients.length} ingredients, ${formulas.length} formulas, ${stability.length} stability rows, ${challengeTests.length} challenge test, ${claims.length} claims.`);
}
run().catch((e) => { console.error(e); process.exit(1); });
