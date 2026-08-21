# `src/planner.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The actual planner `ROADMAP.md` names as the still-open half of Phase
4.5, closed 2026-08-17. `src/reachability.ts`'s `isGoalReachable`
(2026-08-16) already does real shortest-path search for ONE instance's
own discrete state graph and returns a usable path, not just a yes/no —
this module builds everything that was still missing around it:

1. `stepsToRecipeSteps`/`assembleRecipeScript` — turn a found path (or
   several) into a real, runnable `RecipeScript`, not just a list of
   verbs a human has to hand-convert (as every prior capability-test
   script that executed a `ReachabilityStep[]` had to do manually).
2. `RecipeIntentSchema` (`recipe.ts`) + `planIntent` — a real
   goals/constraints authoring format, replacing "the caller must already
   know the exact target `GoalPredicate`."
3. `planLowestCost` — a real, if simple, cost-aware search (fewest steps,
   then fewest/least-severe hazards) built on the SAME edge logic
   `isGoalReachable` uses (`enumerateEdges`, extracted from it the same
   day, behavior-preserving — see that file's own doc comment).
4. `planCombine`/`planSecondaryRole` — the bounded, honest answer to
   "single-instance scope... a `requiredSecondaryCapability` edge is
   recorded as blocked, not explored." NOT a general multi-instance world
   model (that's still real, larger, unbuilt work — see `planCombine`'s
   own notes below for exactly what's covered and what isn't).

`engine.ts`'s `applyAction` and `reachability.ts`'s `isGoalReachable` are
BOTH completely unchanged by this file (aside from the pure,
behavior-preserving `enumerateEdges` extraction) — this module only ever
produces a `RecipeScript` for something else to run; it never executes
anything itself.

## `SpawnIdTracker`

Mirrors `recipe-runner.ts`'s own real spawn-id scheme EXACTLY: a single
counter, GLOBAL across every entity type, incremented once per spawned
instance in the order they're actually spawned (see `recipe-runner.ts`'s
`spawnCounter` — confirmed by reading it, not assumed, and cross-checked
against a real recipe: `tortilla-de-patatas.json`'s "egg_cracked-3"/
"tortilla_mixture-4" are exactly what this counter produces for that step
order — PEEL's `potato_peel` spawn takes 1, CRACK's `egg_shell` then
`egg_cracked` byproducts take 2 and 3 in `byproductsByAction.crack`'s own
declared order, COMBINE's `tortilla_mixture` takes 4).

This is NOT the "second, parallel source of truth" risk
`LEARNINGS_ENGINE.md` 2026-08-16 named for `explainRecipe`'s earlier
spawn-id gap — that case was a DIFFERENT module re-analyzing an
ALREADY-RUN recipe's real spawn ids after the fact (a real drift risk).
This tracker is the planner ACTING AS the recipe's author, choosing the
step order itself and predicting what that choice will produce when
actually run — exactly what a human recipe author already does by
hand-typing "egg_cracked-3" into a `RecipeScript` file; this class only
automates that same, single, real convention.

## `resolveDefaultParamValue`

A required-but-not-state-determining parameter (e.g. `pasteurize.json`'s
`waterTempC`/`durationSeconds`) has no value the search itself ever
chooses — `isGoalReachable`/`enumerateEdges` only ever select a value for
the ONE parameter that's `transformedStateFromParameter`. This picks a
schema-VALID placeholder (the first `allowedValues` entry, or the numeric
midpoint of `numericRange`) so the generated `RecipeScript` is genuinely
runnable — explicitly NOT a cited or technique-verified choice, just "a
value within the declared valid range," the same honesty limit every
other unenforced categorical parameter in this repo already carries. A
real caller should override it via `paramOverrides` when the actual value
matters.

## `StepsToRecipeStepsOptions`

- `availableIngredientInstances`: Real ingredient instances on hand — the SAME pool a `RecipeScript`'s own `initialInventory` provides; each `requiredIngredientCapabilities` entry resolves to the FIRST instance (array order — deterministic) whose entity asserts that capability, mirroring `engine.ts`'s own membership-test semantics (any qualifying instance, not a specific one).
- `paramOverrides`: Per-step-index parameter overrides, keyed by the index into `steps` — the escape hatch for a required-but-not-state-determining param `resolveDefaultParamValue` would otherwise have to guess at.

## `stepsToRecipeSteps`

The "no available ingredient instance satisfies" error path: the search
that produced this path already verified some ENTITY satisfying this
capability was in the availableIngredients SET it was given — reaching
this branch means this instance pool disagrees with that set, a real
caller-error worth failing loudly on rather than silently emitting an
unrunnable step.

## `defaultEdgeCost`

A real, simple, DOCUMENTED-not-hidden cost heuristic — not a
citation-backed figure (this is scheduling preference, not a
domain-science claim). Every step costs 1 (so, absent any hazard, the
lowest-cost path IS the shortest path — identical to `isGoalReachable`'s
own BFS result for the common case), plus a penalty for that step's own
declared `hazards` severity, so that among equally-short paths the search
prefers the one that asks a robot to do the least risky thing.
`low`/`medium`/`high` map to fixed penalties chosen for a sane ordering
(never let 3 low-severity hazards outweigh 1 high-severity one) — a
reasonable default, not a tuned/validated constant.

## `CostAwareQuery`

- `edgeCost`: Defaults to `defaultEdgeCost` above.

## `planLowestCost`

Dijkstra over the identical edge set `isGoalReachable` explores (via the
shared `enumerateEdges`), with a real, non-uniform cost per edge — the
genuine cost-aware sibling `isGoalReachable`'s own doc comment didn't
attempt (plain BFS = uniform cost = fewest steps only). Same determinism
discipline: a binary-heap-free O(V*E) relaxation loop, visiting
`entity.allowedTransformations`/`allowedValues` in their own declared
array order at every tie, so the result doesn't depend on `Map`/`Set`
iteration order — see `tests/planner.test.ts` for a direct determinism
check, not an assumption.

The relaxation loop: a simple deterministic relaxation — repeatedly scan
every SETTLED node's edges and relax; a real priority queue would be
asymptotically faster, but every entity's own reachable state graph in
this repo is small (well under 100 nodes) — correctness and determinism
matter far more here than micro-optimizing a graph this size.

## Multi-instance / COMBINE planning (gap 1) — bounded, not general

## `planSecondaryRole`

Finds a way to make `startInstanceId` (or something spawned FROM it)
satisfy a `requiredSecondaryCapability` — the bounded, honest answer to
COMBINE's own real engine behavior.

**Correction, 2026-08-19 (peer-session bug audit, `LEARNINGS_ENGINE.md`
same date):** this section used to claim `engine.ts`'s `applyAction`
checks `requiredSecondaryCapability` ONLY against the secondary
instance's ENTITY-level `capabilities` flag, "never inspects the
secondary instance's current STATE at all," and that `egg_cracked.json`
"has no `combine` key in its own `statePrerequisites`" — **that claim was
already stale when this file was written**: `checkStatePrerequisite`
(`engine.ts`) has taken a `role: "target" | "secondary"` parameter and
been called on the secondary instance too since 2026-08-17 (`egg_cracked.
json`'s own `combineNote`, added the same day, documents the fix
directly), and `egg_cracked.json` has carried `statePrerequisites.combine:
["beaten", "well_beaten"]` since that same change. `planSecondaryRole`
itself hadn't been updated to match: it only ever planned toward that
required state when a caller explicitly supplied `desiredState` — the
omitted case (`InstanceGoalSchema.combine.secondaryDesiredState` is
schema-optional) produced a `found: true` result missing the real BEAT
step, which then failed at the actual COMBINE step against
`recipe-runner.ts`'s `runRecipe`. Fixed by looking up
`entity.statePrerequisites[combineActionId]` on WHICHEVER entity ends up
filling the secondary role (the same lookup key
`checkStatePrerequisite` uses) and treating its first allowed value as
the REQUIRED planning target whenever no compatible `desiredState` was
given — `combineActionId` is now a required parameter of this function
for exactly that lookup. An explicit `desiredState` that would NOT itself
satisfy the required state is now rejected outright (`found: false`),
rather than trusted and silently planned into a broken recipe. See
`tests/planner.test.ts`'s two new cases ("omitted secondaryDesiredState
still plans toward..."/"an explicit desiredState incompatible with...")
and `scripts/planner-as-a-robot.ts`'s "§6" section (`npm run
capability-test:planner`) for the real-data proof (`egg_cracked`'s BEAT
step, run against the real engine, zero errors).

The SAME class of gap `LEARNINGS_ENGINE.md` 2026-08-12 named for
`requiredIngredientCapabilities` ("checks presence via the ingredient's
ENTITY definition only — never the ingredient instance's current state")
still applies to `requiredSecondaryCapability` ITSELF (not the state
prerequisite this correction is about) — `applyAction` really does check
`secondaryEntity.capabilities[cap] === true` only, with no notion of
"this specific instance currently holds that capability" beyond the
entity definition. That part of the original claim was accurate; only
the state-blindness half was stale.

Two real cases, both handled:

1. `startEntity` ALREADY satisfies `requiredCapability` (e.g. an
   already-cracked egg) — used as-is, zero steps, in WHATEVER state it
   currently holds (matching the engine's own real, state-blind check).
2. `startEntity` does NOT satisfy it, but a ONE-HOP spawn does (the real,
   concrete case this repo actually has: raw `egg` doesn't carry
   `isCombinableAddition`, `CRACK`'s own `egg_cracked` byproduct does).
   Searches `startEntity.allowedTransformations` for a
   `spawnsTargetByproducts` action whose byproduct list
   (`byproductsByAction[actionId]` or the flat `producedByproducts`
   fallback, the SAME resolution order `engine.ts` itself uses) contains
   a qualifying entity, at bounded depth (2 hops) — a real, small search,
   not unbounded recursion, since this repo's actual spawn graphs are
   shallow (egg -> egg_cracked is the only real case today).

`desiredState`/`desiredTags`, if given, ask for something MORE than
`engine.ts` would strictly require — a specific, REALISTIC recipe (a
genuinely salted egg, or the "well_beaten" of two engine-legal options
combine.json accepts) by reusing `isGoalReachable` on whichever entity
ends up holding the capability. **They are no longer the only source of
a planning target, since the 2026-08-19 fix above**: whatever STATE
`combineActionId` itself requires of the secondary role
(`entity.statePrerequisites[combineActionId]`, mirroring `planCombine`'s
own identical lookup for the primary) is now planned toward
UNCONDITIONALLY, using its first allowed value as the default target
when no compatible `desiredState` was explicitly given. Omitting
`desiredState`/`desiredTags` now produces the bare-minimum plan that is
STILL fully engine-legal — never the "possibly unrealistic but at least
runnable" plan this paragraph originally described, and never (the actual
bug that was here) a plan that fails at the real COMBINE step. An
explicit `desiredState` that would conflict with the action's own real
requirement is rejected rather than trusted.

The one-hop spawn search loop, and its state-prerequisite prefix: the
spawning action itself may have its own state prerequisite — reuse
`isGoalReachable` to get there first, exactly like any other
single-instance step (CRACK has none for egg.json today, but this stays
correct even if that ever changes).

Predicting the spawned instance's id/state mirrors `engine.ts`'s own
spawn logic exactly (`SpawnIdTracker`'s own notes above, and
`engine.ts`'s `applyAction`: `byproductEntity.possibleStates[0]` is the
spawned instance's real starting state; inherited tags are the parent's
tags at spawn time, filtered by the byproduct's own `possibleTags`).

## `planCombine`

Assembles a full COMBINE plan: the primary instance's own path to
whatever state `combineActionId` requires (via `isGoalReachable`,
unchanged), the secondary instance's own path (via `planSecondaryRole`
above), and the `COMBINE` step itself, with a correctly-predicted
`resultInstanceId` for `combinesInto`'s spawned entity. Deliberately does
NOT resolve which `combineActionId` to use from a target entity id alone
— `potato_onion_mixture.json`'s own `capabilityAmbiguityNote` already
names a real ambiguity there (`combine`/`combine_con_cebolla` share
`isCombinableBase`); this function takes the action id as a REQUIRED
input, resolved by the caller (`planIntent`, from the goal's own declared
`combine.actionId`), never guessed.

The `requiredTools` check near the end: COMBINE's own `requiredTools` is
checked explicitly here since COMBINE itself is the terminal step, never
explored as an intermediate EDGE by `isGoalReachable`'s primary-path
search above (that search only ever reaches the state COMBINE requires —
it never tries firing COMBINE itself, which needs a secondary instance it
has no model of).

**Bug fix, 2026-08-19 (same peer-session audit as `planSecondaryRole`
above):** both this function's own `primarySteps` generation and
`planSecondaryRole`'s internal `stepsToRecipeSteps` calls used to build
their `availableIngredientInstances` argument by fabricating one
`PlannerIngredientInstance` per ENTITY id in `availableIngredients` —
`[...availableIngredients].map((id) => ({ id, entityId: id }))` — i.e.
using the entity id (`"oil"`) AS the instance id, rather than a real
on-hand instance id (`"oil-1"`). Any combine-goal plan whose primary
path (this function's own `requiredPrior` lookup, e.g. potato's
`combine: "fried"`) or secondary path (`planSecondaryRole`'s one-hop
prefix, or its own `finishOn`) needed a `requiredIngredientCapabilities`
step produced a `RecipeStep` referencing a nonexistent instance id,
rejected by `runRecipe` with `Unknown ingredient instance "oil"`.
`CombinePlanQuery` gained a required `availableIngredientInstances`
field (the SAME real pool `planIntent`'s own `instancePool` already
built and threaded correctly through its own non-combine goal path —
this was a combine-path-only gap, not a repo-wide one), threaded through
to both `planCombine`'s own step generation and (as a new parameter)
`planSecondaryRole`. See `tests/planner.test.ts`'s "the primary path's
own requiredIngredientCapabilities step resolves to a real INSTANCE
id..." case and `scripts/planner-as-a-robot.ts`'s "§6" section for the
real-data proof (a combine goal whose primary path needs FRY's own oil
requirement, run against the real engine, zero errors).

## RecipeIntent -> RecipeScript (gap 2, ties everything together)

## `PlanIntentSuccess`

- `stepGoalIndex`: `recipe.sequence[i]` was produced to satisfy `intent.goals[stepGoalIndex[i]]` — the same length as `recipe.sequence`, added 2026-08-17 specifically for `recipe-runner.ts`'s `runRecipeFromIntent` (closed-loop replanning): on a step failure, this is how the runner knows WHICH original goal to replan toward, without re-deriving it.

## `planIntent`

Resolves a `RecipeIntentSchema` (goals + constraints) into a real,
runnable `RecipeScript` — `ROADMAP.md`'s own framing exactly:
"`RecipeScriptSchema` itself doesn't go away — it becomes the planner's
grounded output." Goals are processed IN ARRAY ORDER (a real, named,
deliberate simplification — no goal reordering/backtracking across goals
is attempted); a later goal's `instanceId` may reference
`"$combineResult:<goalIndex>"` to target what an EARLIER combine-goal
produced, letting a full multi-step, multi-instance dish (fry potato,
prep egg, combine, then fry the result — the real `tortilla_de_patatas`
shape) be planned end to end, not just proposed goal by goal in
isolation. Proven against exactly that real dish, not just a synthetic
case — see `scripts/planner-as-a-robot.ts`/`npm run
capability-test:planner`.

The `currentState` map tracks each instance id's CURRENT state/tags as
goals are resolved in order, seeded from the intent's own declared
`initialInventory` — needed so a later goal on the SAME instance (or a
`$combineResult` reference) starts its own search from the right place,
not from the original `initialInventory` entry.
