# `src/recipe-runner.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Walks a RecipeScript's sequence against engine.ts's applyAction, the way
CLAUDE_DEV_CTX.md's reference OcrValidationEngine walks recipe.sequence —
but built on the capability/parameter/tag model this codebase actually
has, not that reference's INVALID_TRANSITIONS matrix (still Phase 4).

A step's failure does not halt the recipe: it's recorded in `errors` and
the run continues, mirroring the reference engine's "collect all errors,
then report" behavior rather than throwing on the first problem.

`RecipeStep.secondaryInstanceId` (COMBINE-shaped actions, engine.ts's
`secondaryInstance`) is resolved from inventory the same way
`targetInstanceId` is, and removed from inventory afterward if
`result.secondaryDestroyed` — the same treatment `destroyed` already gets
for the primary target.

### PLACE STEPS (FILL / PLACE_IN / HEAT_PLACE) — added 2026-08-16

Closing part of ROADMAP.md's "Heat as a shared, time-varying property of a
PLACE" entry: `place.ts` gave a tool instance a real, persistent temperature
back on 2026-08-14, but deliberately stopped short of `engine.ts`/this file
ever consuming it — that file's own doc comment named exactly two things as
still open: no `FILL`/`PLACE` verb existed anywhere in `data/actions/*.json`,
and two ingredients in the same pot got independent, unlinked `applyAction`
calls, never one shared temperature. Both close here, deliberately scoped
NARROWER than the full roadmap entry, same "narrow it and say so" pattern
`place.ts` itself used:

- Three new real verbs (`fill`, `place_in`, `heat_place`,
  `data/actions/*.json`) are recognized here and handled OUTSIDE
  `applyAction` entirely, not folded into its generic instantaneous
  state-transition model — `advanceTempSeconds` is fundamentally a
  continuous, elapsed-time process (this file's own `HEAT_PLACE` handler
  ticks it forward in fixed increments, polling `isAtTargetTemp`, the same
  idiom `scripts/boil-egg-as-a-robot.ts` already proved by hand), which
  `applyAction`'s "one precondition check, one immediate output" shape does
  not fit — see ROADMAP.md's adjacent, still-fully-open "transformations
  take time" entry for why that's a separate, larger gap this does NOT
  also close. `applyAction`'s own signature/behavior is completely
  unchanged by this addition.
- `places: Map<placeId, PlaceState>` and `placeContents: Map<placeId,
  instanceId[]>` are new, runner-local state, not a change to `Instance`
  (engine.ts) — an ingredient/tool's own state/tags still mean exactly
  what they meant before. This is genuinely the "co-located instances
  sharing state" concept the roadmap named as still-missing, scoped at the
  level it's actually true at: multiple food instances `PLACE_IN`'d into
  the same `placeId` see the literal same `PlaceState.currentTempC` after
  a `HEAT_PLACE` step, because there is exactly one `PlaceState` for that
  `placeId`, not one guess per `applyAction` call.
- Deliberately NOT claimed: the placed FOOD's own internal temperature is
  NOT computed or tracked by this — `places` models the MEDIUM (water/oil)
  a vessel holds, matching the user's own framing ("heat is a function
  inside a place where many ingredients can live") exactly; how fast heat
  penetrates the food itself is `heat-penetration.ts`'s separate, narrower
  (potato-only) concern, untouched by this change, not silently subsumed.
- Wired into the EXISTING precondition path only where a step opts in: a
  `boil`/`simmer` step's `params.placeId`, if set, requires that place to
  actually be at BOIL's boiling point / SIMMER's own declared `waterTempC`
  band (read off the action's own `parameters`, not a duplicated magic
  number) before `applyAction` runs at all — the concrete closure of
  `simmer.json`'s own `knownModelingGap` note ("doesn't actually know or
  enforce that the water is holding 85-96°C, only that the number a caller
  supplied falls in that band"). A step that doesn't set `params.placeId`
  is completely unaffected — every recipe authored before this change
  still runs identically; see `tests/recipe-runner.test.ts`.
- `FILL` does NOT remove the poured ingredient from `inventory` (unlike
  `destroysTarget` elsewhere) — water in a pot is still real, present
  water, not consumed/transformed the way SEPARATE consumes an egg; a
  step's existing `availableIngredientInstanceIds` presence check keeps
  working exactly as before, `places` is a strictly additional, parallel
  record of the SAME instance's real quantity/temperature, not a
  replacement for the existing (weaker) presence check.

