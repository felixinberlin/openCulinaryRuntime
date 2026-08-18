# `src/cooklang.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Cooklang import/export — `ROADMAP.md` Phase 5, `ocr-converter.ts` as
planned (`CLAUDE.md`'s module-layout table; not a file named
`ocr-converter.ts` itself, same "planned name diverged" pattern as
`heat-source.ts`/`place.ts`/etc.). Scoped exactly along the boundary
`AUTHORING.md` §2 already drew, before any code existed:

1. **Parsing Cooklang's own syntax is mechanical** — `@ingredient{qty%unit}`,
   `#cookware{}`, `~timer{qty%unit}`, `>> metadata: value`, `-- comments`,
   `[- block comments -]`. Real grammar, no judgment calls, built here as
   `parseCooklang`.
2. **Turning step PROSE into this repo's typed `actionId`/parameter shape
   is NOT mechanical** — that's the free-text -> structured-intent
   translation `ENGINE_INVARIANTS.md` #10 scopes to an LLM or human
   proposing a DRAFT, never asserted as already-valid. This module does
   NOT attempt it: `CooklangStep.text` keeps the step's prose verbatim
   (tokens inline, exactly as authored) for that translator to consume
   later — it is not itself a `RecipeStep`.
3. `importCooklangDraft` closes the one piece of "1" that's genuinely
   useful before "2" exists: matching every `@token` against a real
   entity's `Entity.cooklang.canonicalToken` and proposing
   `RecipeInstance[]` for `initialInventory` — a best-effort MATCH, not a
   validation claim (unresolved tokens are named, not silently dropped; a
   caller still owes the result a real `validate-recipe` pass before
   treating it as usable, same as any other hand-authored draft).
4. `exportToCooklang` is the reverse and fully mechanical in the other
   direction: an OCR `RecipeScript` already carries everything Cooklang
   syntax needs (entity tokens, quantities, action names, durations) — no
   prose synthesis, so no LLM-in-the-loop problem. It deliberately does
   NOT invent natural-language sentences; each step line is the action's
   own `names.en` plus its Cooklang-tokenized references and a plain
   parameter list, not literary prose.

**Explicitly NOT built here** (real, named gaps, matching this repo's own
"gaps are named, not hidden" convention): Cooklang scaling multipliers.
`ingredient.ts`'s own `QuantitySchema` doc comment already states no
recipe-scaling engine exists anywhere in this repo to scale AGAINST —
`spiceLock` is PRESERVED faithfully round-trip (the `=` prefix survives
import -> export -> import unchanged) but never multiplied, because
nothing here multiplies anything yet.

## `CooklangQuantity`

- `raw`: Raw amount text exactly as authored, e.g. "1/2", "200" — kept verbatim because not every Cooklang amount is a plain decimal.
- `amount`: Parsed numeric value when `raw` is an integer, decimal, or simple "a/b" fraction; undefined for non-numeric amounts like "some".

## `CooklangIngredientRef`

