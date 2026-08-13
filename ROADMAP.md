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

Started 2026-08-13 in response to a direct instruction to prioritize this
over engine work: "get all the common knowledge for cooking reflected in
system and schemas." Honest framing up front — "all" isn't achievable in one
pass (this repo has 5 seasoning/base ingredients total: potato, egg + its
byproducts, garlic, oil, salt/pepper/chili, water); this section exists so
progress is a checkable, prioritized list instead of an implied, unverifiable
"done." Same discipline as the capability-tests table above: closed items are
proven runnable, not just asserted.

**Closed:**
- [x] Salting timing (`before_cooking`/`during_cooking`/`after_cooking`,
      `salt.json`) — real osmosis/browning chemistry, informational-only.
- [x] Quantity (`QuantitySchema` — precise/imprecise/relative) — "a pinch,
      compared to what" answerable for the first time; see `ROADMAP.md`
      Phase 1.
- [x] Seasoning generalized beyond salt (`PEPPER`/`CHILI`) — see Phase 4
      above.
- [x] `SensoryPropertiesSchema.taste`'s missing "pungent" category (capsaicin/
      piperine/allicin — a real trigeminal channel, not a 6th basic taste but
      not representable by the other five either) — closed, applied to
      garlic/black_pepper/chili_flakes.
- [x] A real schema-integrity check that was previously silent: `addsTag`
      actions were never cross-checked against the target entity's own
      `possibleTags` — `scripts/validate.ts` now flags this (NOTE-level,
      proven to fire — see `LEARNINGS.md` 2026-08-13).
- [x] **Heat provider physics (gas/vitro/wood) + egg-boiling doneness
      timing** — closed 2026-08-13, `src/heat-source.ts` (`HeatSourceProfileSchema`,
      `estimatedPreheatSeconds`; `data/heat-sources/gas.json`, `vitro.json`,
      `wood_fire.json`) + `src/egg-doneness.ts` (`EGG_BOIL_DONENESS`, a real
      cited soft/medium/hard → seconds-range table). Gets the core physics
      right explicitly: heat source changes preheat TIME and control
      precision, never the boiling TEMPERATURE itself (always ~100°C at sea
      level — conflating the two is a real, common misconception this
      schema deliberately avoids). Also names, without modeling
      numerically, two real depth limits raised directly by the user:
      delivered heat is a genuine time-varying curve, not the constant
      average this uses; and a skilled cook's pan-positioning (essential on
      wood fire, where the fire itself often can't be finely dialed) is a
      real, separate control axis (`manualPositioningRelevance`) distinct
      from the source's own `controlPrecision`. Proven end-to-end:
      `npm run capability-test:boil-egg-heat-sources`.
- [x] Salt-in-boiling-water for egg (crack containment) — documented as a
      real, correctly-scoped gap rather than force-fit into `SALT`'s
      seasoning mechanism, which it isn't: `egg.json`'s new
      `crackContainmentNote` explains the real causal mechanism (faster
      coagulation of leaked white sealing a crack, not flavor) and
      explicitly does NOT endorse the commonly-repeated but weakly-evidenced
      "salt water peels easier" claim.
- [x] **`SIMMER` — a real, distinct temperature band below a rolling
      `BOIL`** — closed 2026-08-13, `data/actions/simmer.json`
      (`isSimmerable` on `potato.json`/`egg.json`, `waterTempC` capped 85-96°C,
      genuinely below `BOIL`'s ~100°C ceiling). Deliberately reuses `BOIL`'s
      exact `transformedState` ("boiled") rather than inventing a new
      "simmered" state — a simmered potato/egg is not a different dish from
      a boiled one, just a gentler process to the identical result; a
      separate state would have both misrepresented that and silently broken
      `egg.json`'s existing `statePrerequisites` (`peel`/`shock` require
      "boiled"). `criticalControlPointsByAction.simmer` on `egg.json` points
      at the identical `egg_cooking` CCP `boil`/`fry`/`poach` already use —
      Salmonella kill-time depends on temperature/duration, not on how
      turbulently the water got there, so this is the physically correct
      choice, not a shortcut. Real technique reason it's its own verb rather
      than an unstated aside on `BOIL`: a rolling boil's turbulence is a
      common, preventable cause of both broken potato skins/cloudy cooking
      water and cracked eggshells — ties directly to `egg.json`'s existing
      `crackContainmentNote`. Also the first action where
      `heat-source.ts`'s `controlPrecision`/`manualPositioningRelevance`
      fields (written earlier the same day, before `SIMMER` existed) become
      load-bearing rather than incidental: holding a stable 85-96°C band
      without creeping back to a rolling boil is exactly the "how precisely
      can a cook hold a simmer" question those fields were written to
      describe. Proven end-to-end: `npm run capability-test:simmer`.