### `FRY`/oil — CLOSED the same day, shortly after

`requiredTargetCapability`/`requiredToolCapabilities` on `fill`/`heat_place`/
`place_in` generalized from `isBoilingMedium`/`isDeepVessel` to a genuinely
medium-agnostic `isPourable`/`isVessel` (both water AND oil assert
`isPourable`; pot/pan/saucepan/wok all assert `isVessel` — see `oil.json`'s/
`pot.json`'s own notes on each), and `assertPlaceReady` gained a `fry` branch
reading `fry.json`'s own declared `oilTempC` numericRange minimum (same
"read the declaration, don't duplicate the number" discipline the `simmer`
branch already used) — `place.ts`'s `advanceTempSeconds` had supported oil
generically since 2026-08-14 (`fry-egg-as-a-robot.ts`); this was purely the
schema-level gate catching up. Proven via `scripts/shared-pan-heat-as-a-
robot.ts` (`npm run capability-test:shared-pan-heat`) and
`data/recipes/fried-egg-shared-pan.json`.

### `PAR_FRY` — CLOSED 2026-08-17

Extending the exact same branch rather than duplicating it: `assertPlaceReady`'s
condition is now `action.id === "fry" || action.id === "par_fry"`, and since
it already reads the range off whichever `Action` is actually passed in,
`par-fry.json`'s own genuinely different 145-165°C floor (vs. `fry.json`'s
120-200°C) is picked up correctly with zero further branching. Proven via
`scripts/par-fry-shared-pan-as-a-robot.ts` (`npm run
capability-test:par-fry-shared-pan`).

### Still NOT closed by this change

Named rather than implied covered: no `Instance.inProgressAction` or
`toolLockBehavior` (`WORLD_MODEL_OPTIMIZATION.md`'s design input,
ROADMAP.md 2026-08-15); no periodic/alternating-temperature recipe (the
Di Lorenzo & Di Maio cited "Periodic cooking of eggs" case) — `HEAT_PLACE`
only ever moves toward ONE target per step, alternating hot/cold would need
repeated `HEAT_PLACE` calls with different targets in sequence, which this
DOES technically now support mechanically but has not been proven against
that real recipe.

### `REMOVE` — added 2026-08-16

The fourth PLACE-shaped verb, closing ROADMAP.md's own named "no verb for
physically removing something from a shared vessel" gap — the exact case
`garlic-oil-potatoes.json`'s `removalNote` names by id. `handleRemove` is
`handlePlaceIn`'s direct inverse: takes `step.targetInstanceId` out of
`placeContents[placeId]`, requires the place to exist AND the instance to
actually currently be there (a real, catchable authoring mistake otherwise),
does not touch the instance's own state/tags. Proven via
`scripts/remove-from-place-as-a-robot.ts` (`npm run
capability-test:remove-from-place`). Deliberately closes only the REMOVAL
mechanism, not the adjacent, still-fully-open "elapsed idle time causes
doneness/burn consequences" half of the same ROADMAP entry — see
`remove.json`'s own `idleTimeScopeNote`.

### TOOL HYGIENE / CROSS-CONTAMINATION — added 2026-08-16