- `token`: The token after `@`, e.g. "sal" or "aceite de oliva" (multi-word names require the `{}` form, same rule real Cooklang uses — see `parseCooklang`'s notes below for the exact, bounded grammar this module supports).
- `spiceLock`: True for a `=`-prefixed amount, e.g. `@sal{=1%tsp}` — `CLAUDE_DEV_CTX.md`'s "spice lock": this amount does not scale linearly with the rest of the recipe.

## `CooklangTimerRef`

- `name`: Label, e.g. "rest" in `~rest{5%minutes}`; undefined for the bare `~{5%minutes}` form.

## `CooklangStep`

- `text`: The step's prose with every `@`/`#`/`~` token still inline, exactly as authored — Cooklang doesn't separate "text" from "references" and neither does this. Not a `RecipeStep`; see the file-level notes above, point 2.
- `section`: The most recent `= Section =` heading above this step, if any.

## `CooklangDocument`

- `metadata`: `>> key: value` lines, keyed by trimmed `key`.

## `TOKEN_RE`

Matches, in order per scan position:

1. Braced form: marker + a run of words/spaces immediately followed by
   `{...}` — the run can only include `[A-Za-z0-9_'-]` and single spaces,
   so it can never cross into another token's own `@`/`#`/`~`/`{`/`}`
   characters. This is what makes multi-word names unambiguous without a
   hand-rolled lookahead scanner: the name run structurally cannot
   swallow a LATER, unrelated token's braces, because reaching that other
   token's marker character ends the run first. The one real limitation
   (documented, not hidden): a stray `{...}` later in the same line with
   only plain words/spaces/hyphens between it and an earlier bare
   `@token` WILL be misread as that token's own braces — the same
   authoring discipline real Cooklang requires (write `{}` immediately
   after the name, nothing else in between).
2. Bare form (ingredient/cookware only, no timer): marker + one word, no
   braces, no quantity.

## `parseCooklang`

Parses real Cooklang source text into a structured `CooklangDocument`.
Deliberately does not attempt to resolve tokens against entities or
produce a `RecipeScript` — see the file-level notes above.

Step boundary rule (a stated simplification, not part of the official
grammar): a step is one blank-line-separated paragraph of non-metadata,
non-comment, non-section-heading lines, joined with a single space —
closer to how Cooklang recipes are actually authored (a step can wrap
across lines) than "one line = one step" would be.

## `UNIT_ALIASES`

g/kg/ml/l/tsp/tbsp/cup/count plus common written-out aliases actually
seen in authored Cooklang text — mapped to `QuantitySchema`'s closed unit
enum (`ingredient.ts`). Anything else is left unmapped rather than
guessed at.

## `normalizeToken`

Exported for `cooklang-translate.ts` — the same token-normalization rule
import resolution uses is also how a translator matches a step's
ingredient references back to `importCooklangDraft`'s own
`proposedInventory` ids, without re-deriving a second normalization rule
that could silently drift from this one.

## `CooklangImportDraft`

- `resolvedIngredients`: One entry per DISTINCT token (case/whitespace-normalized) that matched a real entity's `cooklang.canonicalToken`, OR — failing that — an entity's bare `id` (case-insensitively). The `id` fallback mirrors `exportToCooklang`'s own fallback for entities with no `cooklang` field (`cooklangToken`): without it, exporting such an entity and re-importing the result would silently fail to round-trip, which would make the fallback a one-way lossy hole rather than a documented, symmetric approximation.
- `unresolvedTokens`: Distinct tokens that matched no entity — named explicitly rather than silently dropped, this file's own version of `REFERENCES.md`'s "don't hide the gap" discipline applied to import coverage.
- `proposedInventory`: A DRAFT `RecipeInstance[]` for `RecipeScriptSchema.initialInventory`, built only from resolved ingredients. `state` defaults to `"raw"` — Cooklang text never encodes an entity's physical state, so this is a guess a human/`validate-recipe` must confirm, not a fact this module derived. Never asserted valid on its own — see the file-level notes above, point 3.

## `importCooklangDraft`

Parses `source` and matches every ingredient token against `entities`'
`cooklang.canonicalToken` (case/whitespace-normalized). Produces a DRAFT
only — see the file-level notes above.

## `exportToCooklang`

Exports an OCR `RecipeScript` to Cooklang text. Fully mechanical — no
prose synthesis (see the file-level notes above, point 4): each step line
is the action's own `names.en`, its Cooklang-tokenized instance
references, and a plain `key: value` parameter list, not literary prose.

`spawnedEntityIds` (optional) should be `RecipeRunResult.spawnedEntityIds`
(`recipe-runner.ts`) when the caller has one, so a step targeting an
instance SPAWNED mid-recipe (e.g. a `SEPARATE` output) still resolves to
a real `@token` instead of a raw instance id — the same
compose-with-real-ground-truth precedent `execution-bounds.ts`/
`in-progress-action.ts` already established, not a second, static
re-derivation of the spawn-naming scheme. Omit it and spawned-instance
references fall back to their bare instance id, named as a limitation
rather than guessed at.