- [x] **Frying physics: shape/size/oil temperature** — closed 2026-08-13,
      raised directly by the user ("depends of shape, size, oil
      temperature..."). Two real gaps, closed differently:
      1. `FRY` had only a vague `heatLevel` enum, no real `°C` parameter —
         inconsistent with `BOIL`/`SIMMER`/`POACH`'s `waterTempC`. Added
         `oilTempC` (120-200°C) to `fry.json`, sourced from Kalogianni &
         Smith, "Effect of frying variables on French fry properties,"
         *International Journal of Food Science and Technology* 48(4):
         758-770 (2013), doi:10.1111/ijfs.12024 — verified via direct
         lookup, not recalled.
      2. **Double-frying** (par-fry low, rest, fry high — the real technique
         behind crisp fries) needed a genuinely new verb, `PAR_FRY`
         (`data/actions/par-fry.json`, `isParFryable` on `potato.json`,
         145-165°C, sourced from Thermoworks' documented method: 163°C
         par-fry / 191°C finish). Unlike `SIMMER`, this does NOT reuse
         `FRY`'s `transformedState` — `par_fried` is a genuinely different,
         unfinished intermediate (pale, soft, not crisp), not the same dish
         reached more gently, so the two verbs correctly diverge in
         resulting state where `SIMMER`/`BOIL` correctly didn't (see
         `simmer.json`'s `sharedTransformedStateNote` for the other half of
         that same judgment call). Structurally simpler than the "heat as a
         place" gap below: double-frying's two stages are temporally
         SEPARATE (with a rest), so it composes from two ordinary sequential
         `applyAction` calls with no new engine machinery needed — proven in
         `scripts/double-fry-potato.ts`. The technique's required ~10-minute
         rest between stages is still a real, named, unbuilt gap
         (`par-fry.json`'s `restNote`) — this repo has no `REST` verb yet.
         Proven end-to-end: `npm run capability-test:double-fry`.
- [x] **Egg freshness (shape when fried) + FRY top-cooking technique** —
      closed 2026-08-13, raised directly by the user ("getting the perfect
      egg shape in the pan, throwing the heated oil OVER the egg yolk").
      Two distinct real facts:
      1. Egg shape in the pan is overwhelmingly a FRESHNESS effect, not a
         technique one: `egg.json` gains `fresh`/`aged` possibleTags, cited
         to MDPI's 2024 egg-freshness review and a real albumen-viscosity
         study (ovomucin network breakdown as an egg ages — a fresh white
         holds a tight, tall shape; an older one spreads flat). Deliberately
         set only as an `initialInventory` starting tag, never derived by an
         action — this repo has no elapsed-time/`AGE` concept, and inventing
         one just for this would be dishonest.
      2. `fry.json` gains `topCookingMethod` (`untouched`/`basted`/`covered`/
         `flipped`) — four genuinely different real techniques for cooking a
         sunny-side-up egg's top without flipping, `basted` being literally
         "throwing heated oil over the yolk" as described, and explicitly
         distinguished from `edgeStyle`'s `crispy_lace_puntilla` (same
         physical motion, different target and goal — yolk-setting vs.
         white-edge-crisping). Informational only, same depth limit as every
         parameter here. Verified directly (not via a dedicated capability-
         test script, since nothing here is state-determining or newly
         enforced beyond an allowedValues/tag check) — see `LEARNINGS.md`
         2026-08-13.
      A third thread in the same message — "transformations usually take
      time... states can change" — was real too but structural, not a data
      fix: folded into the "Heat as a shared, time-varying property of a
      PLACE" entry above as the same underlying gap (`applyAction`'s
      atomicity), not a separate one.

