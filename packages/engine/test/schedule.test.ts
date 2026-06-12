import { describe, it, expect } from 'vitest';
import { computeBuild, computeSchedule } from '../src/index.js';
import { FGFCBFC, IDLE } from './fixtures.js';

describe('computeSchedule — procurement planner', () => {
  const build = computeBuild(FGFCBFC);

  it('synced: materials are JIT (zero idle days)', () => {
    const s = computeSchedule(build, {}, 'synced');
    expect(s.idleDays).toBe(0);
    expect(s.mode).toBe('synced');
  });

  it('naive: materials land early and sit idle; synced = 0', () => {
    const idleBuild = computeBuild(IDLE);
    const naive = computeSchedule(idleBuild, {}, 'naive');
    const synced = computeSchedule(idleBuild, {}, 'synced');
    // Naive idle = 21d ingredient waiting 14d for the 35d ingredient (compound start)
    //            + 30d jar waiting 17d for compounding to finish (fill start) = 31.
    expect(naive.idleDays).toBe(31);
    expect(synced.idleDays).toBe(0);
    expect(naive.arrivalSpread).toBeGreaterThan(synced.arrivalSpread);
  });

  it('China-origin component carries +25% Section 301; domestic carries none', () => {
    const s = computeSchedule(build, {}, 'synced');
    const lid = s.items.find((i) => /lid|overcap/i.test(i.name))!; // Hangzhou Pumps (China)
    const carton = s.items.find((i) => /carton/i.test(i.name))!;   // Pacific Print (US)
    expect(lid.origin.country).toBe('China');
    expect(lid.section301).toBe(25);
    expect(carton.section301).toBe(0);
    expect(lid.dutyRate).toBe(lid.hts.duty + 25);
  });

  it('targetBuild replenishes to >= 120-day cover', () => {
    const s = computeSchedule(build, {}, 'synced');
    const daily = FGFCBFC.demand60 / 60;
    expect(s.targetBuild).toBe(Math.max(FGFCBFC.demand60, Math.ceil(daily * 120)));
  });
});
