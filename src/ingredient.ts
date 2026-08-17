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

/**
 * `producedByproducts`/`byproductsByAction` below (`EntitySchema`) record
 * WHAT spawns when this entity's parent is processed — never HOW MUCH,
 * `ROADMAP.md`'s own long-named "yield/waste factors" gap (e.g. how much
 * of a potato's mass a peel actually is). This schema, placed on the
 * BYPRODUCT entity itself (not the parent), closes that: a real, cited
 * fraction of the PARENT's original mass this specific byproduct typically
 * represents.
 *
 * A RANGE (`min`/`max`), not a single point value — real yield varies by
 * cultivar/size/peeling method/individual specimen, the same "don't assert
 * false precision" discipline `POTATO_BOIL_DONENESS`/`EGG_BOIL_DONENESS`
 * already hold themselves to for timing ranges. `ofParentEntityId` is
 * checked by `scripts/validate.ts` against the actual `producedByproducts`/
 * `byproductsByAction` relationship that spawns this entity — a fraction
 * relative to the wrong parent would be a real, silent error, not a
 * cosmetic one.
 *
 * Deliberately data-only: nothing in `engine.ts`'s `applyAction` reads this
 * to actually compute a spawned instance's real mass (this repo has no
 * general quantity-tracking through the engine at all —
 * `RecipeInstanceSchema.quantity` is only ever declared on
 * `initialInventory`, never derived mid-recipe) — a real, named limit, not
 * silently implied to be more than it is.
 */
export const YieldFractionSchema = z
  .object({
    /** The entity id this fraction is relative to — the parent this byproduct is actually spawned FROM (`scripts/validate.ts` cross-checks this against a real `producedByproducts`/`byproductsByAction` relationship). */
    ofParentEntityId: z.string().min(1),
    /** Typical fraction (0-1) of the parent's original mass this byproduct represents — a real cited range, e.g. `{ min: 0.10, max: 0.12 }` for "10-12%". */
    min: z.number().positive().max(1),
    max: z.number().positive().max(1),
    citation: CitationSchema,
  })
  .refine((y) => y.min <= y.max, { message: "min must be <= max" });
export type YieldFraction = z.infer<typeof YieldFractionSchema>;

/** A `{min, max}` day/hour/month range, refined so `min <= max` — the exact
 *  "range, not a false-precision point value" shape `YieldFractionSchema`/
 *  `PhysicalDimensionsSchema`/`potato-doneness.ts`/`egg-doneness.ts` all
 *  already commit to for a real, cited-but-variable culinary figure. */
const RangeSchema = z
  .object({ min: z.number().positive(), max: z.number().positive() })
  .refine((r) => r.min <= r.max, { message: "min must be <= max" });

/**
 * Real, cited "how long is this safe/good for" storage guidance — closes
 * `ROADMAP.md`'s long-named "Storage/shelf-life common knowledge" gap
 * (2026-08-17): before this, nothing in this schema answered that question
 * anywhere, despite it being directly relevant to this repo's own stated
 * mission (someone relying on a machine to cook for them needs to know
 * whether an ingredient is still safe to use, not just how to cook it).
 * `infuse.json`'s own `safetyNote` already named the general shape of this
 * gap for garlic-in-oil specifically ("this engine has no concept of
 * elapsed time or storage conditions after a recipe finishes") — this
 * schema is the first real, structured (if still DECLARATION-only, see
 * below) answer to that.
 *
 * Every field is an independent optional range because not every storage
 * MODE applies to every ingredient/state — `doNotRefrigerate: true` (raw
 * potato: refrigeration converts starch to sugar, a real, cited, food-
 * QUALITY reason, not a food-SAFETY one) is itself a real, meaningful fact
 * distinct from simply omitting `refrigeratedDays`.
 *
 * Deliberately DECLARATION only, the same scoping precedent `AllergenSchema`
 * already established (2026-08-16) for the identical reason: this engine
 * has no concept of elapsed real-world time after a recipe finishes (no
 * purchase date, no "how long has this actually been in the fridge" —
 * the same honest limitation `egg.json`'s own `freshnessNote` already names
 * for fresh/aged tags). Nothing here is read by `engine.ts`/
 * `recipe-runner.ts` to reject a step or compute a real remaining shelf
 * life — it's real, cited reference knowledge, surfaced (not enforced) via
 * `recipe-explain.ts`'s `storageSummary` the same way `allergenSummary`
 * surfaces allergens without gating execution on them.
 */