**Explicitly deferred, with the real reason why (not silently skipped):**
- [ ] Generalizing `SALT`/`PEPPER`/`CHILI` into one parameter-driven `SEASON`
      verb — needs a real engine feature (`addsTagFromParameter`, mirroring
      `transformedStateFromParameter`) plus a way for
      `requiredIngredientCapabilities` to identify WHICH specific instance
      satisfied the check, not just that one did. Out of scope while engine
      work is explicitly paused; the 3 separate verbs work correctly today.
- [ ] Salt/pepper crystal/grind size as distinct products (fine vs. coarse vs.
      kosher salt; whole vs. cracked vs. ground pepper is partially modeled —
      `black_pepper.json` starts "whole", `CRUSH` reaches "cracked"/"ground" —
      but salt itself is still one undifferentiated entity).

**Known-large, not yet started — flagged so the gap is visible, not implied
covered by what exists:**
- [ ] **Allergens.** Nothing in `EntitySchema` records allergen information at
      all (egg is a major allergen; nothing currently says so). Arguably the
      single highest-priority gap against this repo's own stated mission
      (`ROADMAP.md`'s "Why this exists" — cooking unattended for someone who's
      relying on the system): a system that can't say "this dish contains
      egg" is more dangerous by omission than one that's merely incomplete on
      technique.
- [ ] **Cross-contamination / hygiene knowledge.** `HazardSchema` models
      danger to the PERSON performing an action (a blade, hot oil); nothing
      models danger to the FOOD from equipment/surface reuse (same knife for
      raw egg then a ready-to-eat ingredient; a cutting board not washed
      between uses). `CriticalControlPointSchema` is thermal-only by design
      (see `LEARNINGS.md` 2026-08-12) — this would need a genuinely different
      mechanism, not a stretched CCP.
- [ ] **Far more staple ingredients/entities.** No flour, dairy (milk/butter/
      cheese), onion, herbs, sugar, vinegar/acid, or any protein besides egg.
      The vocabulary's technique DEPTH (HACCP, carryover cooking, emulsion
      chemistry) is disproportionate to its ingredient BREADTH right now.
- [ ] **More common technique verbs.** ~~`SIMMER`~~ **closed 2026-08-13** —
      see "Common culinary knowledge coverage" below. Still open: `WHISK`,
      `STEAM`, `ROAST`/`GRILL`, `MARINATE`, `REST` (post-cook carryover
      exists narrowly for egg via `SHOCK`, not generally), `KNEAD`,
      `STRAIN`/`DRAIN`.
