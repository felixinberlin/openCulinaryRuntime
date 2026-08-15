# LEARNINGS_TOOLING.md

Part of `LEARNINGS.md`'s theme split (2026-08-15 — see that file for the
index and why). This file: **authoring/CLI tooling built on top of the
engine** — `recipe-explain.ts`/`validate-recipe.ts`, `recipe-narrator.ts`,
`recipe-scaffold.ts`, and how they compose with each other. Not: engine/
schema architecture (`LEARNINGS_ENGINE.md`), food-science/technique facts
(`LEARNINGS_DOMAIN.md`), or verification-discipline/external-input lessons
(`LEARNINGS_PROCESS.md`).

Same rules as before the split: dated, append-only, concrete lessons only —
not a changelog of *what* changed (that's `git log`), *why* a design choice
was made. Don't rewrite or delete old entries — append.

---

## 2026-08-15

### `recipe-explain.ts`/`validate-recipe.ts` — a CLI recipe validator is mostly a framing problem, not a new engine

- **The user's stated goal was a future, separate "recipe creator" frontend
  that validates against this repo's rules — and the actual engine work for
  that already existed.** `engine.ts`'s `applyAction` (tools, capabilities,
  state prerequisites, HACCP CCP thresholds) and `recipe-runner.ts`'s
  `runRecipe` (walks a whole `RecipeScript`, collects errors without
  halting) already ARE the rule-driven validator — proven by every existing
  demo/capability-test script. What was actually missing, confirmed by
  reading both files in full rather than assumed, was narrower than "build
  a validator": (1) nothing accepted an arbitrary file path, only a
  `data/recipes/` id; (2) nothing summarized a whole recipe's tool/
  ingredient needs UPFRONT — a missing tool only ever surfaced as a runtime
  rejection on the first step that hit it; (3) nothing cross-checked the
  informational `yolkDoneness`/`pieceSize` parameters against the actual
  `durationSeconds` supplied, since `applyAction` deliberately never reads
  them together (they're documented hints, not enforced values — see
  `egg-doneness.ts`'s own doc comment). Recognizing which parts already
  existed, rather than re-deriving them, is most of why this stayed a
  small, additive module (`recipe-explain.ts`) instead of a second engine.
- **Running the new validator against REAL canonical recipes immediately
  surfaced a genuine, previously-invisible gap**, not a synthetic
  test-fixture result: `tortilla-de-patatas.json` AND
  `tortilla-de-betanzos.json` (checking every `data/recipes/*.json` file,
  not just the one first tried, found the second instance of the same
  gap) both went straight to PEEL on a raw potato, never washing it first.
  Fixed the same day by adding a WASH step ahead of PEEL to both, matching
  the wash/peel/cut order every other potato recipe already used
  (`salted-fried-potatoes.json`) — a one-line-per-file change, re-verified
  via `npm test`/`npm run validate`/re-running `validate-recipe` across
  all 12 recipes (zero prep advisories left). The finding itself is still
  explicitly a HEURISTIC advisory, not a hygiene-safety claim (`ROADMAP.md`'s
  "Cross-contamination / hygiene knowledge" gap is real, separately scoped,
  and needs a genuinely different mechanism than "does a WASH step appear
  before a PEEL/CUT step") — but the missing step itself was real and
  worth actually fixing, not just noting. Worth recording as a concrete
  argument FOR building this kind of pre-flight tool: it found something a
  human reading the same two recipe files had not caught across several
  previous sessions of touching them.
- **The timing-vs-doneness advisory deliberately does NOT duplicate HACCP
  CCP enforcement** — that stays exactly where it already was, inside
  `applyAction`/`runRecipe`, unchanged. The new check is a different,
  narrower thing: comparing one INFORMATIONAL parameter against another
  (`yolkDoneness` vs. `durationSeconds`), something no safety mechanism
  was ever responsible for and that plain `runRecipe` would silently pass
  (a "soft" egg boiled for 700 seconds is not a HACCP violation — it's just
  not actually soft). Conflating the two would have quietly implied this
  new advisory carries safety weight it doesn't.

### Wiring `cut-dimensions.ts` + `heat-penetration.ts` into `recipe-explain.ts` — a gap the repo had already named itself

- **`crispy_french_fries.json`'s own `shapeConnectionNote` had already
  named this exact gap, unprompted, days before this session built the
  two pieces needed to close it**: "nothing connects CUT's shape state to
  PAR_FRY's/FRY's own durationSeconds... a schema-valid but real-world-
  wrong result... and nothing here would catch it." Worth noticing
  explicitly — this wasn't a novel idea, it was picking up a thread this
  repo had already tied off with a flag rather than a fix.
- **"Be flexible with measures" resolved into a real design choice, not a
  vague instruction to soften**: checked directly (not assumed) that no
  recipe today states how much oil is used, and neither `fry.json` nor
  `par-fry.json` has an oil-quantity parameter — so whether a slice heats
  from one face (shallow oil) or two (submerged) is genuinely unknown
  most of the time. Computing both and reporting the resulting [fastest,
  slowest] time window — rather than guessing one default — is what
  "flexible" turned into concretely: three real outcomes (below the
  fastest case = likely undercooked; inside the window = genuinely
  uncertain, said as such; above the slowest = clean), not a single
  false-precision verdict. `fry.json`'s own `topCookingMethod`
  (`basted`/`covered`/`untouched`) is a real, already-existing signal
  that narrows the window when a recipe actually sets it — composing
  with data that already existed rather than adding a new parameter.
- **Verified the mechanism against the real recipe it was built to agree
  with, not just synthetic fixtures**: `crispy_french_fries.json`'s
  julienne/163°C/270s/191°C/180s pipeline produces ZERO advisories —
  independently confirmed by hand-computing the actual seconds (163°C:
  8.5-34.2s; 191°C: 7.1-28.3s, both ranges comfortably below the recipe's
  own 270s/180s) before trusting the silence. A real, computed
  confirmation that the citation this recipe was built from (Kalogianni &
  Smith/Thermoworks) and the independently-built physics agree — not
  circular, since the physics module was never tuned to match this
  recipe's numbers, it was built from a completely different textbook
  method (Fourier conduction) and food-science figure (Choi-Okos cp,
  ThermoWorks/Idaho Potato Commission doneness temp).
- **A parallel to the earlier `egg_cooking`/`BOIL` finding, found the
  same way — by actually trying to construct the failing case, not by
  reasoning it should work**: the new "oilTempC too low to ever reach
  doneness" advisory fires correctly, but `fry.json`'s own `oilTempC`
  floor (120°C) and `par-fry.json`'s (145°C) are BOTH already comfortably
  above the potato doneness target (96-99°C) — meaning that branch is
  effectively unreachable via any schema-valid FRY/PAR_FRY recipe today,
  the same shape of "the CCP/advisory can never actually fire given the
  parameter's own range" gap found earlier this session for `BOIL`. Kept
  the check anyway (recipe-explain.ts doesn't itself enforce
  `numericRange`, so it's still reachable at the pre-flight layer even
  though `runRecipe` would separately reject the same malformed input for
  a different reason) — but named the limited real-world reach honestly
  rather than let a passing test imply more coverage than exists.
- **Checking which real recipes the new advisory actually covers today
  surfaced something else worth knowing, not assumed**: of this repo's
  potato-frying recipes, only `crispy_french_fries.json` uses the real
  `oilTempC` parameter — `salted-fried-potatoes.json`,
  `garlic-oil-potatoes.json`, `tortilla-de-patatas.json`, and
  `tortilla-de-betanzos.json` all still use the older, vaguer `heatLevel`
  enum instead. The new check correctly and silently skips all four (no
  real number, no real check possible) — not a false negative, but a
  concrete, honest measure of how much of this repo's own data the new
  mechanism actually reaches right now, worth recording rather than
  letting "wired in" imply "covers everything."

### `recipe-narrator.ts` — a presentation layer over existing modules, and a real bug testing against a second recipe caught

- **Asked to "read" a recipe back — structure, needs, inferences, created
  elements, verbs, timing — as a document. Correctly recognized as
  composition, not a new source of truth**: `recipe-explain.ts`
  (needs/advisories) and `recipe-runner.ts` (actual execution) already
  compute almost everything asked for; this module's only genuinely new
  computation is per-step capability RESOLUTION (which real instance
  satisfied a requirement, not just whether one could) and a stated-vs-
  unstated duration tally. Kept the module and the CLI script (`npm run
  narrate-recipe -- <recipe> <output.md|.json>`) generic — built and
  first tested against `garlic-oil-potatoes.json` specifically, but nothing
  in it is tuned to that one recipe.
- **Testing the generic function against a SECOND, more complex real
  recipe (`tortilla-de-patatas.json`, with `COMBINE`/`FLIP`) — not just
  the one it was built for — caught a real accuracy bug before it shipped**:
  `tortilla_mixture-4`'s tag `"flipped"` (added by a `FLIP` step AFTER
  the instance was spawned via `COMBINE`) was being reported as
  conservation-of-mass "inherited," when it demonstrably wasn't — inherited
  tags can only be present at spawn time, and `FLIP` runs two steps
  later. The single-recipe test case (`garlic-oil-potatoes.json`, whose
  only spawned instances — `potato_peel-1`, `garlic_peel-2` — are never
  targeted again) couldn't have caught this: it has no case where a
  spawned instance is later re-targeted, exactly this session's repeated
  lesson that testing against only the motivating example is not the
  same as testing the actual general claim.
- **Fixed by tracking whether a created instance is EVER targeted again
  anywhere in the sequence** (`everTargeted`, a simple set built while
  already walking the sequence for other reasons) **— confidently
  claiming "inherited" only when it's never re-targeted, always reporting
  the real final tags regardless.** Not a perfect fix (a re-targeted
  instance's tags might still be PARTLY inherited, partly added later,
  and this can't distinguish which) but an honest, conservative one:
  never claims a mechanism it can't verify, the same standard every
  other honesty caveat this session has held to. A dedicated regression
  test (`tests/recipe-narrator.test.ts`, the COMBINE+FLIP case) locks
  in the fixed behavior independent of `tortilla-de-patatas.json`'s
  actual current contents.

### `recipe-scaffold.ts` — a design decision made BEFORE writing it paid off immediately

- **Building this was fast specifically because the hard design question
  — "what does a scaffold even look like when the schema requires a
  non-empty `sequence`" — was already resolved while writing
  `AUTHORING.md` an hour earlier**, not discovered mid-implementation.
  `RecipeScriptSchema`'s `sequence.min(1)`/`initialInventory.min(1)`
  (`recipe.ts`) mean a truly empty scaffold can never be schema-valid —
  the design decision (write an intentionally-incomplete file, let
  `validate-recipe`'s own "sequence must contain at least 1 element" be
  the first real, correct alarm, rather than inventing a placeholder step
  that would just produce a different, less honest error) was made in
  the doc, then just implemented. Worth naming as a pattern: writing the
  user-facing doc FIRST surfaced the one real ambiguity a design would
  have hit anyway, cheaper than hitting it in code.
- **Manually running the tool immediately caught a real bug the design
  didn't anticipate**: a naive `entityIds.map((id, index) => ...-${index
  + 1})` produces `oil-2` for the second entity regardless of type,
  because the counter was global, not per-entity — inconsistent with
  every real `data/recipes/*.json` file, which numbers per entity type
  independently (`egg-1`, `oil-1`, `salt-1` all coexist starting at 1).
  Caught by literally reading the generated JSON, not by reasoning about
  the code — the same "run it for real before trusting it" discipline
  this whole session has repeated. Fixed with a per-entity counter map;
  locked in with a dedicated regression test (two potatoes + one oil ->
  `potato-1, oil-1, potato-2`) so it can't silently regress back to the
  global-counter version.
- **Verified the WHOLE loop, not just the new tool in isolation**:
  scaffolded a real file, hand-added one real `FRY` step (as an actual
  author would), ran `validate-recipe`, got a clean pass. The scaffold
  generator's own correctness doesn't matter if the file it produces
  can't actually be walked through the rest of `AUTHORING.md`'s loop to
  a valid recipe — checked that end-to-end path for real rather than
  stopping at "the generator's output matches the expected shape."

