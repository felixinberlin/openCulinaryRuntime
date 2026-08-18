# `src/action.ts` — design rationale

Moved out of the source file 2026-08-18 — see `reference/ingredient.md`'s
own header for the convention this follows.

## File-level

"Actions know themselves" (`CONCEPT.md` §1/§7): an Action is knowledge,
not code, and it is defined once, independently of any recipe or
specific ingredient that later uses it (`ENGINE_INVARIANTS.md` #2
"Actions never know recipes"). One JSON file per verb under
`data/actions/*.json`.

This is distinct from the planned `recipe-step.ts` `MechanicalActionSchema`
(not implemented yet): that will describe one *instance* of a verb inside
a specific recipe's sequence (this target, these actual inputs/outputs).
`ActionSchema` here describes the verb itself, once, the same way
`EntitySchema` describes an ingredient/tool once.

## `ActionParameterSchema`

`CLAUDE_DEV_CTX.md`'s 4th pillar, "Culinary Details": quantitative/
qualitative details modifying a specific action. Two shapes:

- `allowedValues`: a closed set (CUT's "shape", BEAT's "intensity"). A
  value here can double as a state id when
  `outputs.transformedStateFromParameter` points at it.
- `numericRange`: a continuous physical quantity that a closed enum can't
  honestly represent — `CLAUDE_DEV_CTX.md`'s own "timing (seconds)" and
  "physics" examples (e.g. FRY's `durationSeconds`, POACH's `waterTempC`).
  Never state-determining — `engine.ts` only range-checks it, and it can
  feed a `CriticalControlPointSchema` check (`thermal.ts`) instead.

Exactly one of the two must be set.

## `ActionOutputsSchema`

Byproducts are deliberately NOT listed on the action. `CONCEPT.md` §9:
"Recipes don't exist, transformations exist" — but *which* byproducts a
transformation yields is a fact about the target ingredient (see
`producedByproducts` on `EntitySchema`), not about the verb. Peeling a
potato yields potato peel; peeling an apple yields apple peel — the verb
PEEL is identical in both cases. `spawnsTargetByproducts: true` tells the
engine to read the byproducts off the target entity at execution time.

- **`transformedStateFromParameter`**: for a parameterized action (CUT),
  the resulting state instead of a fixed `transformedState`: names one of
  this action's `parameters[].id`, and the target's new state becomes
  whatever value was passed for that parameter (e.g. shape: "diced" ->
  state "diced"). Mutually exclusive with `transformedState`.
- **`addsTag`**: a tag id (see `EntitySchema.possibleTags`) added to the
  target alongside its existing state, e.g. SALT adds "salted" without
  touching whatever state the target is already in — a boiled potato
  stays "boiled" and becomes "boiled" + tag "salted", since seasoning is
  orthogonal to cooking method/form, unlike boiled vs. fried.
- **`addsTagFromParameter`**: the parameter-driven sibling of `addsTag`,
  added 2026-08-17 alongside `requiredIngredientCapabilityFromParameter`
  — the other half of the SEASON generalization. Deliberately NOT a bare
  string naming a parameter id the way `transformedStateFromParameter`
  is (where the raw parameter VALUE becomes the state directly): seasoning's
  real tags ("salted"/"peppered"/"chili_seasoned"/"acidified") are not the
  same strings as the parameter values that select them ("salt"/"pepper"/
  "chili"/"acid"), and forcing them to match would mean renaming
  `EntitySchema.possibleTags` across every entity that already uses the
  real tag names — real churn for zero benefit. So this carries an
  explicit VALUE-TO-TAG map instead, the same shape as
  `requiredIngredientCapabilityFromParameter.capabilityByValue`, a
  deliberate, named adaptation of `transformedStateFromParameter`'s
  pattern rather than a literal reuse of its shape.
- **`destroysTarget`**: if true, the target instance is fully consumed
  and removed from the simulation inventory rather than kept around in
  `transformedState` — `CLAUDE_DEV_CTX.md`'s conservation-of-mass rule:
  "separate" destroys the parent egg; only the spawned children remain
  afterward. `transformedState` may still be set alongside this — it
  becomes the state recorded in the run log for the instance's last
  moment before removal, not a state anything will ever observe it in
  afterward.
