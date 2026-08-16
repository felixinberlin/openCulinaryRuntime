import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { runRecipe } from "./recipe-runner.ts";
import { narrateRecipe, type RecipeNarration } from "./recipe-narrator.ts";

/**
 * Step / revert / variation playback over an already-authored recipe —
 * added 2026-08-15, directly answering "I want to play a step recipe...
 * go back and revert it... create variations." Deliberately scoped to
 * THREE of the four things asked for; the fourth (real simultaneity —
 * multiple things advancing in time together, e.g. "oil still warming up
 * while I cut the potatoes") is a genuinely different, larger piece of
 * work — `ROADMAP.md`'s own still-open "heat as a shared PLACE" entry —
 * deliberately NOT attempted here, same discipline
 * `architecture_phase4_ticket.md`'s approval gates already hold this
 * repo to for work that size.
 *
 * THE WHOLE DESIGN IS COMPOSITION, ON PURPOSE — per the explicit request
 * to "defer to other systems as much as possible":
 *
 * - `runRecipe` (`recipe-runner.ts`) takes a plain `RecipeScript`-typed
 *   object; it never re-validates against `RecipeScriptSchema` itself.
 *   That means a WINDOWED recipe — same `initialInventory`/
 *   `availableTools`, `sequence` truncated to the steps executed so
 *   far — can be built and passed straight in, with zero changes to
 *   that function. "Replay from the start through step N" is just
 *   array slicing.
 * - Because `applyAction`/`runRecipe` are pure functions of (recipe
 *   prefix, initial inventory), REVERT NEEDS NO ROLLBACK MACHINERY —
 *   going back one step is recomputing a one-shorter slice, not undoing
 *   a mutation. `RecipePlayerState` only ever stores an INDEX, never a
 *   snapshot; the previous state is a fully recomputable value, not
 *   something the player needs to remember.
 * - `narrateRecipe` (`recipe-narrator.ts`) already computes per-step
 *   capability resolutions and a real execution log — calling it on the
 *   SAME windowed slice gives "what did THIS step infer" for free, no
 *   new inference logic here at all.
 * - "Is this possible?" (`canApplyNext`) is `runRecipe` on a slice ONE
 *   step longer than committed, checking whether THAT specific step
 *   produced an error — reusing every check already inside
 *   `applyAction` (tools, capabilities, state prerequisites, CCP
 *   thresholds) as the feasibility oracle. No parallel validation path,
 *   and deliberately an ON-DEMAND query, not run automatically on every
 *   step — matching "asking is this possible, sometimes," not always.
 * - A variation is just an ordinary new `RecipeScript` (shared prefix +
 *   a different tail) — runnable through every existing tool
 *   (`runRecipe`, `validate-recipe`, `narrate-recipe`) completely
 *   unchanged, not a new "branch-aware" runner.
 *
 * At the real scale of a recipe in this repo (single digits to about a
 * dozen steps), recomputing a slice from scratch on every navigation is
 * free — explicitly not worth memoizing or snapshotting for.
 */

export interface RecipePlayerState {
  recipe: RecipeScript;
  /** -1 = no steps executed yet (current inventory is `initialInventory`
   *  as-is). N = `sequence[0..N]` have executed. */
  currentIndex: number;
}

export function createPlayer(recipe: RecipeScript): RecipePlayerState {
  return { recipe, currentIndex: -1 };
}

function clampIndex(recipe: RecipeScript, index: number): number {
  return Math.max(-1, Math.min(index, recipe.sequence.length - 1));
}

/** The windowed sub-recipe for "steps 0..index have executed" — the one
 *  building block everything else in this file composes with. Not
 *  exported: callers should go through the named operations below,
 *  which know what to DO with a window (run it, narrate it, check the
 *  next step), rather than building windows themselves. */
function windowedRecipe(recipe: RecipeScript, index: number): RecipeScript {
  return { ...recipe, sequence: recipe.sequence.slice(0, index + 1) };
}

export function stepForward(
  player: RecipePlayerState,
  _entities: Map<string, Entity>,
  _actions: Map<string, Action>,
  _ccps?: Map<string, CriticalControlPoint>
): RecipePlayerState {
  // entities/actions/ccps aren't actually needed to advance the index —
  // kept in the signature (unused) so every navigation function has the
  // same shape and a caller doesn't need to remember which ones need
  // the catalogs and which don't. Advancing past the end is a no-op,
  // not an error: a player already at the end asking to step forward
  // again is a normal query, not a mistake.
  return { ...player, currentIndex: clampIndex(player.recipe, player.currentIndex + 1) };
}

export function stepBackward(player: RecipePlayerState): RecipePlayerState {
  return { ...player, currentIndex: clampIndex(player.recipe, player.currentIndex - 1) };
}

export function jumpTo(player: RecipePlayerState, index: number): RecipePlayerState {
  return { ...player, currentIndex: clampIndex(player.recipe, index) };
}

/** `null` at `currentIndex === -1` — nothing has run yet, there is
 *  nothing to narrate. Otherwise `narrateRecipe` on the windowed slice,
 *  reusing that module entirely rather than re-deriving any of its
 *  per-step inference. */
export function currentNarration(
  player: RecipePlayerState,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps?: Map<string, CriticalControlPoint>
): RecipeNarration | null {
  if (player.currentIndex === -1) return null;
  return narrateRecipe(windowedRecipe(player.recipe, player.currentIndex), entities, actions, ccps);
}

export interface Feasibility {
  possible: boolean;
  reason?: string;
}

/** The on-demand "is this possible?" primitive — deliberately not run
 *  automatically on every step (see this file's own doc comment).
 *  Reuses `runRecipe`'s own error for the next step verbatim as
 *  `reason`; does not reimplement any of `applyAction`'s checks. */
export function canApplyNext(
  player: RecipePlayerState,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps?: Map<string, CriticalControlPoint>
): Feasibility {
  const nextIndex = player.currentIndex + 1;
  if (nextIndex >= player.recipe.sequence.length) {
    return { possible: false, reason: "Already at the last step — there is no next step." };
  }
  const result = runRecipe(windowedRecipe(player.recipe, nextIndex), entities, actions, ccps);
  const errorForNextStep = result.errors.find((e) => e.step === player.recipe.sequence[nextIndex]);
  if (errorForNextStep) {
    return { possible: false, reason: errorForNextStep.message };
  }
  return { possible: true };
}

/**
 * A shared prefix (`sequence.slice(0, branchAfterIndex + 1)`) plus a
 * different tail — an ordinary new `RecipeScript`, not a new branch-
 * aware data structure. `branchAfterIndex: -1` means branch from the
 * very start (an entirely different `sequence`, same initial inventory).
 */
export function createVariation(
  recipe: RecipeScript,
  branchAfterIndex: number,
  newTailSequence: RecipeStep[],
  variationSuffix = "variation"
): RecipeScript {
  const prefix = recipe.sequence.slice(0, branchAfterIndex + 1);
  const sequence = [...prefix, ...newTailSequence];
  if (sequence.length === 0) {
    throw new Error(
      "createVariation: the resulting sequence would be empty (RecipeScriptSchema requires at least one step)."
    );
  }
  return {
    ...recipe,
    id: `${recipe.id}_${variationSuffix}`,
    names: Object.fromEntries(
      Object.entries(recipe.names).map(([lang, name]) => [lang, `${name} (${variationSuffix})`])
    ),
    sequence,
  };
}
