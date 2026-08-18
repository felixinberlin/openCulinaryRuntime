# `src/recipe-narrator.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

A human-readable "read this recipe back to me" narration — added
2026-08-15, directly answering a request to explain a recipe's structure,
needs, inferences, created elements, verbs, and timing "in a nice
document." Deliberately NOT a new source of truth: every fact here comes
from composing two modules that already exist and are already the
authority on their own piece — `recipe-explain.ts`'s `explainRecipe`
(pre-flight needs/advisories) and `recipe-runner.ts`'s `runRecipe`
(actual execution, the ONE ground-truth source for what a recipe does).
This module adds narrative framing and one new piece of real information
neither of those computes: PER-STEP capability resolution (not just "is
isFryingMedium satisfiable at all" but "which actual instance satisfied
it, this step") and a stated-vs-unstated active duration tally.

Honesty caveat, stated once here rather than scattered: the duration
tally is a SUM OF STATED `durationSeconds` VALUES, not a real
elapsed-time simulation — wash/peel/cut/salt steps have no
`durationSeconds` parameter at all in this vocabulary (matching this
repo's own established assumption that quick prep steps aren't timed),
and a step CAN omit `durationSeconds` even when the action supports it
(this repo's own `garlic-oil-potatoes.json` does exactly this for its
potato FRY step). Reported as a lower bound with the untimed steps named
explicitly, not implied to be the recipe's real total time.

## `SpawnedElement`

- `state`: The instance's tags in the FINAL inventory — always accurate, regardless of how they got there.
- `confidentlyInheritedTags`: Non-empty ONLY when `tags` above can be confidently attributed to conservation-of-mass tag inheritance at spawn time (engine.ts, 2026-08-12) — i.e. this instance id is NEVER targeted by any later step in the sequence, so nothing could have added a tag to it after it was created. When an instance IS re-targeted later (e.g. a COMBINE-spawned `tortilla_mixture` that a later `FLIP` step also targets), its final tags may include ones that later step added itself — reporting those as "inherited" would be a real, checkable inaccuracy, not a rounding error. Left empty rather than guessed in that case; `tags` above still reports the real final value.

## `RecipeNarration`

- `capabilityResolutions`: What the system inferred to make each ingredient-capability requirement work — the "which real instance actually satisfied this" narrative `explainRecipe`'s own needed/missing summary doesn't provide.
- `verbsUsed`: Unique verbs, in order of first appearance in the sequence.
- `statedActiveDurationSeconds`: Sum of every step's `durationSeconds`, when stated — see the file-level notes above for why this is a lower bound, not a real elapsed-time total.
- `stepsWithUnstatedDuration`: Verb + target labels for steps that COULD have stated a duration (the action has a `durationSeconds` parameter) but didn't, named explicitly rather than silently folded into the tally as zero.
- `allergenSummary`: `explainRecipe`'s `allergenSummary` — the FDA "Big 9" allergens this dish's `initialInventory` carries (`ingredient.ts`'s `AllergenSchema`, `ROADMAP.md`'s "Allergens" gap). Surfaced here, not just in `RecipeExplanation`, so a narrated/read-back recipe says "this dish contains egg" the same way it already says what tools it needs.
- `storageSummary`: `explainRecipe`'s `storageSummary` — real, cited "how long is this safe/good for" guidance for whichever `initialInventory` items have it, at their AUTHORED starting state (`ingredient.ts`'s `StorageLifeSchema`, `ROADMAP.md`'s "Storage/shelf-life common knowledge" gap). Same "surface it in the read-back document, not just the machine-facing explanation" reasoning as `allergenSummary` above.

## `narrateRecipe`

The `entityIdForInstance` lookup: initial inventory ids resolve directly;
ids spawned mid-recipe (e.g. potato_peel-1) are recovered from the run's
own final inventory, the same way `recipe-runner.ts`'s own log already
knows about them — no re-deriving `spawnCounter` logic here.

`everTargeted`: every instance id ever named as a target or secondary
target, ANYWHERE in the sequence — used to gate the tag-inheritance claim.
An id that's ONLY ever the thing a step spawns (never itself targeted
afterward) can safely be said to carry only its at-spawn (inherited)
tags; one that's targeted again later (e.g. FLIP on a COMBINE-spawned
tortilla_mixture) may have gained tags from THAT step too — conflating
the two would misreport a later-added tag (`FLIP`'s `addsTag: "flipped"`)
as if conservation-of-mass put it there, a real bug this file's own test
recipes caught by comparing against `tortilla-de-patatas.json`, a more
complex real case than `garlic-oil-potatoes.json` alone exercised.

Created elements: everything in the final inventory that ISN'T in the
initial inventory — i.e. actually spawned during the run, not just
present from the start. See `SpawnedElement`'s own notes above for why
`confidentlyInheritedTags` is gated on `everTargeted` rather than just
reporting every tag as "inherited."

The capability-resolution loop: `break` on the first matching ingredient
— one real instance is enough to explain the resolution.

## `renderNarrationMarkdown`

Renders a `RecipeNarration` as a readable Markdown document. Pure
presentation — every fact it prints was already computed by
`narrateRecipe`, nothing is derived here.
