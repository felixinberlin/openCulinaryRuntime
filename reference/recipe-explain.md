# `src/recipe-explain.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

A pre-flight, read-only report over a `RecipeScript` — computed WITHOUT
executing anything (no `applyAction` calls, no inventory mutation). Built
directly in response to "we'll eventually have a frontend recipe creator
that validates against this system's rules; what does that look like on
the command line first" (2026-08-15).

`recipe-runner.ts`'s `runRecipe` is still the ONE authoritative source of
truth for whether a recipe actually works — this module does not
duplicate or second-guess any of `engine.ts`'s `applyAction` checks
(required tools, capabilities, state prerequisites, HACCP CCP
thresholds). What it adds is upfront, human-readable framing `runRecipe`
doesn't produce on its own:

1. A whole-sequence summary of what's needed vs. declared (today, a
   missing tool only surfaces as a runtime rejection on the FIRST step
   that needs it — nothing lists everything a recipe will ever need
   before running it).
2. A sanity check between the *informational* doneness parameters
   (`yolkDoneness`, `pieceSize`) and the `durationSeconds` actually
   supplied — `applyAction` deliberately never reads these together (see
   `egg-doneness.ts`/`potato-doneness.ts`'s own doc comments: these
   parameters are human-readable hints, not enforced values), but a
   recipe-creation tool can still flag "you said soft but gave a
   hard-boiled duration" as advice, without engine.ts needing to enforce
   anything.
3. A heuristic wash-before-peel/cut prep advisory. Explicitly a
   HEURISTIC, not a new enforcement mechanism: `ROADMAP.md`'s "Cross-
   contamination / hygiene knowledge" gap (danger to the FOOD from
   equipment/surface reuse, not just to the person) is real, unbuilt, and
   needs a genuinely different mechanism than this — this check does not
   claim to close it, only to notice the one narrow, concrete case of
   "you're about to cut into a raw, unwashed vegetable."
4. A fry-timing-vs-geometry check (added 2026-08-15), composing
   `cut-dimensions.ts`'s real shape dimensions with `heat-penetration.ts`'s
   real heat-conduction physics — closes the exact gap
   `crispy_french_fries.json`'s own `shapeConnectionNote` named unprompted
   before either module existed. Deliberately RANGE-based (fastest vs.
   slowest real case), not a false-precision single verdict — see that
   check's own notes below for why (no recipe today states how much oil
   is used).

## `ToolReport`

- `needed`: Exact `requiredTools` ids referenced anywhere in the sequence.
- `missing`: `needed` ids not present in `recipe.availableTools`.
- `missingCapabilities`: `requiredToolCapabilities` referenced anywhere in the sequence that `recipe.availableTools` cannot satisfy — with the actual candidate tool ids (from the full entity catalog) that WOULD satisfy each one, so the report can say what to add, not just that something's missing.

## `IngredientReport`

- `needed`: `requiredIngredientCapabilities` referenced anywhere in the sequence.
- `missing`: Capabilities no step's `availableIngredientInstanceIds` can satisfy, with candidate entity ids that would.

## `StepActionKind`

One `recipe.sequence` step's `actionKind` (action.ts, 2026-08-16,
PAPER_NOTES_2608.04768.md TICKET 1), surfaced here for visibility only —
per that ticket's own scoping, this does NOT change `runRecipe`'s
dispatch behavior at all; `null` means the referenced action predates
auditing and hasn't been classified (see `validate.ts`'s matching NOTE
check for the same "unaudited, not silently defaulted" signal).

## `RecipeExplanation`

