# `src/cooklang-translate.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The prose-to-verb translator `AUTHORING.md` §2 (point 2) and `ROADMAP.md`
Phase 5 both named as the one piece of Cooklang support that ISN'T
mechanical — `cooklang.ts`'s own top doc comment draws the same line.
This module does not cross it: it is a real, bounded, DETERMINISTIC
keyword/allowed-value matcher over this repo's own closed action
vocabulary (`data/actions/*.json`'s `verb`/`names`/`parameters`), not an
NLP model and not an LLM call — this repo has never called an external
LLM API anywhere in its execution path (`package.json`'s only dependency
is `zod`), and this module keeps that property. Exactly the same
"deterministic data already in `data/*.json` has final say" ethos
`query.ts`'s `answerAboutParameter` already runs on, applied in the
opposite direction: there, free text IN is a question about a known
parameter; here, free text IN is a step's prose, matched against the same
closed, typed vocabulary.

**What this buys, honestly**: recognizing a verb this repo already knows
about (by its `verb` id or any locale in `names`), inferring
`durationSeconds` from an already-parsed Cooklang timer, and inferring an
`allowedValues` parameter from a literal value string appearing in the
prose (e.g. "high" for `heatLevel`) — all real, all traceable back to a
specific match, never guessed silently. **What this does NOT attempt**,
on purpose, matching this repo's own restraint elsewhere: numeric-range
parameters (`oilTempC`, `waterTempC`, ...) are never extracted from prose
— there is no reliable, non-guessing way to read "175 degrees" out of
free text against a parameter this repo hasn't already tokenized
(Cooklang has no `%degrees_c` convention), so those are always left for a
human/LLM to fill in, named as a missing required parameter rather than
invented. A step with more than one recognized verb ("Peel and crush
@ajo") only becomes ONE `RecipeStep`, matching the FIRST verb found —
clause-splitting free text reliably is exactly the kind of judgment call
this module deliberately doesn't make; the second verb is named in that
step's own `notes`, not silently dropped.

Every translation is a PROPOSAL — see `recipe-scaffold.ts`'s identical
precedent: `translateCooklangDocument`'s `draft` is a plain,
`RecipeScript`-SHAPED object, never parsed against `RecipeScriptSchema`
here, and often genuinely schema-invalid (an unmatched step contributes
no `sequence` entry at all). The real hand-off is `AUTHORING.md` §1's
existing `validate-recipe` loop — this module's whole job ends at
producing a first, honestly-imperfect draft for that loop to react to.

## `VerbMatch`

- `actionIds`: Every actionId this alias resolves to — usually one, but a real gap this repo's own data has (`combine.json`/`combine_dough.json`/`combine_potato_onion.json`/`combine_con_cebolla.json` all share the identical verb `COMBINE`) means a bare alias can genuinely be ambiguous among several distinct actions. Kept as an array rather than collapsed to one (last-write-wins would have silently picked an arbitrary one of the four and been wrong most of the time) — `translateStep` reports the ambiguity instead of guessing among them, same as an ambiguous `allowedValues` match below.

## `buildVerbIndex`

One entry per normalized alias -> every actionId that alias could mean,
built from every action's `verb` and every locale in its `names` — a step
authored in Spanish ("Freír @patata") matches exactly as well as one
authored in English ("Fry @patata"), since `names.es` is indexed too, not
just `names.en`.

## `findVerbMatches`

Finds every alias from `verbIndex` that appears in `text` as a whole
word, in order of first appearance. Longer aliases are tried first at
each scan so e.g. a specific multi-word name ("Combine (potato +
onion)") wins over a shared bare verb ("Combine") when both are present
as aliases and the more specific one is actually in the text — the one
real way this module resolves what would otherwise be a
`VerbMatch.actionIds` ambiguity.

The lookaround-based boundary: rather than `\b`, which only asserts where
a WORD character (`\w`) meets a non-word one, and silently fails to match
at all when the alias itself ENDS in punctuation — a real case in this
repo's own data (combine_dough.json's real name is "Combine (flour +
water)", ending in ")"; `\bcombine \(flour \+ water\)\b` never matches
because ")" followed by a space is non-word-to-non-word, no boundary
there for `\b` to assert). Checking "the character just outside the
match isn't alphanumeric" instead works regardless of what character the
alias itself starts/ends with.

## `TranslatedStepCandidate`

- `sourceText`: The source Cooklang step text this was derived from, verbatim.
- `actionId`: Set only when a recognized verb was found in the step's text.
- `matchedVerb`: The literal text that matched the action's verb/name — for a human reviewing the draft to see exactly why this action was picked.
- `secondaryInstanceId`: Set only for an action with `requiredSecondaryCapability` (a COMBINE-shaped action) when a second resolvable ingredient reference was present in the step — still a guess, always noted as one.
- `notes`: Real, named gaps/ambiguities in THIS step's translation — nothing here is silently hidden from whoever reviews the draft next.

## `CooklangTranslationDraft`

A plain object matching `RecipeScriptSchema`'s SHAPE — same "not a real
`RecipeScript`, never `.parse()`d here" reasoning as
`recipe-scaffold.ts`'s `RecipeScaffold`. `sequence` can be empty (no step
recognized any verb at all) exactly like a fresh scaffold's empty
`sequence` — schema-invalid by construction, an honest starting point,
not a bug.

## `CooklangTranslation`

- `stepTranslations`: One entry per source Cooklang step, in order — INCLUDING steps that produced no `sequence` entry, so nothing is silently dropped.
- `unresolvedIngredientTokens`: Carried through from `importCooklangDraft` — ingredient tokens that matched no known entity at all.

## `translateStep`

The ambiguous-verb branch: every recognized verb in this step is itself
ambiguous among several real actions — e.g. plain "Combine"
(combine.json/combine_dough.json/combine_potato_onion.json/
combine_con_cebolla.json all share the identical verb COMBINE). Reported,
not guessed among — silently picking one would be wrong most of the time
by construction.

The `resolvedInStep` array: ingredient references in THIS step, resolved
to recipe-local instance ids, in the order they appear in the text.

## `translateCooklangDocument`

Parses `source`, resolves ingredients against `entities` (reusing
`importCooklangDraft` rather than re-deriving that matching a second
time), and best-effort-translates each step's prose into a candidate
`RecipeStep` against `actions`' real, closed vocabulary. Always returns —
never throws on an untranslatable step; see the file-level notes above
for exactly what is and isn't attempted, and why.
