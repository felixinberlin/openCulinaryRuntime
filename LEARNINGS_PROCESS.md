# LEARNINGS_PROCESS.md

Part of `LEARNINGS.md`'s theme split (2026-08-15 — see that file for the
index and why). This file: **working method and verification discipline** —
triaging externally-supplied documents/bug reports, checking claims (this
repo's own design spec included) against real sources before enforcing
them, and what a user's direct correction caught that self-review didn't.
Not: engine/schema architecture (`LEARNINGS_ENGINE.md`), food-science/
technique facts (`LEARNINGS_DOMAIN.md`), or CLI/authoring tooling
(`LEARNINGS_TOOLING.md`).

Same rules as before the split: dated, append-only, concrete lessons only —
not a changelog of *what* changed (that's `git log`), *why* a design choice
was made. Don't rewrite or delete old entries — append.

---

## 2026-08-12

### Process

- **After any `engine.ts`/schema change: re-run every existing demo script +
  every recipe + `tsc -p . --noEmit`, not just the new thing.** Caught two real
  regressions this session this way (the `CRACK`/`.spawned` bug, the CCP-gating
  bug) that a narrower check would have missed.
- **`tsc` reports pre-existing `TS5097` (import-extension) errors across nearly
  every file in this repo, unrelated to any change made here.** Filter with
  `grep -v TS5097` when checking for *new* type errors, or the noise drowns
  the signal.
- **Cite sources for numeric claims that could be quietly wrong** (USDA/FDA
  URLs and section numbers in `data/ccps/egg_cooking.json`, not just a bare
  number) — and state explicitly when a figure is a simplification of a richer
  real table (the Food Code's actual multi-point curve vs. this schema's
  two-point model), rather than implying more precision than was verified.
- **"Can the vocabulary make dish X end-to-end" is a better progress signal than
  phase checkboxes, and it's empirically checkable — write the attempt as a
  script, run it, let it fail where it actually fails.** `attempt-tortilla.ts`
  proved two real, previously-only-implicit gaps this way: no verb combines two
  separate instances into one (blocks potato+egg → tortilla mixture, same root
  cause as the earlier "salad" gap in `garlic-oil-potatoes.json` — this is now
  the third time it's blocked a real recipe, promoted to the top of
  `ROADMAP.md` Phase 4 because of that), and no `FLIP` verb exists at all for
  the single most technique-defining step of the dish. Neither gap is about
  robot control/perception (`ENGINE_INVARIANTS.md` #11) — the vocabulary itself
  stops short before physical execution is even the question. Worth
  re-attempting a new real dish periodically specifically to surface the next
  missing verb, rather than guessing at what to build speculatively.
- **Both gaps above are now closed — `COMBINE` needed a genuine new engine
  mechanism, `FLIP` didn't.** `FLIP` fit the existing single-target action
  shape exactly (`addsTag`, same as `SALT`) — no schema/engine change at all,
  pure data. `COMBINE` couldn't: `applyAction` only ever took one target
  instance, and every existing "second ingredient" mechanism
  (`requiredIngredientCapabilities`) explicitly only checks *presence*, never
  consumes anything (that limitation is stated in `ROADMAP.md` Phase 4 itself).
  Merging two real instances into a new one needed: a second required-capability
  slot on the action (`requiredSecondaryCapability`, distinct from
  `requiredIngredientCapabilities` on purpose — presence-check vs.
  consume-and-replace are genuinely different operations, not degrees of the
  same one), a new output shape (`combinesInto`, mutually exclusive with
  `transformedState`/`transformedStateFromParameter` — there's no "resulting
  state" on an instance being replaced by a different entity), and a second
  destroyed-flag (`secondaryDestroyed`) so `recipe-runner.ts` knows to remove
  the secondary instance too. All of it optional/unset by default, so every
  action defined before this stayed completely unaffected — verified by full
  regression, same discipline as every other engine change this session.
- **Runtime-assigned spawned instance IDs (`entityId-N`, global counter across
  the whole run) can't be predicted by reading a recipe file — they have to be
  run to find out.** First draft of `tortilla-de-patatas.json` guessed
  `egg_cracked-1`; the actual ID was `egg_cracked-3` (CRACK's own
  `["egg_shell", "egg_cracked"]` byproduct order, after `potato_peel-1` from an
  earlier step, ate counters 1 and 2 first). `validate.ts` can't catch this —
  it explicitly doesn't simulate a run, just logs a NOTE for any
  `targetInstanceId`/`secondaryInstanceId` not in `initialInventory`. Running
  the recipe and reading the actual log is the only real check.
- **A wrong/typo'd id in `availableIngredientInstanceIds` fails SILENTLY, not
  loudly — found this the hard way, not by design review.**
  `handmade-alioli-egg-yolk.json` referenced `"egg_yolk-1"` for months of
  session-time (several turns) when the actual spawned id was always
  `"egg_yolk-3"` — and it never errored, because `recipe-runner.ts`'s
  resolution (`inventory.get(id)?.entityId`, filtered for `undefined`) just
  drops an unresolvable id rather than failing. The step "worked" anyway
  because `oil-1` alone already satisfied `isEmulsifier`. A step can look
  correct in every log line and still be silently not using an ingredient you
  meant it to. Worth grep-checking recipe files for instance ids that don't
  appear anywhere as a spawn source, not just trusting a clean run.
- **Byproduct/combine spawning always hardcoded `tags: []` for the new
  instance, discarding the parent's tags — a real bug, not a hypothetical
  one.** Would have silently defeated a `pasteurize` → `separate` → `emulsify`
  safety chain: the whole point of tagging a pasteurized egg is that the tag
  survives being split into yolk/white. Fixed by inheriting the parent's (and,
  for `combinesInto`, the secondary instance's) tags into spawned instances,
  filtered against the spawned entity's own `possibleTags` so nothing
  semantically nonsensical leaks through. Every entity that's meant to receive
  an inherited tag needs that tag explicitly listed in its own `possibleTags`
  — the filter is a feature (stops garbage propagation), not a bug, but it
  means adding a new safety tag anywhere requires updating every entity
  downstream that should be able to carry it.
- **Not every safety shortfall deserves the same `advisoryOnly` treatment.**
  `egg_cooking.json` (a runny yolk from active cooking) is `advisoryOnly: true`
  — a real FDA-recognized "disclosed, diner accepts it" practice.
  `egg_pasteurization_raw.json` (raw egg yolk used with NO pasteurization step
  at all, e.g. in alioli) is `advisoryOnly: false` — a hard reject in every
  `SafetyPolicy` mode, including "human," on purpose: there's no equivalent
  "the child knowingly accepted this" framing for silently skipping the one
  mitigation available. The mechanism (`SafetyPolicy`) doesn't decide this by
  itself — the CCP author has to make the actual judgment call per hazard, and
  say why, not default every CCP to the same posture.
- **A recipe using a raw, safety-relevant ingredient (raw egg yolk) can run
  with ZERO enforcement for a long time if the enforcement mechanism is keyed
  to the wrong trigger.** `egg_cooking.json`'s CCP only checks on
  `FRY`/`SCRAMBLE`/`POACH`/`BOIL` — actions with a `durationSeconds` tied to
  active cooking. `handmade-alioli-egg-yolk.json` never cooks the yolk at all
  (that's the entire point of the dish), so that CCP silently never applied,
  across several turns of session-time, until directly asked to "refine" the
  recipe for real use. The fix needed a genuinely different CCP (a different
  point on the real time-temperature curve — low-temp, long-hold, stays raw —
  not a stricter version of the cooking one) tied to a NEW action
  (`PASTEURIZE`) that the recipe didn't previously have a reason to include.
  Worth checking, for any raw/never-cooked ingredient use: is there actually
  an action in the sequence the safety mechanism can attach to at all?
- **A boolean comparison against `NaN` is `false`, not an error — so
  `if (seconds < threshold)` silently SKIPS a safety check on malformed input
  instead of failing it.** Found by deliberately asking "what would a robot
  need this to guarantee" rather than by code review: the CCP-shortfall check
  in `engine.ts` only worked correctly because every CCP-linked action
  happens, by convention, to also declare `durationSeconds` as a validated
  `numericRange` parameter (which throws on `NaN` earlier in the same
  function) — the CCP check itself wasn't self-defending. Fixed with an
  explicit `Number.isNaN` guard right at the check, not relying on an
  implicit, unenforced coupling between two different parts of the function.
  General lesson: any comparison-based safety gate fed by user/parsed input
  needs its own guard against the input not being a valid number at all — a
  missing bounds check elsewhere in the same function is not a substitute.
- **`ActionSchema`'s precondition/effect shape (`requiredTargetCapability`
  etc. as preconditions, `outputs.*` as effects) turns out to already be a
  STRIPS/PDDL-style planning-operator representation — discovered by asking
  "what recipe format would a robot actually want," not by designing for it
  up front.** Every `RecipeScript.sequence` authored this session was a
  human (me) doing backward-chaining through that precondition/effect graph
  by hand, one file at a time — exactly the job an automated planner exists
  to do. This reframes `CONCEPT.md` §12's long-flagged, unreconciled fork
  (goal-based recipes vs. linear step-sequence): they're not actually
  competing formats, one is the compiled OUTPUT of planning against the
  other's GOAL spec. See `WORLD_MODEL.md`. Worth remembering generally: a
  schema built for one purpose (validating/executing hand-authored recipes)
  can turn out to already fit a different, larger purpose (automated
  planning) it was never explicitly designed for — recognizing that is
  cheaper than redesigning from scratch.
- **A dish name can be a false friend across cuisines/languages —
  "tortilla francesa" (Spanish: an everyday flat, fully-cooked plain omelette)
  and "French omelette" (the classical technique: baveuse, folded) are NOT
  the same dish despite the near-identical name.** Missed entirely until
  directly asked to think about what a robot needs to make either "as asked":
  the vocabulary could only express one flat/set outcome, no way to represent
  a fold or a deliberately-soft interior. Fixed with new informational
  parameters (`yolkDoneness`, `edgeStyle`, `internalTexture` on
  `fry.json`/`poach.json`) and a new `FOLD` action — plus two recipes sharing
  their first three steps EXACTLY, diverging only where the dishes actually
  diverge, so the difference is checkable in a diff, not just asserted in
  prose. General lesson: "make an omelette" isn't fully specified in any
  cuisine's default — yolk doneness and fold-or-not are usually the two axes
  that actually distinguish what was ordered, and neither was representable
  before being asked about. Worth asking, for any dish name: what's the most
  common real-world qualifier attached to an order for it, and is it actually
  representable yet?
- **A composite entity built from an at-risk ingredient (egg) needs its OWN
  `criticalControlPointsByAction` — inheriting the ingredient doesn't
  inherit the safety wiring.** `tortilla_mixture.json` (built from potato +
  egg via `COMBINE`) had zero HACCP enforcement, silently, until asked
  whether tortilla de Betanzos — a real dish DEFINED by an intentionally
  liquid, barely-cooked interior — was makeable. Exactly the same shape of
  gap `handmade-alioli-egg-yolk.json` had originally (a real safety-relevant
  ingredient present, but the specific action/entity pairing that needed a
  CCP reference never got one), the second time this exact class of bug has
  been found by asking about a specific real dish rather than by auditing in
  the abstract. General lesson, now twice-confirmed: whenever `COMBINE`
  (or any future entity-merging mechanism) produces a new composite entity
  from an at-risk ingredient, check whether the new entity's own
  `criticalControlPointsByAction` was actually populated — `structure.
  components` listing the ingredient is not the same as the safety wiring
  carrying over, and nothing currently enforces that it does.
- **Adding a CCP reference to an entity that previously had none can break a
  standalone script that calls `applyAction` directly without loading
  `ccps`** — not a flaw in the fix, the exact self-defending check
  (`"was ccps not loaded/passed into applyAction?"`) written for this precise
  situation, firing correctly for the first time. `attempt-tortilla.ts` never
  needed `ccps` before because `tortilla_mixture` had nothing to reference;
  once it legitimately did, the standalone demo needed the same `loadCcps()`
  wiring the recipe-driven path already had. Any change that adds a new
  `criticalControlPointsByAction` entry to an existing entity should be
  treated as a potential breaking change for scripts that construct
  `Instance`s directly (not through `run-recipe.ts`) — full regression across
  the standalone demos, not just the recipes, is what actually caught this.
- **A systematic sweep (every cooking-capable entity × its CCP wiring) found
  ZERO further gaps after the Betanzos fix — worth doing proactively once a
  pattern repeats twice, not waiting for a third dish to find a third
  instance.** `tortilla_mixture` had the gap `handmade-alioli-egg-yolk` had;
  once the same shape of bug showed up twice, auditing every
  `isFryable`/`isBoilable`/`isPoachable`/`isScramblable` entity against its
  `criticalControlPointsByAction` directly (rather than continuing to wait
  for the next specific dish to expose the next instance) confirmed the
  vocabulary was actually clean — `potato`/`potato_peel`/`garlic` correctly
  have none (no comparable pathogen risk), everything egg-derived correctly
  does. Turned into a permanent `validate.ts` NOTE (cooking capability +
  zero CCP wiring) so this stays checked going forward, not just fixed once.
- **The same inconsistent-rigor pattern existed for citations, not just
  safety wiring — `egg`/`garlic` got an explicit "not independently
  verified" hedge, `potato`/`salt`/`water`/`oil`/`egg_yolk`/`egg_white`/
  `egg_cracked` didn't, for numbers with identical epistemic status.** Fixed
  with a real `CitationSchema` (source + two honest confidence tiers —
  deliberately no "primary_source" tier, since nothing in this repo has ever
  been checked against one) added to `CompositionSchema`/
  `ThermophysicalPropertiesSchema`, populated across every entity: USDA
  FoodData Central for food composition, the CRC Handbook for pure chemical
  constants (salt, water), Choi & Okos (1986) for the food-thermal-property
  model, Eric Block's Allium chemistry work for garlic's flavor-chemistry
  claim. Distinguishing WHY salt's melting point is higher-confidence than
  potato's water content (pure compound, no natural variance, vs. a
  biological product averaged across cultivars) is itself the more
  scientifically honest position — not flattening every citation to the same
  confidence level for consistency's sake.
- **Citing salt's sodium content properly (instead of re-asserting the same
  hedge) surfaced an actual, fixable numeric error**: the stored value
  (38758mg/100g) was 1.49% off from the exact stoichiometric figure
  (39337mg/100g, computed from IUPAC standard atomic weights — table salt is
  essentially pure NaCl, so this is exactly derivable, not an empirical
  approximation with real biological variance like the food-composition
  figures). Found only by actually doing the arithmetic while sourcing the
  citation, not by the citation exercise alone — "add a source" and "check
  the number is actually right" turned out to be different, complementary
  checks, and only doing the first would have left this wrong.
- **Citing water's boiling point surfaced an unaddressed gap with no
  workaround yet, not something fixable in the same pass**: 100°C is only
  correct at 1 atm/sea level — this repo has no altitude/pressure parameter
  anywhere, so every BOIL/POACH duration and every CCP threshold implicitly
  assumes sea level. Recorded as a real, open gap (in `water.json`'s new
  citation note) rather than silently assumed away — a robot operating at
  meaningful altitude would need this accounted for and currently can't get
  it from this model.
- **Implementing the REAL D-value/z-value thermal-death-time model (the actual
  math the FDA Food Code's own tables are built from) instead of two
  hand-picked anchor points found a genuine, computable ~4x discrepancy
  between my two existing egg-pasteurization CCPs — not a bug, but real
  physics I hadn't made visible.** Both CCPs cite 57°C as a hold temperature;
  one requires 3900s (in-shell), the other's real model predicts only ~975s
  would be needed at 57°C (liquid). Computing that gap rather than asserting
  "the shell matters" turned a plausible-sounding claim into a checkable
  number (`node -e` one-liner, `~4.00x`, matches the expected order of
  magnitude for real heat-penetration lag through a shell). General lesson:
  where a genuinely standard, textbook formula exists (D/z-value kinetics is
  not novel, it's how the reference tables were made in the first place),
  implementing it as real, runnable math finds inconsistencies that citing
  two separately-sourced numbers side by side will not — the numbers looked
  independently plausible until asked to agree with each other via the same
  formula.
- **The real math also produced a genuine simplification, not just more
  rigor**: once egg_yolk could be pasteurized directly (already-liquid,
  no shell — the case where the model's uniform-temperature assumption is
  actually valid), the alioli-with-egg-yolk recipe's wait dropped from 65
  minutes to 3.5, backed by an actual USDA-cited regulated figure instead of
  an in-shell process ported over by analogy. Being MORE correct (recognizing
  two different physical scenarios need two different, properly-scoped
  models) and MORE convenient (much shorter real recipe) turned out to be the
  same fix, not a tradeoff — worth remembering that "more rigorous" and
  "simpler for the end user" aren't always in tension.
- **Auditing every action for "is blind retry safe" found a real bug: `PEEL`
  can spawn a byproduct that doesn't physically exist.** `PEEL` neither
  `destroysTarget` nor checks the target isn't already peeled — so a robot's
  fault-recovery layer blindly re-issuing "PEEL potato-1" after an
  interruption would spawn a SECOND `potato_peel` instance. You cannot peel a
  potato twice and get two peels. The only `retrySafe: false` among all 21
  actions, found only because the question was asked of every single one, not
  because anyone flagged PEEL specifically. General lesson: "does re-running
  this after a fault cause a double-effect" is worth asking of EVERY
  destructive-adjacent action explicitly, not assumed safe by default — two
  genuinely different reasons turned out to make most actions actually safe
  (idempotent-by-construction, via engine.ts's existing `addsTag` dedup guard;
  or fails-loudly via `destroysTarget` already having removed the target) —
  and PEEL had neither.
- **Filling repetitive structured domain data (verification/hazards/retry
  info) across 21 files by hand invites exactly the kind of silent omission
  this whole effort was trying to prevent — write a small one-off script
  instead, then manually add the nuance that actually needs a human's
  judgment.** Batch-applying a lookup table caught its own gap immediately
  (missed 2 of 21 actions in the first pass, `bake`/`beat` — a whole-file
  scan of `validate.ts`'s new NOTE output caught it right away, which is
  exactly why that soft audit check was added to the tool in the first place,
  not left as something to remember to check manually).
- **`boil.json` had ZERO parameters — not even `durationSeconds` — despite
  `egg.json`'s `criticalControlPointsByAction.boil` already referencing a CCP
  that checks exactly that.** It still worked, because the CCP check reads
  `params["durationSeconds"]` directly, independent of whether the action
  formally declares it — but without a declared `numericRange`, `BOIL` never
  got the sane-bounds/`NaN` validation `FRY`/`POACH`/`PASTEURIZE` all get from
  the `parameters[]` loop. This is the exact concrete case the standalone
  `Number.isNaN` guard added to the CCP check (a turn earlier, found by asking
  "what would a robot need this to guarantee") existed to protect — not a
  hypothetical, a real gap sitting in the same file the CCP referenced. Found
  by deliberately auditing for parity across the cooking actions, not by
  anyone flagging it directly. Worth periodically checking: does every action
  wired to a CCP actually declare the parameter that CCP depends on?
- **Carryover (residual) cooking is real, and `BOIL` was quietly pretending it
  doesn't exist.** An egg keeps cooking for a period after leaving boiling
  water — outer layers are hotter than the center, and that stored heat keeps
  diffusing inward with zero external heat applied — so `durationSeconds`
  alone does not fully determine final doneness; what happens immediately
  after boiling does too. `BOIL`'s `transformedState: "boiled"` firing the
  instant `durationSeconds` is reached was always a simplification of a
  continuous process — exactly `WORLD_MODEL.md`'s abstract point (`Instance.
  state` as a derived classification, not the underlying continuous reality)
  showing up concretely, unprompted, in a dish rather than in a design
  document. Fixed with `SHOCK` (an ice bath, `addsTag: "shocked"`) — not a
  physics simulation (still correctly out of scope), just an explicit lever
  to actually arrest the process at a known point, which is the honestly-
  scoped answer, not a fuller simulation.


## 2026-08-13

### `crispy_french_fries` — capability existing and capability demonstrated are different claims

- **Asked to "consolidate" frying knowledge, and checking the existing
  recipes first (rather than assuming the new parameters were already in
  use somewhere) found a real, worth-naming gap: nothing actually
  exercised what had just been built.** `salted_fried_potatoes.json` (the
  one FRY-using recipe with any depth) cuts its potato `diced` and calls
  FRY with zero parameters — no `oilTempC`, no `doneness`, no `PAR_FRY`.
  `oilTempC`/`PAR_FRY`/`topCookingMethod` all existed, were tested in
  isolation (`capability-test:double-fry`), and validated cleanly — but
  "the vocabulary can express X" and "a real dish in this repo actually
  uses X" are different, both worth checking, and only the second is what
  `ROADMAP.md`'s own "Capability tests" section claims to measure
  ("Empirically checked, not reasoned about"). `crispy_french_fries.json`
  closes that specific gap: the first recipe where shape (`julienne`),
  `PAR_FRY`'s temperature, and `FRY`'s finishing temperature/doneness all
  appear together on one dish, not exercised separately in three different
  test scripts.
- **Writing the recipe surfaced the shape↔duration disconnection concretely
  instead of just abstractly.** `potato.json`'s `fryingScienceNote` already
  said nothing connects `CUT`'s shape to frying duration — but actually
  authoring a real recipe made the practical consequence visible: this
  recipe's `julienne` shape and its `163°C`/`191°C` durations are only
  correct together because they were BOTH chosen to match the same cited
  source (Thermoworks' ~6mm stick assumption). Swap the shape to `diced`
  with the same numbers and the schema validates identically while the
  real-world result would be wrong (raw center or burnt-thin edges) — named
  explicitly in the recipe's own `shapeConnectionNote` rather than left to
  be rediscovered by whoever authors the next FRY-using recipe.

### "Oma boils an egg" — scope-checking a heavily garbled instruction before building it

- **A message that was genuinely hard to parse ("oma first mants we build
  the base and oma just aks for an boiled egg. Make oma tests in all the
  places") still had a confident, checkable READING even though its exact
  SCOPE didn't** — worth separating those two kinds of uncertainty rather
  than treating the whole message as equally unclear. The persona reading
  (Oma = a naive end-user who should be able to say "boil me an egg" with
  zero technical detail and have the robot handle the rest) mapped cleanly
  onto `CONCEPT.md` §14's already-established Intent pipeline — high
  confidence, no need to ask. What "in all the places" actually meant
  (one demo? several dishes? edits scattered across every existing script?)
  was genuinely unresolvable from the text alone and had real cost
  attached to guessing wrong (touching many existing files vs. one new
  one) — that's the part worth an `AskUserQuestion`, not the persona
  reading itself. Asking about the part that was actually ambiguous,
  instead of re-clarifying the part that wasn't, kept the question to one
  round instead of several.
- **Deliberately built the demo to prove the boundary CONCEPT.md §14 draws,
  not to blur it.** The easy, wrong version of this script would quietly
  have the "robot" also decide what Oma meant by "medium" via some ad-hoc
  heuristic, making it look like the engine does intent resolution. Instead
  the `Intent` object is explicitly GIVEN/hardcoded in the script with a
  comment stating why: CONCEPT.md §14 says the LLM's only job is producing
  that structured `Intent`, and this repo has no LLM — so the honest demo
  starts one step AFTER where an LLM would have handed off, not before it,
  even though skipping that distinction would have made for a slightly
  more impressive-looking script.
- **Caught and fixed a wrong function name before it would have been an
  opaque runtime error for whoever ran the script next.** First draft
  called a `resolveEggBoilDoneness` that doesn't exist — `egg-doneness.ts`
  actually exports `EGG_BOIL_DONENESS` (the array) and `eggBoilDonenessRange`
  (a lookup returning just the range, no `description`). Caught by actually
  running the script (`npx tsx`) rather than trusting the import compiled
  correctly, the same "run it, don't just write it" discipline this whole
  session has applied to every other new script.


## 2026-08-14

### Triaging a pasted external bug report — verify before adopting, even the fixes

- **An externally-generated review is a set of claims to check, not a to-do
  list to execute.** Ran every checkable claim against the actual code
  before acting on it, and found the report was right about the two real
  bugs, wrong about one "dead code" claim (`src/query.ts` — actually used by
  `scripts/ask.ts`), and its own suggested fix for the biggest issue didn't
  actually work as written (`allowImportingTsExtensions: true` alone hits a
  second error, `TS5096` — needs `noEmit` too). Treating "the report says
  so" as sufficient to skip verification would have propagated a
  wrong fix and a false claim into the codebase — the same standard this
  repo already holds its own citations to (`REFERENCES.md`) applied to a
  document instead of a source, for the same reason.
- **Most of the report's 20 items were already known, already-fixed, or
  already-named gaps this repo's own `ROADMAP.md`/`LEARNINGS.md` track —
  worth recognizing as confirmation, not new information, rather than
  re-documenting them a second time.** Inventory consumption, the forbidden-
  transition matrix, storage-hazard CCPs, robot-safe parameter mappings,
  composite dish assembly, unpredictable instance ids, recipe metadata
  standardization — all pre-existing, named, open `ROADMAP.md` items. Tag
  inheritance and CCP-gating-on-`durationSeconds` were pre-existing, already
  FIXED — the report itself correctly marked them as such. Acting on a
  report means triaging what's actually new/actionable inside it, not
  executing every line item as if novel.
- **The two real bugs it found were both genuine inconsistencies between one
  piece of code and its own immediate neighbor, not deep design flaws** —
  the same shape almost every real bug this whole project has found has
  had: `tsc -p .` vs. `tsc -p . --noEmit` (one config, two commands, only
  one path ever actually exercised); `targetInstanceId`'s loud-failure
  check three lines above `availableIngredientInstanceIds`'s silent one, in
  the SAME function. Consistency checking against a neighbor already proven
  correct keeps finding real bugs in this codebase — worth remembering as a
  review heuristic, not just a coincidence.

### A second external report, same day — mostly stale, two small real fixes taken

- **This report was generated without seeing the previous commit** (its own
  "Recommended Next Steps" #1 is "implement validation simulation mode" —
  already shipped a commit earlier the same day — and it repeats the
  `src/query.ts`-is-dead-code claim already checked and found false).
  Cross-checking a second report against what's already true in the repo,
  not just against the code, caught this immediately — the same
  verify-before-acting discipline as the first report, applied to a report
  whose own staleness was the thing to catch this time, not a wrong claim
  about the code itself.
- **Two suggestions were real and taken**: `makeHeatSource` was duplicated
  verbatim between `tests/heat-source.test.ts` and `tests/place.test.ts` —
  consolidated into `tests/helpers.ts` alongside `makeEntity`/`makeAction`/
  `makeCcp`, the exact pattern that file's own doc comment already
  describes. And one specific magic-number formula the report quoted
  directly (`tests/place.test.ts`'s `secondsToBoil` line) got named
  constants — applied narrowly to the one spot actually quoted, not as a
  repo-wide magic-number sweep (most numeric literals elsewhere already
  have adjacent doc-comment explanations, which is a different, already-
  satisfied bar than "give every number its own named constant").
- **Declined, with reasons, rather than silently ignored**: a `.strict()`
  structured `RecipeMetadataSchema` would break every existing recipe's
  freeform `metadata` (`peelingNote`, `comparisonGroup`, `crackContainmentNote`-
  style keys are the established, load-bearing convention across every
  `data/*.json` file in this repo, not sloppiness — see almost every entity/
  action file's `metadata` block). A `src/index.ts` barrel export (and the
  matching `src/types/index.ts` suggestion) would re-export `query.ts` as
  if it were part of the same public surface as everything else, and
  barrel files are a real, known cost (circular-import risk, worse tree-
  shaking) for a ~15-file `src/` with no current consumer needing one. A
  pluggable `Logger` interface has no current caller — every `console.log`
  today is a demo/capability-test script, not the not-yet-built
  control/perception layer `ENGINE_INVARIANTS.md` #11 already names as
  separate, larger, unstarted work; building the logging abstraction now
  would be speculative infrastructure for a caller that doesn't exist yet,
  the same anti-pattern this repo's own `LEARNINGS.md` has repeatedly
  named and avoided elsewhere. Error-message format standardization (choosing
  one consistent backtick/quote convention across ~29 throw sites) was left
  alone — genuinely cosmetic, zero functional benefit, and real risk of
  introducing a typo across many files for a purely stylistic gain.

### Triaging a scientific review — real physics built, a safety number verified but not silently changed

- **A report that's mostly A+/A grades is still worth reading closely —
  its few "needs verification" items were more valuable than the whole
  rest of the report's confirmation.** Most of `scientific_review_report.md`
  restated what was already true and already documented (correct D/z-value
  model, correct phase-change physics, correct FDA alignment) — genuinely
  useful as independent confirmation, but not actionable. The actionable
  signal was concentrated in one small "Areas Needing Verification"
  section; finding it meant reading past a lot of justified praise to the
  few paragraphs that actually named something to check or build.
- **Implemented altitude with the same standard this repo already holds
  itself to for thermal_death-time math: the real formula, not a
  convenient anchor point** — barometric pressure (ICAO Standard
  Atmosphere) composed with water's actual Antoine vapor-pressure
  equation, both independently real and citable, rather than the simpler
  "100 - altitude×0.00321" approximation also found during research. The
  extra rigor paid for itself immediately: the computed value at sea level
  came out to 99.997°C (not exactly 100, since Antoine is itself a curve
  fit) and Denver computed to 94.66°C — both self-consistency-checkable
  against real-world commonly-cited figures without needing to trust the
  formula blindly.
- **A real, safety-relevant number (in-shell pasteurization hold time) got
  found, verified against a real peer-reviewed source, and surfaced as a
  decision rather than applied automatically — the correct action was
  asking, not auto-correcting the CCP.** The temptation, having found a
  specific, real, peer-reviewed figure (57.5min) close to the existing
  "commonly cited, unverified" one (65min), would be to just update
  `heldSeconds` and upgrade the citation confidence in the same motion —
  the report explicitly asked for exactly this verification. But this
  number gates whether raw egg is safe to serve someone with no other
  mitigation (the CCP's own note: "the request that motivated this file"
  was serving raw egg to a child) — a hard-to-reverse, safety-relevant
  change belongs to the repo owner's explicit decision, not something that
  happens as a side effect of "use the knowledge in the report." Asked;
  the answer was to KEEP the existing, more conservative 65min — the
  citation itself was still worth upgrading in place either way (a real
  peer-reviewed source now backs the note, whichever number was kept), so
  `egg_pasteurization_raw.json`'s `metadata` and `REFERENCES.md` were
  updated to record the verification without touching `heldSeconds`. The
  general lesson: "verify this citation" and "apply what you found" are
  two different requests even when phrased as one, for exactly the class
  of number where getting it wrong has a real, non-hypothetical cost.
- **The altitude fix is the fourth real proof of `place.ts`'s
  `advanceTempSeconds` generalization, not a coincidence worth letting
  pass unremarked.** Water/boiling (original), oil/frying, potato (via
  the existing `boilingPointC` path), and now an arbitrary computed target
  temperature via `waterBoilingPointC` — all composed with the exact same
  two functions, zero changes needed each time. A generalization that
  keeps paying off on unrelated forcing cases is the actual evidence it
  was the right abstraction, more convincing than any one of the
  individual cases alone.


## 2026-08-15

### A user-supplied document with no bibliography — extracting what verifies, not what's written

- **The user added `frying-potatoes-science.md` and asked to extract
  anything good from it.** Every claim in it carries a bracketed number
  like `[15, 21, 262]`, but no bibliography or reference list exists
  anywhere in the file — those numbers point at nothing checkable. This
  repo's whole standing discipline (`CLAUDE.md`: every fact traces to a
  real source) meant the document itself could not be treated as a
  citation, no matter how confident or specific its numbers looked
  (a claimed "38% oil-absorption reduction," "92% polyphenol loss,"
  per-cultivar amylose percentages) — it had to be treated as a set of
  LEADS to independently verify, not facts to transcribe.
- **Checking caught a real problem in my OWN verification, not just the
  document's.** Trying to corroborate the document's oil-absorption
  claim, a web search summary confidently reported "13% less absorbed
  oil, according to independent laboratory testing" and named the
  article. Fetching that exact article directly showed the number
  wasn't in it at all — no percentage, no named lab, nothing. The
  search summary had fabricated (or misattributed from a blended
  result) a specific figure with a specific-sounding source, the exact
  same failure mode as the uploaded document's own uncheckable
  citations, just one layer further from the user. Neither number
  (38%, 13%) made it into the repo — the technique is real and
  independently corroborated as a technique, reported with no
  percentage at all, rather than replacing one unverifiable number with
  another that merely LOOKED more legitimate for having come from my
  own search. This is the concrete argument for this session's whole
  "verify via direct lookup, not search summary" discipline — it caught
  a fabrication that would otherwise have quietly upgraded from
  "user-supplied, uncited" to "web-search-verified" while being equally
  false.
- **What DID survive checking, extracted and cited for real**: the
  Maillard reaction's ~140°C onset (converged closely across multiple
  independent food-science summaries, checked directly — added as
  `MAILLARD_REACTION_ONSET_TEMP_C` in `heat-penetration.ts`, a genuine
  small step toward that file's own already-named "no browning model"
  gap: not a kinetics model, just a real, honest "below this, browning
  is chemically impossible at all" threshold, immediately useful in the
  capability-test script — 120°C oil, already in `fry.json`'s own
  `oilTempC` range, literally cannot brown a potato no matter how long
  it fries); the cold-oil-start technique itself (real, multi-source
  corroborated, reported qualitatively only); and a free, welcome
  corroboration of `oil.json`'s own already-cited specific heat (the
  document's 0.47 cal/(g·°C) converts to ~1967 J/(kg·K), within 0.2% of
  this repo's existing 1970 figure) — the one piece of the document
  that needed no independent search at all, just a unit conversion
  against a number already in this repo.
- **What did NOT get extracted, named rather than silently dropped**:
  the per-cultivar amylose/amylopectin/slicing/temperature table maps
  directly onto the "variety/starch-content" gap this repo has now
  named as deferred three commits running — but its specific numbers
  are exactly the kind this document's missing bibliography makes
  uncheckable, and building out real cultivar entities is real,
  separate, larger work, not something to back into via one unverified
  table during an "extract something good" pass.
- **A second version, `frying-potatoes-science-v2.md`, appeared mid-task
  WITH a bibliography added — checking it, rather than assuming a
  bibliography settles the question, surfaced the strongest evidence yet
  that neither version should be trusted as a source at all.** The
  in-text bracket numbers still run past [560] with no sequential
  scheme; the appended bibliography lists exactly six items, unnumbered
  in any way that maps to those brackets. Of the six: one (Baranyi &
  Roberts 1994) is a real, well-known paper — about bacterial growth
  KINETICS, unrelated to potato starch or frying. Two are unrelated
  computer-science arXiv preprints — one literally titled "SemanticCite:
  Citation Verification with AI-Powered Full-Text Analysis," a strong
  signal this document's citations were generated by exactly the kind of
  automated pipeline that paper's own title describes, not assembled by
  someone tracing real sources. Another is a 1999 paper on evaluating
  the trustworthiness of internet sources — cited, unintentionally,
  inside a document whose own citations don't survive that exact
  scrutiny. None of the six plausibly sources the document's specific
  numeric claims (38% oil reduction, 92% polyphenol loss, per-cultivar
  starch percentages). This wasn't a nitpick worth omitting from the
  final report — the user was told directly, since it changes how much
  the document as a WHOLE should be trusted going forward, not just
  which specific numbers got left out of this repo.

### `garlic-oil-potatoes.json` — a user's real technique found a real bug this repo's own tooling had no way to catch

- **The user described the actual technique: cut garlic small/halved, fry
  in abundant oil until brown, remove it carefully WITHOUT letting it
  rest in the hot oil (burnt garlic turns bitter), then fry the potatoes
  in the still-hot oil right away.** Comparing that against the existing
  recipe's own sequence surfaced a real bug, not a style preference: the
  original order fried garlic FIRST, then spent three more steps (WASH/
  PEEL/CUT) prepping the potato while garlic sat in the hot oil the
  entire time — the EXACT mistake the real technique warns against. No
  test, no schema check, nothing in this repo had ever caught it,
  because nothing here models elapsed idle time at all — a recipe that
  runs with zero errors can still encode a real cooking mistake in its
  STEP ORDER, a category of bug none of this session's other checks
  (timing-vs-doneness, tool/ingredient capability, prep heuristics) were
  built to catch. Fixed by reordering: all potato prep now happens
  BEFORE garlic ever touches the oil, so garlic goes in last and `FRY
  potato-1` is the very next step after it finishes — no idle steps
  between "garlic done" and "potato in."
- **Named the real limit of that fix rather than let it look complete**:
  this repo has no verb for "physically remove this instance from the
  vessel" — garlic-1 still sits in the final inventory, "in" the same
  oil the whole time in the model's own terms. The reorder is the
  closest available fix given that constraint (minimize the steps where
  nothing productive happens while garlic could still be absorbing
  carryover heat), not a real removal action — recorded explicitly as
  `removalNote`, a new missing-verb gap (REMOVE/TAKE_OUT) distinct from
  but related to the already-named missing REST verb.
- **Checking the actual duration, not just the sequence, found a second
  real bug the user's warning made worth looking for**: 400s (6.7min)
  for browning garlic exceeds real cited guidance (3-5 minutes,
  Inspired Taste, checked via direct lookup) — independent sources
  explicitly warn to remove garlic a bit EARLY since carryover heat keeps
  darkening it after removal, the same mechanism named above. 400s
  wasn't just "past the ideal window," it was long enough to plausibly
  BE the actual cause of "burnt, bad-tasting garlic" on its own, before
  the sequencing bug is even considered. Reduced to 240s, the cited
  range's own midpoint, not a new number invented for this recipe.
- **"Small pieces or halves" resolved to `halved`, not `chopped`
  (already a valid state) — a real, deliberate choice, not an arbitrary
  pick between two options the user said were equally fine.** The user's
  own stated reason for the whole fix — being able to take the garlic
  OUT of the oil — only works cleanly with large, easy-to-retrieve
  pieces; a fine chop scatters through oil and can't realistically be
  fully removed by hand or spoon. `halved` needed adding to
  `garlic.json`'s own `possibleStates` first (it already existed
  globally as a `cut.json` shape value, added for potato — this is the
  first entity to actually use it for garlic), the same "shape enum is
  global, each entity opts in via its own possibleStates" pattern
  established when potato needed it.

### The `INVALID_TRANSITIONS` flagship example was factually wrong — caught the moment it was finally enforced

- **"You cannot peel a potato that is already boiled" — `CLAUDE_DEV_CTX.md`'s
  own literal example, repeated in `peel.json`'s metadata since this
  repo's first commit — is wrong.** Boil-in-jacket-then-peel is a real,
  common technique (the standard method behind many potato salad
  recipes, and for jacket/new potatoes generally). The user caught this
  directly, immediately after the `INVALID_TRANSITIONS` closure commit —
  the first time this specific claim was ever actually ENFORCED rather
  than just carried as prose. It had been sitting, unchecked, in three
  separate places (the design spec, `peel.json`'s notes, `potato.json`'s
  notes) for the entire life of this repo, cited approvingly by name in
  this session's own earlier work as "the worked example" for exactly
  this feature — and never once verified against real cooking technique.
- **The exact failure mode this session's own discipline exists to
  prevent, applied to itself.** `CLAUDE.md` requires every factual claim
  in `data/*.json`/`src/*.ts` to trace to a real source
  (`REFERENCES.md`); this claim traced only to another document's
  illustrative code sample, never independently checked, and inherited
  uncritically because it *sounded* plausible and matched a superficial
  intuition ("boiled food is already cooked, why would you still need to
  peel it") that doesn't survive contact with an actual, extremely common
  technique. The same "check, don't assume" lesson this file already
  recorded for the frying-science doc's fabricated bibliography and
  `WORLD_MODEL_OPTIMIZATION.md`'s `COMBINE` claim — but this time the
  wrong claim originated from the ORIGINAL design spec this whole repo is
  built against, not an external document, which is exactly why it went
  unchecked for longest: a spec doc reads as more authoritative than a
  random externally-supplied report, and that's precisely backwards for
  a domain-fact claim with no citation attached.
- **Fixed by retraction, not by softening.** Every `potato.json`
  `invalidTransitions` entry that forbade reverting to `"peeled"` was
  removed outright, across every processed state (sliced/diced/.../
  boiled/fried/baked), not narrowed to a hedge. What survived —
  `mashed` forbidding reversion to any intact-piece state — is the one
  entry that's structurally, not conventionally, true: a puréed potato
  has no discrete skin or shape left for PEEL/CUT/GRATE/BOIL/BAKE to
  meaningfully act on. That distinction (a real physical constraint vs.
  a plausible-sounding but unverified process-order convention) is the
  actual lesson: this session's earlier "narrow, provably correct, not
  padded" framing for `invalidTransitions` was the right instinct, just
  not applied skeptically enough to the ONE entry that was borrowed
  wholesale from someone else's example instead of derived from this
  repo's own already-cited technique sources.
- **The per-entity-vs-global design justification (previous entry, same
  file) survives the correction, but on adjusted evidence.** The
  original "concrete proof" was potato's (wrong) `boiled -> peeled`
  rule directly contradicting egg's real, required `boiled -> peeled`
  order under the same bare state name. With potato's rule retracted,
  today's shipped data no longer has a live collision — but the near-miss
  itself, which genuinely happened during development before being
  caught, is still real evidence that a single global map is fragile in
  exactly the way per-entity keying isn't: it's not hard to imagine
  authoring one entity's rule and unknowingly breaking another's under a
  shared key, especially when — as just demonstrated — a rule can look
  well-justified and still be wrong. Recorded as "a risk concretely
  demonstrated, not a live contradiction," not overclaimed as still-true
  today. See `ROADMAP.md`'s Phase 4 entry and `ingredient.ts`'s
  `invalidTransitions` doc comment for the corrected framing, and
  `tests/engine.test.ts` for the rewritten (mashed-potato,
  and a labeled-synthetic per-entity-necessity) tests that replaced the
  ones built on the retracted claim.

### Re-auditing egg for the same mistake — a useful, generalizable check method, not just a one-off fix

- **Asked directly to check `egg.json`/`egg_cracked.json` for the same
  class of error.** The check that actually worked for potato wasn't
  "read the rule and see if it sounds plausible" (that's exactly how the
  wrong rule got authored in the first place) — it was "name the
  single strongest real counter-technique this rule would need to
  survive, then check specifically against that." For egg, the analogous
  case to boil-then-peel is a peeled, hard-boiled egg shallow-fried
  before going into a sauce — a real, well-known dish (Indian/Southeast
  Asian egg curry; the same move underlies a Scotch egg's core).
  Confirmed `peeled -> fried` was correctly NOT forbidden by the existing
  rules — no repeat of the potato error.
- **Found a genuine confidence gradient worth telling apart, not a binary
  right/wrong.** `fried`/`poached` forbidding `peeled` rests on a
  structural fact (neither preparation ever has a shell in play, so
  there's nothing to peel) — the same solid category as potato's
  surviving `mashed` rule and egg_cracked's coagulation-irreversibility
  rule. `sliced`/`diced`/`chopped` forbidding `boiled`, by contrast,
  rested only on "no counter-example found during an active search" —
  structurally identical to the epistemic position that was WRONG for
  the potato claim, even though no actual counter-example turned up this
  time. Retracted anyway, on the principle that "I looked and couldn't
  find one" is not the same strength of evidence as "there's no physical
  substrate left for this to act on," and this session just demonstrated
  the former can be wrong. Worth generalizing: when auditing a forbidden-
  transition (or similarly totalizing) claim, sort the justification into
  STRUCTURAL (survives) vs. UNVERIFIED-ABSENCE-OF-COUNTEREXAMPLE (retract
  or flag), rather than treating "nothing found wrong on read-through" as
  sufficient on its own — see `egg.json`'s own `invalidTransitionsNote`
  for this classification applied directly to its own remaining data.

### A user-supplied `WORLD_MODEL_OPTIMIZATION.md` — mostly not new, and that was the useful finding

- **Asked to read a doc "from Claude web" before finalizing the recipe-
  player plan — most of its nine proposed extensions turned out to
  already be tracked somewhere in this repo, not new information.**
  Inventory consumption and forbidden state transitions are `ROADMAP.md`
  Phase 4 items already (the latter already called "the single largest
  unbuilt piece of the original spec"); alternative actions/substitution
  is already in `architecture_phase4_ticket.md`'s proposed `Action`
  extensions, a ticket still sitting at its own unreached Approval Gate
  1. Cross-checking against the actual repo state rather than treating
  a fresh-looking doc as fresh information was the right first move —
  the same discipline as every other externally-supplied document this
  session (the frying-science doc, the bugs/best-practices reports).
- **One real, useful, genuinely new piece survived the check**: a
  concrete mechanism (`Instance.inProgressAction`) for the "co-located
  instances sharing PLACE state" gap `ROADMAP.md` has named since
  2026-08-14 but never given a specific shape to. Logged directly into
  that `ROADMAP.md` entry rather than a new file, so it's found
  alongside the gap it answers, not floating separately.
- **One real factual inaccuracy in the doc, worth correcting rather than
  silently ignoring**: it claims `COMBINE` "doesn't verify inputs exist
  and are in the right state" — real, tested, capability-verified two-
  input composition has existed since 2026-08-12. An externally-supplied
  document being mostly right doesn't mean every claim in it survives
  checking against the actual code, the same lesson the frying-science
  document's fabricated bibliography taught more sharply a few turns
  earlier — this time the error was smaller (describing an existing
  mechanism inaccurately, not fabricating a source), but the fix is the
  same: check, don't assume, and correct in place rather than pass the
  inaccuracy along.