Closing ROADMAP.md's "Cross-contamination / hygiene knowledge" gap: a tool
touching a raw, contamination-risk ingredient (egg, `src/tool-hygiene.ts`'s
`isRawContaminationRisk`), then reused on other food with no intervening
wash, is a real food-safety risk `HazardSchema` (danger to the PERSON) and
`CriticalControlPointSchema` (thermal-only) both never modeled. Mirrors the
PLACE mechanism's own shape: a runner-local `toolContamination: Map<string,
ToolContaminationState>`, keyed by an opt-in `params.toolInstanceId` a step
may set (mirroring `placeId`'s pattern exactly) — a step that never sets it
is completely unaffected. `WASH_TOOL` (`data/actions/wash_tool.json`) is
special-cased like `fill`/`place_in`/`heat_place`/`remove`, dispatched
BEFORE the normal `instance` resolution (its real target is never an
`Instance`). Contamination itself is NOT a special-cased verb — it's a
pre-check + post-update wrapped around the *existing* `applyAction` call,
since it's a discrete fact toggled by an ordinary instantaneous action
(`CRACK`), unlike `FILL`/`HEAT_PLACE`'s genuinely different continuous
shape. An explicit user decision: advisory only (`warnings`/`log`), not a
hard reject — mirrors `egg_cooking.json`'s `advisoryOnly: true` posture, not
`egg_pasteurization_raw.json`'s unconditional one; see `tool-hygiene.ts`'s
own doc comment for the full reasoning and what's explicitly out of scope.
Proven via `scripts/tool-hygiene-as-a-robot.ts` (`npm run
capability-test:tool-hygiene`).

## `RecipeRunResult`

- `warnings`: Non-fatal HACCP notices collected across the whole run — see engine.ts's `ExecutionResult.warnings` / advisoryOnly CCPs.
- `places`: Every PLACE (pot/pan-as-filled) touched during this run, keyed by its recipe-local placeId — see this file's own top doc comment above. Empty when the recipe never uses FILL.
- `placeContents`: Which instance ids were PLACE_IN'd into each placeId, in placement order — the concrete, checkable record of "these instances share one place's heat," not just an assertion.
- `spawnedEntityIds`: Every spawned instance id's entity id, for the WHOLE run — including ones later destroyed (e.g. combined into a `tortilla_mixture`) and so no longer present in `finalInventory`. Added 2026-08-16 (TICKET 2, `PAPER_NOTES_2608.04768.md`) directly because `recipe-explain.ts`'s `explainRecipe` is deliberately execution-free and can only resolve a `targetInstanceId` against `recipe.initialInventory` on its own — a step targeting a SPAWNED instance (e.g. `PASTEURIZE` on `egg_yolk-3`, `SEPARATE`'s own output) was silently unresolvable there. A caller that already has a real `RecipeRunResult` (e.g. `scripts/validate-recipe.ts`, which runs both) can pass this map into `explainRecipe` to close that gap with REAL ground truth, not a second static re-derivation of `spawnCounter`'s naming scheme (which would be exactly the parallel-source-of-truth problem this file's own top doc comment already warns against elsewhere).
- `toolContamination`: Every tool instance touched via a step's opt-in `params.toolInstanceId` during this run, keyed by that toolInstanceId — see `src/tool-hygiene.ts`'s own top doc comment for the full mechanism. Empty when the recipe never sets `toolInstanceId` on any step.

## `handleFill`

FILL — pour a real, measured quantity of an ingredient (the instance named
by `step.targetInstanceId`) into a place, creating the place if
`params.placeId` hasn't been used yet. Thin wrapper over `place.ts`'s
`pourInto`, which already rejects pouring into an occupied place.

## `handlePlaceIn`

PLACE_IN — record that `step.targetInstanceId` is now physically located in
an already-`FILL`ed place. Does not itself transform the placed instance's
state (a later BOIL/SIMMER/FRY step against it still does that, exactly as
before this addition existed) — this only establishes co-location, the fact
`placeContents` and `HEAT_PLACE`'s shared-heat log line depend on.

## `handleRemove`

REMOVE — the inverse of PLACE_IN: take `step.targetInstanceId` out of a
place's shared contents, so it's no longer counted among the instances a
later HEAT_PLACE step's shared heat applies to. Same "bookkeeping only,
does not itself transform the instance's own state/tags" shape as
PLACE_IN — a later cooking step against the same (now un-placed) instance
still runs however it always would.

## `handleWashTool`

WASH_TOOL — resets a tool instance's `ToolContaminationState` back to
clean. See `data/actions/wash_tool.json`'s own notes for why this is a new
special-cased verb (mirroring `fill`/`place_in`/`heat_place`/`remove`)
rather than an extension of `wash.json`: its real target
(`toolContamination.get(toolInstanceId)`) is never an `Instance`.

## `FALLBACK_MAX_HEAT_TICKS`

Fallback tick-count bound, used ONLY if `heat_place.json` somehow lacks
`maxDurationSeconds` (action.ts, TICKET 2, PAPER_NOTES_2608.04768.md) —
every real `data/actions/heat_place.json` has one as of 2026-08-16
(1800s/30min, see its own `metadata.maxDurationSecondsNote`), so this is
defensive dead code in practice, kept as a safety net rather than assuming
the JSON will always carry the field. At the default 30s tick this is ~3.3
simulated hours, well past any real stovetop task — same defensive posture
as engine.ts's NaN guards elsewhere in this codebase.

## `handleHeatPlace`

HEAT_PLACE — advance a place's real, persistent temperature toward a
target over real (simulated) elapsed time, ticking `place.ts`'s
`advanceTempSeconds` forward and polling `isAtTargetTemp` exactly the way
`scripts/boil-egg-as-a-robot.ts` already proved by hand — the actual
mechanism a robot's own control loop needs, made a reusable, declarative
recipe.sequence step instead of one-off procedural TypeScript.

Its `maxElapsedSeconds` bound: TICKET 2 (execution-bounds.ts,
PAPER_NOTES_2608.04768.md) — the real upper bound HEAT_PLACE times out
against is `action.maxDurationSeconds` — a real, cited-or-house-valued
seconds figure on the loaded Action — not an arbitrary tick count. Falls
back to the old tick-count bound only if the action genuinely has no
`maxDurationSeconds` set (see `FALLBACK_MAX_HEAT_TICKS`'s own doc comment
above).

## `assertPlaceReady`

Opt-in cross-check for `boil`/`simmer` steps that set `params.placeId`: is
this place ACTUALLY at temperature, not just "did the caller pass a
plausible-looking waterTempC." Reads BOIL's real physical ceiling
(`thermophysical.boilingPointC`) and SIMMER's own declared `waterTempC`
numericRange (not a duplicated magic number) rather than inventing a third
source of truth for either band. A step that never sets `params.placeId`
never reaches this function at all.

Its `fry`/`par_fry` branch, 2026-08-16, is the oil/FRY generalization of the
BOIL check above: no single fixed "ready" temperature exists for oil the way
`boilingPointC` does for water (a real, distinct KIND of true — see
place.ts's own doc comment) — read the action's OWN declared `oilTempC`
numericRange's MINIMUM off the loaded action, same "don't duplicate the
number" discipline the SIMMER branch above already uses, rather than
hardcoding a threshold a second time. `action` here is whichever of
FRY/PAR_FRY is actually running, so this one branch already reads the right
range for either — no duplicated per-verb logic needed, since
`par_fry.json`'s own 145-165°C floor genuinely differs from `fry.json`'s
120-200°C one (a real, deliberate difference, not an oversight — PAR_FRY
closed 2026-08-17, extending 2026-08-16's FRY/oil wiring to the verb that
same day's own closing note named as still open).

## `runRecipe`

### DAG-execution ordering

ROADMAP.md, 2026-08-17, dag-scheduler.ts: steps are executed in a real,
dependency-respecting TOPOLOGICAL order, not raw `recipe.sequence` array
position — for every recipe written before `RecipeStep.id`/`dependsOn`
existed (all 22 real ones as of this change), `deriveDependsOn`'s
auto-sequential fallback reproduces the exact original array order, so this
is a behavior-PRESERVING change, not a reinterpretation — proven by `npm
run validate` re-simulating every real recipe identically. This does NOT
make execution concurrent: still one step at a time, still one mutation of
`inventory`/`places`/`toolContamination` per step, in a SAFE order —
`dag-scheduler.ts`'s own top doc comment explains why genuine concurrent
mutation of this shared state is deliberately NOT attempted here
(`ENGINE_INVARIANTS.md` #9). A recipe whose STEPS form a cycle (a real
authoring bug, not a legal dish) has no valid execution order at all —
recorded as a single error against the recipe's first step (there is no
more specific step to blame; the cycle is a property of the WHOLE graph)
and the run stops before touching inventory, rather than executing in an
arbitrary, undefined order.

### WASH_TOOL dispatch ordering

Dispatched before the `instance` bail-out, because (per the authoring
convention named in wash_tool.json's own notes) its real target is a
ToolContaminationState, keyed by params.toolInstanceId, never an inventory
Instance — targetInstanceId is set to the same toolInstanceId by
convention, but not resolved against `inventory` at all. Kept a separate
branch from the PLACE steps (not folded into that list) since, unlike
those, this touches neither `Instance` nor `places`.

### Unknown-id treatment for `availableIngredientInstanceIds`

Same "unknown id -> loud step error" treatment `targetInstanceId`/
`secondaryInstanceId` already get, applied here for the identical reason —
a typo'd/stale `availableIngredientInstanceIds` entry used to be silently
dropped from the Set instead, which could mask a real authoring mistake in
TWO ways: the step could still pass (if some OTHER listed instance happened
to satisfy `requiredIngredientCapabilities` anyway, hiding that the
intended one was never actually checked) or fail with a generic "no
qualifying ingredient on hand" error that never named the actual typo as
the cause. A stale reference to an instance id that was never
declared/spawned is always an authoring bug, never a legitimate state —
worth failing loudly every time, not only on the runs where it happens to
matter.

### Opt-in real-place readiness check (2026-08-16)

See `assertPlaceReady`'s own doc comment above. Only reached when the step
itself names a placeId; every step that doesn't is completely unaffected.

### Opt-in tool-hygiene pre-check (2026-08-16)

See tool-hygiene.ts's own doc comment. Advisory only (an explicit user
decision, not a hard reject like `egg_pasteurization_raw.json`'s): the step
still proceeds to `applyAction` either way. A step that never sets
`params.toolInstanceId` never reaches this, same opt-in gating as the
placeId check above.

### Post-update contamination check

Does contact with THIS target (its state BEFORE the action ran — what the
tool actually touched, not what it became) mark the named tool instance
contaminated? See tool-hygiene.ts's `isRawContaminationRisk`.

## Closed-loop replanning (below the `---` separator)

ROADMAP.md's "actual planner" gap 4, closed 2026-08-17 — a genuinely NEW,
additive execution mode. `runRecipe` above is completely UNCHANGED and
remains the offline-validation default ("log the failure, continue
anyway") every existing caller (scripts/validate.ts, every capability
test, `npm run recipe`) still gets, unmodified.

### `RecipeIntentRunResult`

- `replans`: One entry per goal that needed a replan after its step failed — empty when everything ran exactly as originally planned.
- `executedSequence`: The plan actually run, step by step — NOT necessarily `planIntent`'s own original `recipe.sequence` when a replan spliced in a different path partway through.

### `runRecipeFromIntent`

`ROADMAP.md`'s own named correction, acted on directly: `runRecipe`'s "log
the failure, continue to the next step anyway" is "correct for offline
validation, actively wrong if ever reused verbatim to drive a real robot
through a physical failure." This function is the honest alternative — a
real robot's execution loop, not `runRecipe` with a flag bolted on:
`src/planner.ts`'s `planIntent` produces the initial plan, and when a step
genuinely fails (a thrown precondition error — a missing tool, an
unsatisfied prerequisite, anything `applyAction` itself rejects), this
STOPS advancing that goal's original scripted steps and instead calls
`isGoalReachable` FRESH from the instance's REAL current state toward the
SAME original goal, splicing in whatever alternative path is found (or
reporting a real, final failure if none exists) — rather than blindly
running the rest of a now-stale plan against a world that has already
diverged from it.

Deliberately, honestly SCOPED NARROWER than "replan anything":

- **Single-instance goals only — any `combine` goal makes this function
  refuse up front, not silently mishandle it.** Splicing a replanned
  sub-path can change how many instances get SPAWNED partway through
  execution (`SpawnIdTracker`'s own doc comment); a LATER `COMBINE` step's
  `secondaryInstanceId` is a value baked in at PLAN time, and a mid-run
  change to total spawn count could silently invalidate that reference.
  Solving this generally needs the plan itself to re-resolve downstream
  instance references after a replan, not just re-run `isGoalReachable` —
  a real, larger piece of work, named here rather than attempted
  unsoundly.
- **At most ONE replan attempt per goal** — a goal whose replanned path
  ALSO fails is reported as a final, unrecoverable failure, not retried
  forever; this is the concrete guard against an infinite loop on a
  genuinely unreachable goal, not just an implied one.
- **No PLACE (`FILL`/`HEAT_PLACE`/`PLACE_IN`/`REMOVE`) or `WASH_TOOL`
  support** — this is a fresh, simpler interpreter built for this function
  specifically (not `runRecipe`'s own body, which would have needed the
  SAME splice-and-resume capability threaded through PLACE/tool-hygiene
  bookkeeping too — a real, separate, larger change deliberately not
  attempted here). A plan involving either is rejected the same way a
  `combine` goal is.

`executionAvailableTools` parameter: The REAL, currently-on-hand
tools/ingredient entity ids — defaults to `intent.availableTools`/every
`initialInventory` entity id (i.e. "the world matches what was planned
against," the common case). Passing a NARROWER set here is what actually
gives replanning something real to recover from: `intent.availableTools`
is what `planIntent` assumed when it built the initial plan; this is what's
ACTUALLY available the moment each step runs — the honest model of "a
robot discovers mid-run that a tool it expected is missing/broken"
`ROADMAP.md`'s own closed-loop-replanning entry describes. When omitted,
execution can never diverge from what was planned (this engine has no live
sensing — `ENGINE_INVARIANTS.md` #11 — so nothing else could cause a step
to fail that `planIntent`'s own precondition checks didn't already rule
out identically).
