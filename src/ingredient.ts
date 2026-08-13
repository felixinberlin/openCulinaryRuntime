import { z } from "zod";

/**
 * Entity & Ingestion Models — Roadmap Phase 1 (see ROADMAP.md).
 *
 * This file currently defines only `EntitySchema` and its supporting
 * sub-schemas: the "Knowledge" layer for a single canonical ingredient/tool
 * (CONCEPT.md §3, §6 — "Knowledge is immutable"). `RecipeIngredientSchema`
 * (instance portions inside a specific recipe) and `ParsedIngredientSchema`
 * (staging shape for raw scraper output) are separate, later concerns per
 * CLAUDE_DEV_CTX.md and are not needed to express a standalone entity like
 * salt — they're not implemented here yet.
 */

/** Ingredients and tools are both Entities, but never conflated (CLAUDE_DEV_CTX.md). */
export const EntityKindSchema = z.enum(["ingredient", "tool"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

/** Physical state of matter (Culinary_Informatics_Research_Plan.pdf §2, "estado de agregación"). */
export const AggregationStateSchema = z.enum([
  "solid",
  "liquid",
  "gas",
  "powder",
  "granular",
  "paste",
  "emulsion",
]);
export type AggregationState = z.infer<typeof AggregationStateSchema>;

/**
 * Whether this entity is built from other entities, or atomic.
 * masideas.md §6 "Structure" — most base ingredients (salt, water) are
 * non-composite; assembled foods (a sandwich) would set composite: true.
 */
export const StructureSchema = z
  .object({
    composite: z.boolean().default(false),
    components: z.array(z.string()).default([]), // entity ids, when composite
  })
  .default({ composite: false, components: [] });
export type Structure = z.infer<typeof StructureSchema>;

/**
 * A citation for a numeric claim — replaces burying "commonly cited,
 * unverified" hedges inconsistently in prose (found 2026-08-12: `egg.json`/
 * `garlic.json` got that hedge, `potato.json`/`salt.json`/`water.json`/
 * `oil.json`/`egg_yolk.json`/`egg_white.json`/`egg_cracked.json` didn't, for
 * numbers with the exact same epistemic status — inconsistently applied
 * rigor, not consistently absent rigor).
 *
 * `confidence` is deliberately two-valued, not three: this repo has no live
 * retrieval capability, so nothing here has ever been checked against a
 * primary source directly — there is no honest "primary_source" tier to
 * offer. `standard_reference` means a specific, real, canonical work for
 * this class of fact is named (USDA FoodData Central, the CRC Handbook of
 * Chemistry and Physics, a named paper) — checkable by a reader, not
 * independently verified by this repo. `commonly_cited_unverified` means
 * recalled as generally taught/published but without confidence in which
 * specific canonical source it traces to. Neither is a substitute for actual
 * primary-source verification before any real-world/production use.
 */
export const CitationSchema = z.object({
  source: z.string().min(1),
  confidence: z.enum(["standard_reference", "commonly_cited_unverified"]),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** Chemical/nutritional composition. masideas.md §6 "Composition". */
export const CompositionSchema = z
  .object({
    chemicalFormula: z.string().optional(),
    /** Nutrient amount per 100g of entity, keyed by nutrient id (e.g. "sodium_mg"). */
    nutrientsPer100g: z.record(z.string(), z.number()).optional(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type Composition = z.infer<typeof CompositionSchema>;

/**
 * Thermophysical properties driving thermal simulation
 * (Culinary_Informatics_Research_Plan.pdf §2: thermal conductivity, density, ...).
 */
export const ThermophysicalPropertiesSchema = z
  .object({
    thermalConductivityWPerMK: z.number().nonnegative(),
    densityKgPerM3: z.number().positive(),
    specificHeatJPerKgK: z.number().positive(),
    meltingPointC: z.number(),
    boilingPointC: z.number(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type ThermophysicalProperties = z.infer<typeof ThermophysicalPropertiesSchema>;

/** masideas.md §6 "Sensory Properties". */
export const SensoryPropertiesSchema = z
  .object({
    taste: z.array(
      z.enum(["salty", "sweet", "sour", "bitter", "umami", "neutral"])
    ),
    aroma: z.array(z.string()),
    texture: z.array(z.string()),
    color: z.string(),
  })
  .partial();
export type SensoryProperties = z.infer<typeof SensoryPropertiesSchema>;

/**
 * Mechanical capability flags.
 *
 * `.catchall(z.boolean())` deliberately keeps this map open: an unrecognized
 * capability key must still parse rather than fail validation, per
 * CONCEPT.md §15 "Unknown Knowledge" / the PDF §4 dynamic capability
 * inference example (isPeelable/isChoppable/isFryable inferred at runtime
 * for an ingredient outside the canonical dictionary).
 */
export const CapabilitiesSchema = z
  .object({
    isPeelable: z.boolean(),
    isChoppable: z.boolean(),
    isFryable: z.boolean(),
    isBoilable: z.boolean(),
    isDissolvable: z.boolean(),
    isSeasoning: z.boolean(),
    isWashable: z.boolean(),
    isBlendable: z.boolean(),
    isFryingMedium: z.boolean(),
    isBakeable: z.boolean(),
    isBoilingMedium: z.boolean(),
    /** Can receive a seasoning (as opposed to isSeasoning: *is* a seasoning). */
    isSeasonable: z.boolean(),
  })
  .partial()
  .catchall(z.boolean());
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

/**
 * Cooklang interop (CLAUDE_DEV_CTX.md: "maintain full backward-compatibility
 * with custom scaling rules ... and spice locks").
 */
export const CooklangInteropSchema = z.object({
  /** The bare token used after `@` in .cook files, e.g. "sal" for `@sal`. */
  canonicalToken: z.string(),
  /**
   * True for `=`-prefixed quantities in Cooklang: this entity's amount does
   * NOT scale linearly when a recipe is scaled (the canonical example is salt).
   */
  spiceLock: z.boolean().default(false),
});
export type CooklangInterop = z.infer<typeof CooklangInteropSchema>;

/**
 * EntitySchema — validates a static entity (CLAUDE_DEV_CTX.md).
 * One JSON file per entity under `data/entities/*.json`.
 */
export const EntitySchema = z.object({
  /** Stable machine id, e.g. "salt". Used as the join key everywhere else
   *  (recipe-step.ts inputs/outputs, INVALID_TRANSITIONS, etc.). */
  id: z.string().min(1),
  kind: EntityKindSchema,
  /** locale -> display name, e.g. { en: "Salt", es: "Sal" }. */
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  aggregationState: AggregationStateSchema,
  structure: StructureSchema,
  composition: CompositionSchema.optional(),
  /** State ids this entity can be found in (CONCEPT.md §8). Mutually
   *  exclusive at any moment — an instance has exactly one. */
  possibleStates: z.array(z.string()).default([]),
  /**
   * Tag ids this entity can carry, orthogonal to `possibleStates` — an
   * instance can have any number of these at once, alongside its one state.
   * Needed because not every property is exclusive: a potato can be
   * "boiled" (state) AND "salted" (tag) simultaneously, unlike "boiled" vs
   * "fried" which really are exclusive. See ActionOutputsSchema.addsTag.
   */
  possibleTags: z.array(z.string()).default([]),
  /** Action ids that may legally target this entity. */
  allowedTransformations: z.array(z.string()).default([]),
  /**
   * Per-action state preconditions: action id -> the state this entity must
   * already be in before that action may run, e.g. { "cut": "peeled" } —
   * "cutting a potato presupposes it's already peeled." Lives on the entity
   * rather than on the generic CUT verb because the precondition is a fact
   * about *this* ingredient, not about cutting in general (not everything
   * CUT can target needs peeling first).
   */
  statePrerequisites: z.record(z.string(), z.string()).default({}),
  /**
   * Entity ids this entity may spawn when consumed (CONCEPT.md §9). This is
   * the fallback list any `spawnsTargetByproducts` action uses when it has
   * no more specific entry in `byproductsByAction` below — correct as long
   * as an entity has at most one action that spawns byproducts (e.g.
   * potato.json + peel -> potato_peel).
   */
  producedByproducts: z.array(z.string()).default([]),
  /**
   * Per-action override of `producedByproducts`, keyed by action id, for an
   * entity with more than one `spawnsTargetByproducts` action that don't
   * yield the same things — e.g. egg.json: PEEL (a boiled egg's shell)
   * should spawn only egg_shell, while SEPARATE (cracking a raw egg) spawns
   * egg_shell + egg_yolk + egg_white. Without this, both actions would
   * spawn the full flat `producedByproducts` list, which is wrong for PEEL.
   * An action id absent here falls back to the flat list.
   */
  byproductsByAction: z.record(z.string(), z.array(z.string())).default({}),
  /**
   * Per-action HACCP tie-in, keyed by action id -> CriticalControlPointSchema
   * id (thermal.ts, data/ccps/*.json) — e.g. egg.json: { fry: "egg_cooking",
   * scramble: "egg_cooking", poach: "egg_cooking" }. Lives on the entity,
   * not the action, for the same reason byproductsByAction does: FRY itself
   * carries no food-safety risk (frying a potato has no Salmonella CCP) —
   * the risk is a fact about *what's* being fried, not the verb.
   */
  criticalControlPointsByAction: z.record(z.string(), z.string()).default({}),
  capabilities: CapabilitiesSchema.default({}),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;
