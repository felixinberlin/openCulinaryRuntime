# ROADMAP_KNOWLEDGE.md

**Split out of `ROADMAP.md` 2026-08-17** once that file passed 3,200 lines and
this single section — "Common culinary knowledge coverage" — accounted for
over half of it (1,673 of 3,221 lines), the same size-driven split
`LEARNINGS.md` got on 2026-08-15 for the identical reason. Content moved
verbatim (checked, not rewritten) — this is `ROADMAP.md`'s own
"Common culinary knowledge coverage" section, continued here rather than
inline. `ROADMAP.md` itself keeps the "Why this exists" framing, the
capability-tests table, and the structured Phase 0-10 breakdown; this file
is specifically the closed/open ledger of real-world cooking-domain
coverage — ingredients, technique verbs, HACCP facts, and the epics (heat-
as-a-place, DAG execution, baking, ...) that grew out of answering "get all
the common knowledge for cooking reflected in system and schemas."

Read `ROADMAP.md` first — it says which file matches what you're touching.
Everything below is unchanged from where it originally lived in that file.

---

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
- [x] **Generalizing `SALT`/`PEPPER`/`CHILI` into one parameter-driven
      `SEASON` verb — closed 2026-08-17.** Deferred since 2026-08-13 on
      "engine work is explicitly paused" — stale by this point in the
      session (the DAG-execution ticket, `in-progress-action.ts`, and
      `checkStatePrerequisite`'s secondary-instance fix all touched
      `engine.ts` first), so revisited once real engine work was already
      back on the table. Both of this entry's own named blockers actually
      built: `action.ts` gained `outputs.addsTagFromParameter` (a
      deliberate, NAMED adaptation of `transformedStateFromParameter`'s
      pattern, not a literal reuse — a raw parameter-value passthrough
      doesn't work here, since the real tags
      ("salted"/"peppered"/"chili_seasoned"/"acidified") aren't the same
      strings as the values that select them
      ("salt"/"pepper"/"chili"/"acid"), so this carries an explicit
      value-to-tag map instead) and `requiredIngredientCapabilityFromParameter`
      (the required capability is looked up from the parameter value
      actually supplied, and — the real, additional thing a fixed list
      structurally cannot offer — `engine.ts`'s `applyAction` now reports
      WHICH specific ingredient instance satisfied it, a new
      `ExecutionResult.matchedIngredientInstanceId` field). New
      `data/actions/season.json` reuses the EXACT four existing capability
      flags (`isSaltySeasoning`/`isPepperySeasoning`/`isSpicySeasoning`/
      `isAcid`) and existing `timing` parameter — every seasoning entity
      already in this vocabulary (salt/kosher_salt/flaky_salt/
      black_pepper/chili_flakes/vinegar) works with `SEASON` immediately,
      zero data changes. Deliberately ADDITIVE, not a migration:
      `salt.json`/`pepper.json`/`chili.json`/`acid.json` are unchanged and
      still what all 18 real seasoning-using recipes actually call —
      rewriting those would be pure churn for zero functional gain, the
      identical call the DAG-execution ticket made about not migrating
      `RecipeStep`'s array representation. Proven via 7 new unit tests
      (`tests/engine.test.ts`, synthetic fixtures — including the real bug
      a flat `requiredIngredientCapabilities` list could not catch: asking
      for `seasoningType: "salt"` while only chili flakes are on hand must
      fail specifically, not just "no ingredient present") and
      `scripts/season-as-a-robot.ts`
      (`npm run capability-test:season-verb`) — one real potato instance
      seasoned all four real ways through the one new verb, tags
      accumulating coherently.
