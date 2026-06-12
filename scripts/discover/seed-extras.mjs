// Seed sample Reviews + Artwork data into Firestore (current project).
// These domains have no source feed yet; this is illustrative sample data,
// tagged `_seed: true`. Idempotent (deterministic IDs). Run: node scripts/discover/seed-extras.mjs
import { Firestore } from '@google-cloud/firestore';
import dotenv from 'dotenv';
import { resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: resolve(ROOT, 'credentials/.env') });
const cred = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (cred && !isAbsolute(cred)) process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(ROOT, cred);
const db = new Firestore({ projectId: process.env.FIREBASE_PROJECT_ID });
const tag = (o) => ({ ...o, _seed: true, updatedAt: '2026-06-06T00:00:00Z' });

// ── reviews (real SKUs from the catalog, sample sentiment) ────────────
const reviews = [
  { id: '1FMCBEC', sku: '1FMCBEC', name: 'Coffee Bean Caffeine Eye Cream', count: 412, avg: 4.6, dist: { 1: 8, 2: 10, 3: 24, 4: 96, 5: 274 }, critical: 5, recent90: 41, negPct: 0.044, health: 88, status: 'healthy' },
  { id: '1FEMBE', sku: '1FEMBE', name: 'Bright Eyes Masks', count: 263, avg: 4.4, dist: { 1: 9, 2: 12, 3: 22, 4: 74, 5: 146 }, critical: 7, recent90: 33, negPct: 0.08, health: 79, status: 'watch' },
  { id: '1FHCG', sku: '1FHCG', name: 'Hydrating Gel Cleanser', count: 188, avg: 4.7, dist: { 1: 3, 2: 5, 3: 12, 4: 41, 5: 127 }, critical: 2, recent90: 22, negPct: 0.042, health: 90, status: 'healthy' },
  { id: '1CMMBB10G', sku: '1CMMBB10G', name: 'Maracuja Mascara', count: 521, avg: 3.9, dist: { 1: 41, 2: 38, 3: 70, 4: 152, 5: 220 }, critical: 22, recent90: 58, negPct: 0.152, health: 58, status: 'issue' },
  { id: '1FSGCB', sku: '1FSGCB', name: 'Ginseng Collagen Boost Mask', count: 97, avg: 4.5, dist: { 1: 2, 2: 4, 3: 9, 4: 30, 5: 52 }, critical: 3, recent90: 14, negPct: 0.062, health: 82, status: 'healthy' },
  { id: '1FMVCS', sku: '1FMVCS', name: 'Vitamin C Serum', count: 34, avg: 4.2, dist: { 1: 1, 2: 2, 3: 4, 4: 10, 5: 17 }, critical: 1, recent90: 9, negPct: 0.088, health: 71, status: 'thin' },
];
const reviewItems = {
  '1FMCBEC': [
    { stars: 5, date: '2026-05-18', text: 'Brightened my under-eyes in two weeks. Holy grail.' },
    { stars: 2, date: '2026-05-02', flag: 'CRITICAL', text: 'Caused stinging and redness — had to stop using.' },
  ],
  '1CMMBB10G': [
    { stars: 1, date: '2026-05-20', flag: 'CRITICAL', text: 'Wand smeared and flaked by midday.' },
    { stars: 5, date: '2026-05-11', text: 'Great length, no clumping for me.' },
  ],
};

// ── artwork (proof tracking per SKU) ──────────────────────────────────
const STAGES = ['approved', 'in-review', 'revise', 'not-started'];
const artwork = [
  { id: '1FMCBEC', sku: '1FMCBEC', name: 'Coffee Bean Caffeine Eye Cream', upc: '843585100012', weight: '1 oz / 30 ml', components: [
    { cid: 'CPSEC30T', type: 'Tube', material: 'ABL; 30% PCR', finish: 'Matte', printer: 'Shenzhen Cosmetics', proof: { stage: 'approved', version: 'v3', owner: 'Susie', updated: '2026-04-30' } },
    { cid: 'CPSEC30B', type: 'Outer Box', material: 'SBS 18pt', finish: 'Soft-touch', printer: 'Pacific Print', proof: { stage: 'in-review', version: 'v2', owner: 'Nicky', updated: '2026-05-22' } },
    { cid: 'CPSEC30L', type: 'Label', material: 'BOPP', finish: 'Gloss', printer: 'Pacific Print', proof: { stage: 'approved', version: 'v1', owner: 'Susie', updated: '2026-03-15' } },
  ] },
  { id: '1FHCG', sku: '1FHCG', name: 'Hydrating Gel Cleanser', upc: '843585100029', weight: '4 fl oz / 120 ml', components: [
    { cid: 'CPHCG120B', type: 'Bottle', material: 'PET; 50% PCR', finish: 'Frosted', printer: 'Sun Glass Co.', proof: { stage: 'revise', version: 'v2', owner: 'Nicky', updated: '2026-05-28' } },
    { cid: 'CPHCG120P', type: 'Pump', material: 'PP', finish: 'Matte', printer: 'Hangzhou Pumps', proof: { stage: 'not-started', version: '—', owner: '—', updated: null } },
    { cid: 'CPHCG120L', type: 'Label', material: 'BOPP', finish: 'Matte', printer: 'Pacific Print', proof: { stage: 'in-review', version: 'v1', owner: 'Susie', updated: '2026-05-30' } },
  ] },
  { id: '1FMVCS', sku: '1FMVCS', name: 'Vitamin C Serum', upc: '843585100036', weight: '1 oz / 30 ml', components: [
    { cid: 'CPVCS30B', type: 'Bottle', material: 'Amber glass', finish: 'Gloss', printer: 'Sun Glass Co.', proof: { stage: 'not-started', version: '—', owner: '—', updated: null } },
    { cid: 'CPVCS30D', type: 'Dropper', material: 'Glass + rubber', finish: '—', printer: 'Hangzhou Pumps', proof: { stage: 'not-started', version: '—', owner: '—', updated: null } },
  ] },
];

async function run() {
  const batch = db.batch();
  for (const r of reviews) batch.set(db.collection('reviews').doc(r.id), tag({ ...r, reviews: reviewItems[r.sku] ?? [] }));
  for (const a of artwork) batch.set(db.collection('artwork').doc(a.id), tag(a));
  await batch.commit();
  console.log(`✅ Seeded ${reviews.length} review products + ${artwork.length} artwork SKUs (collections: reviews, artwork). Stages: ${STAGES.join(', ')}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
