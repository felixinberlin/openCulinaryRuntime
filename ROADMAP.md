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
- [x] **CUT's `shape` given real, cited numeric dimensions — closed
      2026-08-15, raised directly by the user for tortilla de patatas
      ("how you cut the potatoes... changes the texture... a thin slice
      is about X diameter and X radio, and so on").** The full ask —
      cut geometry + oil temperature + cook time, connected to texture,
      "measured and mathed" — does NOT have a real answer as one formula:
      Kalogianni & Smith (cited above, this exact section) already found
      frying is a nonlinear, coupled process, not something a clean
      equation resolves. Presented the honest options; the user chose the
      smallest real slice: geometry only, no fabricated texture formula.
      `src/cut-dimensions.ts` — third instance of the `egg-doneness.ts`/
      `potato-doneness.ts` playbook (existing categorical parameter, real
      cited numeric meaning, zero `engine.ts` changes) — gives `sliced`/
      `diced`/`julienne`/`chopped`/`minced` real millimeter ranges, two
      checked via direct lookup this session (Wikipedia's "List of
      culinary knife cuts" for dice/julienne; two independent tortilla de
      patatas recipes for slice thickness, converging on 3-5mm).
      `halved`/`quartered` derive arithmetically from `potato.json`'s new
      `physicalDimensions.typicalDiameterCm` field (the America's Test
      Kitchen figure, promoted from prose to a real structured field) —
      not independently cited, since halving a potato isn't a knife-cut
      standard. A real, named tension NOT resolved: this table's `diced`
      (~6-13mm, professional small-to-medium dice) is genuinely smaller
      than `potato-doneness.ts`'s own existing `diced` entry (~25mm,
      potato-salad/boiling-style) — `cut.json`'s single `diced` value
      doesn't distinguish which a given recipe means. Proven end-to-end:
      `npm run capability-test:cut-shape-dimensions`.
