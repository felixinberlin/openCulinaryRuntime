# ReciFine Integration Notes

**Status:** Evaluated, deliberately shelved. Not scoped, not started. This
document consolidates and supersedes the 8 markdown files + 1 TypeScript
file dropped into `recipi/` at repo root (2026-08-16, source unclear —
plausibly an AI-generated exploration package, never a real Claude Code
session's own work). Read in full, cross-checked, and distilled here so the
raw files don't need to be kept — see `ROADMAP.md`'s Phase 7 entry (Web
scraper pipeline) for how this fits the actual roadmap; this document is
the detailed reference behind that entry's summary, the same relationship
`PAPER_NOTES_2608.04768.md` has to its own `ROADMAP.md` entries.

## What ReciFine is

A recipe-text NER (Named Entity Recognition) framework:
[github.com/nuhu-ibrahim/ReciFine](https://github.com/nuhu-ibrahim/ReciFine),
EACL 2026 paper ("Knowledge Augmentation Enhances Token Classification for
Recipe Understanding"). Python/PyTorch/HuggingFace. Pre-trained
RecipeBERT/RecipeRoBERTa models extract 8 entity types from raw recipe
text via BIO tagging: `FOOD`, `QUANTITY`, `ACTION BY CHEF`, `FOOD STATE`,
`EQUIPMENT`, `TIME`, `TEMPERATURE`, `TECHNIQUE`. Trained on 2.2M recipes
(`ReciFine` dataset) plus a 500-recipe hand-annotated gold set
(`ReciFineGold`). Two extraction modes: `traditional` (tag everything at
once) and `knowledge_guided` (question-primed extraction of one entity
type at a time — e.g. "what is the FOOD_STATE?").

**The verdict, unchanged from the original evaluation:** genuinely
complementary, not competing — ReciFine answers "what does this raw text
say," this repo (OCR) answers "is what it says physically real and safe."
The natural boundary: ReciFine as a lossy, probabilistic PARSER feeding
OCR's strict, deterministic VALIDATOR — the same lossy-input/strict-engine
shape `CLAUDE.md`'s Schema.org export rule and the planned Cooklang
scraper already commit to, just applied to free-text instructions instead
of structured `recipeIngredient` strings.

## Why this is shelved, not built

1. **License: CC BY-NC 4.0 (NonCommercial).** This repo is MIT and headed
   public. Depending on ReciFine's weights/dataset would practically impose
   an NC restriction on anything downstream that uses the resulting
   pipeline. Not resolved by any of the material in `recipi/` — none of it
   even mentions licensing. This is the actual blocker, not effort or
   design uncertainty.
2. **First statistical-ML dependency this repo would take on.** Every
   other planned satellite (scraper's own JSON-LD/Cooklang parsing, mobile
   app, HA component) is deterministic/rule-based. A pretrained BERT model
   cuts against `CLAUDE.md`'s "every factual claim traces to a real
   source" discipline — defensible only if ReciFine stays strictly a fuzzy
   front-end parser with OCR's own validator as the real gatekeeper of
   truth, never treated as itself authoritative.
3. **Scope creep vs. the actual planned scraper satellite.** `ROADMAP.md`
   Phase 7 only ever scoped tokenizing JSON-LD's `recipeIngredient`
   strings (already fairly regular, regex-tractable) — never free-text
   instruction parsing. ReciFine would be the answer to a harder problem
   this repo hasn't actually committed to solving yet.

## Entity mapping (the one genuinely reusable piece of design)

```
ReciFine extracts          → OCR's real equivalent           → Where it lives today
──────────────────────────────────────────────────────────────────────────────────
ACTION BY CHEF              → Action.id / Action.verb          → data/actions/*.json
QUANTITY                    → QuantitySchema                   → src/ingredient.ts
FOOD                        → Entity.id                        → data/entities/*.json
FOOD STATE                  → Instance.state / doneness param  → src/egg-doneness.ts, src/potato-doneness.ts
EQUIPMENT                   → Entity.id (kind: "tool")          → data/entities/*.json
TIME                        → Action `durationSeconds` param    → data/actions/*.json
TEMPERATURE                 → Action `waterTempC`/`oilTempC`     → data/actions/*.json
TECHNIQUE                   → Action variant / categorical param → e.g. fry.json's edgeStyle
```

This mapping is real and would still be the right shape if this were ever
built — it isn't the part that's wrong. What's wrong in every code sample
across `recipi/`'s files (`recipe-pipeline.ts`, `integration_patterns.md`)
is that the "validator" side is a **from-scratch, much weaker reimplementation**
of what `src/engine.ts` + `data/*.json` already do for real: a flat
`knownIngredients`/`knownActions` allowlist, a single hardcoded temperature
range per action, no state machine, no D/z-value HACCP, no doneness models.
If this is ever built, the ONLY code worth keeping from that pile is the
parse step (`parseRecipeWithReciFine` — an HTTP call to a Flask wrapper
around `ReciFineNER`) and the entity-mapper (`mapReciFineToOCR` — unit
conversion: `°F→°C`, `"10 minutes"→600`, `"2 cups"→{value,unit}`). The
validator/executor should be thrown away entirely in favor of this repo's
real `engine.ts`/`recipe-runner.ts`, not extended.

## Architecture (if ever built)

```
Raw recipe text
  → ReciFine NER (Python/Flask service, port 5000, /extract endpoint)
  → entity mapper (unit/temp/time normalization — the one reusable TS piece)
  → this repo's REAL validator (engine.ts's applyAction / recipe-runner.ts's runRecipe)
  → executable, validated RecipeScript
```

Not a `pythonBridge`/gRPC layer, not a rewritten OCR-in-Python, not a
fine-tuning pipeline — those were `recipi/`'s own later-phase ambitions
(`integration_patterns.md`'s sections 3, 5, 6) and are all out of scope
even in the hypothetical "we're doing this" case; a thin HTTP call to a
single `/extract` endpoint is the entire integration surface actually
needed.

## If this ever gets un-shelved

Concrete, scoped steps, in order — none started:

1. Resolve the license question first, explicitly (permissively-licensed
   alternative NER model/dataset, or an accepted non-commercial-only
   carve-out that doesn't touch the core MIT-licensed engine). Everything
   below is blocked on this, not on effort.
2. Treat it as the **instruction-parsing half of `ROADMAP.md` Phase 7**
   (the scraper satellite), not a new satellite — Phase 7's own scope
   (JSON-LD `recipeIngredient` tokenizing) never covered free-text
   instructions at all; this is the real gap it would close.
3. Build ONLY `parseRecipeWithReciFine` + the entity mapper. Feed the
   mapped output into this repo's real `RecipeScriptSchema`/`runRecipe` —
   do not build a second validator.
4. A parsed, un-verified `RecipeScript` from free text is inherently lossy
   and probabilistic — it should be flagged as machine-suggested/unverified
   (the same honesty this repo already applies to categorical technique
   parameters) until a human or `recipe-explain.ts`'s pre-flight report
   confirms it, never treated as ground truth on its own.

## Numbers that were never independently verified

Effort/timeline estimates throughout `recipi/`'s docs ("4-6 hours to
prototype," "1-2 weeks to production," EACL 2026 publication claim) read
as generic filler, not grounded in this codebase — not relied on above.

## Source material

The original 10 files (`recipi/README.md`, `CLAUDE_INTEGRATION_CTX.md`,
`CLAUDE_CLI_README.md`, `CLAUDE_CLI_QUICKSTART.md`, `comparison_analysis.md`,
`integration_patterns.md`, `quick_reference.md`, `FILES_CREATED.txt`,
`package.json`, `recipe-pipeline.ts`) remain untracked at `recipi/` for
now, superseded by this document — not committed to git, per the license
concern above; safe to delete once this document is confirmed sufficient.
