# `src/foodon-crosswalk.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Not in `CLAUDE_DEV_CTX.md`'s original plan anywhere — added 2026-08-19 in direct response to a user question ("how much info do we have linked to foodon.org?"), which this repo had zero of before this change. [FoodOn](https://foodon.org/) is a real, actively-maintained [OBO Foundry](https://obofoundry.org/ontology/foodon) ontology (CC BY 4.0) for standardized food classification — this module maps a subset of this repo's own `data/entities/*.json` to their matching FoodOn classes, for anyone consuming this repo's data who wants to cross-reference it against a broader food-classification standard.

**Deliberately NOT a field on `EntitySchema`.** Same precedent `nutrition-extension.ts` established for USDA meal-pattern crediting, and the same reasoning "Ticket 1" (`ROADMAP.md` Phase 6, checked 2026-08-17) already set for external-database identifiers generally: an entity's identity in this repo's own engine shouldn't be coupled to a third-party ontology's id scheme, even a well-governed open one. A separate schema, a separate `data/foodon-crosswalk/*.json` directory (one file per entity, `id` IS the entity id — same `registry.ts` `loadDir` shape `ccps`/`heat-sources`/`meal-pattern-contributions` already use), and a separate `registry.ts` loader (`loadFoodOnCrosswalk`).

**Scope and real coverage, named honestly.** Matched via direct queries against FoodOn's own [EBI Ontology Lookup Service (OLS4)](https://www.ebi.ac.uk/ols4/ontologies/foodon) search API, live, 2026-08-19 — not recalled from training, and not a secondary aggregator (OLS4 is FoodOn's own recommended browsing/query tool, named as such on foodon.org itself). 22 of this repo's 42 entities have a real, matched FoodOn class:

- **potato, egg, egg_yolk, egg_white, egg_shell, garlic, onion, salt, oil, sunflower_oil, milk, butter, flour, baking_soda, potato_peel, dough, vinegar** — clean, unambiguous matches, `confidence: "standard_reference"`.
- **black_pepper, chili_flakes, flaky_salt, yeast, water** — best-available but genuinely imperfect matches (a generic class standing in for a more specific one FoodOn doesn't have, or a real ambiguity between two near-duplicate FoodOn classes), `confidence: "commonly_cited_unverified"` with an explicit `note` on the specific caveat — same two-tier discipline this repo already applies everywhere else, not a weaker standard invented for this module.

**Deliberately NOT matched, named rather than guessed at:**

- **`kosher_salt`, `onion_peel`, `garlic_peel`, `egg_cracked`** — no FoodOn class was found in this session's OLS4 searches that cleanly represents these (kosher salt has no distinct class from table/sea salt in FoodOn's current data; onion peel/skin and garlic peel/skin have no byproduct-specific class the way `potato_peel`'s "potato peeling" does; a cracked-but-unseparated whole egg with no shell has no distinct class either — FoodOn has raw-with-shell and separated-yolk/white classes, but nothing for the transient state in between). Left unmapped rather than forcing a mismatched class onto them.
- **`potato_onion_mixture`, `tortilla_mixture`, `tortilla_mixture_con_cebolla`** — this repo's own composite, dish-specific mid-recipe mixtures. No attempt was made to find a FoodOn class for these; same "no cited methodology for crediting/classifying a composite proportionally" precedent `nutrition-extension.ts` already established for composite entities.
- **Every tool entity** (`bowl`, `grater`, `grill`, `knife`, `masher`, `mixer`, `mortar`, `oven`, `pan`, `pot`, `saucepan`, `steamer_basket`, `wok`) — categorically out of scope, not merely unmatched. FoodOn's own scope statement is materials that "bear a food role"; it does not model cookware/equipment at all, so no search was even attempted for these.

## `FoodOnCrosswalkEntrySchema`

`curie`/`iri` both identify the same FoodOn class in its two standard forms — the compact `FOODON:03315354` form (FoodOn's own convention, matching how this repo's other external-standard citations use their source's own native id format) and the full `http://purl.obolibrary.org/obo/FOODON_03315354` PURL form actually used in RDF/JSON-LD contexts. Both are stored directly on each data file rather than only storing `curie` and deriving `iri` at load time, so a consumer reading the raw JSON file never needs this module's code to get a usable IRI. `label` is FoodOn's own class label AS RECORDED at match time, not a live lookup — FoodOn is a living, versioned ontology (unlike 7 CFR 210.10, a fixed regulatory text) and upstream labels/class structure can change between FoodOn releases; a label recorded here could drift from FoodOn's current canonical label without this repo's own data being wrong, the same "recorded as of when it was checked" caveat several other citations in `REFERENCES.md` already carry for evolving sources.

## `foodOnIriFromCurie`

A mechanical convenience, not a second source of truth: every real data file stores its own `iri` directly (computed once, by the same formula, when the file was authored) rather than requiring a caller to reconstruct it — this function exists so a caller with only a bare `curie` (e.g. from a different tool that only records the compact form) can still get a working PURL without duplicating the format string.
