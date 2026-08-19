# `src/schema-org.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

`ROADMAP.md` Phase 5's last unbuilt bullet, `ocr-converter.ts` as planned (`CLAUDE.md`'s module-layout table — not a file named `ocr-converter.ts` itself, same "planned name diverged" pattern as `heat-source.ts`/`place.ts`/`cooklang.ts`/etc.). `CLAUDE.md`'s own stated rule for this direction: "Schema.org JSON-LD is a flat target for search-engine indexing only. Conversions from rich, nested OCR JSON to Schema.org must be one-directional (lossless OCR → lossy Schema.org), not treated as a round-trippable source of truth." This module holds to that literally — there is no `importFromSchemaOrg` here, deliberately, and none should be added under this file. A lossy Schema.org string can't be parsed back into a typed `Quantity`/`state`/`actionId` without guessing; that's the exact same free-text → structured-intent problem `ENGINE_INVARIANTS.md` #10 already scopes to an LLM/human, not a mechanical function — see `cooklang-translate.ts` for what that translator actually looks like when it IS built, on the Cooklang side.

`CLAUDE_DEV_CTX.md`'s own literal sketch of `compileToSchemaOrgIngredient` (kept in that file verbatim as the design record) operates on a fictional `IngredientModel` (`rawString`/`quantity`/`unit`/`name`/`preparation`) that predates this repo's real `Entity`/`Quantity`/`RecipeInstance` schemas — this module keeps the function's name and its one-line-lossy-string contract, but takes the real types instead of reimplementing a parallel, simpler ingredient shape just to match the original sketch literally.

Two real, honest scope boundaries, named rather than smoothed over:

1. **`compileToSchemaOrgRecipe` populates only `name`/`recipeIngredient`/`recipeInstructions`/`tool`.** Schema.org's `Recipe` type (a subtype of `HowTo`) also has `recipeYield`, `prepTime`, `cookTime`, `totalTime`, and `nutrition` — none of those are populated here. `RecipeScript` has no yield/serving-count field at all; `prepTime`/`cookTime`/`totalTime` would require summing `params.durationSeconds` across steps, which is a real number but a fundamentally MISLEADING one on its own — it silently drops passive/parallel time (`dag-scheduler.ts`'s whole reason for existing is that steps aren't always sequential in wall-clock time) and every non-`durationSeconds`-bearing step (PEEL, CUT — genuinely fast, but not zero seconds either). Fabricating a `totalTime` from a sum that's known to be wrong would be a worse failure than omitting the field, the same standard this repo already holds itself to (`ROADMAP.md`'s own "Why this exists" section). `nutrition` is deferred to Phase 6 (`nutrition-extension.ts`, not started) — the raw ingredient is there (`Entity.composition.nutrientsPer100g`) but summing it per-recipe honestly needs the same yield/quantity-resolution work Phase 6 already scopes, not a shortcut duplicated here.
2. **`tool` (inherited from `HowTo`, not `Recipe`'s own dedicated property list) is populated from `RecipeScript.availableTools`** — a real, direct field mapping, not a guess. Included because it's free and honest, not because Phase 5 asked for it by name.

## `IMPRECISE_PREFIX`

Maps `Quantity`'s `imprecise` kind's `descriptor` enum (`pinch`/`dash`/`handful`/`splash`/`to_taste`) to a natural-language prefix. `to_taste` is handled separately as a SUFFIX ("salt, to taste") rather than forced into this map's prefix shape ("to_taste salt" reads wrong) — a real, deliberate asymmetry in the descriptor set, not an oversight.

## `quantityPhrase`

The `relative` `Quantity` kind (a baker's-percentage-style ratio, e.g. "2% of flour by mass" for yeast) has no absolute amount to print — there is nothing else honest to do with it as a plain ingredient-list string except state the ratio and what it's relative to. `approxRangeGrams` on the `imprecise` kind is deliberately NOT surfaced here even though it exists on the schema: `ingredient.ts`'s own doc comment already calls it "non-authoritative reference range only," and repeating a non-authoritative number in an export string risks it being read as more certain than it is.

## `compileToSchemaOrgIngredient`

Appends the instance's `state` as a trailing preparation note ("potato, peeled") only when it's not the generic starting `"raw"` — mirrors how a real Schema.org `recipeIngredient` string conventionally carries a comma-separated preparation clause, without inventing a separate `preparation` field this repo's `RecipeInstance` doesn't have. `state` here is `RecipeInstance.state` — the instance's state at the point being compiled (typically `initialInventory`, the start of the recipe), not a mid-recipe state; this function takes it as a plain parameter rather than resolving it itself so a caller compiling a byproduct's post-spawn state (not currently done by `compileToSchemaOrgRecipe`, which only reads `initialInventory`) isn't blocked from doing so later.

## `stepText`

Fully mechanical, same "no prose synthesis" contract as `exportToCooklang`'s own step-line builder, which this deliberately mirrors in shape (verb + target + secondary + available-ingredients + duration + a plain parenthetical parameter list) — not a second, independently-invented step-rendering scheme. Differs from `exportToCooklang`'s output on purpose: plain English ("Fry the potato.") instead of Cooklang syntax (`Fry @patata.`), since a Schema.org `HowToStep.text` is read by a search engine and a human, never re-parsed by this repo.

## `compileToSchemaOrgRecipe`

Reuses `instanceEntityId` + optional `spawnedEntityIds` composition exactly as `exportToCooklang` does — same real-ground-truth-composition precedent as `execution-bounds.ts`/`in-progress-action.ts`/`cooklang.ts`, not a second, independently-drifting resolution scheme. An entity id that resolves to nothing in `entities` falls back to the raw id string (named, not guessed) — the same convention every other export/compile path in this repo already uses.
