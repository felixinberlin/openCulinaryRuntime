# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Past the planning-only stage: `src/` has a working schema/engine (`ingredient.ts`,
`action.ts`, `engine.ts`, `recipe.ts`, `recipe-runner.ts`, `registry.ts`, `thermal.ts`,
`heat-source.ts`, `egg-doneness.ts`, `place.ts`, `potato-doneness.ts`, `altitude.ts`,
`execution-bounds.ts`, `in-progress-action.ts`, `dag-scheduler.ts`), `data/` has real
entities/actions/recipes/CCPs/heat-sources (potato, egg + its byproducts, garlic,
onion, oil, salt/pepper/chili/acid, butter, milk, flour/yeast/dough, alioli variants,
gas/vitro/wood heat providers, ...), and `scripts/` has runnable demos plus
`validate.ts`. Commands:
`npm test` (`node:test` unit suite over `tests/*.test.ts` — synthetic fixtures against
`engine.ts`/`action.ts`/`ingredient.ts`/`thermal.ts`/`place.ts`/`potato-doneness.ts`/
`altitude.ts`/`execution-bounds.ts`/`in-progress-action.ts`/`dag-scheduler.ts`, no
`data/*.json` dependency),
`npm run validate` (schema + cross-reference check over the real `data/*.json`, PLUS
(2026-08-14) an actual end-to-end simulation of every `data/recipes/*.json` via
`recipe-runner.ts`'s `runRecipe` — not just static id cross-checking — the
authoritative integration check), `npm run demo:<name>` (see `package.json` for the
full list), `npm run recipe -- <id>`, `npm run build` / `npx tsc -p . --noEmit`
(typechecks `src`, `scripts`, AND `tests`; both are clean with zero errors as of
2026-08-14's `tsconfig.json` fix — `noEmit`/`allowImportingTsExtensions` — no more
`TS5097` noise to filter). `npm test` and `validate.ts` are complementary, not
alternatives (see `LEARNINGS_ENGINE.md` 2026-08-13) — `validate.ts` now covers real
recipe execution too, but still run both, plus every demo, after any change to
`src/`, not just the new thing.