export const StorageLifeSchema = z
  .object({
    /** How long this keeps under active refrigeration (~40°F/4°C or below). */
    refrigeratedDays: RangeSchema.optional(),
    /** How long this is safe to leave at room/ambient temperature before
     *  discarding — the USDA "Danger Zone (40°F-140°F)" 2-hour rule for a
     *  perishable food, when it applies. */
    roomTempHours: RangeSchema.optional(),
    /** How long this keeps in a cool, dry pantry/counter WITHOUT
     *  refrigeration — for shelf-stable raw goods (whole garlic bulb) or an
     *  ingredient that is actively better NOT refrigerated (raw potato). */
    pantryMonths: RangeSchema.optional(),
    /** True when refrigerating this specific state is itself the wrong
     *  advice (not just unnecessary) — a real, cited, QUALITY-not-safety
     *  fact for raw potato (starch converts to sugar below ~42°F/6°C,
     *  causing excess browning/acrylamide formation when later fried). */
    doNotRefrigerate: z.boolean().optional(),
    citation: CitationSchema,
    note: z.string().optional(),
  })
  .partial()
  .required({ citation: true });
export type StorageLife = z.infer<typeof StorageLifeSchema>;

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
 * The FDA's 9 major food allergens — FALCPA (2004: milk, egg, fish,
 * crustacean_shellfish, tree_nuts, peanuts, wheat, soybeans) + the FASTER
 * Act (2021, effective 2023-01-01: sesame, the 9th). Added 2026-08-16,
 * directly closing ROADMAP.md's own "Allergens" entry, named there as
 * "arguably the single highest-priority gap against this repo's own
 * stated mission" — a system meant to eventually cook unattended for
 * someone relying on it that can't say "this dish contains egg" is more
 * dangerous by omission than one that's merely incomplete on technique.
 *
 * A closed enum, not a free string: an allergen list only protects anyone
 * if it's checkable against a fixed, real regulatory vocabulary, not
 * whatever string an entity author happened to type. Deliberately the
 * FDA's "Big 9," not the EU's wider 14-item list (Regulation (EU)
 * 1169/2011 Annex II — adds celery, mustard, sulphites, lupin, molluscs,
 * and gluten-containing cereals generally rather than wheat specifically)
 * even though this repo's culinary content is Spanish/EU-leaning
 * throughout (tortilla de patatas, `es` names everywhere) — chosen for
 * consistency with the FDA/FALCPA sourcing this repo's CCP machinery
 * (`thermal.ts`, `data/ccps/*.json`) already cites, not because the FDA
 * list is more correct for this repo's actual dishes. The EU list is a
 * real, named, NOT-yet-modeled gap, not silently assumed covered.
 */
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
    taste: z.array(z.enum(["salty", "sweet", "sour", "bitter", "umami", "pungent", "neutral"])),
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
  /**
   * FDA "Big 9" major allergens this entity itself carries — see
   * `AllergenSchema`'s own doc comment for the citation and why this list,
   * not the EU's wider one. Defaults to an empty array, and an empty array
   * IS a real, meaningful, audited claim ("checked, carries none of the
   * Big 9"), not just an unfilled field — same discipline `HazardSchema`
   * already holds itself to for actions. Meaningful only for `kind:
   * "ingredient"` entities; `kind: "tool"` entities are left at the
   * default unaudited, since "does this knife carry milk protein" isn't a
   * real question this field is meant to answer (that's the separate,
   * NOT-yet-built cross-contamination/hygiene gap — see `ROADMAP.md`).
   * For a `structure.composite: true` entity, `scripts/validate.ts` hard-
   * fails if this array is missing an allergen any of its own
   * `structure.components` carries — a composite silently dropping an
   * allergen one of its real ingredients has is exactly the "more
   * dangerous by omission" failure this field exists to prevent.
   */
  allergens: z.array(AllergenSchema).default([]),
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
  /** How much of a PARENT's mass this entity typically represents, when
   *  this entity is itself a spawned byproduct — see `YieldFractionSchema`'s
   *  own doc comment for the full reasoning. Optional: most entities are
   *  never anyone's byproduct at all (not a gap, a real fact — e.g.
   *  `potato.json` itself has no parent), and even a real byproduct entity
   *  may not have this filled in yet if no citable figure has been found. */
  typicalYieldFractionOfParent: YieldFractionSchema.optional(),
  /**
   * Per-action HACCP tie-in, keyed by action id -> CriticalControlPointSchema
   * id (thermal.ts, data/ccps/*.json) — e.g. egg.json: { fry: "egg_cooking",
   * scramble: "egg_cooking", poach: "egg_cooking" }. Lives on the entity,
   * not the action, for the same reason byproductsByAction does: FRY itself
   * carries no food-safety risk (frying a potato has no Salmonella CCP) —
   * the risk is a fact about *what's* being fried, not the verb.
   */
  criticalControlPointsByAction: z.record(z.string(), z.string()).default({}),
  /**
   * States this entity is a raw-contamination-risk food-safety hazard IN,
   * e.g. `egg.json`: `["raw", "cracked"]`. Closes ROADMAP.md's long-open
   * "Cross-contamination / hygiene knowledge" gap (`HazardSchema` models
   * danger to the PERSON performing an action; nothing modeled danger to
   * the FOOD from a tool/surface reused on a ready-to-eat ingredient
   * without washing in between) — see `src/tool-hygiene.ts` for the
   * mechanism this field feeds.
   *
   * Deliberately a SEPARATE field from `capabilities`, not a boolean
   * capability flag there, even though `CapabilitiesSchema` is exactly
   * where a flag like this would normally live: the actual risk is
   * STATE-dependent (raw egg is a hazard, a boiled egg isn't), and
   * `CapabilitiesSchema` is `.catchall(z.boolean())` — structurally unable
   * to hold a list of states. `src/tool-hygiene.ts`'s
   * `isRawContaminationRisk` checks BOTH this list (is the instance's
   * CURRENT state one of the risky ones) AND a companion
   * `capabilities.isRawContaminationRisk: true` flag (is this entity even
   * the kind of thing that carries this risk at all) — the same
   * capability-plus-state-check split `invalidTransitions` above already
   * established for a different question, applied here.
   *
   * Optional and defaults to `[]`, so every entity file written before
   * this field existed is completely unaffected — only egg/egg_cracked/
   * egg_yolk/egg_white set it (added 2026-08-16); this is NOT a general
   * "every raw ingredient is a contamination risk" claim (raw potato/
   * garlic are not, in this vocabulary) — see ROADMAP.md's own
   * "explicitly out of scope" notes on that gap for why the wider claim
   * isn't attempted here.
   */
  rawContaminationRiskStates: z.array(z.string()).default([]),
  /**
   * Real, cited storage/shelf-life guidance — `StorageLifeSchema`'s own doc
   * comment has the full reasoning (added 2026-08-17, closing ROADMAP.md's
   * "Storage/shelf-life common knowledge" gap). Keyed by state id, the SAME
   * per-state-fact shape `criticalControlPointsByAction` already uses for
   * per-ACTION facts, because storage life is often genuinely different for
   * different states of the SAME entity, not one flat fact — e.g. a raw
   * shell egg keeps 3-5 weeks refrigerated; the same egg, once hard-boiled,
   * keeps only about a week. `scripts/validate.ts` hard-fails a key not in
   * `possibleStates`, the same standard `invalidTransitions`/
   * `rawContaminationRiskStates` above already hold themselves to. Optional
   * and defaults to `{}` — most entities (tools, and any ingredient not yet
   * audited for this) simply have no entries, not a claim that storage is
   * irrelevant for them.
   */
  storageLifeByState: z.record(z.string(), StorageLifeSchema).default({}),
  capabilities: CapabilitiesSchema.default({}),
  physicalDimensions: PhysicalDimensionsSchema.optional(),
  thermophysical: ThermophysicalPropertiesSchema.optional(),
  sensory: SensoryPropertiesSchema.optional(),
  cooklang: CooklangInteropSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Entity = z.infer<typeof EntitySchema>;

