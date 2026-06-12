import type { Build, Schedule, ScheduleItem, ScheduleMode, ScheduleOpts } from './types.js';
import {
  COMPOUND_DAYS, FILL_DAYS, MICRO_DAYS, FREIGHT_DAYS, RECEIVE_DAYS, LASTMILE_DAYS, TARGET_COVER_DAYS,
  CARTON_PACK, PALLET_PACK, SECTION_301_RATE,
  FREIGHT_CARRIER, WH_OPERATOR, LASTMILE_CARRIER,
  componentVendor, componentCost, htsFor, vendorTerms, vendorOrigin,
} from './reference.js';

/**
 * Build a procurement schedule for one finished good.
 * mode "synced" = just-in-time backward from stock-out (materials land together at the build).
 * mode "naive"  = place every PO today (materials land scattered, sit idle, cash goes out early).
 * All offsets are signed day-counts from PLAN_TODAY.
 */
export function computeSchedule(b: Build, opts: ScheduleOpts = {}, mode: ScheduleMode = 'synced'): Schedule {
  const COMPOUND = opts.compound ?? COMPOUND_DAYS;
  const FILL = opts.fill ?? FILL_DAYS;
  const COVER = opts.cover ?? TARGET_COVER_DAYS;
  const daily = b.demand60 / 60;
  const coverDays = daily > 0 ? Math.round(b.finishedOnHand / daily) : 999;
  const targetBuild = Math.max(b.demand60, Math.ceil(daily * COVER));

  const base = b.comps.map((c) => {
    const capacity = Math.floor(c.onHand / c.perUnit);
    const isIng = c.type === 'ingredient';
    const orderUnits = Math.max(0, targetBuild - capacity);
    const vendor = componentVendor(c);
    const netTerms = vendorTerms(vendor);
    const value = orderUnits * componentCost(c);
    const hts = htsFor(c);
    const origin = vendorOrigin(vendor);
    const section301 = origin.country === 'China' ? SECTION_301_RATE : 0;
    const dutyRate = hts.duty + section301;
    const dutyCost = Math.round((value * dutyRate) / 100);
    return { ...c, capacity, isIng, orderUnits, orderQty: orderUnits * c.perUnit, value, vendor, netTerms, hts, origin, section301, dutyRate, dutyCost };
  });

  let items: ScheduleItem[];
  let compound: { startOff: number; endOff: number };
  let fill: { startOff: number; endOff: number };

  if (mode === 'synced') {
    const fillEnd = coverDays - FREIGHT_DAYS - RECEIVE_DAYS - MICRO_DAYS;
    const fillStart = fillEnd - FILL;
    const compoundEnd = fillStart;
    const compoundStart = compoundEnd - COMPOUND;
    items = base.map((c) => {
      const consume = c.isIng ? compoundStart : fillStart;
      const land = consume; // JIT: arrives exactly when needed
      const order = land - c.leadTimeDays;
      return { ...c, startOff: order, endOff: land, landOff: land, consumeOff: consume, idleDays: 0, payByOff: order + c.netTerms, daysToOrder: order };
    });
    compound = { startOff: compoundStart, endOff: compoundEnd };
    fill = { startOff: fillStart, endOff: fillEnd };
  } else {
    items = base.map((c) => ({ ...c, startOff: 0, endOff: c.leadTimeDays, landOff: c.leadTimeDays, idleDays: 0, payByOff: c.netTerms, daysToOrder: 0 }));
    const ingLands = items.filter((i) => i.isIng && i.orderUnits > 0).map((i) => i.landOff);
    const compoundStart = ingLands.length ? Math.max(...ingLands) : 0;
    const compoundEnd = compoundStart + COMPOUND;
    const pkgLands = items.filter((i) => !i.isIng && i.orderUnits > 0).map((i) => i.landOff);
    const fillStart = Math.max(compoundEnd, pkgLands.length ? Math.max(...pkgLands) : 0);
    const fillEnd = fillStart + FILL;
    compound = { startOff: compoundStart, endOff: compoundEnd };
    fill = { startOff: fillStart, endOff: fillEnd };
    items = items.map((c) => { const consume = c.isIng ? compoundStart : fillStart; return { ...c, consumeOff: consume, idleDays: Math.max(0, consume - c.landOff) }; });
  }

  const orderItems = items.filter((i) => i.orderUnits > 0).sort((a, c) => a.startOff - c.startOff);
  const micro = { startOff: fill.endOff, endOff: fill.endOff + MICRO_DAYS, days: MICRO_DAYS };
  const arriveWhOff = micro.endOff + FREIGHT_DAYS;
  const availOff = arriveWhOff + RECEIVE_DAYS;
  const customerOff = availOff + LASTMILE_DAYS;
  const cartons = Math.ceil(targetBuild / CARTON_PACK);
  const pallets = Math.max(1, Math.ceil(cartons / PALLET_PACK));
  const logistics = {
    freight: { key: 'freight', name: 'Inbound freight → 3PL', startOff: micro.endOff, endOff: arriveWhOff, days: FREIGHT_DAYS, ...FREIGHT_CARRIER, cost: Math.round(targetBuild * FREIGHT_CARRIER.cpu), units: targetBuild, cartons, pallets },
    receive: { key: 'receive', name: '3PL receive · scan lot · putaway', startOff: arriveWhOff, endOff: availOff, days: RECEIVE_DAYS, ...WH_OPERATOR, cost: Math.round(targetBuild * WH_OPERATOR.cpu), units: targetBuild, cartons, pallets },
    lastmile: { key: 'lastmile', name: 'Outbound → customer', startOff: availOff, endOff: customerOff, days: LASTMILE_DAYS, ...LASTMILE_CARRIER, cost: Math.round(targetBuild * LASTMILE_CARRIER.cpu), units: targetBuild, cartons, pallets },
  };
  const logisticsCost = targetBuild * (FREIGHT_CARRIER.cpu + WH_OPERATOR.cpu + LASTMILE_CARRIER.cpu);
  const dutyTotal = orderItems.reduce((a, c) => a + c.dutyCost, 0);
  const importedItems = orderItems.filter((i) => i.origin.imported);
  const offs = orderItems.map((i) => i.startOff);
  const earliestOrderOff = offs.length ? Math.min(...offs) : null;
  const totalValue = orderItems.reduce((a, c) => a + c.value, 0);
  const lands = orderItems.map((i) => i.landOff);
  const arrivalSpread = lands.length ? Math.max(...lands) - Math.min(...lands) : 0;
  const idleDays = orderItems.reduce((a, c) => a + c.idleDays, 0);
  const readyOff = availOff;
  const pays = orderItems.map((i) => i.payByOff);
  const latestPay = pays.length ? Math.max(...pays) : 0;
  const earliestPay = pays.length ? Math.min(...pays) : 0;
  const cashGap = earliestPay - readyOff;

  return {
    ...b, mode, daily, coverDays, needByOff: coverDays, targetBuild,
    items, orderItems, earliestOrderOff, totalValue,
    phases: { compound, fill, micro }, logistics, logisticsCost, dutyTotal, importedItems,
    arriveWhOff, availOff, customerOff, arrivalSpread, idleDays, readyOff, latestPay, cashGap,
  };
}

export const computePlan = (b: Build, opts?: ScheduleOpts): Schedule => computeSchedule(b, opts, 'synced');
