import { z } from "zod";
import { QuantitySchema } from "./ingredient.ts";

/**
 * The compiled recipe container: initial inventory (instances that exist
 * before the recipe starts) plus a linear sequence of steps to run
 * against engine.ts's applyAction. Commits to the linear step-sequence
 * track from CLAUDE_DEV_CTX.md rather than CONCEPT.md §12's goal-based
 * track. See `reference/recipe.md` for design rationale and history.
 */

/** One instance present before the recipe starts, keyed by a recipe-local
 *  id (not the entity id — a recipe could use two potatoes). */
export const RecipeInstanceSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1),
  state: z.string(),
  tags: z.array(z.string()).default([]),
  /** How much of this instance is present — see QuantitySchema
   *  (ingredient.ts). Optional: a recipe can still name an instance
   *  without committing to an amount. */
  quantity: QuantitySchema.optional(),
});
export type RecipeInstance = z.infer<typeof RecipeInstanceSchema>;

export const RecipeStepSchema = z.object({
  /** A stable, recipe-local id for THIS STEP (distinct from
   *  `targetInstanceId`). Optional, defaulting via `dag-scheduler.ts`'s
   *  `resolveStepId` to the step's own array index when absent. See
   *  `reference/recipe.md`. */
  id: z.string().min(1).optional(),
  /** Recipe-local ids of steps that must complete before this one may
   *  begin — `dag-scheduler.ts`'s edges. Optional: when omitted, the step
   *  implicitly depends on the immediately preceding step in `sequence`.
   *  An EXPLICIT `dependsOn: []` genuinely has no prerequisite. See
   *  `reference/recipe.md`. */
  dependsOn: z.array(z.string()).optional(),
  actionId: z.string().min(1),
  /** Recipe-local instance id this step targets — either from
   *  initialInventory, or an id spawned by an earlier step. */
  targetInstanceId: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
  /** Recipe-local instance ids of secondary ingredients (oil, water,
   *  salt, ...) available for this step's requiredIngredientCapabilities check. */
  availableIngredientInstanceIds: z.array(z.string()).default([]),
  /** Recipe-local instance id of the SECOND instance a COMBINE-shaped
   *  action consumes (engine.ts's `secondaryInstance`). Destroyed by the
   *  step, same as the primary target. Unset for non-COMBINE actions. */
  secondaryInstanceId: z.string().optional(),
});
export type RecipeStep = z.infer<typeof RecipeStepSchema>;

export const RecipeScriptSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  initialInventory: z.array(RecipeInstanceSchema).min(1),
  /** Tool entity ids available throughout the whole recipe (not per-step). */
  availableTools: z.array(z.string()).default([]),
  sequence: z.array(RecipeStepSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecipeScript = z.infer<typeof RecipeScriptSchema>;

/**
 * The goal-based authoring format `planner.ts`'s `planIntent` compiles
 * into a `RecipeScript` — ROADMAP.md Phase 4.5. One goal per targeted
 * instance, resolved IN ARRAY ORDER (not a general constraint solver).
 * `InstanceGoalSchema.instanceId` may reference
 * `"$combineResult:<goalIndex>"` to target an earlier combine-goal's
 * output. See `reference/recipe.md`.
 */
export const InstanceGoalSchema = z
  .object({
    /** A `RecipeInstanceSchema.id` from initialInventory, or
     *  `"$combineResult:<goalIndex>"` referencing an earlier `combine`
     *  goal's own spawned output. */
    instanceId: z.string().min(1),
    state: z.string().optional(),
    requiredTags: z.array(z.string()).default([]),
    /** When set, this goal is satisfied by COMBINING `instanceId` with
     *  `secondaryInstanceId` via `actionId` — `planner.ts`'s
     *  `planCombine`. `secondaryDesiredState`/`secondaryDesiredTags` are
     *  optional and not required by `engine.ts` itself; they exist so a
     *  planned recipe is realistic, not just engine-legal. See
     *  `reference/recipe.md`. */
    combine: z
      .object({
        actionId: z.string().min(1),
        secondaryInstanceId: z.string().min(1),
        secondaryDesiredState: z.string().optional(),
        secondaryDesiredTags: z.array(z.string()).default([]),
      })
      .optional(),
  })
  .refine((g) => g.state !== undefined || g.requiredTags.length > 0 || g.combine !== undefined, {
    message: "a goal must specify state, requiredTags, or combine",
  });
export type InstanceGoal = z.infer<typeof InstanceGoalSchema>;

export const RecipeIntentSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  initialInventory: z.array(RecipeInstanceSchema).min(1),
  availableTools: z.array(z.string()).default([]),
  goals: z.array(InstanceGoalSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RecipeIntent = z.infer<typeof RecipeIntentSchema>;
