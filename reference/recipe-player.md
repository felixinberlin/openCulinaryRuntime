# `src/recipe-player.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Step / revert / variation playback over an already-authored recipe —
added 2026-08-15, directly answering "I want to play a step recipe... go
back and revert it... create variations." Deliberately scoped to THREE of
the four things asked for; the fourth (real simultaneity — multiple
things advancing in time together, e.g. "oil still warming up while I cut
the potatoes") is a genuinely different, larger piece of work —
`ROADMAP.md`'s own still-open "heat as a shared PLACE" entry — deliberately
NOT attempted here, same discipline `architecture_phase4_ticket.md`'s
approval gates already hold this repo to for work that size.

### THE WHOLE DESIGN IS COMPOSITION, ON PURPOSE

Per the explicit request to "defer to other systems as much as possible":

- `runRecipe` (`recipe-runner.ts`) takes a plain `RecipeScript`-typed
  object; it never re-validates against `RecipeScriptSchema` itself. That
  means a WINDOWED recipe — same `initialInventory`/`availableTools`,
  `sequence` truncated to the steps executed so far — can be built and
  passed straight in, with zero changes to that function. "Replay from
  the start through step N" is just array slicing.
- Because `applyAction`/`runRecipe` are pure functions of (recipe prefix,
  initial inventory), REVERT NEEDS NO ROLLBACK MACHINERY — going back one
  step is recomputing a one-shorter slice, not undoing a mutation.
  `RecipePlayerState` only ever stores an INDEX, never a snapshot; the
  previous state is a fully recomputable value, not something the player
  needs to remember.
- `narrateRecipe` (`recipe-narrator.ts`) already computes per-step
  capability resolutions and a real execution log — calling it on the
  SAME windowed slice gives "what did THIS step infer" for free, no new
  inference logic here at all.
- "Is this possible?" (`canApplyNext`) is `runRecipe` on a slice ONE step
  longer than committed, checking whether THAT specific step produced an
  error — reusing every check already inside `applyAction` (tools,
  capabilities, state prerequisites, CCP thresholds) as the feasibility
  oracle. No parallel validation path, and deliberately an ON-DEMAND
  query, not run automatically on every step — matching "asking is this
  possible, sometimes," not always.
- A variation is just an ordinary new `RecipeScript` (shared prefix + a
  different tail) — runnable through every existing tool (`runRecipe`,
  `validate-recipe`, `narrate-recipe`) completely unchanged, not a new
  "branch-aware" runner.

At the real scale of a recipe in this repo (single digits to about a
dozen steps), recomputing a slice from scratch on every navigation is
free — explicitly not worth memoizing or snapshotting for.

## `RecipePlayerState`

- `currentIndex`: -1 = no steps executed yet (current inventory is `initialInventory` as-is). N = `sequence[0..N]` have executed.

## `windowedRecipe`

The windowed sub-recipe for "steps 0..index have executed" — the one
building block everything else in this file composes with. Not exported:
callers should go through the named operations below, which know what to
DO with a window (run it, narrate it, check the next step), rather than
building windows themselves.

## `stepForward`

entities/actions/ccps aren't actually needed to advance the index — kept
in the signature (unused) so every navigation function has the same
shape and a caller doesn't need to remember which ones need the catalogs
and which don't. Advancing past the end is a no-op, not an error: a
player already at the end asking to step forward again is a normal
query, not a mistake.

## `currentNarration`

`null` at `currentIndex === -1` — nothing has run yet, there is nothing
to narrate. Otherwise `narrateRecipe` on the windowed slice, reusing that
module entirely rather than re-deriving any of its per-step inference.

## `canApplyNext`

The on-demand "is this possible?" primitive — deliberately not run
automatically on every step (see the file-level notes above). Reuses
`runRecipe`'s own error for the next step verbatim as `reason`; does not
reimplement any of `applyAction`'s checks.

## `createVariation`

A shared prefix (`sequence.slice(0, branchAfterIndex + 1)`) plus a
different tail — an ordinary new `RecipeScript`, not a new branch-aware
data structure. `branchAfterIndex: -1` means branch from the very start
(an entirely different `sequence`, same initial inventory).
