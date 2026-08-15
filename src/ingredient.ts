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
 * Real, cited physical SIZE — added 2026-08-15, directly answering "what
 * diameter is a potato" the same way `composition`/`thermophysical` already
 * answer "what's the density/conductivity": a structured, cited field
 * instead of a number buried in `metadata.notes` or a `description` string.
 * `potato-doneness.ts`'s own `whole` entry cited America's Test Kitchen's
 * "2-2.5 inch diameter" figure as prose ONLY before this field existed —
 * this promotes that same figure to a real field rather than inventing a
 * new number, and that file now points here instead of duplicating it.
 *
 * Deliberately narrow: ONE typical-size fact (`typicalDiameterCm`), not a
 * general geometry schema — `src/cut-dimensions.ts` (same day) is the
 * sibling piece giving CUT's `shape` parameter its own real, cited
 * dimensions; the two are separate concerns (an entity's own natural size
 * vs. how a knife cut divides it) kept in separate files on purpose.
 */
export const PhysicalDimensionsSchema = z
  .object({
    typicalDiameterCm: z.object({ min: z.number().positive(), max: z.number().positive() }),
    citation: CitationSchema.optional(),
  })
  .partial();
export type PhysicalDimensions = z.infer<typeof PhysicalDimensionsSchema>;

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
    /** The real safety ceiling for a heated cooking medium that doesn't
     *  boil at any cooking-relevant temperature (oil.json — a real
     *  frying temperature, e.g. 175°C, is nowhere near boiling, but IS
     *  meaningfully close to a real safety limit) — added 2026-08-14
     *  alongside `place.ts`'s `advanceTempSeconds` generalization, which
     *  reads this field to reject an unsafe target temperature outright
     *  rather than silently heating toward it. Optional and meaningless
     *  for anything that doesn't have one (water.json has no smoke point;
     *  `boilingPointC` is that entity's own real ceiling instead) — not
     *  every thermal medium needs both fields, and forcing one on an
     *  entity it doesn't apply to would misrepresent the physics. */
    smokePointC: z.number().optional(),
    citation: CitationSchema.optional(),
  })
  .partial();
export type ThermophysicalProperties = z.infer<typeof ThermophysicalPropertiesSchema>;

