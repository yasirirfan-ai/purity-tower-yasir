import type { ProductBOM, SkuRecord } from '../src/index.js';

// Canonical worked example from the spec (HANDOFF §8):
// ingredients: caffeine 520000/52=10000, shea 380000/38=10000 -> ingCeil 10000
// packaging: 50ml jar 2000/1=2000 (bottleneck), lid 9400, carton 8800, label 12500 -> pkgCeil 2000
// => buildable 2000, matchRate 0.20, stranded 8000, limitSide packaging.
export const FGFCBFC: ProductBOM = {
  sku: 'FGFCBFC',
  name: 'Coffee Bean Caffeine Restorative Moisturizer',
  finishedOnHand: 1258,
  demand60: 1450,
  components: [
    { name: 'Caffeine + coffee-bean bulk cream', type: 'ingredient', onHand: 520000, perUnit: 52, unit: 'g', supplier: 'Babylon — Compounding', leadTimeDays: 21 },
    { name: 'Shea + jojoba base blend', type: 'ingredient', onHand: 380000, perUnit: 38, unit: 'g', supplier: 'Babylon — Compounding', leadTimeDays: 35 },
    { name: '50ml glass jar', type: 'packaging', onHand: 2000, perUnit: 1, unit: 'ea', supplier: 'Sun Glass Co.', leadTimeDays: 40 },
    { name: 'Lid / overcap', type: 'packaging', onHand: 9400, perUnit: 1, unit: 'ea', supplier: 'Hangzhou Pumps', leadTimeDays: 60 },
    { name: 'Folding carton', type: 'packaging', onHand: 8800, perUnit: 1, unit: 'ea', supplier: 'Pacific Print', leadTimeDays: 30 },
    { name: 'Label', type: 'packaging', onHand: 12500, perUnit: 1, unit: 'ea', supplier: 'Pacific Print', leadTimeDays: 25 },
  ],
};

// Simple hand-verified product: ingCeil 100, pkgCeil 20 -> buildable 20, matchRate 0.2, stranded 80.
export const SIMPLE: ProductBOM = {
  sku: 'TEST1',
  name: 'Test Product',
  finishedOnHand: 0,
  demand60: 600,
  components: [
    { name: 'serum bulk', type: 'ingredient', onHand: 1000, perUnit: 10, unit: 'g', supplier: 'Actives Lab (DSM)', leadTimeDays: 21 },
    { name: 'airless pump', type: 'packaging', onHand: 200, perUnit: 10, unit: 'ea', supplier: 'Hangzhou Pumps', leadTimeDays: 60 },
  ],
};

// Two ingredients with DIFFERENT lead times, both needing ordering (onHand 0).
// In naive mode the short-lead ingredient (21d) lands and waits for the long-lead
// one (35d) before compounding -> 14 idle material-days. Synced -> 0.
export const IDLE: ProductBOM = {
  sku: 'IDLE1',
  name: 'Idle Test',
  finishedOnHand: 0,
  demand60: 600,
  components: [
    { name: 'caffeine bulk', type: 'ingredient', onHand: 0, perUnit: 1, unit: 'g', supplier: 'BotaniSource', leadTimeDays: 21 },
    { name: 'vitamin-c active', type: 'ingredient', onHand: 0, perUnit: 1, unit: 'g', supplier: 'Actives Lab (DSM)', leadTimeDays: 35 },
    { name: 'glass jar', type: 'packaging', onHand: 0, perUnit: 1, unit: 'ea', supplier: 'Sun Glass Co.', leadTimeDays: 30 },
  ],
};

export const SKUS: SkuRecord[] = [
  { sku: 'A', name: 'sells, no stock', onHand: 0, lots: 0, status: 'ACTIVE', earliestExp: null, units60: 120, rev60: 1000, doc: 0 },
  { sku: 'B', name: 'critical', onHand: 100, lots: 1, status: 'ACTIVE', earliestExp: null, units60: 120, rev60: 1000, doc: 25 },
  { sku: 'C', name: 'warn', onHand: 300, lots: 1, status: 'ACTIVE', earliestExp: null, units60: 120, rev60: 1000, doc: 45 },
  { sku: 'D', name: 'good', onHand: 600, lots: 1, status: 'ACTIVE', earliestExp: null, units60: 120, rev60: 1000, doc: 120 },
  { sku: 'E', name: 'overstock', onHand: 50000, lots: 1, status: 'ACTIVE', earliestExp: null, units60: 120, rev60: 1000, doc: 400 },
  { sku: 'F', name: 'dead stock', onHand: 500, lots: 1, status: 'ACTIVE', earliestExp: null, units60: 0, rev60: 0, doc: null },
];
