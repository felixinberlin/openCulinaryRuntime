# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

This repository currently contains a single planning/spec document, `CLAUDE_DEV_CTX.md`, and no implementation code, package manifest, or test suite. There is nothing to build, lint, or run yet — do not invent commands or tooling for it. When source files are added, update this section (and add real build/lint/test commands) accordingly.

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

### Planned module layout

The spec calls for this file split (none of these files exist yet — create them following this layout rather than inventing a different structure):

| File | Purpose |
|---|---|
| `ingredient.ts` | Core entity/ingestion models: `EntitySchema` (static entities, ingredients vs. tools), `RecipeIngredientSchema` (instance portions, quantity as fraction/decimal union, localized translations), `ParsedIngredientSchema` (staging for unstructured regex-parser output before entity mapping) |
| `recipe-step.ts` | Execution sequence & HACCP safety: `EntityStateSchema` (entity id + state + quantity/unit), `CriticalControlPointSchema` (USDA HACCP phases/temp limits/holding times), `MechanicalActionSchema` (a step's tools/inputs/outputs) |
| `recipe.ts` | `RecipeScriptSchema` — the compiled script container: initial inventory state + linear execution sequence |
| `nutrition-extension.ts` | Optional pluggable metadata: `UsdaMealPatternContributionSchema` maps USDA school-lunch ounce/cup equivalents onto ingredients without bloating the core schema |
| `ocr-engine.ts` | `OcrValidationEngine` — walks a `RecipeScript`'s `sequence`, validates each `MechanicalAction` against current inventory (missing entities, required states, forbidden transitions via `INVALID_TRANSITIONS`), then applies it (consumes inputs, spawns/updates outputs) |
| `ocr-converter.ts` | Bi-directional compilers between OCR's structured model and flat formats: `compileToSchemaOrgIngredient` (structured → Schema.org string), plus the inverse Cooklang/regex tokenizer described below |

Reference implementations for `ocr-engine.ts` and `ocr-converter.ts` are given in full in `CLAUDE_DEV_CTX.md` — read that file before writing or modifying either module, and keep new code consistent with those signatures (`ValidationError`, `ValidationResult`, `OcrValidationEngine`, `compileToSchemaOrgIngredient`).

### Planned satellite projects

`CLAUDE_DEV_CTX.md` also scopes three follow-on assignments; check with the user which (if any) is in scope before generating code for them, since they imply different languages/runtimes than the core TS engine:

1. **Web scraper pipeline (Python / BeautifulSoup)** — fetch a recipe URL, extract `<script type="application/ld+json">`, tokenize the lossy `recipeIngredient` strings into quantity/unit/name/preparation, generate Cooklang text, compile to an executable OCR JSON script.
2. **Mobile reference app (React Native + Expo)** — 4-tab navigator: Discover (local recipe search), Community (feed with `FormData` uploads + `onUploadProgress`), Meal Plan (`.menu` schedule parsing), Profile (JWT with auto-logout on expiry).
3. **Home Assistant HACS component (Python)** — talks to a local CookCLI server at `http://localhost:9080`; sensors for expiring food / depleted pantry; populates HA Calendar from `.menu` schedules.

## A Gemini CLI config was found

`~/.gemini/settings.json` exists on this machine (user-level, not project-level). If you want its MCP servers/instructions/etc. available in Claude Code, reply `/import` to scan it.