/** masideas.md §6 "Sensory Properties". */
export const SensoryPropertiesSchema = z
  .object({
    /**
     * "pungent" closed 2026-08-13 — flagged as a real gap in garlic.json's
     * own flavorChemistryNote before it blocked anything: the five basic
     * tastes (salty/sweet/sour/bitter/umami) don't include the trigeminal/
     * chemesthetic "heat" sensation (capsaicin in chili, piperine in black
     * pepper, allicin in garlic) — a real, distinct sensory channel (pain/
     * temperature nerve fibers, not taste buds), not a degree of
     * bitterness. Kept as one added enum value rather than a separate
     * schema field: still just "how does this register on the tongue/in
     * the mouth," the same question every other taste value answers.
     */
    taste: z.array(
      z.enum(["salty", "sweet", "sour", "bitter", "umami", "pungent", "neutral"])
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
 * How much of an ingredient instance is actually present/used —
 * ROADMAP.md Phase 1's `RecipeIngredientSchema`, closed 2026-08-13 (used as
 * `RecipeInstanceSchema.quantity`, recipe.ts, not on `EntitySchema` itself:
 * an amount is a fact about one recipe's USE of an ingredient, not about the
 * ingredient's own immutable knowledge — same reasoning `EntitySchema`
 * elsewhere applies to state/tags never living on the entity).
 *
 * Three genuinely different KINDS, not one fuzzy `amount` field, because
 * real recipes use different KINDS of quantity, not just different units of
 * the same kind — collapsing them into one number would misrepresent
 * whichever ones don't actually work that way:
 *
 * - `"precise"`: a real measured amount + unit (5g, 200ml, 2 count). The
 *   ordinary case for most ingredients.
 * - `"imprecise"`: a real, commonly-used culinary quantity descriptor that
 *   is NOT reducible to a precise number by convention — "a pinch," "a
 *   dash," "to taste." Cooks genuinely do not measure these; forcing a fake
 *   gram value here would misrepresent how the quantity is actually used —
 *   the same "don't imply more precision than was verified" standard this
 *   repo already holds citations to (`CitationSchema` above).
 *   `approxRangeGrams` is optional, explicitly non-authoritative reference
 *   context for a human (or a future planner), never consumed by
 *   engine.ts. It's also inherently imprecise for a SECOND reason, not just
 *   "pinches aren't measured": how much salt a pinch actually is depends on
 *   crystal size/shape (fine table salt vs. flaky sea salt vs. coarse
 *   kosher packs very differently by volume) — a gap this repo doesn't
 *   model at all yet (no separate entities for salt by crystal size), so
 *   `approxRangeGrams` should be read as "commonly cited for ordinary table
 *   salt," not a figure this schema can actually guarantee.
 * - `"relative"`: a real, PRECISE, but ratio-based quantity — the amount is
 *   defined as a percentage of some OTHER ingredient's mass/count, not an
 *   absolute number. The canonical case: professional bread salt, dosed at
 *   ~1.8-2.2% of flour weight (a real "baker's percentage"), not "a pinch."
 *   Answers "compared to what?" directly for the cases where a quantity
 *   really is relative, instead of collapsing it into a precise-but-wrong
 *   absolute number the way a single `amount` field would.
 *
 * Deliberately NOT wired into engine.ts/recipe-runner.ts's execution path:
 * ingredients are still never consumed/decremented (engine.ts's own doc
 * comment; LEARNINGS_ENGINE.md 2026-08-12) — this records how much of an instance
 * exists/was used, for a human or a future real inventory system to read;
 * it does not make `applyAction` quantity-aware. Also not wired to any
 * recipe-scaling engine: `CooklangInteropSchema.spiceLock` above already
 * flags "this entity's amount doesn't scale linearly" at the entity level,
 * but no scaling-multiplier feature exists anywhere in this repo to scale
 * AGAINST — `spiceLock` stays exactly as informational as it always was;
 * this schema doesn't change that, it only answers "how much right now,"
 * not "how much if this recipe were doubled."
 */
export const QuantitySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("precise"),
    amount: z.number().positive(),
    unit: z.enum(["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "count"]),
  }),
  z.object({
    kind: z.literal("imprecise"),
    descriptor: z.enum(["pinch", "dash", "handful", "splash", "to_taste"]),
    /** Non-authoritative reference range only — see the doc comment above
     *  for why this can't be treated as a real measurement. */
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
    /** The entity id this ratio is computed against, e.g. "flour" — must be
     *  another instance's entityId present in the same recipe's
     *  initialInventory (scripts/validate.ts cross-checks this; engine.ts
     *  does not compute an absolute amount from it). */
    ofEntityId: z.string().min(1),
    basis: z.enum(["mass", "count"]).default("mass"),
    note: z.string().optional(),
  }),
]);
export type Quantity = z.infer<typeof QuantitySchema>;

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
   * Per-action state preconditions: action id -> the state(s) this entity
   * must already be in before that action may run, e.g. { "cut": "peeled" }
   * — "cutting a potato presupposes it's already peeled." Lives on the
   * entity rather than on the generic CUT verb because the precondition is
   * a fact about *this* ingredient, not about cutting in general (not
   * everything CUT can target needs peeling first).
   *
   * A value may be a single state (the original, still-valid shape — every
   * entity file written before 2026-08-13 needs no change) OR an array of
   * acceptable prior states, added the same day for a real case that a
   * single required state couldn't express: potato.json's `cut` needs to
   * accept EITHER "washed" (skin-on wedges/rustic fries, a real, legitimate
   * style) OR "peeled" (the conventional path) — not force one specific
   * predecessor when either is genuinely valid. `engine.ts`'s check treats
   * a single string as a one-element set, so nothing about the single-value
   * case's behavior or error message changes.
   *
   * Each entry is checked against EITHER the target's current `state` OR
   * its `tags` (`engine.ts`, added 2026-08-15) — not state alone. "washed"
   * is the real case that forced this: it names an orthogonal, persistent
   * FACT ("has this been washed at least once"), not a mutually-exclusive
   * FORM the way "peeled"/"sliced"/"fried" are — you can wash a potato,
   * then peel it, and it is still, physically, washed. Modeling "washed"
   * as a `state` (WASH's old `outputs.transformedState`) meant PEEL
   * silently overwrote that fact away, since `state` holds exactly one
   * value. WASH now sets a TAG instead (`wash.json`'s `outputs.addsTag`,
   * the same pattern SALT/PEPPER/etc. already use), and this field's
   * entries are satisfied by a matching tag exactly as they are by a
   * matching state — so `potato.json`'s `cut`/`grate`: `["washed",
   * "peeled"]` still means what it always meant ("either is an acceptable
   * predecessor"), now correctly regardless of what order they happened
   * in, or whether both are true at once.
   */
  statePrerequisites: z.record(z.string(), z.union([z.string(), z.array(z.string())])).default({}),
  /**
   * Per-entity forbidden state transitions (ROADMAP.md Phase 4 —
   * `CLAUDE_DEV_CTX.md`'s `OcrValidationEngine.INVALID_TRANSITIONS`, the
   * repo's own named "single largest unbuilt piece of the original spec"
   * until 2026-08-15). Keyed by the state an instance is CURRENTLY in ->
   * the state ids it may never legally become FROM there, e.g.
   * `potato.json`: `{ "mashed": ["peeled", "sliced", ..., "boiled"] }` —
   * once puréed, there is no discrete skin or piece left for PEEL/CUT/
   * GRATE/BOIL/BAKE to act on. A genuine physical fact, checked against
   * real technique before being asserted — see the correction note below.
   *
   * **A real mistake, corrected the same day, worth keeping documented
   * rather than erased**: the first version of this field followed
   * `CLAUDE_DEV_CTX.md`'s own literal example too, uncritically —
   * "cannot peel a potato that is already boiled" — and forbade every
   * processed potato state from reverting to `"peeled"`. That claim is
   * factually wrong: boil-in-jacket-then-peel is a real, common
   * technique (many potato salad recipes, jacket/new potatoes), caught
   * on direct user correction. This repo's own worked example, carried
   * in `peel.json`'s metadata since the first commit, was never actually
   * checked against real culinary technique until it was finally
   * enforced — exactly the "proven, not asserted" failure this whole
   * field exists to prevent, applied to itself. Fixed by removing every
   * incorrect entry rather than softening it; see `potato.json`'s own
   * `invalidTransitionsNote` and `LEARNINGS_PROCESS.md` 2026-08-15.
   *
   * Deliberately keyed PER ENTITY, not one shared global map — resolving
   * `ROADMAP.md`'s own "unresolved, worth deciding before building either"
   * open question. `CLAUDE_DEV_CTX.md`'s literal example is global (bare
   * state names like "boiled"), but a global map is fragile in a way
   * per-entity keying isn't: the FIRST (wrong) draft of potato's rule —
   * `boiled -> peeled` forbidden — directly contradicted `egg.json`'s own
   * verified `statePrerequisites.peel: "boiled"` (egg genuinely does
   * require boiling before peeling) under the identical bare state name.
   * A global map cannot hold both a real rule and a wrong one without one
   * silently overwriting the other; per-entity keying at least contains
   * the damage to the entity that's actually wrong. The corrected data no
   * longer has a live collision (potato's surviving rule is scoped to
   * `"mashed"`, a state egg doesn't have), but the near-miss is a real,
   * concrete demonstration of the risk a global map would carry — not a
   * hypothetical. Same "state vocabulary isn't portable across entities"
   * reasoning `statePrerequisites` above already commits to.
   *
   * Checked in `engine.ts`'s `applyAction` against the action's actual
   * COMPUTED next state (`transformedState` or `transformedStateFromParameter`
   * resolved), not the action id — so a parameter-driven output (e.g.
   * `CUT`'s `shape`) is covered without per-action authoring, and an
   * action that doesn't change `state` at all (an `addsTag`-only action
   * like `SALT`) can never trip this check, since its "next state" is
   * just the unchanged current one. Optional and defaults to `{}`, so
   * every entity file written before this field existed is completely
   * unaffected.
   */
  invalidTransitions: z.record(z.string(), z.array(z.string())).default({}),
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
  physicalDimensions: PhysicalDimensionsSchema.optional(),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;
