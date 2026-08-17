# LEARNINGS_ENGINE.md

Part of `LEARNINGS.md`'s theme split (2026-08-15 — see that file for the
index and why). This file: **engine/schema architecture** — `src/*.ts`
design decisions, invariants, engine bugs found and fixed, schema-shape
tradeoffs, and infrastructure (test runner, simulation-target research).
Not: food-science/technique facts (`LEARNINGS_DOMAIN.md`), CLI/authoring
tooling (`LEARNINGS_TOOLING.md`), or verification-discipline/external-input
lessons (`LEARNINGS_PROCESS.md`).

Same rules as before the split: dated, append-only, concrete lessons only —
not a changelog of *what* changed (that's `git log`), *why* a design choice
was made. Don't rewrite or delete old entries — append.

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
  (this file, 2026-08-13) — found two more (`SIMMER`, `PASTEURIZE`),
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

### Extending FRY with everything learned from BOIL — a real generalization test, not a repeat

- **"Extend FRY with everything we learned from BOIL" was itself a real
  test of whether `place.ts`'s design was actually general, or only
  looked general because it had only ever been asked to model one
  medium.** It wasn't fully general: `advanceHeatSeconds`/`isAtBoiling`
  read `contentsEntity.thermophysical.boilingPointC` internally, a real,
  hidden coupling to "the target is a phase-change point" that boiling
  water satisfies and frying oil structurally cannot (oil doesn't boil at
  any cooking-relevant temperature — `oil.json` correctly has no
  `boilingPointC` field at all). Generalizing to `advanceTempSeconds`
  (explicit `targetTempC`) surfaced this coupling and removed it, with the
  two original functions kept as thin, behavior-preserving wrappers —
  proven, not asserted, by re-running every existing `place.test.ts`
  assertion unchanged after the refactor before adding a single new test.
- **The refactor had a real ordering trap, caught by tracing one specific
  existing test rather than assuming the new structure preserved
  everything.** The original `advanceHeatSeconds` checked place/entity
  match BEFORE resolving `boilingPointC`/`specificHeatJPerKgK`. A naive
  wrapper — resolve `boilingPointC` first, then delegate to
  `advanceTempSeconds` for the rest — would have resolved
  `contentsEntity.thermophysical.boilingPointC` before the mismatch check
  ever ran, breaking the existing "throws when contentsEntity doesn't
  match" test for exactly the fixture that test uses (an `oil` entity with
  no `thermophysical` block at all — it would fail on "no boilingPointC"
  instead of "mismatched entity", a different, wrong error). Fixed by
  factoring the place/entity check into its own function
  (`assertPlaceMatchesEntity`) called FIRST by both the general and
  boiling-specific functions, preserving the original check order exactly.
  Worth the sentence: "the tests still pass" isn't proof a refactor
  preserves behavior until the actual failure-message content, not just
  pass/fail, is checked for cases like this one.
- **A real, different KIND of "clamp" needed naming explicitly, not just
  reusing the word.** Water's `boilingPointC` clamp represents a genuine
  physical impossibility (latent heat of vaporization — water CANNOT
  exceed it while liquid water remains). Oil's `targetTempC` clamp
  represents controlled heating stopping at a chosen setpoint — nothing
  physically prevents oil from continuing past it if more energy kept
  being added. Both are legitimate model choices, but conflating them
  in the doc comment would have quietly overstated what the oil case
  actually represents — named the distinction explicitly rather than
  letting one clamp mechanism imply the same kind of physical necessity
  for both.
