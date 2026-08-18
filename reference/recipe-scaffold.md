# `src/recipe-scaffold.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The scaffold generator `AUTHORING.md` §3 named as a real, unbuilt gap —
closed 2026-08-15. Produces a STARTER `RecipeScript`-shaped object, not a
valid one: `RecipeScriptSchema` requires `sequence.min(1)` (`recipe.ts`),
so a scaffold with an empty `sequence` is intentionally schema-invalid
the moment it's written. That's deliberate, not an oversight — running
`validate-recipe` against a fresh scaffold producing "sequence must
contain at least 1 element" is the exact same real, honest first step
`AUTHORING.md`'s own worked example walks through, not a special case
this tool needs to avoid. This module only ever WRITES the file; it never
calls `RecipeScriptSchema.parse` on its own output, on purpose.

`initialInventory` (which DOES require `.min(1)` too) is filled from real
entity ids the caller supplies — those must resolve to real entities in
`data/entities/*.json`, checked here directly (throws, not a
silently-empty scaffold) rather than deferring that check to the first
`validate-recipe` run, since an unknown entity id is a typo the scaffold
generator itself can catch immediately.

## `RecipeScaffoldInput`

- `slug`: Recipe id AND the basis for `names.en` — same convention every `data/recipes/*.json` file already uses (kebab-case filename -> snake_case id -> Title Case display name). Pass a filename stem (e.g. "quick-fried-potatoes"), not a pre-built id.
- `entityIds`: Real entity ids for `initialInventory` — validated against the loaded entity catalog, not assumed to exist.

## `RecipeScaffold`

A plain object matching `RecipeScriptSchema`'s SHAPE — deliberately typed
as `unknown`-friendly plain data, not `RecipeScript`, since an empty
`sequence` makes it schema-invalid by construction; treating it as a real
`RecipeScript` would be a type lie.

## `buildRecipeScaffold`

The `countPerEntity` numbering: every existing `data/recipes/*.json` file
numbers instance ids PER ENTITY TYPE, independently starting at 1
(egg-1, oil-1, salt-1 all coexist) — NOT one shared counter across every
entity in the recipe. A single global counter would produce "oil-2" for
the second entity regardless of type, inconsistent with that convention
(and with `recipe-runner.ts`'s own `spawnCounter`, which this local id
space is meant to read naturally alongside).

The starting-state default: `possibleStates[0]` is used as a documented
DEFAULT, not a claim that it's always the right starting state — most
entities list "raw"/"cold" first, but a scaffold author should still
check it against the real entity file, same honesty standard as every
other default value in this repo.
