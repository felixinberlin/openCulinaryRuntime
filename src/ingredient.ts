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

/** Chemical/nutritional composition. masideas.md §6 "Composition". */
export const CompositionSchema = z
  .object({
    chemicalFormula: z.string().optional(),
    /** Nutrient amount per 100g of entity, keyed by nutrient id (e.g. "sodium_mg"). */
    nutrientsPer100g: z.record(z.string(), z.number()).optional(),
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
  /** State ids this entity can be found in (CONCEPT.md §8). */
  possibleStates: z.array(z.string()).default([]),
  /** Action ids that may legally target this entity. */
  allowedTransformations: z.array(z.string()).default([]),
  /** Entity ids this entity may spawn when consumed (CONCEPT.md §9). */
  producedByproducts: z.array(z.string()).default([]),
  capabilities: CapabilitiesSchema.default({}),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;