- **`combinesInto`**: for an action that MERGES a second instance into
  the primary target (COMBINE) rather than transforming the target
  alone: the entity id of the brand-new resulting entity. Both the
  primary target and the secondary instance (see
  `ActionSchema.requiredSecondaryCapability`) are consumed; one new
  instance of this entity is spawned in their place — conceptually
  `destroysTarget` for TWO instances at once, not one. Mutually exclusive
  with `transformedState`/`transformedStateFromParameter`: there's no
  "resulting state" on an instance that's being replaced by a different
  entity entirely.

## `VerificationCriterionSchema`

How a machine — not a human reading a log line — would actually confirm
this action's effect happened, rather than just trusting that
preconditions passed and a timer elapsed. `WORLD_MODEL.md`'s proposed
generalization of the CCP pattern (a sensor-checkable threshold over a
continuous quantity) to every action, not just HACCP-relevant ones.
`engine.ts`'s `applyAction` is open-loop today — it asserts `outputs`
fired the instant preconditions pass, with no feedback step. This schema
does not close that loop (still no real sensing/perception layer,
`ENGINE_INVARIANTS.md` #11 unchanged) — it records, as structured domain
knowledge, WHAT a closed-loop system would need to check, and how
reliable that check actually is. `confidence: "low"` on an action is
itself useful information: it flags where this model's open-loop "trust
the timer" assumption is weakest, not a defect to silently improve away.

## `HazardSchema`

Physical/operational danger from PERFORMING this action — a knife blade,
a hot pan, boiling liquid splatter. Deliberately separate from
`CriticalControlPointSchema` (`thermal.ts`): a CCP is about the FOOD
being unsafe to eat if under-processed; a hazard here is about the ACT of
performing the step being dangerous to a person nearby, regardless of
whether the food itself turns out fine. Named in the "think like a
robot" discussion as a real, previously-unmodeled gap (this whole
codebase only ever modeled food safety, never operational safety) — this
is that gap closed as structured data, not a control system: it does not
itself keep anyone safe (no proximity sensing, no interlocks — that's
`ENGINE_INVARIANTS.md` #11's unbuilt control/perception layer), it
records what a real safety system protecting a person would need to know
about. `type` is an open string (not a fixed enum), matching
`CapabilitiesSchema`'s own "keep it open" precedent — new hazard
categories shouldn't need a schema change to express.

## `ActionSchema` fields

- **`requiredTools`**: id-based on purpose, for the case where one
  SPECIFIC tool is genuinely required (BAKE really does need an oven,
  not "any heat-capable enclosure") — but that made every tool
  requirement id-based even when the real physical constraint is a
  property several different tools can share (any vessel deep enough to
  submerge food, not literally the one entity named "pot"). See
  `requiredToolCapabilities` for that case.
- **`requiredToolCapabilities`**: the tool-side mirror of
  `requiredIngredientCapabilities`, added 2026-08-14 once a real case
  forced it: a robot with only a pan on hand (no pot) hard-failed BOIL,
  even for a hypothetical vessel that would genuinely work, because
  `requiredTools` can only ever check "is the tool literally named X,"
  never "is ANY available tool physically suited for this." An action
  lists a capability (e.g. "isDeepVessel"), and ANY tool asserting it
  true satisfies the check — not one hardcoded entity id. Purely
  additive; can be used alongside `requiredTools` on the same action
  (ANDed together). Checked for presence only — not consumed/decremented,
  no notion of a tool being "busy" elsewhere.
- **`requiredTargetCapability`**: generalizes `CONCEPT.md` §7's "valid
  targets: vegetables" into the capability model already used for
  entities, instead of hardcoding food categories into the verb. A
  missing or `false` capability both block the action; only an explicit
  `false` on the entity is a *permanent* denial (see `ingredient.ts`
  `CapabilitiesSchema`) that a future capability-inference pass must
  never override.
- **`requiredIngredientCapabilities`**: capabilities required of some
  OTHER ingredient present alongside the target — e.g. FRY needs a
  frying medium (oil, butter, ...) in addition to whatever's being
  fried. Capability-based like `requiredTargetCapability`, not id-based
  like `requiredTools`. Checked for presence only — proper ingredient
  consumption belongs to the full recipe-level inventory in `ROADMAP.md`
  Phase 4, not this per-action check.
- **`requiredIngredientCapabilityFromParameter`**: the parameter-driven
  sibling of `requiredIngredientCapabilities`, added 2026-08-17
  (`ROADMAP.md`'s "Generalizing SALT/PEPPER/CHILI into one
  parameter-driven SEASON verb" entry) for the real case that field
  alone cannot express: which capability is required depends on a
  PARAMETER VALUE chosen at call time. `season.json` is the concrete
  forcing case: `SEASON` with `seasoningType: "salt"` must require an
  available `isSaltySeasoning` ingredient specifically, not accept ANY
  seasoning capability — the wrong ingredient (chili flakes) satisfying
  a `seasoningType: "salt"` call would be a real, silent correctness bug
  this field exists to prevent. `engine.ts`'s `applyAction` looks up the
  capability for the ACTUAL value supplied and — the real, additional
  thing this field enables — records WHICH specific instance id satisfied
  it (`ExecutionResult.matchedIngredientInstanceId`).
- **`requiredSecondaryCapability`**: the capability a SECONDARY instance
  must assert `true` for a COMBINE-shaped action — distinct from
  `requiredIngredientCapabilities`, which only ever checks presence and
  never consumes anything. A secondary instance satisfying THIS
  capability is consumed exactly like the primary target when
  `outputs.combinesInto` is set — the caller must supply which specific
  instance via `RecipeStepSchema.secondaryInstanceId`
  (`recipe.ts`)/`applyAction`'s `secondaryInstance` argument
  (`engine.ts`).
- **`actionKind`**: is this verb a one-off operation (instantaneous) or
  one that evolves over real elapsed time and terminates on an
  observable condition (continuous)? Added 2026-08-16 in direct response
  to Song, Huang, Sun, Tian, Wang & Li, "Embedding Large Language Models
  into Flow Controls," arXiv:2608.04768 (2026) — see
  `PAPER_NOTES_2608.04768.md` TICKET 1, `REFERENCES.md`. That paper's
  generated control code renders the identical split independently, from
  the hardware side, as `Step(Pulse, Await(Enter))` vs.
  `Step(Continuous, Until(Condition)) with Timeout(...)`. Two independent
  derivations of the same distinction (this repo's own `place.ts`/
  `recipe-runner.ts` split arrived here first, unnamed, from the
  simulation side) is a real signal this is structure, not a local
  modeling artifact — see `LEARNINGS_ENGINE.md` 2026-08-16.

  TWO DISCRIMINATORS, WHICH CAN GENUINELY DISAGREE — every
  `data/actions/*.json` file's own `metadata.actionKindNote` states
  which was applied and why, per-action:
  - The paper's test: does the action have an observable sensory
    termination condition it evolves toward, or is it fire-and-forget?
  - This engine's test: does the action's effect actually depend on
    elapsed time or a `PlaceState` temperature in `applyAction`/
    `recipe-runner.ts` today?

  Where they disagree (e.g. BEAT: continuous by the paper's test — real
  stirring, a real visual until-uniform termination — but `applyAction`
  fires its effect the instant preconditions pass), this field is set by
  the PAPER's test — the physical truth — not the engine's current
  (admittedly narrower) behavior. That makes every such entry a real,
  honest, searchable inventory of exactly where this engine's one-shot
  `applyAction` model still departs from physical reality.

  Adjacent to but not the same question as `duration`: `variable` means
  "how long this takes is not fixed"; `continuous` means "the effect
  accumulates over elapsed time and terminates on a condition." `cut` is
  `duration: "variable"` (a potato's size affects how long cutting
  takes) AND `actionKind: "instantaneous"` (a bounded, discrete number of
  tool-strokes toward a FIXED target shape, not an open-ended do-until
  threshold).

  Optional, not defaulted — a missing value means "not yet audited,"
  same precedent `retrySafe` sets. A silent wrong default (e.g.
  defaulting to "instantaneous," matching `applyAction`'s current
  behavior) would be worse than an absent field: it would quietly assert
  every future verb is physically one-shot. Every action in this repo
  was individually classified as of 2026-08-16 (`LEARNINGS_ENGINE.md`
  same date) — a NEW action added later should not be assumed covered
  without checking.

  Does NOT change `applyAction`'s semantics at all — every action still
  executes as one instantaneous state transition regardless of this
  field's value; see `recipe-runner.ts`'s own top doc comment for the one
  place (`heat_place`, and the opt-in `params.placeId` check on
  `boil`/`simmer`/`fry`) where the engine's ACTUAL behavior already
  matches `continuous`.
- **`maxDurationSeconds`**: upper time bound for a `continuous` action —
  TICKET 2 of `PAPER_NOTES_2608.04768.md`, the direct follow-on to
  `actionKind`. The paper's own generated control code pairs every
  continuous step's sensory termination condition with a hard timeout
  "derived from empirical cooking experience" so an executor makes
  progress even if the sensory condition never fires — this field is
  that ceiling. `src/execution-bounds.ts`'s `executionBoundFor` is where
  it's actually consumed (standalone, `applyAction`-unchanged);
  `applyAction` itself does not read this field. Applicable only to
  `actionKind: "continuous"` actions (see the `.refine()` below). Every
  `data/actions/*.json` entry with `actionKind: "continuous"` sets a real
  value here as of 2026-08-16, each traced in its own
  `metadata.maxDurationSecondsNote` to either an already-cited source
  (commonly: this action's own `durationSeconds` parameter's
  `numericRange.max`, reused rather than duplicated) or an explicit
  house value with a stated rationale, per this ticket's own acceptance
  criteria: "do not copy the paper's numbers — they have no stated
  provenance."
- **`requiresActiveAttention`**: does a `continuous` action need a
  chef/actor's ongoing hands-on attention for its whole duration (ACTIVE
  — CARAMELIZE's periodic stirring, FRY's watching/flipping, EMULSIFY's
  continuous whisking), or does it run itself once started (PASSIVE —
  BOIL/SIMMER/BAKE/ROAST/MARINATE/REST, all real "walk away and come
  back" techniques)? The real question `ROADMAP.md`'s "Heat as a shared,
  time-varying property of a PLACE" entry raises directly: "a flat list
  requires a chef to stand idle... while water boils" — this field is
  what a scheduler (`dag-scheduler.ts`) needs to know that's actually
  FALSE for BOIL specifically, and actually TRUE for e.g. WHISK.
  Applicable only to `actionKind: "continuous"` actions — an
  `instantaneous` action is always, definitionally active (this
  vocabulary has no passive one-shot act; `dag-scheduler.ts` encodes
  this as a rule, not a per-action field). Optional, not defaulted, same
  "absent means not yet audited" precedent as `actionKind`. Every
  `continuous` action classified as of 2026-08-17 (`LEARNINGS_ENGINE.md`
  same date) — a real, reasoned technique judgment, not a citation-
  worthy fact. Does NOT change `applyAction`'s semantics — consumed only
  by `dag-scheduler.ts`'s `scheduleDag`.
- **`retrySafe`**: is blindly re-running this exact action (after an
  interruption) safe, or could it double an effect that already
  happened? Two genuinely different reasons an action can be `true`
  here: (1) idempotent by construction — `engine.ts` guards `addsTag`
  against duplicates (SALT/FLIP/FOLD/SHOCK/INFUSE/PASTEURIZE re-running
  is a silent no-op); (2) fails LOUDLY instead of silently repeating — a
  `destroysTarget` action's target is already gone from inventory on a
  second attempt (CRACK/SEPARATE/COMBINE), so a retry errors instead of
  duplicating. `false` (or unset) means neither protection applies —
  most concretely, PEEL: `spawnsTargetByproducts` fires again on an
  already-peeled target (no state check prevents re-running it),
  producing a byproduct instance that doesn't physically exist. Left
  `undefined`, not defaulted to `false`, where genuinely not yet
  audited — but every action in this repo has been.
