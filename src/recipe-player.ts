import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { runRecipe } from "./recipe-runner.ts";
import { narrateRecipe, type RecipeNarration } from "./recipe-narrator.ts";

/**
 * Step / revert / variation playback over an already-authored recipe.
 * Entirely composition, no new machinery: a "window" is `recipe.sequence`
 * truncated to the executed steps so far; `runRecipe`/`narrateRecipe` run
 * unmodified against that window. Revert needs no rollback — going back
 * is recomputing a shorter slice. A variation is an ordinary new
 * `RecipeScript` (shared prefix + a different tail). Real simultaneity
 * (multiple things advancing in time together) is out of scope. See
 * `reference/recipe-player.md` for design rationale and scope.
 */

export interface RecipePlayerState {
  recipe: RecipeScript;
  /** -1 = no steps executed yet. N = `sequence[0..N]` have executed. */
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
 *  exported; callers go through the named operations below. */
function windowedRecipe(recipe: RecipeScript, index: number): RecipeScript {
  return { ...recipe, sequence: recipe.sequence.slice(0, index + 1) };
}

export function stepForward(
  player: RecipePlayerState,
  _entities: Map<string, Entity>,
  _actions: Map<string, Action>,
  _ccps?: Map<string, CriticalControlPoint>
): RecipePlayerState {
  // entities/actions/ccps aren't needed to advance the index — kept for
  // a uniform signature across navigation functions. Advancing past the
  // end is a no-op, not an error.
  return { ...player, currentIndex: clampIndex(player.recipe, player.currentIndex + 1) };
}

export function stepBackward(player: RecipePlayerState): RecipePlayerState {
  return { ...player, currentIndex: clampIndex(player.recipe, player.currentIndex - 1) };
}

export function jumpTo(player: RecipePlayerState, index: number): RecipePlayerState {
  return { ...player, currentIndex: clampIndex(player.recipe, index) };
}

/** `null` at `currentIndex === -1` — nothing has run yet. Otherwise
 *  `narrateRecipe` on the windowed slice. */
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

/** The on-demand "is this possible?" primitive — reuses `runRecipe`'s
 *  own error for the next step verbatim as `reason`. See
 *  `reference/recipe-player.md`. */
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

/** A shared prefix plus a different tail — an ordinary new
 *  `RecipeScript`. `branchAfterIndex: -1` means branch from the very start. */
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
