# `src/ingredient.ts` — design rationale

Moved out of the source file 2026-08-18 so the code itself only states
what each symbol does; this file holds why it's shaped that way, its
history, and the reasoning behind each design choice. Organized by
symbol, in the same order they appear in the source. See `REFERENCES.md`
for citation sourcing/confidence discipline and `LEARNINGS_ENGINE.md`/
`LEARNINGS_DOMAIN.md` for dated design history.

## File-level

Entity & Ingestion Models — Roadmap Phase 1 (see `ROADMAP.md`). This file
currently defines only `EntitySchema` and its supporting sub-schemas: the
"Knowledge" layer for a single canonical ingredient/tool (`CONCEPT.md`
§3, §6 — "Knowledge is immutable"). `RecipeIngredientSchema` (instance
portions inside a specific recipe) and `ParsedIngredientSchema` (staging
shape for raw scraper output) are separate, later concerns per
`CLAUDE_DEV_CTX.md` and are not needed to express a standalone entity
like salt — they're not implemented here yet.

## `CitationSchema`

Replaces burying "commonly cited, unverified" hedges inconsistently in
prose (found 2026-08-12: `egg.json`/`garlic.json` got that hedge,
`potato.json`/`salt.json`/`water.json`/`oil.json`/`egg_yolk.json`/
`egg_white.json`/`egg_cracked.json` didn't, for numbers with the exact
same epistemic status — inconsistently applied rigor, not consistently
absent rigor).

`confidence` is deliberately two-valued, not three: this repo has no live
retrieval capability, so nothing here has ever been checked against a
primary source directly — there is no honest "primary_source" tier to
offer. `standard_reference` means a specific, real, canonical work for
this class of fact is named (USDA FoodData Central, the CRC Handbook of
Chemistry and Physics, a named paper) — checkable by a reader, not
independently verified by this repo. `commonly_cited_unverified` means
recalled as generally taught/published but without confidence in which
specific canonical source it traces to. Neither is a substitute for
actual primary-source verification before any real-world/production use.

## `NumericRangeSchema`

The exact "range, not a false-precision point value" shape
`YieldFractionSchema`/`PhysicalDimensionsSchema`/`potato-doneness.ts`/
`egg-doneness.ts`/`StorageLifeSchema` all already commit to for a real,
cited-but-variable culinary figure. Exported (added 2026-08-17, alongside
`DomainFactSchema`) so a single numeric-range shape is shared rather than
each new schema quietly reinventing an identical `{min, max}` object with
its own `refine`.

## `DomainFactSchema`

`ROADMAP.md`'s "Structured `DomainFact`/`PhysicalProperty` records" gap,
closed 2026-08-17. The problem this exists to fix: this repo is full of
real, cited numeric facts recorded as free-text `metadata.notes` prose —
fine for a human reading the file, but `ENGINE_INVARIANTS.md` #10 ("LLMs
are never authoritative... it never directly asserts world state") means
nothing should ever need an LLM (or any other prose-parser) to EXTRACT a
safety-critical number from a paragraph at runtime. `domainFacts` fields
(added alongside, e.g., `CriticalControlPointSchema.domainFacts`) exist
so a robot's planner/verifier can read `ccp.domainFacts.someFactId.value`
directly — typed, validated by Zod, no parsing involved.

`egg_cooking.json`'s old `metadata.coagulationReferenceC` was this
repo's own "right instinct already present" (a semi-structured object of
numeric ranges) that this schema was named specifically to generalize —
see that file's own migration for the concrete before/after. Note what
this does NOT do: it doesn't replace `metadata.notes` (most prose in this
repo is genuinely prose — technique explanation, reasoning, caveats — not
a single extractable number, and forcing all of it into this shape would
be a worse fit, not a better one); it also isn't retrofitted onto
`YieldFractionSchema`/`StorageLifeSchema`, which predate it and already
work — this is the general-purpose FUTURE shape for a new one-off
numeric fact, not a mandate to migrate every existing range-shaped schema
onto it.

`verified` is a REAL, separate axis from `citation.confidence`, not a
duplicate of it: `confidence` says whether a canonical source is even
NAMED (`standard_reference` vs. `commonly_cited_unverified`); `verified`
says whether THIS SPECIFIC number was actually independently checked via
a live lookup this session, as opposed to recalled/inherited — the exact
distinction this repo has repeatedly made in prose already (e.g.
`egg_pasteurization_raw.json`'s `independentVerificationNote`, or any
`LEARNINGS_*.md` entry saying "verified via direct lookup, not recalled")
without ever having a queryable field for it before now. A
`standard_reference`-confidence fact can still be `verified: false` (a
real, named textbook is cited, but nobody in this session opened it to
confirm the number), and that's an honest, common combination, not a
contradiction.