/**
 * True when `state` has EVERY OTHER state in `entity.possibleStates`
 * forbidden as a next transition, per `invalidTransitions` — i.e., no
 * transformation could ever legally move this instance anywhere else.
 * TICKET 5 of `PAPER_NOTES_2608.04768.md` (a "burned"/"overcooked" failure
 * state is only useful as a modeled concept if something can actually
 * recognize it's a dead end, per that ticket's own suggested `terminal:
 * true` marker) — deliberately COMPUTED from the already-authored
 * `invalidTransitions`/`possibleStates` data rather than a second,
 * separately-maintained flag on each entity: a hand-authored `terminal:
 * true` field could silently drift out of sync with the real transition
 * rules the moment either list is edited without remembering to update
 * the other, the exact "second, parallel source of truth" shape this
 * repo's own `execution-bounds.ts` (2026-08-16) was just built to avoid
 * for a different field — same reasoning, applied here.
 *
 * A state absent from `possibleStates` entirely is not this function's
 * concern (a typo'd/hypothetical state — `scripts/validate.ts`'s own
 * `invalidTransitions` cross-reference already catches that as a hard
 * fail); this only answers "if an instance were legitimately in this
 * state, could ANY transformation still apply to it."
 *
 * Deliberately does NOT mean "no action can be called on this instance at
 * all" — `engine.ts`'s `applyAction` only consults `invalidTransitions`
 * against the action's COMPUTED next state, so a tag-only action that
 * never changes `state` (`SALT` on an already-`"burned"` potato, say) is
 * still legal, the identical state-vs-tag distinction `engine.ts`'s own
 * doc comment already draws for every other state. `isTerminalState`
 * answers "can this instance's FORM/cooking state ever change again,"
 * not "is every action rejected."
 */
export function isTerminalState(entity: Entity, state: string): boolean {
  const forbidden = entity.invalidTransitions[state];
  if (!forbidden) return false;
  return entity.possibleStates.filter((s) => s !== state).every((s) => forbidden.includes(s));
}
