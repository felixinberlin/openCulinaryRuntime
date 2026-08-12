# OCR Roadmap

Derived from `CLAUDE_DEV_CTX.md`. Phases are ordered by dependency (each phase's schemas/types are needed by the next), not by calendar date. The core engine (Phases 0–4) is TypeScript; the three satellite assignments (Phases 5–7) are separate runtimes/languages and can be reprioritized independently once the core is stable.

## Phase 0 — Project scaffolding
Nothing but the spec exists yet. Before any schema code lands:
- [ ] `package.json` + TypeScript toolchain (tsconfig, build script)
- [ ] Pick and add the schema/validation library implied by the `*Schema` naming (e.g. Zod) — confirm choice before generating code
- [ ] Test runner setup (unit tests per module)
- [ ] Lint/format config
- [ ] Update `CLAUDE.md`'s "Repository state" section once real commands exist

## Phase 1 — Core entity & ingestion models (`ingredient.ts`)
The vocabulary layer everything else depends on.
- [ ] `EntitySchema` — static entities; ingredients vs. reusable cookware/tools kept separate
- [ ] `RecipeIngredientSchema` — instance portion sizes, quantity as fraction/decimal union, localized translations
- [ ] `ParsedIngredientSchema` — staging shape for raw regex-parser output prior to entity mapping (needed by Phase 5's scraper)

## Phase 2 — Execution sequence & safety models (`recipe-step.ts`)
Depends on Phase 1's entity/state vocabulary.
- [ ] `EntityStateSchema` — entity id + active physical state + quantity/unit
- [x] `CriticalControlPointSchema` — USDA HACCP phases, critical temperature limits (°F), holding times — implemented in `src/thermal.ts` (°C, not °F as the spec literally says, for consistency with the rest of the codebase's units; instantaneous + held-time two-point model, not the Food Code's full multi-point curve — see the file's doc comment). Data: `data/ccps/egg_cooking.json`.
- [ ] `MechanicalActionSchema` — a step: tools used, inputs consumed, outputs generated

## Phase 3 — Compiled recipe container (`recipe.ts`)
Depends on Phases 1–2.
- [ ] `RecipeScriptSchema` — initial inventory (kitchen setup) + linear `sequence` of `MechanicalAction`s

## Phase 4 — Validation engine (`ocr-engine.ts`)
Depends on Phase 3. This is where the "strict simulation heuristics" from the spec become enforced code.
- [ ] `OcrValidationEngine` class, ported from the reference implementation in `CLAUDE_DEV_CTX.md`
- [ ] `INVALID_TRANSITIONS` forbidden-state-transition matrix (e.g. can't peel something already boiled; can't chop something mashed/liquid)
- [ ] Requirement checks (tool/entity present, required state matches) before a step executes
- [x] Conservation of mass/entities on `applyStep`: inputs decremented/removed from inventory; outputs merged or spawned (e.g. "separate" destroys the parent, spawns disjoint children) — implemented as `ActionOutputsSchema.destroysTarget` (action.ts) + `ExecutionResult.destroyed` (engine.ts), consumed by `recipe-runner.ts`; see `data/actions/separate.json` + `egg.json`/`egg_yolk.json`/`egg_white.json`/`egg_shell.json`. Scoped to this explicit per-action opt-in, not a general inventory-quantity decrement system.
- [x] HACCP CCP enforcement wired into thermal steps (minimum hold temperature + duration) — `EntitySchema.criticalControlPointsByAction` (ingredient.ts) + `applyAction`'s `ccps` param (engine.ts): a `durationSeconds` parameter below the CCP's `heldSeconds` throws, or warns instead when `advisoryOnly` (the FDA Food Code's actual permitted-with-disclosure posture for e.g. a runny egg yolk). Does NOT simulate heat transfer/internal temperature — see engine.ts's doc comment for the stated thin-food assumption this rests on. Demo: `npm run demo:egg-haccp`.
- [ ] Unit tests per forbidden-transition rule and per HACCP threshold — still just demo scripts + validate.ts's schema/cross-ref checks, no assertion-based test runner in this repo yet.

## Phase 5 — Bi-directional compilers (`ocr-converter.ts`)
Depends on Phase 4 types.
- [ ] `compileToSchemaOrgIngredient` and the rest of the OCR → Schema.org (flat, lossy) export path — treat this as one-directional, not round-trippable
- [ ] Cooklang parser: ingest Cooklang text as the primary human-writable format
- [ ] Preserve Cooklang scaling multipliers and spice locks (`=`-prefixed quantities that don't scale linearly)
- [ ] Cooklang ⇄ OCR JSON round-trip tests

## Phase 6 — Nutrition extension (`nutrition-extension.ts`)
Optional/pluggable; depends on Phase 1's ingredient model but must not be required by core validation.
- [ ] `UsdaMealPatternContributionSchema` — maps USDA school-lunch oz/cup equivalents (grains, protein, vegetables) onto ingredients without bloating the core schema

## Phase 7 — Satellite: Web scraper pipeline (Python / BeautifulSoup)
Independent of the TS engine's runtime, but its output must satisfy Phases 1–3's schemas (via a Python↔JSON boundary, or re-validated once ported into the TS engine).
- [ ] Fetch a recipe URL, extract `<script type="application/ld+json">`
- [ ] Regex/NLP tokenizer: lossy `recipeIngredient` strings → `quantity` / `unit` / `name` / `preparation`
- [ ] Auto-generate Cooklang text from tokenized ingredients
- [ ] Compile Cooklang output into an executable OCR JSON script (consumes Phase 5's Cooklang parser, or a Python equivalent)

## Phase 8 — Satellite: Mobile reference app (React Native + Expo)
Depends on a stable OCR JSON shape (Phase 3+) to render/consume; needs a backend for Community uploads and auth (not yet specified — flag as an open dependency).
- [ ] 4-tab navigator scaffold
- [ ] **Discover** — real-time search of local recipe folders with interactive cooking steps
- [ ] **Community** — feed with async `FormData` recipe uploads + `onUploadProgress` hook
- [ ] **Meal Plan** — parse and map `.menu` schedules
- [ ] **Profile** — JWT handling with automatic logout on expiry

## Phase 9 — Satellite: Home Assistant HACS component (Python)
Depends on a running CookCLI server and `.menu` file format (assumed defined elsewhere — flag as an open dependency if not yet specified).
- [ ] Interface with local CookCLI server at `http://localhost:9080`
- [ ] Sensors: expiring food, depleted pantry items
- [ ] Auto-populate HA Calendar cards from parsed `.menu` schedules

## Open dependencies / unknowns to resolve before later phases
- Schema/validation library choice (Zod assumed from `*Schema` naming — not stated explicitly)
- `.menu` file format spec (referenced by Phases 8 & 9, not defined in `CLAUDE_DEV_CTX.md`)
- CookCLI server API surface (Phase 9)
- Community backend/auth service the mobile app talks to (Phase 8)