`value` is a point OR a range — many real culinary/physical facts (e.g.
"egg white sets at 62-65°C") are honestly a range, not a single number;
forcing one shape would either misrepresent a real range as false
precision, or force a genuinely single-valued fact (a specific gram
weight) to carry a pointless `min === max` pair.

## `YieldFractionSchema`

`producedByproducts`/`byproductsByAction` (`EntitySchema`) record WHAT
spawns when this entity's parent is processed — never HOW MUCH,
`ROADMAP.md`'s own long-named "yield/waste factors" gap (e.g. how much of
a potato's mass a peel actually is). This schema, placed on the BYPRODUCT
entity itself (not the parent), closes that: a real, cited fraction of
the PARENT's original mass this specific byproduct typically represents.

A RANGE (`min`/`max`), not a single point value — real yield varies by
cultivar/size/peeling method/individual specimen, the same "don't assert
false precision" discipline `POTATO_BOIL_DONENESS`/`EGG_BOIL_DONENESS`
already hold themselves to for timing ranges. `ofParentEntityId` is
checked by `scripts/validate.ts` against the actual
`producedByproducts`/`byproductsByAction` relationship that spawns this
entity — a fraction relative to the wrong parent would be a real, silent
error, not a cosmetic one.

Deliberately data-only: nothing in `engine.ts`'s `applyAction` reads this
to actually compute a spawned instance's real mass (this repo has no
general quantity-tracking through the engine at all —
`RecipeInstanceSchema.quantity` is only ever declared on
`initialInventory`, never derived mid-recipe) — a real, named limit, not
silently implied to be more than it is.

## `DANGER_ZONE_CITATION` / `StorageLifeSchema`

Closes `ROADMAP.md`'s long-named "Storage/shelf-life common knowledge"
gap (2026-08-17): before this, nothing in this schema answered "is this
still safe to use" anywhere, despite it being directly relevant to this
repo's own stated mission (someone relying on a machine to cook for them
needs to know whether an ingredient is still safe to use, not just how to
cook it). `infuse.json`'s own `safetyNote` already named the general
shape of this gap for garlic-in-oil specifically ("this engine has no
concept of elapsed time or storage conditions after a recipe finishes").

Every field is an independent optional range because not every storage
MODE applies to every ingredient/state — `doNotRefrigerate: true` (raw
potato: refrigeration converts starch to sugar, a real, cited, food-
QUALITY reason, not a food-SAFETY one) is itself a real, meaningful fact
distinct from simply omitting `refrigeratedDays`.

Deliberately DECLARATION only, the same scoping precedent `AllergenSchema`
already established (2026-08-16) for the identical reason: this engine
has no concept of elapsed real-world time after a recipe finishes (no
purchase date, no "how long has this actually been in the fridge" — the
same honest limitation `egg.json`'s own `freshnessNote` already names for
fresh/aged tags). Nothing here is read by `engine.ts`/`recipe-runner.ts`
to reject a step or compute a real remaining shelf life — it's real,
cited reference knowledge, surfaced (not enforced) via
`recipe-explain.ts`'s `storageSummary` the same way `allergenSummary`
surfaces allergens without gating execution on them.

`roomTempHours` is the USDA/FDA "Danger Zone (40°F-140°F)" 2-hour rule
for a perishable food, when it applies — `DANGER_ZONE_CITATION` was
promoted 2026-08-18 from this field's own doc comment into a real,
exported `Citation` any entity populating `roomTempHours` can reference,
rather than every entity's own `storageLifeByState.citation`
re-describing the same general rule in its own words. Populated for real
2026-08-18 on `egg.json`/`egg_yolk.json`/`egg_white.json`/`milk.json` —
deliberately not audited exhaustively across every entity yet (a named,
bounded follow-up).

## `ALLERGEN_REGULATION_CITATION` / `AllergenSchema`

The FDA's 9 major food allergens — FALCPA (2004: milk, egg, fish,
crustacean_shellfish, tree_nuts, peanuts, wheat, soybeans) + the FASTER
Act (2021, effective 2023-01-01: sesame, the 9th). Added 2026-08-16,
directly closing `ROADMAP.md`'s own "Allergens" entry, named there as
"arguably the single highest-priority gap against this repo's own stated
mission" — a system meant to eventually cook unattended for someone
relying on it that can't say "this dish contains egg" is more dangerous
by omission than one that's merely incomplete on technique.

