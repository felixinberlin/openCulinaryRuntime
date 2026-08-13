# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Past the planning-only stage: `src/` has a working schema/engine (`ingredient.ts`,
`action.ts`, `engine.ts`, `recipe.ts`, `recipe-runner.ts`, `registry.ts`, `thermal.ts`),
`data/` has real entities/actions/recipes/CCPs (potato, egg + its byproducts, garlic,
alioli variants, ...), and `scripts/` has runnable demos plus `validate.ts`. Commands:
`npm test` (`node:test` unit suite over `tests/*.test.ts` — synthetic fixtures against
`engine.ts`/`action.ts`/`ingredient.ts`/`thermal.ts`, no `data/*.json` dependency),
`npm run validate` (schema + cross-reference check over the real `data/*.json` — the
authoritative integration check), `npm run demo:<name>` (see `package.json` for the
full list), `npm run recipe -- <id>`, `npx tsc -p . --noEmit` (typechecks `src`,
`scripts`, AND `tests` — pre-existing `TS5097` import-extension noise across the repo
is unrelated to any change; filter with `grep -v TS5097`). `npm test` and
`validate.ts` are complementary, not alternatives (see `LEARNINGS.md` 2026-08-13) —
run both, plus every demo and every recipe, after any change to `src/`, not just the
new thing.

**Before starting work, read `LEARNINGS.md`.** After learning something that would've
saved time going in — a schema constraint, an engine gotcha, a design tradeoff and why
— append a dated entry there. Don't just re-derive the same surprise next session, and
don't let this section (or any other doc here) go stale the way this one just did:
when the repo's real shape changes, update the doc that describes it in the same
change, not "later."

## What this repo is for

`CLAUDE_DEV_CTX.md` is the design blueprint for the **Open Culinary Runtime (OCR)**, a project that models recipes as deterministic, executable state machines (an Entity-Component-System, not static text) rather than prose instructions. Treat it as the system prompt/spec for any code written in this repo — new files should follow its architecture rather than a generic recipe-app design.

### Core architectural pillars

- **Entities ("What")** — physical, reusable objects. Consumable ingredients (e.g. "potato") are modeled separately from reusable cookware/utensils (e.g. "frying-pan", "chef-knife").
- **States ("Physical conditions")** — observable conditions of an entity (e.g. "raw", "peeled", "chopped", "boiled", "liquid").
- **Actions ("Changes")** — transformations that act as transition boundaries: they consume inputs in State A and yield outputs in State B.
- **Parameters ("Culinary details")** — quantitative modifiers: physics, timing (seconds), and safety-critical thresholds (HACCP).

### Simulation rules that any engine code must enforce

- **Conservation of mass/entities** — executing a step (e.g. "separate") destroys the parent entity in the inventory and spawns disjoint child entities in its place (e.g. "egg_yolk" + "egg_white").
- **Physical feasibility restrictions** — block state transitions that are physically impossible (e.g. can't "peel" something already "boiled"; can't "chop" something "mashed" or "liquid"). See the `INVALID_TRANSITIONS` map in the reference engine below for the canonical forbidden-transition table.
- **HACCP critical control points** — thermal steps must enforce food-safety thresholds (e.g. minimum internal temperature of 135°F held for at least 15 seconds).
- **Cooklang interoperability** — Cooklang is the primary human-writable authoring format. Preserve backward compatibility with its scaling multipliers and spice locks (quantities prefixed with `=` do not scale linearly).
- **Schema.org is a lossy export target** — Schema.org JSON-LD is a flat target for search-engine indexing only. Conversions from rich, nested OCR JSON to Schema.org must be one-directional (lossless OCR → lossy Schema.org), not treated as a round-trippable source of truth.

### Module layout — as planned vs. as actually built

`CLAUDE_DEV_CTX.md`'s original file split didn't survive contact with incremental,
additive real work; the actual layout diverged under different names. Both are
listed so neither this file nor `CLAUDE_DEV_CTX.md` alone gives a false picture:

| Planned (`CLAUDE_DEV_CTX.md`) | What actually exists | Notes |
|---|---|---|
| `ingredient.ts` — `EntitySchema`, `RecipeIngredientSchema`, `ParsedIngredientSchema` | `src/ingredient.ts` — `EntitySchema` only | `RecipeIngredientSchema`/`ParsedIngredientSchema` not built; nothing consumes raw scraper output yet (Phase 5/7 still unstarted) |
| `recipe-step.ts` — `EntityStateSchema`, `CriticalControlPointSchema`, `MechanicalActionSchema` | Split across `src/engine.ts` (`Instance` ≈ `EntityStateSchema`), `src/action.ts` (`Action`/`ActionOutputsSchema` ≈ `MechanicalAction`), `src/thermal.ts` (`CriticalControlPointSchema`, built as named) | No single `recipe-step.ts` — the concept fragmented across three files as the engine grew organically |
| `recipe.ts` — `RecipeScriptSchema` | `src/recipe.ts` — built close to as planned | plus `src/recipe-runner.ts` (not in the original plan) actually walks a `RecipeScript` against `engine.ts` |
| `nutrition-extension.ts` | Not built | |
| `ocr-engine.ts` — `OcrValidationEngine`, `INVALID_TRANSITIONS` | `src/engine.ts`'s `applyAction` covers part of this (capability/tool/state-prerequisite checks, conservation of mass, HACCP + `SafetyPolicy`) but there is **no `INVALID_TRANSITIONS` forbidden-transition matrix** — still `ROADMAP.md` Phase 4, unchecked | Also not a class named `OcrValidationEngine` — a plain function |
| `ocr-converter.ts` — `compileToSchemaOrgIngredient`, Cooklang parser | Not built | `cooklang` fields exist on entities (`canonicalToken`, `spiceLock`) but nothing reads/writes actual Cooklang text yet |

`src/registry.ts` (loading `data/*.json` by directory into typed `Map`s) also isn't
in the original plan — the whole `data/` directory of JSON files, validated against
these schemas rather than defined in TypeScript, is itself a divergence from
`CLAUDE_DEV_CTX.md`'s framing, though a compatible one.

Read `CLAUDE_DEV_CTX.md` for the *concepts* (still accurate) — verify file/symbol
names against the table above or `ROADMAP.md`, not against that file's original
naming, before assuming something exists.

### Planned satellite projects

`CLAUDE_DEV_CTX.md` also scopes three follow-on assignments; check with the user which (if any) is in scope before generating code for them, since they imply different languages/runtimes than the core TS engine:

1. **Web scraper pipeline (Python / BeautifulSoup)** — fetch a recipe URL, extract `<script type="application/ld+json">`, tokenize the lossy `recipeIngredient` strings into quantity/unit/name/preparation, generate Cooklang text, compile to an executable OCR JSON script.
2. **Mobile reference app (React Native + Expo)** — 4-tab navigator: Discover (local recipe search), Community (feed with `FormData` uploads + `onUploadProgress`), Meal Plan (`.menu` schedule parsing), Profile (JWT with auto-logout on expiry).
3. **Home Assistant HACS component (Python)** — talks to a local CookCLI server at `http://localhost:9080`; sensors for expiring food / depleted pantry; populates HA Calendar from `.menu` schedules.

## A Gemini CLI config was found

`~/.gemini/settings.json` exists on this machine (user-level, not project-level). If you want its MCP servers/instructions/etc. available in Claude Code, reply `/import` to scan it.
