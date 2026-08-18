# LEARNINGS_TOOLING.md

Part of `LEARNINGS.md`'s theme split. This file: **authoring/CLI tooling
built on top of the engine** — `recipe-explain.ts`/`validate-recipe.ts`,
`recipe-narrator.ts`, `recipe-scaffold.ts`. Read `LEARNINGS.md`'s Core
section first — the verification/testing discipline it states applies
here too; this file only adds tooling-specific residue.

Pruned 2026-08-18 (was 202 lines) per `LEARNINGS.md`'s maintenance
discipline.

---

## 2026-08-15

### `recipe-explain.ts`/`validate-recipe.ts`

- **A CLI recipe validator turned out to be mostly a framing problem, not
  a new engine.** `engine.ts`/`recipe-runner.ts` already ARE the rule-
  driven validator; what was missing was narrower: accept a file path
  (not just a `data/recipes/` id), summarize a whole recipe's tool/
  ingredient needs UPFRONT (a missing tool otherwise only surfaces as a
  runtime rejection on the first step that hits it), and cross-check
  informational parameters (`yolkDoneness`) against the actual
  `durationSeconds` supplied (`applyAction` deliberately never reads them
  together). Recognizing what already existed kept this a small, additive
  module instead of a second engine.
- **Running the new validator against every real recipe (not just the
  first tried) found the SAME gap in two files**: `tortilla-de-patatas.json`
  AND `tortilla-de-betanzos.json` both went straight to PEEL on a raw
  potato, never washing first. Fixed same day; a concrete argument for
  building pre-flight tooling — it found something several prior sessions
  reading the same files hadn't caught.
- **The timing-vs-doneness advisory deliberately does NOT duplicate HACCP
  enforcement** — a "soft" egg boiled for 700s is not a HACCP violation,
  it's just not actually soft; conflating the two would have implied
  safety weight the check doesn't carry.

### Wiring `cut-dimensions.ts` + `heat-penetration.ts` into `recipe-explain.ts`

- **`crispy_french_fries.json`'s own `shapeConnectionNote` had already
  named this exact gap** (nothing connects CUT's shape to FRY's
  `durationSeconds`) days before the two pieces needed to close it existed
  — picking up a thread the repo had already tied off with a flag, not a
  novel idea.
- **"Be flexible with measures" resolved into computing BOTH bounds
  (shallow-oil vs. submerged heating) and reporting the [fastest, slowest]
  window** rather than guessing a default — checked directly that no
  recipe states oil quantity, so which face(s) heat is genuinely unknown
  most of the time. Three real outcomes: below the window = likely
  undercooked, inside = genuinely uncertain (said as such), above = clean.
- **Verified the mechanism against a real recipe by hand-computing the
  actual seconds first**: `crispy_french_fries.json`'s pipeline produces
  zero advisories, independently confirmed (163°C: 8.5-34.2s; 191°C:
  7.1-28.3s, both comfortably below the recipe's 270s/180s) — not
  circular, since the physics module was built from an unrelated
  textbook method and food-science figure, never tuned to this recipe.
- **An "oilTempC too low to ever reach doneness" advisory is correct but
  currently unreachable via any schema-valid recipe** — `fry.json`'s own
  floor (120°C) and `par-fry.json`'s (145°C) are both already above the
  potato doneness target (96-99°C). Kept the check anyway (still reachable
  at the pre-flight layer, which doesn't itself enforce `numericRange`)
  but named the limited real-world reach honestly.
- **Only `crispy_french_fries.json` uses the real `oilTempC` parameter** —
  the other four potato-frying recipes still use the older `heatLevel`
  enum, so the new advisory silently (and correctly) skips them. A
  concrete, honest measure of how much of the repo's own data a new
  mechanism actually reaches, worth recording rather than letting "wired
  in" imply "covers everything."

### `recipe-narrator.ts`

- **Testing a generic function against a SECOND, more complex real
  recipe** (`tortilla-de-patatas.json`, with `COMBINE`/`FLIP`) caught a
  real accuracy bug the single motivating recipe couldn't have: a tag
  added by `FLIP` two steps AFTER an instance was spawned via `COMBINE`
  was being reported as conservation-of-mass "inherited," when inherited
  tags can only be present at spawn time. Fixed by tracking whether a
  spawned instance is EVER re-targeted later in the sequence
  (`everTargeted`) and only claiming "inherited" when it's never
  re-targeted — an honest, conservative fix (can't distinguish partial
  inheritance from later addition), not a perfect one. Locked in with a
  dedicated regression test independent of the recipe's actual contents.

### `recipe-scaffold.ts`

- **The hard design question (what does a scaffold look like when the
  schema requires non-empty `sequence`) was resolved while writing
  `AUTHORING.md` an hour before implementation, not mid-build** — write
  an intentionally-incomplete file, let `validate-recipe`'s own "sequence
  must contain at least 1 element" be the first real alarm, rather than a
  placeholder step producing a different, less honest error.
- **A naive per-index counter produces `oil-2` for the second entity
  regardless of type** — every real recipe file numbers per entity type
  independently (`egg-1`, `oil-1`, `salt-1` all coexist starting at 1).
  Fixed with a per-entity counter map; caught by reading the generated
  JSON, not by reasoning about the code.