A closed enum, not a free string: an allergen list only protects anyone
if it's checkable against a fixed, real regulatory vocabulary, not
whatever string an entity author happened to type. Deliberately the
FDA's "Big 9," not the EU's wider 14-item list (Regulation (EU)
1169/2011 Annex II — adds celery, mustard, sulphites, lupin, molluscs,
and gluten-containing cereals generally rather than wheat specifically)
even though this repo's culinary content is Spanish/EU-leaning
throughout (tortilla de patatas, `es` names everywhere) — chosen for
consistency with the FDA/FALCPA sourcing this repo's CCP machinery
(`thermal.ts`, `data/ccps/*.json`) already cites, not because the FDA
list is more correct for this repo's actual dishes. The EU list is a
real, named, NOT-yet-modeled gap, not silently assumed covered.

`ALLERGEN_REGULATION_CITATION` was promoted 2026-08-18 from this doc
comment's own prose into a real, exported `Citation`, matching this
repo's usual pattern of a dedicated named citation constant
(`WILLIAMS_FORMULA_CITATION`, `DILUTION_CITATION`, ...) rather than
leaving a regulatory fact only inside a schema's own doc comment.

## `PhysicalDimensionsSchema`

Added 2026-08-15, directly answering "what diameter is a potato" the same
way `composition`/`thermophysical` already answer "what's the density/
conductivity": a structured, cited field instead of a number buried in
`metadata.notes` or a `description` string. `potato-doneness.ts`'s own
`whole` entry cited America's Test Kitchen's "2-2.5 inch diameter" figure
as prose ONLY before this field existed — this promotes that same figure
to a real field rather than inventing a new number, and that file now
points here instead of duplicating it.

Deliberately narrow: ONE typical-size fact (`typicalDiameterCm`), not a
general geometry schema — `src/cut-dimensions.ts` (same day) is the
sibling piece giving CUT's `shape` parameter its own real, cited
dimensions; the two are separate concerns (an entity's own natural size
vs. how a knife cut divides it) kept in separate files on purpose.

## `ThermophysicalPropertiesSchema.smokePointC`

The real safety ceiling for a heated cooking medium that doesn't boil at
any cooking-relevant temperature (`oil.json` — a real frying temperature,
e.g. 175°C, is nowhere near boiling, but IS meaningfully close to a real
safety limit) — added 2026-08-14 alongside `place.ts`'s
`advanceTempSeconds` generalization, which reads this field to reject an
unsafe target temperature outright rather than silently heating toward
it. Optional and meaningless for anything that doesn't have one
(`water.json` has no smoke point; `boilingPointC` is that entity's own
real ceiling instead) — not every thermal medium needs both fields, and
forcing one on an entity it doesn't apply to would misrepresent the
physics.

## `SensoryPropertiesSchema.taste` — `"pungent"`

Closed 2026-08-13 — flagged as a real gap in `garlic.json`'s own
`flavorChemistryNote` before it blocked anything: the five basic tastes
(salty/sweet/sour/bitter/umami) don't include the trigeminal/chemesthetic
"heat" sensation (capsaicin in chili, piperine in black pepper, allicin
in garlic) — a real, distinct sensory channel (pain/temperature nerve
fibers, not taste buds), not a degree of bitterness. Kept as one added
enum value rather than a separate schema field: still just "how does
this register on the tongue/in the mouth," the same question every other
taste value answers.

## `CapabilitiesSchema`

`.catchall(z.boolean())` deliberately keeps this map open: an
unrecognized capability key must still parse rather than fail
validation, per `CONCEPT.md` §15 "Unknown Knowledge" / the PDF §4
dynamic capability inference example (isPeelable/isChoppable/isFryable
inferred at runtime for an ingredient outside the canonical dictionary).

## `QuantitySchema`

`ROADMAP.md` Phase 1's `RecipeIngredientSchema`, closed 2026-08-13 (used
as `RecipeInstanceSchema.quantity`, `recipe.ts`, not on `EntitySchema`
itself: an amount is a fact about one recipe's USE of an ingredient, not
about the ingredient's own immutable knowledge — same reasoning
`EntitySchema` elsewhere applies to state/tags never living on the
entity).

Three genuinely different KINDS, not one fuzzy `amount` field, because
real recipes use different KINDS of quantity, not just different units of
the same kind — collapsing them into one number would misrepresent
whichever ones don't actually work that way:

- `"precise"`: a real measured amount + unit (5g, 200ml, 2 count). The
  ordinary case for most ingredients.
