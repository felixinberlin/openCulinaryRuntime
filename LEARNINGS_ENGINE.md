# LEARNINGS_ENGINE.md

Part of `LEARNINGS.md`'s theme split. This file: **engine/schema
architecture** — `src/*.ts` design decisions, invariants, engine bugs
found and fixed, schema-shape tradeoffs. Read `LEARNINGS.md`'s Core
section first — its verification/testing/architecture rules apply
throughout everything below; this file adds the engine-specific residue
those rules don't capture, plus concrete technical gotchas.

Pruned 2026-08-18 (was 2,158 lines) per `LEARNINGS.md`'s maintenance
discipline: dropped entries whose lesson moved to Core, entries fully
duplicated by the relevant `src/*.ts` doc comment (kept as a pointer
instead), and pure bug-retrospective narrative where the fix is stable
and tested. Kept: real, non-obvious technical gotchas, and architecture
decisions with reasoning not fully captured elsewhere.

---

## 2026-08-12

- **`ActionOutputsSchema` supports exactly one of `transformedState`
  (fixed) or `transformedStateFromParameter` (fully parameter-driven) —
  never "fixed by default, overridable per call."** See `action.ts`'s own
  doc comment for the full shape; the escape hatch when a real outcome
  genuinely differs is either an informational, non-state-determining
  parameter, or a dedicated new verb (`SCRAMBLE` from `FRY`, `POACH` from
  `BOIL`).
- **`byproductsByAction` (keyed by action id) exists because a flat
  `producedByproducts` list breaks the moment one entity has two
  DIFFERENT `spawnsTargetByproducts` actions** (egg: `PEEL` → shell only,
  `SEPARATE`/`CRACK` → shell + yolk/white). See `ingredient.ts`.
