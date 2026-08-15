# Authoring a new recipe from the command line

This is the real, working loop as it exists today — every command and
every piece of output below was actually run against this repo, not
described from memory. See `ROADMAP.md`'s "CLI pre-flight recipe
validator" entry (2026-08-15) for how `validate-recipe`/`recipe-explain.ts`
were built, and this file's own §2 for the honest gap between "the loop
works" and "you can just paste a recipe in prose or Cooklang."

## 1. The loop

1. **Find your vocabulary.** Browse `data/entities/*.json` for the
   ingredients/tools you need (id, `possibleStates`, `capabilities`) and
   `data/actions/*.json` for the verbs (id, `verb`, `parameters` —
   `allowedValues` for categorical params, `numericRange` for numeric
   ones). This is a closed, typed vocabulary — you can't invent a new
   entity or action id inline in a recipe; either it already exists, or
   it doesn't and the recipe can't use it yet (see `ROADMAP.md`'s "far
   more staple ingredients" / "more common technique verbs" entries for
   what's still missing).
2. **Scaffold a starting file**:
   `npm run new-recipe -- <path.json> <entityId1> [entityId2 ...]` — e.g.
   `npm run new-recipe -- quick-fried-potatoes.json potato oil`. Writes a
   real `initialInventory` (correct starting states, straight from the
   entity files) plus empty `availableTools`/`sequence`, and prints each
   entity's real capabilities and other possible states to the console —
   exactly the browsing step 1 just described, done for you. The `id`/
   `names.en` fields are derived from the filename, same convention every
   `data/recipes/*.json` file already follows. **The written file is
   intentionally NOT yet valid** — `RecipeScriptSchema` requires at least
   one step, and a scaffold has none by definition; running
   `validate-recipe` against it immediately says so, which is the correct
   and expected first alarm, not a bug in the generator (see
   `src/recipe-scaffold.ts`'s own doc comment). Skip this step and
   hand-write the whole file if you'd rather start from an existing
   recipe as a template instead — both are real, supported starting
   points.
3. **Fill in `sequence`.** Ordered steps: `actionId`, `targetInstanceId`,
   `params`, `availableIngredientInstanceIds`, optional
   `secondaryInstanceId` for `COMBINE`-shaped actions. Also fill in
   `availableTools` (entity ids present for the whole recipe).
4. **Run it**: `npm run validate-recipe -- <path-to-your-file.json>`.
   This does four things in order: schema-checks the file against
   `RecipeScriptSchema`; prints a pre-flight report (tools/ingredients
   needed vs. missing, with candidate fixes; timing-vs-doneness
   advisories; wash-before-peel/cut heuristics; fry-timing-vs-geometry
   physics checks); actually runs it (`recipe-runner.ts`'s `runRecipe` —
   the one ground-truth execution, same engine every canonical recipe
   runs through); exits 0 only if the schema check and execution both
   succeeded.
5. **Fix what it tells you, re-run, repeat.** The two sections answer
   different questions — the pre-flight report is "what will this need
   and does anything look physically off," the execution log is "did it
   actually run." Read both; a clean exit code does not by itself mean
   "no advisories" (see the worked example below).
6. **Once it's clean**, optionally get a readable summary:
   `npm run narrate-recipe -- <path> summary.md` (or `summary.json`) —
   structure, what it needs, what the system inferred (which real
   instance satisfied which capability, tag inheritance), verbs used,
   elements created, stated active duration, final inventory.
7. **To make it canonical**: move the file into `data/recipes/`, add a
   `metadata.notes` block explaining the real technique choices (every
   existing recipe has one — read a few for the convention), and run the
   full `npm run validate` — this re-checks it alongside every other
   entity/action/recipe/CCP, including cross-references nothing above
   catches (e.g. `producedByproducts` pointing at a real entity id).

**Sanity-checked while writing this**: all 12 files in `data/recipes/`
pass `validate-recipe` cleanly today. `tortilla-de-betanzos.json` is the
one interesting case — it produces two real CCP `WARNING` lines (12s/10s
fry, below `egg_cooking`'s 15s floor) and still exits 0, because that
recipe's own `haccpNote` documents this as the intentional, FDA-
recognized "advisory, not banned" runny-egg case — a genuine reminder
that a clean exit code and zero warnings are not the same claim.

### Worked example: the loop actually looping

Real output throughout — nothing below is paraphrased. Start with the
scaffold generator:

```
$ npm run new-recipe -- quick-fried-potatoes.json potato oil

Wrote quick-fried-potatoes.json

id: "quick_fried_potatoes"
names.en: "Quick Fried Potatoes"

Initial inventory (real entities, real starting states — check these against data/entities/*.json):
  potato-1: Potato (potato), starting state "raw"
    capabilities: isPeelable, isChoppable, isFryable, isBoilable, isWashable, isBakeable, isSeasonable, ...
    other possible states: peeled, sliced, diced, julienne, chopped, minced, halved, quartered, ...
  oil-1: Oil (oil), starting state "cold"
    capabilities: isFryingMedium, isEmulsifier, isInfusable

NOT yet a valid recipe — sequence is empty (RecipeScriptSchema requires at least one step) ...
```

Then fill in `availableTools`/`sequence` by hand — a small, deliberately
imperfect first attempt, fixed over three more real runs.

**v1** — wash/peel/cut/fry a diced potato, `oilTempC: 175`,
`durationSeconds: 20`, `availableTools: ["knife"]`:

```
MISSING tool capability "isFryingVessel" — declared availableTools satisfy none of it. Candidates that would: pan, wok

Timing advisories:
  - FRY on "potato-1": durationSeconds 20s is below even the FASTEST real case (30.8s) for a
    "diced" piece (6.35-12.7mm) in 175°C oil to reach a fork-tender center — very likely undercooked.

REJECTED FRY potato-1: FRY requires an available tool with capability "isFryingVessel", but none is on hand.
```

Two independent problems, both real: no pan, and even if there were one,
20s isn't enough time. Fixing only the tool (`availableTools: ["knife",
"pan"]`) and re-running:

**v2** — same duration, tool fixed:

```
Timing advisories:
  - FRY on "potato-1": durationSeconds 20s is below even the FASTEST real case (30.8s) ...

OK — recipe is schema-valid and runs end-to-end with zero step errors.
```

Exit code 0 — but the timing advisory is still there. **Exit code alone
would have missed this.** Bumping the duration to a value inside the
model's own genuinely-uncertain range:

**v3** — `durationSeconds: 180`:

```
Timing advisories:
  - FRY on "potato-1": durationSeconds 180s is within a genuinely UNCERTAIN range (30.8-492.3s)
    for a "diced" piece in 175°C oil to reach a fork-tender center — could be done or not
    depending on the exact thickness/oil coverage.
```

Still worth fixing — "uncertain" is not "fine." Past the slowest real
case:

**v4** — `durationSeconds: 500`:

```
=== Pre-flight report ===
Tools needed:  knife
Tools declared (availableTools): knife, pan
Ingredient capabilities needed: isFryingMedium

=== Running the recipe (ground truth) ===
WASH potato-1 ... PEEL potato-1 ... CUT potato-1 ... FRY potato-1: state "diced" -> "fried"

OK — recipe is schema-valid and runs end-to-end with zero step errors.
```

Clean: no missing tools, no advisories, zero errors. That's the loop —
four small, real iterations, not a one-shot pass/fail.

**One current tooling gap worth knowing while reading pre-flight output**:
"Tools needed" only lists EXACT `requiredTools` ids (like `knife`) — a
capability-based requirement like `FRY`'s `isFryingVessel` only shows up
if it's *missing*. A clean report's "Tools needed" line can undercount
what a recipe actually needs; it just means every capability-based need
happened to already be satisfied, not that there were none.

## 2. Cooklang — the honest answer

**No, not today.** Checked directly, not assumed: nothing in this repo
parses `.cook` syntax. `ROADMAP.md`'s Phase 5 has been sitting unstarted
since before this session; every entity has a `cooklang: {canonicalToken,
spiceLock}` field (`ajo`, `huevo`, `sal`, ...) but nothing reads or
writes actual Cooklang text.

But the way it *should* eventually connect is worth writing down now,
because it's not a new idea — it's this repo's own already-decided rule
for exactly this situation (`ENGINE_INVARIANTS.md` #10 / `CONCEPT.md`
§14, the same boundary `src/query.ts` already runs on: **an LLM may turn
free text into a structured proposal; it never asserts world state, and
it never decides validation rules — the deterministic engine has final
say**):

1. **Parsing Cooklang's syntax is mechanical and real, buildable
   whenever it's prioritized**: `@ingredient{qty%unit}`, `#cookware{}`,
   `~{timer}` — a straightforward grammar, no judgment calls, no
   citations needed.
2. **Turning step PROSE into this repo's typed verb+parameter shape is
   NOT mechanical.** "Fry the potatoes until golden" doesn't carry an
   `actionId`, an `oilTempC`, a `shape` — Cooklang doesn't have this
   repo's closed, typed action vocabulary at all. Producing a
   `RecipeStep` from that sentence is exactly the free-text →
   structured-intent translation `ENGINE_INVARIANTS.md` #10 already
   scopes to an LLM or a human, producing a *proposal*, never treated as
   already-valid.
3. **The connection is exactly what you're picturing, and it needs
   nothing new on the validation side**: that translation step's job is
   only to produce a first DRAFT `RecipeScript` — however incomplete or
   wrong — and hand it to the exact same loop in §1. `validate-recipe`
   doesn't need to know or care whether a draft came from a human typing
   JSON by hand or an LLM translating a `.cook` file; "the alarms that
   help extend a human recipe to our system" already exist today. Real
   Cooklang support would mostly be a new way to generate the FIRST
   draft that loop starts from — not a second validator, not a special
   case.

## 3. Named, not built — real gaps in today's loop

~~No scaffold/starter-template generator~~ **closed 2026-08-15** —
`npm run new-recipe` (§1 step 2, `src/recipe-scaffold.ts`), tested against
the worked example above. Still open:

- **No severity grading on `validate-recipe`'s findings.** Schema
  errors, `REJECTED` execution steps, CCP `WARNING`s, and purely
  informational advisories (timing/prep/fry-geometry) are all printed as
  one flat report today — a human has to read closely to know which
  findings are "must fix" vs. "FDA-recognized, disclosed risk" vs.
  "worth double-checking."
- **No fuzzy-match suggestion for a typo'd entity/action id.** Get one
  wrong and you get "Unknown action/entity," not "did you mean...".
- **The Cooklang parser + prose-to-verb translator itself** (§2) — the
  single largest piece of this document that's design, not
  implementation.

None of these are built by writing this document — named here so the
next session that picks one up isn't rediscovering it from scratch.