- `"imprecise"`: a real, commonly-used culinary quantity descriptor that
  is NOT reducible to a precise number by convention — "a pinch," "a
  dash," "to taste." Cooks genuinely do not measure these; forcing a fake
  gram value here would misrepresent how the quantity is actually used —
  the same "don't imply more precision than was verified" standard this
  repo already holds citations to. `approxRangeGrams` is optional,
  explicitly non-authoritative reference context for a human (or a
  future planner), never consumed by `engine.ts`. It's also inherently
  imprecise for a SECOND reason, not just "pinches aren't measured": how
  much salt a pinch actually is depends on crystal size/shape (fine table
  salt vs. flaky sea salt vs. coarse kosher packs very differently by
  volume) — a gap this repo doesn't model at all yet (no separate
  entities for salt by crystal size), so `approxRangeGrams` should be
  read as "commonly cited for ordinary table salt," not a figure this
  schema can actually guarantee.
- `"relative"`: a real, PRECISE, but ratio-based quantity — the amount is
  defined as a percentage of some OTHER ingredient's mass/count, not an
  absolute number. The canonical case: professional bread salt, dosed at
  ~1.8-2.2% of flour weight (a real "baker's percentage"), not "a pinch."
  Answers "compared to what?" directly for the cases where a quantity
  really is relative, instead of collapsing it into a precise-but-wrong
  absolute number the way a single `amount` field would.

Deliberately NOT wired into `engine.ts`/`recipe-runner.ts`'s execution
path: ingredients are still never consumed/decremented (`engine.ts`'s own
doc comment; `LEARNINGS_ENGINE.md` 2026-08-12) — this records how much of
an instance exists/was used, for a human or a future real inventory
system to read; it does not make `applyAction` quantity-aware. Also not
wired to any recipe-scaling engine: `CooklangInteropSchema.spiceLock`
already flags "this entity's amount doesn't scale linearly" at the
entity level, but no scaling-multiplier feature exists anywhere in this
repo to scale AGAINST — `spiceLock` stays exactly as informational as it
always was; this schema doesn't change that, it only answers "how much
right now," not "how much if this recipe were doubled."

## `EntitySchema` fields

- **`allergens`**: defaults to `[]`, and an empty array IS a real,
  meaningful, audited claim ("checked, carries none of the Big 9"), not
  just an unfilled field — same discipline `HazardSchema` already holds
  itself to for actions. Meaningful only for `kind: "ingredient"`
  entities; `kind: "tool"` entities are left at the default unaudited,
  since "does this knife carry milk protein" isn't a real question this
  field is meant to answer (that's the separate, NOT-yet-built cross-
  contamination/hygiene gap). For a `structure.composite: true` entity,
  `scripts/validate.ts` hard-fails if this array is missing an allergen
  any of its own `structure.components` carries.
- **`possibleTags`**: orthogonal to `possibleStates` — an instance can
  have any number of these at once, alongside its one state. Needed
  because not every property is exclusive: a potato can be "boiled"
  (state) AND "salted" (tag) simultaneously, unlike "boiled" vs. "fried"
  which really are exclusive.
