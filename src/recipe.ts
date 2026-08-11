import { z } from "zod";

/**
 * RecipeScriptSchema — Roadmap Phase 3, the compiled recipe container:
 * initial inventory (instances that exist before the recipe starts) plus a
 * linear sequence of steps to run against engine.ts's applyAction.
 *
 * This commits to the linear step-sequence track from CLAUDE_DEV_CTX.md
 * (matching its reference OcrValidationEngine, which walks recipe.sequence
 * in order) rather than CONCEPT.md §12's goal-based/event-sourced track —
 * that fork is still unreconciled (see the note at the top of CONCEPT.md).
 * Every piece of engine work so far (engine.ts's applyAction) has been
 * built toward this side, so this file continues it rather than picking
 * the fork back up unprompted.
 */

/** One instance present before the recipe starts, keyed by a recipe-local id (not the entity id — a recipe could use two potatoes). */
export const RecipeInstanceSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  state: z.string(),
  tags: z.array(z.string()).default([]),
});
export type RecipeInstance = z.infer<typeof RecipeInstanceSchema>;

export const RecipeStepSchema = z.object({
  actionId: z.string().min(1),
  /** Recipe-local instance id this step targets — either from initialInventory, or an id spawned by an earlier step. */
  targetInstanceId: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
  /** Recipe-local instance ids of secondary ingredients (oil, water, salt, ...) available for this step's requiredIngredientCapabilities check. */
  availableIngredientInstanceIds: z.array(z.string()).default([]),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const RecipeScriptSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  initialInventory: z.array(RecipeInstanceSchema).min(1),
  /** Tool entity ids available throughout the whole recipe (not per-step — a kitchen's tools don't come and go per step). */
  availableTools: z.array(z.string()).default([]),
  sequence: z.array(RecipeStepSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecipeScript = z.infer<typeof RecipeScriptSchema>;
