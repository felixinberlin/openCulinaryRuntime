import { z } from "zod";
import { QuantitySchema } from "./ingredient.ts";

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
  /** How much of this instance is present — see QuantitySchema's doc
   *  comment (ingredient.ts) for why this is a 3-kind union, not one
   *  number. Optional: a recipe can still name an instance ("salt-1
   *  exists") without committing to an amount, same as before this field
   *  existed — every recipe authored before 2026-08-13 is unaffected. */
  quantity: QuantitySchema.optional(),
});
export type RecipeInstance = z.infer<typeof RecipeInstanceSchema>;

export const RecipeStepSchema = z.object({
  /**
   * A stable, recipe-local id for THIS STEP (distinct from
   * `targetInstanceId`, which names the INGREDIENT/tool instance the step
   * acts on — one instance can be the target of many steps, so it can't
   * double as a step id). Optional, defaulting via `dag-scheduler.ts`'s
   * `resolveStepId` to the step's own array index (as a string) when
   * absent — every recipe written before this field existed (all 22 real
   * ones as of 2026-08-17) is completely unaffected; `dependsOn` below can
   * still reference an un-id'd step by its index-derived id. See
   * `dag-scheduler.ts`'s own doc comment for the full DAG-execution design
   * this field is part of (ROADMAP.md's "recipe execution as a DAG" entry).
   */
  id: z.string().min(1).optional(),
  /**
   * Recipe-local ids of steps that must complete before this one may
   * begin — `dag-scheduler.ts`'s edges. Optional: when omitted, the step
   * implicitly depends on the immediately preceding step in `sequence`
   * (see `dag-scheduler.ts`'s `deriveDependsOn`) — the exact linear
   * ordering every recipe already had before this field existed, made
   * explicit rather than silently assumed. A step with an EXPLICIT
   * `dependsOn: []` (empty array, not omitted) genuinely has no
   * prerequisite and may run first/concurrently with any other
   * zero-dependency step — the mechanism `garlic-oil-potatoes.json` uses
   * to mark its potato-prep and garlic-prep branches as real, independent
   * work.
   */
  dependsOn: z.array(z.string()).optional(),
  actionId: z.string().min(1),
  /** Recipe-local instance id this step targets — either from initialInventory, or an id spawned by an earlier step. */
  targetInstanceId: z.string().min(1),
  params: z.record(z.string(), z.string()).default({}),
  /** Recipe-local instance ids of secondary ingredients (oil, water, salt, ...) available for this step's requiredIngredientCapabilities check. */
  availableIngredientInstanceIds: z.array(z.string()).default([]),
  /**
   * Recipe-local instance id of the SECOND instance a COMBINE-shaped action
   * consumes (engine.ts's `secondaryInstance` / `requiredSecondaryCapability`)
   * — e.g. the beaten-egg instance id when this step's action is COMBINE and
   * targetInstanceId is the fried-potato instance. Unlike
   * availableIngredientInstanceIds (checked for presence only, never
   * consumed), this instance is destroyed by the step, same as the primary
   * target. Unset for every action that isn't COMBINE-shaped.
   */
  secondaryInstanceId: z.string().optional(),
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

/**
 * `RecipeIntentSchema` — `ROADMAP.md` Phase 4.5's own named authoring
 * format, closed 2026-08-17 alongside `src/planner.ts`'s `planIntent`.
 * Exactly the framing that entry already committed to: "goals/
 * constraints... replacing hand-authored `RecipeScript` as the AUTHORING
 * format. `RecipeScriptSchema` itself doesn't go away — it becomes the
 * planner's grounded output."
 *
 * One goal per targeted instance, resolved by `planner.ts`'s `planIntent`
 * IN ARRAY ORDER — a real, stated simplification, not a general
 * constraint solver: goals aren't reordered or backtracked across each
 * other. `InstanceGoalSchema.instanceId` may reference
 * `"$combineResult:<goalIndex>"` to target what an EARLIER combine-goal
 * produced, the mechanism that lets a full multi-instance dish (fry a
 * potato, prep an egg, combine them, then fry the result) be expressed as
 * one ordered goal list.
 */
export const InstanceGoalSchema = z
  .object({
    /** A `RecipeInstanceSchema.id` from `RecipeIntentSchema.initialInventory`,
     *  or `"$combineResult:<goalIndex>"` referencing an earlier `combine`
     *  goal's own spawned output. */
    instanceId: z.string().min(1),
    state: z.string().optional(),
    requiredTags: z.array(z.string()).default([]),
    /**
     * When set, this goal is satisfied by COMBINING `instanceId` (the
     * primary) with `secondaryInstanceId` via `actionId`, rather than by
     * `instanceId`'s own state/tags search alone — `planner.ts`'s
     * `planCombine`. `secondaryDesiredState`/`secondaryDesiredTags` are
     * OPTIONAL and NOT anything `engine.ts` itself requires
     * (`planSecondaryRole`'s own doc comment: `requiredSecondaryCapability`
     * is checked at the entity level only, never against the secondary
     * instance's current state) — they exist so a planned recipe can still
     * be a REALISTIC one (a genuinely beaten egg) rather than a merely
     * engine-legal one.
     */
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
