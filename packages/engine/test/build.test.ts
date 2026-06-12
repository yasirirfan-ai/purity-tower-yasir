import { describe, it, expect } from 'vitest';
import { computeBuild } from '../src/index.js';
import { FGFCBFC, SIMPLE } from './fixtures.js';

describe('computeBuild — match-rate predictor', () => {
  it('SIMPLE: hand-verified ceilings, match rate, stranded', () => {
    const b = computeBuild(SIMPLE);
    expect(b.ingCeil).toBe(100);
    expect(b.pkgCeil).toBe(20);
    expect(b.buildable).toBe(20);
    expect(b.matchRate).toBeCloseTo(0.2, 6);
    expect(b.stranded).toBe(80);
    expect(b.limitSide).toBe('packaging');
  });

  it('FGFCBFC: spec acceptance — 20% match, packaging-limited, 8,000 stranded', () => {
    const b = computeBuild(FGFCBFC);
    expect(b.ingCeil).toBe(10000);
    expect(b.pkgCeil).toBe(2000);
    expect(b.buildable).toBe(2000);
    expect(Math.round(b.matchRate * 100)).toBe(20);
    expect(b.stranded).toBe(8000);
    expect(b.limitSide).toBe('packaging');
    expect(b.bottleneck.name).toMatch(/jar/i);
    expect(b.totalAvail).toBe(2000 + 1258);
  });

  it('reservations reduce capacity (available = onHand − reserved)', () => {
    const b = computeBuild({
      ...SIMPLE,
      components: [
        { ...SIMPLE.components[0]!, reserved: 500 }, // 500 free / 10 = 50
        SIMPLE.components[1]!,
      ],
    });
    expect(b.ingCeil).toBe(50);
    expect(b.buildable).toBe(20); // packaging still the bottleneck
  });
});
