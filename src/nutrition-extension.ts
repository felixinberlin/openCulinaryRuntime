import { z } from "zod";
import { CitationSchema, type Quantity } from "./ingredient.ts";

/**
 * Nutrition extension (Roadmap Phase 6) — `UsdaMealPatternContributionSchema`,
 * a pluggable, OPTIONAL mapping from an entity to what it contributes toward
 * a USDA (NSLP/CACFP) meal pattern requirement. Deliberately NOT a field on
 * `EntitySchema` itself — see `reference/nutrition-extension.md` for why,
 * design rationale, and citations.
 */

/** The five NSLP/CACFP meal-pattern food components (7 CFR 210.10), plus
 *  `not_creditable` for a real, audited "this doesn't count toward any of
 *  them" fact (fats/oils, seasonings) — named, not left unfilled. */
export const MealPatternComponentSchema = z.enum([
  "fruit",
  "vegetable",
  "grains",
  "meat_meat_alternate",
  "milk",
  "not_creditable",
]);
export type MealPatternComponent = z.infer<typeof MealPatternComponentSchema>;

/** The vegetable component's five required subgroups plus "additional" —
 *  7 CFR 210.10(c)(2)(iii). */
export const VegetableSubgroupSchema = z.enum([
  "dark_green",
  "red_orange",
  "beans_peas_legumes",
  "starchy",
  "other",
  "additional",
]);
export type VegetableSubgroup = z.infer<typeof VegetableSubgroupSchema>;

/**
 * A discriminated union, one variant per `MealPatternComponent` — mirrors
 * `ingredient.ts`'s `QuantitySchema` in shape. Each creditable variant
 * expresses a crediting RATE against one specific `Quantity` unit rather
 * than a single flat amount, since the three real crediting bases
 * (discrete count, as-served volume, mass of creditable ingredient) are
 * genuinely different kinds of facts — see `reference/nutrition-extension.md`.
 */
export const UsdaMealPatternContributionSchema = z.discriminatedUnion("component", [
  z.object({
    component: z.literal("not_creditable"),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
  z.object({
    component: z.literal("meat_meat_alternate"),
    unit: z.literal("ounce_equivalent"),
    /** Oz eq credited per 1 whole discrete unit (`Quantity` kind "precise", unit "count"). */
    perCount: z.number().positive(),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
  z.object({
    component: z.literal("milk"),
    unit: z.literal("cup_equivalent"),
    /** Cup eq credited per 1 cup as served (`Quantity` kind "precise", unit "cup"). */
    perCup: z.number().positive(),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
  z.object({
    component: z.literal("fruit"),
    unit: z.literal("cup_equivalent"),
    perCup: z.number().positive(),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
  z.object({
    component: z.literal("vegetable"),
    subgroup: VegetableSubgroupSchema,
    unit: z.literal("cup_equivalent"),
    perCup: z.number().positive(),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
  z.object({
    component: z.literal("grains"),
    unit: z.literal("ounce_equivalent"),
    /** Grams of THIS entity, as a creditable grain ingredient, that equal
     *  1.0 oz eq — e.g. 16 for flour in a baked, flour-based product
     *  (Food Buying Guide "Groups A-G"; a different rate applies to
     *  cereal/grain-based-dessert "Groups H-I", not modeled here). */
    creditableGramsPerOzEq: z.number().positive(),
    citation: CitationSchema,
    note: z.string().optional(),
  }),
]);
export type UsdaMealPatternContribution = z.infer<typeof UsdaMealPatternContributionSchema>;

/** One `data/meal-pattern-contributions/*.json` file. `id` is the `Entity.id`
 *  this describes — a one-file-per-entity, opt-in mapping, the same shape
 *  `registry.ts`'s `loadDir` already expects. */
export const MealPatternContributionFileSchema = z.object({
  id: z.string().min(1),
  contribution: UsdaMealPatternContributionSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type MealPatternContributionFile = z.infer<typeof MealPatternContributionFileSchema>;

/**
 * Mechanically credits `quantity` against `contribution`, only when
 * `quantity`'s unit is exactly the one the crediting rate is defined
 * against (count for meat/meat-alternate, cup for milk/fruit/vegetable,
 * g/kg for grains). Returns `undefined` — named, not guessed — for
 * `not_creditable`, a missing quantity, or any unit/kind this crediting
 * rate doesn't cover; never converts between units (no mL/tsp/tbsp-to-cup
 * conversion is attempted here). See `reference/nutrition-extension.md`.
 */
export function creditedAmount(
  contribution: UsdaMealPatternContribution,
  quantity: Quantity | undefined
): { amount: number; unit: "ounce_equivalent" | "cup_equivalent" } | undefined {
  if (!quantity || quantity.kind !== "precise") return undefined;

  switch (contribution.component) {
    case "not_creditable":
      return undefined;
    case "meat_meat_alternate":
      if (quantity.unit !== "count") return undefined;
      return { amount: quantity.amount * contribution.perCount, unit: "ounce_equivalent" };
    case "milk":
    case "fruit":
    case "vegetable":
      if (quantity.unit !== "cup") return undefined;
      return { amount: quantity.amount * contribution.perCup, unit: "cup_equivalent" };
    case "grains": {
      if (quantity.unit !== "g" && quantity.unit !== "kg") return undefined;
      const grams = quantity.unit === "kg" ? quantity.amount * 1000 : quantity.amount;
      return { amount: grams / contribution.creditableGramsPerOzEq, unit: "ounce_equivalent" };
    }
  }
}
