# OCR Roadmap

## Why this exists

The concrete, non-abstract version of the goal: someone who cannot safely cook for
themselves — a wheelchair user without full reach/grip, someone recovering from
surgery, an elderly person living alone — should be able to have an actual cooked
meal made *for* them by a machine that follows real technique, not just reheats a
tray. That only works if "cook" is precise enough for a machine to execute and
honest enough not to fake the parts it can't yet do. Every "informational only, not
enforced" note and every "flagged, not built" gap in this codebase exists because
skipping that honesty would make the system *look* more capable than it is — which,
for something meant to actually cook unattended for a person who's relying on it,
is a worse failure mode than a visible gap. That's the standard this roadmap holds
itself to.

Derived from `CLAUDE_DEV_CTX.md` (see `CLAUDE.md`'s "Module layout" table for where
the implementation diverged from that original plan, and why). Phases below are
loosely ordered by dependency, not calendar date.

## Capability tests

The actual measure of progress: can the current vocabulary, run against the real
`src/engine.ts`, produce a specific real dish end-to-end? Empirically checked, not
reasoned about — run the script yourself. This matters more than phase checkboxes
below; a phase can be "done" on paper and still not add up to a real dish.

| Dish | Status | Script |
|---|---|---|
| Salted fried potatoes | ✅ Makeable | `npm run recipe -- salted_fried_potatoes` |
| Handmade alioli (egg-free, mortar) | ✅ Makeable | `npm run recipe -- handmade_alioli` |
| Handmade alioli (egg yolk) | ✅ Makeable | `npm run recipe -- handmade_alioli_egg_yolk` |
| Garlic oil potatoes | ✅ Makeable | `npm run recipe -- garlic_oil_potatoes` |
| **Tortilla de patatas (sin cebolla)** | ✅ **Makeable** (was ❌ blocked, closed 2026-08-12) | `npm run recipe -- tortilla_de_patatas` |
| Rührei (German-style scrambled eggs) | ✅ Makeable — **zero new vocabulary needed** | `npm run recipe -- ruhei` |
| Huevo frito (runny yolk, puntilla) | ✅ Makeable | `npm run recipe -- huevo_frito` |
| Tortilla francesa (flat, fully set) | ✅ Makeable | `npm run recipe -- tortilla_francesa` |
| French omelette (baveuse, folded) | ✅ Makeable | `npm run recipe -- french_omelette` |
| Soft-boiled egg (jammy, shocked, peeled) | ✅ Makeable | `npm run recipe -- soft_boiled_egg` |
| Tortilla de Betanzos (liquid, flowing center) | ✅ Makeable — **found and fixed a real HACCP gap** | `npm run recipe -- tortilla_de_betanzos` |
| Salt/pepper/chili, same potato (seasoning generalization) | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:season-potato` |
| Boiled egg — gas vs. vitro vs. wood preheat time, doneness timing | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:boil-egg-heat-sources` |
| SIMMER vs. BOIL (potato + egg, same resulting state) | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:simmer` |
| Double-fried potato (PAR_FRY then FRY, distinct intermediate state) | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:double-fry` |
| **Crispy French fries** (julienne + PAR_FRY 163°C + FRY 191°C golden, first real dish to actually exercise shape/oilTempC/doneness together) | ✅ Makeable, closed 2026-08-13 | `npm run recipe -- crispy_french_fries` |
| "Complete potato" — skin-on cuts, GRATE, MASH (a dead state made reachable) | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:complete-potato` |
| "Oma boils an egg" — CONCEPT.md §14's Intent pipeline, made concrete | ✅ Makeable, closed 2026-08-13 | `npm run demo:oma-boils-an-egg` |
| DISSOLVE — salt's own self-admitted "dissolved" dead state, closed | ✅ Makeable, closed 2026-08-13 | `npm run capability-test:dissolve-salt` |
| Egg salad prep — hard-boiled, cut diced, salted (CUT was never callable on egg before); proves shock-vs-wait were both already valid | ✅ Makeable, closed 2026-08-14 | `npm run capability-test:egg-salad-prep` |
| Boil potato as a robot — quartered, real cited hold-time by piece size, place.ts/heat-source.ts reused for a second ingredient with zero code changes | ✅ Makeable, closed 2026-08-14 | `npm run capability-test:boil-potato-as-robot` |
| Fry egg as a robot — oil heated to a real setpoint via place.ts's new target-temperature generalization, smoke-point safety rejection proven | ✅ Makeable, closed 2026-08-14 | `npm run capability-test:fry-as-robot` |
| Fry with any vessel — pot correctly rejected, pan works, wok (never named by fry.json) also works | ✅ Makeable, closed 2026-08-14 | `npm run capability-test:fry-any-vessel` |
| Boil water at real altitude (Madrid/Bogotá/La Paz) — real computed boiling point via ICAO+Antoine physics, composes with place.ts unchanged | ✅ Makeable, closed 2026-08-14 | `npm run capability-test:boil-at-altitude` |
| Two eggs, one shared pot — FILL/PLACE_IN/HEAT_PLACE wired into recipe-runner.ts, real place.ts-backed shared temperature, BOIL's readiness gated on it | ✅ Makeable, closed 2026-08-16 | `npm run recipe -- two_eggs_shared_pot` |
| Shared-pot heat, boiling_start vs. cold_start — identical mechanism, real step-order difference, disproves "independent, unlinked applyAction calls" | ✅ Makeable, closed 2026-08-16 | `npm run capability-test:shared-pot-heat` |
| Place-aware fried egg — FILL/HEAT_PLACE generalized to oil (isPourable/isVessel), FRY rejected while oil is genuinely cold, real huevo_frito params reused | ✅ Makeable, closed 2026-08-16 | `npm run recipe -- fried_egg_shared_pan` |
| Shared-pan heat, FRY readiness gated on real oil temperature — same mechanism as BOIL's, reading fry.json's own oilTempC minimum | ✅ Makeable, closed 2026-08-16 | `npm run capability-test:shared-pan-heat` |
| Reject early sensory termination — a plausible "looks done" sensor reading correctly rejected against a real CCP floor (flat + D/z-computed cases), citation printed | ✅ Makeable, closed 2026-08-16 | `npm run capability-test:execution-bounds` |
| Failure states as a robot — burned/overcooked reachable and correctly terminal, FRY on a burned potato rejected, SALT on the same instance still succeeds, pre-flight advisory fires | ✅ Makeable, closed 2026-08-16 | `npm run capability-test:failure-states` |
| Is goal still reachable — real dead ends with named reasons, a real gap found by pure graph search then fixed (potato.json's invalidTransitionsAudit2026-08-16), a found path actually executed against the real engine, determinism verified | ✅ Makeable, closed 2026-08-16 | `npm run capability-test:reachability` |
| PAR_FRY, place-aware readiness gated on real oil temperature — same `assertPlaceReady` mechanism as FRY's, widened not duplicated, correctly reads par-fry.json's own narrower/hotter 145-165°C floor | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:par-fry-shared-pan` |
| Unit tests per forbidden-transition rule — 42 real, shipped invalidTransitions rules (potato/egg/egg_cracked/onion) run against the real engine, including a real redundancy finding (egg's own PEEL prerequisite makes some entries structurally dead weight) | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:invalid-transitions` |
| POACH with any vessel — the last verb holding an exact-id tool check generalized to `isVessel`, correcting a real overclaimed "standard" technique note along the way (two real, cited, different vessel shapes for two real techniques) | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:poach-any-vessel` |
| Storage/shelf-life — real, cited, state-keyed storageLifeByState (egg raw vs. boiled genuinely different; potato's doNotRefrigerate), surfaced via recipe-explain.ts's storageSummary and recipe-narrator.ts's new section, computed over all 17 real recipes | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:storage-life` |
| Structured DomainFact records — egg_cooking.json's ad-hoc coagulationReferenceC migrated to typed, Zod-validated domainFacts; a malformed entry now actually rejected; queryable via `npm run ask -- fact`, zero prose parsing | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:domain-facts` |
| The actual planner — full tortilla_de_patatas planned end to end from a bare RecipeIntent (zero hand-authored steps), spawn ids correctly predicted, run against the real recipe-runner.ts with zero errors; plus a real closed-loop-replanning failure case against real data | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:planner` |
| **Crispy roast potatoes** (real alkaline-parboil technique — ROAST + ALKALINE_PARBOIL + baking_soda.json, generalizes across potato/garlic/onion, real BAKE-vs-ROAST mechanical distinction proven) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- crispy_roast_potatoes` / `npm run capability-test:roast` |
| **Easy-peel steamed egg** (STEAM — genuinely different verb from BOIL, own state for potato backed by a real measured vitamin-retention difference, egg's widened statePrerequisites proven load-bearing, real HACCP wiring + an honest unreachable-shortfall finding) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- easy_peel_steamed_egg` / `npm run capability-test:steam` |
| **Grilled potatoes and onions** (GRILL — mechanically distinct tool from ROAST, both directions of rejection proven, generalizes across potato/garlic/onion, real parboil-vs-direct technique difference wired correctly) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- grilled_potatoes_and_onions` / `npm run capability-test:grill` |
| **Quick-pickled onions** (MARINATE — mechanically distinct from ACID via a real duration requirement, generalizes across onion/garlic/egg with three genuinely different real timescales from 30 minutes to 10 days) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- quick_pickled_onions` / `npm run capability-test:marinate` |
| **Salt crystal/grind size** (kosher_salt.json/flaky_salt.json — real, cited grams-per-teaspoon differences, EntitySchema.domainFacts extended from CCP-only to entities on a real second forcing case, queryable via `npm run ask -- entity-fact`) | ✅ Makeable, closed 2026-08-17 | `npm run capability-test:salt-crystal-size` |
| **Mashed potatoes** (this repo's first real recipe to exercise MASH; DRAIN/REST generalized beyond oil/fry to the real steam-dry-before-mashing technique, triaged from an external "300 common sense cooking rules" document) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- mashed_potatoes` / `npm run capability-test:cooking-common-sense` |
| **Simple flatbread** (this repo's first real dish from the baking epic — flour/dough/KNEAD, unleavened, real roti/chapati/tortilla-de-harina technique; PROOF/yeast independently proven but not yet in one recipe, blocked on the real 3+-input COMBINE gap) | ✅ Makeable, closed 2026-08-17 | `npm run recipe -- simple_flatbread` / `npm run capability-test:bake-bread` |

**Tortilla de Betanzos found a real bug: `tortilla_mixture.json` had ZERO
`criticalControlPointsByAction` wiring — the same class of gap
`handmade-alioli-egg-yolk.json` originally had.** Betanzos's defining trait is
an intentionally liquid, barely-set interior (the opposite end of
`internalTexture` from `tortilla_francesa.json`'s `fully_set`) — exactly the
FDA "increased risk, disclosed" case `egg_cooking.json` exists for, and it had
no safety check at all until asked whether this specific dish was makeable.
Fixed by reusing `egg_cooking.json` (same organism, same reasoning
`egg_cracked.json` already applies to FRY/SCRAMBLE) rather than inventing a
new CCP. Proven, not asserted: `tortilla_de_betanzos.json`'s two brief,
high-heat FRY steps (12s, 10s — genuinely below the 15s threshold, matching
the real technique) both trigger the advisory warning; `tortilla_de_patatas.
json`'s longer, gentler steps (180s, 120s) trigger none — same entity, same
COMBINE/FLIP machinery, now provably, not just nominally, different dishes.
Also found and fixed a second-order regression this caused:
`attempt-tortilla.ts`'s standalone demo never needed to load `ccps` before
(`tortilla_mixture` had no CCP to reference) — once it legitimately did, the
demo hit the exact self-defending "was ccps not loaded/passed?" error written
for this precise situation, correctly, not a bug in that check.

**`BOIL` had zero parameters, silently, until audited for it.** No
`durationSeconds`, no `yolkDoneness` — despite `egg.json` already wiring a CCP
to it that depends on exactly the first one. Fixed alongside a genuine,
previously-unmodeled culinary-physics gap: carryover cooking (a boiled egg
keeps cooking after leaving the pot; `durationSeconds` alone doesn't fix final
doneness). New `SHOCK` action (ice bath) gives an explicit lever to arrest it —
not a physics simulation, an honestly-scoped concrete instance of
`WORLD_MODEL.md`'s abstract "state is a derived classification of continuous
reality" point, showing up in an actual dish rather than a design doc.

**"Tortilla francesa" vs "French omelette" — a naming false-friend, not one dish.**
Same starting entity (`egg_cracked`), same `FRY` action — genuinely different result:
`tortilla_francesa.json` ends `tags: [salted]` (flat, `internalTexture: fully_set`,
never folded); `french_omelette.json` ends `tags: [salted, folded]` (`baveuse`,
`FOLD`ed). `fry.json`'s new `yolkDoneness`/`edgeStyle`/`internalTexture` params and
the new `FOLD` action (`egg_cracked.json`'s `isFoldable`) exist because the
previous vocabulary could only express ONE flat/set omelette, with no way to
represent the classical French technique or order a fried/poached egg by yolk
doneness — the actual most-common real-world order specification for either dish,
previously entirely unmodeled. OCR can represent both precisely now; it does not
and should not try to resolve which one a customer meant by the word "omelette"
— that's the LLM-intent layer's job (CONCEPT.md §14), not this schema's.

**Tortilla de patatas — originally blocked, checked and closed 2026-08-12.** The
two *components* were always makeable (fried potato via `PEEL`→`CUT`→`FRY`;
beaten salted egg via `CRACK`→`BEAT`→`SALT`); two specific, scoped gaps blocked
the dish itself, proven by a capability-test script trying and failing, not by
inspection:

1. ~~No verb combines two separate instances into one.~~ **Closed**: `COMBINE`
   (`data/actions/combine.json`) — `ActionOutputsSchema.combinesInto` +
   `ActionSchema.requiredSecondaryCapability` (`action.ts`), `applyAction`'s
   `secondaryInstance` param and `ExecutionResult.secondaryDestroyed`
   (`engine.ts`), `RecipeStepSchema.secondaryInstanceId` (`recipe.ts`) — a
   genuinely new engine mechanism, not a data-only fix. Fried potato + beaten
   egg both consumed; one new `tortilla_mixture` instance spawned in their
   place (`EntitySchema.structure.composite/components` finally populated —
   `["potato", "egg"]` — after existing unused since the first draft). Scoped
   deliberately narrow (this one specific pairing, fixed on one action
   definition), not a generic pair→result lookup system — see
   `combine.json`'s `scopeNote` for why that bigger design question is still
   open, not resolved here.
2. ~~No `FLIP` verb.~~ **Closed**: `FLIP` (`data/actions/flip.json`) —
   `addsTag: "flipped"`, mirroring `SALT`'s precedent rather than inventing a
   new state. Deliberately tool-agnostic (`pan` only) since a fried egg
   (spatula) and a whole tortilla (inverted onto a plate) flip by different
   physical motions for the same outcome — see `flip.json`'s
   `toolAndTechniqueGap` for what that leaves unmodeled.

Full run: `npm run recipe -- tortilla_de_patatas` (also `npm run
capability-test:tortilla` for the narrower step-by-step vocabulary check).
Neither fix touches robot control/perception (`ENGINE_INVARIANTS.md` #11 stays
separately true) — the vocabulary gap is closed; the physical-execution gap
was never this phase's job.


## Common culinary knowledge coverage

**Split out to [`ROADMAP_KNOWLEDGE.md`](ROADMAP_KNOWLEDGE.md) 2026-08-17**
once this section alone passed 1,673 of this file's then-3,221 lines — the
same size-driven split `LEARNINGS.md` got on 2026-08-15. Content moved
verbatim (checked, not rewritten). That file is the closed/open ledger of
real-world cooking-domain coverage started 2026-08-13 in response to "get
all the common knowledge for cooking reflected in system and schemas" —
ingredients, technique verbs, HACCP facts, and every epic that grew out of
answering it (heat-as-a-place, DAG execution, baking, SEASON, ...). Read it
before assuming an ingredient/technique gap is unclosed; this file (the
capability-tests table above, and the structured Phase 0-10 breakdown
below) is the rest of the roadmap.


## Phase 0 — Project scaffolding
- [x] `package.json` + TypeScript toolchain — `tsx`, `tsc -p .`
- [x] Zod, confirmed as the schema/validation library
- [x] Test runner / unit tests — closed 2026-08-13. `node:test` (built into
      Node, no new dependency) + `tsx` as the loader (`npm test` →
      `node --import tsx --test tests/*.test.ts`), 44 assertions across
      `tests/{engine,action,thermal,ingredient}.test.ts` covering
      `applyAction`'s preconditions/outputs/conservation-of-mass/HACCP-CCP
      branches and the three schemas' `.refine()`s. `tests/` added to
      `tsconfig.json`'s `include` so `tsc --noEmit` typechecks it too.
      `scripts/validate.ts` (schema + cross-reference checks over the real
      `data/*.json`) and the demo/recipe scripts remain the complementary
      integration layer — this closes the *unit*-test gap specifically, not
      a replacement for either.
- [x] **`npm run build` actually builds — closed 2026-08-14.** A pasted
      external bug report (`bugs_and_improvements.md`, not committed —
      triaged, not archived) correctly identified `tsc -p .` as genuinely
      broken (81 real `TS5097` errors, confirmed by actually running it, not
      trusting the report), beyond the "pre-existing noise, filter with
      `grep -v TS5097`" workaround this file used to document. Root cause
      was real but the report's own suggested one-line fix
      (`allowImportingTsExtensions: true` alone) doesn't work — TypeScript
      requires `noEmit` (or `emitDeclarationOnly`) alongside it (`TS5096`),
      verified by actually trying the report's fix before adopting it.
      Since every script in this repo already runs via `tsx` (which
      type-strips at runtime, never consumes `tsc`'s `dist/` output) and
      nothing imports from `dist/` anywhere, `noEmit: true` is the honest
      fix, not a compromise: `npm run build` becomes a real, zero-error
      typecheck gate (what it was already being used for via `--noEmit` +
      manual `grep` filtering), and the `TS5097` noise this file used to
      tell readers to filter is gone entirely — nothing to filter anymore.
      `outDir` removed from `tsconfig.json` as dead config now that nothing
      emits there.
- [x] **Silent unknown-ingredient-instance-id bug — closed 2026-08-14.**
      Same bug report caught a real inconsistency in
      `recipe-runner.ts`: `targetInstanceId`/`secondaryInstanceId` already
      fail loudly (an `errors` entry, step skipped) when a step references
      an instance id that doesn't exist, but `availableIngredientInstanceIds`
      silently filtered out unresolvable ids instead of erroring — a
      typo'd/stale id could either be masked entirely (if another listed
      instance happened to also satisfy `requiredIngredientCapabilities`) or
      surface only as a generic "no qualifying ingredient on hand" error
      that never named the actual typo. Fixed to match the loud-failure
      convention its own sibling checks already use, three doors down in
      the same function. Verified this wasn't just a hypothetical: reran
      every recipe after the fix (`npm run recipe -- <id>`, all 12) and
      confirmed zero latent bugs were hiding behind it — the fix is
      non-breaking, not just theoretically safer. New
      `tests/recipe-runner.test.ts` (this module had zero unit coverage
      before — a real, separate gap the bug report also named but only this
      one fix's tests actually close, not a full audit of the module).
- [x] **`validate.ts` now actually simulates every recipe end-to-end —
      closed 2026-08-14.** The same bug report named this as a real gap
      (`validate.ts` could only statically check ids against
      `initialInventory`, and its own code comment already admitted a step
      targeting a runtime-spawned instance id "can't be verified statically
      here without simulating the whole run"). Closed for real, not worked
      around further: `validate.ts` now calls `recipe-runner.ts`'s
      `runRecipe` on every loaded recipe and fails (not just NOTEs) on any
      step error — replacing the old "assumed to be a spawned instance, not
      checked further" hand-wave with an actual pass/fail. Directly serves
      this file's own "run every recipe after any change to `src/`"
      mandate too — one command instead of a manual per-recipe loop.
      **One claim in the bug report checked and found WRONG, worth naming
      so this file doesn't repeat it**: it listed `src/query.ts` as
      apparently-dead code. It isn't — `scripts/ask.ts` (`npm run ask`)
      imports and uses it. Verified by grep before trusting the claim,
      not after — the same discipline applied to every other item in that
      report, which is why two of its suggested "fixes" got corrected
      rather than applied as-written.
- [x] **Lint/format config — closed 2026-08-16.** `oxlint` (linting) +
      `prettier` (formatting), both explicitly named as options in this
      entry's own original text — picked over ESLint's flat-config +
      typescript-eslint plugin setup specifically for the same
      minimal-dependency ethos this repo's `package.json` already had
      (3 devDependencies before this change: `@types/node`, `tsx`,
      `typescript`). `npm run lint`/`format`/`format:check` all added.
      `oxlint` found 5 real, small, genuine issues on the first run
      (unused imports/variables in `flavor-balance.ts`, `scripts/boil-
      egg-by-physics.ts`, `scripts/simmer-vs-boil.ts`, `scripts/
      validate.ts`, `scripts/egg-salad-prep.ts`) — each fixed properly,
      not suppressed: `flavor-balance.ts`'s `DILUTION_CITATION` was
      genuinely dead code because it was never `export`ed, unlike every
      other citation constant in this repo (`WILLIAMS_FORMULA_CITATION`,
      `YOLK_TARGET_TEMP_CITATION`, etc.) — exporting it was the real fix,
      not deleting it. `scripts/validate.ts`'s unused `knownInstanceIds`
      turned out to be leftover from an earlier static check the file's
      own adjacent comment already says was deliberately superseded by
      the real `runRecipe` simulation — safe to delete, confirmed by
      reading the surrounding code, not assumed. `.prettierignore`
      deliberately EXCLUDES `data/*.json` — reformatting 95 hand-authored
      data files with prettier's own JSON opinions would be a large,
      low-value diff unrelated to code quality, disrupting a deliberate,
      stable authoring convention this repo already has; prettier is
      scoped to `src`/`scripts`/`tests` only. Ran `prettier --write`
      across all 86 flagged `.ts` files after confirming (via a real,
      inspected diff on one file first) the changes are purely cosmetic
      (quote-style normalization, line-wrapping) with zero semantic
      risk — verified with the full suite immediately after (`npm test`
      260/260, `tsc` clean, `npm run validate` 95/95, every `demo:*`/
      `capability-test:*` script), not assumed safe from the diff alone.
- [x] `CLAUDE.md`'s "Repository state" — kept current as of this rewrite;
      see `CLAUDE.md`'s own instruction to update it *in the same change*
      that makes it stale, not later.

## Phase 1 — Core entity & ingestion models (`src/ingredient.ts`)
- [x] `EntitySchema` — ingredients vs. tools, capabilities, states, tags,
      `byproductsByAction`, `criticalControlPointsByAction` (both added
      beyond the original spec, out of necessity — see `LEARNINGS_ENGINE.md`
      2026-08-12).
- [x] `RecipeIngredientSchema` — closed 2026-08-13 as `QuantitySchema`
      (`src/ingredient.ts`) + `RecipeInstanceSchema.quantity` (`recipe.ts`),
      optional. A discriminated 3-kind union (`"precise"` amount+unit,
      `"imprecise"` a real culinary descriptor like "pinch"/"to_taste" with
      an optional non-authoritative gram range, `"relative"` a ratio
      against another entity in the same recipe, e.g. baker's-percentage
      salt) rather than one fraction/decimal field — a plain number would
      have misrepresented the ones that genuinely aren't reducible to one
      (see the schema's own doc comment for why). `scripts/validate.ts`
      cross-checks `"relative"`'s `ofEntityId` against the recipe's own
      `initialInventory`. Localized unit NAMES (e.g. "cucharadita" for tsp)
      deliberately not built — no other numeric-unit field in this repo
      localizes its unit string either, and nothing has asked for it yet.
      Still NOT wired into engine.ts/recipe-runner.ts execution — ingredients
      remain un-consumed/undecremented (Phase 4's own documented limit);
      this only lets a quantity be RECORDED, not enforced or scaled against.
- [ ] `ParsedIngredientSchema` — staging shape for raw scraper output. Not
      built (blocked on Phase 7 anyway).

## Phase 2 — Execution & safety models
No single `recipe-step.ts` — fragmented across three files as the engine grew
(see `CLAUDE.md`'s module-layout table for the full mapping).
- [ ] `EntityStateSchema` as originally specified — `engine.ts`'s `Instance`
      (`entityId`/`state`/`tags`) covers the same ground informally, not as
      a named, exported schema.
- [x] `CriticalControlPointSchema` — `src/thermal.ts`. °C not °F (spec says
      Fahrenheit; kept Celsius for consistency with the rest of the
      codebase). Two-point instantaneous/held model, not the FDA Food
      Code's full multi-point curve. Data: `data/ccps/egg_cooking.json`.
- [x] `MechanicalActionSchema` as originally specified — `src/action.ts`'s
      `ActionSchema`/`ActionOutputsSchema` covers this: tools, target
      capability, required ingredient capabilities, parameters (closed-enum
      **and**, since this session, continuous `numericRange` — duration,
      temperature), outputs (state change, tag, byproducts, destruction).

## Phase 3 — Compiled recipe container (`src/recipe.ts`)
- [x] `RecipeScriptSchema` — initial inventory + linear `sequence`. Built
      close to the original plan.
- [x] `src/recipe-runner.ts` (not in the original plan) — walks a
      `RecipeScript` against `engine.ts`, collects errors/warnings without
      halting on the first failure, handles `destroyed` instances and
      spawned byproducts.
- [x] **"Refactor Recipe Execution Model to a DAG" ticket — closed
      2026-08-17, deliberately SCOPED, not built as literally specified.**
      A user-supplied ticket asked for a full transition from a linear
      array to a graph model with genuine parallel execution ("spin up
      parallel threads"). Checked against this engine's own stated
      invariant before building anything: `ENGINE_INVARIANTS.md` #9
      requires determinism, and `recipe-runner.ts`'s `runRecipe` mutates
      ONE shared inventory `Map` (plus `PlaceState`s, tool-contamination
      state) step by step — genuine concurrent mutation of that shared
      state is exactly the nondeterminism-risk class #9 exists to rule
      out, not a gap to fill. "Parallel threads" is therefore interpreted
      as computing what a concurrent SCHEDULE would be, deterministically,
      as read-only information — not literal OS/JS-runtime concurrency —
      named explicitly rather than silently reinterpreted.
      \
      **What's real:** `RecipeStepSchema` (`recipe.ts`) gained optional
      `id`/`dependsOn: string[]` fields — fully backward compatible, every
      one of the 22 real recipes existing before this change has neither.
      New `src/dag-scheduler.ts`: `resolveStepId`/`deriveDependsOn`
      (auto-derives sequential edges for any step without an explicit
      `dependsOn` — the exact mechanism that satisfies "existing linear
      imports auto-generate sequential dependsOn edges," since every
      existing recipe already IS this kind of flat, linear import; no
      Cooklang parser exists yet to import FROM, per `CLAUDE.md`'s own
      module table, so this is proven against real recipe data directly
      rather than a hypothetical Cooklang fixture), `topologicalOrder`
      (Kahn's algorithm — a valid execution order, or the exact cycle,
      never both), and `scheduleDag`/`scheduleDagFromSteps` (a real,
      honest GREEDY list-scheduling heuristic over one shared "active"
      actor resource plus unlimited "passive" capacity — NOT claimed
      provably optimal; true resource-constrained scheduling with
      precedence is NP-hard in general, named as such rather than
      overclaimed). New `action.ts` field `requiresActiveAttention`
      (ACTIVE — needs a chef/actor's ongoing hands, e.g. FRY/CARAMELIZE/
      WHISK/EMULSIFY — vs. PASSIVE — runs itself once started, e.g.
      BOIL/SIMMER/BAKE/ROAST/MARINATE/REST), populated across all 26
      `continuous` actions with real, reasoned technique judgment (not a
      citation-worthy fact — `LEARNINGS_ENGINE.md` 2026-08-17), same
      "flag unaudited, don't fail" NOTE-level check added to
      `scripts/validate.ts` as `actionKind`/`maxDurationSeconds` already
      have. `recipe-runner.ts`'s `runRecipe` now executes steps in real
      TOPOLOGICAL order (not raw array order) — still single-pass, still
      deterministic, still one mutation at a time, but genuinely
      dependency-aware; a cyclic recipe is caught and the run stops before
      touching inventory, rather than executing in an undefined order.
      Genuinely behavior-preserving: `deriveDependsOn`'s auto-sequential
      fallback reproduces every existing recipe's original array order
      exactly, proven by `npm run validate` re-simulating all 22 real
      recipes identically (zero regressions) — not asserted, checked.
      \
      Acceptance criteria: cycle detection proven both on every real
      recipe (0 found, correctly) and a synthetic in-memory cyclic case
      (correctly rejected) — `topologicalOrder`'s own return type makes
      "cycle" and "valid order" mutually exclusive, and since `runRecipe`
      now calls it internally, `scripts/validate.ts`'s existing
      hard-fail-on-any-step-error behavior ALREADY catches a cyclic real
      recipe with zero new validate.ts code, not a separately maintained
      check. The exact "10 minutes, not 15" numeric scenario is proven in
      `tests/dag-execution.test.ts` (the ticket's own named filename, 20
      new unit tests, synthetic fixtures) — passive BOIL (600s) concurrent
      with active CHOP (300s) schedules to exactly 600s, not 900s; two
      ACTIVE tasks correctly serialize (cannot overlap, one shared actor);
      two PASSIVE tasks correctly overlap fully (unlimited capacity); a
      join node ("toss pasta in sauce") correctly waits for the LATER of
      two dependencies, not the first. Real-data proof (not just synthetic)
      via `scripts/dag-schedule-as-a-robot.ts`
      (`npm run capability-test:dag-schedule`):
      `data/recipes/garlic-oil-potatoes.json` retrofitted with explicit
      `id`/`dependsOn` (its own new `dagNote`) — a genuine independent
      potato-prep/garlic-prep branch pair AND a real join node
      (`fry_potato` depends on BOTH `cut_potato` and `infuse_oil`,
      confirmed to start at the LATER finish time); a real cited-duration
      demo (BOIL potato 1200s passive, `mashed-potatoes.json`'s own
      figure, concurrent with CARAMELIZE onion 900s active,
      `caramelize.json`'s own `numericRange.min`) computes 1200s total
      vs. 2100s linear — 900s (15 minutes) real savings.
      \
      **Deliberately NOT done, named rather than silently scoped out:**
      `recipe-runner.ts` does not execute steps concurrently — inventory
      mutation stays single-threaded and sequential, by design (see
      above); no multi-actor/multi-robot modeling exists (one shared
      "active" resource, not N); `steps` was NOT migrated from an array to
      an "indexed dictionary or graph node list" as the ticket's own task
      2 literally specified — a `RecipeStep[]` array with optional
      `id`/`dependsOn` fields is already fully graph-addressable (any step
      can be referenced by a stable id regardless of array position),
      making a representational rewrite of all 22 real recipe files +
      every consumer of `RecipeScript.sequence` pure churn for zero
      functional gain, a call made explicitly rather than followed
      blindly; `garlic-oil-potatoes.json`'s own real-world quality
      constraint (garlic left waiting in hot oil turns bitter) is NOT
      expressible by this DAG — it encodes causal/data dependency only,
      not a "must happen within N seconds of that" freshness constraint,
      a real, separate, unbuilt mechanism, named in that recipe's own
      `dagNote`. See `LEARNINGS_ENGINE.md` 2026-08-17 for the design
      reasoning, especially the determinism-vs-"parallel threads" call.
      **Extended the same day: tool-lock scheduling** — closes
      `dag-scheduler.ts`'s own top doc comment, which had explicitly named
      "unlimited passive capacity... a genuinely resource-constrained
      kitchen has a finite number of burners/pots too, not modeled" as a
      real, open gap the moment the module first shipped, and directly
      closes `WORLD_MODEL_OPTIMIZATION.md`'s named-but-unbuilt
      `toolLockBehavior` idea ("a tool held exclusively for a duration,
      e.g. can't fry two things in the same pan at once"). New
      `DagNode.requiredToolIds: string[]` (default `[]`, fully backward
      compatible) — `scheduleDag` now tracks per-tool exclusive occupancy
      alongside the existing shared-actor constraint, a genuinely
      DIFFERENT resource: a PASSIVE node (ROAST) still locks its oven for
      its whole duration even though it never touches the actor
      constraint at all. `scheduleDagFromSteps` derives `requiredToolIds`
      from the real, loaded `Action.requiredTools` — deliberately scoped
      to EXACT tool ids only, not `requiredToolCapabilities`
      (substitutable — e.g. BOIL/FRY/CARAMELIZE's own
      `isDeepVessel`/`isFryingVessel`), since which specific capability-
      satisfying tool a step actually occupies is genuinely ambiguous
      without real per-recipe tool-INSTANCE tracking this schema doesn't
      have (`RecipeScript.availableTools` is a flat list of tool TYPES,
      not individually addressable instances the way ingredients are) —
      named as a real, honest limit, not guessed at. Proven via 7 new
      unit tests (`tests/dag-execution.test.ts`, synthetic fixtures —
      including proof that empty `requiredToolIds` is a true no-op,
      zero regression for every node built before this field existed) and
      a real-data case D in `scripts/dag-schedule-as-a-robot.ts`: two
      genuinely independent, both-PASSIVE `ROAST` steps (potato, garlic —
      both real, already `isRoastable`) at `roast.json`'s own real cited
      3000s/50min duration (`crispy-roast-potatoes.json`) correctly
      serialize to 6000s/100min on the shared `oven`, not the 3000s/50min
      an unconstrained-passive model would have shown.

## Phase 4 — Validation engine
- [ ] `OcrValidationEngine` class as a named class — `engine.ts`'s
      `applyAction` is a plain function covering most of the same
      responsibility (capability/tool/state-prerequisite checks).
- [x] **`INVALID_TRANSITIONS` forbidden-state-transition matrix — closed
      2026-08-15, the repo's own named "single largest unbuilt piece of
      the original spec." Corrected the SAME day, same session, on direct
      user correction — see below.** `ingredient.ts`'s
      `EntitySchema.invalidTransitions` (state id -> the state ids this
      entity may never legally become from there) + `engine.ts`'s
      `applyAction` check against the action's actual COMPUTED next state
      (covers parameter-driven outputs like CUT's `shape` for free, not
      just fixed `transformedState` actions). Resolves this file's own
      long-open "Open dependencies" question — literal global matrix
      (`CLAUDE_DEV_CTX.md`'s own shape) vs. generalized from
      `statePrerequisites` — with **per-entity** keying: state vocabulary
      isn't portable across entities (same reasoning `statePrerequisites`
      already commits to), and a near-miss found during development (see
      correction below) is concrete evidence a global map is fragile in a
      way per-entity keying isn't.
      \
      **The correction, worth recording in full rather than quietly
      fixing**: the FIRST version of this closed item forbade potato from
      ever going `boiled -> peeled`, following `CLAUDE_DEV_CTX.md`'s own
      literal illustrative example ("cannot peel a potato that is already
      boiled") — a claim this repo had carried uncritically in
      `peel.json`'s metadata since its first commit, never actually
      checked against real technique, and reused here without checking it
      either. **It's factually wrong**: boil-in-jacket-then-peel is a
      real, common technique (the standard method for many potato salad
      recipes, and for jacket/new potatoes generally) — caught
      immediately on direct user correction, the same session, the moment
      the claim was finally enforced instead of just repeated in prose.
      Corrected by removing every "X forbids reverting to peeled" entry
      from `potato.json` rather than softening it. What survives, and is
      genuinely defensible: `mashed` forbids reverting to any intact-piece
      state (peeled/cut-shapes/boiled/par_fried/baked) — once puréed,
      there's no discrete skin or shape left for PEEL/CUT/GRATE/BOIL/BAKE
      to act on, a real structural fact, not a repeated-but-unverified
      claim. Deliberately still excludes `mashed -> fried` (the real
      potato-cake technique). `peel.json`'s own metadata, `potato.json`'s
      top-level `notes`, and this repo's `CLAUDE.md` (its "Physical
      feasibility restrictions" bullet used the exact same wrong example)
      were all corrected in the same change — see `LEARNINGS_PROCESS.md`
      2026-08-15 for the fuller "check real technique, don't just check
      the spec doc" lesson.
      \
      **`egg.json`/`egg_cracked.json` were not part of the original
      error, but were re-audited on request rather than assumed clean —
      one entry narrowed as a result.** Checked against the strongest
      real counter-technique that would matter here (a peeled hard-boiled
      egg shallow-fried before going into a sauce — Indian/Southeast
      Asian egg curry, the same move underlying Scotch eggs) and
      confirmed `peeled -> fried` is correctly NOT forbidden. One entry
      from the first draft — `sliced`/`diced`/`chopped` forbidding a
      reversion to `boiled` — was retracted anyway: it rested on "no
      counter-example found," the exact epistemic position that was wrong
      for potato, not a structural guarantee (unlike `fried`/`poached`
      forbidding `peeled`, which rests on a real structural fact — no
      shell is ever in play for either preparation, so there's nothing to
      peel). `egg_cracked.json`'s fried/scrambled-can't-revert-to-raw/
      beaten rule is unchanged — genuine protein-coagulation
      irreversibility, not a process-order assumption, the same category
      of claim as potato's own surviving `mashed` rule.
      \
      `scripts/validate.ts` gained a matching hard-fail check (a key or
      forbidden-state value not in the entity's own `possibleStates` —
      the same dead-reference standard `producedByproducts`/
      `byproductsByAction` already hold themselves to). Proven, not just
      typechecked, both before AND after the correction: all 165 unit
      tests pass (3, rewritten post-correction to use the mashed-potato
      case instead of the retracted boiled/peeled one), `npm run validate`
      still simulates all 12 real recipes end-to-end with zero step
      errors, and the full demo/capability-test sweep is unaffected —
      nothing here was ever relying on the incorrect rule, or on the
      corrected one. **Still honestly scoped, not overclaimed**: only 3 of
      this repo's ~15 ingredient entities have any `invalidTransitions`
      authored (the field defaults to `{}`, so this is additive, opt-in
      coverage, not a repo-wide audit) — garlic, oil, salt, water, and the
      alioli/tortilla composite entities have none yet, named here rather
      than implied covered.
- [x] Requirement checks before a step executes (tool/entity present,
      required state, required capabilities, parameter validity).
- [x] **CLI pre-flight recipe validator for an ARBITRARY recipe file — closed
      2026-08-15.** `src/recipe-explain.ts`'s `explainRecipe` +
      `scripts/validate-recipe.ts` (`npm run validate-recipe -- <path>`).
      Direct groundwork for a planned separate "recipe creator" frontend
      project that will submit new, externally-authored recipes against
      this repo's rules — this is that validation logic proven out on the
      command line first. Not a new engine mechanism: `runRecipe`/
      `applyAction` already enforce everything safety/correctness-relevant
      (tools, capabilities, state prerequisites, HACCP). What's new is
      framing that ground truth for a human/frontend BEFORE execution: a
      whole-sequence tools/ingredients needed-vs-declared-vs-missing
      summary (previously only surfaced as a runtime rejection on the
      first step that hit it), a timing-vs-doneness sanity check between
      `durationSeconds` and the `yolkDoneness`/`pieceSize` informational
      parameters against `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS`
      (advisory only — does not make either parameter enforced), and a
      heuristic wash-before-peel/cut prep advisory. That last one is
      deliberately named as a heuristic, not a hygiene mechanism — running
      it against every `data/recipes/*.json` found two real,
      previously-invisible gaps, both fixed the same day:
      `tortilla-de-patatas.json` and `tortilla-de-betanzos.json` both went
      straight to PEEL on a raw potato, skipping the WASH step every other
      potato recipe already includes (`salted-fried-potatoes.json`'s
      wash/peel/cut order). Both now start with WASH; all 12 canonical
      recipes report zero prep advisories. This does NOT close the
      "Common culinary knowledge coverage" section's larger, separately-
      scoped cross-contamination/hygiene gap below (danger to the FOOD
      from equipment/surface reuse) — that still needs a genuinely
      different mechanism, per that section's own note.
- [x] **`actionKind: "instantaneous" | "continuous"` — closed 2026-08-16,
      directly implementing TICKET 1 of a user-supplied paper read
      (`PAPER_NOTES_2608.04768.md`, analyzing Song, Huang, Sun, Tian, Wang
      & Li, arXiv:2608.04768 — see `REFERENCES.md`).** Names, in
      `action.ts`'s schema, a distinction this repo had already been
      working around unnamed: `place.ts`/`recipe-runner.ts`'s split
      between one-shot `applyAction` and the elapsed-time `HEAT_PLACE` tick
      loop (`ROADMAP.md`'s "Heat as a shared, time-varying property of a
      PLACE" entry, closed earlier the same day) IS this same distinction,
      arrived at independently from the simulation side; the paper
      reaches it from the hardware side (`Step(Pulse, Await(Enter))` vs.
      `Step(Continuous, Until(Condition)) with Timeout(...)`). All 32
      `data/actions/*.json` individually classified and audited (not
      pattern-matched) with a `metadata.actionKindNote` each — 9 actions
      resolved to `continuous` specifically because the paper's test
      (real, elapsed-time process with an observable termination) and the
      engine's test (does `applyAction` model elapsed time) genuinely
      DISAGREED, and the disagreement was recorded rather than smoothed
      over (`beat`, `mix`, `scramble`, `mash`, `crush`, `emulsify`,
      `dissolve`, `grate`, `shock` — full reasoning in
      `LEARNINGS_ENGINE.md` 2026-08-16). Changes ZERO engine behavior —
      `applyAction` still executes every action atomically regardless of
      this field; it's surfaced read-only in `recipe-explain.ts`'s
      pre-flight report (`npm run validate-recipe`) and cross-checked
      (soft `NOTE`, not a hard fail) in `scripts/validate.ts` against each
      action's own `verification.method` (every `manual_confirmation`
      action should be `instantaneous`, every `thermal` action should be
      `continuous` — held for all 32 with zero violations). The honest
      takeaway, not overstated: this field is a real, searchable INVENTORY
      of where this engine's one-shot model departs from physical reality
      (most of this vocabulary's mixing/mechanical verbs, now nameable),
      not a fix for any of them — `heat_place` remains the only action
      where `continuous` is already matched by real engine behavior.
- [x] **`maxDurationSeconds`/`src/execution-bounds.ts` — closed 2026-08-16,
      same day, TICKET 2 of the same paper read.** The paper's own generated
      control code pairs every continuous step's sensory termination
      condition with a hard timeout — `action.ts`'s new `maxDurationSeconds`
      is that ceiling, set on all 18 `continuous` actions (reused from each
      action's own already-cited `durationSeconds.numericRange.max` where
      one exists; an explicit HOUSE VALUE with a stated rationale where none
      does — `metadata.maxDurationSecondsNote` on each, per the ticket's own
      "do not copy the paper's numbers" acceptance criterion). New standalone
      module `src/execution-bounds.ts` (`executionBoundFor`, same
      standalone-before-engine-wiring precedent as `place.ts`/
      `heat-source.ts`) computes the REAL asymmetry this ticket names: a
      `minSafeHoldSeconds` floor read from this repo's existing CCP
      machinery (`thermal.ts`, `data/ccps/*.json`, including the real D/z
      `thermalModel` computation where one applies) that a plausible sensory
      "looks done" signal must NOT be allowed to override — `ENGINE_
      INVARIANTS.md` #11's control/perception gap, now with a concrete
      adversary. Proven via `scripts/reject-early-sensory-termination.ts`
      (`npm run capability-test:execution-bounds`), two real cases (`BOIL`
      on egg's flat 15s floor; `PASTEURIZE` on `egg_yolk`'s real D/z-computed
      floor), both showing a plausible early sensory reading correctly
      REJECTED with the CCP's own citation printed. Surfaced read-only in
      `recipe-explain.ts`'s `executionBounds` (`npm run validate-recipe`);
      `engine.ts`'s `applyAction` is completely unchanged, per the ticket's
      own acceptance criterion. One real, narrow exception, staying inside
      `recipe-runner.ts` not `engine.ts`: `HEAT_PLACE`'s own tick-loop
      timeout now reads `action.maxDurationSeconds` directly instead of an
      ad hoc tick-count constant — a concrete, already-real mechanism this
      field made more principled, not new engine surface.
      \
      **A real, independently-found gap fixed along the way, not left as a
      known limitation**: `recipe-explain.ts`'s pre-flight resolution had
      always been unable to identify a step's target entity when it named a
      SPAWNED instance (e.g. `PASTEURIZE` on `egg_yolk-3`) — silently
      skipped rather than reported, the exact case this ticket's own best
      demo needed most. Fixed by giving `recipe-runner.ts`'s
      `RecipeRunResult` a new `spawnedEntityIds` map (every instance ever
      spawned during a run, including ones later destroyed) that a caller
      who already ran `runRecipe` can pass into `explainRecipe` — real
      ground truth, not a second, parallel re-derivation of the spawn-id
      naming scheme. See `LEARNINGS_ENGINE.md` 2026-08-16 for the full
      reasoning on why the quick/wrong fix was rejected on sight.
- [x] **`REFERENCES.md` TICKET 6 additions — closed 2026-08-16.** The
      Song et al. (arXiv:2608.04768) citation itself updated to also cover
      TICKET 2/3's use; four more background-reading citations added
      under "Robotic / automated cooking systems" (Ma et al. 2011 — this
      repo's own "Why this exists" framing predates it by fifteen years;
      Yoneda et al. 2024's Statler and Mavrogiannis et al. 2024's
      Cook2LTL — closest prior work to this repo's actual shape; Sochacki
      et al. 2024's survey), named in `PAPER_NOTES_2608.04768.md` as
      required reading before TICKET 4 (reachability) specifically, not
      yet cited by any actual claim in `data/*.json`/`src/*.ts`. A
      fabricated cross-reference in the first draft of this change
      (a false claim that one of the four was "also independently the
      source cited elsewhere in this repo") was caught and removed before
      shipping — see `LEARNINGS_PROCESS.md` 2026-08-16.
- [x] **`burned`/`overcooked` failure states — closed 2026-08-16, TICKET 5
      of `PAPER_NOTES_2608.04768.md`.** `CONCEPT.md` §8 has listed `burned`/
      `overcooked` in this repo's state vocabulary since its very first
      draft; no entity ever implemented either — this engine could express
      every way a dish goes RIGHT and none of the ways it goes wrong.
      Added to `potato`/`egg`/`garlic`/`tortilla_mixture` (the ticket's own
      "at minimum" list) with real, per-entity `invalidTransitions`
      closures — audited individually, not global, matching the standard
      `606f056`/`7d497d4`/`3e2050a` already set (and its own acceptance
      criterion: "do not repeat the potato-peel mistake"). Deliberately
      NOT wired to any detection mechanism — no timer, no probability, no
      burn inference; that needs perception (`ENGINE_INVARIANTS.md` #11,
      out of scope). Reachable today only as an AUTHORED fact
      (`RecipeInstanceSchema.state` accepts any string) — a future
      perception layer is what would actually assert it in a deployed
      system, not this repo.
      \
      **A real physical nuance found and gotten right, not glossed over**:
      `burned` is unconditionally terminal for all four entities (forbids
      every other state, `isTerminalState` — new, `ingredient.ts`,
      computed from `invalidTransitions`/`possibleStates` directly, not a
      second hand-authored flag). `overcooked` is treated as terminal for
      RECOVERY purposes (forbids reverting to any normal state) but
      deliberately does NOT forbid degrading further into `burned` itself
      — a real, physically plausible progression — so
      `isTerminalState(entity, "overcooked")` correctly computes `false`,
      not `true`, for every entity. First draft's metadata notes claimed
      "overcooked is ALSO fully terminal," which the actual
      `invalidTransitions` data contradicted (it deliberately leaves
      `overcooked → burned` open) — caught by literally running
      `isTerminalState` against the real data during the capability-test
      script's own development, not asserted from memory, and corrected in
      all four entities' notes plus the script's own narration before
      shipping. A second honest, stated simplification: potato's real
      overcooked-then-mashed rescue technique (mashing a mushy over-boiled
      potato) is NOT wired through, because `mash.json`'s own
      `statePrerequisites` (`["boiled","baked"]`) doesn't list `overcooked`
      — named as a small, real, deliberately-not-done follow-up rather
      than silently asserting the rescue is impossible.
      \
      Garlic is the strongest real-world forcing case in this vocabulary —
      `ROADMAP.md` itself already named "burnt garlic tastes bad, don't
      let it rest in the oil" as a real mistake this repo's own frying
      sequencing had to work around, well before `burned` was a real,
      assertable state; it's a genuinely more clear-cut, faster failure
      for garlic than for potato/egg (small piece size, high sugar
      content). Proven via `scripts/failure-states-as-a-robot.ts`
      (`npm run capability-test:failure-states`): `isTerminalState`
      against real loaded data, `FRY` on a burned potato REJECTED by
      `invalidTransitions`, `SALT` on the SAME instance still succeeding
      (a tag-only action never trips a state-transition check — the
      identical state-vs-tag distinction this schema draws everywhere
      else, not a new gap), and `recipe-explain.ts`'s new pre-flight
      advisory flagging a recipe that starts an instance already in a
      terminal state. 21 new unit tests across `tests/ingredient.test.ts`
      and `tests/recipe-explain.test.ts`.
- [x] **`state` vs. `tags` modeling fix for `WASH` — closed 2026-08-15,
      found by a user correction, not self-discovered.** After the fix
      above, the user pointed out the wash/peel/cut order itself wasn't
      the only issue: `WASH`'s `outputs.transformedState: "washed"` meant
      washing then peeling silently OVERWROTE the fact a potato had ever
      been washed, since `state` (`engine.ts`'s own doc comment) holds
      exactly one mutually-exclusive value — "washed" was never actually
      a FORM the way "peeled"/"sliced"/"fried" are, it's an orthogonal,
      persistent fact, same category as "salted". Fixed by moving `WASH`
      to `outputs.addsTag: "washed"` (matching `SALT`/`PEPPER`'s existing
      pattern) and extending `engine.ts`'s `statePrerequisites` check to
      match a tag as well as a state — `potato.json`'s `cut`/`grate`:
      `["washed", "peeled"]` needed no changes to keep meaning what it
      always meant. Concretely enables what the user explicitly asked for:
      washing before AND after peeling in the same recipe, order-
      independent, `addsTag`'s existing duplicate guard making a repeat
      `WASH` a legal no-op rather than an error. Real, non-trivial blast
      radius, checked directly rather than assumed: only `potato.json`
      referenced `"washed"` as a state anywhere in `data/`; `tests/engine.
      test.ts` gained real coverage for both the tag-match path and the
      wash-survives-peel case; `scripts/complete-potato.ts` (which
      hand-constructed `state: "washed"` instances) and `recipe-explain.ts`'s
      prep-advisory heuristic (which checked `possibleStates` for
      `"washed"`) both updated to match — the latter now checks the
      `isWashable` capability instead, a strictly more correct check that
      no longer depends on how "washability" happens to be represented.
- [x] **Byproducts can need their own reuse precondition, not just inherit
      the parent's — closed 2026-08-15, same day, user-found.** Following
      up the fix above, the user named the case it didn't cover: peeling a
      dirty potato BEFORE washing it produces a dirty peel byproduct, and
      washing the potato's flesh afterward can't retroactively clean it —
      it's already a separate spawned instance (conservation of mass).
      `potato_peel.json` had no `isWashable` capability and no
      `possibleTags` at all, so it could neither inherit `"washed"` from a
      pre-washed parent (via `engine.ts`'s existing 2026-08-12 byproduct-
      tag-inheritance) nor be washed directly — reusing an unwashed peel
      (fried into crisps, blended) had no safety check whatsoever. Fixed
      by adding `isWashable`/`possibleTags: ["washed"]`/
      `statePrerequisites: { fry: "washed", mix: "washed" }` to
      `potato_peel.json` — composing entirely with mechanisms that already
      existed (byproduct tag inheritance + the state-or-tag prerequisite
      match from the fix directly above), not a new kind of check.
      `scripts/reuse-potato-peel.ts` now proves both real cases side by
      side (inherited-clean vs. spawned-dirty-needs-its-own-wash); two new
      `tests/engine.test.ts` regressions lock in the behavior from
      synthetic fixtures. Deliberately NOT a general answer to this
      section's "Cross-contamination / hygiene knowledge" gap below
      (equipment/surface reuse) — narrower: one spawned instance needing
      its own already-expressible precondition satisfied before reuse.
- [x] Conservation of mass/entities — `ActionOutputsSchema.destroysTarget` +
      `ExecutionResult.destroyed`, consumed by `recipe-runner.ts`. Scoped to
      this explicit per-action opt-in, not a general inventory-quantity
      decrement system.
- [x] HACCP CCP enforcement — `criticalControlPointsByAction` +
      `applyAction`'s `ccps` param. `durationSeconds` below a CCP's
      `heldSeconds` throws, or warns if `advisoryOnly`. Demo:
      `npm run demo:egg-haccp`.
- [x] **Autonomous/robot execution safety policy** (not in the original
      spec — added directly in response to "we are building a system that
      robots will use," `ENGINE_INVARIANTS.md` #11) — `engine.ts`'s
      `SafetyPolicy`: under `mode: "autonomous"`, an `advisoryOnly` CCP
      shortfall that would merely warn under human execution instead hard-
      rejects unless a human explicitly pre-authorized that specific CCP id.
      Explicitly scoped: this closes the HACCP-timing gap for autonomous
      execution, it does **not** make the rest of the engine robot-ready —
      see the next item.
- [x] **Multi-instance composition (`COMBINE` mechanism).** Closed
      2026-08-12 — see the capability-test section above for the full
      mechanism (`combinesInto`, `requiredSecondaryCapability`,
      `secondaryInstance`, `secondaryDestroyed`). `EntitySchema.structure.
      composite/components` is now populated for the first time
      (`tortilla_mixture.json`: `["potato", "egg"]`). Deliberately scoped to
      one fixed pairing per action definition, not a generic pair→result
      lookup — reusing fried garlic in a salad (`garlic-oil-potatoes.json`)
      is now mechanically possible the same way, but still needs its own
      action definition (a `salad` entity + the base ingredients it'd need,
      e.g. lettuce, don't exist yet) — not built speculatively here.
- [x] **Compound/named physical-manipulation actions beyond FRY/CUT/etc.**
      `FLIP` closed 2026-08-12 (`data/actions/flip.json`) — the
      proven-necessary case. Likely siblings (transferring a hot pan,
      plating, folding) remain unbuilt on purpose: the working method is
      "attempt a real dish, watch it fail, name the missing verb precisely"
      (`attempt-tortilla.ts` → `combine.json`/`flip.json` is the worked
      example), not pre-building speculatively. Next candidate dish should
      drive whatever's added next.
      **Named more precisely 2026-08-15, from a user-supplied Reddit
      thread's real-world pattern (`olddocs/reddit-thread-1mo4tj8.md`,
      triaged then moved — see "Far more staple ingredients/entities"
      above for the same thread's other finding)**: "plating" isn't
      actually a sibling of `FLIP` in the way this entry originally
      assumed. Multiple independent commenters described "component
      cooking" / "3 things on a plate" (cook a protein, a starch, a
      vegetable separately; serve together) as the actual default mental
      model non-recipe cooks use — and this repo's `COMBINE` mechanism
      (closed 2026-08-12) is structurally the wrong shape for it:
      `combinesInto` fuses exactly two instances into ONE new substance
      (fried potato + beaten egg → `tortilla_mixture`), a real mass-
      conservation transformation. Serving three independently-finished,
      unmerged instances on one plate is a different, softer composition
      primitive — nothing destroys or transforms, nothing new is spawned,
      the three instances just become "done and co-located." Still
      correctly unbuilt (no forcing recipe has needed it yet, per this
      entry's own stated discipline), but now named as its own real gap
      rather than conflated with `FLIP`'s class of thing.
- [x] Unit tests per HACCP threshold — closed 2026-08-13 alongside Phase 0's
      test-runner gap; see `tests/engine.test.ts`'s "HACCP / CCP enforcement"
      suite (gating on `durationSeconds` presence, advisory-vs-hard-reject,
      `SafetyPolicy` human/autonomous/override branches, the `thermalModel`
      D/z-value path, the NaN-fails-closed guard).
- [x] **Seasoning verbs beyond SALT** — `PEPPER`/`CHILI` closed 2026-08-13
      (`data/actions/pepper.json`, `chili.json`; `data/entities/black_pepper.
      json`, `chili_flakes.json`), same shape as `SALT` (fixed `addsTag`,
      shared `timing` parameter), deliberately NOT generalized into one
      parameter-driven `SEASON` verb — see "Common culinary knowledge
      coverage" below for why, and what a real generalization would need.
      Proven end-to-end, including that `SALT` correctly rejects pepper as a
      substitute (`isSaltySeasoning` vs. the generic `isSeasoning` — a real
      precision gap the second seasoning entity would have silently opened),
      by `npm run capability-test:season-potato`.
- [x] **Capability-based tool substitution (`requiredToolCapabilities`)** —
      closed 2026-08-14, in direct response to a real question: "the robot
      has no pot, only a pan — will BOIL still work?" It didn't, and not for
      a real physical reason — `requiredTools` (`action.ts`) only ever
      matched by exact tool id, the one part of `applyAction`'s precondition
      checks with no capability-based option (unlike
      `requiredTargetCapability`/`requiredIngredientCapabilities`), so
      `boil.json`/`simmer.json`/`pasteurize.json` all hardcoded
      `requiredTools: ["pot"]` even though the real requirement is "some
      vessel deep enough to submerge the food," not that one specific
      entity id. Fixed generically, not as a pot/pan special case: a new
      `requiredToolCapabilities` field (`engine.ts`'s `applyAction`, same
      "any available X asserting this capability satisfies it" logic
      `requiredIngredientCapabilities` already used), a new `isDeepVessel`
      capability on `pot.json` and a genuinely new tool entity
      (`saucepan.json`) to prove real substitution rather than just a
      renamed special case, and `pan.json` deliberately left WITHOUT the
      capability (a real frying pan can't hold enough water depth — see its
      own `noIsDeepVesselNote`). Applied consistently to all three verbs
      that had the identical "pot"-only gap (`BOIL`/`SIMMER`/`PASTEURIZE`),
      not just the one asked about — `FRY`/`PAR_FRY`/`POACH`'s `pan`
      requirement deliberately left untouched AT THE TIME (a genuinely
      different physical property, not the same bug).
      **`FRY`/`PAR_FRY` given the identical fix 2026-08-14** ("extend FRY
      with everything learned from BOIL"), once actually building the
      request confirmed the SAME id-vs-capability mismatch was real there
      too: a new `isFryingVessel` capability (`pan.json`, and a genuinely
      new `wok.json` proving real substitution the same way `saucepan.json`
      did for `isDeepVessel`) — `pot.json` deliberately still doesn't get
      it (a tall, narrow pot has poor surface-area-to-volume for shallow
      frying even though it could physically hold the oil — the roles
      reversed from the `isDeepVessel` case, where `pot` qualified and
      `pan` didn't; here it's `pan`/`wok` that qualify and `pot` that
      doesn't). `POACH`'s
      `pan` requirement remained untouched at the time — no forcing case yet.
      Proven via
      `npm run capability-test:fry-any-vessel`
      (`scripts/fry-with-any-vessel.ts`). `scripts/validate.ts` gained a
      matching dead-capability check (a `requiredToolCapabilities` entry no
      tool entity ever asserts would make an action permanently
      unexecutable — hard fail, mirroring `requiredTools`' own unknown-id
      check) so this new mechanism can't quietly reopen the exact class of
      gap the prior session's verb audit went looking for by hand. Proven
      via `tests/engine.test.ts` (synthetic fixtures) and `npm run
      capability-test:boil-any-vessel` (`scripts/boil-with-any-deep-
      vessel.ts` — real data, all three cases: pan correctly still rejected,
      pot works, saucepan — an id `boil.json` never mentions — also works).
      **`POACH` closed 2026-08-17**, the last verb still holding an exact-id
      `requiredTools` check. Unlike BOIL (`isDeepVessel` only) or FRY
      (`isFryingVessel` only), a direct check (`WebSearch`/`WebFetch`, not
      assumed) found `poach.json`'s own existing metadata claim — "poaching
      is standardly done in a wide shallow pan" — was a real overclaim: TWO
      genuinely different, both real, both-cited techniques exist in TWO
      different vessel shapes (Kolbeck, Food Republic 2024: a narrower,
      DEEPER pot/saucepan, 2-3in water, the classic single-egg vortex
      method; Farnsworth, The Stay at Home Chef 2024: a WIDE, shallower
      12in skillet/pan, 1.5-2in water, a no-vortex batch method —
      `REFERENCES.md`), not one standard vessel. That made the physically
      correct fix `requiredToolCapabilities: ["isVessel"]` — the SAME
      weaker, medium-agnostic capability `FILL`/`PLACE_IN`/`HEAT_PLACE`
      already use, since real technique genuinely supports all four of
      pot/pan/saucepan/wok, not just one capability's worth of them.
      `poach.json`'s prior "wide shallow pan" claim was corrected in place
      (`vesselCorrectionNote`), not just quietly widened — the same
      "check real technique, don't just check the existing note" discipline
      this repo applied to the boiled-potato-can't-be-peeled correction
      (2026-08-15). Deliberately NOT modeled as a new outcome parameter:
      the real, cited vessel-shape → egg-shape (teardrop vs. flatter)
      difference stays informational-only, same depth limit as every other
      unenforced technique fact here — this fix's scope is
      substitutability, not outcome prediction. Proven via
      `scripts/poach-with-any-vessel.ts` (`npm run
      capability-test:poach-any-vessel`) — all four vessels succeed, a bare
      knife (no vessel at all) still correctly rejected.
- [x] **Triage of a third external report (`scientific_review_report.md`,
      not committed — same treatment as the two prior reports), closed
      2026-08-14.** Mostly confirmed existing correctness (A/A+ grades
      throughout) rather than finding bugs — the genuinely actionable items
      were in its own "Areas Needing Verification" section, triaged
      individually:
      - **Altitude/pressure — closed for real** (`src/altitude.ts`,
        `atmosphericPressurePa`/`waterBoilingPointC`), named the "highest
        priority" gap in the report and, independently, `water.json`'s own
        citation note since this repo's first thermal-property entry. Real,
        computed physics (ICAO Standard Atmosphere barometric formula +
        water's own Antoine vapor-pressure equation), not a lookup table —
        same "the actual textbook formula, not a hand-picked anchor"
        standard `thermal.ts`'s D/z-value model already holds itself to.
        Composes with `place.ts`'s `advanceTempSeconds`/`isAtTargetTemp`
        with zero further changes (`scripts/boil-at-altitude.ts`) — a
        fourth real reuse proof for that generalization (water/boiling,
        oil/frying, potato, now altitude). Closes the REACH-boiling-
        temperature half only; `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS`'s
        hold-time ranges remain sea-level-only, named explicitly rather
        than implied fixed.
      - **A real, computed second method for egg-boiling time — closed
        2026-08-16** (`src/egg-heat-penetration.ts`), directly answering
        "check if there's any newer/other real math on this topic" against
        `EGG_BOIL_DONENESS`'s own EMPIRICAL table (sourced from consumer
        cooking guides, never independently computed). Implements Charles
        Williams' closed-form spherical-conduction formula (University of
        Exeter) — the whole-egg sibling of `heat-penetration.ts`'s
        plane-slab model — with the dimensional analysis checked by hand
        before implementing (plain SI units give seconds directly, no
        hidden conversion factor). Cross-checked against the empirical
        table for a real 55g "large" egg: `soft` converges INSIDE the
        empirical range (408s computed vs. 360-420s empirical); `medium`
        is a near-miss just under it (450s vs. 480-540s); `hard` diverges
        substantially (494s vs. 660-780s) — reported honestly as all
        three outcomes, not smoothed into one "it matches" claim (see that
        file's own doc comment for the stated hypothesis on the `hard`
        divergence). `YOLK_TARGET_TEMP_C`'s three targets are a REASONED
        INTERPRETATION combining a 2025 peer-reviewed yolk-denaturation
        figure (Di Lorenzo & Di Maio, `REFERENCES.md`) with the older
        Exeter page's own coagulation range — flagged as an interpretation,
        not presented as directly cited. `EGG_SIZE_GRAMS` (new, real gram
        values for small/medium/large/extra_large) required reconciling
        the EU's official grading bands against this repo's OWN
        pre-existing "large ~50-60g" assumption, named explicitly rather
        than silently picking one. Composes with `altitude.ts`'s
        `waterBoilingPointC` for a real altitude-adjusted egg-boiling time
        with zero changes to either file (`scripts/boil-egg-by-physics.ts`,
        `npm run capability-test:boil-egg-by-physics`). Deliberately does
        NOT implement the same paper's own full two-material numerical PDE
        + Arrhenius-kinetics model (a genuinely different, much larger
        class of physics than anything else in this repo attempts) —
        named as a real, separately-scoped possibility, not attempted.
      - **Egg size adjustment — closed** (`egg-doneness.ts`'s
        `EGG_SIZE_ADJUSTMENT_SECONDS`/`eggBoilDonenessRangeForSize`,
        `boil.json`/`simmer.json`'s new `eggSize` parameter) — a real, cited
        offset (~30s/size step, convergent consumer egg-timing guides)
        layered on top of the existing large-egg-only table, not a second
        competing one; `"large"` is an exact no-op, so every recipe
        authored before this parameter existed is unaffected.
      - **In-shell pasteurization citation — verified, threshold
        deliberately kept unchanged, per explicit sign-off asked for and
        given.** Found real, peer-reviewed backing (Bermúdez-Aguirre &
        Niemira, *Comprehensive Reviews in Food Science and Food Safety*,
        2023: "the standard pasteurization method for shell eggs is 57°C
        for 57.5 minutes") shorter than `egg_pasteurization_raw.json`'s
        existing 57°C/65min figure, plus a second peer-reviewed CFD study
        with bracketing figures shorter still — both corroborate that
        65min carries real safety margin, not that it's unsafely short.
        Surfaced as a real, safety-relevant decision rather than applied
        unilaterally: asked the repo owner whether to tighten the enforced
        `heldSeconds` to the peer-reviewed figure or keep the existing,
        more conservative one — answer was to KEEP 65min, so `heldSeconds`
        is unchanged; the citation is upgraded in place
        (`egg_pasteurization_raw.json`'s `metadata.
        independentVerificationNote`, `REFERENCES.md`) to record the real
        verification that happened, without silently tightening a food-
        safety threshold as a side effect of it. See `LEARNINGS_PROCESS.md`
        2026-08-14.
      - **Cold-start integration, carryover-cooking quantification,
        turbulence quantification — correctly identified by the report
        itself as real, larger, deferred work** ("would need temperature-
        curve integration," "CFD or empirical correlation"), matching this
        file's own existing stance on all three (`egg-doneness.ts`'s cold-
        start gap, `shock.json`'s unquantified carryover note,
        `simmer.json`'s unquantified turbulence note) — confirmed as still
        correctly out of scope, not newly attempted.
- [x] **Unit tests per forbidden-transition rule — closed 2026-08-17.** Was
      genuinely blocked (as this entry originally said) on `INVALID_
      TRANSITIONS` not existing at all; that cleared 2026-08-15
      (`Entity.invalidTransitions`, per-entity) and was substantially
      audited 2026-08-15/16, but nothing had ever run those specific real,
      shipped rules against the real engine — this entry itself just never
      got revisited once its own blocker cleared. Deliberately NOT added
      to `tests/*.test.ts` (`CLAUDE.md`'s own stated split: the unit suite
      stays independent of `data/*.json`, complementary to `npm run
      validate`, `LEARNINGS_ENGINE.md` 2026-08-13) — instead
      `scripts/invalid-transitions-as-a-robot.ts` (`npm run
      capability-test:invalid-transitions`), the same shape as
      `failure-states-as-a-robot.ts` (which already covers burned/
      overcooked and wasn't duplicated here). Walks every real
      `fromState`/`toState` pair in potato/egg/egg_cracked/onion's shipped
      `invalidTransitions` maps against the real loaded engine — 42
      real rules, 42/42 passing on first run.
      \
      **A real, honest finding surfaced while building this, not smoothed
      over**: egg's own `peel.json` prerequisite
      (`statePrerequisites.peel: "boiled"`, a single required state) means
      PEEL can only ever fire from state `"boiled"` in the first place —
      so egg's `sliced`/`diced`/`chopped`/`fried`/`poached` entries
      forbidding a reversion to `"peeled"` are structurally REDUNDANT: the
      earlier statePrerequisites check already blocks it, for a different,
      stricter reason, before `invalidTransitions` is ever consulted. Not a
      bug (defense in depth is harmless) but a real, now-provable
      difference from potato's OWN reversion-to-peeled entries, where PEEL
      has no statePrerequisites at all and `invalidTransitions` is the
      ONLY thing enforcing it — the script reports which mechanism
      actually fired for each check, rather than treating "REJECTED" as
      one undifferentiated outcome. Also named, not silently skipped:
      `egg_cracked`'s `fried`/`scrambled` forbidding a reversion to `"raw"`
      is a genuinely DEAD entry — no action in this vocabulary ever
      produces `"raw"` as an output, so that rule can never fire via any
      real action call at all.
- [ ] **Real closed-loop control/perception layer for autonomous execution.**
      Explicitly out of scope for this repo as it stands — `engine.ts`'s own
      doc comment and `ENGINE_INVARIANTS.md` #11 are direct about this:
      every categorical parameter (`heatLevel`, `doneness`, `oilAdditionRate`,
      `curdSize`, `waterTempC`, `agitation`) is a human-readable technique
      hint, not a calibrated actuator command. `SafetyPolicy` governs what
      happens to a *stated* safety shortfall; it does not give the engine a
      way to *sense* temperature, doneness, or a person's hand near a knife.
      This is a large, separate body of work (sensing, motor control,
      calibration per physical rig) that a schema/validation repo like this
      one cannot substitute for — flagged clearly rather than implied away.

## Phase 4.5 — Goal-directed planning (`WORLD_MODEL.md`, new, 2026-08-12)
Resolves `CONCEPT.md`'s long-flagged fork (see that file's updated top note and
§12): the world is primary, a recipe is one layer of intent on top of it. Not
started — a real proposal, scoped honestly as substantial separate work, not
implied to be a small addition.

See also: `architecture_phase4_ticket.md` (2026-08-14) — a detailed milestone
breakdown (planner.ts/goal.ts/domain-model.ts/domain-facts.ts/robot-executor.ts,
M1-M5, acceptance criteria, risk table) elaborating this exact section. Despite
its filename, it is NOT a separate "Phase 4" — it's this Phase 4.5, written up
in ticket form; reviewed for accuracy against the code 2026-08-15.

**External validation, not new scope, added 2026-08-15** (same Reddit
thread as "Far more staple ingredients/entities" and "Compound/named
physical-manipulation actions" above — `olddocs/reddit-thread-1mo4tj8.md`):
two independent real-world confirmations that this phase's shape is the
right one, worth recording alongside it rather than re-deriving later.
(1) One commenter's whole reply is, unprompted, a parametrized recipe
template — "season+sauté a protein → sauté aromatics → deglaze → reduce
with fat = sauce," then explicitly: swap the protein/liquid/fat and the
SAME four steps produce chicken parmesan, a pork chop in cream gravy, or
a red-wine steak reduction. That's a slot-filling template over this
repo's own action-precondition/effect graph, described independently by
someone with no knowledge of this repo — real evidence a template layer
over `RecipeScript` (not a from-scratch design) is the natural shape for
`RecipeIntentSchema`, not just this repo's own preference. (2) A second
commenter's husband coordinated a multi-course meal by hand-building a
timing spreadsheet so every dish finished together — a real, concrete
forcing case for the closed-loop scheduling half of this phase, and for
`Instance.inProgressAction` (the design note already logged under
"Common culinary knowledge coverage"'s "Heat as a shared, time-varying
property of a PLACE" entry) specifically. Neither changes this phase's
scope or its "not started" status — recorded because a real, independent
source landing on the same shape is worth more than an internal design
doc alone, the same standard this repo already holds itself to for
domain facts.
- [x] **`RecipeIntentSchema` — closed 2026-08-17, alongside the planner
      itself.** `recipe.ts`'s `RecipeIntentSchema`/`InstanceGoalSchema` —
      exactly this entry's own framing: goals (state/`requiredTags`, or a
      `combine` sub-goal) replacing hand-authored `RecipeScript` as the
      authoring format; `RecipeScriptSchema` itself unchanged, now the
      planner's grounded OUTPUT. See the full closure below.
- [x] **An actual planner — closed 2026-08-17, `src/planner.ts`, direct
      response to "close the gaps" naming all five sub-items below by
      name.** Builds entirely on top of `isGoalReachable`
      (2026-08-16, unchanged except one pure, behavior-preserving
      refactor — see below) rather than replacing it. `engine.ts`'s
      `applyAction` is untouched by every piece of this.
      1. **Path -> `RecipeScript` conversion** — `stepsToRecipeSteps`
         turns a `ReachabilityStep[]` into real `RecipeStep[]`, resolving
         `requiredIngredientCapabilities` against a real instance pool and
         filling any required-but-not-state-determining parameter
         (`pasteurize.json`'s `waterTempC`/`durationSeconds`) with a
         schema-valid, explicitly-NOT-cited placeholder (`resolveDefault
         ParamValue` — first `allowedValues` entry, or a numeric range's
         midpoint) a real caller can override. Every prior capability-test
         script that executed a found path had to hand-convert it into
         `applyAction` calls one at a time (`is-goal-still-reachable.ts`,
         `boil-with-any-deep-vessel.ts`, ...) — this replaces that.
      2. **`RecipeIntentSchema` + `planIntent`** — resolves a real
         goals-and-constraints intent into a runnable `RecipeScript`.
         Goals are processed IN ARRAY ORDER (no cross-goal backtracking,
         a real stated simplification); a later goal's `instanceId` may
         reference `"$combineResult:<goalIndex>"` to target what an
         EARLIER combine-goal produced, letting a full multi-step,
         multi-instance dish be expressed as one ordered goal list.
      3. **Cost-aware search (`planLowestCost`)** — a real, if simple,
         Dijkstra built on `enumerateEdges` (extracted from
         `isGoalReachable`'s own inline loop body the same day, a pure,
         behavior-preserving refactor — re-verified via the full existing
         `tests/reachability.test.ts` suite plus
         `capability-test:reachability`, byte-identical output). Cost is
         `1 + Σ(hazard severity penalty)` per step — `defaultEdgeCost`,
         an explicitly UNTUNED scheduling heuristic, not a cited domain
         figure — so among equal-length paths, the search now prefers the
         one asking a robot to do the less risky thing. Absent any
         hazard, identical to plain BFS (fewest steps) — verified, not
         assumed, in `tests/planner.test.ts`.
      4. **Bounded multi-instance/COMBINE planning (`planCombine`/
         `planSecondaryRole`)** — the honest answer to `isGoalReachable`'s
         own "single-instance scope... a `requiredSecondaryCapability`
         edge is recorded as blocked, not explored." NOT a general
         multi-instance world model — a real, checked-before-building
         finding shaped the actual scope: `engine.ts`'s
         `requiredSecondaryCapability` check is ENTITY-level only, it
         NEVER inspects the secondary instance's current STATE (confirmed
         by reading `applyAction` directly — `egg_cracked.json` has no
         `combine` key in its own `statePrerequisites` either), the exact
         same class of gap `LEARNINGS_ENGINE.md` 2026-08-12 already named
         for `requiredIngredientCapabilities`, just never previously
         stated for this mechanism. So `planSecondaryRole` only needs a
         BOUNDED, one-spawn-hop search (the real case this repo actually
         has: raw `egg` doesn't carry `isCombinableAddition`, `CRACK`'s
         `egg_cracked` byproduct does) — not a general entity-graph
         planner — plus an OPTIONAL `secondaryDesiredState`/`Tags` so a
         planned recipe can still be REALISTIC (a genuinely beaten egg),
         not just engine-legal. `SpawnIdTracker` mirrors
         `recipe-runner.ts`'s own real spawn-id scheme EXACTLY (a single
         GLOBAL counter across every entity type, not per-entity-type —
         a real, checked, easy-to-get-wrong detail, cross-verified against
         `tortilla-de-patatas.json`'s own real
         "egg_cracked-3"/"tortilla_mixture-4" ids) — the planner ACTING
         AS the recipe's author predicting what its own step order will
         produce, not a second, drift-risking re-derivation of an
         ALREADY-RUN recipe's ids (the different, real risk
         `LEARNINGS_ENGINE.md` 2026-08-16 named for `explainRecipe`'s
         earlier, unrelated spawn-id gap). Deliberately does NOT resolve
         WHICH `COMBINE`-shaped action to use from a target entity id
         alone — `potato_onion_mixture.json`'s own
         `capabilityAmbiguityNote` already names why guessing that would
         be unsound; the action id is always caller-supplied.
      5. **Closed-loop replanning (`recipe-runner.ts`'s new
         `runRecipeFromIntent`)** — directly acts on this same section's
         own "Closed-loop / replanning execution mode" entry (now merged
         into this one — see below): `runRecipe` itself stays completely
         UNCHANGED (every existing caller — `scripts/validate.ts`, every
         capability test, `npm run recipe` — is unaffected); a genuinely
         NEW, additive function/interpreter. Plans via `planIntent`, then
         executes step by step; on a real thrown precondition failure, it
         does NOT keep running the rest of a now-stale plan (`runRecipe`'s
         own behavior, correct for offline validation, named in the
         original "actively wrong for a real robot" entry this replaces)
         — instead it calls `isGoalReachable` FRESH from the instance's
         REAL current state toward the SAME original goal and splices in
         an alternative path, at most ONE replan attempt per goal (a real,
         explicit guard against retrying a genuinely unreachable goal
         forever). An optional `executionAvailableTools`/
         `executionAvailableIngredientEntityIds` override lets execution
         diverge from what `planIntent` assumed — the honest model of "a
         robot discovers mid-run that a tool it expected is missing" (this
         engine has no live sensing — `ENGINE_INVARIANTS.md` #11 — so
         without this override, plan and execution are always consistent
         BY CONSTRUCTION, a real, checked property worth naming: nothing
         could ever actually diverge without it). Deliberately, honestly
         scoped narrower than "replan anything": single-instance goals
         only (a `combine` goal is rejected up front, not silently
         mishandled — splicing a replanned sub-path can change how many
         instances get spawned partway through, which could invalidate a
         LATER, already-baked-in `COMBINE` step's `secondaryInstanceId` —
         a real, larger problem named rather than solved unsoundly here);
         no PLACE (`FILL`/`HEAT_PLACE`/`PLACE_IN`/`REMOVE`)/`WASH_TOOL`
         support (a fresh, simpler interpreter built for this function,
         not `runRecipe`'s own body).
      \
      Proven via `npm run capability-test:planner`
      (`scripts/planner-as-a-robot.ts`) — the flagship case: the FULL
      `tortilla_de_patatas` dish (fry a potato, crack+beat an egg,
      combine, fry the result) planned end to end from a bare
      `RecipeIntent` with ZERO hand-authored `RecipeScript` steps, then
      ACTUALLY RUN against the real, unmodified `recipe-runner.ts` with
      zero errors — the correctly-predicted spawn ids
      (`egg_cracked-2`/`tortilla_mixture-3`) matching exactly what
      `recipe-runner.ts` itself produces; PLUS a real, honest
      closed-loop-replanning failure case against REAL data (`CUT`
      genuinely has no knife-free substitute anywhere in this
      vocabulary — checked, not assumed — so planning with a knife then
      executing with only a pan correctly reports a final, honest
      failure, not a false success). 25 new unit tests
      (`tests/planner.test.ts`, `tests/recipe-runner.test.ts`) against
      synthetic fixtures, matching `CLAUDE.md`'s own stated `npm test`/
      `npm run validate` split. `tsc --noEmit` clean, full existing suite
      (304 tests total) + `npm run validate` (96 files, 17 recipes) +
      every capability-test/demo script in the repo re-run with zero
      regressions.
- [x] **(original entry, kept for the reachability-closure detail below,
      now merged with the fuller closure above)** An actual planner —
      searches `Action`'s existing precondition/effect
      shape (`requiredTargetCapability`/`requiredTools`/
      `requiredIngredientCapabilities`/`requiredSecondaryCapability` as
      preconditions; `outputs.*` as effects — already structurally a STRIPS/
      PDDL-style planning domain, just never driven that way) from current
      world state to a goal. Every `data/recipes/*.json` file today is a
      hand-computed example of exactly this search, done manually, one file
      at a time.
      \
      **The QUERY half — "is a goal still reachable from here" — closed
      2026-08-16, TICKET 4 of `PAPER_NOTES_2608.04768.md`, deliberately the
      LAST of that ticket list ("the real work... do last, do slowly").**
      `src/reachability.ts`'s `isGoalReachable` is real BFS over exactly
      this planning-domain shape (`allowedTransformations` as candidate
      edges, `requiredTargetCapability`/`requiredTools`/
      `requiredToolCapabilities`/`requiredIngredientCapabilities` as
      preconditions, `invalidTransitions` as closures) — the outer bullet's
      own framing turned out to be exactly right. Scoped DELIBERATELY
      NARROWER than the full item above, stated rather than implied
      covered: REACHABILITY only, not migration/planning (proposing an
      alternative goal needs a real planner this repo doesn't have — the
      still-unchecked items below); discrete state/tag graph only, no
      numeric fluents/thermal dose/tolerance metric (the paper's own
      equation (9) distance metric `D(·,·)` has no stated weights — not
      reproduced); single-instance scope (`requiredSecondaryCapability`
      COMBINE-shaped edges are recorded as blocked, not explored — no
      model of a second instance being available). `engine.ts`'s
      `applyAction` is completely unchanged. Deterministic BFS, fixed
      tie-break order (`entity.allowedTransformations`'s own declared
      array order, `parameters[].allowedValues`'s own array order) — tested
      directly, not assumed (`tests/reachability.test.ts`).
      \
      **Two real findings surfaced while building this, both checked
      against real data before acting on them, neither assumed**: (1) the
      ticket's own suggested forcing case ("mashed potato closed off from
      fried") is factually WRONG against this repo's already-audited data
      — `mashed → fried` is deliberately legal (`mashNote`'s potato-cakes
      exception) — caught by reading `potato.json` directly, not trusted
      from the ticket's prose (`LEARNINGS_PROCESS.md` 2026-08-16). (2) The
      tool itself then found a REAL, previously-invisible gap by pure graph
      search: `mashed potato → goal "peeled"` reports reachable (via
      `mashed → fry → peel`), because `potato.json` has no `"fried"` key in
      `invalidTransitions` at all — unlike `egg.json`'s own already-audited
      `fried`/`poached` forbidding `peeled`. NOT patched under this
      ticket's own scope (a rushed one-line addition risked repeating the
      exact mistake `potato.json`'s own 2026-08-15 correction was built to
      prevent) — instead given the same dedicated, per-transition
      real-technique audit `egg.json` got, the same day, as its own
      separate follow-up: `potato.json`'s new
      `invalidTransitionsAudit2026-08-16` closes 8 cut-shape states
      (sliced/diced/julienne/chopped/minced/halved/quartered/grated)
      forbidding `peeled` at HIGH confidence (structural — once
      subdivided, no single whole piece remains, the direct mirror of
      `egg.json`'s sliced/diced/chopped closure), plus `fried`/`baked`/
      `par_fried` forbidding `peeled` at the SAME WEAKER "no counter-
      technique found" tier `egg.json`'s own fried/poached-forbidding-
      boiled entries use — named as such, not asserted with equal
      confidence. Deliberately does NOT touch `boiled` (boil-in-jacket-
      then-peel stays correctly legal — the real, verified reason this
      repo corrected itself once already) and does NOT add shape-to-shape
      closures (real progressive-cutting techniques exist —
      halved→quartered→diced — and this session lacked the confidence to
      verify which specific transitions are and aren't real; left
      unasserted rather than guessed, a real, still-open gap named
      honestly). `mashed → peeled` is now correctly unreachable —
      `scripts/is-goal-still-reachable.ts`'s Case 1b kept as a permanent
      regression check on this exact fix, not removed once "solved." See
      `LEARNINGS_PROCESS.md`/`LEARNINGS_DOMAIN.md` 2026-08-16 for the full
      reasoning. Exactly the kind of question this ticket's own "why"
      section says a reachability tool answers that the field currently
      answers "empirically and expensively." A smaller, directly analogous, and
      DID get fixed: `egg.json` was missing a `"separated"` closure
      forbidding `boiled`/`fried`/`poached` (the same "no shell/intact
      structure in play" reasoning already established for `fried`/
      `poached` forbidding `peeled`) — fixed in the same change
      (`egg.json`'s own `separatedNote`), enabling this ticket's own second
      real dead-end example (a separated egg can never reach a whole
      boiled egg again — not because of a state closure alone, but because
      `SEPARATE`'s `destroysTarget` means the original instance no longer
      exists to reach anything, modeled as a real `instance_destroyed`
      dead end with zero outgoing edges).
      \
      Proven via `scripts/is-goal-still-reachable.ts` (`npm run
      capability-test:reachability`): two real, verified dead ends with
      specific named reasons (a terminal `burned` potato; a `separated`
      egg), the surprising-but-real `mashed → peeled` reachable finding
      above, a real mid-recipe reachable case (raw potato with a `washed`
      tag, goal `fried`) whose found path is then ACTUALLY EXECUTED against
      `engine.ts`'s real `applyAction` step by step (not just claimed), and
      a direct determinism check (identical query, run twice, identical
      result). 14 new unit tests in `tests/reachability.test.ts` against
      synthetic fixtures, independent of `data/*.json`'s current shape.
- [x] **Closed-loop / replanning execution mode — closed 2026-08-17.**
      `recipe-runner.ts`'s new `runRecipeFromIntent` — see the "An actual
      planner" entry above (sub-item 5) for the full detail; `runRecipe`
      itself is untouched and remains exactly this "log the failure,
      continue anyway" behavior for every existing caller.
- [x] `VerificationCriterion`-per-action — closed 2026-08-12. `action.ts`'s
      `VerificationCriterionSchema` (method/description/confidence), audited
      onto all 21 actions, not left partial. Generalizes the CCP pattern (a
      sensor-checkable classification over a continuous quantity) beyond just
      HACCP. Still NOT a continuous-physics simulator or a closed loop —
      `engine.ts`'s `applyAction` doesn't consume this yet (still open-loop,
      asserts success the instant preconditions pass); this is the structured
      domain knowledge a real control loop would need, not the loop itself.
      `confidence: "low"` on several (EMULSIFY, BEAT, BAKE) is itself honest,
      useful information — it names exactly where "trust the timer" is
      weakest, not a defect quietly smoothed over.
- [x] Physical hazard metadata — closed alongside the above, not originally
      scoped as its own item but a direct answer to "think like a robot"'s
      named gap (this codebase only ever modeled FOOD safety via CCPs, never
      OPERATIONAL safety — a knife or hot oil endangering a person nearby).
      `action.ts`'s `HazardSchema` (type/severity/note), audited onto all 21
      actions (empty array is a real claim for SALT/BEAT, not an omission).
      Records what a real interlock/proximity-sensing system would need to
      know — doesn't itself keep anyone safe, no sensing exists.
- [x] `retrySafe` per action — what happens if a robot's fault-recovery
      blindly re-runs a step after an interruption. Auditing this FOUND a
      real bug, not a hypothetical one: `PEEL` neither `destroysTarget` nor
      checks it isn't already peeled — a blind retry would spawn a SECOND
      `potato_peel`/`egg_shell` byproduct instance that doesn't physically
      exist. `retrySafe: false` on `peel.json`, the only `false` among all 21.
      Two other real distinctions found and recorded, not just declared true:
      idempotent-by-construction (SALT/FLIP/FOLD/SHOCK/INFUSE/PASTEURIZE —
      engine.ts already guards `addsTag` against duplicates) vs. fails-loudly
      -instead-of-repeating (CRACK/SEPARATE/COMBINE — target already gone
      from inventory on a second attempt). `retrySafe: true` at the data/
      inventory level does NOT mean culinarily harmless — FRY/POACH/SCRAMBLE/
      EMULSIFY are flagged `true` with an explicit caveat that re-running a
      finished result risks overcooking or, for EMULSIFY specifically,
      breaking an already-stable emulsion.
- [x] **Real D-value/z-value thermal-death-time model — closed 2026-08-12,
      not part of the original Phase 4.5 scope but a direct answer to "make
      the system real, do the math, use standards."** `thermal.ts`'s
      `ThermalInactivationModelSchema` + `requiredHoldSeconds()`: the actual
      textbook microbiology formula the FDA Food Code's own multi-point
      tables were derived from — computes required hold time at ANY actual
      temperature from one cited reference point + a z-value, not just a
      fixed two-point lookup. Applied to a NEW CCP,
      `egg_pasteurization_liquid.json` (60°C/210s, a real USDA-cited
      regulated figure for already-liquid egg product) — explicitly NOT
      applied to the existing in-shell CCP, because the model's core
      assumption (product reaches medium temperature quickly) is false for a
      whole shelled egg. Computing what the model WOULD predict at the
      in-shell CCP's own 57°C (~975s) against its real empirical figure
      (3900s) surfaced a genuine ~4x gap — the measurable signature of shell
      heat-penetration lag, not asserted, calculated. Real payoff, not just
      rigor for its own sake: `handmade-alioli-egg-yolk.json`'s pasteurization
      step dropped from 65 minutes to 3.5, because pasteurizing the
      already-separated yolk directly is both MORE correct (right model for
      the right physical situation) and simpler (shorter, standards-backed,
      matches real commercial liquid-egg practice) — not a tradeoff between
      rigor and convenience.
- [x] **Structured `DomainFact`/`PhysicalProperty` records — closed
      2026-08-17.** `ingredient.ts`'s new `DomainFactSchema` (`value: number
      | NumericRangeSchema`, `unit`, `citation` — reusing the existing
      `CitationSchema` rather than a second, parallel source-string field —
      and a real, previously-nonexistent `verified: boolean`) plus
      `CriticalControlPointSchema.domainFacts` (`thermal.ts`), keyed by an
      author-chosen fact id. `verified` is a genuinely NEW, separate axis
      from `citation.confidence`, not a duplicate of it: `confidence` says
      whether a canonical source is even NAMED; `verified` says whether
      THIS SPECIFIC number was independently double-checked via a live
      lookup this session, as opposed to recalled/inherited — a real
      distinction this repo had already been making constantly in PROSE
      (`egg_pasteurization_raw.json`'s own `independentVerificationNote`;
      any `LEARNINGS_*.md` entry saying "verified via direct lookup, not
      recalled") without ever having a queryable field for it before now.
      \
      `egg_cooking.json`'s `metadata.coagulationReferenceC` — this entry's
      own named "right instinct already present" — is the concrete,
      migrated forcing case: promoted from an ad-hoc object sitting inside
      `metadata: z.record(z.string(), z.unknown())` (zero validation — a
      malformed shape there silently passed) to two real, Zod-validated
      `domainFacts` entries (`eggWhiteCoagulationTemp`/
      `eggYolkCoagulationTemp`), both honestly `verified: false` (McGee is
      named, but nobody opened the actual text this session). Deliberately
      scoped narrow, not sprayed across every schema speculatively: only
      `CriticalControlPointSchema` gained a `domainFacts` field — a repo-
      wide grep for this exact ad-hoc-structured-numeric-fact-in-metadata
      shape found `coagulationReferenceC` was genuinely the ONLY instance
      of it anywhere in `data/`, so `EntitySchema`/`ActionSchema` were NOT
      also given the field; doing so with zero real data to populate it
      would have repeated the exact declared-but-dead-capability mistake
      this repo has caught and fixed multiple times before (`pan.json`'s
      hot/cold, `potato.json`'s mashed). Explicitly does NOT replace
      `metadata.notes` prose — the overwhelming majority of it is genuine
      reasoning/technique explanation, not a single extractable number, and
      this schema was never meant to absorb that; also NOT retrofitted onto
      `YieldFractionSchema`/`StorageLifeSchema`, which predate it and
      already work.
      \
      Surfaced two ways: `src/query.ts`'s new `answerAboutDomainFact`
      (the `CriticalControlPointSchema.domainFacts` sibling of the already-
      closed `answerAboutParameter`) and `scripts/ask.ts`'s new `fact`
      subcommand (`npm run ask -- fact egg_cooking
      eggYolkCoagulationTemp`) — directly closes this gap's own stated
      problem ("a robot's planner/verifier cannot safely consult an English
      paragraph for a safety-critical number at runtime... `ENGINE_
      INVARIANTS.md` #10"). `engine.ts`'s `applyAction` deliberately never
      reads `domainFacts` at all — these are reference facts, not enforced
      thresholds; `instantaneousC`/`heldC`/`heldSeconds`/`thermalModel`
      remain the only fields actually consulted for enforcement, unchanged.
      Proven via `npm run capability-test:domain-facts`
      (`scripts/domain-fact-as-a-robot.ts`) — typed access with zero prose
      parsing, a real computation (measured-temperature-in-range check)
      using the structured value directly, a malformed `domainFacts` entry
      (missing `unit`) actually rejected by Zod where the old ad-hoc object
      would have silently passed, and the `verified`-vs-`confidence`
      distinction demonstrated on real data. 9 new unit tests
      (`tests/ingredient.test.ts`, `tests/thermal.test.ts`).
- [x] **A real domain-question query interface — closed 2026-08-12.**
      `src/query.ts`'s `answerAboutParameter` + `npm run ask -- <actionId>
      <parameterId>`: given a question like "how often should I pour olive
      oil for alioli," the answer comes from actually looking up
      `emulsify.json`'s `oilAdditionRate` (allowedValues, whether it's
      state-determining or informational, every metadata note that mentions
      it, every real recipe that has set it) — not generated prose. Matches
      CONCEPT.md §14's boundary exactly: turning free text into a structured
      lookup is the LLM's job; the deterministic data already in `data/*.json`
      has final say on the actual answer. Narrower than the `DomainFact`
      item above (this queries existing `metadata.notes` + parameter
      definitions as-is, not a new structured-fact schema) but real and
      running today, not just proposed.

## Phase 5 — Bi-directional compilers (`ocr-converter.ts`)
- [ ] `compileToSchemaOrgIngredient` and the OCR → Schema.org export path.
- [x] **Cooklang parser + entity-matching import + mechanical export —
      closed 2026-08-18, `src/cooklang.ts`.** Built exactly along the
      boundary `AUTHORING.md` §2 drew ahead of any code existing (kept
      below verbatim as the design record, still accurate):
      this is really two separate problems, not one. Parsing Cooklang's
      own syntax (`@ingredient{qty%unit}`, `#cookware{}`, `~{timer}`,
      `>> metadata`, `-- comments`, `[- block comments -]`) is mechanical
      — built now as `parseCooklang`, real grammar, no judgment calls
      (citation: `REFERENCES.md`'s new "Interoperability formats"
      section). Turning step PROSE ("fry the potatoes until golden") into
      this repo's typed `actionId`/parameter shape is still NOT mechanical
      — that's the same free-text → structured-intent translation
      `ENGINE_INVARIANTS.md` #10 scopes to an LLM/human proposing a draft,
      never asserted as valid, and this module deliberately does not
      attempt it: `CooklangStep.text` keeps a step's prose verbatim for
      that still-unbuilt translator to consume, `parseCooklang`'s output is
      not a `RecipeStep`. `importCooklangDraft` closes the one piece of
      "mechanical" that's genuinely useful before the translator exists:
      matching every `@token` against `Entity.cooklang.canonicalToken` (or,
      failing that, the entity's bare `id` — a documented symmetric
      fallback with `exportToCooklang`'s own) to propose `RecipeInstance[]`
      for `initialInventory`, with unresolved tokens named, not silently
      dropped. `exportToCooklang` is the reverse and fully mechanical in
      the other direction — an OCR `RecipeScript` already carries
      everything Cooklang syntax needs (entity tokens, quantities, action
      names, durations), so there's no LLM-in-the-loop problem exporting;
      it deliberately does not synthesize natural-language prose, each
      step line is the action's own `names.en` plus tokenized references
      and a plain parameter list. Composes with `recipe-runner.ts`'s real
      `spawnedEntityIds` (optional param) to resolve instances SPAWNED
      mid-recipe (e.g. `SEPARATE`'s `egg_yolk` output) to real tokens too —
      same real-ground-truth-composition precedent as
      `execution-bounds.ts`/`in-progress-action.ts`, not a second static
      re-derivation of the spawn-naming scheme. Proven via
      `tests/cooklang.test.ts` (23 synthetic-fixture unit tests) and `npm
      run capability-test:cooklang` (`scripts/cooklang-as-a-robot.ts`) —
      the latter runs the full round trip against REAL `data/entities/*.json`
      and a REAL recipe with a genuine `SEPARATE` spawn
      (`handmade-alioli-egg-yolk.json`), not synthetic fixtures.
- [x] **Cooklang spice-lock preservation — closed 2026-08-18, same change
      as the parser above.** The `=` prefix on a locked quantity (e.g.
      `@sal{=1%tsp}`) round-trips import → export → import unchanged.
- [ ] **Cooklang scaling multipliers — still open.** Deliberately NOT
      built: `ingredient.ts`'s `QuantitySchema` doc comment already states
      no recipe-scaling engine exists anywhere in this repo to scale
      against, so there is nothing for a multiplier to multiply yet.
      Preservation (above) and multiplication are genuinely two different
      features — don't conflate a closed checkbox on one as covering the
      other.
- [x] **Cooklang ⇄ OCR JSON round-trip tests — closed 2026-08-18**, same
      change (`tests/cooklang.test.ts`'s `exportToCooklang` describe block,
      `scripts/cooklang-as-a-robot.ts`'s Part B). Scoped to what actually
      round-trips today: ingredient/cookware token identity and quantity —
      NOT a full `RecipeStep` (`actionId`/`params`) round trip, since
      Cooklang's own text never encoded that structured shape to begin
      with (see the prose-translation gap named above).
- [x] **The prose-to-verb translator — closed 2026-08-18, `src/cooklang-
      translate.ts`, `translateCooklangDocument`.** The one piece the
      entry above deliberately left unbuilt. Stays inside the same
      boundary, not across it: a real, bounded, DETERMINISTIC keyword/
      allowed-value matcher over this repo's own closed action vocabulary
      (`data/actions/*.json`'s `verb`/`names`/`parameters`) — not an NLP
      model, not an LLM call (this repo has never called an external LLM
      API anywhere in its execution path; `package.json`'s only dependency
      is `zod`, unchanged). Recognizes a verb by `verb` id or ANY locale in
      `names` (a Spanish-authored step matches exactly as well as an
      English one); infers `durationSeconds` from an already-parsed
      Cooklang timer (unit-converted to seconds); infers an `allowedValues`
      parameter from a literal value string in the prose, reporting —
      never guessing among — a genuine ambiguity (two allowed values both
      present). Deliberately does NOT extract numeric-range parameters
      (`oilTempC`, `waterTempC`, ...) from free text — no reliable
      non-guessing way to do that — always named as missing instead of
      invented. A step with more than one recognized verb produces exactly
      ONE `RecipeStep` (the first), naming the rest rather than attempting
      unreliable clause-splitting. Output is a `RecipeScript`-shaped DRAFT,
      same "never `.parse()`d here, hand off to `validate-recipe`"
      precedent as `recipe-scaffold.ts`'s `RecipeScaffold`. **Real,
      independently-discovered finding while building this**: this repo's
      own `data/actions/*.json` has four DISTINCT real actions
      (`combine.json`/`combine_dough.json`/`combine_potato_onion.json`/
      `combine_con_cebolla.json`) sharing the IDENTICAL verb `COMBINE` — a
      genuine verb collision, not a translator bug. Fixed by tracking every
      alias's full candidate-actionId list (not last-write-wins) and
      reporting real ambiguity rather than silently resolving to whichever
      action happened to load last — proven live against
      `tortilla-de-patatas.json`'s own COMBINE step. Proven via `tests/
      cooklang-translate.test.ts` (15 synthetic-fixture unit tests) and
      `npm run capability-test:cooklang-translate`
      (`scripts/cooklang-translate-as-a-robot.ts`) — against REAL
      `data/entities/*.json`/`data/actions/*.json` and two REAL recipes
      (`handmade-alioli-egg-yolk.json`: recovers all 6 original actionIds
      round-tripped purely through Cooklang text, zero access to the
      original `RecipeStep`s; `tortilla-de-patatas.json`: the COMBINE
      ambiguity finding above). See `LEARNINGS_ENGINE.md` 2026-08-18 for
      two further real regex bugs found building this (a `\b`
      word-boundary that silently fails when an alias ends in punctuation,
      and a duplicate "missing required parameter" note for a parameter
      that was actually found).

## Phase 6 — Nutrition extension (`nutrition-extension.ts`)
- [ ] `UsdaMealPatternContributionSchema`. Not started. Every entity already
      carries a `composition.nutrientsPer100g` record (water/protein/fat/
      carbohydrate, cited as literature approximations where not measured)
      that this would build on.
      **"Ticket 1: Purge External Identifiers and USDA Models from Core
      Schema" checked 2026-08-17, closed as already-satisfied — nothing
      was removed because there was nothing to remove.** A user-supplied
      ticket asked to strip `openFoodFactsId`/`usdaFoodDataId`/
      `mealPatternContribution` out of the core schema into an
      `extensions/`-style module, and to confirm a generic
      `extensions: Record<string, unknown>` escape hatch exists on
      `MetadataSchema`. Checked exhaustively before touching anything
      (case-insensitive grep across `src/`, `data/`, `scripts/`, `tests/`,
      every `*.md` including `olddocs/`): all three named fields have
      ZERO occurrences anywhere in this repo — `UsdaMealPatternContributionSchema`
      was never built (this bullet's own long-standing `[ ] Not started`,
      unchanged by this check), and no core schema was ever polluted with
      a hardcoded external-database foreign key. Every "USDA" hit that
      does exist (`potato.json`, `egg.json`, `egg_yolk.json`,
      `data/ccps/egg_cooking.json`, etc.) is a free-text `CitationSchema.
      source` string (e.g. `"USDA FoodData Central"`) — a citation, not a
      coupling. The generic extension bag the ticket's own task 4 asked
      for already exists, under a different but equivalent name: every
      core schema (`ingredient.ts`, `action.ts`, `recipe.ts`, `thermal.ts`)
      already carries `metadata: z.record(z.string(), z.unknown()).
      default({})`. All three of the ticket's own acceptance criteria are
      therefore already true today. Deliberately did NOT fabricate these
      fields just to stage a "before" state to refactor away — that would
      misrepresent this repo's real history for the sake of looking like
      the ticket did something. See `LEARNINGS_PROCESS.md` 2026-08-17.

## Phase 7 — Satellite: Web scraper pipeline (Python / BeautifulSoup)
- [ ] Fetch a recipe URL, extract `<script type="application/ld+json">`.
- [ ] Tokenizer: lossy `recipeIngredient` strings → quantity/unit/name/prep.
- [ ] Auto-generate Cooklang text; compile to an executable OCR JSON script.
Unstarted; depends on Phase 5's Cooklang parser (or a Python equivalent) and
Phase 1's still-unbuilt `ParsedIngredientSchema` (`RecipeIngredientSchema`
itself closed 2026-08-13 — see Phase 1).

**Future possibility, not scoped (2026-08-16, consolidated into
`RECIFINE_INTEGRATION_NOTES.md` the same day):** `recipi/` at the repo
root holds an unsolicited prototype/proposal for parsing free-text recipe
*instructions* (not just `recipeIngredient` strings — this phase never
scoped that) via **ReciFine**, a pretrained NER model
(github.com/nuhu-ibrahim/ReciFine, EACL 2026). Evaluated and deliberately
shelved rather than built or deleted — see `RECIFINE_INTEGRATION_NOTES.md`
for the full distilled reference (entity mapping, what's reusable vs.
not, concrete un-shelving steps); summary below kept for quick reference:
- **License blocker**: ReciFine is CC BY-NC 4.0 (NonCommercial); this repo
  is MIT and headed public. Depending on it would practically impose an NC
  restriction on anything downstream that uses the scraper, so it can't be
  wired in as-is — would need an explicit non-core, opt-in carve-out, or a
  permissively-licensed alternative model/dataset found first.
- **Incomplete against its own manifest** — `recipi/FILES_CREATED.txt`
  lists 17 files; 5 are missing (`recifine_server.py`, `tsconfig.json`,
  `examples/run-examples.ts`, `docker-compose.yml`, `Dockerfile.recifine`),
  so nothing in it runs today.
- **Only `parseRecipeWithReciFine()`/`mapReciFineToOCR()` in
  `recipi/recipe-pipeline.ts` would be reusable if ever built** — its
  `RecipeValidator`/`RecipeExecutor` reimplement a much weaker mock of
  what `src/engine.ts` + `data/*.json` already do for real (flat
  allowlists, one temp range per action, no state machine, no D/z-value
  HACCP, no doneness models) and should be discarded in favor of the real
  engine, not extended.
- First statistical-ML dependency this repo would take on (a Flask
  server + downloaded BERT weights) — every other planned satellite is
  deterministic/rule-based, which is the discipline `CLAUDE.md`'s
  "every factual claim traces to a real source" rule assumes; defensible
  only if ReciFine's role stays a fuzzy front-end parser with this
  phase's own validator as the actual gatekeeper, same lossy-input/
  strict-engine split as the rest of this phase.
Revisit once this repo/scraper satellite is more mature and a license
question can be resolved deliberately, not as a default yes.

## Phase 8 — Satellite: Mobile reference app (React Native + Expo)
Unstarted. Depends on a stable OCR JSON shape (has one, informally, via
`data/*.json` + the Zod schemas) and a Community backend/auth service not yet
specified anywhere in this repo — flagged as an open dependency, not assumed.
- [ ] 4-tab navigator: Discover / Community / Meal Plan / Profile (per
      `CLAUDE_DEV_CTX.md`'s original spec — unchanged).

## Phase 9 — Satellite: Home Assistant HACS component (Python)
Unstarted. Depends on a running CookCLI server and a `.menu` file format
neither of which is defined anywhere in this repo — flagged, not assumed.

## Phase 10 — Research: simulation/robot-execution targets (`SIMULATION_TARGETS.md`)
- [x] **Research closed 2026-08-13** — compared five open-source candidates
      (PDDL/Fast Downward, VirtualHome, AI2-THOR/ProcTHOR, OmniGibson/
      BEHAVIOR-1K, RoboCasa) for eventually grounding this repo's `Entity`/
      `State`/`Action` model in a simulated or robot-executed world, plus a
      worked mapping of all six base ingredients (egg, potato, water, oil,
      salt, garlic) into each — see `SIMULATION_TARGETS.md` for the full
      comparison table and mapping. Recommendation: PDDL first (near-zero
      cost, validates the action graph is a sound planning domain), then
      VirtualHome if a visual world is wanted. RoboCasa (manipulator
      training) is correctly a later-tier concern with no actuator layer
      to hand it to yet.
- [ ] **Not started**: no PDDL compiler, VirtualHome program generator, or
      any simulator integration exists in this repo. `ENGINE_INVARIANTS.md`
      #11 ("a future closed-loop control/perception layer is a separate,
      larger piece of work, not implied by this one") still applies —
      research being closed does not imply a build was authorized.

## Open dependencies / unknowns
- `.menu` file format (Phases 8 & 9) — still undefined anywhere.
- CookCLI server API surface (Phase 9) — still undefined.
- Community backend/auth service (Phase 8) — still undefined.
- The real shape of multi-instance composition (Phase 4's new top item) —
  a design decision, not just an implementation task.
- ~~Whether `INVALID_TRANSITIONS` should be a literal static matrix (as
  `CLAUDE_DEV_CTX.md` specifies) or generalized from the `statePrerequisites`
  pattern already in use~~ — **resolved 2026-08-15**: per-entity (see Phase
  4's own now-closed entry above and `LEARNINGS_ENGINE.md` 2026-08-15) — state
  vocabulary isn't portable across entities, and a real near-miss found
  during development (potato's since-corrected first-draft rule directly
  contradicted egg's genuinely-required boiled-before-peeled order, under
  the same bare state name) is concrete proof a global map is fragile in
  a way per-entity keying isn't, even though the corrected, shipped data
  no longer has a live collision.
