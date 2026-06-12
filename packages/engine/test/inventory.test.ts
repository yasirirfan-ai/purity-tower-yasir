import { describe, it, expect } from 'vitest';
import { coverBand, deriveSkus, computeFlags } from '../src/index.js';
import { SKUS } from './fixtures.js';

describe('coverBand thresholds', () => {
  it('fires at exactly 30 / 60 / 365', () => {
    expect(coverBand(null)).toBe('none');
    expect(coverBand(0)).toBe('stockout');
    expect(coverBand(30)).toBe('crit');
    expect(coverBand(31)).toBe('warn');
    expect(coverBand(60)).toBe('warn');
    expect(coverBand(61)).toBe('good');
    expect(coverBand(364)).toBe('good');
    expect(coverBand(365)).toBe('over');
  });
});

describe('computeFlags', () => {
  it('classifies the fixture SKUs into the right buckets', () => {
    const flags = computeFlags(deriveSkus(SKUS));
    expect(flags.stockout.map((s) => s.sku)).toEqual(['A']);
    expect(flags.critical.map((s) => s.sku)).toEqual(['B']);
    expect(flags.warn.map((s) => s.sku)).toEqual(['C']);
    expect(flags.over.map((s) => s.sku)).toEqual(['E']);
    expect(flags.dead.map((s) => s.sku)).toEqual(['F']);
  });
});