- **`destroysTarget` actions still populate `ExecutionResult.instance`**
  (the target's state the instant before removal, for logging) — the
  caller must `inventory.delete(...)` via `result.destroyed`, not
  `.set(...)` against `.instance`. A demo script bug chained off the
  wrong field once, caught only by running it.
- **A finished dish is represented by `RecipeScript.names`, not a new
  composite entity** — `EntitySchema.structure.composite/components`
  exists but nothing populates it from independently-cooked components
  yet (no `ASSEMBLE`-style verb).
- **Ingredients are never consumed/decremented by
  `requiredIngredientCapabilities` — only checked for presence.** A
  documented limitation and a convenience at once: it's what makes "the
  same oil instance flavors garlic, then fries a potato two steps later"
  work for free.

## 2026-08-13

- **`node --import tsx --test tests/` throws `ERR_UNSUPPORTED_DIR_IMPORT`
  — needs an explicit glob** (`tests/*.test.ts`), not a directory arg;
  tsx's resolver intercepts the bare path before node:test's own
  file-discovery logic gets to it.
- **Zod's `z.infer` (post-default output type) is the wrong type for test
  -fixture builders — use `Partial<z.input<typeof Schema>>` instead.** The
  output type requires every defaulted field present; the input type has
  them genuinely optional, matching what `.parse()` actually accepts.
- **A regression test is only proven to catch its regression by actually
  breaking the code and watching it fail red**, then restoring it — not
  merely written and assumed correct.
- **Live web research beats recalled knowledge for anything that moved
  during this model's training-cutoff gap** — confirmed concretely for
  RoboCasa365's actual current release and a Feb 2025 paper, both needed
  `WebSearch`/`WebFetch` to state correctly.
- **Translating a schema into an unrelated, well-established formalism
  (PDDL) is a good pressure test for whether a design decision is
  principled or accidental** — a principled one translates cleanly (this
  repo's presence-only `requiredIngredientCapabilities` matches PDDL's
  own `exists` shape with zero new machinery needed); an accidental one
  needs new machinery to express. See `SIMULATION_TARGETS.md` for the
  full five-candidate comparison and what none of them capture (numeric
  fluents for D/z-value math, `CitationSchema`'s provenance layer).
- **A vague "refine/clean this up" request is much better answered by
  checking systematically for MORE instances of an already-found bug
  class than by an unstructured re-read.** A capability-diff audit script
  found 5 hits; the right response to 4 of them was "no change" (already
  justified in their own doc comments) — finding a hit and fixing it are
  different actions, and a note that JUSTIFIES a gap vs. one that just
  ADMITS it (`"todo"`) is the actual signal for which is which. Resisted
  padding the other, unrelated empty-hazard actions "for symmetry" once
  in an audit mindset — that would have been dishonest padding.

## 2026-08-14

- **Temperature plateaus at the boiling point instead of climbing
  indefinitely** (latent heat of vaporization redirects further energy
  into phase change, not further ΔT) — `advanceHeatSeconds` clamps at
  `boilingPointC` rather than integrating straight through it. Does NOT
  model evaporative mass loss past that point (named, not hidden).
- **A real ordering trap in a refactor was only caught by checking a
  test's failure MESSAGE, not just pass/fail.** A naive `advanceHeatSeconds`
  → `advanceTempSeconds` wrapper resolved `boilingPointC` before checking
  place/entity match, breaking an existing test's error CONTENT (right
  pass/fail, wrong message) for the one fixture with no `thermophysical`
  block. "The tests still pass" isn't proof of preserved behavior until
  the actual message is checked too, for exactly this class of case.
- **Water's `boilingPointC` clamp is a genuine physical impossibility;
  oil's `targetTempC` clamp is a controlled-heating setpoint with nothing
  physically preventing it from being exceeded** — two different KINDS of
  clamp, named explicitly rather than conflated under one word.
  `smokePointC` is a third, different kind again: a hard-reject safety
  ceiling on the requested TARGET (not a runtime clamp during heating) —
  an unsafe request should be loud, not quietly capped.
- **`requiredTools` matched by exact entity id with no capability-based
  path, even though the identical distinction was already solved for
  ingredients** (`requiredIngredientCapabilities`) — the asymmetry was
  already named in `action.ts`'s own doc comment, just never carried to
  the tool side. `saucepan.json` exists specifically so "generic" is a
  checked claim, not an assertion — a mechanism proven against only the
  one entity that motivated it is still, empirically, a disguised special
  case.

## 2026-08-15

- **`WASH`'s `outputs.transformedState: "washed"` was a real schema bug,
  not a data-ordering preference — `state` can only hold ONE value, so
  WASH-then-PEEL silently erased the fact a potato had ever been washed.**
  Fixed by moving to `tags` (the mechanism `SALT`/`PEPPER`/`CHILI` already
  use for "has this happened, independent of current form") and
  generalizing `engine.ts`'s `statePrerequisites` check to match a tag as
  well as a state. When a "state" turns out to actually be an orthogonal
  fact, grep for the literal string everywhere it might be
  pattern-matched (three other places had quietly baked in the old, wrong
  assumption) — cheaper than trusting recall.
- **`INVALID_TRANSITIONS` (global map, `CLAUDE_DEV_CTX.md`'s own literal
  example) vs. per-entity keying was resolved by finding a real
  contradiction, not by preference**: `potato.json`'s `boiled → peeled`
  forbidden vs. `egg.json`'s `statePrerequisites.peel: "boiled"` REQUIRING
  that exact transition — same bare state names, opposite correct rules.
  A single global map cannot hold both. (Potato's own rule was later
  found factually wrong and retracted — see `LEARNINGS_PROCESS.md`
  2026-08-15 — but the global-vs-per-entity architecture finding survives
  independent of that correction, since egg's real requirement still
  collides with the bare state name either way.)

## 2026-08-16

- **`applyAction`'s continuous-process wiring (`FILL`/`PLACE_IN`/
  `HEAT_PLACE`) lives in `recipe-runner.ts`, not inside `applyAction`
  itself, on purpose.** `applyAction` is and stays a pure, instantaneous
  one-shot function; `advanceTempSeconds` is a fundamentally different
  shape (a loop over real elapsed time). Bolting a continuous process
  onto an "instantaneous" contract would have silently lied about what
  `applyAction` does. `place.ts` had already independently arrived at
  this shape by necessity before any of this existed.
