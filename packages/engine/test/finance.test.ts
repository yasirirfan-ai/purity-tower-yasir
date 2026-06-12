import { describe, it, expect } from 'vitest';
import { cashWeeks, cashMonths, skuEconomics, leaseVsBuy, intercompanyStats, type CashEvent } from '../src/index.js';

const events: CashEvent[] = [
  { vendor: 'V1', type: 'ingredient', amount: 1000, dueOff: 3 },   // wk1, Jun
  { vendor: 'V2', type: 'packaging', amount: 500, dueOff: 10 },    // wk2, Jun
  { vendor: 'V3', type: 'ingredient', amount: 2000, dueOff: 40 },  // ~wk6, Jul
];

describe('cashWeeks', () => {
  it('buckets payables by week and runs the balance down', () => {
    const w = cashWeeks(events, 10_000, 8);
    expect(w).toHaveLength(8);
    expect(w[0]!.ing).toBe(1000);
    expect(w[0]!.balance).toBe(9000);          // 10000 - 1000
    expect(w[1]!.pkg).toBe(500);
    expect(w[1]!.balance).toBe(8500);          // - 500
    // week containing dueOff 40 = floor(40/7)=5
    expect(w[5]!.ing).toBe(2000);
    expect(w[5]!.balance).toBe(6500);
    expect(w[7]!.balance).toBe(6500);          // nothing after
  });
});

describe('cashMonths', () => {
  it('buckets by calendar month from the base (2026-06) and labels them', () => {
    const m = cashMonths(events, 10_000, 3);
    expect(m[0]!.label).toBe('Jun ’26');
    expect(m[1]!.label).toBe('Jul ’26');
    expect(m[0]!.total).toBe(1500);            // both June events (dueOff 3 + 10)
    expect(m[0]!.balance).toBe(8500);
    expect(m[1]!.total).toBe(2000);            // dueOff 40 lands in July
    expect(m[1]!.balance).toBe(6500);
  });
});

describe('skuEconomics', () => {
  it('computes ASP, modeled COGS (≤60% ASP), and gross', () => {
    const econ = skuEconomics([{ sku: 'X', name: 'X', units60: 100, rev60: 1000 }]);
    expect(econ).toHaveLength(1);
    const e = econ[0]!;
    expect(e.asp).toBe(10);
    expect(e.cogs).toBeCloseTo(6, 6);          // 60% of 10
    expect(e.grossU).toBeCloseTo(4, 6);
    expect(e.gross60).toBeCloseTo(400, 6);
    expect(e.ing).toBeGreaterThan(e.pkg);      // 55/45 split
  });
  it('drops SKUs with no sales', () => {
    expect(skuEconomics([{ sku: 'Y', units60: 0, rev60: 0 }])).toHaveLength(0);
  });
});

describe('intercompanyStats', () => {
  it('computes transfer pricing, AR balance, aging, and coverage', () => {
    const econ = skuEconomics([
      { sku: 'A', name: 'A', units60: 1000, rev60: 20_000 }, // asp 20, cogs 12
      { sku: 'B', name: 'B', units60: 500, rev60: 5_000 },   // asp 10, cogs 6
    ]);
    const ic = intercompanyStats(econ, 250_000);
    expect(ic.transferMarkup).toBe(1.45);
    // transfer = mcu(cogs) × 1.45; A: 12×1.45=17.4
    expect(ic.transferPricing[0]!.transfer).toBeCloseTo(17.4, 4);
    expect(ic.transferPricing[0]!.babylonMargin).toBeCloseTo((17.4 - 12) / 17.4, 4);
    // AR balance = (sum transfer×units / 60) × 38
    const babRev60 = 17.4 * 1000 + 6 * 1.45 * 500;
    expect(ic.babRev60).toBeCloseTo(babRev60, 2);
    expect(ic.arBalance).toBeCloseTo((babRev60 / 60) * 38, 2);
    // aging buckets sum to the AR balance
    const sum = ic.aging.b0 + ic.aging.b31 + ic.aging.b61 + ic.aging.b90;
    expect(sum).toBeCloseTo(ic.arBalance, 2);
    expect(ic.memberDrawn).toBeLessThanOrEqual(ic.memberFacility);
  });
});

describe('leaseVsBuy', () => {
  it('returns both 5-year nets and a recommendation', () => {
    const r = leaseVsBuy();
    expect(r.capex).toBe(302_000);
    expect(r.buy).toBeGreaterThan(0);
    expect(r.lease).toBeGreaterThan(0);
    expect(['buy', 'lease']).toContain(r.favors);
  });
});