- **`statePrerequisites`**: lives on the entity rather than on the
  generic verb because the precondition is a fact about *this*
  ingredient, not about the action in general. A value may be a single
  state OR an array of acceptable prior states (added 2026-08-13 —
  potato's `cut` needs to accept EITHER "washed" (skin-on wedges) OR
  "peeled" (conventional), not force one specific predecessor).
  `engine.ts` treats a single string as a one-element set. Each entry is
  checked against EITHER the target's current `state` OR its `tags`
  (added 2026-08-15) — "washed" is the real case that forced this: it
  names an orthogonal, persistent fact ("has this been washed"), not a
  mutually-exclusive form the way "peeled"/"sliced"/"fried" are.
  Modeling "washed" as a `state` (WASH's old `outputs.transformedState`)
  meant PEEL silently overwrote that fact away. WASH now sets a TAG
  instead, and this field's entries are satisfied by a matching tag
  exactly as by a matching state.
- **`invalidTransitions`**: `ROADMAP.md` Phase 4 — `CLAUDE_DEV_CTX.md`'s
  `OcrValidationEngine.INVALID_TRANSITIONS`, the repo's own named "single
  largest unbuilt piece of the original spec" until 2026-08-15. Keyed by
  the state an instance is CURRENTLY in -> the state ids it may never
  legally become FROM there. **A real mistake, corrected the same day,
  worth keeping documented rather than erased**: the first version
  followed `CLAUDE_DEV_CTX.md`'s own literal example uncritically —
  "cannot peel a potato that is already boiled" — and forbade every
  processed potato state from reverting to `"peeled"`. That claim is
  factually wrong: boil-in-jacket-then-peel is a real, common technique,
  caught on direct user correction. Fixed by removing every incorrect
  entry rather than softening it; see `potato.json`'s own
  `invalidTransitionsNote` and `LEARNINGS_PROCESS.md` 2026-08-15.
  Deliberately keyed PER ENTITY, not one shared global map — resolving
  `ROADMAP.md`'s own "unresolved, worth deciding before building either"
  open question. A global map is fragile in a way per-entity keying
  isn't: the FIRST (wrong) draft of potato's rule — `boiled -> peeled`
  forbidden — directly contradicted `egg.json`'s own verified
  `statePrerequisites.peel: "boiled"` under the identical bare state
  name. Checked in `engine.ts`'s `applyAction` against the action's
  actual COMPUTED next state, not the action id — so a parameter-driven
  output (e.g. `CUT`'s `shape`) is covered without per-action authoring,
  and an `addsTag`-only action (`SALT`) can never trip this check.
- **`byproductsByAction`**: per-action override of `producedByproducts`,
  for an entity with more than one `spawnsTargetByproducts` action that
  don't yield the same things — e.g. `egg.json`: PEEL (a boiled egg's
  shell) should spawn only `egg_shell`, while SEPARATE (cracking a raw
  egg) spawns `egg_shell` + `egg_yolk` + `egg_white`.
- **`criticalControlPointsByAction`**: lives on the entity, not the
  action, for the same reason `byproductsByAction` does: FRY itself
  carries no food-safety risk (frying a potato has no Salmonella CCP) —
  the risk is a fact about *what's* being fried, not the verb.
- **`rawContaminationRiskStates`**: closes `ROADMAP.md`'s long-open
  "Cross-contamination / hygiene knowledge" gap — see `src/tool-hygiene.ts`
  for the mechanism this field feeds. Deliberately a SEPARATE field from
  `capabilities`, not a boolean flag there: the actual risk is STATE-
  dependent (raw egg is a hazard, a boiled egg isn't), and
  `CapabilitiesSchema` is `.catchall(z.boolean())` — structurally unable
  to hold a list of states. `tool-hygiene.ts`'s `isRawContaminationRisk`
  checks BOTH this list AND a companion `capabilities.
  isRawContaminationRisk: true` flag. Only egg/egg_cracked/egg_yolk/
  egg_white set it (added 2026-08-16) — NOT a general "every raw
  ingredient is a contamination risk" claim.
- **`storageLifeByState`**: keyed by state id, the SAME per-state-fact
  shape `criticalControlPointsByAction` already uses, because storage
  life is often genuinely different for different states of the SAME
  entity — e.g. a raw shell egg keeps 3-5 weeks refrigerated; the same
  egg, once hard-boiled, keeps only about a week.
- **`domainFacts`**: the `EntitySchema` sibling of
  `CriticalControlPointSchema.domainFacts` (`thermal.ts`, closed
  2026-08-17), extended here 2026-08-17 once a SECOND real forcing case
  existed (`kosher_salt.json`'s/`flaky_salt.json`'s real, cited
  grams-per-teaspoon figures — see `LEARNINGS_ENGINE.md` 2026-08-17 for
  why this field was deliberately NOT added the first time, before a
  second real case existed).

## `isTerminalState`

`TICKET 5` of `PAPER_NOTES_2608.04768.md` (a "burned"/"overcooked"
failure state is only useful as a modeled concept if something can
actually recognize it's a dead end, per that ticket's own suggested
`terminal: true` marker) — deliberately COMPUTED from the already-
authored `invalidTransitions`/`possibleStates` data rather than a second,
separately-maintained flag on each entity: a hand-authored `terminal:
true` field could silently drift out of sync with the real transition
rules the moment either list is edited without remembering to update the
other, the exact "second, parallel source of truth" shape
`execution-bounds.ts` (2026-08-16) was just built to avoid for a
different field.

A state absent from `possibleStates` entirely is not this function's
concern (`scripts/validate.ts`'s own `invalidTransitions` cross-reference
already catches that as a hard fail). Deliberately does NOT mean "no
action can be called on this instance at all" — `engine.ts`'s
`applyAction` only consults `invalidTransitions` against the action's
COMPUTED next state, so a tag-only action that never changes `state`
(`SALT` on an already-`"burned"` potato) is still legal. `isTerminalState`
answers "can this instance's FORM/cooking state ever change again," not
"is every action rejected."
