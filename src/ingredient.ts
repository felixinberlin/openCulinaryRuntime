import { z } from "zod";

/**
 * Entity & Ingestion Models (Roadmap Phase 1) — `EntitySchema` and its
 * supporting sub-schemas for a single canonical ingredient/tool.
 * See `reference/ingredient.md` for design rationale, history, and citations.
 */

/** Ingredients and tools are both Entities, never conflated. */
export const EntityKindSchema = z.enum(["ingredient", "tool"]);
export type EntityKind = z.infer<typeof EntityKindSchema>;

/** Physical state of matter. */
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

/** Whether this entity is built from other entities, or atomic. */
export const StructureSchema = z
  .object({
    composite: z.boolean().default(false),
    components: z.array(z.string()).default([]), // entity ids, when composite
  })
  .default({ composite: false, components: [] });
export type Structure = z.infer<typeof StructureSchema>;

/** A citation for a numeric claim: source, confidence tier, optional note. */
export const CitationSchema = z.object({
  source: z.string().min(1),
  confidence: z.enum(["standard_reference", "commonly_cited_unverified"]),
  note: z.string().optional(),
});
export type Citation = z.infer<typeof CitationSchema>;

/** A `{min, max}` numeric range, refined so `min <= max`. */
export const NumericRangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min <= r.max, { message: "min must be <= max" });
export type NumericRange = z.infer<typeof NumericRangeSchema>;

/** A single structured, typed, cited numeric fact — a point value or
 *  range, with its own citation and a `verified` flag independent of
 *  `citation.confidence` (was this specific number re-checked this
 *  session, vs. is a canonical source merely named). */
export const DomainFactSchema = z.object({
  value: z.union([z.number(), NumericRangeSchema]),
  unit: z.string().min(1),
  citation: CitationSchema,
  verified: z.boolean(),
  note: z.string().optional(),
});
export type DomainFact = z.infer<typeof DomainFactSchema>;

/** A cited fraction (0-1 range) of a parent entity's mass this byproduct
 *  entity typically represents. */
export const YieldFractionSchema = z
  .object({
    /** The parent entity id this fraction is relative to. */
    ofParentEntityId: z.string().min(1),
    /** Typical fraction (0-1) of the parent's original mass, e.g. `{ min: 0.10, max: 0.12 }` for "10-12%". */
    min: z.number().positive().max(1),
    max: z.number().positive().max(1),
    citation: CitationSchema,
  })
  .refine((y) => y.min <= y.max, { message: "min must be <= max" });
export type YieldFraction = z.infer<typeof YieldFractionSchema>;

/** Shared citation for `StorageLifeSchema.roomTempHours` — the USDA/FDA
 *  "Danger Zone" 2-hour rule. */
export const DANGER_ZONE_CITATION: Citation = {
  source:
    'USDA/FDA "Danger Zone" rule: perishable food should not remain between 40°F-140°F (4°C-60°C) for more than 2 hours.',
  confidence: "standard_reference",
  note: "See reference/ingredient.md for why this is a shared constant rather than re-cited per entity.",
};

/** Cited "how long is this safe/good for" storage guidance for one entity state. */
export const StorageLifeSchema = z
  .object({
    /** How long this keeps under active refrigeration (~40°F/4°C or below). */
    refrigeratedDays: NumericRangeSchema.optional(),
    /** How long this is safe at room temperature — see `DANGER_ZONE_CITATION`. */
    roomTempHours: NumericRangeSchema.optional(),
    /** How long this keeps in a cool, dry pantry/counter without refrigeration. */
    pantryMonths: NumericRangeSchema.optional(),
    /** True when refrigerating this state is itself the wrong advice (a quality, not safety, fact). */
    doNotRefrigerate: z.boolean().optional(),
    citation: CitationSchema,
    note: z.string().optional(),
  })
  .partial()
  .required({ citation: true });
export type StorageLife = z.infer<typeof StorageLifeSchema>;