- `timingAdvisories`/`prepAdvisories`: Advisory strings — never errors, only guidance.
- `actionKinds`: `actionKind` for every step, in sequence order — see `StepActionKind`'s own notes above for why this is display-only.
- `executionBounds`: `execution-bounds.ts`'s dual sensory-timeout/safety-floor bound for every step where one actually applies (TICKET 2, `PAPER_NOTES_2608.04768.md`) — filtered, unlike `actionKinds` above, to only the steps `executionBoundFor` returns something for (instantaneous actions and continuous actions with no `maxDurationSeconds` are skipped rather than listed as "none", to avoid drowning the real entries in noise). Read-only, pre-flight display only — does NOT change `runRecipe`'s dispatch behavior, same scoping `actionKinds` itself uses.
- `allergenSummary`: Every allergen (`ingredient.ts`'s `AllergenSchema`, the FDA "Big 9") any `initialInventory` entity carries, deduplicated and sorted — `ROADMAP.md`'s "Allergens" gap, named there as "arguably the single highest-priority gap against this repo's own stated mission": a system meant to eventually cook unattended for someone relying on it should be able to say "this dish contains egg" without a human re-deriving it by reading every entity file by hand. Computed from `recipe.initialInventory` alone — sufficient despite this module's execution-free design: `scripts/validate.ts` hard-fails any composite entity (a `COMBINE` result, e.g. `tortilla_mixture`) whose own `allergens` isn't already a superset of its `structure.components`' allergens, so nothing spawned mid-recipe can introduce an allergen absent from the starting ingredients — the union over `initialInventory` is already complete, not an approximation of it.
- `storageSummary`: Real, cited storage/shelf-life guidance (`ingredient.ts`'s `StorageLifeSchema`, `ROADMAP.md`'s "Storage/shelf-life common knowledge" gap, closed 2026-08-17) for every `initialInventory` item whose STARTING state has a `storageLifeByState` entry on its entity — e.g. a recipe starting with `egg-1` in state `"raw"` gets that entity's `storageLifeByState.raw` if one exists. Deliberately keyed to the item's AUTHORED starting state, not every state that entity happens to have guidance for — a recipe starting with an already-`"boiled"` egg should see the boiled figure, not the raw one, the same "describe what was actually declared" discipline `allergenSummary` above already follows for `initialInventory`. Same DECLARATION-only scope as `allergenSummary`: this repo has no elapsed-real-world-time concept (`StorageLifeSchema`'s own doc comment), so this can say WHAT the guidance is, never whether THIS specific instance is still within it.

## `explainRecipe`

`ccps` parameter: Optional, defaulted — added 2026-08-16 (TICKET 2,
PAPER_NOTES_2608.04768.md) alongside `executionBounds`. Every pre-existing
call site (this file's own 20+ synthetic-fixture tests included) is
unaffected: omitting `ccps` just means `executionBoundFor` never finds a
CCP, so `executionBounds` comes back empty rather than wrong — the same
"additive, non-breaking" convention every other optional parameter in
this codebase follows.

`spawnedEntityIds` parameter: Optional, defaulted, added alongside `ccps`
above — a step targeting a SPAWNED instance id (e.g. PASTEURIZE on
egg_yolk-3, SEPARATE's own output) can't be resolved against
`recipe.initialInventory` alone; a caller that already ran `runRecipe`
(e.g. `scripts/validate-recipe.ts`) can pass its real
`RecipeRunResult.spawnedEntityIds` here to close that gap with REAL
ground truth. Omitting it just means those steps are silently skipped in
`executionBounds` below, same as before this parameter existed — not
wrong, just less complete.

### Terminal starting-state check (TICKET 5, PAPER_NOTES_2608.04768.md)

"so recipe-explain.ts can say 'this state is unrecoverable' rather than
silently listing zero options." Deliberately checked against
`initialInventory` only, not every mid-recipe state (this file is
execution-free — see the file-level notes above — it has no way to know
an instance's state partway through the sequence without actually running
it). `isTerminalState` is computed from `invalidTransitions`/
`possibleStates` directly (ingredient.ts), not a second source of truth.

### `washedInstanceIds`

Tracks, per recipe-local instance id, whether a WASH step has been seen
for it yet — for the heuristic below. Keyed on `targetInstanceId`, the
same id space `recipe-runner.ts`'s inventory uses.

### `shapeByInstanceId`

Tracks, per recipe-local instance id, the most recent CUT shape applied
to it — for the fry-timing-vs-geometry check below. A COMBINE step spawns
a genuinely new instance id (e.g. tortilla_mixture-4) with no entry here,
which is correct: that instance isn't "sliced potato" in the geometric
sense anymore, so the check below naturally skips it rather than needing
special-case handling.

### The wash-before-peel/cut heuristic

Capability-based (`isWashable`), not state/tag-based — "washed" is a TAG
(2026-08-15: see wash.json/ingredient.ts's statePrerequisites doc
comment), so checking possibleTags would work too, but `isWashable` is
the actual marker `wash.json`'s own `requiredTargetCapability` checks, and
doesn't depend on this heuristic staying in sync with exactly how
"washability" happens to be represented elsewhere.

### The timing-vs-doneness advisory

Only meaningful when this step actually supplied both a duration AND one
of the two known doneness-shaped parameters this repo has real cited
tables for. Deliberately hardcoded to these exact parameter ids (not a
generic mechanism) — same convention egg-doneness.ts/potato-doneness.ts
themselves use; there is no third table to generalize toward yet.

### The fry-timing-vs-geometry check

Composes `cut-dimensions.ts`'s real shape dimensions with
`heat-penetration.ts`'s real heat-conduction physics — closes the exact
gap `crispy_french_fries.json`'s own `shapeConnectionNote` named before
either module existed ("nothing connects CUT's shape state to
FRY's/PAR_FRY's durationSeconds"). Deliberately RANGE-based, not a single
verdict: no recipe today states how much oil is used, so whether a slice
is heated from one face (shallow oil) or two (submerged) is genuinely
unknown most of the time — computed for BOTH and reported as the
resulting time window, not guessed as one default. `fry.json`'s own
`topCookingMethod` ("basted"/"covered"/"untouched" — all imply the top
face isn't submerged) is a real signal, used to narrow the window to one
face when a recipe actually sets it. Scoped to only entities with
COMPLETE thermophysical data (today: potato only) — capability-based on
data completeness via the try/catch below, not hardcoded to one entity
id, so this applies automatically the day a second entity gains full
thermophysical data. The doneness TARGET temperature is potato-specific
by name (`POTATO_FORK_TENDER_CENTER_TEMP_C`) — the one piece that doesn't
yet generalize, gated explicitly rather than silently assumed.

The catch block: `thermalDiffusivityM2PerS` throws for incomplete
thermophysical data — not applicable, skip silently, same "informational,
not forced" convention as the rest of this module.
`secondsForCenterToReachTempC` also throws when `oilTempC` itself can
never reach the target (e.g. at or below it) — that ONE specific case is
worth surfacing, not swallowing.

### The ingredient-capability check near the end

Ingredient capabilities are checked per-step in the real engine
(`availableIngredientInstanceIds` is per-step, not recipe-wide like
`availableTools`) — but for a whole-sequence PRE-FLIGHT summary, "is this
capability satisfiable by ANYTHING in the recipe's initial inventory at
all" is the useful question; `runRecipe`'s own per-step check remains the
authoritative one.