- **`FILL` deliberately does NOT remove the poured ingredient instance
  from inventory**, unlike every other consuming action — pouring water
  into a pot doesn't transform the water into anything, only its
  container changes. Removing it would have broken every downstream
  step's existing presence check for that ingredient — caught by tracing
  the actual consumer (`two-eggs-shared-pot.json`'s later `BOIL` steps),
  not by reasoning about `FILL` in isolation.
- **`isBoilingMedium`/`isFryingMedium` were never the right capability for
  `FILL` to check** — they answer "usable as the medium for a LATER
  verb," not "is this a pourable liquid" (the only fact FILL itself
  cares about). Fixed by naming the real, weaker fact directly
  (`isPourable`), the same capability-granularity generalization
  `isDeepVessel`/`isFryingVessel` already established for tools, applied
  here to the ingredient side.
- **Auditing all 32 actions individually (not batch-assigned by pattern
  match) for `actionKind: "instantaneous"|"continuous"` found most of
  this repo's non-thermal mechanical verbs are LESS physically honest
  than the cooking verbs** — 9 of 10 initially-ambiguous actions resolved
  to `continuous` (real, open-ended processes toward an observable
  termination: `beat`/`mix`/`emulsify`/`mash`/`crush`/`grate`/`dissolve`/
  `shock`/`scramble`), disagreeing with `applyAction`'s actual one-shot
  execution for every one of them. `cut` was the one case that, on real
  examination, was NOT actually ambiguous — a fixed, bounded number of
  strokes toward a predetermined shape, not an open-ended threshold,
  genuinely different from `grate`/`mash` despite superficially similar
  repeated-motion. This field changes zero execution behavior — it's a
  classification + honest-gap inventory (`recipe-explain.ts`'s pre-flight
  report only), not wired into `runRecipe`'s dispatch.
- **`recipe-explain.ts`'s pre-flight report couldn't resolve a step
  targeting a SPAWNED instance** (`egg_yolk-3`) — it only ever checked
  `recipe.initialInventory`. Fixed by giving `recipe-runner.ts`'s
  `RecipeRunResult` a real `spawnedEntityIds: Map` (every instance ever
  spawned during a run, including later-destroyed ones) that a caller who
  already ran the recipe can supply — real ground truth from the one
  place spawn ids are actually generated, not a re-derivation of
  `spawnCounter`'s naming scheme. This exact pattern (read a DIFFERENT
  module's real output as input, rather than re-deriving the same number
  a second way) recurs constantly in this codebase — `isTerminalState`
  (computed from existing `invalidTransitions`, not a new authored flag),
  a CCP floor read from real CCP data, `assertPlaceReady`'s threshold
  read off `action.parameters` instead of a second hardcoded constant,
  `in-progress-action.ts` composing on `execution-bounds.ts`'s output.
- **Cite the PHYSICS, not the paper that happened to apply it** — a
  preprint is the wrong confidence tier for uncontroversial general-
  chemistry math (dilution/conservation-of-solute) even though it's where
  this repo encountered the culinary application; cite the relation
  itself as `standard_reference`, note the paper only as where the
  application was found.
- **A reachability search reuses `Action`'s own real fields
  (`requiredTargetCapability`/`statePrerequisites`/`invalidTransitions`
  etc.) at search time, rather than a purpose-built graph structure** —
  keeps the search and the real engine from ever silently disagreeing
  about what's legal; a separate graph representation would have been a
  fourth source of truth. `destroysTarget`/`combinesInto` needed a
  genuinely different treatment than a blocked edge: a dead end with ZERO
  outgoing edges (the original instance no longer exists at all,
  regardless of what `invalidTransitions` says), not a state that gets
  explored normally.
- **A byproduct-sum sanity check's first version assumed every byproduct
  group represents the ENTIRE former parent** (true for `SEPARATE`/`CRACK`,
  `destroysTarget: true`) but applied that assumption to `PEEL` too (the
  parent PERSISTS, the byproduct is only ever a small slice) — 3 false
  positives on real, correctly-cited data. Fixed by keying the check off
  the actual triggering action's `outputs.destroysTarget`. A sanity
  check's correctness depends on getting its SCOPE right, not just the
  arithmetic.
