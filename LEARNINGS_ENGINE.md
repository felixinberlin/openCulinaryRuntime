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