**Before starting work, read `LEARNINGS.md`** — split 2026-08-15 into 4 theme files
once it passed ~2,300 lines (`LEARNINGS_ENGINE.md`, `LEARNINGS_DOMAIN.md`,
`LEARNINGS_TOOLING.md`, `LEARNINGS_PROCESS.md`; `LEARNINGS.md` itself is now a short
index — start there, it says which file(s) match what you're touching). After
learning something that would've saved time going in — a schema constraint, an
engine gotcha, a design tradeoff and why — append a dated entry to the theme file it
actually belongs to. Don't just re-derive the same surprise next session, and don't
let this section (or any other doc here) go stale the way this one just did: when the
repo's real shape changes, update the doc that describes it in the same change, not
"later."

**Every factual claim in `data/*.json`/`src/*.ts` (a safety threshold, a physical
constant, a technique claim) must trace to a real source, logged in
`REFERENCES.md`.** Compiled 2026-08-13 ahead of this repo going public — nothing here
claims novel food science; the schema/engine is the original contribution, the facts
it enforces are cited. When adding a new citation to any `data/*.json`/`src/*.ts` file,
add it to `REFERENCES.md` in the same change, same discipline as `LEARNINGS.md` above.

## What this repo is for

`CLAUDE_DEV_CTX.md` is the design blueprint for the **Open Culinary Runtime (OCR)**, a project that models recipes as deterministic, executable state machines (an Entity-Component-System, not static text) rather than prose instructions. Treat it as the system prompt/spec for any code written in this repo — new files should follow its architecture rather than a generic recipe-app design.

### Core architectural pillars

- **Entities ("What")** — physical, reusable objects. Consumable ingredients (e.g. "potato") are modeled separately from reusable cookware/utensils (e.g. "frying-pan", "chef-knife").
- **States ("Physical conditions")** — observable conditions of an entity (e.g. "raw", "peeled", "chopped", "boiled", "liquid").
- **Actions ("Changes")** — transformations that act as transition boundaries: they consume inputs in State A and yield outputs in State B.
- **Parameters ("Culinary details")** — quantitative modifiers: physics, timing (seconds), and safety-critical thresholds (HACCP).

### Simulation rules that any engine code must enforce

- **Conservation of mass/entities** — executing a step (e.g. "separate") destroys the parent entity in the inventory and spawns disjoint child entities in its place (e.g. "egg_yolk" + "egg_white").
- **Physical feasibility restrictions** — block state transitions that are physically impossible (e.g. can't "chop" something "mashed" or "liquid" — there's no discrete piece left for a knife to act on). See the `INVALID_TRANSITIONS` map in the reference engine below for the canonical forbidden-transition table shape — **but note its own literal example ("can't peel something already boiled") is factually wrong**, caught 2026-08-15 on direct user correction (boil-in-jacket-then-peel is a real, common potato technique) after being carried uncritically since this repo's first commit; see `ROADMAP.md` Phase 4 / `LEARNINGS_PROCESS.md` 2026-08-15 for what's actually implemented and checked instead (`ingredient.ts`'s `invalidTransitions`, per entity).
- **HACCP critical control points** — thermal steps must enforce food-safety thresholds (e.g. minimum internal temperature of 135°F held for at least 15 seconds).
- **Cooklang interoperability** — Cooklang is the primary human-writable authoring format. Preserve backward compatibility with its scaling multipliers and spice locks (quantities prefixed with `=` do not scale linearly).
- **Schema.org is a lossy export target** — Schema.org JSON-LD is a flat target for search-engine indexing only. Conversions from rich, nested OCR JSON to Schema.org must be one-directional (lossless OCR → lossy Schema.org), not treated as a round-trippable source of truth.

### Module layout — as planned vs. as actually built

`CLAUDE_DEV_CTX.md`'s original file split didn't survive contact with incremental,
additive real work; the actual layout diverged under different names. Both are
listed so neither this file nor `CLAUDE_DEV_CTX.md` alone gives a false picture:

| Planned (`CLAUDE_DEV_CTX.md`) | What actually exists | Notes |
|---|---|---|
| `ingredient.ts` — `EntitySchema`, `RecipeIngredientSchema`, `ParsedIngredientSchema` | `src/ingredient.ts` — `EntitySchema` + `QuantitySchema` (`RecipeIngredientSchema`, closed 2026-08-13, used as `recipe.ts`'s `RecipeInstanceSchema.quantity`) | `ParsedIngredientSchema` not built; nothing consumes raw scraper output yet (Phase 5/7 still unstarted) |
| `recipe-step.ts` — `EntityStateSchema`, `CriticalControlPointSchema`, `MechanicalActionSchema` | Split across `src/engine.ts` (`Instance` ≈ `EntityStateSchema`), `src/action.ts` (`Action`/`ActionOutputsSchema` ≈ `MechanicalAction`), `src/thermal.ts` (`CriticalControlPointSchema`, built as named) | No single `recipe-step.ts` — the concept fragmented across three files as the engine grew organically |
| `recipe.ts` — `RecipeScriptSchema` | `src/recipe.ts` — built close to as planned | plus `src/recipe-runner.ts` (not in the original plan) actually walks a `RecipeScript` against `engine.ts` |
| `nutrition-extension.ts` | Not built | |
| `ocr-engine.ts` — `OcrValidationEngine`, `INVALID_TRANSITIONS` | `src/engine.ts`'s `applyAction` covers part of this (capability/tool/state-prerequisite checks, conservation of mass, HACCP + `SafetyPolicy`), **plus (closed 2026-08-15) `Entity.invalidTransitions`** (`ingredient.ts`) — a real forbidden-state-transition check, just keyed per entity rather than one global map; see that field's own doc comment and `ROADMAP.md` Phase 4 for why | Also not a class named `OcrValidationEngine` — a plain function; `invalidTransitions` diverges from `CLAUDE_DEV_CTX.md`'s literal global-map shape on purpose — see `LEARNINGS_ENGINE.md` 2026-08-15 |
| `ocr-converter.ts` — `compileToSchemaOrgIngredient`, Cooklang parser | `src/cooklang.ts` (`parseCooklang`/`importCooklangDraft`/`exportToCooklang`) + `src/cooklang-translate.ts` (`translateCooklangDocument`), both closed 2026-08-18 | Cooklang syntax parsing, entity-matching import, mechanical export, AND the free-text step-prose→`actionId` translator (a real, bounded, deterministic keyword matcher — no LLM call) are all real; only `compileToSchemaOrgIngredient`/Schema.org export is still not built — see the "ninth"/"tenth" entries below and `AUTHORING.md` §2 |

`src/registry.ts` (loading `data/*.json` by directory into typed `Map`s) also isn't
in the original plan — the whole `data/` directory of JSON files, validated against
these schemas rather than defined in TypeScript, is itself a divergence from
`CLAUDE_DEV_CTX.md`'s framing, though a compatible one.

Two more files with no counterpart in the original plan, both added 2026-08-13:
`src/heat-source.ts` (`HeatSourceProfileSchema` + `estimatedPreheatSeconds`,
`data/heat-sources/*.json`: gas/vitro/wood — real, cited heat-provider performance
data, e.g. "how long to boil water on a wood fire vs. gas") and
`src/egg-doneness.ts` (`EGG_BOIL_DONENESS`, a real cited seconds-range table for
`boil.json`'s `yolkDoneness` — closes the "if I tell a robot medium boiled, I want it
to understand it" gap at the reference-data layer). Both are CCP-shaped (their own
top-level `data/` collection + schema + `registry.ts` loader, mirroring
`thermal.ts`/`data/ccps/`) rather than fields grafted onto `EntitySchema` — see
`LEARNINGS_DOMAIN.md` 2026-08-13 for why, and `ROADMAP.md`'s "Common culinary knowledge
coverage" section for the surrounding context this was built under.

A third such file, added 2026-08-14: `src/place.ts` (`PlaceState` +
`pourInto`/`advanceHeatSeconds`/`isAtBoiling`, plus their general form
`advanceTempSeconds`/`isAtTargetTemp` added the same day once FRY needed
oil — no `boilingPointC`, a chosen setpoint clamp instead of a phase-change
one, `smokePointC` as a hard-reject safety ceiling) — the physics half of
`ROADMAP.md`'s "heat as a shared, time-varying property of a PLACE" gap, a
tool instance (a pot/pan) with a real temperature that persists and evolves
as a pure function of elapsed simulated time, reusing `estimatedPreheatSeconds`'s
energy-balance approximation. Same standalone-module-before-engine-wiring
precedent as `heat-source.ts`/`egg-doneness.ts` initially — **but engine
wiring itself followed 2026-08-16**: `src/recipe-runner.ts` (not
`applyAction`, which stays unchanged) now recognizes three real verbs
(`data/actions/fill.json`/`place_in.json`/`heat_place.json`) and tracks
`places`/`placeContents` — the "instances co-located in one tool instance
sharing its state" concept, plus an opt-in `params.placeId` readiness check
on BOIL/SIMMER. See `LEARNINGS_ENGINE.md` 2026-08-14 and 2026-08-16, and
`ROADMAP.md`'s "Heat as a shared, time-varying property of a PLACE" entry
(2026-08-16 update) for exactly what's closed (`data/recipes/two-eggs-shared-pot.json`,
`npm run capability-test:shared-pot-heat`) vs. still open (FRY/oil, the
placed food's own internal temperature, periodic/alternating heating).
Proven via `tests/place.test.ts` and `npm run capability-test:boil-as-robot`/
`capability-test:fry-as-robot` (`scripts/boil-egg-as-a-robot.ts`/
`scripts/fry-egg-as-a-robot.ts`).

A fourth, same day: `src/potato-doneness.ts` (`POTATO_BOIL_DONENESS`,
`boil.json`/`simmer.json`'s `pieceSize` parameter) — the direct potato
sibling of `egg-doneness.ts`, and the concrete proof that `place.ts`/
`heat-source.ts` generalize across ingredients: `scripts/boil-potato-as-a-
robot.ts` reuses both with zero code changes. Real finding worth knowing
before touching this file: potato and egg disagree on which `startMethod`
is actually recommended (cold-start is objectively better for potato per
America's Test Kitchen, not just gentler) — see that file's own doc
comment for the full, deliberately-unresolved tension. `cut.json`'s
`shape` enum also gained `halved`/`quartered` in this change (a real,
previously-missing potato-boiling prep size, not potato-specific wiring).

A fifth, still 2026-08-14: `src/altitude.ts` (`atmosphericPressurePa`,
`waterBoilingPointC`) — real, computed altitude→boiling-point physics
(ICAO Standard Atmosphere barometric formula + water's own Antoine
vapor-pressure equation, not a lookup table), closing `water.json`'s
long-standing "no altitude/pressure parameter anywhere" citation note,
in direct response to an external scientific review naming it the
highest-priority unaddressed gap. Composes with `place.ts`'s
`advanceTempSeconds`/`isAtTargetTemp` with zero further changes — see
`scripts/boil-at-altitude.ts`. Closes the REACH-boiling-temperature half
only; `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS`'s hold-time ranges are
still sea-level-only, named explicitly in that file's own doc comment.
Same day, `egg-doneness.ts` gained `EGG_SIZE_ADJUSTMENT_SECONDS`/
`eggBoilDonenessRangeForSize` (`boil.json`/`simmer.json`'s new `eggSize`
parameter) — a real, cited offset on top of the existing large-egg-only
table, not a second competing one.

A sixth, 2026-08-16: `src/execution-bounds.ts` (`executionBoundFor`) —
implementing TICKET 2 of a user-supplied paper read (`PAPER_NOTES_2608.
04768.md`, analyzing Song et al., arXiv:2608.04768 — `REFERENCES.md`),
the direct follow-on to `action.ts`'s new `actionKind` field (TICKET 1,
same day). Computes a dual bound for a continuous action: `maxDuration
Seconds` (the paper's own sensory-OR-timeout ceiling, set on all 18
`continuous` actions) and `minSafeHoldSeconds` (a real safety floor read
from this repo's existing CCP machinery, `thermal.ts`/`data/ccps/*.json`
— including the D/z `thermalModel` computation where one applies) that a
plausible sensory "looks done" signal must not be allowed to override.
Same standalone-module-before-engine-wiring precedent as `place.ts`/
`heat-source.ts`/`egg-doneness.ts` — `engine.ts`'s `applyAction` is
completely unchanged; surfaced read-only in `recipe-explain.ts`'s new
`executionBounds` field (`npm run validate-recipe`). Proven via `npm run
capability-test:execution-bounds`
(`scripts/reject-early-sensory-termination.ts`), which shows a plausible
early sensory reading correctly rejected against both a flat CCP floor
(egg via `BOIL`) and a real D/z-computed one (`egg_yolk` via
`PASTEURIZE`), citation printed. Building this also found and fixed a
real, independently-discovered gap in `recipe-explain.ts` itself (it
couldn't resolve a step targeting a SPAWNED instance, e.g. `PASTEURIZE`
on `egg_yolk-3` — exactly the ticket's own best demo case) via a new
`RecipeRunResult.spawnedEntityIds` map on `recipe-runner.ts`, not a
second, parallel re-derivation of the spawn-id naming scheme — see
`LEARNINGS_ENGINE.md` 2026-08-16 for the full reasoning.

A seventh, 2026-08-17: `src/in-progress-action.ts` (`beginAction`/
`progressStatus`/`fractionOfRequestedDuration`/`remainingRequestedSeconds`) —
the query half of ROADMAP.md's "Heat as a shared, time-varying property of a
PLACE" gap: given a `continuous` action that started some simulated seconds
ago, answers whether it's still below its CCP safety floor, in progress, at
its own caller-requested duration, or past `execution-bounds.ts`'s forced
timeout ceiling — composing directly with that module's `ExecutionBound`
rather than a second source of truth. Same standalone-module-before-engine-
wiring precedent; `engine.ts`'s `applyAction` stays atomic and unaware of it.
Proven via `tests/in-progress-action.test.ts` and `npm run
capability-test:in-progress-action` (`scripts/check-in-on-a-cooking-
instance-as-a-robot.ts`).

An eighth, same day: `src/dag-scheduler.ts` (`resolveStepId`/
`deriveDependsOn`/`topologicalOrder`/`scheduleDag`/`scheduleDagFromSteps`) —
ROADMAP.md's "Recipe execution as a DAG" ticket, deliberately scoped:
computes a deterministic concurrent-execution SCHEDULE as read-only
information (real "10 minutes, not 15" savings, real tool-lock contention —
`DagNode.requiredToolIds`, closing a gap this module's own doc comment named
against itself the same day it shipped), but does NOT make `recipe-runner.ts`
execute steps concurrently — genuine concurrent mutation of the shared
inventory `Map` would violate `ENGINE_INVARIANTS.md` #9's determinism
guarantee. `RecipeStepSchema` (`recipe.ts`) gained optional `id`/`dependsOn`
fields (fully backward compatible); `topologicalOrder` IS wired into
`runRecipe` for real (execute in dependency-respecting order, still
single-pass/deterministic — a cyclic recipe is caught before touching
inventory). `action.ts` gained `requiresActiveAttention` (ACTIVE vs. PASSIVE,
audited across all 26 `continuous` actions). Proven via `tests/
dag-execution.test.ts` and `npm run capability-test:dag-schedule`
(`data/recipes/garlic-oil-potatoes.json` retrofitted with explicit
`id`/`dependsOn` as the real join-node proof).

Same day, `action.ts` also gained `outputs.addsTagFromParameter` and
`requiredIngredientCapabilityFromParameter` — closing ROADMAP.md's
2026-08-13-deferred SEASON generalization (`data/actions/season.json`, ADDITIVE
alongside the still-unchanged `salt.json`/`pepper.json`/`chili.json`/
`acid.json`) — a deliberate, NAMED adaptation of `transformedStateFromParameter`'s
pattern (a value-to-tag MAP, not a raw passthrough) plus a real new
`ExecutionResult.matchedIngredientInstanceId` field (`npm run
capability-test:season-verb`).

A ninth, 2026-08-18: `src/cooklang.ts` (`parseCooklang`/`importCooklangDraft`/
`exportToCooklang`) — `ROADMAP.md` Phase 5's Cooklang parser/exporter, scoped
exactly along the mechanical-vs-not boundary `AUTHORING.md` §2 drew before any
code existed. `parseCooklang` is a real grammar (`@ingredient{qty%unit}`,
`#cookware{}`, `~{timer}`, `>> metadata`, `-- comments`, `[- block comments -]`,
citation in `REFERENCES.md`'s new "Interoperability formats" section) — no
judgment calls. `importCooklangDraft` matches every `@token` against a real
`Entity.cooklang.canonicalToken` (or, failing that, the entity's bare `id` — a
documented symmetric fallback with the export direction) to propose
`RecipeInstance[]`, unresolved tokens named rather than dropped — still a
DRAFT, never asserted valid on its own. `exportToCooklang` is the fully
mechanical reverse (an OCR `RecipeScript` already carries everything Cooklang
needs — no prose synthesis, so no LLM-in-the-loop problem exporting), and
composes with `recipe-runner.ts`'s real `spawnedEntityIds` (optional param) to
resolve instances SPAWNED mid-recipe to real tokens too — same
compose-with-real-ground-truth precedent as `execution-bounds.ts`/
`in-progress-action.ts`. Deliberately NOT built here, named rather than
hidden: the free-text step-prose → typed `actionId`/parameter translator
(closed separately the same day — see the "tenth" entry below) and
Cooklang scaling multipliers (no recipe-scaling engine exists anywhere in this
repo to scale against, `ingredient.ts`'s `QuantitySchema` doc comment).
Spice-lock (`=`-prefixed quantities) round-trips faithfully. Proven via
`tests/cooklang.test.ts` (23 synthetic-fixture unit tests, same
no-`data/*.json`-dependency discipline as every other test file) and `npm run
capability-test:cooklang` (`scripts/cooklang-as-a-robot.ts`) — the latter
against REAL `data/entities/*.json` and a REAL recipe with a genuine
`SEPARATE` spawn (`handmade-alioli-egg-yolk.json`).

A tenth, same day: `src/cooklang-translate.ts` (`translateCooklangDocument`)
— the free-text step-prose → typed `actionId`/parameter translator the
ninth entry above deliberately left unbuilt, and `AUTHORING.md` §2 (point 2)
originally scoped to an LLM or human. Stays inside that same boundary
rather than crossing it: a real, bounded, DETERMINISTIC keyword/
allowed-value matcher over this repo's own closed action vocabulary
(`data/actions/*.json`'s `verb`/`names`/`parameters`) — not an NLP model,
not an LLM call (this repo has never called an external LLM API anywhere
in its execution path; `package.json`'s only dependency is `zod`,
unchanged by this). Recognizes a verb by its `verb` id or ANY locale in
`names` (a Spanish-authored step matches as well as an English one);
infers `durationSeconds` from an already-parsed Cooklang timer
(unit-converted to seconds); infers an `allowedValues` parameter from a
literal value string in the prose. Reports rather than guesses at every
real ambiguity — two allowed values both present, or (a real,
independently-discovered finding building this) a verb shared by more
than one action: `data/actions/*.json` has FOUR distinct real actions
(`combine.json`/`combine_dough.json`/`combine_potato_onion.json`/
`combine_con_cebolla.json`) all sharing the identical verb `COMBINE`,
fixed by tracking every alias's full candidate-actionId list rather than
letting the last one loaded silently win. Never attempts to extract a
numeric-range parameter (`oilTempC`, `waterTempC`, ...) from prose at all
— always named as missing, never invented. A step with more than one
recognized verb produces exactly ONE `RecipeStep`, naming the rest.
Output is a `RecipeScript`-shaped DRAFT, same "never `.parse()`d here,
hand off to `validate-recipe`" precedent as `recipe-scaffold.ts`'s
`RecipeScaffold`. Proven via `tests/cooklang-translate.test.ts` (15
synthetic-fixture unit tests) and `npm run capability-test:cooklang-
translate` (`scripts/cooklang-translate-as-a-robot.ts`) — against REAL
`data/entities/*.json`/`data/actions/*.json` and two REAL recipes
(`handmade-alioli-egg-yolk.json`: recovers all 6 original actionIds
round-tripped purely through Cooklang text; `tortilla-de-patatas.json`:
the COMBINE ambiguity finding above, live). See `LEARNINGS_ENGINE.md`
2026-08-18 for two further real regex bugs found building this (a `\b`
word-boundary silently failing when an alias ends in punctuation, and a
duplicate "missing required parameter" note for a parameter that was
actually found).

Read `CLAUDE_DEV_CTX.md` for the *concepts* (still accurate) — verify file/symbol
names against the table above or `ROADMAP.md`, not against that file's original
naming, before assuming something exists.

### Recent content epics (not new `src/*.ts` modules — see `ROADMAP.md` for the full entries)

- **Baking, 2026-08-17**: `data/entities/flour.json`/`yeast.json`/`dough.json`
  (this repo's second-ever composite entity) + `data/actions/combine_dough.json`/
  `knead.json`/`proof.json`. Real anchor dish: `data/recipes/simple-flatbread.json`
  (deliberately UNLEAVENED — a real, honestly-named engine limit, not yet built,
  blocks a true leavened-bread recipe: `COMBINE`-shaped actions only ever merge
  TWO instances, and real yeasted bread needs three). `npm run
  capability-test:bake-bread` proves the leavened-path mechanisms (yeast
  activation, `PROOF`) directly, independent of that gap.
- **Milk, 2026-08-17**: `data/entities/milk.json`, this repo's first dairy
  liquid — closes a gap `mashed-potatoes.json`'s own prose had already named
  without the recipe actually containing milk.
- Two external-document triages (2026-08-17): a generic cooking-tips document
  (`scripts/cooking-common-sense-triage-as-a-robot.ts`) and a physical-
  feasibility-rules document (`scripts/physical-feasibility-rules-as-a-robot.ts`,
  found a real `DRAIN` statePrerequisite gap) — both moved to `olddocs/` after
  triage, per the established convention.
- A self-authored (not externally triaged) common-sense audit, same day
  (`scripts/self-authored-common-sense-rules-as-a-robot.ts`) — found and fixed
  a real structural gap: `requiredSecondaryCapability` checked a COMBINE-shaped
  action's secondary instance for CAPABILITY only, never STATE, until
  `engine.ts`'s `checkStatePrerequisite` helper was extended to cover it too.
- "Ticket 1" (2026-08-17): a user-supplied refactor ticket asking to remove
  `openFoodFactsId`/`usdaFoodDataId` from the core schema — checked and closed
  as already-satisfied; neither field, nor any external-database coupling,
  has ever existed in this repo's core schema.

### Planned satellite projects

`CLAUDE_DEV_CTX.md` also scopes three follow-on assignments; check with the user which (if any) is in scope before generating code for them, since they imply different languages/runtimes than the core TS engine:

1. **Web scraper pipeline (Python / BeautifulSoup)** — fetch a recipe URL, extract `<script type="application/ld+json">`, tokenize the lossy `recipeIngredient` strings into quantity/unit/name/preparation, generate Cooklang text, compile to an executable OCR JSON script.
2. **Mobile reference app (React Native + Expo)** — 4-tab navigator: Discover (local recipe search), Community (feed with `FormData` uploads + `onUploadProgress`), Meal Plan (`.menu` schedule parsing), Profile (JWT with auto-logout on expiry).
3. **Home Assistant HACS component (Python)** — talks to a local CookCLI server at `http://localhost:9080`; sensors for expiring food / depleted pantry; populates HA Calendar from `.menu` schedules.

A fourth, adjacent topic — not one of the three original assignments, not
scoped for a build — is **`SIMULATION_TARGETS.md`**: research comparing five
open-source options (PDDL/Fast Downward, VirtualHome, AI2-THOR/ProcTHOR,
OmniGibson/BEHAVIOR-1K, RoboCasa) for eventually grounding this repo's
`Entity`/`State`/`Action` model in a simulated or robot-executed world, plus
a worked mapping of all six base ingredients (egg, potato, water, oil, salt,
garlic) into each. Read that file before assuming a simulation target has or
hasn't been chosen — none has; `ENGINE_INVARIANTS.md` #11 still applies.

## A Gemini CLI config was found

`~/.gemini/settings.json` exists on this machine (user-level, not project-level). If you want its MCP servers/instructions/etc. available in Claude Code, reply `/import` to scan it.
