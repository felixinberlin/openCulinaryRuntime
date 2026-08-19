# SIMULATOR_API.md

The public surface `src/index.ts` re-exports, for a same-process,
direct-import consumer — concretely, the `cooking-simulator` sibling
project (see `CLAUDE.md`'s "Planned satellite projects"). This is **not**
an HTTP API: everything here is a plain TypeScript function/type, called
in the same Node process as the caller.

## How to depend on this package

```json
// cooking-simulator/package.json
"dependencies": { "ocr": "file:../pro" }
```

Then `import { loadKnowledgeBase, applyAction, ... } from "ocr";`.

**No build step.** `package.json`'s `main`/`types`/`exports` all point at
`./src/index.ts` directly — a `.ts` file, not compiled `.js`/`.d.ts`. This
is deliberate: `tsconfig.json`'s `noEmit: true` is this repo's own
long-standing, intentional state (nothing here has ever consumed `tsc`'s
compiled output — see `CLAUDE.md`'s "Repository state" section, 2026-08-14's
`tsconfig.json` fix), and adding a second build
config only to serve one external consumer would reintroduce the exact
two-config drift risk that was fixed by going all-in on `noEmit`. Instead,
the consumer runs its own code (and, transitively, this package's `.ts`
source) via `tsx` (or any other TS-stripping runtime with the same
`moduleResolution: "Bundler"` + `allowImportingTsExtensions: true`
settings this repo's own `tsconfig.json` uses — the consumer's own
`tsconfig.json` must mirror those two fields, or its typecheck won't
resolve this package's `types` field). The upside: editing a `.ts` file in
`pro` is visible to the consumer on the very next run, with zero rebuild
step in between.

## Function catalog, by simulator mode

### Sandbox — pick entities/tools freely, apply one action at a time

- `loadKnowledgeBase(dataDir?)` (`src/knowledge-base.ts`) — loads every
  `data/*` collection at once (`entities`, `actions`, `recipes`, `ccps`,
  `heatSources`, `mealPatternContributions`, `foodOnCrosswalk`), resolved
  relative to this package's own root, not the caller's `process.cwd()`.
- `applyAction(instance, action, entities, availableTools, params?, availableIngredients?, ccps?, policy?, secondaryInstance?)`
  (`src/engine.ts`) — the real one-step transition function. Pure: returns
  a new `ExecutionResult` (`{instance, spawned, destroyed,
  secondaryDestroyed, warnings, matchedIngredientInstanceId?}`), never
  mutates its `instance` argument. The caller owns its own
  `Map<string, Instance>` "world" and writes the result back in.
- `listApplicableActions(instance, entities, actions, availableTools, availableIngredients?, ccps?, policy?, secondaryInstance?)`
  (`src/applicable-actions.ts`, new) — "which of this entity's actions can
  I press right now, and why not the rest?" Dry-runs `applyAction` per
  candidate and reports `{actionId, applicable, reason?,
  requiresSecondaryInstance}`. `reason` is `applyAction`'s own thrown
  message, verbatim — **free text, not a typed reason code**. If the UI
  later needs machine-parseable/i18n-able reasons, that's a real, deferred
  gap (getting a typed reason for the COMBINE-shaped case would mean
  re-implementing `reachability.ts`'s own guard logic — deliberately not
  done here; see that file's doc comment).
- `in-progress-action.ts` (`beginAction`/`progressStatus`/
  `fractionOfRequestedDuration`/`remainingRequestedSeconds`) +
  `execution-bounds.ts` (`executionBoundFor`) — for a `continuous` action
  (BOIL, FRY, ...): given how long it's been running, is it still below
  its CCP safety floor, in progress, at the caller-requested duration, or
  past the forced timeout ceiling? Exactly what a progress bar/"looks
  done?" prompt needs.

### Guided player — step through an authored `RecipeScript`

`src/recipe-player.ts`: `createPlayer(recipe)` → `RecipePlayerState`;
`stepForward`/`stepBackward`/`jumpTo` (index-only, no rollback needed —
state is just an index into the sequence, recomputed on demand);
`currentNarration(player, entities, actions, ccps?)` → human-readable
narration of every step executed so far; `canApplyNext(player, entities,
actions, ccps?)` → `{possible, reason?}` for "is the next step actually
performable right now?"; `createVariation(recipe, branchAfterIndex,
newTailSequence, suffix?)` → an ordinary new `RecipeScript` sharing a
prefix with a different tail, for a "what if I did X instead" branch.

A `RecipeScript` can come from `data/recipes/*.json` (via
`loadKnowledgeBase().recipes`) or from Cooklang import
(`src/cooklang.ts`'s `importCooklangDraft`) — see "Deferred for v1" below.

### Goal-directed planner/challenge — state a goal, plan or verify a path

`src/reachability.ts`: `isGoalReachable(query)` → `{reachable: true, path}`
or `{reachable: false, blockedBy: BlockingReason[]}` (a typed union —
`missing_tool`, `unsatisfied_state_prerequisite`, `forbidden_transition`,
...); `enumerateEdges(...)` → every state-graph edge reachable from a
given state (the lower-level primitive `isGoalReachable` searches over).

`src/planner.ts`: `planIntent(intent, entities, actions)` → a real,
runnable `RecipeScript` satisfying an `RecipeIntent`'s goals, or a typed
failure reason; `planLowestCost`/`planSecondaryRole`/`planCombine` for
cost-aware and COMBINE-shaped (two-instance) planning.

Use `isGoalReachable` to validate a user's own proposed path (a "does this
sequence of actions actually reach the goal" challenge mode) and
`planIntent` to auto-generate one (a "show me how" hint/solution mode).

### Cross-cutting

- `src/query.ts`: `answerAboutParameter`/`answerAboutDomainFact`/
  `answerAboutEntityDomainFact` — typed Q&A over an action's parameters, a
  CCP's domain facts, or an entity's domain facts. Good for tooltips/help
  text without hand-writing prose per fact.

## Explicitly out of scope for v1

- **`dag-scheduler.ts` / `execution-graph.ts` / `execution-graph-compiler.ts`**
  — concurrent-step scheduling and a domain-independent execution IR. Not
  needed for a single-user, one-action-at-a-time simulator loop. Revisit
  if the simulator ever models multiple simultaneous cooking processes
  (e.g. "the oven is roasting while you chop onions").
- **`cooklang.ts` / `cooklang-translate.ts` / `schema-org.ts` /
  `nutrition-extension.ts` / `foodon-crosswalk.ts`** — recipe
  authoring/export/interop. Secondary to the core simulate-a-recipe loop;
  relevant later if the simulator lets users import/export their own
  recipes.
- **`recipe-explain.ts`** (`explainRecipe`) — real, but built as
  groundwork for a *different*, separately-planned "recipe creator"
  frontend (see `ROADMAP.md`), not this simulator. Worth revisiting if the
  simulator grows a "validate my custom recipe before I try to cook it"
  pre-flight screen.

## Serialization

`Instance`, `RecipeRunResult`, and `KnowledgeBase` all use `Map`, not
plain objects — deliberately not JSON-safe. There is no HTTP boundary
here and none is planned; a `Map` ↔ plain-object adapter for persisting a
sandbox session (disk, `localStorage`, a save-game slot, ...) is
application concern, and belongs in the `cooking-simulator` project's own
persistence layer, not here.
