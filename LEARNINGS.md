# LEARNINGS.md

A dated, append-only log of concrete things learned while building this engine —
patterns, gotchas, and *why* a design choice was made, not a changelog of *what*
files changed (that's `git log`). Read this before starting new work in this repo;
append a new dated entry when you learn something that would've saved you time if
you'd known it going in. Don't rewrite or delete old entries — append.

---

## 2026-08-12

### Schema/engine constraints that shape everything downstream

- **`ActionOutputsSchema` supports exactly one of `transformedState` (fixed) or
  `transformedStateFromParameter` (fully parameter-driven) — never "fixed by
  default, overridable per call."** This blocked giving garlic's FRY a real
  `"browned"` state without breaking every potato/egg caller that doesn't pass a
  doneness param (`transformedStateFromParameter` throws if its param is
  missing, `required: false` or not). Resolution used twice: keep the nuance as
  an **informational, non-state-determining parameter** instead of inventing a
  default-value mechanism. The alternative — splitting a dedicated verb, the way
  `SCRAMBLE` was split from `FRY` and `POACH` from `BOIL` — is the other valid
  escape hatch when the outcome genuinely differs enough to earn its own verb.
- **`requiredIngredientCapabilities` checks presence via the ingredient's
  *entity* definition only — never the ingredient *instance's* current
  state.** A whole raw garlic clove and knife-minced garlic both satisfy
  `isAromaticSource` identically. Real technique cares about surface area /
  rupture; the engine can't currently express that. Flagged in `infuse.json` as
  a known, pre-existing gap, not something new.
- **`byproductsByAction` (entity-level, keyed by action id) exists because a flat
  `producedByproducts` list breaks the moment one entity has *two* different
  `spawnsTargetByproducts` actions with different outputs** (egg: `PEEL` → shell
  only, `SEPARATE`/`CRACK` → shell + yolk/white or shell + cracked). Any new
  entity with more than one spawning action needs this, not the flat list.
- **`destroysTarget` actions still populate `ExecutionResult.instance`** — it's
  the target's state the instant before removal, kept for logging. The caller
  (`recipe-runner.ts`) must `inventory.delete(...)`, not `inventory.set(...)`,
  when `result.destroyed` is true. A demo script bug (`cook-egg-many-ways.ts`
  first draft) chained off `.instance` after `CRACK` instead of `.spawned` —
  caught by actually running the script, not by reading the code.

### HACCP / safety modeling

- **`CriticalControlPointSchema` is shaped for cook-time temperature/hold-time
  thresholds. It does NOT fit storage-duration hazards** (garlic-in-oil
  botulism is a post-preparation refrigeration/acidification concern, not
  something any cooking step's heat controls). Forcing a hazard into a schema
  built for a different-shaped problem would misrepresent it — correctly
  identifying "this doesn't fit, here's why" is itself the rigorous move, not a
  gap to paper over. See `infuse.json`'s `safetyNote`.
- **The CCP existence check must be gated on the triggering parameter
  (`durationSeconds`) actually being supplied — not merely on the target
  entity having a `criticalControlPointsByAction` entry.** First draft threw
  `"references unknown CriticalControlPoint"` on *every* egg fry/poach that
  didn't pass a duration, because the check ran unconditionally once the entity
  declared a CCP for that action. Caught by full regression, not by review.
- **"Same API" (CONCEPT.md §17: a robot drives the same event timeline a human
  would) does not mean "same default judgment call."** An `advisoryOnly` CCP
  shortfall that a human can read and accept for themselves (a runny yolk) has
  no one to make that call under autonomous execution — the safe default has to
  flip to reject, not stay permissive, unless a human explicitly pre-authorized
  that specific CCP id in advance. This is `engine.ts`'s `SafetyPolicy` and
  `ENGINE_INVARIANTS.md` #11.
- **Every categorical "informational only" parameter accumulated so far**
  (`heatLevel`, `doneness`, `oilAdditionRate`, `curdSize`, `agitation`,
  `waterTempC`) **is a human-readable technique hint with no defined mapping to
  an actual robot actuator command.** `SafetyPolicy` only closes the HACCP-timing
  gap for autonomous execution — it does not make the rest of the engine
  robot-ready. Saying this explicitly beats letting "autonomous mode exists
  now" imply more capability than exists.

### Recipe-level patterns

- **A finished "dish" (alioli, salted fried potatoes) is represented by a
  `RecipeScript`'s own `names` field, not a new composite entity** —
  `EntitySchema.structure.composite/components` exists but nothing populates it
  yet. Assembling multiple finished instances into one composite dish (a salad
  from reused fried garlic + other components) is a genuinely unbuilt feature
  (no `ASSEMBLE`-style verb, no merge-instances mechanic) — flagged as an open
  extension in `garlic-oil-potatoes.json` rather than faked with a hollow
  composite entity that's really just one ingredient under a new id.
- **Ingredients are never consumed/decremented by `requiredIngredientCapabilities`
  checks — only checked for presence.** This is a documented limitation
  (`engine.ts`'s own doc comment), but it's also what makes "the same oil
  instance flavors garlic, then fries a potato two steps later" work for free —
  a limitation and a convenience at the same time, worth knowing both sides of.
- **Two recipes meant to be compared side-by-side** (`handmade-alioli.json` vs.
  `handmade-alioli-egg-yolk.json`) **should share every step up to the point
  they actually diverge, using identical parameter ids/units so the diff is
  literal, not narrated.** Cross-reference both directions in `metadata` since
  `RecipeScriptSchema` has no formal "variant of" field.

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

### Test runner (ROADMAP.md Phase 0, closed)

- **`node:test` (built into Node 24, already the runtime here) + `tsx` as
  the loader needs an explicit glob, not a directory, as its file arg.**
  `node --import tsx --test tests/` throws `ERR_UNSUPPORTED_DIR_IMPORT` —
  tsx's own resolver intercepts the bare directory path before node:test's
  file-discovery glob logic gets to it. `node --import tsx --test
  tests/*.test.ts` (shell-expanded explicit file list) works fine. No new
  devDependency needed (`vitest`/`jest` were the assumed candidates in
  ROADMAP.md's original phrasing; `node:test` was better-fitting since this
  repo already runs everything through `tsx`, not a bundler).
- **Zod's `z.infer` (post-default output type) is the wrong type to build
  test-fixture builders against — use `z.input` instead, and `Partial<>`
  it.** A helper like `makeAction({ id, outputs: { transformedState: "x" } })`
  needs `outputs` to accept a partial object (missing
  `spawnsTargetByproducts`/`destroysTarget`, which Zod fills in at parse
  time) — `Partial<Action>`'s `outputs` field is typed as the FULL
  post-default `ActionOutputs` shape (booleans required), so TypeScript
  rejected every fixture that only set one field. `Partial<z.input<typeof
  ActionSchema>>` uses the pre-default shape instead, where those same
  fields are genuinely optional — matches what `.parse()` actually accepts.
- **A regression test is only proven to catch its regression by actually
  breaking the code and watching it fail red** — same discipline as every
  other check in this repo (this file's running theme: "caught by running
  it, not by reading the code"). Deliberately removed the
  `Number.isNaN(seconds)` guard `engine.ts`'s CCP check depends on (see the
  2026-08-12 entry on this same guard) and confirmed exactly the intended
  test failed, then restored it — the other 43 tests staying green in the
  same run is itself a check that the fixture builders aren't accidentally
  coupled to each other.
- **`tsconfig.json`'s `include` didn't cover `tests/` by default** — added
  it, since `npx tsc -p . --noEmit` is one of the two authoritative checks
  this repo runs after any change ("Process" section above), and a test
  file with a real type error should fail that check like any other file,
  not be silently skipped because it lives outside `src`/`scripts`.
- **Unit tests (fast, synthetic `Entity`/`Action`/`CriticalControlPoint`
  fixtures built with minimal `.parse()`-validated builders) and
  `scripts/validate.ts` + the demo/recipe scripts (slower, exercise the
  real `data/*.json`) are complementary, not redundant.** The unit suite
  pins down `engine.ts`'s branch logic in isolation (e.g. "does
  `combinesInto` merge tags from both instances, filtered by
  `possibleTags`" — provable in ~15 lines with two throwaway entities)
  without needing a real recipe file to exercise it; the integration layer
  still catches the class of bug the unit suite structurally cannot (a
  real `data/entities/*.json` referencing a CCP id that doesn't exist,
  runtime-assigned instance ids from an actual run not matching what a
  recipe file guessed — the "wrong/typo'd id" entry above). Neither
  replaces the other; both now belong in the standard post-change check
  list (`npm test`, `npm run validate`, every demo, every recipe, `tsc`).

### Salting timing + quantity (asked about the same day, closed same session)

- **`SALT` had no notion of WHEN relative to cooking it happens, and that's
  not a cosmetic gap — pre-salting draws moisture out via osmosis (drier
  surface, better browning/crisping when fried) while post-salting is
  surface-only seasoning with zero effect on the cook.** Closed with an
  informational `timing` parameter (`before_cooking`/`during_cooking`/
  `after_cooking`) on `salt.json`, same non-enforced pattern as `fry.json`'s
  `heatLevel`/`doneness` — still doesn't feed back into `FRY`'s actual
  outcome (that would need `FRY` to read a moisture/salting-history signal,
  flagged as a real, separate, unbuilt gap in `salt.json`'s
  `timingNote`). Retrofitted onto all 9 existing recipes that call `salt`
  after an upstream cook step exists, using the recipe's actual step order
  to decide the value (not guessed) — the 2 alioli recipes were correctly
  left without a `timing` value, since garlic is never cooked in either
  dish and the parameter wouldn't mean anything there.
- **A from-scratch batch-edit of several recipe JSON files via
  `json.dump()` silently reformats the WHOLE file** (compact single-line
  array entries become multi-line, unrelated whitespace changes throughout)
  **even when only one field actually changed** — caught immediately by
  `git diff` showing a wall of noise for a one-key edit, not by anticipating
  it. Reverted and redid the same 9 edits as literal string replacements
  (`Edit`/targeted `str.replace`) that touch only the line that changed.
  General lesson: never round-trip a hand-formatted JSON file through a
  generic serializer for a small edit — diff what you're about to write
  before trusting it, or edit the text directly.
- **Quantity ("how much is a pinch, compared to what?") was not a small
  follow-up question — it's `ROADMAP.md` Phase 1's known-unbuilt
  `RecipeIngredientSchema`, and it's the thing the OTHER two questions
  asked the same session (crystal size, generalizing SALT to
  pepper/chili) actually sit on top of, not a peer of either.** Confirmed
  by grep before building anything: zero quantity representation existed
  anywhere (`RecipeInstanceSchema` had `id`/`entityId`/`state`/`tags`, no
  amount field at all) — `salt-1` was "a salt instance that exists," not
  "3g of salt." Worth recognizing explicitly when several small-sounding
  questions arrive in a burst: check whether they're actually independent,
  or whether one is foundational and the others are downstream of it — build
  in dependency order, not arrival order.
- **"A pinch" and "2% of flour by weight" are not the same KIND of
  quantity, and collapsing them into one `amount` field would misrepresent
  whichever one doesn't fit** — this is why `QuantitySchema` is a
  3-way discriminated union (`precise`/`imprecise`/`relative`), not a
  single number+unit. `imprecise` exists because cooks genuinely do not
  measure a pinch (forcing a fake gram value would itself violate this
  repo's own "don't imply more precision than was verified" standard,
  already established for `CitationSchema`); `relative` exists because
  some real quantities (professional bread salt, dosed as a baker's
  percentage of flour mass) genuinely ARE precise but answer "how much"
  only in terms of another ingredient, not an absolute number — directly
  answers "a pinch, compared to what?" for the cases where the honest
  answer is "it doesn't compare to anything, it's just vague" vs. the
  cases where the honest answer is "precisely 2% of the flour."
- **A pinch's real-world gram equivalent depends on the SAME crystal-size
  axis raised as a separate question in the same conversation (coarse vs.
  fine salt) — the two gaps aren't independent, one is a concrete instance
  of the other.** Recorded directly in `QuantitySchema`'s `"imprecise"`
  branch doc comment rather than treated as unrelated, so the connection
  isn't lost between the two LEARNINGS entries. Crystal size itself (fine
  table salt vs. coarse sea salt vs. kosher as separate entities, or a
  property on one) remains genuinely unbuilt — deliberately deferred
  rather than guessed at, same reasoning as `garlic-oil-potatoes.json`'s
  salad gap: name it precisely, don't build it speculatively until a real
  dish needs to distinguish them.
- **Generalizing `SALT` into a parameter-driven `SEASON` verb (so pepper/
  chili don't need copy-pasted actions) was deliberately NOT built this
  session, on the user's own call, in favor of building quantity first.**
  Real blocker if it had been attempted: `ActionOutputsSchema.addsTag` is a
  fixed string today, with no `addsTagFromParameter` counterpart to
  `transformedStateFromParameter` — and `requiredIngredientCapabilities`
  only checks presence, never identifies WHICH specific instance among
  several satisfied the capability, so there'd be no way to know which
  literal tag to add even with that engine feature. Both real, both still
  open — next real dish that needs a second seasoning (not just salt)
  should be what drives building this, per this repo's established working
  method, not built ahead of that need.
- **Told directly to build PEPPER/CHILI without the SEASON generalization
  (engine work explicitly paused) — duplicating SALT's shape found a real
  correctness bug BEFORE it shipped, not after.** `requiredIngredientCapabilities:
  ["isSeasoning"]` on `salt.json`'s action was fine when salt was the only
  entity declaring `isSeasoning: true` — the moment `black_pepper`/
  `chili_flakes` were added with the same generic flag, `SALT` would have
  silently accepted pepper as satisfying "a salt-like ingredient is
  present." Caught by asking "does adding a sibling break the existing
  one" before writing the new entities, not by testing after — fixed by
  splitting the generic `isSeasoning` (kept, genuinely useful as "is this
  A seasoning at all") from three specific capabilities
  (`isSaltySeasoning`/`isPepperySeasoning`/`isSpicySeasoning`) that each
  verb's `requiredIngredientCapabilities` actually checks. Proven, not just
  reasoned about: `scripts/season-potato-three-ways.ts`'s last check
  deliberately tries to SALT a potato with only `black_pepper` on hand and
  asserts it's rejected.
- **`ActionOutputsSchema.addsTag` is applied by `applyAction` completely
  independent of the target entity's `possibleTags`** — only byproduct/
  `combinesInto` tag INHERITANCE is filtered against `possibleTags`
  (`engine.ts`), the primary `addsTag` path never was. This means an entity
  could `allowedTransformations`-permit an addsTag-shaped action without
  ever listing the resulting tag in its own `possibleTags`, and nothing
  would catch it — not a hypothetical, found while manually wiring
  "peppered"/"chili_seasoned" onto potato/egg/egg_cracked and realizing
  there was no check forcing that step to be remembered. Added as a
  permanent `scripts/validate.ts` NOTE (not a hard fail — the asymmetry
  with inheritance-filtering is real, so a false-positive-safe soft check
  is the honest one) rather than trusting it to be done right by hand
  again next time. Proven to fire by deliberately dropping "peppered" from
  potato.json's possibleTags and confirming the NOTE appeared, then
  reverting — same discipline as every other check in this repo.
- **Extending a closed enum (`CRUSH`'s `fineness`: `coarse`/`fine_paste` →
  + `cracked`/`ground`) to fit a second, differently-shaped use case (whole
  peppercorns, which never become a paste) is backward-compatible by
  construction — worth reaching for before assuming a new parameter or new
  verb is needed.** Same reasoning `CUT`'s single `shape` enum already
  generalizes across every choppable entity, applied here for the first
  time to a SECOND action (`CRUSH`) instead of just cited as precedent.
- **A gap flagged honestly in a doc comment, then left alone, is worth
  actually revisiting once the vocabulary grows into it — not just citing
  as "still true."** `garlic.json`'s `flavorChemistryNote` flagged
  `SensoryPropertiesSchema.taste`'s missing "pungent" category back on
  2026-08-12 (allicin's sharpness isn't one of the five basic tastes,
  'umami' was the closest available value, not the correct one) but wasn't
  fixed then — closed now, adding black pepper (piperine) and chili
  (capsaicin) made it load-bearing for THREE entities' sensory accuracy at
  once instead of one, not just garlic's.
- **User-directed scope change ("don't worry about the engine yet, get
  common knowledge into schemas") is a real instruction to prioritize
  breadth-of-coverage work over the engine-consumption work flagged as
  open in the previous entries — not a request to build speculatively
  everywhere.** Handled by: (1) still choosing the concretely-teed-up next
  step (seasoning generalization) rather than picking an arbitrary new
  domain, (2) auditing what's ACTUALLY unrepresented (allergens, cross-
  contamination, staple-ingredient breadth, more verbs) and writing it down
  as a prioritized, honestly-scoped list (`ROADMAP.md`'s new "Common
  culinary knowledge coverage" section) rather than either silently picking
  one to build next unprompted or claiming "all common knowledge" was
  actually achieved in one session — "all" is not a completable claim to
  make honestly here, a checkable list is.

### Heat sources (gas/vitro/wood) + egg-boiling doneness timing

- **A new, real-world domain (heat providers) needed its own top-level
  knowledge collection, not a field bolted onto `EntitySchema`, and
  `CriticalControlPointSchema`/`data/ccps/` was the right precedent to
  copy, not `EntitySchema.thermophysical`.** Tried to attach heat-source
  facts to `EntitySchema` first and hit a real circular-import problem
  immediately: a `HeatSourceProfileSchema` needs `CitationSchema` (defined
  in `ingredient.ts`), but making `EntitySchema` reference
  `HeatSourceProfileSchema` back would require `ingredient.ts` to import
  from the new file too — a genuine cycle, not a style preference. Solved
  by recognizing this is structurally the SAME problem `thermal.ts`/
  `data/ccps/` already solved for CCPs (a fact that doesn't belong to one
  entity, referenced BY id from wherever needed): `src/heat-source.ts` +
  `data/heat-sources/*.json` + `registry.ts`'s `loadHeatSources`, one-way
  import from `heat-source.ts` to `ingredient.ts` only. Worth recognizing
  generally: hitting a circular import is sometimes a signal the new
  concept is a peer of an existing top-level collection, not a child field
  of an existing entity — check for a same-shaped precedent already in the
  repo before restructuring imports to force the field-on-entity shape.
- **The single most important fact to get right here, stated explicitly
  because it's a real, common misconception: which heat source you use
  changes how FAST water reaches boiling, never the TEMPERATURE it boils
  at.** Water is ~100°C at sea level whether it's a bare simmer or a
  roaring boil — pressure/altitude is the only thing that moves that
  number (`water.json`'s existing citation). Modeling heat source as
  adjusting `BOIL`'s required `durationSeconds` (time spent AT
  temperature — what actually cooks the egg) would have been physically
  wrong, not just imprecise; `heat-source.ts`'s new `heatSource` parameter
  on `boil.json` is deliberately informational-only, same non-enforcement
  pattern as `heatLevel` elsewhere, specifically so it can't accidentally
  end up feeding into that number.
- **Asked directly not to overstate precision here, and the honest answer
  required two separate corrections to what had just been built, not one.**
  (1) `estimatedPreheatSeconds` uses one constant average power/efficiency
  value across the whole heating interval — real delivered heat is a
  continuously time-varying curve (most obviously for wood fire, but
  genuinely true for gas/vitro's own startup ramp too); this is now stated
  explicitly as a first-order energy-balance estimate, not a curve
  simulation, matching `thermal.ts`'s own "validity condition" discipline
  for its D/z-value model. (2) A skilled cook's real fine control over
  delivered heat is NOT fully captured by the source's own dial/damper —
  physically moving the pan (off flame, to a fire's cooler edge, lifting
  it) is a real, separate control technique, most load-bearing on wood
  fire specifically because the fire itself often can't be finely dialed
  at all. Added `manualPositioningRelevance` (low/moderate/high per source)
  to name this honestly rather than let `controlPrecision` alone imply it
  was already covered. General lesson: when told "I don't want to go that
  deep, but be scientifically accurate," the right response is not
  refusing to note the limitation — it's stating the limitation precisely
  enough that a reader knows exactly what's NOT modeled, at whatever depth
  the model itself stays.
- **"If I tell a robot I want my egg medium boiled, I want it to
  understand it" pointed at a real, load-bearing, previously-silent gap:
  `boil.json`'s `yolkDoneness` (soft/medium/hard) was a label with ZERO
  attached meaning anywhere in this repo** — informational-only, by design,
  same as `heatLevel`/`doneness` elsewhere, but for THIS parameter that
  meant "medium" resolved to literally nothing a robot (or a human) could
  act on. Closed at the reference-data layer, not the engine layer, on
  purpose: `src/egg-doneness.ts`'s `EGG_BOIL_DONENESS` gives "medium" a
  real, cited seconds range (480-540s) instead of nothing — but
  `applyAction` still doesn't compute `durationSeconds` FROM `yolkDoneness`
  automatically. That's a deliberate line, not an oversight: CONCEPT.md
  §14 already establishes that resolving a customer's stated intent into
  concrete parameters is the LLM-intent-layer's job, not this schema's
  (the exact same principle `fry.json`'s tortilla-francesa/French-omelette
  disambiguation note applies) — this repo's job is making sure that
  resolution has something REAL and GROUNDED to resolve against, which it
  now does, not doing the resolving itself.
- **A new reference table is worth cross-checking against data that
  already existed before it, not just trusting it in isolation.**
  `EGG_BOIL_DONENESS`'s "soft" range (360-420s) was checked against
  `soft-boiled-egg.json`'s already-existing choice of 390s (picked in an
  earlier session, before this table existed) — it falls inside the range,
  a real consistency check, not a coincidence assumed without checking.
  Turned into a permanent unit test (`tests/egg-doneness.test.ts`) so this
  stays checked on every future change, not just verified once by hand.
  Cold-start timing was deliberately left OUT of the new table for the
  opposite reason — checked whether preheat-time + hold-time could just be
  added together for that case and concluded no (the egg cooks gradually
  through the whole ramp, not just once boiling), so a wrong number wasn't
  shipped just to have complete coverage.
- **Salt added to egg-boiling water is real, common technique — but it is
  NOT an instance of `SALT`'s existing seasoning mechanism, and forcing it
  into that verb would have been a category error.** `SALT`/`addsTag:
  "salted"` exists because of osmosis/browning/flavor chemistry
  (`salt.json`'s `timingNote`); salting boiling water for an egg is
  causally different (faster coagulation of leaked white sealing a crack
  if the shell breaks) and isn't really about flavor at all — the egg
  barely absorbs salt from the water in ~10 minutes, unlike a porous food
  cooked longer in salted water (pasta, potato). Documented as a real,
  correctly-scoped, deliberately-not-built gap (`egg.json`'s new
  `crackContainmentNote`) rather than either ignored or mis-modeled via
  the wrong verb just to "have something" — same discipline
  `infuse.json`'s `safetyNote` already established for a differently-shaped
  CCP mismatch. Also explicitly did NOT repeat the commonly-claimed
  "salted water peels eggs easier" — checked confidence on that specific
  claim separately from the crack-containment one and found it weaker/
  disputed (freshness and shocking are the better-supported explanations),
  and said so rather than flattening both claims to the same certainty.

### SIMMER verb, and "heat belongs to a place, not an ingredient"

- **A new verb reusing an existing `transformedState` on purpose, rather
  than inventing its own, was the right call — and the check for it was
  concrete, not just a feeling.** Built `SIMMER` (`data/actions/simmer.json`)
  as a genuinely distinct verb from `BOIL` (different temperature band,
  85-96°C vs. ~100°C, different technique reasoning) but had it produce the
  IDENTICAL `outputs.transformedState: "boiled"` rather than a new
  "simmered" — because a simmered potato/egg and a boiled one are the same
  dish in real cooking, not two different foods, and inventing a second
  state for the same real-world outcome would have been the same category
  error `heat-source.ts`'s "heat source changes TIME, never TEMPERATURE"
  warning already exists to prevent, just on a different axis (process vs.
  outcome, here). Verified this wasn't just a plausible-sounding call by
  actually running `PEEL` (which requires `egg.json`'s
  `statePrerequisites.peel: "boiled"`) against a `SIMMER`-produced egg in
  `scripts/simmer-vs-boil.ts` — it passes with zero new wiring, which is
  the actual evidence the shared-state choice was correct, not merely
  untested optimism. General lesson: when a new action's real-world result
  duplicates an existing state, reusing that state string and PROVING
  downstream consumers (other actions' `statePrerequisites`) still work is
  stronger evidence than asserting semantic equivalence in a doc comment.
- **A capability-test written against a schema constraint (here,
  `durationSeconds`' own `numericRange` floor) can block the exact
  demonstration it was meant to run — worth catching before shipping a
  test that would never actually execute its own interesting branch.**
  First draft of `simmer-vs-boil.ts` tried to replay `egg-haccp.ts`'s "10
  second flash-cook triggers a HACCP warning" demo for `SIMMER`, but
  `simmer.json`'s `durationSeconds` floor (60s, matching `boil.json`'s)
  rejects 10s before the CCP check ever runs — `fry.json`'s floor is 10s
  specifically, which is WHY that demo works there and wouldn't here.
  Resisted the tempting fix (lower `simmer.json`'s floor just to make the
  test pass) since that would be reshaping real data to fit a test rather
  than the reverse; instead changed the test to prove the actually true,
  stronger claim directly — `egg.json`'s `criticalControlPointsByAction.simmer`
  and `.boil` reference the LITERAL SAME CCP id, not a look-alike one, which
  is the real reason no separate threshold is needed (turbulence doesn't
  change Salmonella kill-time) — checkable by reading the data, no
  artificial edge case required.
- **A direct user observation mid-task — "heat is a function inside a place
  where many ingredients can live, it increases and decreases in time, you
  can heat up or play with the pan" — pointed at a real, structurally
  significant, previously-unnoticed gap, and the repo already had physical
  evidence of it before this conversation named it.** `pan.json` has listed
  `possibleStates: ["hot", "cold"]` since before heat-source work started,
  with its own `metadata.notes` already admitting "not fully modeled (no
  thermophysical data yet)" — but `allowedTransformations: []` means
  literally nothing in this vocabulary can ever move a pan between those
  two states; they've been unreachable dead labels. The deeper point:
  `engine.ts`'s `applyAction` is fundamentally one-target-instance-at-a-time
  with heat expressed as a parameter GUESSED PER CALL (`waterTempC`,
  `heatLevel`) on that one target — there is no representation of the
  pot/pan itself as a stateful place with a real temperature that persists
  and evolves over time, which every ingredient currently occupying it
  would share. Two eggs (or a potato and an egg) simmering in the same pot
  right now get two independent `applyAction` calls with two independently
  supplied temperature guesses, not one shared physical truth. This is a
  materially different, larger kind of gap than the "informational-only
  parameter" pattern this repo uses everywhere else (`heatLevel`,
  `startMethod`, `yolkDoneness`) — those all accept that a real mechanism
  goes unmodeled at the CHOSEN depth; this one is about WHERE the state
  even lives (the tool, not the ingredient) and WHETHER it's shared, a
  structural question a parameter tweak can't answer. Explicitly asked the
  user how far to take this before writing anything engine-side, given
  `ROADMAP.md` already has engine work paused for a differently-shaped
  reason (`SEASON` generalization) — answer was "document precisely, don't
  build yet," recorded as its own `ROADMAP.md` "Known-large" bullet rather
  than folded quietly into `SIMMER`'s own scope. General lesson: a user
  aside that sounds like a philosophical remark can be pointing at a real
  fault line already visible in the data (here, a dead-state pair sitting
  in `pan.json` for who knows how long) — worth actually checking the code
  for confirming evidence before either building on the spot or filing it
  away as a vague someday-gap.

### Simulation-target research (`SIMULATION_TARGETS.md`)

- **A vague-sounding request ("robot simulator?") had two structurally
  different honest answers, and asking which was meant mattered more than
  picking one.** First pass toward "robot thingy" defaulted to the
  manipulation/physics tier (RoboCasa, MuJoCo) — real and correctly
  sourced, but the user's follow-up ("states and worlds, or game frameworks
  where we can throw the cooking truth") revealed they meant the symbolic
  world-model tier instead. The two tiers don't overlap much: one answers
  "how does an arm move," the other answers "is this a coherent world of
  objects and states" — this repo currently has an answer to neither, but
  is MUCH closer in shape to the second. Re-searched rather than retrofitting
  the first answer to fit — the honest fix for a misjudged question is a
  second, differently-scoped search, not a reframing of the first result.
- **Live web research beat recalled knowledge here for a concrete, checkable
  reason: the field moved during this model's own training cutoff gap.**
  The current date (2026-08-13) is well past this session's knowledge
  cutoff (Jan 2026) for a fast-moving research area — RoboCasa365 (the
  actual current release) and the "periodic cooking" egg paper (published
  Feb 2025, `Communications Engineering`) both needed `WebSearch`/`WebFetch`
  to state correctly rather than from memory, matching this repo's own
  citation discipline (`CitationSchema`) applied to the AGENT's own claims,
  not just the data files.
- **The worked ingredient-mapping table surfaced a real, useful check that
  a written comparison alone wouldn't have: `requiredIngredientCapabilities`
  (water for BOIL, salt for SALT) is structurally an EXISTENTIAL PDDL
  precondition, not an operator parameter.** This wasn't obvious going in —
  water and salt are never the ingredient a JSON action's own
  `requiredTargetCapability` names, only ever the thing checked as merely
  *present*. Actually trying to translate `boil.json` into a PDDL operator
  forced the distinction into the open and confirmed something worth
  knowing on its own: this repo's presence-only, non-consuming semantics
  for `requiredIngredientCapabilities` (`ROADMAP.md` Phase 4's own framing)
  was the right design, not an approximation — PDDL's own standard
  vocabulary already has the matching shape (`exists`), so nothing had to
  be invented to accommodate it. General lesson: translating a schema into
  an unrelated, well-established formalism is a good pressure test for
  whether a design decision is principled or accidental — a principled one
  translates cleanly; an accidental one needs new machinery to express.
- **Named, precisely, what none of the five candidates capture, rather than
  present the comparison as if picking one would be a full solution.**
  Classical/STRIPS PDDL (what Fast Downward runs by default) has no numeric
  fluents — `thermal.ts`'s D/z-value hold-time math literally cannot be
  expressed without a numeric-capable planner variant (PDDL2.1/Metric-FF/
  ENHSP), a real, specific fact worth stating rather than waving at "PDDL
  can do numbers somehow." None of VirtualHome/AI2-THOR/ProcTHOR/OmniGibson's
  built-in object-state vocabularies model a CCP's accumulated thermal dose
  either — their `Cooked` is binary. And no candidate has any concept of
  `CitationSchema`'s provenance/confidence layer at all — that's unique to
  this repo, not something any external framework would preserve on import.

### PAR_FRY / double-frying — the same SIMMER-style question, opposite answer

- **The same "does the new verb share the old one's `transformedState`?"
  question came up again for PAR_FRY vs. FRY, and the correct answer was
  the OPPOSITE of SIMMER vs. BOIL — which is exactly why the question needs
  asking fresh each time, not answered by pattern-matching the last
  decision.** SIMMER correctly reuses BOIL's `"boiled"` because the two
  processes reach the identical culinary endpoint. PAR_FRY correctly does
  NOT reuse FRY's `"fried"` — `par_fried` is pale, soft, and unfinished; a
  cook who stopped there would call it wrong, not gently done. Applying
  SIMMER's precedent mechanically here (reuse the existing state) would
  have been a real modeling error masquerading as consistency. The actual
  discriminator, made explicit this time so it's checkable next time too:
  ask whether a competent human would call the two RESULTS the same dish.
  If yes (simmered egg = boiled egg), share the state. If no (par-fried
  fry ≠ finished fry), don't — even when the verbs are otherwise
  structurally identical (same tools, same medium, same capability shape).
- **Not every "this needs a real-world sequence the engine can't do yet"
  intuition turns out to be true — double-frying looked at first like it
  might need the same unbuilt "heat as a place" machinery periodic egg
  cooking does, and turned out not to.** The distinguishing fact, found by
  actually checking rather than assuming: periodic cooking needs RAPID
  alternation between two live temperature baths within one continuous
  process (16 transfers in 32 minutes) — genuinely needs a clock and
  shared, evolving tool state. Double-frying's two stages are temporally
  SEPARATE, with a real ~10-minute rest in between — which means it's just
  two ordinary, independent recipe steps, exactly like BOIL-then-SHOCK
  already is for egg. Proved this rather than asserted it:
  `scripts/double-fry-potato.ts` runs PAR_FRY then FRY as two plain
  `applyAction` calls and it just works, no new engine code. General
  lesson: "this sounds like it needs the same missing feature as that other
  gap" is a hypothesis worth testing against the engine directly, not a
  conclusion to file away — two techniques can look structurally similar
  (both are "cook twice at different temperatures") while actually needing
  completely different amounts of new machinery (one needs a world model
  the other doesn't).
- **`FRY` had a real, longstanding inconsistency with its sibling
  thermal-medium verbs that only became visible by actually comparing
  them side by side: `BOIL`/`SIMMER`/`POACH` all have a real `°C`
  parameter (`waterTempC`), but `FRY` only ever had the vague `heatLevel`
  enum (low/medium/high) despite oil temperature being at least as
  citable and load-bearing as water temperature.** Not something the
  user asked to fix directly — surfaced while sourcing PAR_FRY's own
  `oilTempC` and noticing FRY had no equivalent to be consistent with.
  Fixed by adding `oilTempC` to `fry.json` itself, not just to the new
  `par-fry.json` — the new verb's existence was the forcing function that
  made an old, adjacent gap visible, not the reason to leave it unfixed
  once seen.

### Egg freshness, basting, and "transformations take time" — one message, three separable gaps

- **A single dense user observation split cleanly into three real gaps at
  three different sizes, and treating them uniformly (all build, or all
  document) would have been wrong in both directions.** "Getting the
  perfect egg shape in the pan" turned out to be almost entirely a
  FRESHNESS fact (real, cited, a small data addition — `fresh`/`aged`
  tags). "Throwing heated oil over the yolk" turned out to be a real,
  nameable TECHNIQUE distinct from one already in the schema
  (`topCookingMethod`, distinguished from `edgeStyle`'s existing
  `crispy_lace_puntilla` — same physical motion, different target) — also a
  small, buildable parameter addition. "Transformations usually take time...
  states can change" turned out to be the SAME structural engine gap
  already recorded (`ROADMAP.md`'s "heat as a shared, time-varying place"
  entry) restated in different words, not a new one — folded in rather than
  duplicated. Splitting a dense message into its separately-sized parts
  before deciding what to do with each avoided both under-building (leaving
  the two real, small, buildable facts undocumented) and over-building
  (starting engine work on the atomicity point that was never actually
  asked for and isn't newly scoped just because it was mentioned again).
- **Checked whether the third thread was actually a NEW gap before folding
  it into the existing one, rather than assuming a philosophical-sounding
  restatement must be identical to the last one.** The two concrete cases
  that came with it this time (an egg's shape settling continuously as it
  fries; basting's effect depending on WHEN mid-process it's applied) are
  genuinely different scenarios from periodic egg-cooking (the original
  motivating case for that entry) but root-caused to the exact same
  mechanism: `applyAction` maps one `Instance` state directly to another
  with no representation of anything partway through. Worth stating
  precisely why folding was correct here even though the SIMMER-vs-PAR_FRY
  entry just above warns against assuming shared framing — those were two
  different REQUIRED SCHEMA DECISIONS (state string) built independently
  from convention; this is one and the same UNBUILT MECHANISM restated,
  confirmed structurally, not merely by the sentences sounding similar.
- **`fresh`/`aged` needed a real decision about WHERE freshness can be set,
  not just whether to add it, and the honest answer was "only at
  `initialInventory`, never by an action."** This repo has no elapsed-time
  concept and no verb for the passage of time — inventing an `AGE` action
  just to make freshness feel more "complete" would have manufactured a
  false capability (the engine pretending to model something — real-world
  time passing between or during recipe steps — it fundamentally doesn't).
  `RecipeInstanceSchema.tags` already supports arbitrary starting tags on
  any inventory instance, so this needed zero new mechanism — confirmed by
  checking the schema before assuming a new field was needed, the same
  "check for an existing shape before building a new one" instinct that
  caught the heat-source circular-import case back on 2026-08-13's first
  entry in this file.

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

### "Complete potato" — being challenged directly on "ANY" was the right prompt to actually test, not just re-explain

- **Asked "are you sure we can make ANY egg mix AND ANY potato fry style,"
  the right response was to test the edges, not to defend or re-assert the
  existing summary.** Ran four direct checks before answering at all: does
  a MASH action exist (no), can you CUT an unpeeled potato (no, hard
  error), does a grated/shredded shape exist (no), can egg be baked (no).
  All four were real, previously-uncited gaps, found in under a minute of
  actual checking rather than reasoning from what had already been built.
  General lesson, worth stating because it's easy to skip under time
  pressure: when asked "are you SURE," the answer is a fresh check against
  the code, not a more confident restatement of the last answer.
- **Caught and fixed a real mistake mid-build, not after: grating is not a
  sixth `CUT` shape.** First instinct was to add `"grated"` to `cut.json`'s
  `shape` enum, matching the path of least resistance (one file edit
  instead of two new entities). Caught before committing by asking the
  same question this repo asks of every other verb/tool pairing: does the
  PHYSICAL MECHANISM match? A box grater shreds by friction against a
  grating surface; a knife slices. Folding `"grated"` into `CUT` would have
  asserted a knife produces grated potato, which is false — the same class
  of error `PAR_FRY` getting its own tool/temperature band (not a `FRY`
  parameter) or `MASH` getting its own tool (not reusing `mortar`) were
  already built to avoid. Fixed by giving `GRATE` its own verb and tool
  (`grater.json`) instead. General lesson: "which existing enum could this
  value slot into" is the wrong first question for a new technique — "does
  an existing TOOL actually perform this motion" is the right one, and
  answering it wrong is cheap to catch immediately, expensive to catch
  after data/recipes start depending on the wrong shape.
- **`statePrerequisites` needed to become "one state OR a set of acceptable
  states," and the fix was small because the question was scoped precisely
  first.** The actual need (skin-on cuts, mash needing boiled-OR-baked) was
  never "should transitions be freely composable" (a much bigger, riskier
  question — see the `INVALID_TRANSITIONS` gap this session already found
  concrete evidence for, `FRY` then `BOIL` composing with zero complaint).
  It was narrowly "can more than one prior state satisfy the same
  prerequisite." Widened `ingredient.ts`'s type to `string | string[]`,
  kept `engine.ts`'s single-state behavior and exact error-message format
  unchanged by treating a lone string as a one-element set — verified by a
  new unit test asserting the OLD single-value error message still matches
  a literal string, not just a looser regex, so a subtle format change
  would have been caught. A small, precisely-scoped engine change (one
  field's type, one function's check) delivered on the same day a much
  larger, precisely-NOT-scoped one (heat-as-a-place) was correctly left
  unbuilt — the difference was never "engine work is risky," it was
  whether the actual need was small or genuinely structural, checked
  freshly each time rather than assumed from the last decision.

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

### "Refine the verbs and transformations" — an audit needs a real check, not a re-read

- **A vague instruction to "refine" what exists had a precise, checkable
  interpretation available, once framed as "find the same class of bug
  already found twice, systematically" instead of "read everything and see
  what feels off."** Re-reading all 27 action files for a subjective sense
  of quality would have been slow and unreliable. Instead wrote one script
  that diffed every entity's asserted-true capability against every
  action's three capability-reference fields — mechanical, exhaustive,
  and it directly generalizes the exact bug shape `pan.json`'s dead states
  and `potato.json`'s dead `"mashed"` already established as real and
  worth finding. General lesson: when a vague "clean this up" request
  follows a session that already found a specific, well-defined class of
  bug, checking systematically for MORE instances of that exact class
  is a much stronger first move than an unstructured read-through.
- **5 hits from the audit, and the right response to most of them was "no
  change" — worth stating precisely, since finding a hit and fixing it
  are different actions, and conflating them would have broken working
  code.** 4 of 5 were `isSeasoning`/`isEmulsionStabilizer`, both already
  carrying their own doc comments explaining exactly why they're
  intentionally unchecked. Verified this by reading those existing notes,
  not by assuming "audit found it, therefore audit should fix it." Only
  `salt.json`'s `isDissolvable` lacked that kind of justification — it had
  a `"todo"` instead, the schema's own way of admitting a real gap rather
  than a considered scope decision. That distinction (a note that JUSTIFIES
  vs. a note that ADMITS) is what separated a fifth "leave alone" from the
  one real fix.
- **Checked one MORE property while already in an audit mindset
  (retrySafe/verification/hazards/metadata completeness) and found a real,
  smaller inconsistency (`BEAT`'s missing hazard) — but resisted the
  temptation to pad the OTHER empty-hazard actions (`WASH`/`SALT`/`PEPPER`)
  just to make the audit's output uniformly "fixed."** Compared each
  empty-hazards action against whether a comparably-risky action elsewhere
  in the vocabulary declares one for a similar motion — `BEAT` failed that
  comparison against `MASH` (both manual, repetitive, utensil-in-hand);
  `WASH`/`SALT`/`PEPPER` didn't fail it against anything, because nothing
  comparably risky-shaped exists for sprinkling a seasoning or rinsing
  something under water. Adding a hazard to those three just for symmetry
  would have been dishonest padding — the opposite of what an audit for
  refinement should produce.

## 2026-08-14

### `src/place.ts` — closing the "heat as a place" physics half, once a real forcing case existed

- **A vague structural gap that was correctly left unbuilt for a session
  became buildable the moment it was walked as a concrete robot procedure.**
  `ROADMAP.md`'s "heat as a shared, time-varying property of a PLACE" entry
  (2026-08-13) was scoped as design-and-record on purpose — no recipe
  needed it yet, and inventing the mechanism speculatively risked the exact
  dead-capability shape this repo's own audits keep finding and closing
  (most recently the very last commit before this session). What changed:
  being asked, step by step, what a robot needs to do to boil an egg ("put
  water in a pan, apply warm till 100°C, put the egg in, wait — depending
  on heat, water amount, desired grade") turned the abstract gap into a
  concrete, checkable one — the same "attempt a real dish, watch it fail,
  name the missing verb precisely" method this repo already uses, applied
  to an engine capability instead of a data gap.
- **Scoped the closure narrower than the full ROADMAP item on purpose, and
  said so in the code, not just here.** The full item names three pieces:
  tool-level thermal state, a time-based heating model, and "instances
  co-located in one tool instance sharing its state" inside `engine.ts`
  itself. Only the first two were built (`src/place.ts`, standalone). The
  third — wiring this into `applyAction`'s preconditions, plus real
  `FILL`/`PLACE` verbs in `data/actions/*.json` — was deliberately NOT
  built, because nothing yet needs the engine itself to enforce "this pot's
  water must actually be boiling before BOIL can run"; `boil-egg-as-a-
  robot.ts` proves the physics by calling `place.ts` directly, not through
  `applyAction`. Same precedent `heat-source.ts`/`egg-doneness.ts` already
  set: real, cited, provable capability as a standalone module BEFORE
  engine wiring, not simultaneously with it. Building the engine-wiring
  half too, in the same pass, would have been exactly the "started
  speculatively" mistake the original ROADMAP entry warned against — a
  precondition check with no recipe yet needing it is just as untested-in-
  anger as the whole mechanism was a day earlier.
- **The one real physics fact worth getting exactly right: temperature
  plateaus at the boiling point instead of climbing indefinitely, because
  further delivered energy goes into the liquid→vapor phase change (latent
  heat of vaporization), not further ΔT.** `advanceHeatSeconds` clamps at
  `contentsEntity.thermophysical.boilingPointC` rather than integrating
  `energy / (mass × specificHeat)` straight through it — an easy, silently-
  wrong mistake (predicting an egg pot at 140°C after enough simulated
  time) if the clamp were left out. Does NOT model evaporative mass loss
  past that point — flagged as a real, smaller, separate unmodeled effect,
  not silently assumed away, matching `estimatedPreheatSeconds`'s own
  stated depth limit.
- **Reused `estimatedPreheatSeconds`'s exact energy-balance approximation
  (one constant mid-range power/efficiency value for the whole interval)
  rather than inventing a second, silently-different one for the same
  physical question.** Two functions answering "how does heat move into
  this water" with two different simplifications would have been a real,
  avoidable inconsistency — checked this before writing `advanceHeatSeconds`,
  not after.
- **`isAtBoiling` polled in a loop, not `estimatedPreheatSeconds` called
  once, is the actual point of this addition — not a stylistic choice.** A
  real robot control loop reads a sensor and checks it against a threshold
  repeatedly; it does not compute a predicted total and blindly sleep for
  it (a precomputed total silently assumes the model's own stated
  simplifications hold exactly, e.g. no heat loss, constant efficiency —
  small errors compound over a real multi-minute heat-up). `scripts/boil-
  egg-as-a-robot.ts` ticks 30s at a time and re-checks real state each
  time, deliberately different from `oma-boils-an-egg.ts`'s one-shot
  `estimatedPreheatSeconds` call — both are honest at what they claim to
  do, but only the tick loop is the shape a real controller would need.
- **Named three still-open sub-gaps explicitly in both the script's own
  output and `ROADMAP.md`, rather than letting "place.ts now exists" imply
  more than it does**: no `FILL`/`PLACE` `Action` definition (this sequence
  is procedural TypeScript, not a recipe a planner could select the way it
  selects `boil.json` today), no shell-fragility/handling-care mechanism
  for "place the egg delicately," and `isAtBoiling` reads `place.ts`'s own
  simulated state, not a physical sensor — `ENGINE_INVARIANTS.md` #11's
  control/perception gap is completely unaffected by this addition.

### `requiredToolCapabilities` — generalizing tool matching from id to capability

- **A concrete "will it work" question ("robot has a pan, not a pot") turned
  up an asymmetry that had been sitting in `action.ts` since the very first
  version: `requiredTools` matches by exact entity id, and NOTHING about the
  tool-checking path was ever capability-based, even though the exact same
  distinction already existed and was already solved for ingredients
  (`requiredIngredientCapabilities`, `requiredTargetCapability`).** Reading
  `action.ts`'s own doc comment for `requiredIngredientCapabilities` turned
  up the tell: it explicitly contrasts itself against `requiredTools`
  ("not id-based like requiredTools: any isFryingMedium ingredient will
  do") — the asymmetry was already named in a comment, just never carried
  over to the tool side. Worth stating plainly: this was found by being
  asked a concrete scenario question, not by an abstract "is this design
  consistent" review — the same pattern as almost every other real gap this
  repo has closed (`LEARNINGS.md`, throughout).
- **Asked to build it "as generic and abstract as possible," and the right
  reading of that instruction was: generalize the MECHANISM (capability-
  based tool matching, reusable by any current or future action), not widen
  any one entity's capabilities to make more scenarios pass.** The tempting
  wrong move here would have been marking `pan.json` as `isDeepVessel: true`
  too, just so the user's literal pan-only scenario would succeed — that
  would have been dishonest (a real frying pan can't hold enough water to
  submerge an egg) and would have solved the wrong problem (making one
  scenario pass, not making the mechanism correct). The actual generic fix
  is capability-based matching that correctly ADMITS qualifying tools and
  correctly REJECTS non-qualifying ones — proven by keeping the pan-rejection
  case in `boil-with-any-deep-vessel.ts` as the first, not discarding it
  once the "does it work" answer for that specific case was still no.
- **Checked for sibling gaps of the identical shape before calling this
  closed, the same discipline as the FRY/oilTempC parity fix
  (`LEARNINGS.md` 2026-08-13) — found two more (`SIMMER`, `PASTEURIZE`),
  both hardcoding `requiredTools: ["pot"]` for the identical physical
  reason, and fixed all three consistently rather than leaving two of
  them newly inconsistent right next to the one that prompted the
  question.** Deliberately did NOT extend this to `FRY`/`PAR_FRY`/`POACH`'s
  `pan` requirement — surface-area-for-oil is a genuinely different
  physical property from vessel depth, not the same bug wearing a
  different verb, and generalizing it wasn't asked for or forced by any
  concrete case yet.
- **Added a matching dead-capability guard to `validate.ts` in the same
  change that introduced the mechanism able to create that exact gap.** A
  `requiredToolCapabilities` entry with no tool anywhere asserting it would
  be silently, permanently unexecutable — the tool-side identical twin of
  what `requiredTools` referencing an unknown entity id already catches.
  Adding the capability-matching mechanism without also adding its own
  dead-capability check would have reintroduced, in a brand new mechanism,
  the exact class of gap the immediately-prior session spent a whole audit
  finding and closing (`git log`: "Refine verbs: audit for dead
  capabilities...") — closing that loop in the same commit rather than
  leaving it for a future audit to rediscover.
- **`saucepan.json` exists to make "generic" a checked claim, not an
  assertion.** A capability-based mechanism proven only against the one
  entity (`pot`) that motivated it would still be, empirically, a
  disguised special case — nothing would demonstrate the check doesn't
  secretly still key off the literal string `"pot"` somewhere. Adding one
  more real, physically-distinct vessel and proving BOIL executes against
  it with zero changes to `boil.json` is what actually distinguishes "this
  generalizes" from "this was renamed."