- [x] **Heat-penetration physics: how long the CENTER takes to reach
      doneness, given thickness and oil temperature — closed 2026-08-15,
      the deferred half of the entry directly above, same day.** The user
      named the real mechanism directly: hot oil browns the surface fast
      while the potato's low conductivity makes the center lag — a real,
      sometimes-deliberate technique (thin+hot = crispy outside/tender
      inside), not just a risk. Unlike "geometry+temp+time+variety →
      texture" (rejected as not real science, entry above), "time for the
      center to reach a target temperature" has an actual textbook
      answer: `src/heat-penetration.ts` implements the standard one-term
      approximation for 1D transient conduction in a slab (Fourier's
      second law; Incropera & DeWitt). Closes the specific gap named
      above: `potato.json` now has a real, computed
      `specificHeatJPerKgK` (3730 J/(kg·K) — Choi & Okos's own published
      carbohydrate-cp polynomial + `water.json`'s already-cited 4186
      figure, mass-weighted by potato's own composition; density/
      conductivity stay uncomputed recalled figures, not silently
      upgraded alongside it). `POTATO_FORK_TENDER_CENTER_TEMP_C`
      (96-99°C, ThermoWorks + Idaho Potato Commission) is the real
      doneness target used. Three honesty caveats named explicitly in
      the module's own doc comment, found by actually building and
      running it: (1) Bi→∞ (instant surface heating) makes this a lower
      bound, not exact; (2) no browning/Maillard kinetics — it cannot say
      whether the outside actually burns, only how fast the center
      heats; (3) **pure conduction only, so its computed times (seconds
      to tens of seconds for a real 3-5mm slice) are far shorter than
      real total fry times** (`crispy_french_fries.json`: 180s) — real
      frying time is dominated by surface moisture evaporation/crust
      formation (this repo's own cited Kalogianni & Smith), which this
      module does not model at all. Answers "how fast does heat reach the
      center," not "how long should I fry this." Proven end-to-end:
      `npm run capability-test:potato-heat-penetration` (thin-vs-thick
      slice, cool-vs-hot oil, four real combinations). **Extended same
      day**: the user's next observation — submerged vs. shallow oil
      isn't the same — composed with this exact model rather than needing
      a new one. `effectiveHalfThicknessM` (a standard heat-transfer
      symmetry argument: one face heated + one insulated ≡ half of a
      symmetric slab of double thickness) turns "swimming in oil" (2
      faces) vs. "only a little" (1 face) into a specific, derivable ~4x
      time prediction — confirmed exactly (4.0x) by the capability-test
      script's real numbers, not just "slower in the right direction."
      Variety/starch-content data remains the one piece still explicitly
      deferred from the original three-part ask, not forgotten.
- [x] **`cut-dimensions.ts` + `heat-penetration.ts` wired into
      `recipe-explain.ts` — closed 2026-08-15, same day.** Closes the gap
      `crispy_french_fries.json`'s own `shapeConnectionNote` named
      unprompted before either module existed: "nothing connects CUT's
      shape state to FRY's/PAR_FRY's durationSeconds... a schema-valid
      but real-world-wrong result... and nothing here would catch it." A
      new fry-timing-vs-geometry check in `explainRecipe` composes both
      modules — real cited shape dimensions + real heat-conduction
      physics — into a pre-flight advisory. Deliberately RANGE-based per
      the user's explicit ask ("be flexible with measures"): no recipe
      today states how much oil is used, so whether a slice heats from
      one or two faces is genuinely unknown most of the time — computed
      for BOTH and reported as a [fastest, slowest] window rather than
      one false-precision number; `fry.json`'s own `topCookingMethod`
      narrows it when a recipe actually sets it. Verified against the
      real recipe it was built to agree with, not just synthetic fixtures:
      `crispy_french_fries.json`'s julienne/163°C/191°C pipeline produces
      zero advisories, independently confirmed by hand-computing the
      actual seconds first. Two honest limits found and recorded, not
      hidden: the new "oil too cold to ever finish cooking" branch is
      effectively unreachable via any schema-valid recipe today (both
      `fry.json`'s 120°C and `par-fry.json`'s 145°C floors already sit
      above the potato doneness target — the same shape of gap as
      `egg_cooking`'s CCP being unreachable via `BOIL`'s own 60s floor,
      found earlier this session); and only `crispy_french_fries.json`
      itself currently used the real `oilTempC` parameter this check
      needs — the other four potato-frying recipes still used the older
      `heatLevel` enum, so the new check correctly and silently didn't
      reach them yet, not a false negative. **Partially closed same
      day:** `tortilla-de-patatas.json`/`tortilla-de-betanzos.json` both
      already committed to a real `heatLevel: "low"` + `durationSeconds`
      pair, so adding `oilTempC: "135"` (the midpoint of `fry.json`'s own
      already-cited McGee "low" band, 120-150°C — no new citation needed)
      was pure enrichment, not a behavior change; checked directly, both
      recipes' durations (900s/480s) comfortably clear the real computed
      time (10.0-111.2s). `salted-fried-potatoes.json`/`garlic-oil-
      potatoes.json` deliberately left uncovered — both are missing
      `durationSeconds` entirely on the potato `FRY` step, and inventing
      one where the original author left it open-ended would be a real
      change to recipe behavior, not the same move as promoting an
      already-stated `heatLevel` to a number.
- [x] **`recipe-narrator.ts` — a human-readable "read this recipe back to
      me" document, closed 2026-08-15.** `npm run narrate-recipe -- <recipe>
      <output.md|.json>`. Deliberately a presentation layer, not a new
      source of truth — composes `recipe-explain.ts` (needs/advisories) and
      `recipe-runner.ts` (actual execution), adding only per-step
      capability RESOLUTION (which real instance satisfied a requirement,
      not just whether one could) and a stated-vs-unstated duration tally
      as genuinely new computation. First generated for `garlic-oil-
      potatoes.json` (see that recipe's own `garlicpotatoinfo.md` in the
      repo root), then re-run against `tortilla-de-patatas.json` as a
      generality check — which caught a real bug before it shipped: a
      `COMBINE`-spawned instance later re-targeted by `FLIP` was having
      `FLIP`'s own `addsTag: "flipped"` misreported as conservation-of-mass
      tag inheritance, when inheritance can only happen at spawn time.
      Fixed by tracking whether a created instance is ever targeted again
      anywhere in the sequence, only claiming "inherited" when it's
      provably never re-targeted — an exact instance of this session's
      repeated lesson that testing only the motivating example doesn't
      test the general claim.
- [x] **`recipe-scaffold.ts` — the scaffold generator, closed 2026-08-15,
      same day `AUTHORING.md` named it as a real gap.** `npm run
      new-recipe -- <path.json> <entityId...>`. Writes a real
      `initialInventory` (correct starting states straight from
      `data/entities/*.json`, per-entity-type instance numbering matching
      every existing recipe's own convention — potato-1/potato-2, not a
      shared global counter, a real bug caught by a manual check and
      locked in with a regression test) with empty `availableTools`/
      `sequence`, and prints each entity's real capabilities to the
      console. **Deliberately writes a file `RecipeScriptSchema` itself
      calls invalid** (`sequence` requires at least one step) — running
      `validate-recipe` against a fresh scaffold correctly says so; that
      alarm IS the point, not a bug the generator should suppress, the
      same "the validator's alarms are what guides a draft to correct"
      framing `AUTHORING.md` §2 already committed to for the (still
      unbuilt) Cooklang case. Verified end-to-end: scaffolded a real
      recipe, hand-added one `FRY` step, ran `validate-recipe`, got a
      clean pass — the full loop `AUTHORING.md` documents, actually run,
      not just described.
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
- [x] **"Complete potato" — skin-on cuts, GRATE, MASH** — closed 2026-08-13,
      in response to being challenged directly on whether this repo could
      really make "ANY potato fry style," checked rather than asserted.
      Found and closed three real gaps:
      1. **Skin-on cuts were IMPOSSIBLE** — `CUT` hard-required `"peeled"`,
         so rustic wedges/skin-on fries (a real, legitimate style) couldn't
         be represented at all. Fixed at the engine level, not just the
         data level: `ingredient.ts`'s `statePrerequisites` now accepts
         EITHER a single required state (unchanged, every pre-2026-08-13
         entity file needs no change) OR an array of acceptable prior
         states — `potato.json`'s `cut` is now `["washed", "peeled"]`.
         Covered by a new unit test in `tests/engine.test.ts`, not just the
         capability-test script.
      2. **`GRATE` didn't exist** — hash browns/rösti need a genuinely
         different piece shape (shredded, not sliced/diced). Deliberately
         its own verb and tool (`grater.json`), NOT folded into `CUT`'s
         `shape` enum as a sixth value — a box grater's friction-shredding
         is physically nothing like a knife's slicing motion, and the first
         draft of this fix made exactly that mistake before being caught
         and corrected (see `LEARNINGS.md` 2026-08-13).
      3. **`MASH` didn't exist at all** — the single most glaring gap: every
         `potato.json` since the first commit has listed `"mashed"` in
         `possibleStates` while `metadata.notes` said outright "mash isn't
         wired up yet." The exact same shape of dead-label gap as
         `pan.json`'s unreachable `"hot"`/`"cold"` states, found the same
         way (checked the code, not assumed). `data/actions/mash.json` +
         `masher.json`, gated on `statePrerequisites.mash: ["boiled",
         "baked"]` (using the same array mechanism from fix #1) — you
         cannot mash a raw potato, and the engine now actually enforces
         that. A mashed potato can still be `FRY`ed afterward with ZERO
         further changes (`FRY` has no `statePrerequisites` entry at all) —
         a real, simple potato-cake/leftover-mash technique.
      **Still NOT closed, named honestly rather than implied covered**: a
      true breaded croquette (mash → shape → bread/batter → fry) — no
      coating/breading mechanism exists in this vocabulary. Waffle/curly/
      crinkle cuts, twice-baked potato structure (hollow-and-refill), and
      the real alkaline (baking-soda) parboil-roughening technique (Kenji
      López-Alt's actual best method, cited in conversation) all remain
      open too — see this session's chat log / `LEARNINGS.md` for why each
      was scoped out rather than attempted. Proven end-to-end: `npm run
      capability-test:complete-potato`.
- [x] **"Oma boils an egg"** — closed 2026-08-13, `scripts/oma-boils-an-egg.ts`.
      Makes `CONCEPT.md` §14's Intent pipeline concrete for the first time
      with a real worked example: "Oma" (a naive end-user, no technical
      knowledge) says only "boil me an egg, medium" — the script then walks,
      step by step, everything the deterministic engine already has grounded
      enough to resolve that into a safe, fully-specified execution with
      ZERO further input from her: what an egg even is (`egg.json`), what
      "medium" means in seconds (`EGG_BOIL_DONENESS`), how long the kitchen's
      actual heat source takes to reach boiling (`heat-source.ts`), and why
      a robot cooking unattended needs `SafetyPolicy.mode: "autonomous"`
      rather than the human default (`ENGINE_INVARIANTS.md` #11) for the
      exact same `BOIL` step. **Scoped precisely, not overclaimed**: this
      does NOT implement an LLM, a `RecipeIntentSchema`, or a planner — the
      `Intent` object is GIVEN (hardcoded), matching CONCEPT.md §14's own
      boundary ("LLM's only job is producing a structured Intent") rather
      than building the LLM side. That larger, real, unstarted work is
      Phase 4.5 below — this closes the "prove the deterministic side is
      actually ready to receive an Intent" half, not that phase itself.
- [x] **Verb/transformation refinement pass** — closed 2026-08-13, in
      direct response to "refine the verbs and transformations we have
      now." Rather than restyling existing verbs speculatively, ran a real
      audit: diffed every entity's asserted-true `capabilities` against
      every action's `requiredTargetCapability`/`requiredIngredientCapabilities`/
      `requiredSecondaryCapability`, looking for the exact class of bug
      already found twice this session (`pan.json`'s dead `"hot"`/`"cold"`,
      `potato.json`'s dead `"mashed"`) — an asserted capability nothing ever
      checks. Found 5 hits, and correctly did NOT treat them all the same:
      - **4 were already honestly documented as informational-only**, not
        bugs: `black_pepper.json`/`chili_flakes.json`/`salt.json`'s generic
        `isSeasoning` (deliberately distinct from the verb-specific
        `isSaltySeasoning` — see `salt.json`'s own `capabilityNote`) and
        `egg_yolk.json`'s `isEmulsionStabilizer` (`emulsify.json`'s own
        `eggComparisonNote` already named it informational). Left unchanged
        — "fixing" these by force-wiring them into a check would have
        broken working, correctly-scoped honesty.
      - **1 was real**: `salt.json`'s `isDissolvable` + `"dissolved"` — a
        gap `salt.json`'s own `metadata.notes` had named since before this
        session ("allowedTransformations is empty until a 'dissolve' verb
        exists"). Closed: `data/actions/dissolve.json`, `isDissolvingMedium`
        on `water.json` (its own capability, not a reuse of
        `isBoilingMedium` — same one-capability-per-verb convention as
        `oil.json`'s `isFryingMedium`/`isEmulsifier` split). Names, without
        building, the obvious next real technique this unlocks: a brine is
        exactly "salt dissolved in water," which this repo cannot represent
        beyond the bare `"dissolved"` state (no concentration/ratio, no
        soak-duration model).
      Also audited `retrySafe`/`verification`/`hazards`/`metadata` presence
      across all actions: found `BEAT` was the one real inconsistency (an
      empty `hazards: []` where its close analog `MASH` — same manual,
      repetitive utensil motion — correctly declares a low-severity
      `repetitive_strain` hazard); fixed to match. Confirmed `WASH`/`SALT`/
      `PEPPER`'s own empty hazard arrays are genuinely correct (no
      comparable motion exists), not further inconsistencies — not
      padded just to make every array non-empty. Proven end-to-end: `npm
      run capability-test:dissolve-salt`; full suite re-run for the `BEAT`
      change.

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
- [ ] **Far more staple ingredients/entities.** Still no flour, milk/cheese,
      onion, herbs, sugar, vinegar/acid, or any protein besides egg. The
      vocabulary's technique DEPTH (HACCP, carryover cooking, emulsion
      chemistry) remains disproportionate to its ingredient BREADTH.
      **Partial progress 2026-08-14/15:** a second `isFryingMedium` entity
      (`sunflower_oil.json`, proving `fry.json`'s
      `requiredIngredientCapabilities` check was already substitutable —
      zero engine changes needed) and a first dairy entity (`butter.json`,
      plain/unclarified only) — see `scripts/fry-with-different-fats.ts`
      (`npm run capability-test:fry-different-fats`) and `LEARNINGS.md`
      2026-08-15. Butter's genuinely-lower smoke point (175°C, milk solids
      browning before the fat smokes) is correctly caught by `place.ts`'s
      existing safety check at `crispy_french_fries.json`'s 191°C
      finishing-fry target. Clarified butter/ghee, brown butter, and milk/
      cheese as their own entities remain real, unbuilt gaps.
- [ ] **More common technique verbs.** ~~`SIMMER`~~ **closed 2026-08-13** —
      see "Common culinary knowledge coverage" below. Still open: `WHISK`,
      `STEAM`, `ROAST`/`GRILL`, `MARINATE`, `REST` (post-cook carryover
      exists narrowly for egg via `SHOCK`, not generally), `KNEAD`,
      `STRAIN`/`DRAIN`. **New name added 2026-08-15, found via a real
      recipe bug**: `REMOVE`/`TAKE_OUT` — "physically take this instance
      out of the vessel it's cooking in." `garlic-oil-potatoes.json`'s
      original step order fried garlic, then left it sitting in the hot
      oil through three more (unrelated) potato-prep steps — precisely
      the real mistake a user's own described technique warns against
      ("don't let it rest in the oil, burnt garlic tastes bad"), never
      caught because nothing in this repo models elapsed idle time OR has
      a verb for removing something from a shared vessel. Worked around
      via step reordering (potato prep moved before garlic ever touches
      the oil, so `FRY` potato is the step immediately after garlic
      finishes) — a real improvement, but not the same thing as an actual
      removal action; the gap itself is still open.
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
      **The PHYSICS half closed 2026-08-14** (`src/place.ts`, `PlaceState` +
      `pourInto`/`advanceHeatSeconds`/`isAtBoiling`), once a concrete
      forcing case existed: walking a robot's actual boiling-an-egg sequence
      step by step ("put water in a pan, apply warm till it boils 100°C,
      put the egg in, wait — depending on heat, water amount, and desired
      grade") surfaced exactly this gap again, now with a real dish to build
      against instead of a hypothetical. `place.ts` gives a tool instance a
      real temperature that persists and evolves as a pure function of
      *elapsed simulated time* (not wall-clock — determinism,
      `ENGINE_INVARIANTS.md` #9), reusing `estimatedPreheatSeconds`'s exact
      energy-balance approximation rather than inventing a second one, and
      correctly clamps at `boilingPointC` (latent heat of vaporization —
      further energy goes to phase change, not temperature rise) instead of
      overshooting. Proven via `tests/place.test.ts` (unit) and
      `scripts/boil-egg-as-a-robot.ts` (capability test — `npm run
      capability-test:boil-as-robot`), which ticks real 30s increments and
      polls `isAtBoiling` rather than trusting one precomputed total, the
      concrete thing a robot's own control loop would need to do. **Still
      NOT closed, named explicitly rather than implied covered**: `place.ts`
      is a standalone module, same precedent as `heat-source.ts`/
      `egg-doneness.ts` before it — `applyAction` does not consume it, there
      is still no `FILL`/`POUR`/`PLACE` verb in `data/actions/*.json`, and
      the "instances co-located in one tool instance sharing its state"
      engine concept below is still unbuilt. Two ingredients simmering in
      the same pot still get independent `applyAction` calls.
      **Generalized beyond boiling, same day, once FRY needed it too**:
      `advanceHeatSeconds`/`isAtBoiling` only ever clamped at
      `contentsEntity.thermophysical.boilingPointC` — which oil (`fry.json`)
      doesn't have, and shouldn't (oil never boils at any real cooking
      temperature). `advanceTempSeconds`/`isAtTargetTemp` take an explicit
      `targetTempC` instead, with `advanceHeatSeconds`/`isAtBoiling` kept as
      behavior-preserving thin wrappers over them (zero test changes needed
      for the water/BOIL case). Named explicitly, not blurred: clamping at
      `boilingPointC` represents a real physical ceiling (phase change);
      clamping at a chosen `targetTempC` for oil represents controlled
      heating stopping once a setpoint is reached, a different KIND of
      true. `ingredient.ts` gained `smokePointC` (`ThermophysicalPropertiesSchema`)
      as the real safety mechanism this enables: `advanceTempSeconds`
      REJECTS a target at or above a declared smoke point outright, rather
      than silently heating toward a real fire-risk ceiling. Proven via
      `tests/place.test.ts` and `npm run capability-test:fry-as-robot`
      (`scripts/fry-egg-as-a-robot.ts`) — oil heated to a real 175°C fry
      setpoint with zero changes to `place.ts`'s water-facing API, plus a
      demonstrated rejection of a 220°C target against olive oil's ~200°C
      smoke point.
      **The "place the egg delicately" half partially closed, same day**
      (`boil.json`/`simmer.json`'s new `placementMethod` parameter,
      `egg.json`'s `crackPreventionNote`) — "of course, the robot has to try
      not to break the egg" turned up that a real crack risk has THREE
      separate real mechanisms, not one, each already-or-newly covered by a
      different piece of this vocabulary: mechanical impact at entry
      (`placementMethod`, new), thermal shock at entry (`startMethod`,
      already existed — now cross-referenced as a real, unresolved tension
      against `EGG_BOIL_DONENESS`'s `boiling_start` assumption), and
      turbulence during cooking (`simmer.json`'s pre-existing `whyPerTarget`
      note — `SIMMER` exists specifically as that mitigation). Deliberately
      informational only, same as every other categorical technique
      parameter here — no crack-probability simulation was built or
      implied; a real, un-built escalation (piercing the egg's air-cell end
      before cooking) is named in `boil.json`'s `placementMethodNote` rather
      than silently added as a new mechanism.
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
      **Design input added 2026-08-15**, from a user-supplied
      `WORLD_MODEL_OPTIMIZATION.md` read before scoping the (separate,
      smaller) recipe-player work below: a concrete mechanism for the
      "instances co-located in one tool instance sharing its state" gap
      named above — `Instance.inProgressAction: { actionId, startedAt,
      durationSeconds, estimatedCompletion }`, letting an instance be
      queried as "still cooking" mid-action rather than treating every
      action as instantaneous. Worth keeping as a real design input for
      whenever this phase is actually scoped, alongside that doc's
      `toolLockBehavior` idea (a tool held exclusively for a duration,
      e.g. "can't fry two things in the same pan at once") — neither
      built now, both real and specific enough to be more useful than
      re-deriving the same shape of mechanism from scratch later. That
      doc's separate claim that `COMBINE` "doesn't verify inputs" is
      inaccurate against what's actually built (`combine.json`, closed
      2026-08-12 — real two-input composition with capability
      verification); its actual proposal (3+ input assembly, not just
      two) is a different, real, still-unbuilt extension worth
      distinguishing from that inaccurate framing.
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
- [x] **`INVALID_TRANSITIONS` forbidden-state-transition matrix — closed
      2026-08-15, the repo's own named "single largest unbuilt piece of
      the original spec."** `ingredient.ts`'s `EntitySchema.invalidTransitions`
      (state id -> the state ids this entity may never legally become from
      there) + `engine.ts`'s `applyAction` check against the action's
      actual COMPUTED next state (covers parameter-driven outputs like
      CUT's `shape` for free, not just fixed `transformedState` actions).
      Resolves this file's own long-open "Open dependencies" question —
      literal global matrix (`CLAUDE_DEV_CTX.md`'s own shape) vs.
      generalized from `statePrerequisites` — with a real, forced answer,
      not a preference: **per-entity**, because a global map is actively
      WRONG here, not just less general. `potato.json` forbids
      `boiled -> peeled` (peel.json's own metadata has claimed "cannot
      peel a potato that is already boiled" since this repo's first
      commit, never enforced until now), while `egg.json`'s own
      `statePrerequisites.peel: "boiled"` REQUIRES the exact opposite
      order — a real egg is peeled AFTER boiling. Both are correct for
      their own entity; a single global map keyed by bare state name
      cannot express both at once. See `LEARNINGS.md` 2026-08-15 for the
      full reasoning. Applied to three entities so far, each scoped to
      what's actually true rather than padded to look complete:
      `potato.json` (the full "can't un-cook/un-cut back to peeled" set,
      deliberately EXCLUDING cutting a boiled potato — a real technique
      already gated correctly by `cut.json`'s own `statePrerequisites` —
      and excluding mashed->fried, the real potato-cake path), `egg.json`
      (cut/fried/poached can't revert to peeled/boiled/raw), and
      `egg_cracked.json` (fried/scrambled can't revert to any beaten
      intensity). `scripts/validate.ts` gained a matching hard-fail check
      (a key or forbidden-state value not in the entity's own
      `possibleStates` — the same dead-reference standard
      `producedByproducts`/`byproductsByAction` already hold themselves
      to). Proven, not just typechecked: all 165 unit tests pass
      (3 new, including the potato-vs-egg per-entity-necessity case
      itself as an executable test, not just a claim), `npm run validate`
      still simulates all 12 real recipes end-to-end with zero step
      errors, and the full demo/capability-test sweep is unaffected —
      nothing here was already relying on a transition this now forbids.
      **Still honestly scoped, not overclaimed**: only 3 of this repo's
      ~15 ingredient entities have any `invalidTransitions` authored
      (the field defaults to `{}`, so this is additive, opt-in coverage,
      not a repo-wide audit) — garlic, oil, salt, water, and the
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
      `pan` requirement remains untouched — no forcing case yet. Proven via
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
        safety threshold as a side effect of it. See `LEARNINGS.md`
        2026-08-14.
      - **Cold-start integration, carryover-cooking quantification,
        turbulence quantification — correctly identified by the report
        itself as real, larger, deferred work** ("would need temperature-
        curve integration," "CFD or empirical correlation"), matching this
        file's own existing stance on all three (`egg-doneness.ts`'s cold-
        start gap, `shock.json`'s unquantified carryover note,
        `simmer.json`'s unquantified turbulence note) — confirmed as still
        correctly out of scope, not newly attempted.
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

See also: `architecture_phase4_ticket.md` (2026-08-14) — a detailed milestone
breakdown (planner.ts/goal.ts/domain-model.ts/domain-facts.ts/robot-executor.ts,
M1-M5, acceptance criteria, risk table) elaborating this exact section. Despite
its filename, it is NOT a separate "Phase 4" — it's this Phase 4.5, written up
in ticket form; reviewed for accuracy against the code 2026-08-15.
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
      **Design note added 2026-08-15, `AUTHORING.md` §2**: this is really
      two separate problems, not one. Parsing Cooklang's own syntax
      (`@ingredient{qty%unit}`, `#cookware{}`, `~{timer}`) is mechanical
      and can be built whenever prioritized. Turning step PROSE ("fry the
      potatoes until golden") into this repo's typed `actionId`/
      parameter shape is NOT mechanical — that's the same free-text →
      structured-intent translation `ENGINE_INVARIANTS.md` #10 already
      scopes to an LLM/human proposing a draft, never asserting it as
      valid. The real design payoff: that translator doesn't need its
      own validation logic at all — it only needs to produce a first
      (possibly incomplete/wrong) `RecipeScript` draft and hand it to the
      existing `validate-recipe` loop (`AUTHORING.md` §1), which already
      throws the real alarms needed to iterate a draft toward correct.
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
- ~~Whether `INVALID_TRANSITIONS` should be a literal static matrix (as
  `CLAUDE_DEV_CTX.md` specifies) or generalized from the `statePrerequisites`
  pattern already in use~~ — **resolved 2026-08-15**: per-entity (see Phase
  4's own now-closed entry above and `LEARNINGS.md` 2026-08-15) — potato and
  egg need genuinely contradictory rules under the same bare state names,
  which only per-entity keying can hold at once.