- [x] **Salt crystal/grind size as distinct products — closed 2026-08-17.**
      (Pepper's own whole/cracked/ground progression was already
      partially modeled via `CRUSH` before this session and is
      untouched — this closes the salt half specifically, which this
      entry's own original wording named as the actually-missing piece:
      "salt itself is still one undifferentiated entity.") Two new real
      entities, `kosher_salt.json` and `flaky_salt.json`
      (Maldon-style finishing salt), alongside `salt.json` (now
      explicitly documented as fine TABLE salt) — all three assert the
      identical `isSaltySeasoning` capability and are fully
      interchangeable wherever `SALT` is called for, correctly: this
      engine has no volume-to-mass computation anywhere to catch a real
      substitution error, so nothing SHOULD reject the substitution
      either — proven directly, not assumed
      (`scripts/salt-crystal-size-as-a-robot.ts`'s own step 1).
      \
      The real substance of this gap — three genuinely different
      grams-per-teaspoon figures for the identical sodium-chloride
      substance (table salt ~6g/tsp, kosher salt 3-5g/tsp depending on
      brand, flaky sea salt 2-3g/tsp — a real, well-known professional-
      kitchen fact, checked via convergent sources, `REFERENCES.md`) —
      is what actually forced a real engine decision, not just three new
      data files: `EntitySchema` gained its own `domainFacts` field
      (`ingredient.ts`), extending `DomainFactSchema` beyond
      `CriticalControlPointSchema`-only for the first time since it was
      closed 2026-08-16. That closure deliberately did NOT extend to
      `EntitySchema` at the time — a repo-wide grep found no second real
      case then (`LEARNINGS_ENGINE.md` 2026-08-17) — and this is exactly
      that second real case, arriving organically rather than being
      speculatively pre-built. `src/query.ts` gained the matching
      `answerAboutEntityDomainFact` (the `EntitySchema` sibling of the
      existing `answerAboutDomainFact`) and `scripts/ask.ts` a new
      `entity-fact` subcommand (`npm run ask -- entity-fact kosher_salt
      gramsPerTeaspoon`), both proven, not just added
      (`npm run capability-test:salt-crystal-size`). `flaky_salt.json`
      also carries a real, correct, DIFFERENT fact: `isDissolvable:
      false` (explicit, not omitted) — real technique uses it almost
      exclusively as a finishing salt, sprinkled on for crunch after
      cooking, not dissolved into a cooking medium the way table/kosher
      salt commonly are. 3 new unit tests
      (`tests/ingredient.test.ts`). Still NOT closed, named rather than
      implied covered: no automatic volume-to-mass conversion anywhere
      in this engine (`QuantitySchema`'s `"precise"` kind never converts
      between its own units — the real risk this gap makes VISIBLE and
      QUERYABLE, not prevented); `flaky_salt.json`'s `isDissolvable:
      false` is not cross-checked against `SALT`'s own
      `requiredIngredientCapabilities` (it would still nominally accept
      a flaky-salt "dissolve into a brine" use case that isn't realistic
      technique — a real, named simplification); brand-level granularity
      within kosher salt (Diamond Crystal vs. Morton specifically) is
      deliberately NOT modeled as separate entities, presented as a real,
      honest combined range instead.
- [x] **Triaged 2026-08-17 against a user-supplied "300 Common Sense
      Cooking Rules" document** (300 numbered tips across 10 sections —
      prep, knife safety, heat/pan control, seasoning, food safety,
      cleaning, baking foundations, meat/fish, vegetables, troubleshooting
      — copy-pasted into the repo, moved to
      `olddocs/300_common_sense_cooking_rules.md` after triage, same
      discipline as the Reddit-thread/scientific-review/tortilla-physics
      triages above). Every rule cross-checked against this repo's actual
      current state (not assumed) before acting. Three genuinely new,
      real, cited gaps found and closed:
      1. **Rule #253 — steam-dry a boiled potato before mashing.** Surface
         water dilutes butter/milk and produces a gluier mash; a brief
         uncovered rest lets it evaporate first. Generalized two existing
         verbs beyond their original oil/fry forcing cases rather than
         adding new ones: `data/actions/drain.json` (already liquid-
         agnostic in principle, now explicitly documented and given a
         matching `hot_liquid` hazard entry alongside its existing
         `hot_oil` one) and `data/actions/rest.json` (duration floor
         widened from 120s to 60s — the fourth widening of this range,
         `durationSecondsNote`). `data/entities/potato.json` gained a
         `steamDryBeforeMashNote`. Proven by this repo's first real
         recipe to actually exercise `MASH` (built 2026-08-13, never
         previously used): `data/recipes/mashed-potatoes.json`
         (`npm run recipe -- mashed_potatoes`), plus
         `npm run capability-test:cooking-common-sense`.
      2. **Rule #255 — pierce a whole potato before baking.** Checked and
         honestly CALIBRATED rather than reflexively added as a hazard:
         the same Idaho Potato Commission already cited elsewhere in
         `potato.json` characterizes oven-explosion from an unpierced
         potato as real but unlikely, so this was recorded as
         informational technique context only
         (`potato.json`'s `pierceBeforeBakeNote`), deliberately NOT as a
         new `HazardSchema` entry — adding one would have overstated a
         rare event.
      3. **Rules #99/#113 — whole vs. ground black pepper's real,
         dramatically different shelf life.** Closes `black_pepper.json`'s
         own long-standing `flavorChemistryNote` admission that no
         shelf-life mechanic existed anywhere in this repo. New
         `storageLifeByState` entries: whole ~36-48 pantry months, ground
         ~12-24 (roughly 2-3x shorter for the identical substance — an
         intact peppercorn shell protects the volatile oils that grinding
         immediately exposes). `cracked` deliberately left uncited rather
         than interpolated.

      The great majority of the other ~297 rules were either already
      covered by this repo's own existing, independently-cited work
      (simmer-vs-boil, carryover cooking, smoke points, cold-start potato
      boiling, flaky finishing salt — confirmed, not re-built), genuinely
      out of this vocabulary's current ingredient scope (meat/fish/
      yeasted baking), or generic kitchen-safety/cleaning advice this
      schema doesn't model at the per-technique level at all — named
      honestly rather than implied covered. Full verification sweep (tsc/
      test/validate/every capability-test + demo) clean, zero
      regressions. See `LEARNINGS_PROCESS.md` 2026-08-17 for the triage
      methodology.
- [x] **Triaged 2026-08-17 against a SECOND, differently-scoped
      user-supplied document, "300 Common-Sense Cooking Rules"**
      (hyphenated title — a distinct file from the generic-tips one
      immediately above, moved to `olddocs/` after triage, same
      convention). Where the first document was mostly new domain FACTS,
      this one is a 300-item restatement of physical-feasibility
      CONSTRAINTS ("you cannot chop water," "you cannot peel an
      already-peeled potato") — the same claim `CLAUDE_DEV_CTX.md`'s own
      INVALID_TRANSITIONS concept already exists to enforce, at the
      individual-rule level. Checked, not assumed: the overwhelming
      majority (~290+ of 300) either reference ingredients entirely
      outside this vocabulary's real scope (meat/fish/bones/citrus/
      coconut/nuts/shrimp/chicken/dough/gelatin/chocolate/pasta/rice/
      corn), or are already provably enforced by this engine's existing
      mechanisms — proven, not asserted, via
      `scripts/physical-feasibility-rules-as-a-robot.ts`
      (`npm run capability-test:physical-feasibility-rules`), which
      exercises three different real mechanisms this schema actually has
      (`requiredTargetCapability` gates on WASH/CUT/GRATE; the structural
      entity-spawn destruction SEPARATE/CRACK already rely on;
      `invalidTransitions`, already exhaustively audited elsewhere by
      `invalid-transitions-as-a-robot.ts` and not re-duplicated here).
      One genuine, real, scoped gap WAS found and fixed: rule #29 ("You
      cannot drain a completely dry ingredient") — `potato.json`'s
      `statePrerequisites` had no `drain` entry at all (`DRAIN`, added
      2026-08-16, postdates this entity's last `statePrerequisites`
      audit), so `DRAIN` was callable on a raw, never-cooked-in-liquid
      potato with nothing clinging to remove. Fixed: `statePrerequisites.
      drain` now requires one of `boiled`/`par_fried`/`fried`/
      `alkaline_parboiled` — see `potato.json`'s own
      `drainStatePrerequisiteNote`. Full verification sweep (tsc/test/
      validate/every capability-test + demo) clean, zero regressions —
      including both real recipes that already call `DRAIN`
      (`mashed-potatoes.json` after `boiled`, `crispy-french-fries.json`/
      `salted-fried-potatoes.json` after `fried`), confirming the new
      prerequisite doesn't break the states real technique already uses.
- [x] **Self-authored common-sense cooking rules, 2026-08-17** (not
      triaged from any external document — written directly by auditing
      this repo's own real entities/actions/recipes for the exact class of
      gap the drain fix above found: a newer action's real prerequisites
      not yet checked against an older entity, or — new this time — not
      checked against a SECONDARY instance at all). Two genuine, real,
      structural gaps found and fixed, proven via
      `scripts/self-authored-common-sense-rules-as-a-robot.ts`
      (`npm run capability-test:self-authored-rules`, 15/15 passing) plus
      a new `tests/engine.test.ts` unit test (synthetic fixtures, matching
      this repo's own `npm test`/`npm run validate` split):
      1. **"You cannot rest a raw, never-cooked potato."** `potato.json`'s
         `isRestable` had no `statePrerequisites.rest` entry at all — REST
         is, per `rest.json`'s own `genericityNote`, always POST-cook
         settling in every real use case this vocabulary has, and a raw
         potato has no residual heat or clinging moisture to settle.
         Fixed: `statePrerequisites.rest: ['boiled','par_fried']` — the two
         states this repo's own real recipes actually rest a potato from.
         Deliberately does NOT touch `egg.json`'s own `isRestable` (its
         real use case, `periodic-cooking-of-eggs.json`, genuinely spans
         `raw` too — a periodic warming cycle, not post-cook settling) or
         `tortilla_mixture{,_con_cebolla}.json`'s (only one state, `raw`,
         is ever available before REST in their own real recipes anyway).
      2. **"You cannot combine an unprepped secondary ingredient."** A
         DEEPER, engine-level gap, not a data-only fix: `src/engine.ts`'s
         `applyAction` checked `requiredSecondaryCapability` (a static,
         entity-level boolean) on a COMBINE-shaped action's secondary
         instance, but never checked that instance's actual CURRENT
         state — so a raw, unpeeled whole onion could satisfy
         `COMBINE_POTATO_ONION`'s secondary slot, and a never-beaten
         `egg_cracked` could satisfy `COMBINE`'s/`COMBINE_CON_CEBOLLA`'s,
         even though `potato.json`'s/`onion.json`'s own metadata already
         claimed the real prep order was enforced (it wasn't, for the
         secondary side). Fixed by extracting the existing primary-target
         state check into a shared `checkStatePrerequisite` helper
         (`src/engine.ts`) and calling it for the secondary instance too —
         reusing the SAME `Entity.statePrerequisites` map, keyed by the
         same action id, no new schema field, safe because no entity used
         as a secondary here (`onion.json`, `egg_cracked.json`) is ever
         the PRIMARY target of that same action. Three new data entries:
         `onion.json`'s `statePrerequisites.combine_potato_onion:
         'sliced'`; `egg_cracked.json`'s `statePrerequisites.combine`/
         `combine_con_cebolla: ['beaten','well_beaten']` — closing a
         SEPARATE, real documentation bug found along the way:
         `egg_cracked.json`'s own `combineNote` had claimed this couldn't
         be expressed at all ("statePrerequisites only supports one exact
         required state string"), a claim already stale by 2026-08-17
         (array-valued OR-logic entries have existed since 2026-08-15).
         Structural, not just a three-entity patch: any FUTURE action
         adding `requiredSecondaryCapability` gets this check automatically.
      Full verification sweep (tsc/test — 308/308/validate/every
      capability-test + demo) clean, zero regressions, including every
      real recipe that calls `REST`, `COMBINE`, `COMBINE_CON_CEBOLLA`, or
      `COMBINE_POTATO_ONION` (`mashed-potatoes.json`,
      `crispy-french-fries.json`, `tortilla-de-patatas.json`,
      `tortilla-de-betanzos.json` — note its own `well_beaten` intensity,
      a genuinely different valid state from the other two recipes'
      `beaten`, both correctly accepted — and
      `tortilla-de-patatas-con-cebolla.json`). See `LEARNINGS_PROCESS.md`
      2026-08-17 for the audit method.

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
- [ ] **Far more staple ingredients/entities.** Still no flour, cheese,
      herbs, sugar, or any protein besides egg. (Onion closed 2026-08-16,
      vinegar/acid closed 2026-08-15, milk closed 2026-08-17 — all
      corrected out of this line the same change that closed them; see
      this bullet's own dated entries below.) The vocabulary's technique
      DEPTH (HACCP, carryover cooking, emulsion chemistry) remains
      disproportionate to its ingredient BREADTH.
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
      with zero step errors by `npm run validate`. Flour, cheese, herbs,
      sugar, and any protein besides egg remain unbuilt.
      **Milk closed 2026-08-17** (`data/entities/milk.json`) — this
      repo's first dairy LIQUID (`butter.json` is dairy but solid/semi-
      solid), real forcing case: `mashed-potatoes.json` cited "dilutes the
      butter/milk added during mashing" in its own notes since the day it
      was written without actually containing any milk — a real,
      previously-unnoticed gap. `milk.json` and `butter.json` both now
      assert a new, shared `isMashEnrichment` capability — deliberately
      NOT wired as a `requiredIngredientCapabilities` entry on
      `mash.json`: a plain, unenriched mash is real, valid technique too,
      so making enrichment mandatory would incorrectly block it, the same
      "physical feasibility only, not culinary preference" restraint this
      vocabulary holds everywhere. Real composition/thermophysical/
      `storageLifeByState` citations (USDA FoodData Central, USDA
      FoodKeeper — `REFERENCES.md`); `possibleStates: ['cold','warmed']`
      names the real "warm the milk before adding" technique honestly as
      unmodeled (no dedicated WARM action exists — INFUSE/BOIL/SIMMER
      don't fit, they're built around a target ingredient being processed
      IN the liquid, not the liquid itself being gently warmed alone).
      Proven via `npm run recipe -- mashed_potatoes` (re-run end-to-end
      with `milk-1` now in the MASH step's `availableIngredientInstanceIds`,
      zero step errors) — no new capability-test script needed, the real
      recipe itself is the proof.
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

- [x] **Baking epic — flour/dough/KNEAD/PROOF, opened AND given a real
      v1 close, 2026-08-17.** Deliberately tracked as its OWN epic, not
      folded into the ordinary staple-ingredient bullet above — a direct
      user call ("do the whole baking logic... should we make it
      special?"), confirmed rather than assumed: dough is a genuinely new
      COMPOSITE-with-emergent-behavior concept (gluten network, gas
      retention), not just another ingredient with states, and `KNEAD`
      had been sitting explicitly blocked in this file since the earliest
      sessions for exactly that reason.
      \
      **What's real:** `data/entities/flour.json` (USDA-cited
      composition, `rawContaminationRiskStates` — real, FDA/CDC-
      documented raw-flour E. coli risk, same mechanism as raw egg) and
      `data/entities/yeast.json` (`isLeaveningAgent`, reuses
      `data/actions/dissolve.json` for proofing-in-water rather than
      inventing a new verb — see that entity's own `dissolveReuseNote` for
      why that's an honest simplification, not a hack). New
      `data/actions/combine_dough.json` (a THIRD `COMBINE`-shaped action,
      dedicated `isDoughBase`/`isDoughLiquid` capabilities — flour.json's
      own, and a new one added to `water.json` — so this can never be
      satisfied by the wrong secondary ingredient, the same discipline
      `combine_potato_onion.json`'s own `isCombinableWithPotato` already
      established) spawns `data/entities/dough.json` — this repo's
      SECOND-ever composite entity (after `tortilla_mixture.json`),
      composition COMPUTED from `flour.json`/`water.json`'s own already-
      cited data at a real, commonly-cited 65% hydration, not externally
      asserted. New `data/actions/knead.json` (real windowpane-test
      citation, Peter Reinhart's *The Bread Baker's Apprentice*,
      `developmentLevel` parameter; ACTIVE, hands-only, no work-surface
      tool modeled at this vocabulary's granularity) and
      `data/actions/proof.json` (bulk fermentation; PASSIVE, real
      commonly-cited 30-90 minute room-temperature range — no
      temperature-dependence model, named honestly as unmodeled, same
      depth limit as every other technique parameter here).
      `data/entities/butter.json`/`data/entities/milk.json` both gained
      a shared `isMashEnrichment` capability the same change (closing a
      small, related, previously-decorative gap:
      `mashed-potatoes.json`'s own `availableIngredientInstanceIds` for
      MASH were never actually validated as real enrichment ingredients
      until now — deliberately NOT made a hard `mash.json` requirement,
      since a plain unenriched mash is real, valid technique too).
      \
      **The real anchor dish**: `data/recipes/simple-flatbread.json` —
      deliberately UNLEAVENED (flour + water + salt, kneaded, rested,
      pan-fried), a real, complete, correct dish in its own right (real
      roti/chapati/tortilla-de-harina technique), not a lesser proof —
      chosen specifically because it sidesteps the one real, honestly-
      named engine limit this epic surfaced: `COMBINE`-shaped actions in
      this engine only ever merge TWO instances (target + secondary) into
      one, so a genuinely LEAVENED bread (flour + water + yeast, three
      real inputs) cannot be expressed as ONE valid `RecipeScript` yet —
      the exact "3+ input assembly" gap a user-supplied
      `WORLD_MODEL_OPTIMIZATION.md` read already named as a real, separate,
      unbuilt extension (`LEARNINGS_ENGINE.md`'s own entry on that
      document). Every individual LEAVENED-path mechanism is still real
      and independently proven, not blocked — yeast activation (DISSOLVE),
      KNEAD's own state-prerequisite correctness (a second KNEAD call on
      already-kneaded dough correctly rejected), and PROOF (kneaded ->
      proofed, the state only a real leavened dough reaches) — via
      `scripts/bake-bread-as-a-robot.ts`
      (`npm run capability-test:bake-bread`), the same "prove the
      mechanism directly, even without full recipe-runner wiring"
      precedent `execution-bounds.ts`/`in-progress-action.ts` already
      established.
      \
      **Deliberately NOT done, named rather than silently scoped out:**
      the 3+-input `COMBINE` extension itself (the real next slice for a
      true leavened-bread recipe); a `SHAPE` action (real bread is shaped
      between bulk ferment and a second, shorter "final proof" — this
      epic represents only ONE proof stage); fermentation-rate/
      temperature-dependence for PROOF; bread-flour/cake-flour protein-
      content variants (`flour.json`'s own `proteinContentNote`); a
      dedicated raw-flour CCP with a computed hold time (the real risk is
      handled via `rawContaminationRiskStates` — a surface-contact risk,
      not a cook-to-temperature threshold, since normal baking already
      far exceeds any real pathogen-kill requirement for this specific
      risk). Full verification sweep (tsc/test/validate/lint/format,
      every capability-test + demo) clean, zero regressions.
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
      closed. **`ROAST` closed 2026-08-17** — see this same bullet's own
      dated entry further down. **`STEAM` closed 2026-08-17** — see this
      same bullet's own dated entry, further down still. **`GRILL`
      closed 2026-08-17**, same day — see this same bullet's own dated
      entry, further down again. **`MARINATE` closed 2026-08-17**, same
      day — see this same bullet's own dated entry, further down once
      more. Still open: `KNEAD` (blocked on flour/dough not existing in
      this vocabulary at all yet — see "Far more staple ingredients"
      above).
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
      **`ROAST` closed 2026-08-17** (`data/actions/roast.json`),
      alongside `ALKALINE_PARBOIL` (`data/actions/alkaline_parboil.json`)
      and a genuinely new base ingredient, `baking_soda.json` — the
      latter directly closing this repo's own long-named "complete
      potato" gap ("the real alkaline (baking-soda) parboil-roughening
      technique... remain open," first flagged 2026-08-13). Deliberately
      its OWN verb rather than a `BAKE` parameter — the same "genuinely
      different named dish, not the same technique at a different
      setting" test `onion.json`'s `CARAMELIZE` closure already applied
      (a whole baked potato and cut, oiled, browned roast potatoes are
      different real dishes) — and mechanically, not just rhetorically,
      distinct from `BAKE`: `ROAST` requires an `isFryingMedium`
      ingredient present (real oil-tossing technique), `BAKE` requires
      none at all (`bake.json`'s own pre-existing notes), proven as a
      real rejection, not asserted
      (`scripts/roast-any-vegetable-as-a-robot.ts`). `ALKALINE_PARBOIL`
      mirrors `PAR_FRY`'s own precedent exactly — a genuinely different,
      unfinished intermediate state (`"alkaline_parboiled"`, a rough,
      starch-slurry-coated surface from `baking_soda.json`'s real,
      cited pH-driven acceleration of pectin/starch breakdown at the cut
      surface), not a gentler path to the same `"boiled"` result the way
      `SIMMER` correctly reuses `BOIL`'s state. Both real temperature/
      timing figures — 204-232°C oven, 480-720s parboil — are J. Kenji
      López-Alt's own cited "Crispy Roast Potatoes" (Serious Eats)
      recipe, verified via convergent secondary corroboration this
      session (the primary page itself was not directly fetchable — a
      host-level block, not a per-request 403); `REFERENCES.md` has the
      full citation, including the separate convergent-source citation
      for roast timing's own real piece-size/parboil dependency (25-60
      minutes, not one point figure). `ROAST` generalizes across three
      real, genuinely different starting points — cut/oiled potato, the
      WHOLE unpeeled garlic bulb (real technique: roasted garlic is
      never peeled/cut first, unlike every other garlic verb in this
      vocabulary — proving `ROAST`'s deliberate lack of a
      `statePrerequisites` entry is load-bearing, not just permissive),
      and halved onion — not built against potato alone and assumed to
      transfer. Checking `oven.json` while wiring `ROAST`'s
      `requiredTools` found a real, pre-existing, previously-unnoticed
      dead-declaration gap of the exact same shape `knife.json`'s own
      dead `clean`/`dirty` states already carry (`possibleStates:
      ["off","preheating","hot"]`, zero actions ever transitioning it) —
      named and cross-referenced (`oven.json`'s new `deadStatesNote`),
      deliberately NOT reactivated: doing so honestly needs the same
      real, standalone mechanism `place.ts` built for pot/pan heat (a
      tool carrying real state outside `Instance`/`applyAction`), a
      genuinely separate, larger addition (oven preheat-time physics,
      distinct from `heat-source.ts`'s stovetop-burner model) than this
      entry's own scope. Proven end-to-end two ways:
      `data/recipes/crispy-roast-potatoes.json` (the full real chain —
      wash/peel/cut/alkaline_parboil/drain/roast/salt — simulated with
      zero step errors, `npm run recipe -- crispy_roast_potatoes`) and
      `npm run capability-test:roast`
      (`scripts/roast-any-vegetable-as-a-robot.ts`, all three entities
      plus the real BAKE-vs-ROAST rejection proof). Zero new engine code
      — a pure data/schema-population addition, same as `CARAMELIZE`/
      `DRAIN` before it.
      \
      **`STEAM` closed 2026-08-17**, the same day, alongside a new
      `steamer_basket.json` tool entity (`data/actions/steam.json`) — a
      real, physically DIFFERENT process from `BOIL`/`SIMMER`, not the
      same result reached differently: the target never touches the
      liquid at all, cooked by water-vapor contact only. Applied to
      potato AND egg, with a deliberately-stated ASYMMETRY in why each
      one is worth having, not one copy-pasted justification: for
      potato, steaming produces a real, MEASURED compositional
      difference (Lee, Choi, Jeong, Lee & Sung 2017, `Food Science and
      Biotechnology`, verified via direct fetch this session: potato
      retains 83.65% of its vitamin C steamed vs. 49.79% boiled —
      `REFERENCES.md`) — the deciding factor for giving `STEAM` its own
      `"steamed"` state rather than reusing `BOIL`'s shared `"boiled"`
      the way `SIMMER` correctly does, a stronger, quantified version of
      the same judgment call `ROAST`/`BAKE` and `CARAMELIZE`/`FRY`
      already made on qualitative grounds. For egg, the eaten result is
      close to boiled — the real payoff is easier peeling (steaming
      above, not submerged in, turbulent boiling water genuinely
      produces cleaner-separating shells, per convergent consumer/
      food-science sources citing J. Kenji López-Alt's own comparative
      testing) — kept as the SAME fixed state name anyway, both because
      `ActionOutputsSchema` only supports one fixed `transformedState`
      per action (no per-target override — the same constraint that
      originally split `SCRAMBLE` from `FRY`) and because "steamed, not
      boiled" is still a real, distinct fact about HOW an egg was cooked
      even when the eaten result converges. Directly forced a real,
      necessary companion fix: `egg.json`'s `statePrerequisites.peel`/
      `shock` widened from `"boiled"` to `["boiled","steamed"]` (the
      same array-of-acceptable-priors mechanism `potato.json`'s
      `cut`/`grate` already use) — without it, a steamed egg could never
      reach `PEEL` at all, defeating the entire real reason to steam an
      egg in the first place; proven directly, not assumed
      (`scripts/steam-as-a-robot.ts`'s own step 2). `criticalControlPointsByAction.steam`
      reuses `egg_cooking`, the identical CCP `boil`/`simmer`/`fry`/
      `poach` already reference — Salmonella kill-time depends on
      internal temperature/hold duration, not on whether the heat
      arrived via liquid water or steam at the same temperature. A real,
      honest finding surfaced while proving the CCP wiring, not hidden:
      `steam.json`'s own declared `durationSeconds` floor (600s) already
      clears `egg_cooking`'s `heldSeconds` threshold (15s) by 40x, the
      same shape of gap `execution-bounds.ts`'s own closing note already
      named for `fry.json`'s `oilTempC` floor — the CCP check is real
      and correctly wired, it just cannot currently be violated by any
      schema-valid `STEAM` step, because nobody would ever steam an egg
      for under 10 minutes to begin with. Proven end-to-end via
      `data/recipes/easy-peel-steamed-egg.json` (the direct sibling of
      `soft-boiled-egg.json`, `npm run recipe --
      easy_peel_steamed_egg`) and `npm run capability-test:steam`
      (`scripts/steam-as-a-robot.ts`). Still NOT closed, named rather
      than implied covered: no `place.ts`/`heat-source.ts` wiring (a
      steamer basket's contents are a materially different physical
      situation from a vessel's own liquid contents, which is all
      `place.ts` currently models); `potato-doneness.ts`/
      `egg-doneness.ts` don't yet have a dedicated `STEAM` timing table
      — `durationSeconds` stays a plain declared range on `steam.json`
      itself, not a cited per-piece-size lookup the way `BOIL`'s
      `pieceSize` parameter has.
      \
      **`GRILL` closed 2026-08-17**, the same day, alongside a new
      `grill.json` tool entity (`data/actions/grill.json`) — the direct,
      open, radiant/conductive-heat sibling of `ROAST`/`BAKE`, real char
      marks and smoke flavor neither an oven nor a stovetop pan can
      produce, the same "genuinely different named dish" test that
      already justified `ROAST` over a `BAKE` parameter and `CARAMELIZE`
      over a `FRY` parameter. Generalizes across the SAME three real
      entities `ROAST` already proved (potato, garlic — the whole
      unpeeled bulb, foil-wrapped on the grates instead of in the oven,
      onion), not built against potato alone. Proven as a real,
      mechanical distinction from `ROAST`, not just a differently-worded
      verb: `GRILL` requires `requiredTools: ["grill"]` and correctly
      REJECTS an oven-only kitchen; `ROAST` requires `["oven"]` and
      correctly rejects a grill-only one — both directions checked, not
      assumed (`scripts/grill-any-vegetable-as-a-robot.ts`'s own step 2).
      `grillTempC`'s 191-232°C range deliberately overlaps `ROAST`'s own
      204-232°C band — both are real, comparably high-heat techniques,
      DIRECT-vs-enclosed heat delivery (not the temperature number
      itself) is the actual distinguishing physical fact, named
      explicitly rather than left to look like an arbitrary near-miss.
      Real potato technique (parboil first, then grill — pre-gelatinized
      surface starch crisps faster on direct dry heat) and real onion
      technique (straight onto the grill, no parboil) both wired
      correctly and differently in `data/recipes/grilled-potatoes-and-
      onions.json` (simulated end-to-end with zero step errors, `npm run
      recipe -- grilled_potatoes_and_onions`) — proven via
      `npm run capability-test:grill`
      (`scripts/grill-any-vegetable-as-a-robot.ts`). Zero new engine code
      — a pure data/schema-population addition, the same shape as
      `ROAST`/`CARAMELIZE`/`DRAIN` before it. Still NOT closed: no
      `place.ts`/`heat-source.ts` wiring (same honest gap `ROAST`/`BAKE`
      already carry); no char/smoke-flavor modeling beyond the
      `verification.description` string.
      \
      **`MARINATE` closed 2026-08-17**, the same day (`data/actions/
      marinate.json`) — a real, DURATION-based, passive process,
      mechanically distinct from `ACID` (`data/actions/acid.json`, an
      instant tag-add with no elapsed time at all), not a longer version
      of the same verb — proven directly, not asserted:
      `scripts/marinate-any-ingredient-as-a-robot.ts`'s own step 2 shows
      `ACID` succeeding instantly while `MARINATE` correctly rejects a
      duration below its own declared minimum. Reuses `acid.json`'s own
      `isAcid` capability (`vinegar.json`) rather than inventing a second
      one for the identical real ingredient fact. Generalizes across
      THREE real entities with THREE genuinely different real timescales,
      not glossed into one average — the actual reason for
      `durationSeconds`' unusually wide 1800-864000s (30 minutes to 10
      days) range, named explicitly rather than left looking like
      padding: quick-pickled onion (sliced, ~30 minutes, the flagship
      case — `data/recipes/quick-pickled-onions.json`, simulated
      end-to-end with zero step errors, `npm run recipe --
      quick_pickled_onions`), pickled garlic (individual peeled cloves —
      a real, DIFFERENT prep from `ROAST`/`GRILL`'s own whole-bulb
      technique for the same ingredient), and British pub-style pickled
      eggs (peeled hard-boiled egg, a minimum of 3 days, commonly 10 —
      REFERENCES.md). A real, correct food-safety CONTRAST named
      explicitly rather than defaulting to `infuse.json`'s own garlic-
      in-OIL botulism caution for a structurally different case:
      acid (vinegar) is itself the classical preservation mechanism
      real commercial shelf-stable pickled products rely on — not
      modeled as a new CCP either way (`thermal.ts`'s own scope stays
      temperature/hold-time only), named in `marinate.json`'s own
      `foodSafetyNote`. Proven via `npm run capability-test:marinate`
      (`scripts/marinate-any-ingredient-as-a-robot.ts`). Zero new engine
      code — a pure data/schema-population addition, the same shape as
      `ROAST`/`STEAM`/`GRILL`/`CARAMELIZE`/`DRAIN` before it. Still NOT
      closed: no elapsed-real-world-time or refrigeration-duration
      tracking anywhere in this engine — "marinated for 10 days,
      refrigerated" is an authored fact, never verified, the same
      limitation `storageLifeByState`/`infuse.json` already name.
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
      **The `Instance.inProgressAction` query half CLOSED 2026-08-17** —
      `src/in-progress-action.ts` (`beginAction`/`progressStatus`/
      `fractionOfRequestedDuration`/`remainingRequestedSeconds`), the
      concrete design input named above actually built, composing
      directly with `execution-bounds.ts`'s already-real
      `ExecutionBound` (the same `minSafeHoldSeconds` safety floor/
      `maxDurationSeconds` forced ceiling that module already computes)
      rather than re-deriving a second notion of "how long should this
      take." Answers a real, previously-unanswerable question: given a
      continuous action that started some simulated seconds ago, is it
      still below its safety floor, in progress, at its own caller-
      requested duration, or past the forced timeout ceiling — plus how
      far into that requested duration it is and how much is left. Same
      standalone-module-before-engine-wiring precedent as `place.ts`/
      `execution-bounds.ts` itself: `engine.ts`'s `applyAction` is
      completely UNCHANGED — it stays atomic. Proven via 16 new unit
      tests (`tests/in-progress-action.test.ts`, synthetic fixtures) and
      `scripts/check-in-on-a-cooking-instance-as-a-robot.ts`
      (`npm run capability-test:in-progress-action`) across four real
      cases: BOIL egg walked through its own real CCP floor then its own
      requested duration; FRY given a requested duration LONGER than its
      real `maxDurationSeconds` ceiling (proves the forced timeout fires
      regardless of what was asked for); MASH, a real action with NO
      `durationSeconds` parameter at all (proves `requestedDurationSeconds`/
      the fraction/remaining functions correctly report "not applicable"
      rather than guessing, while the forced ceiling still tracks
      correctly); PEEL, an instantaneous action (proves `beginAction`
      correctly refuses to track something with no partial-completion
      concept at all). Deliberately does NOT close the other named half
      of this gap: `recipe-runner.ts` does not construct an
      `InProgressAction` or pause a step mid-execution anywhere — this is
      a query mechanism proven against a hypothetical already-started
      action, not real execution-loop pause/resume. The two CONCRETE
      cases this whole entry names (an egg's shape settling/spreading
      over its first several seconds after cracking; basting applied
      repeatedly DURING a fry, not once) remain unmodeled — this answers
      "how far along, in TIME," not "what does the food actually look
      like partway through," a harder question with its own real
      physical facts this pass deliberately did not attempt to source.
      `toolLockBehavior` (mutual exclusion on a shared tool) also remains
      completely unbuilt, a different, real, separate mechanism.
- [x] **Storage/shelf-life common knowledge — closed 2026-08-17.**
      `ingredient.ts`'s new `StorageLifeSchema` + `EntitySchema.
      storageLifeByState` (keyed by state id, the same per-state-fact shape
      `criticalControlPointsByAction` already uses per-action, since
      storage life is genuinely different per state on the SAME entity —
      raw shell egg keeps 3-5 weeks refrigerated, the same egg hard-boiled
      keeps ~1 week: `refrigeratedDays`/`roomTempHours`/`pantryMonths`/
      `doNotRefrigerate`, each an optional real, cited range, not a false-
      precision point value). Applied to 5 real entities as an honest,
      checked slice — NOT "all," same discipline this whole section holds
      itself to: `egg.json` (raw + boiled/peeled, real, dramatically
      different USDA-sourced figures), `egg_yolk.json`/`egg_white.json`
      (raw, once separated — a much shorter figure than the intact shell
      egg), `potato.json` (raw — `doNotRefrigerate: true`, a real,
      cited, food-QUALITY-not-safety fact connecting directly to this
      repo's own existing frying-physics citations: refrigeration converts
      starch to sugar, increasing browning/acrylamide when later fried),
      `garlic.json` (raw whole bulb only — deliberately does NOT cover
      peeled/chopped garlic or garlic-in-oil, the shorter-lived, real
      food-SAFETY case `infuse.json`'s own pre-existing `safetyNote`
      already named and is cross-referenced from, not duplicated).
      Deliberately DECLARATION only, the exact same scoping precedent
      `AllergenSchema` (2026-08-16) already established: this engine has
      no elapsed-real-world-time concept (no purchase date, no "how long
      has this actually been in the fridge" — the same honest limitation
      `egg.json`'s own `freshnessNote` names for fresh/aged tags), so
      nothing here says whether a SPECIFIC instance is still within range,
      only what the range is. Surfaced two ways, mirroring
      `allergenSummary`'s own precedent exactly: `recipe-explain.ts`'s new
      `storageSummary` (keyed to each `initialInventory` item's own
      AUTHORED starting state, not every state its entity happens to have
      guidance for) and `recipe-narrator.ts`'s new "Storage & shelf life"
      Markdown section. `scripts/validate.ts` hard-fails a
      `storageLifeByState` key not in the entity's own `possibleStates`,
      the same standard `invalidTransitions`/`rawContaminationRiskStates`
      already hold themselves to. Proven via `npm run
      capability-test:storage-life` (`scripts/storage-life-as-a-robot.ts`)
      — every real entity's real data printed, the state-specific keying
      demonstrated directly against the real `egg` entity (raw: 21-35
      refrigerated days vs. boiled/peeled: 1-7), `storageSummary` computed
      over every one of this repo's 17 real recipes with zero errors, and
      potato's `doNotRefrigerate` fact confirmed present. 8 new unit tests
      (`tests/recipe-explain.test.ts`). Deliberately NOT closed: most
      entities in this repo still have zero `storageLifeByState` entries
      (a real, honest, checkable gap, not implied covered); a leftover
      COOKED dish's own shelf life is a `RecipeScript`-level fact this
      repo doesn't model at all (named, not attempted); the USDA "Danger
      Zone" 2-hour room-temperature rule is cited in `REFERENCES.md` but
      not yet applied to any real entity — no forcing case has needed
      `roomTempHours` yet.
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