- **`smokePointC` is a genuinely new kind of fact for this schema: a real
  safety ceiling for a SAFE-TO-APPROACH-BUT-NOT-EXCEED ingredient
  property, distinct from both a food-safety CCP (`thermal.ts` — a
  pathogen kill-time floor) and a phase-change ceiling
  (`boilingPointC`).** `advanceTempSeconds` treats it as a hard reject on
  the requested TARGET, not a runtime clamp during heating — the
  correct real-world analog (a cook or a thermostat doesn't dial in a
  temperature past an oil's smoke point either), and arguably a more
  useful safety behavior than boiling water's silent clamp: an unsafe
  request should be loud, not quietly capped.
- **`isFryingVessel` mirrors `isDeepVessel` closely on purpose, but the
  physical reasoning for what qualifies is genuinely inverted, and stating
  that inversion explicitly is what makes the mirroring honest rather than
  a copy-paste.** For `isDeepVessel`, `pot` qualifies and `pan` doesn't
  (depth). For `isFryingVessel`, `pan`/`wok` qualify and `pot` doesn't
  (surface-area-to-volume for shallow frying) — the SAME mechanism, a
  genuinely DIFFERENT and even opposite-looking real-world answer. Checked
  this explicitly before writing `pot.json`'s omission note, rather than
  assuming the prior BOIL case's answer (pot=yes) would just transfer.


## 2026-08-15

### `WASH` was modeled wrong from the start — a user's real-world pushback found a genuine schema bug, not a data ordering preference

- **The user pushed back on the wash/peel/cut fix above ("first you peel,
  then you wash, then you cut") — checking it properly (real Spanish
  tortilla sources genuinely disagree with each other on the order) led
  to the actual, deeper finding: the disagreement about ORDER was
  downstream of a real modeling bug, not just competing culinary opinions.**
  `WASH`'s `outputs.transformedState: "washed"` treated "being washed" as
  a mutually-exclusive FORM, the same category as "peeled"/"sliced"/
  "fried" — but `state` (per `engine.ts`'s own doc comment) can only ever
  hold ONE value at a time. That meant WASH-then-PEEL silently erased the
  fact a potato had ever been washed the instant PEEL fired, and made
  "wash after peeling" and "wash both before and after" both
  *unrepresentable* in this engine even when a cook genuinely wants
  exactly that (the user's own words: "I wash before and after if I want
  to"). The order debate could never have been resolved by picking a
  side — the schema itself couldn't hold the answer either way.
- **The fix was recognizing "washed" belongs to the SAME category this
  repo already has a mechanism for** — `tags`, not `state`. This repo's
  own doc comment already drew the distinction precisely ("`state` is the
  one mutually-exclusive form/cooking-method value... while `tags` holds
  any number of orthogonal properties that coexist with whatever the
  current state is") — `SALT`/`PEPPER`/`CHILI` already use exactly this
  shape (`addsTag`, not `transformedState`) for the identical kind of
  fact ("has this happened to the ingredient," independent of its current
  form). `WASH` should have used `addsTag` from the day it was written;
  it didn't, and nothing forced the question until a real user pushed on
  a real ordering claim.
- **`engine.ts`'s `statePrerequisites` check needed exactly one
  generalization to keep working: match a tag as well as a state**, not a
  new parallel mechanism. `potato.json`'s `cut`/`grate`:
  `["washed", "peeled"]` already expressed "either predecessor is
  acceptable" as an OR-set over strings — extending what counts as a
  match (`instance.state === s || instance.tags.includes(s)`) instead of
  inventing a second field kept the existing per-entity data completely
  unchanged and kept the fix small (one check, `+1` line, thoroughly
  commented) rather than a schema migration.
- **Checked the actual blast radius rather than assuming it was
  contained** (`grep`, not memory): exactly one entity (`potato.json`)
  referenced `"washed"` as a state anywhere in `data/`. But three OTHER
  places had quietly encoded the old, wrong assumption without meaning
  to: `scripts/complete-potato.ts` hand-constructed a `state: "washed"`
  `Instance` literal to demonstrate the OR-prerequisite (now demonstrates
  the tag path instead — a strictly more honest demo, since nothing can
  produce that state anymore); `recipe-explain.ts`'s brand-new
  wash-heuristic (this same session, two turns earlier) checked
  `possibleStates.includes("washed")` — would have silently stopped
  firing the moment "washed" left `possibleStates`, a self-inflicted
  regression in code not even an hour old if not caught; switched it to
  checking the `isWashable` capability instead, which is both correct
  AND no longer coupled to how "washability" happens to be represented.
  **The general lesson: when a "state" turns out to actually be an
  orthogonal fact, everything that pattern-matched on the OLD
  representation (not just the schema/engine) is suspect, and grepping
  for the literal string is cheaper than trusting recall of everywhere
  it might be used.**
- **The user then named four real, distinct potato-prep variants in one
  message (wash-then-peel; peel-a-dirty-potato-then-wash; skin-on
  wash-cut-fry, never peeled; whole unpeeled wash-then-bake) — worth
  actually running all four, not just agreeing they sounded plausible.**
  Every potato recipe already in `data/recipes/*.json` happens to peel,
  so none of these four had ever been exercised end-to-end before, only
  argued to be mechanically possible from reading the schema. Built
  `scripts/potato-prep-variants.ts` (`npm run capability-test:potato-
  prep-variants`) and ran all four for real via `applyAction` — all four
  work, confirming the tag-based fix generalizes rather than only
  covering the one case it was written for. Case 2 (peel-then-wash) is
  the interesting confirmation-not-just-repetition: `CUT` there is
  satisfied via the real `"peeled"` STATE, not the `"washed"` tag at
  all — the tag fix wasn't even load-bearing for that specific case, but
  washing after peeling is still the physically correct move for a dirty
  potato (removing sand the peeler dragged across the exposed flesh),
  and is now representable without losing anything either way it's done.
  A concrete instance of this repo's own standing practice (`ROADMAP.md`'s
  capability-test table): a claim about what the engine can represent is
  only real once it's actually been run, not merely reasoned about.
- **The user's very next message found the real gap those four proofs
  missed: "if you first peel and then wash, the peels stay dirty, they
  have to be also washed if they are to be used."** Case 2 in
  `potato-prep-variants.ts` proved the POTATO ends up fine either order —
  it never checked the PEEL byproduct, which is a separate instance the
  moment `PEEL` spawns it (conservation of mass). Checked directly rather
  than assumed: `potato_peel.json` had NO `possibleTags` at all (so it
  could never inherit `"washed"` from a pre-washed parent, even though
  `engine.ts`'s byproduct-tag-inheritance mechanism — 2026-08-12 — already
  existed and would have carried it automatically) and NO `isWashable`
  capability (so `WASH` couldn't even be called on it directly — it would
  have been rejected outright). A real, previously-silent gap: reusing a
  peel from an unwashed-then-peeled potato (fried into crisps, blended)
  was reachable in this engine with no safety check at all.
- **Fixed by giving `potato_peel.json` `isWashable` + `possibleTags:
  ["washed"]` + `statePrerequisites: { fry: "washed", mix: "washed" }`
  — composing with mechanisms that already existed rather than building
  a new one.** Tag inheritance (2026-08-12) now actually has something to
  inherit; the state-or-tag `statePrerequisites` match (this same day,
  earlier fix) is what makes `"washed"` enforceable on a `raw`/`fried`/
  `blended` entity that never has a `"washed"` STATE. This is deliberately
  NOT the same thing as `ROADMAP.md`'s still-unbuilt "cross-contamination
  / hygiene knowledge" gap (danger to food from equipment/surface
  reuse) — this is a much narrower, already-expressible case: one
  specific spawned instance needing its own precondition satisfied before
  reuse, the exact same shape `potato.json`'s own `cut`/`grate`
  prerequisites already use.
- **`scripts/reuse-potato-peel.ts` rewritten to prove both real cases
  side by side** (Case A: washed-then-peeled, free inheritance, fries
  immediately; Case B: peeled-then-washed, dirty peel, washing the FLESH
  provably does nothing for the already-spawned peel, `FRY` correctly
  rejected, washing the PEEL directly is what fixes it) — plus two new
  `tests/engine.test.ts` regression tests built from synthetic fixtures
  (not `data/*.json`) so the behavior is locked in independent of
  `potato_peel.json`'s actual current shape. Second real proof in one
  session that "prove it, don't just reason about it" catches gaps
  reasoning alone didn't — the first was `potato-prep-variants.ts` two
  entries above; this is the same discipline applied one layer deeper,
  found by the user, not self-caught.

### `INVALID_TRANSITIONS` — the "global vs. per-entity" question resolved by finding a real contradiction, not by preference

- **`ROADMAP.md` had flagged this as "unresolved, worth deciding before
  building either" since 2026-08-14. It turned out not to be a judgment
  call at all once the actual data was checked**: `CLAUDE_DEV_CTX.md`'s
  own literal `INVALID_TRANSITIONS` example is a single global map keyed
  by bare state name (`{ boiled: ['raw', 'peeled'], ... }`). Trying to
  write that map against this repo's real two motivating entities
  surfaced a direct contradiction: `potato.json`'s own long-standing
  convention (`peel.json`'s metadata has said "cannot peel a potato that
  is already boiled" since this repo's first commit) needs
  `boiled -> peeled` FORBIDDEN, while `egg.json`'s own
  `statePrerequisites.peel: "boiled"` has required that exact same
  transition — boil first, THEN peel — since before this session. Same
  bare state names (`"boiled"`, `"peeled"`), opposite correct rules. A
  single global map literally cannot hold both; whichever entity's rule
  was authored second would silently overwrite the first. Keying
  `invalidTransitions` per entity (`ingredient.ts`) isn't a weaker,
  hedged compromise between the two ROADMAP options — it's the only one
  of the two that's actually correct, once real data is checked instead
  of designed from the spec doc alone. Worth naming as a pattern this
  session repeated more than once (the frying-science doc's fabricated
  bibliography, `WORLD_MODEL_OPTIMIZATION.md`'s `COMBINE` claim, now
  this): an unresolved design question phrased as "which of these two
  do we prefer" is often actually answerable by building the smallest
  real test case for each option and seeing which one breaks — cheaper
  than debating it in the abstract, and it produced a citable, reusable
  finding (this entry) instead of just a decision.
- **The check doubled as a real, if narrow, audit tool**: writing
  `potato.json`'s `invalidTransitions` required re-deriving which
  transitions are ACTUALLY forbidden vs. merely unusual — e.g. cutting a
  boiled potato (potato salad) is a real technique and deliberately NOT
  forbidden, and frying an already-mashed potato (potato cakes) is
  explicitly named elsewhere in this file as a real, celebrated
  technique — both had to be checked against ROADMAP.md's own prior
  entries before writing the forbidden list, not just pattern-matched
  from `CLAUDE_DEV_CTX.md`'s illustrative example. Getting this wrong in
  either direction (forbidding a real technique, or failing to forbid an
  impossible one) would have been a silent regression against every
  existing recipe — caught instead by re-running `npm run validate`
  (all 12 real recipes still simulate end-to-end with zero step errors)
  and the full demo/capability-test sweep before considering this done,
  not just by reasoning about the JSON in isolation.

## 2026-08-16

### Wiring `place.ts` into the engine — why the runner, not `applyAction`, and why the medium's temperature only

- **The "co-located instances sharing state" gap (`ROADMAP.md`'s "Heat as a
  shared, time-varying property of a PLACE") turned out NOT to require
  changing `engine.ts`'s `applyAction` at all — the instinct to generalize
  `applyAction`'s signature (add a `place` argument, thread it through every
  precondition check) would have been the wrong move.** `applyAction` is,
  and should stay, a pure, instantaneous "one precondition check, one
  immediate output" function — that's not an accidental limitation, it's
  the same honest atomicity limit `ROADMAP.md`'s separate "transformations
  usually take time" entry names for a reason. `advanceTempSeconds` is
  fundamentally a different SHAPE of function: a loop over real elapsed
  time, ticking toward a target. Bolting a continuous process onto a
  function whose entire contract is "instantaneous" would have either
  silently lied about what `applyAction` actually does, or forced a tick
  loop inside `applyAction` itself, breaking every existing caller's mental
  model of what one `applyAction` call means. Putting `FILL`/`PLACE_IN`/
  `HEAT_PLACE` handling in `src/recipe-runner.ts` instead — a NEW dispatch
  branch, outside `applyAction` — kept `applyAction`'s contract, every
  existing test, and every existing `data/actions/*.json` file completely
  untouched. `place.ts` had already independently arrived at this same
  shape by necessity (`advanceTempSeconds` ticked in a `while` loop from
  outside, in `scripts/boil-egg-as-a-robot.ts`, before any of this existed)
  — the real lesson is that this session should have trusted that existing
  precedent immediately instead of re-considering "should this be inside
  `applyAction`" as an open question at all.
- **`FILL` deliberately does NOT remove the poured ingredient instance from
  inventory, even though every other consuming action in this codebase
  (`destroysTarget`, `combinesInto`) does remove its target/secondary.**
  First draft did remove it, reasoning "conservation of mass, the water is
  now inside the pot, not a free-standing instance" — by analogy by
  `SEPARATE`. That analogy is wrong: `SEPARATE` genuinely transforms an egg
  into different things (yolk, white, shell) that didn't exist as separate
  instances before. Pouring water into a pot doesn't transform the water
  into anything — it's still real, present, identical water; only its
  CONTAINER changed. Removing it from inventory also broke a very concrete,
  real thing: existing `BOIL` steps' `availableIngredientInstanceIds`
  presence check (unchanged since before this session) would have failed
  with "no isBoilingMedium ingredient on hand" the moment `FILL` deleted the
  only water instance a recipe had — a real regression risk that would have
  silently forced every recipe wanting to use `FILL` to duplicate the water
  instance somehow. Caught before shipping by actually tracing what
  `data/recipes/two-eggs-shared-pot.json`'s later `BOIL` steps would see,
  not just by reasoning about `FILL` in isolation — the same "trace the
  actual consumer, don't just reason about the producer" discipline
  `LEARNINGS_PROCESS.md` names elsewhere. `places`/`placeContents` ended up
  as a strictly ADDITIVE, parallel record layered on top of the existing
  (weaker) presence check, not a replacement for it — which is also more
  honest about what actually changed: nothing about `availableIngredientInstanceIds`'s
  semantics moved, a new, independent, opt-in check was added alongside it.
- **`assertPlaceReady` (the new opt-in `BOIL`/`SIMMER` readiness check)
  reads `SIMMER`'s temperature band off `action.parameters.find(p => p.id
  === "waterTempC").numericRange` at runtime rather than hardcoding `85`/
  `96` a second time.** Small, but worth naming as a pattern: `simmer.json`
  already declared that exact range as its own parameter's `numericRange` —
  writing `85`/`96` again in `recipe-runner.ts` would have created two
  sources of truth for the identical fact, silently divergeable the next
  time someone tunes `simmer.json`'s band without knowing a second copy
  existed. Reading it off the loaded `Action` object instead means the
  check is automatically still correct if that range is ever edited, zero
  extra effort, and cost nothing to do the first time — worth defaulting to
  "read the already-loaded declaration" over "duplicate the number" on
  sight, not just when duplication is later discovered.
- **Deliberately did NOT extend this to model the placed food's own
  internal temperature (e.g. "the egg is now also warming toward the
  water's temperature").** That's a real, physically true thing that isn't
  modeled — but it's `heat-penetration.ts`'s existing, separate, narrower
  (potato-only) concern, with its own real physics (thermal diffusivity,
  not a simple shared-bath assumption) that doesn't generalize to egg for
  free. Naming it as explicitly out of scope in three places
  (`recipe-runner.ts`'s doc comment, `heat_place.json`'s metadata,
  `shared-pot-heat-as-a-robot.ts`'s closing paragraph) rather than letting
  "the egg is PLACE_IN'd into a place with a real temperature" read as
  implying more precision than actually exists — the same overclaiming risk
  every categorical/informational parameter in this codebase has to guard
  against, applied to a new mechanism instead of a new parameter this time.

### Generalizing FILL/PLACE_IN/HEAT_PLACE to oil — the capability was wrong, not just narrow

- **The FRY/oil follow-up named as "close" when the water/BOIL case closed
  turned out to need a real capability fix, not just a copy-paste of the
  water wiring with `isFryingMedium` substituted for `isBoilingMedium`.**
  First instinct: give `fill.json`/`heat_place.json` a SECOND, parallel
  `requiredTargetCapability`/`requiredToolCapabilities` pairing for oil, or
  duplicate the three actions as `fill_oil`/`heat_place_oil`. Both are
  wrong for the same reason: `requiredTargetCapability` is a single string
  (`action.ts`), so there's no schema-level way to express "isBoilingMedium
  OR isFryingMedium" on one action, and a duplicated verb would mean two
  different action ids for the identical physical act of pouring a liquid
  into a vessel — the SAME category error `LEARNINGS_ENGINE.md` 2026-08-13
  already named for `transformedState`/`transformedStateFromParameter`
  ("fixed by default, overridable per call" isn't a thing this schema
  supports, and inventing a workaround around that absence is usually the
  wrong move, not a missing feature to route around).
- **The actual fix was recognizing `isBoilingMedium`/`isFryingMedium` were
  never the right capability for FILL to check in the first place.** They
  answer "is this ingredient usable AS THE MEDIUM FOR [boiling/frying]" —
  a fact about a LATER verb (BOIL/FRY), not about the physical act of
  pouring. FILL doesn't care what happens to the liquid afterward, only
  that it's a real, pourable liquid — which water AND oil both genuinely
  are, for the identical reason. Naming that fact directly (`isPourable`,
  a new, deliberately WEAKER capability both entities now assert alongside
  their existing verb-specific ones) fixed the design error instead of
  working around its symptom, the same "capability vs. id" generalization
  `isDeepVessel`/`isFryingVessel` already established for tools
  (`LEARNINGS_ENGINE.md` 2026-08-14) — this is that same move applied one
  layer over, to the MEDIUM side of the check rather than the vessel side.
  `isVessel` (pot/pan/saucepan/wok) is the vessel-side sibling, same
  reasoning: FILL/PLACE_IN/HEAT_PLACE need "can this hold poured contents
  at all," which is weaker than and different from `isDeepVessel`'s
  "deep enough to submerge food" or `isFryingVessel`'s frying-specific
  shape — conflating either would have been the same kind of category
  error, just on the tool side instead of the ingredient side.
- **`assertPlaceReady`'s new `fry` branch reads a MINIMUM (`oilTempC`'s
  `range.min`), not a fixed target the way the `boil` branch reads
  `boilingPointC`** — worth stating as a deliberate asymmetry, not an
  inconsistency: water has a real phase-change ceiling to check against
  exactly once reached; oil has no such ceiling, only a chosen readiness
  floor a cook (or a caller's `targetTempC`) picks freely above. Checking
  `place.currentTempC < range.min` (not `!== ` or an exact match) is the
  physically honest comparison — "hot enough or hotter" is what actually
  matters for frying, unlike BOIL's "must have reached the one specific
  temperature water can't exceed while still liquid."

### `actionKind: "instantaneous" | "continuous"` — auditing all 32 actions found the model's real one-shot boundary

- **A user-supplied paper read (`PAPER_NOTES_2608.04768.md`, analyzing Song
  et al., arXiv:2608.04768) named a distinction this repo had already been
  working around, unnamed, in two places — worth recording as a pattern:
  independently-arrived-at convergent structure is a strong signal to
  formalize a concept, not just a nice-to-have citation.** `place.ts`'s own
  top doc comment (2026-08-14) already argued `advanceTempSeconds` is a
  continuous elapsed-time process that `applyAction`'s one-shot
  instantaneous-transition shape doesn't fit — that's WHY today's earlier
  PLACE-wiring work (`fill`/`place_in`/`heat_place`) landed as new handling
  in `recipe-runner.ts`, not inside `applyAction` itself. The paper reaches
  the identical split from the hardware side, describing generated robot
  control code as `Step(Pulse, Await(Enter))` vs. `Step(Continuous,
  Until(Condition)) with Timeout(...)`. Neither this repo nor that paper
  borrowed the idea from the other; two independent derivations meeting in
  the middle is real evidence the split is structural, not a local
  modeling artifact of either system.
- **The audit ("classify all 32 actions individually, do not batch-assign
  by pattern match") surfaced something more useful than a clean
  taxonomy: most of this repo's non-thermal mechanical verbs are LESS
  physically honest than the cooking verbs, not more.** Of the 10 actions
  that looked genuinely ambiguous going in, 9 resolved to `continuous` —
  meaning the paper's test (does it evolve over time toward an observable
  termination condition) and the engine's test (does `applyAction` model
  elapsed time at all) DISAGREED for nearly every one of them, and every
  disagreement was resolved toward the paper's test (the physical truth),
  per the ticket's explicit rule. The full list, with the specific
  reasoning that made each one land where it did (`actionKindNote` in each
  file has the complete version):
  - **`beat`** — the paper's own literal worked example. "Beat until
    uniform" is real stirring with a real visual termination; `applyAction`
    fires the instant preconditions pass. Textbook disagreement.
  - **`mix`**, **`emulsify`** — same shape as `beat`, both genuinely
    continuous processes (`emulsify` the clearest of all: `oilAdditionRate`
    AND `durationSeconds` both exist specifically because oil is added
    gradually WHILE whisking continues).
  - **`scramble`** — combines the paper's two continuous examples
    (heating AND stirring) at once; unsurprising once named, since
    `SCRAMBLE` was originally split from `FRY` specifically for its
    continuous agitation.
  - **`mash`**, **`crush`**, **`grate`** — all three are repeated
    mechanical actions toward an open-ended TEXTURE/FINENESS THRESHOLD
    ("no intact pieces remain," "resistance drops to near-zero," "no
    intact slices remaining") — a real accumulating process, the same
    shape as stirring, not a fixed predetermined count of motions.
  - **`dissolve`** — a real, passive, elapsed-time diffusion process
    (crystals don't dissolve instantly) with a real observable
    termination — continuous, but a genuinely distinct AMBIENT sub-case
    (nobody is actively driving it) worth naming rather than blurring
    into the actively-agitated cases above.
  - **`shock`** — named directly in `PAPER_NOTES_2608.04768.md` as the
    "mirror case" of `beat`: thermally time-dependent cooling in reality
    (the reverse of `heat_place`'s warming), one-shot (`addsTag` only) in
    the model.
  - **`cut`** — the one ambiguous action that, once actually examined, was
    NOT a real disagreement: both tests agree `instantaneous`. It looks
    like `mash`/`grate` (repeated tool strokes) but is genuinely different
    — cutting targets a FIXED, predetermined shape via a bounded number of
    strokes, not an open-ended "keep going until X" threshold. Worth
    recording as its own finding: an action can survive careful
    re-examination as NOT ambiguous after all, and the reasoning for why
    it isn't (the bounded-target-vs-open-threshold distinction) is more
    useful than the classification alone — it's what makes `grate`'s own
    classification defensible too, by contrast.
- **The correspondence check (every `manual_confirmation`-verified action
  should be `instantaneous`; every `thermal`-verified action should be
  `continuous`) held for all 32 with zero violations, once `shock` was
  correctly classified `continuous`** — worth recording precisely because
  it's a clean result: `scripts/validate.ts` now checks this automatically
  going forward (a soft `NOTE`, not a hard fail — a future action could
  have a real reason to break the pattern) so this isn't just a
  point-in-time finding.
- **This field changes zero engine behavior.** Every action still executes
  as one atomic `applyAction` call regardless of `actionKind` — the field
  is classification and an honest-gap inventory, surfaced in
  `recipe-explain.ts`'s pre-flight report (`npm run validate-recipe`) for
  visibility, not wired into `runRecipe`'s dispatch. That's a deliberate,
  smaller scope than it might look — `place.ts`'s `advanceTempSeconds`/
  `heat_place` remain the ONLY place this repo's actual behavior matches
  `continuous`; every other `continuous`-classified action (`boil`,
  `fry`, `beat`, `mash`, ...) is still executed as a single instantaneous
  state transition today. The field makes that gap nameable and greppable
  ("which actions claim to be continuous but aren't modeled that way yet"
  is now a real query against `data/actions/*.json`), not closed.

### `maxDurationSeconds`/`execution-bounds.ts` — the CCP floor as a concrete adversary to a plausible sensor

- **Building the demo script (`scripts/reject-early-sensory-termination.ts`)
  surfaced a real, silent gap in `recipe-explain.ts` before the ticket's
  own acceptance criteria could even be satisfied: the flagship example —
  `PASTEURIZE` on a spawned `egg_yolk` instance — didn't appear in the new
  `executionBounds` report at all.** `explainRecipe` only ever resolved a
  step's target entity against `recipe.initialInventory`
  (`recipe.initialInventory.find(...)`) — the same limitation the
  pre-existing WASH/PEEL/CUT heuristic has always had, never previously
  visible as a problem because nothing important depended on it. A step
  targeting a SPAWNED instance id (`egg_yolk-3`, `SEPARATE`'s own output)
  was silently unresolvable, and silently skipped rather than reported —
  exactly the failure mode this whole session's discipline exists to
  catch, this time in a new module's own acceptance test rather than a
  data file.
- **The tempting quick fix — re-derive spawned instance ids statically
  inside `explainRecipe` by re-implementing `recipe-runner.ts`'s
  `spawnCounter` naming scheme — was rejected on sight, not just in
  retrospect.** That would have created exactly the "second, parallel
  source of truth" this same ticket's own instructions warned against for
  `minSafeHoldSeconds` (read from the real CCP machinery, not
  re-derived) — applied to a different kind of ground truth (spawn ids
  instead of hold times), but the same principle. `explainRecipe` is
  deliberately execution-free by design (its own top doc comment); making
  it secretly re-simulate spawn behavior to fix one report field would
  have quietly broken that invariant for a narrow, local win.
- **The actual fix: give `recipe-runner.ts`'s `RecipeRunResult` a new
  `spawnedEntityIds: Map<instanceId, entityId>` — a complete record of
  every instance ever spawned during a run, including ones later
  destroyed (e.g. consumed by a later `COMBINE`) and so absent from
  `finalInventory`.** This is real ground truth from the ONE place spawn
  ids are actually generated, not a re-derivation — `explainRecipe` gained
  an optional, defaulted `spawnedEntityIds` parameter a caller who already
  ran `runRecipe` (`scripts/validate-recipe.ts`) can supply, closing the
  gap with zero new sources of truth and zero change to `explainRecipe`'s
  own "no execution" design constraint (the caller executes; the function
  itself still doesn't). Proven by a synthetic-fixture test
  (`tests/recipe-runner.test.ts`) that deliberately destroys the spawned
  instance via `COMBINE` before checking `spawnedEntityIds` still
  remembers it — the exact case `finalInventory` alone would have missed.
- **The `waterTempC`-only key `execution-bounds.ts` reads to trigger a
  CCP's D/z `thermalModel` was copied byte-for-byte from `engine.ts`'s own
  `applyAction`, including that function's own real, pre-existing
  narrowness** (FRY declares `oilTempC`, not `waterTempC`, so FRY's own
  CCP checks — where one exists — never actually trigger the D/z path in
  `applyAction` either, today). Generalizing this NEW module to also read
  `oilTempC` would have been a real, easy-looking improvement — and
  exactly the wrong move: it would have made `execution-bounds.ts`
  compute a DIFFERENT answer than `applyAction` would for the identical
  action/entity/params, the two-sources-of-truth problem again, just
  discovered a second time in the same session under a different name.
  Reproducing a known narrowness faithfully, and naming it as such, beats
  fixing it quietly in only one of two places that need to agree.

### `dilutionVolumeToTarget` — citing the physics, not the paper that applied it (TICKET 3)

- **Small, worth recording as a template for the next borrowed-equation
  case: `PAPER_NOTES_2608.04768.md` TICKET 3 explicitly instructed "cite
  against a standard reference... NOT against this paper — the paper is
  where we found it applied to cooking, not the source of the physics,"
  and that distinction turned out to matter for real, not just as a
  citation-hygiene nicety.** The paper's equation (7) (Song et al.,
  arXiv:2608.04768) is the textbook dilution/conservation-of-solute
  relation (C₁V₁ = C₂V₂ form) — a preprint is genuinely the wrong
  confidence tier to hang uncontroversial general-chemistry physics on,
  even though it's exactly where this repo happened to encounter the
  culinary application. `src/flavor-balance.ts`'s `DILUTION_CITATION`
  cites the relation itself as `standard_reference`, with a note naming
  the paper only as where the APPLICATION was found — keeping the
  confidence tier honest to what's actually being claimed (a physical
  law, not this specific unreviewed paper's authority) rather than
  letting the paper's own `commonly_cited_unverified` tier (`REFERENCES.md`)
  drag down a claim that deserves better. See `LEARNINGS_PROCESS.md`
  2026-08-16 for a fabricated cross-reference caught and fixed in the
  same TICKET 6 change.

### `isTerminalState` — computed, not authored, and a claim caught wrong by actually running it (TICKET 5)

- **TICKET 5 suggested a `terminal: true` marker "on states" — implemented
  as a computed function instead of a new hand-authored field, on the same
  reasoning `execution-bounds.ts` just established for `minSafeHoldSeconds`
  earlier the same day: a second, separately-maintained flag can silently
  drift out of sync with the real transition rules the moment either is
  edited without remembering the other.** `isTerminalState(entity, state)`
  derives terminality from `invalidTransitions`/`possibleStates` directly —
  the SAME data already being authored for the forbidden-transition
  closures themselves, not a duplicate claim layered on top. This is the
  third time this exact "compute from the existing source, don't add a
  parallel one" move has been the right call in one session (SIMMER's
  `waterTempC` band read off its own declared parameter; `execution-bounds.ts`'s
  CCP floor; now this) — worth naming as a general habit to reach for by
  default, not something to re-derive from scratch the next time a "should
  this be a new field or a computed check" question comes up.
- **Building the capability-test script caught the exact kind of mistake
  this whole session's discipline exists to catch, and it happened in
  THIS session's own newly-written data, not an inherited or external
  document.** The first draft of `potato.json`'s (and `egg.json`'s and
  `tortilla_mixture.json`'s) `failureStateNote` asserted "'overcooked' is
  ALSO treated as fully terminal here." Running `scripts/failure-states-
  as-a-robot.ts` against the actual data — not just reasoning about the
  JSON — printed `isTerminalState(potato, "overcooked") === false`,
  directly contradicting that claim. The reason was already correct in a
  LATER sentence of the same note (overcooked deliberately leaves the
  transition to `burned` open) — the note was internally inconsistent, not
  wrong about the underlying design, just wrong about summarizing its own
  consequence. Fixed in all three affected entities' notes and the
  script's own two narration lines before shipping, not left as a
  passable-looking but inaccurate claim. The concrete lesson: writing an
  accurate-sounding summary sentence about a mechanism's behavior is not
  the same as checking what the mechanism actually computes — run it,
  the same standard this session has applied to everything else, applied
  here to a sentence about the session's own code minutes after writing it.

### `src/reachability.ts` — a search that reuses the existing graph exactly, and a design choice that made the search itself the audit tool

- **TICKET 4's own instruction ("edges come from `allowedTransformations`,
  `statePrerequisites`, and `invalidTransitions` — all three already
  exist; do not invent a new graph representation") turned out to be
  load-bearing, not just a style preference.** The temptation, once
  `blockedBy` needed to name specific reasons (missing tool capability,
  unsatisfied ingredient capability, ...), was to build a richer,
  purpose-made graph structure that pre-computed all of this. Reusing
  `Action`'s own fields directly instead — walking
  `requiredTargetCapability`/`requiredTools`/`requiredToolCapabilities`/
  `requiredIngredientCapabilities`/`statePrerequisites`/`invalidTransitions`
  at search time, exactly the same checks `engine.ts`'s `applyAction`
  makes — means the reachability search and the real engine can never
  silently disagree about what's legal. A purpose-built graph
  representation would have been a FOURTH source of truth alongside the
  three the ticket named, the identical mistake `execution-bounds.ts`
  and `isTerminalState` were both built earlier the same day specifically
  to avoid (see those entries above) — the pattern held a fourth time.
- **`destroysTarget`/`combinesInto` needed a genuinely different
  treatment than every other blocked edge: a dead end with ZERO outgoing
  edges, not just a blocked transition.** Every other `BlockingReason`
  means "this specific edge doesn't exist, but the node it would have
  led FROM still has other options." A `destroysTarget` action is
  different in kind — once it fires, the ORIGINAL instance no longer
  exists at all, so nothing further can ever happen to it, regardless of
  what `invalidTransitions` says. Modeling this as `instance_destroyed`
  and never pushing a successor node onto the BFS queue (rather than,
  say, letting it produce a state that then gets explored normally) is
  what makes "an egg separated into yolk/white can never become a whole
  boiled egg again" the CORRECT answer for the right reason — not
  because some closure forbids it, but because the thing being asked
  about is gone. Conflating "forbidden transition" and "instance no
  longer exists" would have been a real, subtle correctness bug in the
  one case (`SEPARATE`/`CRACK`/`COMBINE`) this repo's own conservation-
  of-mass rule already treats as structurally different from every other
  action.
- **A `requiredSecondaryCapability` (COMBINE-shaped) edge is recorded as
  blocked and never explored, on purpose — this search does NOT attempt
  to guess whether a second instance might plausibly be available.**
  Tempting alternative: assume a suitable secondary instance exists
  somewhere and explore past it optimistically. Rejected because it
  would silently misrepresent a genuinely single-instance search as
  answering a multi-instance question it has no actual information
  about — the same "don't manufacture capability speculatively" discipline
  `masideas.md`'s dead-capability lesson already established, applied to
  a search result instead of a schema field this time.
- **The search itself, run against real data, found two real gaps in
  this repo's own `invalidTransitions` — worth recording as the concrete
  payoff of building it, not a side effect.** See `LEARNINGS_PROCESS.md`
  2026-08-16 for the verification discipline around both (checking the
  ticket's own suggested example before trusting it; checking what the
  tool actually reported before deciding whether to patch it). The
  `egg.json` `"separated"` gap was small and directly analogous to an
  already-established pattern, so it got fixed in the same change; the
  `potato.json` gap (no `"fried"`/other-cooked-state keys in
  `invalidTransitions` at all) is real but larger — deliberately left as
  a named follow-up rather than a rushed patch, the same restraint
  `potato.json`'s own 2026-08-15 correction (`LEARNINGS_PROCESS.md`) was
  built on: a plausible-looking one-line fix, added under time pressure
  and without the same dedicated real-technique check `egg.json` got, is
  exactly how the ORIGINAL wrong `mashed → peeled` closure got into this
  repo in the first place.

### `YieldFractionSchema` — the sum-sanity check's first version was wrong about WHICH actions it applies to

- **The first draft of `scripts/validate.ts`'s "do these byproduct
  fractions sum to ~100%" check ran unconditionally against every
  byproduct group and immediately produced three false-positive NOTEs**
  (potato_peel ~18%, garlic_peel ~2%, egg's flat `producedByproducts`
  ~11%) — all real data, all correctly cited, none actually wrong. Running
  `npm run validate` immediately after writing the check (not after
  finishing the whole feature) caught this before it shipped as a
  permanently-noisy check nobody would trust. The actual bug was a
  category error in the check's own design: it assumed every byproduct
  group represents the ENTIRE former parent, true for `SEPARATE`/`CRACK`
  (`destroysTarget: true` — the byproducts ARE the whole thing, nothing
  else survives) but false for `PEEL` (the parent persists as the SAME,
  now-trimmed instance; the byproduct is only ever a small slice of it).
  Fixed by keying the sum-check off the actual triggering action's
  `outputs.destroysTarget`, not applying one rule to a structurally
  different case that happened to share the same `byproductsByAction`
  shape. Worth naming as a small, general lesson: a sanity check's
  correctness depends on getting the SCOPE of what it's checking right,
  not just the arithmetic — the arithmetic (`sum ≈ 1.0`) was never wrong,
  the assumption about which cases it should even apply to was.
- **`egg_cracked.json`'s yield fraction was deliberately DERIVED
  (`1 - egg_shell`'s own cited range) rather than independently sourced**
  — CRACK spawns exactly `egg_shell` + `egg_cracked` (yolk+white kept
  together), so `egg_cracked`'s mass is definitionally "whatever the
  shell isn't," and inventing a second, independently-sourced figure for
  it would have risked the two NOT summing to 100% for no real reason
  (measurement noise between two different searches, not a real
  disagreement) — the identical "don't introduce a second, parallel
  source of truth for a derivable fact" discipline this session applied
  repeatedly to code (`execution-bounds.ts`'s CCP floor, `isTerminalState`)
  applied here to a citation instead.

### `COMBINE` reused twice — the "fixed pairing, shared capability" shape genuinely doesn't scale to a third combination without a real, named gap

- **Building "tortilla de patatas con cebolla" (onion.json's own
  `combinePotatoOnionNote`) surfaced a structural limit `combine.json`'s
  original design decision was always going to hit eventually**:
  `requiredTargetCapability`/`requiredSecondaryCapability`/`combinesInto`
  being FIXED per action (deliberate, see `combine.json`'s `scopeNote`,
  written 2026-08-12) means every new pairing needs its own action file —
  fine, that scaled cleanly to a second (`combine_potato_onion.json`)
  and third (`combine_con_cebolla.json`) action. What does NOT scale for
  free is capability REUSE: `combine_con_cebolla.json` had to reuse
  `potato.json`'s existing `isCombinableBase` flag on the new
  `potato_onion_mixture.json` entity (both are legitimately "a valid base
  to pour beaten egg over"), and reuse `egg_cracked.json`'s existing
  `isCombinableAddition` flag too (egg's role is identical either way) —
  but `engine.ts`'s capability check only ever verifies "does the target
  assert this flag true," never "is the target the SPECIFIC entity this
  action was actually designed for." The result: nothing in the schema
  stops a malformed recipe from calling the ORIGINAL `combine.json`
  against a `potato_onion_mixture` instance (both assert
  `isCombinableBase`) — it would still execute, silently discarding the
  onion-composition fact `structure.components` exists to preserve.
- **Deliberately NOT fixed by adding a real per-entity-identity check to
  `applyAction`** — that's a bigger, more invasive engine change
  (checking target ENTITY ID, not just capability presence, which would
  also mean auditing every OTHER capability-based check in this engine
  for the same theoretical looseness) than this feature's actual scope
  warranted. Named instead, honestly, in `potato_onion_mixture.json`'s
  own `capabilityAmbiguityNote` and `ROADMAP.md` — the same "name the
  gap rather than silently risk it, but don't over-engineer a fix nobody
  asked for" discipline `LEARNINGS_ENGINE.md`'s TICKET 4 entries above
  already established for `mashed potato -> fried -> peeled`. Worth
  restating as the general lesson: a capability system that checks
  "presence of a flag" rather than "identity of an instance" is a
  genuine, permanent trade-off (cheap, substitutable, exactly what makes
  `requiredIngredientCapabilities`/`requiredToolCapabilities` useful
  elsewhere in this repo) — and every new REUSE of an existing capability
  flag for a second, different fixed pairing is a new, real place that
  trade-off can bite, not just a one-time cost paid when the flag was
  first introduced.
- **The two-stage chain itself (combine raw, THEN fry, rather than fry
  each separately and combine after) was a real technique decision, not
  an implementation convenience** — checked against how tortilla de
  patatas con cebolla is actually made (potato and onion confit-fried
  together in the same oil) before designing `combine_potato_onion.json`
  to fire on RAW sliced instances rather than mirroring `combine.json`'s
  own fried-first prerequisite. Getting this backwards (combining two
  already-separately-fried instances) would have been schema-valid and
  would have run without error, but would not have matched real cooking
  practice — the same "verify against real technique before encoding it"
  discipline this whole session has applied to every `invalidTransitions`
  entry, extended here to a whole action's sequencing, not just one
  forbidden edge.

### `REST` — a user's real-world correction surfaced that `Instance` has NO temperature field at all, anywhere

- **A user asked whether this repo correctly models "hot potato partially
  cooks the raw egg it's mixed with" (tortilla de patatas' real
  combine-then-rest technique) — checking `engine.ts`'s actual `Instance`
  type (`{entityId, state, tags}`) confirmed it does not, and structurally
  CANNOT without a real change: no ingredient instance has ever carried a
  temperature, anywhere in this engine, once it isn't inside a tracked
  `PlaceState`.** `place.ts` only ever tracks the VESSEL's contents'
  temperature (the oil, the water) — the food dropped into it has no
  tracked thermal state of its own even DURING cooking, a gap
  `fry-egg-as-a-robot.ts`'s own closing note already named for a
  different reason. This session chose the lightweight fix (a generic
  `REST` verb, `addsTag: "rested"`, informational only) over the deeper
  one (give `Instance` a real `currentTempC`, compute actual heat
  transfer at `COMBINE` time from each side's already-cited
  `thermophysical` mass/specific-heat data, let `REST` evolve it via
  elapsed time) — offered to the user as an explicit choice via
  `AskUserQuestion` rather than picked unilaterally, since unlike most
  gaps closed this session (where "the obviously right scope" was clear
  from precedent), this one is a genuine fork with real, different
  future implications: the deep version would also generalize to "potato
  keeps cooking briefly after leaving hot oil" and similar carryover
  effects this repo has so far only modeled narrowly (egg's `SHOCK`).
- **Worth stating explicitly why the lightweight choice is still honest,
  not a cop-out**: `tortilla_mixture.json`'s new `rawStateHonestyNote`
  names the specific real fact NOT being modeled (the mixture is spawned
  `"raw"` even though the egg has typically already started cooking a
  little by the time a human looks at it) rather than letting `REST`'s
  existence imply the whole technique is now causally simulated. Same
  "informational tag, real gap named in the entity's own metadata, not
  silently implied solved" pattern this vocabulary already uses
  everywhere else (`FRY`'s `doneness`, `oilTempC`, `coldOilStartNote`) —
  applied here to a gap a user found by asking a direct factual question,
  not one this repo discovered by its own audit.
- **Deliberately did NOT let `REST`/resting feed any HACCP credit into
  `egg_cooking`'s CCP threshold** — a real, considered decision, not an
  omission: this repo's whole safety discipline has been "cite a real
  D/z thermal model or don't claim the credit" (`thermal.ts`,
  `execution-bounds.ts`), and there is no controlled, cited model here
  for how much an uncontrolled contact-heating rest actually pasteurizes
  loose egg. Modeling the TEXTURE/flavor effect (real, low-stakes if
  wrong) and refusing to model a SAFETY effect (real, high-stakes if
  wrong, and unsupported by any citation this repo has) from the same
  underlying physical fact is a deliberate asymmetry, not an
  inconsistency — the same distinction `LEARNINGS_DOMAIN.md`'s
  `bakingSodaAssistedNote`-adjacent reasoning already draws between
  informational technique facts and anything CCP-adjacent.
- **`REST` closed two independently-named gaps with one verb, found by
  actively checking for reuse before building single-purpose** — the
  already-existing `par-fry.json` `restNote`/`crispy-french-fries.json`
  `restGapNote` (a genuinely different real reason to rest: moisture/heat
  redistribution in fried potato, not egg-protein setting) turned out to
  need the exact same verb shape (`addsTag`, elapsed time, no state
  change). Worth the general lesson: before building a new verb for a
  freshly-found gap, grep whether an EXISTING named-but-unbuilt gap in
  `ROADMAP.md` would be satisfied by the same shape — building `REST`
  narrowly "for tortilla only" would have left the par-fry gap open for
  no real reason, and building it "for par-fry only" earlier would have
  missed the tortilla case entirely.

### Allergens — a closed enum forces a real choice a free string would have let slide

- **Picking the FDA's "Big 9" over the EU's wider 14-allergen list was a
  real, deliberate tension, not an obvious default** — this repo's actual
  recipe content is Spanish/EU-leaning throughout (tortilla de patatas,
  `es` names on every entity), which would argue for the EU list (adds
  celery, mustard, sulphites, lupin, molluscs, and gluten-containing
  cereals generally rather than wheat specifically). Chose the FDA list
  anyway, for a different, also-real reason: this repo's existing CCP/
  HACCP machinery (`thermal.ts`, `data/ccps/*.json`) is ALREADY sourced
  to FDA/USDA regulatory text throughout — introducing a second, EU-based
  regulatory citation family for one field would have made "which
  jurisdiction's rules does this repo actually follow" a real, newly
  ambiguous question, worse than picking either list consistently. Named
  explicitly in `AllergenSchema`'s own doc comment rather than silently
  picked — a reader who assumes "EU dishes -> EU allergen list" without
  reading that comment would draw a reasonable but wrong conclusion.
- **A closed `z.enum`, not an open string field, was the actual design
  decision that mattered here** — `CapabilitiesSchema`'s own precedent
  (`.catchall(z.boolean())`, deliberately open, CONCEPT.md §15 "Unknown
  Knowledge") was right there as an easy template to copy, and would have
  been WRONG for this field specifically: a capability that's
  misspelled/inconsistent just means one substitutability check silently
  fails somewhere; an allergen that's misspelled/inconsistent means a real
  "contains X" claim silently doesn't match across entities, exactly the
  failure mode this field exists to prevent. Worth stating as a general
  principle, not just a one-off choice: "should this vocabulary be open or
  closed" doesn't have one repo-wide answer — it depends on whether an
  inconsistent entry fails loud (open is fine) or fails silent-and-unsafe
  (closed is required).
- **The composite-entity superset check (`scripts/validate.ts`) is
  deliberately a HARD FAIL, not a NOTE** — every other pattern this file
  matches (`checkYieldFractions`'s sum-check, the cooking-capability-vs-CCP
  check) uses a soft NOTE for a plausible-but-unconfirmed gap. Allergens
  don't get that treatment: `ROADMAP.md`'s own framing ("more dangerous by
  omission") is specifically about a SILENT gap being worse than a visible
  one, so leaving this as an easily-ignored NOTE would have reproduced the
  exact failure mode the feature exists to prevent, just one layer up (a
  human confirming "yes I saw the NOTE and chose to ignore it" is still a
  human who might not). Proven to actually fire, not just written and
  assumed correct — see this session's own verification (temporarily
  cleared `tortilla_mixture.json`'s `allergens`, confirmed the exact FAIL
  line, restored via `Edit` rather than `git checkout`, learning
  `LEARNINGS_PROCESS.md`'s earlier `potato_peel.json` data-loss mistake).
- **`egg_shell.json` carrying NO allergen, despite being egg's own
  byproduct, is the one real place "is this a byproduct of X" and "does
  this itself carry X's allergen" genuinely diverge** — every other
  byproduct entity in this repo (`potato_peel`, `garlic_peel`,
  `onion_peel`) was already allergen-free regardless, so this distinction
  was invisible until egg's byproducts specifically forced it. Worth
  generalizing: a future protein/allergen-bearing entity's byproducts
  need this same question asked individually (does the byproduct still
  contain the allergenic material, or was it separated out), not answered
  by a blanket "byproducts inherit the parent's allergens" rule, which
  would have been wrong here.

### `REMOVE` — closing a named gap by building its sibling recipe, not rewriting the one that found it

- **A real, previously-named gap (`garlic-oil-potatoes.json`'s own
  `removalNote`, written 2026-08-15) gets closed by the mechanism it was
  named for, but the recipe that FOUND the gap doesn't have to be the
  recipe that PROVES the fix.** Migrating `garlic-oil-potatoes.json`
  itself to `placeId`-aware `FILL`/`HEAT_PLACE`/`PLACE_IN` steps would
  have meant reworking an already-working, already-validated recipe's
  core mechanics (adding real oil-heating physics where a bare
  `heatLevel` string sufficed before) — a real rewrite, not a small
  patch, and a needless risk to something that already worked. Building
  `garlic-oil-potatoes-shared-pan.json` as a NEW sibling file instead
  (same dish, same real technique, actually place-aware) is the same
  precedent `fried-egg-shared-pan.json` already set alongside
  `huevo-frito.json` — worth restating as a general rule now that it's
  happened twice: when a new mechanism makes an EXISTING recipe's
  original approach newly express-able more accurately, the default move
  is a new sibling proving it, not a retrofit risking what already works.
- **`REMOVE`'s `retrySafe: true` required checking `retrySafe`'s own
  doc comment carefully, not pattern-matching from `PLACE_IN`** — an
  early instinct was `false` (mirroring `PEEL`'s `retrySafe: false`,
  since both "remove an already-removed thing" and "peel an
  already-peeled thing" sound like similar mistakes). But `retrySafe`'s
  actual definition covers TWO different reasons for `true`: idempotent-
  by-construction, OR fails loudly instead of silently duplicating. PEEL
  is `false` because a blind retry SILENTLY spawns a second, physically
  impossible byproduct — nothing stops it. REMOVE's blind retry hits a
  real, loud, named error (`handleRemove`'s own "not currently there"
  check) instead — the same shape `COMBINE`'s own `retrySafe: true`
  already documents for exactly this reason. Two actions that both
  "shouldn't be re-run carelessly" can still land on opposite `retrySafe`
  values, because the field isn't asking "is re-running this a good
  idea" — it's asking "does the SCHEMA/engine itself catch a blind retry,
  or would it silently go wrong." Worth checking against the actual
  definition every time, not the closest-looking existing example.
- **Scoping `REMOVE` to close ONLY the removal mechanism, not the
  adjacent "elapsed idle time" half of the same named gap, was a
  deliberate act of restraint** — `ROADMAP.md`'s original entry named
  both in one breath ("nothing models elapsed idle time OR has a verb
  for removing"), and it would have been easy to treat closing one as
  closing both. They're genuinely different-sized problems: REMOVE is a
  bounded bookkeeping mechanism (which instances are in which place);
  "does staying too long cause a doneness/burn consequence" needs a real
  model linking `place.ts`'s elapsed-time machinery to an INSTANCE's own
  cooking progress, which doesn't exist anywhere in this engine yet (no
  per-instance temperature — see this file's own `REST` entry above).
  Named explicitly as still-open in `remove.json`'s `idleTimeScopeNote`
  and `ROADMAP.md`'s updated entry, the same "close what you actually
  closed, name what you didn't" discipline this whole session has
  applied everywhere else.

### Egg spherical conduction — checking dimensional analysis by hand before trusting a popularized formula

- **A real, common failure mode with widely-reported physics formulas is
  a hidden unit convention (CGS vs. SI, mass in grams vs. kg) that only
  becomes obvious once you actually check it** — worth doing explicitly,
  not assuming a formula "just works" with whatever units seem natural.
  Checked by hand before writing any code: with M in kg, c in J/(kg·K),
  rho in kg/m³, K in W/(m·K) — plain SI, the same units every other
  `thermophysical` field in this repo already uses — Williams' formula's
  prefactor comes out in SECONDS directly, no conversion factor needed.
  That this worked out cleanly was a real finding, not a foregone
  conclusion; it would have been a genuinely different (worse) situation
  if it hadn't, and the doc comment says so explicitly rather than
  presenting the clean result as if it were obviously going to happen.
- **The by-hand cross-check against `EGG_BOIL_DONENESS` was done with
  real arithmetic before writing the implementation, then verified again
  by actually running the code** — both numbers matched exactly (408s/
  450s/494s), which is the point: a hand-computed sanity check that
  DISAGREES with the running code is a bug in one of the two, and this
  session's practice throughout has been to resolve that disagreement
  before moving on, not to trust whichever number looks more finished.
- **Reporting three different outcomes (converges / near-miss / real
  divergence) honestly, instead of rounding the finding to "the physics
  checks out," is the same discipline this repo has applied to every
  other cross-check this session** (onion's specific heat, the Denver
  altitude check) — but this is the first time the THREE-WAY split
  itself was the finding: not every prediction from a real, correctly-
  implemented, dimensionally-checked formula has to match an empirical
  table for the formula to be worth keeping. A named HYPOTHESIS for the
  `hard`-tier divergence (real recipes overshoot the bare coagulation
  threshold for a reliable margin, not a marginal result) is offered as
  exactly that — a hypothesis, not asserted as settled — because this
  repo has not verified it against a primary source.
- **The newer (2025, peer-reviewed) and older (informal, widely-
  reported) sources for the SAME physical fact — yolk denaturation
  temperature — gave meaningfully different numbers, and the correct
  move was to use the newer, more rigorous one for the input that
  matters most (`soft`'s anchor) while being explicit that the other two
  targets are this repo's OWN interpretation layered on top, not
  smuggled in at the same confidence as the cited figure.** A citation
  can be simultaneously real and only PARTIALLY authoritative for what
  it's actually being used for — `YOLK_TARGET_TEMP_C`'s own citation
  note says this directly rather than letting the strongest component
  imply more rigor for the whole table than it actually has.

### Tortilla flip physics — a real bracket beats a false-precision single number, and zero new code was needed

- **The actual missing piece for closing `tortilla_mixture.json`'s
  long-standing `knownGap` note turned out to be DATA, not code** —
  `heat-penetration.ts`'s slab-conduction model already fully supports
  computing this (it's entity-agnostic, built for potato but never
  restricted to it); `tortilla_mixture.json` simply had no
  `thermophysical` block at all. Worth restating as a general pattern
  this session keeps re-finding: before writing new physics, check
  whether the existing physics already covers the new case and the real
  gap is just unpopulated data — the same shape as onion reusing
  `place.ts`/`heat-source.ts` with zero changes, or `altitude.ts`
  composing with `place.ts` for free.
- **Deriving `tortilla_mixture.json`'s composition from THIS repo's own
  `potato.json`/`egg.json` data, instead of adopting the user-supplied
  document's assumed 70/6/12/11/1% figures, produced a genuinely
  MORE traceable number, not just a differently-sourced one** — every
  step (the 3:1 mass ratio, the Choi-Okos component equations, the
  water-component reuse of `water.json`'s own 4186 figure) is
  independently checkable against something already in this repo. The
  resulting specific heat (3713 J/(kg·K)) landed within ~6% of the
  document's own unrelated-composition figure (3491) — a loose but real
  sanity check that neither number is wildly implausible, without either
  number needing to validate the other.
- **`physicalDimensions.typicalDiameterCm`'s citation had to record a PAN
  size assumption, not a tortilla-thickness measurement directly** — the
  actually-needed number (slab thickness, for `heat-penetration.ts`) was
  DERIVED from pan diameter + real mass + this entity's own just-computed
  density, not looked up. Storing the derived thickness itself as a
  second field would have created two numbers that could silently drift
  out of sync if either input changed; storing the assumption
  (`typicalDiameterCm`) and deriving thickness on demand (as
  `scripts/tortilla-flip-physics-as-a-robot.ts` does) keeps exactly one
  source of truth — the same "don't duplicate a derivable fact" principle
  `execution-bounds.ts`'s CCP floor and `isTerminalState` already follow.
- **Reporting a BRACKET (`t_symmetric <= t_actual <= t_singleSided`)
  instead of a single computed number for the one-flip case is a
  genuinely different engineering choice than this session's usual
  "compute one honest number, name its limits in prose"** — here, the
  honest answer for the exact question asked (one flip, halfway through)
  literally isn't computable with this repo's existing one-term
  approximation (which only exposes center temperature, not the full
  spatial profile stage two would need as a real initial condition).
  Rather than force a number out of a model that can't produce one
  honestly, or skip the question entirely, bounding it with two numbers
  the model CAN produce correctly is a real, useful, honest answer in its
  own right — worth keeping as a named pattern for future cases where the
  exact computation is out of reach but real bounds aren't.

### DRAIN — checking whether an EXISTING mechanism already covers a need before building a new one, and finding it doesn't

- **`REMOVE`'s own `removalMethod` parameter already named
  `'strainer_drain'`/`'poured_out'` as real draining techniques — the
  right first question was whether that meant DRAIN was already closed,
  not whether it needed building.** Checking concretely (not just
  reading the parameter's own prose) revealed it wasn't: `REMOVE` is a
  PLACE-shaped verb, only reachable for an instance `recipe-runner.ts`
  is actually tracking inside `placeContents` — and most real recipes in
  this vocabulary, including the two that actually needed draining,
  don't use the `FILL`/`PLACE_IN`/`HEAT_PLACE` machinery at all. A
  parameter value NAMING a real technique isn't the same as the
  mechanism actually being REACHABLE for the cases that need it — worth
  checking the reachability question explicitly, not just whether the
  right words already existed somewhere in the schema.
- **Built as a standalone verb instead, deliberately mirroring `REST`'s
  precedent rather than `REMOVE`'s** — the general lesson: when a new
  need resembles an existing mechanism but that mechanism has a
  precondition (here, "must be place-tracked") the new need doesn't
  actually share, the right move is a second, simpler mechanism with the
  SAME output shape (`addsTag`) but without the shared precondition, not
  forcing every recipe to adopt place-tracking just to reach one
  otherwise-unrelated verb.
- **The two recipes that needed this were found by asking "which real
  recipes go straight from FRY to SALT" — a concrete, checkable
  question — not by auditing every recipe file by hand.** Both
  `crispy-french-fries.json` and `salted-fried-potatoes.json` had the
  identical, real, previously-invisible gap; `crispy-french-fries.json`
  additionally needed a DELIBERATE parameter choice (`wire_rack`, not
  `paper_towel`) because its whole reason for existing (a double-fry
  precision demo) would have been undermined by the wrong drain method —
  the fix wasn't just "add the missing step," it was "add the missing
  step consistently with what each specific recipe is actually for."

### Periodic cooking of eggs — checking a mechanism's actual code before assuming the obvious approach works

- **The naive plan ("just call `HEAT_PLACE` repeatedly with alternating
  targets") was checked against `advanceTempSeconds`'s actual
  implementation BEFORE being attempted, and it would have silently
  failed** — the function has an explicit early return,
  `if (place.currentTempC >= targetTempC) return place`, meaning a
  target at or below the current temperature is a no-op, not a cooling
  step. This isn't a bug to work around; it's a real, correct physical
  fact this engine has always encoded (a `heatSourceProfile` is a
  positive energy source — burners heat, they don't refrigerate) that
  simply had never been exercised against a case that needed cooling
  before. Worth restating the general habit this confirms: when a plan
  depends on an existing function doing something specific, read that
  function's actual code before building on top of it, not just its doc
  comment or its name — `advanceTempSeconds` sounds generically
  bidirectional; it isn't.
- **The resulting design (two separately-maintained baths, not one
  cycled pot) turned out to be MORE faithful to the real technique, not
  a compromise forced by the limitation** — the paper's own real
  protocol literally uses two baths and moves the egg between them; a
  single pot whose temperature is cycled up and down would have been the
  LESS accurate representation even if the engine could do it. Finding a
  real engine constraint and discovering it happens to align with the
  more realistic model is a genuinely good outcome, worth noticing
  explicitly rather than treating the constraint as purely a limitation
  to apologize for.
- **`REST`'s own declared range got widened a second time (300-1800s to
  120-1800s) for the same reason it was widened once already** — a real,
  cited, new use case with a genuinely shorter duration than either
  existing one. This is the SAME pattern `EGG_SIZE_ADJUSTMENT_SECONDS`
  established for widening a range when a third real case appears,
  applied here to a different field — worth treating "does an existing
  numericRange need widening for a new real case" as a routine check
  when reusing a shared verb for a new purpose, not something to
  discover only when validation fails (which is what actually happened
  here — caught by the schema's own required-range check on the first
  real run, not anticipated in advance).

### Tool hygiene / cross-contamination — a repeatedly-NAMED gap that nobody had actually checked was reachable, and a design decision the user deliberately overrode

- **A gap can be named in four different places (`ROADMAP.md`,
  `LEARNINGS_TOOLING.md`, `LEARNINGS_ENGINE.md`, an external review) and
  still never have had anyone check whether the concrete scenario it
  describes was even MECHANICALLY REACHABLE with the vocabulary that
  existed.** "Same knife for raw egg then a ready-to-eat ingredient" was
  the standing example every single time this gap was named — but a
  direct check (before writing any engine code) found no action in this
  vocabulary ever let a knife touch RAW egg at all: `CUT` requires
  `'peeled'`, which itself requires `'boiled'` first, and `CRACK`/
  `SEPARATE` — the only two actions that ever touch raw egg — were both
  `requiredTools: []`. The mechanism being designed would have been
  correct but permanently unexercisable by its own textbook example
  without one small, deliberate, additive touch (`crack.json` gaining an
  optional `toolInstanceId` parameter). Worth generalizing: when a gap
  has been named many times without being built, check reachability of
  its own worked example before assuming the example still holds — the
  repeated naming is evidence the GAP is real, not evidence the example
  was ever verified.
- **The user explicitly overrode the assistant's own recommendation
  twice in the same design conversation, and both overrides mattered.**
  First, choosing "cross-contamination" (architecturally novel, tools
  have zero per-instance state anywhere) over the assistant's recommended
  lower-risk "storage/shelf-life" alternative. Second — after seeing a
  fully-reasoned recommendation for an unconditional hard reject, mirroring
  `egg_pasteurization_raw.json`'s own "no disclosed-consent framing for
  silently skipping raw-egg mitigation" precedent — choosing an ADVISORY
  warning instead. Neither override was arbitrary: the second one
  meaningfully simplified the resulting design (no interaction with
  `SafetyPolicy`'s human/autonomous split needed at all, since there's
  nothing to override in any mode). A strong technical argument for a
  stricter default is not the same thing as the right call for every
  mechanism — this repo's own posture varies by CCP already
  (`egg_cooking.json` advisory vs. `egg_pasteurization_raw.json` hard
  reject for genuinely different reasons); a NEW mechanism doesn't
  inherit one CCP's posture just because it's the most-recently-built
  precedent to mirror.
- **`place.ts`'s "runner-local map, keyed by an author-chosen instance
  id, living outside `Instance`/`applyAction`" shape generalized cleanly
  to a second, unrelated problem** (tool contamination, not shared
  heat) — real evidence that shape is a genuine reusable PATTERN in this
  engine (an escape hatch for "this concept needs real per-instance
  state but the entity/kind it attaches to has none in the core model"),
  not a one-off special case built just for `PlaceState`. Worth watching
  for a THIRD occurrence before promoting it to a named, documented
  convention rather than something each new file's doc comment
  re-derives by pointing back at `place.ts`.
- **A previously-declared-but-dead vocabulary slot (`knife.json`'s
  `possibleStates: ["clean","dirty",...]`, `allowedTransformations: []`)
  looked like the obvious thing to wire up, and wiring it up was the
  wrong call.** That machinery is `Instance`-based; tools have no
  `Instance` representation anywhere in this engine, so reactivating it
  would have meant giving every tool real per-instance inventory
  tracking for the first time — a materially bigger, structurally
  different change than the actual gap needed. The right move was
  building the real mechanism elsewhere (mirroring `place.ts` instead)
  and leaving the dead field honestly dead, cross-referenced rather than
  silently implied to be wired up. Matches this repo's own recurring
  discipline (see `knife.json`'s own new note) of naming what's NOT
  reactivated/covered rather than letting an old declaration quietly
  imply more than was ever built.

### `DomainFactSchema` — a repo-wide grep, not intuition, decided how far to spread a new field

- **2026-08-17.** The roadmap item named one concrete forcing case
  (`egg_cooking.json`'s `coagulationReferenceC`) but the schema itself is
  obviously general-purpose — the tempting move was adding
  `domainFacts` to `EntitySchema`/`ActionSchema` too, "since it'll
  obviously be useful there eventually." Ran an actual grep across every
  `data/*.json` file first, looking for the specific shape the gap
  describes (a numeric fact sitting in an untyped `metadata` object)
  instead of guessing. Result: `coagulationReferenceC` was the ONLY
  instance of that shape anywhere in this repo — every other real cited
  number already lives in a dedicated typed field (`thermophysical`,
  `physicalDimensions`, `storageLifeByState`, or one of the many small
  standalone modules like `egg-doneness.ts`/`cut-dimensions.ts`). Adding
  `domainFacts` to schemas with zero real data to put in it would have
  been exactly the "declared but dead" mistake this repo has caught and
  fixed multiple times already (`pan.json`'s unreachable hot/cold states,
  `potato.json`'s unwired `mashed`) — this time self-inflicted in a brand
  new mechanism instead of found later. Checking "is there actually a
  second real case" BEFORE generalizing, not after, is the same discipline
  `requiredToolCapabilities` was held to (`saucepan.json`/`wok.json`
  existing specifically to prove FRY/BOIL's fix wasn't a disguised special
  case) — applied here in the opposite direction: the check came back
  negative, so the field correctly stayed narrow instead of being padded
  out to look more "finished."
- **`verified: boolean` needed to be justified as a genuinely NEW axis, not
  just a restatement of `CitationSchema.confidence`, before it earned a
  place in the schema** — the two are easy to conflate (both are "how much
  do we trust this number"). What separates them, concretely: `confidence`
  is answerable by reading the file once ("is a named source given, yes or
  no"); `verified` is answerable only by knowing what actually happened
  THIS SESSION ("did anyone re-open that source and re-check this specific
  figure"). The repo already had real, concrete examples of both
  combinations before this field existed — `egg_pasteurization_raw.json`'s
  65-minute figure is `standard_reference` (a named FDA-adjacent process)
  AND was independently re-verified against peer-reviewed literature
  (2026-08-14, `LEARNINGS_PROCESS.md`) — `verified: true` territory; the
  McGee coagulation figures are `commonly_cited_unverified` and were never
  independently re-checked — `verified: false`. A field is worth adding to
  a schema once real, DIFFERENT, already-occurred cases exist that would
  populate it differently, not just because the concept sounds coherent in
  the abstract.

### PAR_FRY's place-readiness wiring — a same-shaped gap that widened, not duplicated, an existing branch

- **2026-08-17.** `shared-pan-heat-as-a-robot.ts`'s own closing note had
  named "PAR_FRY (same shape, not wired)" as still open since
  2026-08-16. Closing it needed exactly one line changed in
  `recipe-runner.ts`'s `assertPlaceReady`: widening the `fry` branch's
  condition to `action.id === "fry" || action.id === "par_fry"`, not a
  second, parallel `par_fry` branch. The reason that's safe and correct
  rather than a coincidental shortcut: the branch already reads its
  threshold off `action.parameters` — the actual `Action` object passed
  in for THIS step — rather than a fixed `fry.json` import, so it was
  already verb-agnostic in the one dimension that mattered.
  `par-fry.json`'s own 145-165°C range is genuinely narrower AND
  hotter-starting than `fry.json`'s 120-200°C (do the two ranges even
  overlap meaningfully? yes, 145-165 sits inside 120-200 — the "same
  shape" claim from the closing note held up under an actual check, not
  just an assumption) — worth the general lesson: when a helper already
  takes the specific object it needs as a parameter instead of a global
  constant, "the same shape, not wired for verb B yet" often really is a
  one-line widening, not a new branch — but only checking (not assuming)
  that the two verbs' ranges are independently meaningful is what turns
  that widening into a real proof (the capability-test script's 130°C
  case exists specifically to demonstrate the two branches don't
  collapse into one shared threshold by accident).

### A stale "still blocked" roadmap entry, and a redundancy found by actually running every real rule

- **2026-08-17.** "Unit tests per forbidden-transition rule" had sat unchecked
  in `ROADMAP.md` since before `Entity.invalidTransitions` existed, still
  reading "blocked on the matrix not existing" two full sessions after that
  matrix was built and audited (2026-08-15/16). Nobody had gone back to
  confirm the blocker actually cleared — worth treating a roadmap entry's own
  stated REASON for being blocked as something to re-check periodically, not
  just trust as still accurate because the checkbox is still unchecked.
- **Systematically running every real rule against the real engine — not just
  a representative sample — found a genuine structural redundancy that spot-
  checking would have missed**: egg's `peel.json` requires state `"boiled"`
  exactly (a single required state, not an array), which means PEEL can never
  fire from `"fried"`/`"poached"`/`"sliced"`/etc. in the first place — so
  egg.json's own `invalidTransitions` entries forbidding those same states
  from reverting to `"peeled"` are dead weight, always intercepted earlier by
  `statePrerequisites`. Confirmed by literally checking which of the two
  possible error messages fired (`/forbidden transition/` vs. the
  statePrerequisites one), not assumed from reading the JSON. This is
  harmless (defense in depth costs nothing at runtime) but worth recording:
  potato's parallel reversion-to-peeled entries are NOT redundant the same
  way (PEEL has no statePrerequisites for potato at all) — two entities can
  carry the textually-identical-looking rule for genuinely different
  structural reasons, and only actually running both against the real engine
  (not reading the data side by side) surfaces which is which.
- **A rule can be unconditionally correct and still be provably DEAD** —
  `egg_cracked.json`'s `fried`/`scrambled` forbidding a reversion to `"raw"`
  can never be exercised by any real action, since no action in this
  vocabulary has an output that ever produces `"raw"` (it only ever appears
  as an initial inventory state). The honest move was naming this explicitly
  in the script's own output rather than either (a) silently skipping it with
  no explanation or (b) faking a fabricated action just to get a green
  checkmark — the same "don't manufacture a proof, name what can't be proven"
  discipline this repo has applied to citations elsewhere, now applied to a
  test case.

### `src/planner.ts` — closing all five named planner gaps in one session, and what checking-before-building found

- **2026-08-17.** Asked to "close the gaps" against a five-item list this
  session itself had just named (path->RecipeScript, `RecipeIntentSchema`,
  cost-aware search, multi-instance/COMBINE, closed-loop replanning) —
  worth recording the ORDER these were tackled in and why: gap 5 (path
  conversion) first, because gaps 2 and 4 both structurally NEED it
  (`planIntent` and `runRecipeFromIntent` both call `stepsToRecipeSteps`
  internally); gap 1 (multi-instance) fourth, deliberately AFTER checking
  real engine behavior rather than assumed, since it turned out to need
  far less new machinery than expected once that check happened (below).
  Sequencing by real dependency, not by the order the gaps were originally
  listed, avoided building something twice.
- **The single biggest scope-reducing finding: `engine.ts`'s
  `requiredSecondaryCapability` check is ENTITY-level only, and NEVER
  inspects the secondary instance's current STATE — checked by reading
  `applyAction` directly before designing `planCombine`, not assumed from
  the field's name.** The naive plan going in was a "product-state search"
  tracking two instances' states simultaneously (the shape a real
  multi-instance planner eventually needs). Reading the actual check
  (`secondaryEntity.capabilities[action.requiredSecondaryCapability] ===
  true`, no `statePrerequisites` lookup anywhere on that branch) — and
  confirming `egg_cracked.json` has no `combine` key in its own
  `statePrerequisites` either — showed the secondary instance's STATE is
  never enforced at all today. That collapsed the real search space from
  "track two evolving state machines" down to "is the capability already
  true, or one spawn-hop away" — a small, bounded search
  (`planSecondaryRole`), not the larger mechanism originally assumed
  necessary. Worth restating as a general lesson (a close cousin of the
  `requiredIngredientCapabilities` gap this same file already named
  2026-08-12): before designing a search around a precondition, read what
  the precondition ACTUALLY checks, not what its name implies it checks —
  the implied scope and the real scope diverged here in a way that
  directly determined how much code needed writing.
- **That the engine doesn't enforce a secondary instance's state (e.g. a
  RAW egg would satisfy COMBINE just as well as a beaten one, per the
  actual code) is left as a real, honestly-named LIMITATION, not "fixed"
  by the planner pretending otherwise — but the planner still produces
  realistic output anyway, via a genuinely optional lever
  (`secondaryDesiredState`).** This is worth naming as its own small
  design principle: a planner sitting on top of an engine with a real gap
  doesn't have to choose between exposing that gap (producing a
  technically-legal-but-silly plan) or silently overclaiming precision the
  engine doesn't have — giving the CALLER an opt-in way to ask for the
  realistic behavior, defaulting to the engine's own actual (weaker)
  guarantee, is honest in both directions at once.
- **`recipe-runner.ts`'s real spawn-id scheme is a single GLOBAL counter
  across every entity type, NOT per-entity-type — confirmed by reading the
  code (`` `${spawned.entityId}-${++spawnCounter}` `` with ONE shared
  `spawnCounter`) and independently cross-checked against a real recipe
  file before relying on it.** The wrong, easy-to-assume alternative
  (per-entity-type numbering, the convention `recipe-scaffold.ts` actually
  DOES use for `initialInventory` ids) would have produced wrong
  predictions the very first time two different entity types spawned in
  the same recipe. Cross-checked against `tortilla-de-patatas.json`'s own
  real, hand-authored `"egg_cracked-3"`/`"tortilla_mixture-4"` — those
  numbers only make sense under the global-counter theory (potato_peel
  takes 1, egg_shell takes 2, egg_cracked takes 3, tortilla_mixture takes
  4) — turning a design assumption into a verified fact before writing
  `SpawnIdTracker` around it, not after. General lesson: two superficially
  similar id-numbering conventions can coexist in the same codebase for
  different purposes (author-facing scaffold ids vs. runtime-spawned
  ids) — "this repo numbers things per-entity-type" was true for ONE of
  them and false for the other; checking which convention actually
  applies to the thing being predicted, not just "does this repo have a
  numbering convention," is what avoided a real, silent bug.
- **A refactor of already-tested, working code (`isGoalReachable`) was
  done via strict extract-method, not rewrite, specifically so the
  existing test suite could PROVE zero behavior change rather than the
  refactor being trusted by inspection.** `enumerateEdges` is the exact
  loop body `isGoalReachable` already had, moved verbatim into its own
  function and called back into; every one of `tests/reachability.test.ts`'s
  existing assertions (plus `capability-test:reachability`'s own printed
  output) was re-run and diffed against pre-refactor behavior before
  building anything else on top of the extraction. Worth stating
  precisely why this mattered here specifically: `planLowestCost` NEEDED
  the identical precondition logic `isGoalReachable` uses (same
  `required*` checks, same `invalidTransitions` closure, same parameter
  fan-out) — the tempting shortcut was a second, independent
  implementation "close enough" to the original, which is exactly the
  kind of silently-divergible duplication this repo has repeatedly caught
  and fixed elsewhere (`oilTempC`'s two-threshold near-miss,
  `execution-bounds.ts`'s own stated discipline against it). Extracting
  and reusing cost nothing extra and removed the divergence risk entirely.
- **A real, checked property of the resulting system, not just an
  implementation detail: planning and execution are consistent BY
  CONSTRUCTION whenever they read the same available-tools/ingredients
  set — which surfaced as a genuine design problem while building
  `runRecipeFromIntent`'s own test coverage.** Since `enumerateEdges`
  (planning) and `applyAction` (execution) check identical preconditions
  from identical data, a step the planner includes in a path is
  GUARANTEED to succeed when immediately executed against the same world
  — meaning `runRecipeFromIntent`, as first drafted, had no way to ever
  actually exercise its own replanning branch through its public API,
  since `intent.availableTools` was the only tool-availability input
  anywhere in the signature. This is a case where trying to WRITE THE
  TEST first (or at least sketch it) surfaced a real design gap that
  writing the implementation alone hadn't — the fix
  (`executionAvailableTools`/`executionAvailableIngredientEntityIds`,
  optional overrides distinct from what `planIntent` assumed) is also
  independently the RIGHT real-world feature ("a robot discovers mid-run
  that a tool it expected is missing"), not a testing hack bolted on
  after the fact — the two motivations pointed at the identical fix.
- **Replanning was deliberately scoped to single-instance goals only, and
  the REASON is a real, specific mechanism, not a vague "combine is
  harder": splicing a replanned sub-path can change how many instances get
  spawned partway through execution, which could silently invalidate a
  LATER, already-baked-in `COMBINE` step's hardcoded `secondaryInstanceId`
  reference** (the very `SpawnIdTracker` prediction problem two entries
  above, but now happening mid-run instead of at plan time, where there's
  no second chance to recompute it before the reference is used). Solving
  this generally needs downstream instance REFERENCES to be re-resolved
  after a replan, not just a fresh `isGoalReachable` call — a real, larger
  problem, named explicitly (`runRecipeFromIntent` refuses a `combine`
  goal up front, loudly, rather than silently producing a plan that could
  break in a way that's hard to trace back to its actual cause).

### `EntitySchema.domainFacts` — the "wait for a second real case" discipline paying off exactly as predicted

- **2026-08-17, same day `DomainFactSchema` was deliberately scoped OUT of
  `EntitySchema` (a repo-wide grep found no second real case at the
  time), a genuine second real case showed up on its own — salt crystal
  size — and extending the field at that point, not before, is worth
  recording as the discipline actually working, not just a stated
  principle.** The tempting shortcut, back when `domainFacts` was first
  built, would have been adding it to `EntitySchema` "while I'm in
  here anyway, it'll probably be useful." That would have shipped a
  field with zero real data in it — exactly the declared-but-dead shape
  this repo has caught and fixed multiple times (`pan.json`'s hot/cold,
  `oven.json`'s off/preheating/hot, `potato.json`'s mashed). Waiting
  meant the SAME session that raised the deferred question also answered
  it, with a real, checkable forcing case (kosher/flaky salt's own real,
  cited grams-per-teaspoon figures) rather than an invented one — the
  clean version of "build it when something real needs it," not just an
  excuse to defer indefinitely.
- **The grams-per-teaspoon fact turned up a real, useful distinction
  between two physical quantities this repo already had a field for and
  one it didn't: `thermophysical.densityKgPerM3` (already present on
  salt.json/kosher_salt.json) is the SOLID CRYSTAL density — a property
  of sodium chloride itself, identical across all three salt entities —
  while the real, teaspoon-level difference between them is BULK/poured
  density (how much air sits between larger, irregular crystals in a
  measuring spoon), a genuinely different physical quantity this repo
  had no field for at all.** Reusing `thermophysical.densityKgPerM3` for
  the bulk-density fact would have been a real category error (the exact
  same "material fact vs. bulk-behavior fact" distinction, just not
  previously named) — checked directly before reaching for the existing
  field, not assumed to be the same number by proximity. `domainFacts`
  turned out to be the right home for the NEW quantity precisely because
  it doesn't presume a fixed unit or a single physical dimension the way
  a dedicated schema field (like `ThermophysicalPropertiesSchema`) would
  have — worth noting as a real, useful property of `DomainFactSchema`'s
  own design (a bare `{value, unit, citation, verified}` shape), not
  just its citation discipline.

## 2026-08-17

- **`applyAction`'s `statePrerequisites` check had a real, structural
  asymmetry between an action's PRIMARY target and its SECONDARY instance
  that had existed since `requiredSecondaryCapability` was first added
  (2026-08-12) and was never caught until directly audited for**: the
  primary target's `statePrerequisites[action.id]` was checked (has been
  since this engine's first commit); the secondary instance's was not
  checked at all — only its static, state-independent capability was. A
  COMBINE-shaped action's secondary slot (`onion` for
  `COMBINE_POTATO_ONION`, `egg_cracked` for `COMBINE`/
  `COMBINE_CON_CEBOLLA`) could be satisfied by an instance in ANY state
  asserting the right capability, including a raw, completely unprepped
  one. Fixed by extracting the primary check into a standalone
  `checkStatePrerequisite(entity, instance, action, role)` helper and
  calling it for both the target AND (when
  `requiredSecondaryCapability`/`secondaryInstance` are both present) the
  secondary — see `src/engine.ts`'s own doc comment on that function.
  General lesson: a check implemented and correctly exercised against ONE
  role of a multi-role action (the one named directly in a recipe step's
  `targetInstanceId`) is not evidence it was applied to every role — the
  secondary/tertiary role that gets less attention in review is exactly
  where an asymmetric gap like this hides.
- **The fix deliberately reuses `Entity.statePrerequisites` — the SAME
  map, keyed by the SAME action id — for the secondary role, rather than
  adding a new schema field for "secondary-role prerequisites."** This is
  safe here specifically because no entity used as a secondary instance in
  this vocabulary (`onion.json`, `egg_cracked.json`) is EVER the primary
  target of the same action id (`onion` is never the target of
  `combine_potato_onion`; `egg_cracked` is never the target of `combine`/
  `combine_con_cebolla`) — checked explicitly, not assumed, before reusing
  a map for a second purpose. A future action that DID need an entity to
  be both a valid primary target for action X and a valid secondary for
  action X under different state requirements would collide on this same
  key and need a real schema change (a separate
  `secondaryStatePrerequisites` map); named as a real, currently-inert
  edge case rather than pre-built for a situation that doesn't exist yet.

- **Given a genuinely large, structural item to pick up ("Heat as a shared,
  time-varying property of a PLACE" — user-selected from three real
  candidates), the right scope wasn't "build all of it" — it was finding
  the SMALLEST slice that's real, provable, and doesn't require touching
  `engine.ts`'s core `Instance` type or `applyAction`'s atomicity at
  all.** The tempting first design (add `inProgressAction` as a new field
  directly on `Instance`) was rejected specifically because `Instance` is
  threaded through nearly every file in this repo (`engine.ts`,
  `recipe-runner.ts`, `recipe-explain.ts`, `planner.ts`, `reachability.ts`,
  `tool-hygiene.ts`, dozens of scripts/tests) — a change there has a blast
  radius disproportionate to what this slice actually needed to prove.
  Built `src/in-progress-action.ts` as a fully standalone set of pure
  functions instead, taking an `Action`+`params`+a simulated start time as
  plain arguments rather than a mutated `Instance` field — the same
  "prove the mechanism is real via a script before touching the execution
  loop" discipline `place.ts`/`execution-bounds.ts` already established,
  applied here specifically to avoid a large, risky refactor of a
  pervasively-used type for a slice that didn't need it.
- **Composed the new module directly on top of `execution-bounds.ts`'s
  `ExecutionBound` rather than re-deriving a second "how long should this
  run" concept.** `progressStatus` takes an `ExecutionBound | undefined`
  as an argument instead of re-reading CCPs/`maxDurationSeconds` itself —
  the SAME `minSafeHoldSeconds`/`maxDurationSeconds` pair now answers both
  "may a sensor end this early" (execution-bounds.ts's own question) and
  "where in that range is this instance right now" (this module's
  question), from one real, cited source of truth rather than two that
  could drift apart. Worth naming as a general pattern this repo keeps
  reusing: when a new capability needs a number a DIFFERENT module already
  computes correctly, take that module's OUTPUT as an input rather than
  reimplementing the computation — `place.ts`'s `estimatedPreheatSeconds`
  reused the same way by `boil-potato-as-a-robot.ts`/`egg-doneness.ts` is
  the earlier instance of this same discipline.
- **A real design decision worth stating explicitly: `requestedDurationSeconds`
  being `undefined` (an action like MASH/BEAT/CRUSH that has no
  `durationSeconds` parameter at all) is NOT an error case or a "TODO,
  handle this later" — every function in the module treats it as a real,
  first-class "not applicable," distinct from 0 or from an unset-but-
  expected value.** `fractionOfRequestedDuration`/`remainingRequestedSeconds`
  return `undefined` rather than guessing a number from `maxDurationSeconds`
  (which is a CEILING, not the caller's actual target), and
  `progressStatus` can still correctly reach `forced_timeout` for such an
  action without ever being able to reach `at_requested_duration` — proven
  directly by a dedicated test case and by the capability-test script's own
  Case C (MASH), not just asserted in a doc comment.

- **A ticket's literal wording ("spin up parallel threads") had to be
  checked against this repo's OWN stated invariant before deciding how to
  build it, not implemented as literally specified.** `ENGINE_INVARIANTS.md`
  #9 requires determinism; `recipe-runner.ts`'s `runRecipe` mutates one
  shared inventory `Map` (plus `PlaceState`s, tool-contamination state)
  step by step. Genuine concurrent execution of independent steps — real
  `Promise.all`/worker-thread style concurrency — would mean two steps
  racing to read/mutate that shared state in a runtime-dependent
  interleaving, which is nondeterminism by construction, not a
  performance optimization with no downside. The right response wasn't
  "the ticket says parallel, so make it parallel" — it was recognizing
  that what the ticket ACTUALLY needs (a chef not standing idle while
  water boils) is answered by computing a deterministic SCHEDULE of what
  concurrent execution would look like, not by executing concurrently.
  Same category of decision as `in-progress-action.ts`'s earlier one
  (avoid touching `Instance` directly) — a large-sounding ask has a
  smaller, safer, still-fully-real implementation once the actual
  requirement is separated from the specific mechanism the ticket
  proposed for it.
- **Extended `runRecipe` itself this time (unlike `execution-bounds.ts`/
  `in-progress-action.ts`, which stayed fully standalone) — but only for
  the part that's genuinely safe: EXECUTION ORDER, not execution
  mechanism.** Switching from raw `recipe.sequence` array iteration to
  `topologicalOrder`'s output is safe specifically because two independent
  steps (different `targetInstanceId`s, no `dependsOn` between them)
  produce an IDENTICAL final inventory state regardless of which runs
  first — order only matters for correctness where a real dependency
  exists, and `deriveDependsOn`'s auto-sequential fallback preserves
  exactly the existing order wherever a recipe doesn't say otherwise. This
  is a real, provable claim, not an assumption: `npm run validate`
  re-simulating all 22 existing recipes to an IDENTICAL result is the
  actual proof, run and checked, not inferred from the algorithm's design
  alone.
- **Populating `requiresActiveAttention` across all 26 continuous actions
  in one pass (rather than only the ~4 needed for the ticket's own demo)
  was a deliberate completeness call, matching the precedent
  `actionKind`/`maxDurationSeconds` already set** (both audited across
  every action in one ticket each, not left half-done) — `validate.ts`'s
  new NOTE-level check for this field would otherwise have immediately
  flagged 22 unaudited continuous actions the moment anyone looked, a
  visible, avoidable gap for a field this cheap to fill correctly up
  front. Classified as a real technique judgment (does this need
  watching, yes/no), explicitly NOT treated as a citation-worthy fact —
  no `REFERENCES.md` entry was added for these 26 classifications, the
  same reasoning that already applies to e.g. "PEEL requires a knife": a
  reasoned engineering/domain judgment, not a measured or regulatory
  claim needing a source.
- **`RecipeStepError.step` requiring a real `RecipeStep` (not a nullable/
  optional field) turned a graph-level error (a cycle spanning the WHOLE
  sequence, not any one step's fault) into a small design question**:
  attach it to the first step in `recipe.sequence` as the least-wrong
  available anchor, with a message that says plainly it's a whole-graph
  problem, rather than changing `RecipeStepError`'s shape (e.g. making
  `step` optional) just to accommodate one rare case — the existing type
  stayed exactly as strict as it already was for every other caller.

- **A deferred ticket's OWN stated reason for deferral needs re-checking,
  not just the ticket's substance, once the surrounding conditions have
  changed.** "SEASON" was deferred in 2026-08-13 specifically because
  "engine work is explicitly paused" — a real, correct reason at the
  time. By 2026-08-17, several other tickets this session had already
  touched `engine.ts` directly (the DAG-execution ticket's
  `topologicalOrder` wiring into `runRecipe`, `checkStatePrerequisite`'s
  secondary-instance extension, `execution-bounds.ts`). The substance of
  SEASON's own blockers hadn't changed at all — but the STATED REASON for
  leaving them alone had quietly stopped being true partway through the
  session, and nothing would have caught that automatically; it only
  surfaced because a "what's next" check re-read the deferred entry's own
  wording rather than treating "deferred" as a permanent, settled state.
- **`addsTagFromParameter` deliberately does NOT mirror
  `transformedStateFromParameter`'s exact shape (a bare string naming a
  parameter, with the raw value used directly), even though the ROADMAP
  entry that requested it said "mirroring transformedStateFromParameter."**
  A literal mirror would mean the added TAG equals the parameter's raw
  VALUE — but the real seasoning tags
  (`salted`/`peppered`/`chili_seasoned`/`acidified`) are not the same
  strings as the values that select them
  (`salt`/`pepper`/`chili`/`acid`), so a literal mirror would have forced
  either renaming `EntitySchema.possibleTags` across every entity that
  already uses the real tag names (real, unnecessary breakage of working
  data) or picking awkward parameter values that happen to match existing
  tags (a worse authoring experience, contorted to fit the mechanism
  rather than the mechanism fitting the real need). Built as an explicit
  value-to-tag MAP instead — same spirit (a parameter drives the output),
  different shape — and named the deviation explicitly in both the
  field's own doc comment and `ROADMAP.md`'s closure entry, rather than
  silently implementing something narrower than requested while claiming
  to have followed the request as stated.
- **`requiredIngredientCapabilityFromParameter`'s error-checking order
  matters and was deliberately sequenced BEFORE the generic
  `action.parameters` validation loop, not after**: an unrecognized
  `seasoningType` value gets ITS OWN specific error naming the missing
  capability mapping, rather than falling through to the generic
  `allowedValues` rejection that would ALSO eventually catch it but with
  a less specific message. Both loops would reject a truly bad value
  either way (redundant safety, not a correctness gap), but ordering the
  more specific, more informative check first is a real, small
  authoring-experience decision worth making deliberately rather than
  leaving to whichever loop happens to run first in the file.

- **A module's own doc comment naming a real, deliberate simplification
  ("unlimited passive capacity... not modeled") is a genuine backlog
  item, not just an honesty disclaimer to write once and leave alone.**
  `dag-scheduler.ts` named the missing tool-contention constraint the
  same day it first shipped; picking it up as the very next "what's
  next" turn (rather than a newer, unrelated item) meant the real
  motivating example was already fully worked out — no new research
  needed, just building the thing the doc comment had already specified.
  Worth treating a "not modeled, named here" sentence as a live todo with
  a known shape, not a closed matter once it's been written down once.
- **Distinguishing "the actor is busy" from "the tool is busy" as TWO
  separate constraints, not one, was the real design decision — a
  passive `ROAST` occupies its oven for the whole duration even though it
  frees the actor's hands immediately.** Collapsing these into one shared
  resource (as if "busy" only ever meant one thing) would have been a
  real, silent modeling error: it would have correctly serialized two
  ACTIVE tasks needing the same tool (already covered by the actor
  constraint) but WRONGLY allowed two PASSIVE tasks sharing one oven to
  overlap, since neither touches the actor at all. Both constraints are
  now checked independently and a node's start time is the max across
  every one that applies to it — proven directly by a dedicated test
  ("a PASSIVE step still locks its tool even though it never touches the
  actor constraint") rather than assumed to follow from the design.
- **Checked which real actions actually HAVE an exact `requiredTools`
  entry before picking a real-data demo, rather than assuming the
  existing BOIL/CARAMELIZE case from the ticket's own case C would also
  exercise the new mechanism.** It doesn't: BOIL/FRY/CARAMELIZE all use
  `requiredToolCapabilities` (substitutable — "any deep vessel"), which
  this feature deliberately does NOT cover (see its own scoping note) —
  so that existing demo stays correctly tool-lock-free, and a genuinely
  different real case (`ROAST`, `requiredTools: ["oven"]`) was needed to
  prove the new mechanism at all. Grepped every `data/actions/*.json` for
  a real one rather than reaching for the nearest already-loaded fixture,
  which would have silently proven nothing.

## 2026-08-17 (whole-project review)

- **A prior session's own doc comment can be the cleanup checklist, if it
  admitted the duplication at the time rather than hiding it.**
  `dag-scheduler.ts`'s `scheduleDagFromSteps` had said, in its own words,
  "same extraction as `in-progress-action.ts`'s `beginAction` —
  deliberately NOT re-implemented differently here" since the day it was
  written — an honest acknowledgment of parallel logic, not a claim it
  was shared. A whole-project review turned that admission into an actual
  fix: extracted `parseDurationSecondsParam` into `in-progress-action.ts`
  (the file whose own domain — reading a caller-requested duration off an
  action's `params` — the logic conceptually belongs to) and had
  `dag-scheduler.ts` import it instead of re-deriving the identical
  `Number(raw)`/`!Number.isNaN(...)` shape a second time. Proven
  behavior-preserving, not just assumed: `tests/dag-execution.test.ts`'s
  existing cases and `scripts/dag-schedule-as-a-robot.ts`'s real-data
  output were both re-run and produced byte-identical results before and
  after.
- **`ROADMAP.md` got the exact same size-driven split `LEARNINGS.md` got
  on 2026-08-15, for the identical reason: one section ("Common culinary
  knowledge coverage") had grown to 1,673 of the file's 3,221 lines** —
  over half the file, and the single biggest impediment to actually
  finding anything in it. Split into `ROADMAP_KNOWLEDGE.md`, content
  moved verbatim — checked via a literal reconstruction diff (concatenate
  the unchanged head, the extracted section, and the unchanged tail; diff
  against the original file) rather than eyeballing it, the same
  "checked line-for-line, not just believed" discipline the `LEARNINGS.md`
  split itself used.
- **`CLAUDE.md`'s own "Module layout" section — the first thing any future
  session reads — had gone stale by SIX real additions**
  (`in-progress-action.ts`, `dag-scheduler.ts`, the DAG-execution engine
  wiring, the SEASON generalization, tool-lock scheduling, and the entire
  baking epic), none mentioned, despite `CLAUDE.md`'s own explicit stated
  rule ("don't let this section... go stale... update the doc that
  describes it in the same change, not 'later'"). Worth naming plainly: that
  rule was NOT followed for several of this session's own commits — the
  fix went into `ROADMAP.md`/`LEARNINGS_ENGINE.md` each time (both real
  and necessary) but `CLAUDE.md` itself was missed repeatedly until a
  dedicated review caught it. A per-commit discipline this good still
  benefits from a periodic whole-file audit, not just trusting each
  individual change to have remembered every doc that name-checks it.
