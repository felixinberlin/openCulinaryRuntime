# Porting to Python — tips from someone who's read every line of this repo's docs and comments

Written for a high-skilled developer starting the Python port, after reviewing
every design doc and the comments in `src/*.ts`/`data/*.json` — the actual
"gold" here isn't the TypeScript, it's the decisions and the mistakes recorded
next to the code. This document exists so a from-scratch Python rewrite
doesn't silently re-lose ground this repo already paid for in real,
documented sessions of trial and error. It is not a line-by-line translation
guide — a skilled dev doesn't need `zod` → `pydantic` spelled out field by
field. It's the list of things that are easy to get wrong anyway, because
they're not visible in the schema shape, only in the comments and the
`LEARNINGS_*.md` history.

**If you read nothing else, read `ENGINE_INVARIANTS.md` (23 lines) in full
before writing a single class.** Everything below either restates one of
those 11 rules with a concrete story attached, or explains where the
TypeScript diverges from them and why that divergence is itself a documented,
deliberate decision — not something to "fix" back toward the original spec.

---

## 1. What this actually is, in one paragraph

This is not a recipe app. It's a deterministic state-machine engine —
Entities (ingredients/tools) transition between States via Actions, subject
to capability checks, HACCP thermal thresholds, and (as of the last session)
per-entity forbidden-transition rules. Recipes are data (`RecipeScript`), not
code. The interesting, original part of this project is the schema/engine
design (`CLAUDE.md`'s own words: "the schema/engine is the original
contribution, the facts it enforces are cited"); the culinary facts
themselves are all sourced (`REFERENCES.md`) and should port over as
**data**, verbatim, not be re-derived or "corrected" from general knowledge
during the rewrite — see §5 for why that's not a hypothetical risk here.

## 2. Document hierarchy — read in this order, not alphabetically

1. **`ENGINE_INVARIANTS.md`** — the 11 rules. Non-negotiable regardless of
   language.
2. **`CLAUDE.md`**, specifically its "Module layout — as planned vs. as
   actually built" table. This tells you, file by file, where the ORIGINAL
   spec (`CLAUDE_DEV_CTX.md`) and the ACTUAL shipped code diverged, and
   crucially *why*. Port from the actual code, use the table to know when
   `CLAUDE_DEV_CTX.md` is describing something that was tried and
   deliberately abandoned.
3. **`CLAUDE_DEV_CTX.md`** — the original spec/system-prompt this was built
   from. Read it for the *concepts*, not the reference TypeScript in it —
   its own literal `INVALID_TRANSITIONS` example turned out to be factually
   wrong (see §6.4). Concepts good, reference code unverified.
4. **`CONCEPT.md`** + **`ENGINE_INVARIANTS.md`**'s own "Provenance" section —
   the still-unresolved architectural fork (linear step-sequence vs.
   goal-based/event-sourced) this repo has always sat on top of. The engine
   as built commits to the linear-sequence side; §12/§13 describe the
   other side, not yet built anywhere. Don't accidentally build a hybrid.
5. **`ROADMAP.md`** — what's closed, what's deferred and why, what's
   "known-large, not started." This is the actual scope document; port
   what's closed, and consult this before inventing anything that looks
   like an obvious next feature — it's very likely already been considered
   and either scoped out on purpose or is sitting there as a named,
   unstarted gap.
6. **`LEARNINGS_ENGINE.md` / `LEARNINGS_DOMAIN.md` / `LEARNINGS_TOOLING.md` /
   `LEARNINGS_PROCESS.md`** — dated, concrete "here's what broke and why."
   Not prose to skim once — see §6/§7 below, this is where most of the
   actual porting risk lives.
7. **`REFERENCES.md`** — every citation, with a confidence tier. Treat this
   as the bibliography the ported data layer must keep matching.
8. **`AUTHORING.md`** — the actual end-to-end human workflow
   (`new-recipe` → fill in → `validate-recipe` → `narrate-recipe` →
   promote to `data/recipes/`). Port the CLI UX this describes, not just
   the underlying functions — the iterate-on-feedback loop is the point.

## 3. Source-of-truth split: data stays JSON, don't invent a DB or a DSL

`data/{entities,actions,recipes,ccps,heat-sources}/*.json` is already a
clean, language-agnostic interchange format, validated by whatever schema
library reads it. Nothing about the port requires migrating this to SQLite,
YAML, a Python DSL, or in-code Python objects. Pydantic (or msgspec, or
attrs+cattrs) reads JSON directly, same as Zod does today. Keep the split:
**canonical knowledge is data, checked at load time; only the engine and the
CLI tooling are code.** This is `ENGINE_INVARIANTS.md` #1/#6 made literal —
porting knowledge INTO Python code instead of leaving it as data would
violate "recipes/knowledge never contain executable logic" in spirit even if
the letter is about recipes specifically.

## 4. File-by-file map (`src/*.ts` → what it does → Python module suggestion)

| TS file | Lines | What it actually does | Python note |
|---|---|---|---|
| `ingredient.ts` | 435 | `EntitySchema` + every sub-schema (`Composition`, `PhysicalDimensions`, `Thermophysical`, `Sensory`, `Capabilities`, `Cooklang`, `Quantity`). The single most load-bearing file. | `models/entity.py`. See §6 for the two hard parts: the open `Capabilities` map and `Quantity`'s discriminated union. |
| `action.ts` | 286 | `ActionSchema` + `ActionOutputsSchema` (with cross-field `.refine()`s), `VerificationCriterionSchema`, `HazardSchema`. | `models/action.py`. Port the three `.refine()`s as `@model_validator(mode="after")` — see §6.2. |
| `recipe.ts` | 64 | `RecipeScriptSchema`/`RecipeStepSchema`/`RecipeInstanceSchema` — the linear-sequence container. | `models/recipe.py`. Small, mechanical. |
| `thermal.ts` | 99 | `CriticalControlPointSchema` + `ThermalInactivationModelSchema` + `requiredHoldSeconds()` — real D-value/z-value microbiology math. | `models/thermal.py`. `requiredHoldSeconds` is a pure function (`t = t_ref * 10^((T_ref - T)/z)`), trivial to port; keep it a free function, not a method. |
| `engine.ts` | 438 | `applyAction()` — the entire rule engine, ~15 sequential precondition checks then output computation. ONE function, deliberately not a class (`CLAUDE.md`: "Also not a class named `OcrValidationEngine` — a plain function"). | `engine.py`. See §7.1 for whether to keep it a plain function in Python too — it's a real design choice, not an accident of TypeScript. |
| `recipe-runner.ts` | 149 | `runRecipe()` — walks a `RecipeScript.sequence` against `applyAction`, owns the actual mutable inventory `Dict[str, Instance]`, collects errors without halting. | `recipe_runner.py`. `applyAction`/`engine.ts` itself never mutates a persistent inventory — this is the one place that does. Keep that separation; see §7.3. |
| `registry.ts` | 45 | Loads `data/*.json` by directory into typed maps, **throws on the first invalid file**. | `registry.py`. Note this fails DIFFERENTLY from `scripts/validate.ts` (§6.5) — both behaviors are real and used for different purposes, port both. |
| `place.ts` | 245 | `PlaceState` — a pot/pan's own persisting temperature, pure functions of elapsed simulated time. Two generalizations layered on top of each other (`advanceHeatSeconds`/`isAtBoiling` for water's phase-change ceiling, `advanceTempSeconds`/`isAtTargetTemp` for oil's setpoint ceiling) — the first pair are now thin wrappers over the second. | `place.py`. See §7.5 — two DIFFERENT KINDS of "clamp" that look identical in code and must not be conflated in comments/docs. |
| `heat-source.ts` | 163 | `HeatSourceProfileSchema` + `estimatedPreheatSeconds()` — real energy-balance physics for gas/vitro/wood. | `heat_source.py`. |
| `altitude.ts` | 103 | `atmosphericPressurePa()` / `waterBoilingPointC()` — ICAO barometric formula + Antoine equation, real computed physics, not a lookup table. | `altitude.py`. |
| `egg-doneness.ts` | 154 | `EGG_BOIL_DONENESS` + size adjustment — cited seconds-range tables, deliberately NOT wired into the engine (informational only). | `egg_doneness.py`. |
| `potato-doneness.ts` | 123 | Same pattern, potato. Proves the `place.ts`/`heat-source.ts` generalization by reuse. | `potato_doneness.py`. |
| `cut-dimensions.ts` | 154 | Real millimeter ranges per `CUT` shape, cited. | `cut_dimensions.py`. |
| `heat-penetration.ts` | 238 | 1D transient Fourier conduction (Incropera & DeWitt) — real textbook heat-transfer math, `secondsForCenterToReachTempC()`. | `heat_penetration.py`. Uses `numpy`/`scipy` idiom candidates (error function, series) — check whether the TS reimplemented these from scratch (it did, no numeric library dependency existed) before reaching for `scipy` in the port; either is fine, but know which you're choosing. |
| `flavor-balance.ts` | 156 | `FLAVOR_COUNTERBALANCES` — real, cited taste-interaction data (sweet↔sour, salt→bitter, acid→richness), the newest module. | `flavor_balance.py`. Good template file to start with — small, self-contained, shows the citation-tiering pattern cleanly. |
| `recipe-explain.ts` | 306 | `explainRecipe()` — pre-flight report: tools/ingredients needed vs. declared, timing-vs-doneness advisories, wash-before-peel heuristic, fry-timing-vs-geometry physics check. | `recipe_explain.py`. |
| `recipe-narrator.ts` | 327 | `narrateRecipe()` + Markdown renderer — human-readable "read this recipe back" document. Composes `recipe-explain`+`recipe-runner`, doesn't duplicate their logic. | `recipe_narrator.py`. |
| `recipe-scaffold.ts` | 112 | `buildRecipeScaffold()` — generates a starting `RecipeScript` file, deliberately schema-invalid (empty `sequence`) by design. | `recipe_scaffold.py`. |
| `recipe-player.ts` | 168 | Step/revert/variation playback over an already-authored recipe — `revert` is RECOMPUTATION of a shorter slice, never snapshot/rollback. | `recipe_player.py`. See §7.4 — this only works because `applyAction`/`runRecipe` are pure; preserve that purity or this whole module's design assumption breaks. |
| `query.ts` | 85 | `answerAboutParameter()` — structured lookup over existing data/metadata, not generated prose. The `CONCEPT.md` §14 LLM-boundary made concrete. | `query.py`. |

`recipe-explain.ts`/`recipe-narrator.ts`/`recipe-scaffold.ts`/
`recipe-player.ts` are all explicitly "presentation/tooling layer, not a
second source of truth" (`LEARNINGS_TOOLING.md`, repeated four times). Keep
that discipline in the port: nothing outside `engine.py`/`recipe_runner.py`
should re-implement a rule check, only report on results those two already
computed.

## 5. `data/*.json` and `REFERENCES.md`: port as literal facts, don't re-derive

This is the single highest-value warning in this document, and it comes from
something that actually happened in this repo, not a hypothetical: **the
original design spec's own worked example turned out to be factually
wrong**, and it took building the feature it was inspiration for and shipping
it before a user caught it. `CLAUDE_DEV_CTX.md`'s reference
`OcrValidationEngine` uses `boiled: ['raw', 'peeled']` in its illustrative
`INVALID_TRANSITIONS` map — i.e. "you can never peel a potato that's already
boiled." That's wrong: boil-in-jacket-then-peel is the standard method behind
many potato salad recipes. It sat, cited approvingly, in `peel.json`'s own
metadata since this repo's first commit, and was carried uncritically into a
real, shipped `data/entities/potato.json` rule before anyone checked it
against actual cooking technique (`LEARNINGS_ENGINE.md`/`LEARNINGS_PROCESS.md`,
2026-08-15, "the flagship example was factually wrong").

The concrete instruction this produces for the port: **when a
`data/*.json` file's claim looks odd, don't "clean it up" to match your own
intuition about cooking, and don't trust a claim just because it's already
shipped** — check `REFERENCES.md`'s citation for it, or re-derive from the
same primary source. Several files in this repo now explicitly record a
CORRECTION alongside the original claim rather than silently overwriting it
(`potato.json`'s `invalidTransitionsNote`, `egg.json`'s
`invalidTransitionsNote`) — port that discipline too: if you find and fix
something during the port, write down that you did, the same way this repo
does, rather than quietly diverging from the TS version with no trail.

The confidence-tier discipline (`CitationSchema`: `standard_reference` vs.
`commonly_cited_unverified`) is not decoration — several real facts in this
repo are DELIBERATELY logged at the weaker tier because the strongest
available source was a paywalled review that wasn't independently verified
(`src/flavor-balance.ts`'s acid/richness citation is the most recent example).
Don't normalize these to one confidence level during the port; the gradient
itself is information.

## 6. Zod → your Python validation library: the parts that aren't mechanical

Assume Pydantic v2 below (the obvious choice — Zod and Pydantic map closely
for 90% of this codebase); swap in `msgspec`/`attrs` equivalents if you pick
differently, the underlying decisions are the same.

### 6.1 The open-map pattern — `CapabilitiesSchema` and `HazardSchema.type`

`CapabilitiesSchema` is a Zod object with ~15 NAMED boolean fields
(`isPeelable`, `isFryable`, ...) PLUS `.catchall(z.boolean())` — any
OTHER key not in that list is still accepted, and still validated as a
boolean. This is deliberate, not laziness: `CONCEPT.md` §3/§15 — "Unknown
knowledge is allowed" — a new capability like `isAcid` (added last session)
or a future `isMarinatable` must be addable on an entity WITHOUT a schema
change. This repo has added a new capability this way more than a dozen
times across its history; none of them touched `CapabilitiesSchema` itself.

Pydantic doesn't have a direct `.catchall()` equivalent that ALSO
type-checks the extra keys as booleans out of the box. Real options, pick
one deliberately (this is a decision, not a mechanical translation):
- `model_config = ConfigDict(extra="allow")` + a `@model_validator` that
  walks `self.model_extra` and checks every value is `bool` — closest
  fidelity to the original.
- Drop the named fields entirely and make `capabilities: Dict[str, bool]`
  — simpler, loses the documentation-via-schema benefit of seeing
  `isPeelable` etc. listed, but is honestly closer to what this field
  actually IS (an open bag of flags) than the hybrid Zod shape.

Either is defensible; silently closing it (a plain fixed-fields Pydantic
model, `extra="forbid"`) is the one wrong answer — it would break the very
first time a new capability gets added, which happens constantly in this
repo's own history.

`HazardSchema.type` is the same pattern at the field level: `z.string()`,
not a fixed enum, "matching `CapabilitiesSchema`'s own 'keep it open'
precedent — new hazard categories shouldn't need a schema change." Anywhere
you see a plain open string in this schema where a closed `Literal`/`Enum`
would look tempting and "more correct" in Python, check the doc comment
first — it may be open on purpose.

### 6.2 Cross-field validation — `ActionOutputsSchema`'s three `.refine()`s

```ts
.refine((o) => !(o.transformedState && o.transformedStateFromParameter), ...)
.refine((o) => !(o.combinesInto && (o.transformedState || o.transformedStateFromParameter)), ...)
```

Straightforward `@model_validator(mode="after")` in Pydantic. The thing
worth preserving isn't the mechanism, it's WHY these are mutually
exclusive — `ActionOutputsSchema`'s doc comment explains each one is a
different, real shape of "what happens to the target": a fixed state, a
parameter-driven state, a tag alongside an unchanged state, or a full
replacement into a different entity (`combinesInto`). Get the Pydantic
validator's error MESSAGE right too, not just the boolean logic — this
repo's whole validation layer is meant to be read by a human iterating
(`AUTHORING.md`'s whole point), not just to return true/false.

### 6.3 Discriminated unions — `QuantitySchema`

```ts
z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("precise"), amount, unit }),
  z.object({ kind: z.literal("imprecise"), descriptor, approxRangeGrams?, citation?, note? }),
  z.object({ kind: z.literal("relative"), ratio, ofEntityId, basis, note? }),
])
```

Direct Pydantic equivalent: three `BaseModel` subclasses with
`kind: Literal["precise"]` etc., combined as
`Annotated[Union[Precise, Imprecise, Relative], Field(discriminator="kind")]`.
Worth preserving the COMMENT above this schema, not just the shape — it
explains why this is a 3-way union and not one field with an optional
unit (`ingredient.ts`: "a plain number would have misrepresented the ones
that genuinely aren't reducible to one"). `"relative"`'s `ofEntityId` is
a soft foreign key CHECKED ONLY AT THE VALIDATION-SCRIPT LAYER
(`scripts/validate.ts` cross-checks it against a recipe's own
`initialInventory`), not by the schema itself or by `engine.py` — keep
that layering; it's the same "schema vs. cross-reference vs. runtime"
three-tier validation this whole repo uses everywhere (see §6.5).

### 6.4 `INVALID_TRANSITIONS`: per-entity, not the global map `CLAUDE_DEV_CTX.md` shows

If you're translating from the spec doc instead of the actual shipped
`ingredient.ts`, you will build this wrong. The reference code's
`INVALID_TRANSITIONS: Record<string, string[]>` is ONE GLOBAL map keyed by
bare state name. The actual, shipped `EntitySchema.invalidTransitions` is
keyed PER ENTITY. This isn't a style preference — a global map is
**provably incorrect** against this repo's own real data:
`potato.json` needs `mashed` to forbid reverting to `peeled` (a puréed
potato has no piece left to peel), while `egg.json`'s
`statePrerequisites.peel: "boiled"` REQUIRES boiling before peeling — same
bare state names, opposite rules, depending on the entity. Port
`invalidTransitions` as `Dict[str, List[str]]` ON the entity model, never
as a module-level constant. Full story: `LEARNINGS_ENGINE.md`,
"`INVALID_TRANSITIONS` — the 'global vs. per-entity' question resolved by
finding a real contradiction, not by preference."

### 6.5 Two different validation failure modes — both real, port both

`registry.ts`'s `loadDir()` throws on the FIRST invalid file — used by
`engine.py`'s actual runtime consumers (any script that needs a working
`Map<str, Entity>` to do something with, right now, has nothing useful to
do with a partially-loaded registry).

`scripts/validate.ts` does the opposite: loads everything with
`safeParse`, collects and prints EVERY issue across every file, and only
exits non-zero at the end — because a human running `npm run validate`
wants the full list of what's broken in one pass, not to fix one error,
re-run, hit the next one, fix, re-run again. It also does a THIRD tier of
checking neither schema validation nor `registry.py` does at all:
cross-file reference checks (`producedByproducts` pointing at a real
entity id, `criticalControlPointsByAction` pointing at a real CCP,
`invalidTransitions` referencing states that actually exist in that same
entity's `possibleStates`) and, as of `2026-08-14`, an actual end-to-end
SIMULATION of every `data/recipes/*.json` file via `runRecipe` — genuinely
the authoritative integration check, not just static ID cross-referencing.

Port all three tiers, keep them separate: (1) per-file schema validation,
(2) cross-file reference + full-file-set collect-all-errors validation, (3)
end-to-end simulation of every real recipe. `CLAUDE.md`'s own words: "`npm
test` and `validate.ts` are complementary, not alternatives" — this applies
equally to whatever your Python equivalents end up being named.

## 7. Engine design decisions worth preserving deliberately, not by accident

### 7.1 `applyAction` is a plain function, not a class — and that's a documented choice

`CLAUDE_DEV_CTX.md`'s reference code is a class, `OcrValidationEngine`,
with `this.inventory` as private mutable state. The actual `engine.ts`
is one function, `applyAction(instance, action, entities, ...)`, that
takes everything it needs as arguments and returns a result — it owns NO
persistent state at all. `CLAUDE.md`'s module-layout table records this
explicitly as a divergence: "Also not a class named `OcrValidationEngine`
— a plain function." This isn't an accident of "TypeScript doesn't need
classes" — it's what makes `recipe-player.ts`'s entire revert-by-
recomputation design possible (§7.4) and what makes the unit test suite
able to build two throwaway `Entity`/`Action` fixtures and assert on
`applyAction`'s return value with zero setup/teardown.

In Python, a class-based `Engine` object is a very natural, very tempting
shape (`self.entities`, `self.apply_action(...)`). You can do this — but
know you're making a real architectural choice the original deliberately
didn't, and that choice has consequences downstream (test fixture cost,
whether "revert" can stay pure recomputation, whether two engine instances
can safely share loaded entity data). The safer default: keep
`apply_action` a pure function (module-level or a `@staticmethod`), and let
`RecipeRunner`/`recipe_runner.py` be the one place that owns a mutable
inventory dict — mirroring the actual TS split exactly.

### 7.2 `state` vs. `tags` — the single most important domain-modeling lesson in this repo

Every `Instance` has exactly ONE `state` (mutually exclusive: raw XOR
peeled XOR boiled XOR fried XOR ...) and any NUMBER of `tags` (orthogonal
facts that coexist with whatever the current state is: salted, washed,
shocked, acidified, ...). Get this distinction wrong on any NEW property
you add during the port and you will reproduce a real, already-found,
already-fixed bug: `WASH` originally set `outputs.transformedState:
"washed"`, treating "has been washed" as if it were a FORM like "peeled" —
which meant washing, then peeling, silently ERASED the fact the potato had
ever been washed, because `state` can only hold one value. A real user
caught this by pointing out "I wash before and after if I want to" was
unrepresentable. The fix (`addsTag`, not `transformedState`) is now the
canonical pattern for exactly this class of fact — SALT/PEPPER/CHILI/ACID
already all use it. **Before adding `transformedState` to any new action
during the port, ask: does this new state genuinely make the OLD state
impossible to have also been true (peeled vs. raw — yes) or is it an
independent fact that survives whatever else happens to the entity (washed,
salted — no)?** Full story: `LEARNINGS_ENGINE.md`, "`WASH` was modeled
wrong from the start."

`engine.py`'s `statePrerequisites` check needs to match EITHER the current
`state` OR a tag in `tags` — this is the one-line generalization that made
the fix possible without a schema migration
(`instance.state == s or s in instance.tags`, not two separate mechanisms).

### 7.3 Conservation of mass — `apply_action` returns intent, the caller mutates inventory

`applyAction` never touches an inventory `Map`/`Dict` directly. It returns
`{instance, spawned, destroyed, secondaryDestroyed, warnings}` and the
CALLER (`recipe-runner.ts`, or a demo script) is responsible for actually
`.delete()`ing a destroyed instance and `.set()`ing spawned ones. This
keeps `applyAction`/`apply_action` a pure function of its inputs — no
hidden inventory dependency, trivially testable with two throwaway
fixtures and no setup. Preserve this split in Python: `apply_action(...)
-> ExecutionResult`, never `apply_action(inventory, ...)` mutating
in place.

One subtlety worth knowing before you touch it: `destroysTarget` actions
STILL populate `result.instance` — it's the target's state the instant
before removal, kept for logging. A demo script's first draft chained off
`.instance` after a `destroysTarget` action instead of `.spawned`, and the
bug wasn't caught by reading the code, only by actually running the
script. Whatever your Python `ExecutionResult` equivalent looks like, keep
this same "populated for logging, not for the caller to persist" behavior,
and write the equivalent integration check (actually running a script
against it), not just a type-checker pass.

### 7.4 `recipe-player.ts`'s revert is recomputation, not rollback — depends on §7.1/§7.3 staying true

`RecipePlayerState` stores exactly one number, `currentIndex`. "Stepping
backward" is not undo/snapshot machinery — it's re-running `runRecipe`
against a SHORTER SLICE of the same `RecipeScript`, from the top, every
time. This only works, and is only cheap enough to be reasonable, because
`applyAction`/`runRecipe` are pure functions with no hidden state — replay
from scratch is the whole implementation. If the port makes `apply_action`
stateful (§7.1) or `recipe_runner` implicit/side-effecting in some way,
this module's entire design assumption breaks and revert would need to
become real snapshot/undo machinery instead — a strictly bigger feature.
Decide §7.1 first; it constrains this file's feasible design, not the
other way around.

### 7.5 Two different physical MEANINGS behind what looks like the same clamp

`place.py`'s temperature-advance function needs to stop rising at some
ceiling — but there are two REAL, DIFFERENT reasons a ceiling exists, and
conflating them in a comment (even though the code might look identical)
overstates one of them:
- Water's `boilingPointC` clamp is a genuine PHYSICAL IMPOSSIBILITY —
  further energy goes into the liquid→vapor phase change (latent heat of
  vaporization), not further temperature rise. Water literally cannot
  exceed 100°C at sea level while liquid water remains.
- Oil's `targetTempC` clamp represents CONTROLLED HEATING STOPPING AT A
  CHOSEN SETPOINT — nothing physically prevents oil from continuing past
  it if more energy kept being added; a cook (or a thermostat) simply
  stops there on purpose.
Both are legitimate, but state which one you mean, explicitly, in whatever
Python docstring replaces this comment — this repo caught itself almost
blurring this distinction while generalizing the water-only function to
also handle oil, and named it explicitly instead.

### 7.6 The four capability checks are deliberately NOT the same mechanism, despite looking similar

`requiredTargetCapability` (the primary target: `isPeelable`),
`requiredIngredientCapabilities` (some OTHER present ingredient, checked
for presence only, never consumed: `isFryingMedium`),
`requiredToolCapabilities` (same shape, tool side: `isDeepVessel`), and
`requiredSecondaryCapability` (a specific SECOND instance that gets
CONSUMED, for `COMBINE`-shaped actions) are four different fields on
`Action` that all resolve to "does something present assert this boolean
true," but differ in WHO must satisfy them and whether that thing gets
consumed afterward. `requiredTools` (exact entity ID, not capability-based
at all) is a fifth, older, narrower mechanism kept around specifically for
cases where ONE EXACT tool really is required (`BAKE` genuinely needs an
oven, not "any heat-capable enclosure"). Don't collapse these into one
generic "requirements" list during the port — the distinctions
(consumed vs. not; id-based vs. capability-based; primary vs. secondary)
are each backed by a real case that broke when the distinction was
missing (`requiredToolCapabilities` didn't exist until a robot-with-only-
a-pan scenario forced it — see `LEARNINGS_ENGINE.md`).

## 8. Testing strategy to port, not just tests to port

`tests/*.test.ts` (via `node:test`) exercises the engine against SYNTHETIC,
minimal fixtures (`tests/helpers.ts`'s `makeEntity`/`makeAction`/`makeCcp`
factory functions, each letting a test set only the one field it cares
about, letting the schema fill in real defaults for the rest).
`scripts/validate.ts` exercises the engine against the REAL
`data/*.json` files, including full end-to-end recipe simulation.
`CLAUDE.md`, verbatim: **"`npm test` and `validate.ts` are complementary,
not alternatives... run both, plus every demo, after any change to `src/`,
not just the new thing."** Port both layers into the Python test suite
(`pytest tests/` for the synthetic-fixture layer, a `validate.py` CLI
script — or a `pytest` test that walks the real data directory — for the
integration layer), and keep running BOTH after every change, the same
discipline. Also port the ~30 `scripts/*.ts` capability-test/demo scripts
as real, runnable Python scripts (a `for` loop over them is literally
part of this repo's own commit workflow before every commit that touches
`src/`) — they are not optional polish, they're the actual proof that a
claimed capability really works end-to-end, not just that a schema parses.

One TypeScript-specific wrinkle you get to skip in Python: `tests/helpers.ts`
had to build fixtures against `z.input<typeof Schema>` (the PRE-default
shape) rather than `z.infer` (the POST-default shape), because
`Partial<z.infer<...>>` still required every nested object's fields be
fully present. Pydantic models don't have this split — a model IS both the
input and output shape, and `Model(id="x", **{k:v})` with only some fields
set just works, letting the rest fall back to field defaults. You don't
need to replicate the `z.input`/`Partial` gymnastics; you get the simpler
version for free. Do still replicate the PATTERN: small factory functions
per schema, each taking only the fields a given test actually cares about.

## 9. What NOT to build — check `ROADMAP.md` before inventing

Things this repo has explicitly, deliberately NOT built, with reasons
already on record — don't re-derive the decision, read why first:

- **A generic `SEASON` verb** unifying `SALT`/`PEPPER`/`CHILI`/`ACID`.
  Needs a real engine feature (`addsTagFromParameter`) plus a way for
  `requiredIngredientCapabilities` to identify WHICH instance satisfied a
  check. Four hand-duplicated verbs is the current, honest answer.
- **A literal global `INVALID_TRANSITIONS` map** — see §6.4. Resolved,
  not open.
- **Cooklang parsing** — mechanical syntax parsing is real, buildable,
  unstarted; turning step PROSE into this repo's typed action/parameter
  shape is explicitly scoped to an LLM/human producing a DRAFT, never
  validated as correct by construction (`ENGINE_INVARIANTS.md` #10).
- **A closed-loop control/perception layer** — every categorical
  "informational only" parameter (`heatLevel`, `doneness`,
  `oilAdditionRate`, ...) is a human-readable technique hint with NO
  defined actuator mapping. `ENGINE_INVARIANTS.md` #11 states directly
  that inventing one unilaterally would ITSELF violate the invariant, not
  satisfy it. Do not let Python's easier plumbing tempt you into wiring
  `heatLevel: "high"` to an actual number "just because you can now."
- **Ingredient quantity consumption/decrementing.** `QuantitySchema`
  records an amount; nothing anywhere subtracts it from an inventory as a
  recipe runs. Named, real, deferred.
- **A `PLATE`/multi-component-assembly primitive**, distinct from
  `COMBINE` (which fuses exactly two instances into one new SUBSTANCE —
  real mass conservation). Serving three independently-finished,
  UNMERGED instances together is a different, softer composition pattern,
  named but not built.
- **`nutrition-extension.ts`, `ParsedIngredientSchema`, the Python
  scraper/React Native app/Home Assistant component** — three explicitly
  separate satellite projects, not in scope unless independently asked
  for. Don't fold scraper-pipeline concerns into this port by default.

`ROADMAP.md`'s capability-test table is the actual measure of progress
this repo holds itself to — "can the current vocabulary produce a
specific real dish end-to-end, empirically checked, not reasoned about."
Port that standard along with the code: a ported feature isn't done when
it type-checks, it's done when the equivalent of `npm run recipe --
tortilla_de_patatas` produces the same result it does today.

## 10. Suggested Python project shape

```
ocr_py/
  models/           # ingredient.py, action.py, recipe.py, thermal.py — Pydantic schemas
  engine.py         # apply_action() — pure function, see §7.1
  recipe_runner.py  # run_recipe() — owns the mutable inventory dict
  registry.py       # load_entities/load_actions/... — throws on first bad file
  place.py, heat_source.py, altitude.py, egg_doneness.py,
  potato_doneness.py, cut_dimensions.py, heat_penetration.py,
  flavor_balance.py # standalone, cited domain-physics modules — see §4
  recipe_explain.py, recipe_narrator.py, recipe_scaffold.py,
  recipe_player.py, query.py   # tooling layer, composes the above, no new rules
scripts/            # CLI entry points mirroring package.json's script list —
                     # validate.py, validate_recipe.py, narrate_recipe.py,
                     # new_recipe.py, run_recipe.py, ask.py, plus one script
                     # per capability-test/demo currently in scripts/*.ts
tests/               # pytest — one file per model/module, synthetic fixtures
data/                # unchanged — the exact same *.json files, zero porting needed
```

Tooling equivalents worth adopting deliberately, matching what the TS side
already enforces as a matter of course:

- **`mypy --strict` (or `pyright`)** as the `tsc --noEmit` equivalent —
  this repo treats a clean typecheck as one of its two mandatory
  post-change checks (`npm test` + `tsc --noEmit`, always both). Wire it
  into the same habit from day one, not retrofitted later.
- **`pytest`** for `tests/*.test.ts`'s role.
- **A `validate.py` CLI** for `scripts/validate.ts`'s role — schema +
  cross-reference + full-recipe-simulation, see §6.5. Keep it a script
  that prints a human-readable OK/FAIL/NOTE report, matching the existing
  UX (`AUTHORING.md`'s whole workflow depends on this being readable, not
  just a pass/fail exit code).
- **`click` or `typer`** for the `scripts/*.ts` CLI entry points — pick
  whichever, but keep the actual UX behavior (`AUTHORING.md`'s worked
  example, four small real iterations against `validate-recipe`'s
  output) intact; that iterate-on-feedback loop is a real, deliberately
  designed piece of UX, not incidental to how the script happens to work.
- **`ruff`** for lint/format — this repo currently has NO lint/format
  config at all (`ROADMAP.md` Phase 0: "none present"); the Python port
  is a reasonable place to finally close that gap, not a requirement to
  match parity with something that was never there.

## 11. The one habit worth porting that isn't code at all

Every session that touched this repo left a dated entry in
`LEARNINGS_*.md` explaining a real "why," not a changelog of "what."
`CLAUDE.md`: *"After learning something that would've saved time going
in — a schema constraint, an engine gotcha, a design tradeoff and why —
append a dated entry there."* Keep doing this in the Python repo, from
the first commit — this document exists ONLY because that habit was
followed consistently enough to mine, and the single most expensive
mistake in this repo's whole history (§5's `INVALID_TRANSITIONS` example)
was caught and *fully documented* within the same session it shipped,
specifically because "write down what happened and why" was already the
norm, not a favor. A port that keeps the code but drops this habit will
rediscover, slowly and expensively, most of what this document just
handed you for free.