/** Chemical/nutritional composition. */
export const CompositionSchema = z
  .object({
    chemicalFormula: z.string().optional(),
    /** Nutrient amount per 100g of entity, keyed by nutrient id (e.g. "sodium_mg"). */
    nutrientsPer100g: z.record(z.string(), z.number()).optional(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type Composition = z.infer<typeof CompositionSchema>;

/** Regulatory basis for the FDA "Big 9" allergen list below (FALCPA 2004 + FASTER Act 2021). */
export const ALLERGEN_REGULATION_CITATION: Citation = {
  source:
    "FALCPA, the Food Allergen Labeling and Consumer Protection Act of 2004 (milk, egg, fish, crustacean_shellfish, tree_nuts, peanuts, wheat, soybeans), plus the FASTER Act of 2021 (effective 2023-01-01, adding sesame as the 9th).",
  confidence: "standard_reference",
  note: "See reference/ingredient.md for why the FDA list, not the EU's wider one, was chosen.",
};

/** The FDA's 9 major food allergens (a closed enum, not a free string). */
export const AllergenSchema = z.enum([
  "milk",
  "egg",
  "fish",
  "crustacean_shellfish",
  "tree_nuts",
  "peanuts",
  "wheat",
  "soybeans",
  "sesame",
]);
export type Allergen = z.infer<typeof AllergenSchema>;

/** Real, cited physical size (currently just typical diameter). */
export const PhysicalDimensionsSchema = z
  .object({
    typicalDiameterCm: z.object({ min: z.number().positive(), max: z.number().positive() }),
    citation: CitationSchema.optional(),
  })
  .partial();
export type PhysicalDimensions = z.infer<typeof PhysicalDimensionsSchema>;

/** Thermophysical properties driving thermal simulation. */
export const ThermophysicalPropertiesSchema = z
  .object({
    thermalConductivityWPerMK: z.number().nonnegative(),
    densityKgPerM3: z.number().positive(),
    specificHeatJPerKgK: z.number().positive(),
    meltingPointC: z.number(),
    boilingPointC: z.number(),
    /** Safety ceiling for a medium that doesn't boil at a cooking-relevant temperature (e.g. oil). */
    smokePointC: z.number().optional(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type ThermophysicalProperties = z.infer<typeof ThermophysicalPropertiesSchema>;

/** Sensory properties. */
export const SensoryPropertiesSchema = z
  .object({
    /** "pungent" covers chemesthetic heat (capsaicin/piperine/allicin) — distinct from bitterness. */
    taste: z.array(z.enum(["salty", "sweet", "sour", "bitter", "umami", "pungent", "neutral"])),
    aroma: z.array(z.string()),
    texture: z.array(z.string()),
    color: z.string(),
  })
  .partial();
export type SensoryProperties = z.infer<typeof SensoryPropertiesSchema>;

/** Mechanical capability flags — an open map; an unrecognized key still parses. */
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

/** Cooklang interop: the canonical `@token` and whether its quantity spice-locks (doesn't scale linearly). */
export const CooklangInteropSchema = z.object({
  canonicalToken: z.string(),
  spiceLock: z.boolean().default(false),
});
export type CooklangInterop = z.infer<typeof CooklangInteropSchema>;

/** How much of an ingredient instance is present/used — a precise amount,
 *  an imprecise culinary descriptor ("a pinch"), or a ratio relative to
 *  another ingredient ("2% of flour weight"). See `reference/ingredient.md`
 *  for why these are three distinct kinds, not one fuzzy `amount` field. */
export const QuantitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("precise"),
    amount: z.number().positive(),
    unit: z.enum(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "count"]),
  }),
  z.object({
    kind: z.literal("imprecise"),
    descriptor: z.enum(["pinch", "dash", "handful", "splash", "to_taste"]),
    /** Non-authoritative reference range only — see `reference/ingredient.md`. */
    approxRangeGrams: z
      .object({ min: z.number().positive(), max: z.number().positive() })
      .optional(),
    citation: CitationSchema.optional(),
    note: z.string().optional(),
  }),
  z.object({
    kind: z.literal("relative"),
    /** e.g. 0.02 for a 2% baker's percentage. */
    ratio: z.number().positive(),
    /** Another instance's entityId present in the same recipe's initialInventory. */
    ofEntityId: z.string().min(1),
    basis: z.enum(["mass", "count"]).default("mass"),
    note: z.string().optional(),
  }),
]);
export type Quantity = z.infer<typeof QuantitySchema>;

/** Validates a static entity. One JSON file per entity under `data/entities/*.json`. */
export const EntitySchema = z.object({
  /** Stable machine id, e.g. "salt" — the join key used everywhere else. */
  id: z.string().min(1),
  kind: EntityKindSchema,
  /** locale -> display name, e.g. { en: "Salt", es: "Sal" }. */
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  aggregationState: AggregationStateSchema,
  structure: StructureSchema,
  composition: CompositionSchema.optional(),
  /** FDA "Big 9" allergens this entity carries — see `reference/ingredient.md`. */
  allergens: z.array(AllergenSchema).default([]),
  /** State ids this entity can be found in — mutually exclusive at any moment. */
  possibleStates: z.array(z.string()).default([]),
  /** Tag ids this entity can carry, orthogonal to `possibleStates` — see `reference/ingredient.md`. */
  possibleTags: z.array(z.string()).default([]),
  /** Action ids that may legally target this entity. */
  allowedTransformations: z.array(z.string()).default([]),
  /** Per-action state preconditions — see `reference/ingredient.md`. */
  statePrerequisites: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  /** Per-entity forbidden state transitions — see `reference/ingredient.md`. */
  invalidTransitions: z.record(z.string(), z.array(z.string())).default({}),
  /** Entity ids this entity may spawn when consumed; the fallback `byproductsByAction` uses. */
  producedByproducts: z.array(z.string()).default([]),
  /** Per-action override of `producedByproducts` — see `reference/ingredient.md`. */
  byproductsByAction: z.record(z.string(), z.array(z.string())).default({}),
  /** How much of a parent's mass this entity represents, when itself a spawned byproduct. */
  typicalYieldFractionOfParent: YieldFractionSchema.optional(),
  /** Per-action HACCP tie-in: action id -> `CriticalControlPointSchema` id. */
  criticalControlPointsByAction: z.record(z.string(), z.string()).default({}),
  /** States this entity is a raw-contamination-risk food-safety hazard in — see `reference/ingredient.md`. */
  rawContaminationRiskStates: z.array(z.string()).default([]),
  /** Cited storage/shelf-life guidance, keyed by state id — see `reference/ingredient.md`. */
  storageLifeByState: z.record(z.string(), StorageLifeSchema).default({}),
  /** Structured, cited reference facts not covered by another dedicated field. */
  domainFacts: z.record(z.string(), DomainFactSchema).default({}),
  capabilities: CapabilitiesSchema.default({}),
  physicalDimensions: PhysicalDimensionsSchema.optional(),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;

/** True when no transformation could ever legally move this instance to
 *  another state — computed from `invalidTransitions`/`possibleStates`,
 *  not a separately-authored flag. Does NOT mean "no action can target
 *  this instance at all" — a tag-only action (e.g. `SALT`) is still
 *  legal since it never changes `state`. See `reference/ingredient.md`. */
export function isTerminalState(entity: Entity, state: string): boolean {
  const forbidden = entity.invalidTransitions[state];
  if (!forbidden) return false;
  return entity.possibleStates.filter((s) => s !== state).every((s) => forbidden.includes(s));
}
