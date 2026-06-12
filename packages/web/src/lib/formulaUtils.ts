// Pure computed-value functions for the Product Development module.
// Ported from CLAUDE.md §5 (Babylon OS R&D spec) into TypeScript.

export interface IngredientLine {
  wtPct: number;
  pricePerKg?: number;
  shippingCost?: number;
  naturalOriginPct?: number;
}

/** Cost per unit for one ingredient line (USD). */
export function ingredientCostPerUnit(
  wtPct: number,
  pricePerKg: number,
  shippingCost: number,
  fillWeightGrams: number,
): number {
  return (wtPct / 100) * (pricePerKg + shippingCost) * (fillWeightGrams / 1000);
}

/** Total unit formula cost (USD) across all ingredient lines. */
export function totalFormulaCost(ingredients: IngredientLine[], fillWeightGrams: number): number {
  return ingredients.reduce(
    (sum, ing) => sum + ingredientCostPerUnit(ing.wtPct || 0, ing.pricePerKg || 0, ing.shippingCost || 0, fillWeightGrams),
    0,
  );
}

/** Sum of wt% across lines. */
export function wtPctSum(ingredients: IngredientLine[]): number {
  return ingredients.reduce((s, i) => s + (Number(i.wtPct) || 0), 0);
}

/** wt% must sum to exactly 100.0000 (within float tolerance). */
export function wtPctValid(ingredients: IngredientLine[]): boolean {
  return Math.abs(wtPctSum(ingredients) - 100) < 0.0001;
}

/**
 * IFRA allergen use level in the finished formula (%).
 * ingredientWtPct = the ingredient's wt% in the formula.
 * allergenPctInIngredient = the allergen's % within that ingredient (compositional breakdown).
 */
export function allergenUseLevelInFormula(ingredientWtPct: number, allergenPctInIngredient: number): number {
  return (ingredientWtPct / 100) * (allergenPctInIngredient / 100) * 100;
}

/** COSMOS % natural origin (simplified): wt-weighted average of per-ingredient natural-origin %. */
export function naturalOriginPct(ingredients: IngredientLine[]): number {
  return ingredients.reduce((sum, ing) => sum + ((ing.wtPct || 0) * (ing.naturalOriginPct || 0)) / 100, 0);
}
