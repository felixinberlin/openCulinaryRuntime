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
COMBINE's own real engine behavior, checked directly before building this
rather than assumed: `engine.ts`'s `applyAction` checks
`requiredSecondaryCapability` ONLY against the secondary instance's
ENTITY-level `capabilities` flag (`secondaryEntity.capabilities[cap] ===
true`) — it never inspects the secondary instance's current STATE at all
(confirmed by reading `applyAction` directly: no `statePrerequisites`
lookup happens on that branch, and `egg_cracked.json` — `combine.json`'s
real secondary role — has no `combine` key in its own
`statePrerequisites` either). That's a real, pre-existing limitation this
planner does not invent — the SAME class of gap `LEARNINGS_ENGINE.md`
2026-08-12 already named for `requiredIngredientCapabilities` ("checks
presence via the ingredient's ENTITY definition only — never the
ingredient instance's current state"), just never previously stated for
THIS mechanism.

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

`desiredState`/`desiredTags`, if given, are NOT anything `engine.ts`
would ever require — they let a caller ask for a REALISTIC recipe (a
genuinely beaten, salted egg, not a technically-legal raw one) by reusing
`isGoalReachable` on whichever entity ends up holding the capability.
Omitting them produces the bare-minimum, engine-legal (but possibly
unrealistic) plan — an honest default, not a silent downgrade.

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
