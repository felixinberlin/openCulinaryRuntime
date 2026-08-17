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
      proven to fire — see `LEARNINGS_DOMAIN.md` 2026-08-13).
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
         enforced beyond an allowedValues/tag check) — see `LEARNINGS_DOMAIN.md`
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
         and corrected (see `LEARNINGS_DOMAIN.md` 2026-08-13).
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
      open too — see this session's chat log / `LEARNINGS_DOMAIN.md` for why each
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
- [x] **Acid — the fourth "Salt, Fat, Acid, Heat" pillar, and real, cited
      flavor-counterbalance data — closed 2026-08-15, triaged from a
      user-supplied Reddit thread** (r/Cooking, "Engineer brain struggling
      with cooking," 760 upvotes, 219 comments, moved to `olddocs/reddit-
      thread-1mo4tj8.md` after triage — see the "Far more staple
      ingredients/entities" entry above for the full triage reasoning and
      `LEARNINGS_PROCESS.md` 2026-08-15 for the methodology). Two real,
      separately-scoped pieces:
      1. **`vinegar.json`** — the first ACID entity in this repo, and
         `data/actions/acid.json` (`ACID`, the fourth SALT-shaped
         seasoning verb, same `addsTag`/`isSeasonable`/timing-parameter
         shape as `SALT`/`PEPPER`/`CHILI`, deliberately not generalized
         into one `SEASON` verb for the same already-documented reason
         those three weren't). Wired to `potato.json`/`egg.json`/
         `egg_cracked.json` only — the exact existing `PEPPER`/`CHILI`
         footprint, not `garlic.json` — matching their own established
         "capable, not forced into an existing dish" discipline rather
         than a new decision. Composition (`water_g: 95`) cited to the
         FDA's own Compliance Policy Guide Sec. 525.825 vinegar
         definition (≥4g acetic acid/100mL; commercial product commonly
         sold at 5%), not a food-composition table — vinegar's
         composition is essentially fully described by its acid
         concentration. No `thermophysical` block, same reasoning
         `black_pepper.json` already gives for omitting one: nothing
         here heats/boils vinegar to a phase-change point, so a density
         figure would be an unused placeholder.
      2. **`src/flavor-balance.ts`** — `FLAVOR_COUNTERBALANCES`, real,
         cited data on how tastes perceptually interact, a genuinely new
         piece of domain knowledge this repo had never represented at
         all (`SensoryPropertiesSchema.taste` records what a taste IS
         per-ingredient, never how one taste affects another). Three
         pairs, at two different honestly-stated confidence tiers, not
         uniform certainty: sweet↔sour mutual suppression and
         salt→bitter suppression are each backed by a real, peer-
         reviewed primary study with a DOI, verified via direct lookup
         this session (Mao et al. 2022, *npj Science of Food*; Breslin &
         Beauchamp 1995, *Chemical Senses*) — the salt/bitter pair's own
         real limit (compound-dependent, not universal — some bitter
         compounds suppressed >70%, others barely at all) is recorded
         as an honest `realWorldCaveat`, not smoothed over. Acid cutting
         through richness is logged at the weaker `commonly_cited_
         unverified` tier on purpose — real, widely-applied technique
         with a plausible mouthfeel-science mechanism (contraction vs.
         coating sensations), but the strongest lead for a primary
         source sat behind a paywall this session and was correctly not
         claimed as verified. `richness` itself is a deliberately named,
         narrowly-scoped exception to the taste-only model (mouthfeel,
         not one of the five basic tastes) — the same reasoning
         `pungent`'s 2026-08-13 addition already established for a
         different real sensory channel, not folded into `bitter` or
         added to `SensoryPropertiesSchema.taste` itself.
      Proven end-to-end, not just schema-valid: `npm run
      capability-test:season-with-acid`
      (`scripts/season-with-acid.ts`) — `ACID` runs against a real fried
      potato, correctly rejects a non-acid ingredient the same way `SALT`
      rejects `black_pepper`, all four seasoning verbs compose on one
      instance, and `counterbalancesInvolving` answers a real query
      ("this is too bitter" → salt) from real data, not prose. 8 new
      unit tests (`tests/flavor-balance.test.ts`); full suite (173
      tests), `npm run validate` (all 12 real recipes, zero step
      errors), `tsc --noEmit`, and the full demo/capability-test sweep
      all clean.
      \
      **Extended 2026-08-16, TICKET 3 of `PAPER_NOTES_2608.04768.md`**:
      `dilutionVolumeToTarget` — the REPAIR direction this file's own
      counterbalance data never had. Given a real over-concentration
      (e.g. an over-salted liquid), computes how much neutral diluent
      brings it back to a target concentration, by conservation of
      solute — the standard general-chemistry dilution relation
      (`REFERENCES.md`), deliberately cited against the physics itself,
      NOT the paper this technique was encountered applied to (a
      preprint is the wrong confidence tier for uncontroversial textbook
      physics — see `LEARNINGS_ENGINE.md` 2026-08-16). Explicitly does
      NOT apply to a dry-seasoned solid (an over-salted fried potato is
      not recoverable this way — no bulk liquid volume to dilute into),
      stated in the function's own doc comment as the honest limit most
      likely to be misapplied. 5 new unit tests.

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
- [x] **Allergens — closed 2026-08-16.** `ingredient.ts`'s `AllergenSchema`
      (the FDA "Big 9": milk/egg/fish/crustacean_shellfish/tree_nuts/
      peanuts/wheat/soybeans/sesame — FALCPA 2004 + the FASTER Act's 2023
      sesame addition) + `EntitySchema.allergens`, populated across every
      real ingredient (`egg`/`egg_cracked`/`egg_yolk`/`egg_white`: `["egg"]`;
      `butter`: `["milk"]`; everything else: `[]`, a real audited claim, not
      an unfilled default). `egg_shell` deliberately carries NONE despite
      being egg's own byproduct — it's discarded, not eaten, and has none of
      the actual allergenic proteins, a real distinction from the parts
      that ARE eaten. `scripts/validate.ts` hard-fails any composite entity
      (a `COMBINE` result) whose `allergens` isn't a superset of its
      components' — the exact "silently dropped on the way into a combined
      dish" failure this gap named as the risk, caught mechanically, not by
      review. Surfaced where it actually matters: `explainRecipe`'s new
      `allergenSummary` (computed from `initialInventory` alone — provably
      complete, not approximate, given the composite superset check above),
      printed prominently in `validate-recipe`'s pre-flight report and as
      its own `## Allergens` section in `narrate-recipe`'s output, ahead of
      tools/ingredients. Proven against every real recipe in this repo via
      `npm run capability-test:allergens`. Deliberately does NOT close: a
      consumer-facing "reject any recipe containing X" CONSTRAINT (this is
      DECLARATION only, not enforcement — a real, further, separate gap);
      the EU's wider 14-allergen list (`AllergenSchema`'s own doc comment
      names this explicitly, chosen against for citation-family consistency
      with this repo's existing FDA/FALCPA-sourced CCP machinery, not
      because the EU list is less correct for this repo's Spanish/EU-
      leaning dishes). Cross-contamination/hygiene (below) remains a
      SEPARATE, deliberately un-conflated gap — this closes what a dish's
      own ingredients contain, not what a shared knife/board might transfer.