- [ ] **Heat as a shared, time-varying property of a PLACE (pot/pan), not a
      per-action-call parameter on one ingredient.** Raised directly by the
      user while `SIMMER` was being built: "heat is a function inside a
      place where many ingredients can live. it increase and decrease in
      time. You can heat up, or play with the pan." A real, external,
      concrete case that needs exactly this and nothing less: Di Lorenzo &
      Di Maio, "Periodic cooking of eggs," *Communications Engineering*
      (Nature Portfolio), Feb 6 2025 —
      https://www.nature.com/articles/s44172-024-00334-w — alternates an egg
      between a 100°C and a 30°C water bath every 2 minutes for 32 minutes to
      get a fully-set white with a sous-vide-creamy yolk. This repo's engine
      cannot express that recipe at all today, not even informationally —
      see `REFERENCES.md`'s "discussed, not yet embedded" section; this is
      the one real source in this repo with no corresponding data/code
      because the mechanism to hold it doesn't exist yet. Concretely
      confirmed by the code itself too, not just conceptually true:
      `pan.json` already lists
      `possibleStates: ["hot", "cold"]` with ZERO actions or engine support
      that ever reaches either one, and no `thermophysical` data — noted in
      its own `metadata.notes` as "not fully modeled" since before this
      entry existed. Two ingredients simmering in the same pot right now get
      independent, unlinked `applyAction` calls each carrying their own
      `waterTempC`/`durationSeconds` guess, not one shared temperature that
      rises/falls over real time and that anything "in" that pot at that
      moment would actually feel. Pan-repositioning
      (`heat-source.ts`'s `manualPositioningRelevance`) is a descriptive
      rating today, not an actual control action a recipe step can invoke.
      Closing this for real needs: tool-level thermal state (a temperature
      that persists and evolves on the `pot`/`pan` entity itself, not on
      whatever ingredient happens to be the current action's target), a
      time-based heating/cooling model (building on `estimatedPreheatSeconds`'s
      existing energy-balance math, `heat-source.ts`), and a new engine
      concept of instances co-located in one tool instance sharing its
      state — a real, structural addition to `engine.ts`'s current
      one-target-instance-at-a-time `applyAction` shape, not a data-only
      fix. Deliberately named and left unbuilt rather than started
      speculatively — see `LEARNINGS.md` 2026-08-13 for the full reasoning
      on why this is scoped as design-and-record, not implement, for now.
      **Extended the same day, same root cause, raised again unprompted by
      the user in different words**: "transformations usually take time...
      states can change, so its cooking and life." `applyAction` is
      genuinely atomic — it maps one `Instance` state directly to another;
      `durationSeconds` is checked as a pass/fail HACCP threshold, never
      used to represent any state PARTWAY through a transformation. Two
      concrete real cases this actually blocks, found while building
      `fry.json`'s `topCookingMethod`/`egg.json`'s `freshnessNote` the same
      day: an egg's shape in the pan is not fixed at the instant it's
      cracked, it settles/spreads continuously over the first several
      seconds (a real, continuous process, not a snapshot); basting
      (`topCookingMethod: "basted"`) is applied repeatedly DURING frying,
      not once at the start or end, so its actual effect depends on WHEN in
      the process it happens, which nothing here can express. Both were
      handled honestly at the depth this repo already commits to elsewhere
      (informational-only parameters recording WHAT technique was used, not
      simulating its moment-to-moment effect) rather than by pretending
      atomicity isn't a real limitation — but the underlying fact stands:
      closing this gap for real needs the SAME structural addition as the
      place/heat gap above (continuous or at least multi-checkpoint time
      within one action), not a second, separate mechanism.
- [ ] **Storage/shelf-life common knowledge** (partially, deliberately
      out-of-scope already for one case — `infuse.json`'s garlic-in-oil
      botulism note, `LEARNINGS.md` 2026-08-12 — but nothing general exists:
      no "how long is this safe/good for" anywhere).
- [ ] **Yield/waste factors** (edible-portion %, e.g. how much of a potato's
      mass a peel actually is) — `producedByproducts` records WHAT spawns,
      never HOW MUCH.

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
- [ ] Lint/format config — none present (no eslint/oxlint/prettier config in
      the repo).
- [x] `CLAUDE.md`'s "Repository state" — kept current as of this rewrite;
      see `CLAUDE.md`'s own instruction to update it *in the same change*
      that makes it stale, not later.

## Phase 1 — Core entity & ingestion models (`src/ingredient.ts`)
- [x] `EntitySchema` — ingredients vs. tools, capabilities, states, tags,
      `byproductsByAction`, `criticalControlPointsByAction` (both added
      beyond the original spec, out of necessity — see `LEARNINGS.md`
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

## Phase 4 — Validation engine
- [ ] `OcrValidationEngine` class as a named class — `engine.ts`'s
      `applyAction` is a plain function covering most of the same
      responsibility (capability/tool/state-prerequisite checks).
- [ ] **`INVALID_TRANSITIONS` forbidden-state-transition matrix — still the
      single largest unbuilt piece of the original spec.** Nothing today
      stops e.g. peeling an already-boiled potato in general; only the
      specific `statePrerequisites` pairs authored per-entity (peel-before-
      cut, boiled-before-peel-egg, ...) are enforced. A real matrix would
      generalize this instead of requiring every forbidden pair to be
      individually authored.
- [x] Requirement checks before a step executes (tool/entity present,
      required state, required capabilities, parameter validity).
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
- [ ] Unit tests per forbidden-transition rule — genuinely still blocked, but
      now on the `INVALID_TRANSITIONS` matrix itself not existing (this
      phase's own next unchecked item), not on the test-runner gap.
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
- [ ] `RecipeIntentSchema` (or similar) — goals/constraints/acceptable-states/
      tolerance/victory-conditions, replacing hand-authored `RecipeScript` as
      the AUTHORING format. `RecipeScriptSchema` itself doesn't go away — it
      becomes the planner's grounded output / a completed run's trace.
- [ ] An actual planner — searches `Action`'s existing precondition/effect
      shape (`requiredTargetCapability`/`requiredTools`/
      `requiredIngredientCapabilities`/`requiredSecondaryCapability` as
      preconditions; `outputs.*` as effects — already structurally a STRIPS/
      PDDL-style planning domain, just never driven that way) from current
      world state to a goal. Every `data/recipes/*.json` file today is a
      hand-computed example of exactly this search, done manually, one file
      at a time.
- [ ] Closed-loop / replanning execution mode, distinct from
      `recipe-runner.ts`'s current "log the failure, continue to the next
      step anyway" — correct for offline validation, actively wrong if ever
      reused verbatim to drive a real robot through a physical failure.
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
- [ ] Structured `DomainFact`/`PhysicalProperty` records (typed value, unit,
      source, `verified: boolean`) alongside — not replacing — the prose
      `metadata.notes` this repo is full of. A robot's planner/verifier
      cannot safely consult an English paragraph for a safety-critical number
      at runtime; having anything interpret one to extract such a number
      (most obviously an LLM) is exactly what `ENGINE_INVARIANTS.md` #10
      forbids. `egg_cooking.json`'s `metadata.coagulationReferenceC` is the
      right instinct already present, just not yet a consistent, first-class
      pattern.
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
- [ ] Cooklang parser. Partial groundwork exists — every entity has a
      `cooklang: { canonicalToken, spiceLock }` field (`ajo`, `huevo`,
      `sal`, ...) — but nothing reads or writes actual `.cook` text yet.
- [ ] Cooklang scaling multipliers / spice-lock preservation.
- [ ] Cooklang ⇄ OCR JSON round-trip tests.

## Phase 6 — Nutrition extension (`nutrition-extension.ts`)
- [ ] `UsdaMealPatternContributionSchema`. Not started. Every entity already
      carries a `composition.nutrientsPer100g` record (water/protein/fat/
      carbohydrate, cited as literature approximations where not measured)
      that this would build on.

## Phase 7 — Satellite: Web scraper pipeline (Python / BeautifulSoup)
- [ ] Fetch a recipe URL, extract `<script type="application/ld+json">`.
- [ ] Tokenizer: lossy `recipeIngredient` strings → quantity/unit/name/prep.
- [ ] Auto-generate Cooklang text; compile to an executable OCR JSON script.
Unstarted; depends on Phase 5's Cooklang parser (or a Python equivalent) and
Phase 1's still-unbuilt `ParsedIngredientSchema` (`RecipeIngredientSchema`
itself closed 2026-08-13 — see Phase 1).

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
- Whether `INVALID_TRANSITIONS` should be a literal static matrix (as
  `CLAUDE_DEV_CTX.md` specifies) or generalized from the `statePrerequisites`
  pattern already in use — unresolved, worth deciding before building either.