- **A capability system that checks "presence of a flag" rather than
  "identity of the specific entity" is a genuine, permanent, still-open
  trade-off** — `combine_con_cebolla.json` had to reuse `potato.json`'s
  `isCombinableBase` flag on a different entity (`potato_onion_mixture`),
  and nothing stops the ORIGINAL `combine.json` from firing against that
  same instance too, silently discarding the onion-composition fact.
  Deliberately NOT fixed with a real per-entity-identity check (a bigger,
  more invasive change than this feature's scope warranted) — named in
  `potato_onion_mixture.json`'s own `capabilityAmbiguityNote` instead.
  Every new REUSE of an existing capability flag for a second, different
  fixed pairing is a new place this can bite, not a one-time cost.
- **No `Instance` anywhere in this engine has ever carried a temperature
  once it isn't inside a tracked `PlaceState`** — a user's real-world
  question ("does hot potato partially cook the raw egg mixed with it")
  confirmed this structurally, not just as an oversight. Chose the
  lightweight fix (`REST`, `addsTag: "rested"`, informational only) over
  giving `Instance` a real `currentTempC` — offered as an explicit
  `AskUserQuestion` fork, not picked unilaterally, since unlike most gaps
  this one has real, different future implications either way.
  Deliberately did NOT let `REST` feed any HACCP credit into a CCP
  threshold — this repo's safety discipline is "cite a real D/z model or
  don't claim the credit," and no cited model exists for uncontrolled
  contact-heating rest.
- **Picking the FDA "Big 9" allergen list over the EU's wider 14, despite
  this repo's content skewing Spanish/EU** — because the existing CCP/
  HACCP machinery is already FDA/USDA-sourced throughout; a second
  regulatory citation family for one field would have made "which
  jurisdiction does this repo actually follow" newly ambiguous. A CLOSED
  `z.enum`, not `CapabilitiesSchema`'s usual open-string precedent, was
  the decision that mattered: a misspelled/inconsistent capability just
  makes one substitutability check silently fail; a misspelled/
  inconsistent allergen means a real "contains X" claim silently doesn't
  match — whether a vocabulary should be open or closed depends on
  whether an inconsistent entry fails loud or fails silent-and-unsafe,
  not on a repo-wide default. The composite-entity superset check is
  deliberately a HARD FAIL, not the usual soft NOTE, for the same
  silent-and-unsafe reason.

## 2026-08-17

- **`applyAction`'s `statePrerequisites` check was asymmetric between an
  action's primary target and its secondary instance since
  `requiredSecondaryCapability` was first added (2026-08-12), never
  caught until directly audited for** — the secondary's STATE was never
  checked, only its static capability (see `LEARNINGS.md` Core's
  "multi-role action" rule). Fixed by extracting `checkStatePrerequisite`
  and calling it for both roles, reusing the same `Entity.
  statePrerequisites` map — safe specifically because no entity used as a
  secondary here is ever the primary target of the same action id
  (checked explicitly, not assumed, before reusing the map).
- **A large-sounding ticket ("heat as a shared place") was scoped to the
  smallest slice that's real and provable without touching `Instance` or
  `applyAction`'s atomicity at all** — `Instance` is threaded through
  nearly every file in this repo; a field added there has a blast radius
  disproportionate to what the actual slice needed. `in-progress-action.ts`
  took an `Action`+`params`+simulated start time as plain arguments
  instead.
- **A ticket's literal wording ("spin up parallel threads") was checked
  against `ENGINE_INVARIANTS.md` #9 (determinism) before being
  implemented as specified** — `runRecipe` mutates one shared inventory
  `Map` step by step; genuine concurrent execution would be
  nondeterminism by construction, not a free performance win. What the
  ticket actually needed (a chef not standing idle while water boils) is
  answered by computing a deterministic SCHEDULE, not by executing
  concurrently. `runRecipe` DID get switched to `topologicalOrder`'s
  output instead of raw array order — safe because two independent steps
  produce an identical final state regardless of which runs first, proven
  by re-simulating all 22 existing recipes to an identical result, not
  assumed from the algorithm's design.
- **Distinguishing "the actor is busy" from "the tool is busy" as TWO
  separate scheduling constraints, not one** — a passive `ROAST` occupies
  its oven for its whole duration even though it frees the actor
  immediately; collapsing these would have wrongly allowed two passive
  tasks to share one oven. Both are checked independently, start time is
  the max across every constraint that applies.
- **`addsTagFromParameter` deliberately does NOT literally mirror
  `transformedStateFromParameter`'s shape, despite being requested as "the
  same mirroring."** A literal mirror (added tag = parameter's raw value)
  would force renaming real, working `possibleTags` data — built as an
  explicit value-to-tag MAP instead, and the deviation from the literal
  request was named explicitly, not silently substituted.
- **A deferred ticket's OWN stated reason for deferral needs re-checking
  once surrounding conditions change, not just its substance** — SEASON
  was deferred in 2026-08-13 specifically because "engine work is
  paused"; several unrelated tickets had since touched `engine.ts`
  directly, quietly making the stated reason stop being true mid-session.
  Nothing catches this automatically.
- **`CLAUDE.md`'s "Module layout" section — the first thing any future
  session reads — went stale by six real additions before a dedicated
  review caught it**, despite the file's own explicit "update in the same
  change, not later" rule. A per-commit discipline this consistent still
  benefits from a periodic whole-file audit.

## 2026-08-18

- **Multi-word Cooklang names are unambiguous WITHOUT a hand-rolled
  lookahead scanner, if the name-run's own character class simply
  excludes every other token's marker/brace characters** — reaching any
  OTHER token's marker character always ends the run first, so the regex
  engine's own backtracking can never bridge across a real `@`/`#`/`~` to
  reach a `{` belonging to a different token.
- **A `.` in a shared character class silently swallows trailing sentence
  punctuation into a token** (`Salt @sal.` parsed as token `"sal."`) —
  passed schema validation, failed entity resolution, looked exactly like
  a coverage gap rather than a parser bug. Caught by round-tripping a
  REAL recipe through export→import before writing the formal test suite
  — the isolated unit tests for that form used inputs without trailing
  punctuation and wouldn't have caught it alone.
- **`+` where `*` was needed in a capture group silently drops an entire
  token FORM** (Cooklang's unnamed timer, `~{5%minutes}`, has no name
  between `~` and `{`) — the whole form never matched, with no error
  anywhere. A single shared regex serving multiple token kinds needs each
  kind's own grammar checked against real examples of ALL its forms
  (named vs. unnamed, braced vs. bare), not just the form top-of-mind
  while writing it.
- **A regex `\b` word boundary silently fails to match when the pattern
  itself ENDS in punctuation** (`"Combine (flour + water)"`, ending in
  `)`) — `\b` needs a word-char/non-word-char transition on both sides;
  fixed with lookaround (`(?<![A-Za-z0-9_])...(?![A-Za-z0-9_])`) instead,
  which works identically for ordinary cases but also handles
  punctuation-ending ones.
- **Real data can have a genuine cross-action verb collision** (four
  distinct actions share `verb: "COMBINE"`) — a naive `Map<alias,
  actionId>` verb index let the last one loaded silently win. Fixed by
  tracking every alias's full candidate list and reporting real ambiguity
  instead of guessing — found by a capability-test against real data, not
  the synthetic unit tests (which had no collision to expose).
- **A second, more precise ticket arriving for the SAME feature the same
  day is a real, useful signal, not noise to route around.** A first
  `execution-graph.ts` pass was functionally complete and tested, but its
  own `compileToExecutionGraph` (domain-aware validation) lived inside
  the same file as the IR types — "decoupled from the runtime's internal
  representation" was true of the TYPES but not the MODULE. A follow-up
  ticket's own closing line named exactly this drift. Fixed by physically
  splitting into `execution-graph.ts` (IR + minimal builder API, `zod`
  only) and `execution-graph-compiler.ts` (the producer, built on top of
  the minimal API) — turning "the compiler shouldn't leak into the IR"
  from convention into an import-graph fact. Read a second ticket's own
  stated reasoning before assuming it's just restating the first.
