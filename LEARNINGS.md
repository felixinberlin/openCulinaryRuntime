# LEARNINGS.md

A dated, append-only log of concrete things learned while building this engine —
patterns, gotchas, and *why* a design choice was made, not a changelog of *what*
files changed (that's `git log`). Read this before starting new work in this repo;
append a new dated entry when you learn something that would've saved you time if
you'd known it going in. Don't rewrite or delete old entries — append.

**Split into 4 theme files 2026-08-15** once this single file passed ~2,300 lines
and finding anything in it meant scanning the whole thing. Content was moved
verbatim (checked line-for-line — nothing rewritten, nothing dropped, nothing
duplicated), grouped by chronological date within each theme, and put into
whichever file matches what you're actually about to touch:

| File | Covers | Skip if you're touching... |
|---|---|---|
| [`LEARNINGS_ENGINE.md`](LEARNINGS_ENGINE.md) | `src/*.ts` architecture, invariants, engine bugs found/fixed, schema-shape tradeoffs, test infra, simulation-target research | pure food-science facts, CLI tools, or process/verification lessons |
| [`LEARNINGS_DOMAIN.md`](LEARNINGS_DOMAIN.md) | Culinary/food-science modeling — HACCP thresholds, heat/thermal physics, doneness tables, technique verbs (SIMMER, PAR_FRY, cut geometry, ...) and their citations | engine internals, CLI tools, or process lessons |
| [`LEARNINGS_TOOLING.md`](LEARNINGS_TOOLING.md) | Authoring/CLI tooling built on the engine — `recipe-explain.ts`/`validate-recipe.ts`, `recipe-narrator.ts`, `recipe-scaffold.ts` | engine internals, food science, or process lessons |
| [`LEARNINGS_PROCESS.md`](LEARNINGS_PROCESS.md) | Working method — triaging externally-supplied documents/bug reports, checking claims (including this repo's own design spec) before enforcing them, what a user's direct correction caught | engine internals, food science, or CLI tools |

**Before starting new work, skim the file(s) whose theme matches what you're
about to touch** — not necessarily all four. If a task spans themes (e.g. a
new engine mechanism that also needs a real citation), check both.

A change that doesn't obviously belong to one theme, or that's genuinely about
more than one, is fine to log wherever it reads best — these are a navigation
aid, not a strict taxonomy to agonize over. Link across files with a plain
relative reference (e.g. "see `LEARNINGS_ENGINE.md`'s ... entry") the same way
entries already cross-reference `ROADMAP.md`/`REFERENCES.md`.
