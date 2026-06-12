import type { ProductBOM, Build, BuiltComponent } from './types.js';
import { STRANDED_UNIT_COST } from './reference.js';

/**
 * Match-rate predictor for one finished good.
 * capacity = floor(available / perUnit) where available = onHand − reserved.
 * buildable = min(ingredient ceiling, packaging ceiling); the smaller side gates.
 * matchRate = lo/hi (1 = perfectly balanced); stranded = abundant-side units that can't complete.
 */
export function computeBuild(prod: ProductBOM): Build {
  const comps: BuiltComponent[] = prod.components.map((c) => {
    const reserved = c.reserved || 0;
    const available = Math.max(0, c.onHand - reserved);
    const incoming = c.incoming || 0;
    return {
      ...c,
      reserved,
      available,
      incoming,
      capacity: Math.floor(available / c.perUnit),
      onHandCapacity: Math.floor(c.onHand / c.perUnit),
      reservedUnits: Math.floor(reserved / c.perUnit),
      incomingUnits: Math.floor(incoming / c.perUnit),
      withIncomingCapacity: Math.floor((available + incoming) / c.perUnit),
    };
  });

  const ing = comps.filter((c) => c.type === 'ingredient');
  const pkg = comps.filter((c) => c.type === 'packaging');
  const ingCeil = ing.length ? Math.min(...ing.map((c) => c.capacity)) : Infinity;
  const pkgCeil = pkg.length ? Math.min(...pkg.map((c) => c.capacity)) : Infinity;
  const buildable = Math.min(ingCeil, pkgCeil);

  const ingCeilInc = ing.length ? Math.min(...ing.map((c) => c.withIncomingCapacity)) : Infinity;
  const pkgCeilInc = pkg.length ? Math.min(...pkg.map((c) => c.withIncomingCapacity)) : Infinity;
  const buildableWithIncoming = Math.min(ingCeilInc, pkgCeilInc);

  const bottleneck = comps.reduce((a, b) => (b.capacity < a.capacity ? b : a), comps[0]!);
  const limitSide = pkgCeil < ingCeil ? 'packaging' : ingCeil < pkgCeil ? 'ingredient' : 'balanced';
  const lo = Math.min(ingCeil, pkgCeil);
  const hi = Math.max(ingCeil, pkgCeil);
  const matchRate = hi > 0 ? lo / hi : 1;
  const stranded = Math.max(0, hi - lo);
  const totalAvail = buildable + (prod.finishedOnHand || 0);
  const demandCover = prod.demand60 > 0 ? totalAvail / prod.demand60 : Infinity;

  return { ...prod, comps, ing, pkg, ingCeil, pkgCeil, buildable, buildableWithIncoming, bottleneck, limitSide, matchRate, stranded, totalAvail, demandCover };
}

/** Stranded ingredient capital across a set of builds (packaging-limited × blended cost). */
export function strandedCapital(builds: Build[]): number {
  return builds.reduce((a, b) => a + (b.limitSide === 'packaging' ? b.stranded * STRANDED_UNIT_COST : 0), 0);
}