- [x] **Cross-contamination / hygiene knowledge.** `HazardSchema` models
      danger to the PERSON performing an action (a blade, hot oil); nothing
      models danger to the FOOD from equipment/surface reuse (same knife for
      raw egg then a ready-to-eat ingredient; a cutting board not washed
      between uses). `CriticalControlPointSchema` is thermal-only by design
      (see `LEARNINGS_DOMAIN.md` 2026-08-12) — this would need a genuinely different
      mechanism, not a stretched CCP.
      **Closed 2026-08-16**, via a genuinely new mechanism, not a stretched
      CCP as predicted above: `src/tool-hygiene.ts`'s `ToolContaminationState`
      — a runner-local `Map<toolInstanceId, ToolContaminationState>`,
      mirroring `place.ts`'s own `PlaceState`/`places` precedent exactly
      (a tool instance carrying real state OUTSIDE `Instance`/`applyAction`,
      since tools have zero per-instance identity in this engine —
      `availableTools` is a flat `Set<string>` of entity ids, confirmed by
      direct inspection before this was built). An opt-in `params.
      toolInstanceId` a step may set (mirroring `placeId`'s pattern) drives
      a pre-check + post-update wrapped around the *existing* `applyAction`
      call in `recipe-runner.ts` (contamination is a discrete fact toggled
      by an ordinary instantaneous action, unlike `FILL`/`HEAT_PLACE`'s
      genuinely continuous shape — no new special-cased verb needed for
      THAT half). A new special-cased verb, `WASH_TOOL`
      (`data/actions/wash_tool.json`), clears it — closing the exact gap
      `wash.json`'s own notes long named and deferred ("a tool's 'clean'
      state doesn't map onto the same tag as an ingredient's"). `isRaw
      ContaminationRisk` (`ingredient.ts`'s new `rawContaminationRiskStates`
      field + a `capabilities.isRawContaminationRisk` flag) resolves
      "capabilities are static, risk is state-dependent" by requiring both;
      set on egg/egg_cracked/egg_yolk/egg_white. Reuses the identical
      Salmonella/USDA citation `egg_cooking.json`/`egg_pasteurization_raw.
      json` already carry (`REFERENCES.md`) for a different, surface-
      transfer pathway of the same organism. `knife.json`'s own dead
      `possibleStates: ["clean","dirty",...]` (`allowedTransformations: []`)
      is deliberately NOT reactivated — that's `Instance`-based machinery
      tools don't have; a cross-reference note was added instead of wiring
      it. **Explicit design decision, not a default**: the user chose an
      ADVISORY warning (`RecipeRunResult.warnings`, mirroring
      `egg_cooking.json`'s `advisoryOnly: true`), not a hard reject like
      `egg_pasteurization_raw.json`'s — a contaminated tool's reuse warns
      but the step still proceeds; this also means the mechanism doesn't
      interact with `SafetyPolicy`'s human/autonomous split at all. Proven
      via `scripts/tool-hygiene-as-a-robot.ts` (`npm run
      capability-test:tool-hygiene`) and `tests/recipe-runner.test.ts`'s new
      describe block. A real, honest finding this surfaced: NO existing
      action in this vocabulary ever let a knife touch RAW egg before this
      change (`CUT` requires 'peeled', which requires 'boiled' first;
      `CRACK`/`SEPARATE`, the only actions touching raw egg, were both
      `requiredTools: []`) — `crack.json` gained an optional
      `toolInstanceId` parameter specifically to make the named scenario
      reachable at all, not just theoretically mechanized. Deliberately NOT
      closed: no cutting-board entity (the proof case only needed `knife`);
      no "is the downstream target ready-to-eat" inference (warns on reuse
      against ANY subsequent food-contact step, not just RTE ones — a real
      simplification, named as such); no general contamination graph beyond
      the four egg-derived entities; no probability/detection modeling. See
      `src/tool-hygiene.ts`'s own top doc comment for the full reasoning and
      `LEARNINGS_ENGINE.md` 2026-08-16 for the design-process notes.
- [ ] **Far more staple ingredients/entities.** Still no flour, milk/cheese,
      herbs, sugar, or any protein besides egg. (Onion closed 2026-08-16,
      vinegar/acid closed 2026-08-15 — both corrected out of this line the
      same change that closed them; see this bullet's own dated entries
      below.) The vocabulary's technique DEPTH (HACCP, carryover cooking,
      emulsion chemistry) remains disproportionate to its ingredient
      BREADTH.
      **Partial progress 2026-08-14/15:** a second `isFryingMedium` entity
      (`sunflower_oil.json`, proving `fry.json`'s
      `requiredIngredientCapabilities` check was already substitutable —
      zero engine changes needed) and a first dairy entity (`butter.json`,
      plain/unclarified only) — see `scripts/fry-with-different-fats.ts`
      (`npm run capability-test:fry-different-fats`) and `LEARNINGS_DOMAIN.md`
      2026-08-15. Butter's genuinely-lower smoke point (175°C, milk solids
      browning before the fat smokes) is correctly caught by `place.ts`'s
      existing safety check at `crispy_french_fries.json`'s 191°C
      finishing-fry target. Clarified butter/ghee, brown butter, and milk/
      cheese as their own entities remain real, unbuilt gaps.
      **Onion closed 2026-08-16** (`data/entities/onion.json` +
      `onion_peel.json`, `data/actions/caramelize.json` — a NEW verb, not
      `FRY` + a parameter, see that file's own reasoning): full
      `possibleStates`/`invalidTransitions` audited at the same per-entry
      rigor as `potato.json`'s 2026-08-16 audit (cut-shapes forbid
      `peeled` at HIGH confidence; `fried`/`baked`/`caramelized` at the
      WEAKER tier; `boiled` deliberately left open — blanch-then-peel
      pearl onions is real, common technique, the same carve-out
      `potato.json` already established). Proven end-to-end via
      `scripts/caramelize-onion-as-a-robot.ts`
      (`npm run capability-test:caramelize-onion`).
      **"Tortilla de patatas CON cebolla" closed the same day, once
      actually asked for**: `data/actions/combine_potato_onion.json` +
      `combine_con_cebolla.json` (two NEW, genuinely distinct
      `COMBINE`-shaped actions, not a generalization of the original
      `combine.json`, which stays untouched — see its own `scopeNote`)
      chain `potato` + `onion` (raw, both sliced — real technique cooks
      them together from raw, not fried separately then merged) into
      `potato_onion_mixture.json`, fried once, then combined a second
      time with beaten egg into `tortilla_mixture_con_cebolla.json` — a
      genuinely distinct composite entity (`structure.components`
      `['potato','onion','egg']`), not the onion-free `tortilla_mixture`
      relabeled. `onion.json` got a dedicated `isCombinableWithPotato`
      capability rather than reusing `egg_cracked.json`'s
      `isCombinableAddition`, specifically so the original `combine.json`
      can never accept an onion instance by accident. One real, named,
      NOT-closed cross-capability ambiguity remains: both `combine.json`
      and `combine_con_cebolla.json` share `requiredTargetCapability:
      isCombinableBase`, so nothing in the engine itself stops a
      malformed recipe from calling the wrong one against the wrong
      target — see `potato_onion_mixture.json`'s own
      `capabilityAmbiguityNote`. Proven end-to-end via
      `data/recipes/tortilla-de-patatas-con-cebolla.json`
      (`npm run recipe -- tortilla_de_patatas_con_cebolla`), simulated
      with zero step errors by `npm run validate`. Flour, milk/cheese
      (beyond plain butter), herbs, sugar, and any protein besides egg
      remain unbuilt.
      **Triaged 2026-08-15 against a user-supplied Reddit thread**
      (r/Cooking, "Engineer brain struggling with cooking," 760 upvotes,
      219 comments — copy-pasted into the repo, moved to
      `olddocs/reddit-thread-1mo4tj8.md` after triage, same discipline as
      the other external reports) — mostly book/YouTube recommendations
      with nothing actionable, but the single most-repeated organizing
      idea across dozens of independent commenters was Samin Nosrat's
      "Salt, Fat, Acid, Heat" framework. Checked against what this repo
      already has: Salt (`salt.json`), Fat (`oil.json`), and Heat
      (`place.ts`/`heat-source.ts`) are all real, structural, first-class
      parts of this vocabulary — **Acid has zero representation**, not
      even as an entry in this bullet's own ingredient list until this
      sentence. Not "one more ingredient among many" the way flour/onion/
      herbs are — the thread's own repeated framing (and this repo's own
      existing salt/fat/heat coverage) makes it the missing fourth pillar,
      re-prioritized above the others in this list. **Closed 2026-08-15,
      same day**: see this section's own new "Acid — the fourth 'Salt,
      Fat, Acid, Heat' pillar" entry above (in this file's own read
      order — the closed-items list this bullet lives under is appended
      to, so the new entry sits earlier on the page despite landing
      later in the session).
- [ ] **More common technique verbs.** ~~`SIMMER`~~ **closed 2026-08-13** —
      see "Common culinary knowledge coverage" below. **`REST` closed
      2026-08-16**, in direct response to a user's real-world correction
      that this repo's tortilla-de-patatas recipes were skipping the real
      combine-then-rest step (`data/actions/rest.json`; also closes the
      independently-named par-fry rest gap for free — see
      `crispy-french-fries.json`'s `restGapNote`). Informational-only
      (`addsTag: "rested"`), matching this vocabulary's existing
      non-causal depth: it does not, and given this engine's total lack
      of per-instance temperature tracking (see `LEARNINGS_ENGINE.md`
      2026-08-16), currently cannot, model the real contact-heat partial-
      cooking effect the rest actually causes — named honestly in
      `tortilla_mixture.json`'s own `rawStateHonestyNote` as a real,
      deliberately-scoped-out deeper alternative, not silently implied
      closed. Still open: `STEAM`, `ROAST`/`GRILL`, `MARINATE`, `KNEAD`.
      **`DRAIN` closed 2026-08-16** (`data/actions/drain.json`) — resolves
      the "does `REMOVE`'s own `strainer_drain`/`poured_out`
      `removalMethod` values already cover this" question this same entry
      raised earlier: no, not for most recipes — `REMOVE` only fires
      against an instance tracked inside a `PLACE`
      (`recipe-runner.ts`'s `placeContents`), and most recipes in this
      vocabulary (including both real forcing cases here) don't use the
      `FILL`/`PLACE_IN`/`HEAT_PLACE` machinery at all. Built standalone
      instead, like `REST` — works on any `isDrainable` instance
      regardless of whether a place is involved. Closes a real, previously
      -missing step in TWO existing recipes: `crispy-french-fries.json`
      and `salted-fried-potatoes.json` both went straight from `FRY` to
      `SALT` with nothing removing clinging surface oil first — real
      technique always drains before seasoning. `method: 'wire_rack'`
      (both recipes) vs. `'paper_towel'` is a real, cited distinction, not
      presentation preference (`REFERENCES.md`) — flat paper towels trap
      steam against the food and produce a real, commonly-observed soggy
      result a wire rack avoids, directly relevant to
      `crispy-french-fries.json`'s whole point. Confirmed in the real run
      log, not just asserted (`npm run recipe -- crispy_french_fries`).
      **`WHISK` closed 2026-08-16** (`data/actions/whisk.json`), closing
      `egg_white.json`'s own long-standing `todo` note ("whipping to
      stiff peaks specifically isn't modeled"). One parameter-driven verb
      (`peakStage`: foamy/soft_peaks/firm_peaks/stiff_peaks — same shape
      as `CUT`'s `shape`), plus `over_whisked` as a TICKET-5-shaped
      terminal failure state, checked against real technique before
      asserting: the whole progression is one-way in BOTH directions that
      matter (no reverting to raw, AND no reverting to an earlier,
      less-developed peak stage either — a real, structural fact about
      denatured/aggregated egg-white protein, not a convention). Scoped
      to `egg_white` only — whipped cream needs the identical mechanism
      once a dairy entity beyond butter exists, not yet built. Directly
      forced a second, real, pre-existing fix found in passing:
      `egg_white.json` had a `'pasteurized'` tag and a note explaining why
      raw whipped white (royal icing, uncooked meringue) needs it, but was
      never actually wired to `PASTEURIZE`/`isPasteurizable` the way its
      `egg_yolk.json` sibling already was — closed the same day, same
      change. Proven via `scripts/whisk-egg-white-as-a-robot.ts`
      (`npm run capability-test:whisk-egg-white`). No real recipe exercises
      it yet — a meringue needs `sugar`, still unbuilt (below).
      **`REMOVE` closed 2026-08-16** (`data/actions/remove.json`, found
      2026-08-15 via the exact real recipe bug this entry names —
      `garlic-oil-potatoes.json` originally fried garlic, then left it
      sitting in the hot oil through three unrelated potato-prep steps,
      precisely the mistake a user's own described technique warns against
      "don't let it rest in the oil, burnt garlic tastes bad"). The fourth
      PLACE-shaped verb (`recipe-runner.ts`'s `handleRemove`, `place_in`'s
      direct inverse): takes an instance out of a place's shared
      `placeContents`, rejecting the removal if the place doesn't exist or
      the instance isn't currently there. Proven two ways: the SUCCESS path
      end-to-end via a new sibling recipe,
      `data/recipes/garlic-oil-potatoes-shared-pan.json` (the real,
      place-aware fix — `garlic-oil-potatoes.json` itself was deliberately
      NOT migrated, see its own updated `removalNote`), and both
      REJECTION paths (never-placed, removed-twice) via
      `scripts/remove-from-place-as-a-robot.ts`
      (`npm run capability-test:remove-from-place`). Deliberately closes
      only the REMOVAL mechanism — the adjacent "nothing models elapsed
      idle time" half of this same original gap (does staying too long in
      a place have any modeled doneness/burn consequence) remains real,
      separate, and still fully open, named explicitly in `remove.json`'s
      own `idleTimeScopeNote` rather than implied closed by this addition.
- [x] **Tortilla FLIP physics, and the real link to FRY's `agitation`
      parameter — closed 2026-08-16.** A direct user question ("is moving
      potato pieces in oil the same logic as flipping a tortilla") plus a
      critical review of a user-supplied external report (which got the
      core physics WRONG — it modeled a mid-cook flip as equivalent to
      simultaneous double-sided heating for the whole duration, the
      physics of fully-submerged frying, not of a sequential flip).
      `tortilla_mixture.json`/`tortilla_mixture_con_cebolla.json` gained a
      REAL, computed `thermophysical` block (COMPUTED from THIS repo's
      own `potato.json`/`egg.json` data via a real, cited 3:1 potato:egg
      mass ratio and the same already-verified Choi-Okos component
      equations, not the external report's ungrounded assumed
      composition — see `REFERENCES.md`), plus a derived `physicalDimensions`
      thickness. `scripts/tortilla-flip-physics-as-a-robot.ts`
      (`npm run capability-test:tortilla-flip-physics`) reuses `heat-
      penetration.ts`'s EXISTING slab model with ZERO code changes to
      compute a real, honest BRACKET on the tortilla's center-doneness
      time — `t_symmetric` (idealized both-faces-from-t=0, a real lower
      bound) `<= t_actual_with_one_flip <= t_singleSided` (never flipped,
      a real upper bound) — rather than a false-precision single number
      for the exact one-flip case, which this repo's one-term
      approximation genuinely cannot compute (it only exposes the CENTER
      temperature, not the full spatial profile a real second stage would
      need as its non-uniform initial condition). Formally names the
      unifying concept as chemical engineering's "surface renewal theory"
      (Danckwerts 1951/Higbie 1935, `REFERENCES.md`): stirring many small
      pieces and flipping one large mass are the same operation — which
      face is exposed to the heat source — at different scales. A real,
      peer-reviewed contact heat-transfer coefficient for potato (512.2
      W/(m²·K)) was also found and logged in `REFERENCES.md` as a
      not-yet-embedded way to eventually tighten `heat-penetration.ts`'s
      own stated Bi→∞ lower-bound caveat — not used here, named as a real
      further possibility.
- [x] **FRY's `agitation` parameter — real science, closed 2026-08-16.**
      The other half of the same investigation thread as the flip physics
      above: why undisturbed fried potato pieces stick together, and why
      over-stirred ones break apart. Two genuinely different mechanisms,
      each with its own real citation, added to `fry.json`'s new
      `agitationNote`: STICKING is starch gelatinization releasing an
      adhesive soluble-starch paste at any unlubricated point of static
      contact (textbook-level, `commonly_cited_unverified`, plus a real
      but scope-flagged pasta-adhesion physics paper cited by analogy);
      BREAKING traces to Binner et al. (2000, peer-reviewed) — cooking
      progressively solubilizes cell-wall pectin, weakening cell-to-cell
      adhesion — with the "therefore stirring breaks it" step named
      explicitly as this repo's OWN inference, not directly cited.
      `potato.json` gained a new `broken` possible TAG (not a state — a
      piece can be simultaneously `fried` and `broken`, an orthogonal
      structural fact, the same distinction `washed` was moved across
      earlier) — TICKET-5-shaped, reachable only as an authored fact, no
      detection mechanism, matching `burned`/`overcooked`'s own discipline
      exactly. Deliberately NOT added to `onion.json`/`garlic.json` (also
      cut+fried) in this pass — named as a real, still-open extension.
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
      get a fully-set white with a sous-vide-creamy yolk. AT THE TIME THIS
      ENTRY WAS WRITTEN, this repo's engine could not express that recipe
      at all, not even informationally — **closed 2026-08-16**, see this
      entry's own dated update below (`data/recipes/periodic-cooking-of-
      eggs.json`) for what's real now vs. what honestly still isn't.
      Concretely
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
      speculatively — see `LEARNINGS_DOMAIN.md` 2026-08-13 for the full reasoning
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
      concrete thing a robot's own control loop would need to do. **Was:
      still NOT closed** — `place.ts` was a standalone module, same
      precedent as `heat-source.ts`/`egg-doneness.ts` before it —
      `applyAction` did not consume it, there was no `FILL`/`POUR`/`PLACE`
      verb in `data/actions/*.json`, and the "instances co-located in one
      tool instance sharing its state" engine concept was unbuilt. Two
      ingredients simmering in the same pot got independent `applyAction`
      calls.
      **THE ENGINE-WIRING HALF CLOSED 2026-08-16** — three real, cited-vocabulary
      verbs (`data/actions/fill.json`, `place_in.json`, `heat_place.json`) plus
      new handling in `src/recipe-runner.ts` (NOT `engine.ts`'s `applyAction`,
      which stays completely unchanged — `advanceTempSeconds` is a genuinely
      continuous, elapsed-time process that `applyAction`'s one-shot
      instantaneous-transition shape doesn't fit; see recipe-runner.ts's own
      top doc comment). `runRecipe` now carries `places: Map<placeId,
      PlaceState>` and `placeContents: Map<placeId, instanceId[]>` — a real,
      runner-local "co-located instances share one place's state" concept,
      proven two ways: `data/recipes/two-eggs-shared-pot.json` (two eggs
      `PLACE_IN`'d into one pot, `HEAT_PLACE`'d exactly ONCE, both `BOIL`
      steps referencing that same `placeId` — `npm run recipe --
      two_eggs_shared_pot`, also simulated by `npm run validate`) and
      `scripts/shared-pot-heat-as-a-robot.ts` (`npm run
      capability-test:shared-pot-heat`), which runs the SAME mechanism under
      BOTH `boiling_start` and `cold_start` step orderings side by side —
      `boil.json`'s `startMethod` parameter is, for the first time, actually
      EXPRESSIBLE as real step order (PLACE_IN before vs. after HEAT_PLACE),
      not just an informational string. `BOIL`/`SIMMER` steps that opt in via
      a new `params.placeId` now get a REAL readiness check
      (`recipe-runner.ts`'s `assertPlaceReady`) against the place's actual
      `currentTempC` — reading SIMMER's own declared `waterTempC` numericRange
      rather than a duplicated magic number — closing `simmer.json`'s own
      long-standing `knownModelingGap` note ("doesn't actually know or enforce
      that the water is holding 85-96°C, only that the number a caller
      supplied falls in that band") for real, not just naming it. Fully
      additive: a step that never sets `params.placeId` is completely
      unaffected — every recipe authored before this change (all 12 prior
      ones) still simulates identically; see `tests/recipe-runner.test.ts`'s
      new "FILL/PLACE_IN/HEAT_PLACE" and "opt-in params.placeId readiness
      check" describe blocks (11 new tests) and `LEARNINGS_ENGINE.md`
      2026-08-16 for the design tradeoffs (why runner-level, not
      `applyAction`-level; why the medium's shared temperature only, not the
      placed food's own internal temperature).
      **Still NOT closed, named explicitly rather than implied covered**: ~~no
      `FRY`/oil case (`fill.json`/`heat_place.json` both require
      `isBoilingMedium`, not `isFryingMedium` — `place.ts`'s own
      `advanceTempSeconds` already supports oil generically, per
      `fry-egg-as-a-robot.ts`, only this wiring doesn't yet — see
      `fill.json`'s own `scopeNote`)~~ **CLOSED 2026-08-16, same day, shortly
      after the water/BOIL case**: `fill.json`/`place_in.json`/`heat_place.json`'s
      `requiredTargetCapability`/`requiredToolCapabilities` generalized from
      `isBoilingMedium`/`isDeepVessel` to a genuinely medium-agnostic
      `isPourable`/`isVessel` — both `water.json` AND `oil.json` assert
      `isPourable`, `pot`/`pan`/`saucepan`/`wok` all assert `isVessel` (see
      either entity's own note for why this needed to be its own, weaker
      shared capability rather than overloading the verb-specific ones).
      `recipe-runner.ts`'s `assertPlaceReady` gained a `fry` branch reading
      `fry.json`'s own declared `oilTempC` numericRange MINIMUM (same
      "read the declaration, don't duplicate the number" discipline the
      `simmer` branch already used) rather than a fixed ceiling the way
      `boil`'s check uses `boilingPointC` — a deliberate, named distinction:
      oil has no phase-change ceiling to clamp against, only a chosen
      readiness floor. `place.ts`'s own `advanceTempSeconds` had already
      supported oil generically since 2026-08-14 (`fry-egg-as-a-robot.ts`) —
      this was purely the schema-level gate catching up to physics that
      already worked underneath it. Proven via
      `data/recipes/fried-egg-shared-pan.json` (a real place-aware variant of
      `huevo-frito.json`, same 90s/runny/puntilla parameters) and
      `scripts/shared-pan-heat-as-a-robot.ts` (`npm run
      capability-test:shared-pan-heat`), which shows a `FRY` step REJECTED
      while oil is still cold — even though the pre-existing
      `availableIngredientInstanceIds` presence check alone would have let it
      through — and accepted once `HEAT_PLACE` actually reaches 175°C. Two
      new unit tests in `tests/recipe-runner.test.ts`.
      **`PAR_FRY` closed 2026-08-17** — `assertPlaceReady`'s `fry` branch
      widened to `action.id === "fry" || action.id === "par_fry"` rather
      than duplicated, since it already reads the oilTempC range off
      whichever `Action` is actually running: `par-fry.json`'s own
      genuinely narrower/hotter 145-165°C floor (vs. `fry.json`'s
      120-200°C) is picked up correctly with zero further branching.
      Proven via `scripts/par-fry-shared-pan-as-a-robot.ts` (`npm run
      capability-test:par-fry-shared-pan`), which shows 130°C — comfortably
      inside FRY's own band — still correctly REJECTED for PAR_FRY, and
      150°C succeeding.
      **Still genuinely open**: the placed
      food's own internal temperature is still not modeled
      (`heat-penetration.ts`'s separate, potato-only concern, untouched); no
      batch-size/thermal-mass coupling between a cold item dropped in and the
      place's own tracked temperature (`fry-egg-as-a-robot.ts`'s own closing
      note names this same gap, still open); no `Instance.inProgressAction`/
      `toolLockBehavior` (`WORLD_MODEL_OPTIMIZATION.md`'s design input, this
      same entry, 2026-08-15).
      **The periodic/alternating-temperature recipe CLOSED 2026-08-16** —
      `data/recipes/periodic-cooking-of-eggs.json`, the real, direct proof
      against Di Lorenzo & Di Maio's "Periodic cooking of eggs" case, and the
      LAST item this entry's own opening paragraph named as "the one real
      source in this repo with no corresponding data/code" — a genuinely
      real gap closed, not a hypothetical filled in. First, an honest
      structural finding, checked directly against `place.ts`'s own code
      before assuming the naive approach ("just call `HEAT_PLACE` with
      alternating targets") would work: it wouldn't — `advanceTempSeconds`
      can ONLY ever heat a place UP toward a target (a silent no-op if the
      target is at or below the current temperature, since a
      `heatSourceProfile` is strictly a positive energy source; there is no
      cooling/refrigeration concept anywhere in this vocabulary), so cycling
      ONE pot's temperature down to 30°C 8 times is not mechanically
      possible at all. Built instead — and more faithfully to the real
      technique — as TWO SEPARATELY, PERSISTENTLY maintained pots (one
      `FILL`ed+`HEAT_PLACE`d to 100°C once; one `FILL`ed with `startTempC:
      30` and never actively heated), with the egg physically moved between
      them 16 times via `PLACE_IN`/`REMOVE`, each 2-minute dwell represented
      by `REST` (which required `egg.json` gaining `isRestable` for the
      first time, and `rest.json`'s own `durationSeconds` range being
      honestly WIDENED from 300-1800s to 120-1800s for this real, cited,
      shorter third use case — see that file's own updated
      `durationSecondsNote`). Simulated end-to-end with zero step errors
      (51 steps) on the first run; `narrate-recipe.ts`'s own computed
      `statedActiveDurationSeconds` independently confirms the total sums
      to exactly 1920s = 32.0 minutes, matching the paper's own stated
      total, not just asserted in prose. Three real, honestly-named
      limitations this recipe does NOT close, in its own `knownGapsNote`:
      the egg's own engine STATE stays `"raw"` throughout (no per-instance
      temperature tracking exists anywhere in this engine, the same
      limitation `tortilla_mixture.json`'s `rawStateHonestyNote` already
      names); no CCP ever fires (this recipe never calls
      `BOIL`/`FRY`/`POACH`/`PASTEURIZE`, so — unlike every other egg recipe
      in this vocabulary — no food-safety threshold is verified here at
      all); and the cold bath's 30°C is asserted via `FILL`'s `startTempC`,
      not actively re-verified as still holding after repeatedly absorbing
      heat from a hot egg (the same missing hot-object-into-cooler-medium
      coupling `fry-egg-as-a-robot.ts`'s own closing note already names).
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
      botulism note, `LEARNINGS_DOMAIN.md` 2026-08-12 — but nothing general exists:
      no "how long is this safe/good for" anywhere).
- [x] **Yield/waste factors — closed 2026-08-16.** `producedByproducts`
      recorded WHAT spawns, never HOW MUCH — `ingredient.ts`'s new
      `YieldFractionSchema` (`Entity.typicalYieldFractionOfParent`, placed
      on the BYPRODUCT entity itself) closes it: a real, cited range
      (never a single guessed point value — real yield varies by cultivar/
      size/method) of what fraction of the PARENT's mass this byproduct
      typically represents. Populated on all 6 real byproduct entities:
      `potato_peel` (10-25%, FAO refuse table), `garlic_peel` (1-3%, a
      single-CLOVE estimate — deliberately NOT the ~24-25% figure common
      in garlic-processing literature, which measures a whole-BULB
      including outer wrapper layers, a genuinely different physical scope
      than `garlic.json`'s own clove-level modeling; named explicitly as a
      real scope-mismatch risk avoided, not silently picked for looking
      more official), and `egg_shell`/`egg_yolk`/`egg_white`/`egg_cracked`
      (10-12% / 30-33% / 57-58% / 88-90%, convergent egg-composition
      sources — the first three sum to ~100%, corroborating each other;
      `egg_cracked`'s figure is derived as `1 - shell`, not independently
      sourced). See `REFERENCES.md` for all citations.
      \
      `scripts/validate.ts` cross-checks `ofParentEntityId` against the
      REAL `producedByproducts`/`byproductsByAction` relationship (hard
      fail on a mismatch — checked by deliberately breaking one and
      confirming the fail fires, not just reasoning about the code), plus
      a soft NOTE if a `destroysTarget` action's (`SEPARATE`/`CRACK`)
      byproduct fractions don't sum to roughly 100%. That sum-check is
      DELIBERATELY SKIPPED for a non-destroying action's byproducts
      (`PEEL`) — a real, structural distinction found while writing the
      check, not obvious going in: `PEEL` keeps most of the parent's mass
      AS the same (now-trimmed) instance, not as a separate byproduct
      entity, so a small byproduct fraction (potato_peel's 10-25%) is
      correct, not a sign of missing data the way it would be for a
      fully-destroyed egg. Deliberately data-only: nothing in
      `engine.ts`'s `applyAction` reads this to compute a spawned
      instance's actual mass — this repo has no general quantity-tracking
      through the engine at all, named explicitly rather than implied.
      4 new unit tests (`tests/ingredient.test.ts`).

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
