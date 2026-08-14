import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { applyAction, type Instance, type SafetyPolicy } from "./engine.ts";

/**
 * Walks a RecipeScript's sequence against engine.ts's applyAction, the way
 * CLAUDE_DEV_CTX.md's reference OcrValidationEngine walks recipe.sequence —
 * but built on the capability/parameter/tag model this codebase actually
 * has, not that reference's INVALID_TRANSITIONS matrix (still Phase 4).
 *
 * A step's failure does not halt the recipe: it's recorded in `errors` and
 * the run continues, mirroring the reference engine's "collect all errors,
 * then report" behavior rather than throwing on the first problem.
 *
 * `RecipeStep.secondaryInstanceId` (COMBINE-shaped actions, engine.ts's
 * `secondaryInstance`) is resolved from inventory the same way
 * `targetInstanceId` is, and removed from inventory afterward if
 * `result.secondaryDestroyed` — the same treatment `destroyed` already gets
 * for the primary target.
 */

export interface RecipeStepError {
  step: RecipeStep;
  message: string;
}

export interface RecipeRunResult {
  finalInventory: Map<string, Instance>;
  errors: RecipeStepError[];
  log: string[];
  /** Non-fatal HACCP notices collected across the whole run — see
   *  engine.ts's ExecutionResult.warnings / advisoryOnly CCPs. */
  warnings: string[];
}

export function runRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy
): RecipeRunResult {
  const inventory = new Map<string, Instance>();
  for (const item of recipe.initialInventory) {
    inventory.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }

  const availableTools = new Set(recipe.availableTools);
  const log: string[] = [];
  const errors: RecipeStepError[] = [];
  const warnings: string[] = [];
  let spawnCounter = 0;

  for (const step of recipe.sequence) {
    const action = actions.get(step.actionId);
    const instance = inventory.get(step.targetInstanceId);

    if (!action) {
      errors.push({ step, message: `Unknown action "${step.actionId}"` });
      continue;
    }
    if (!instance) {
      errors.push({ step, message: `Unknown target instance "${step.targetInstanceId}"` });
      continue;
    }
    let secondaryInstance: Instance | undefined;
    if (step.secondaryInstanceId) {
      secondaryInstance = inventory.get(step.secondaryInstanceId);
      if (!secondaryInstance) {
        errors.push({ step, message: `Unknown secondary instance "${step.secondaryInstanceId}"` });
        continue;
      }
    }

    // Same "unknown id -> loud step error" treatment targetInstanceId/
    // secondaryInstanceId already get above, applied here for the identical
    // reason — a typo'd/stale availableIngredientInstanceIds entry used to
    // be silently dropped from the Set instead, which could mask a real
    // authoring mistake in TWO ways: the step could still pass (if some
    // OTHER listed instance happened to satisfy requiredIngredientCapabilities
    // anyway, hiding that the intended one was never actually checked) or
    // fail with a generic "no qualifying ingredient on hand" error that
    // never named the actual typo as the cause. A stale reference to an
    // instance id that was never declared/spawned is always an authoring
    // bug, never a legitimate state — worth failing loudly every time, not
    // only on the runs where it happens to matter.
    const availableIngredientEntityIds = new Set<string>();
    let hasUnknownIngredientInstance = false;
    for (const id of step.availableIngredientInstanceIds) {
      const ingredientInstance = inventory.get(id);
      if (!ingredientInstance) {
        errors.push({ step, message: `Unknown ingredient instance "${id}" in availableIngredientInstanceIds` });
        hasUnknownIngredientInstance = true;
        continue;
      }
      availableIngredientEntityIds.add(ingredientInstance.entityId);
    }
    if (hasUnknownIngredientInstance) {
      continue;
    }

    try {
      const result = applyAction(
        instance,
        action,
        entities,
        availableTools,
        step.params,
        availableIngredientEntityIds,
        ccps,
        policy,
        secondaryInstance
      );
      const tagsLabel = result.instance.tags.length ? `, tags [${result.instance.tags}]` : "";
      for (const warning of result.warnings) {
        warnings.push(warning);
        log.push(`  WARNING: ${warning}`);
      }
      if (result.destroyed) {
        inventory.delete(step.targetInstanceId);
        log.push(
          `${action.verb} ${step.targetInstanceId}: state "${instance.state}" -> "${result.instance.state}"${tagsLabel} (destroyed — conservation of mass)`
        );
      } else {
        inventory.set(step.targetInstanceId, result.instance);
        log.push(
          `${action.verb} ${step.targetInstanceId}: state "${instance.state}" -> "${result.instance.state}"${tagsLabel}`
        );
      }
      if (result.secondaryDestroyed && step.secondaryInstanceId) {
        inventory.delete(step.secondaryInstanceId);
        log.push(`  consumed secondary instance ${step.secondaryInstanceId} (${secondaryInstance!.entityId})`);
      }
      for (const spawned of result.spawned) {
        const spawnedId = `${spawned.entityId}-${++spawnCounter}`;
        inventory.set(spawnedId, spawned);
        log.push(`  spawned ${spawnedId} (${spawned.entityId}, state: "${spawned.state}")`);
      }
    } catch (err) {
      const message = (err as Error).message;
      errors.push({ step, message });
      log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
    }
  }

  return { finalInventory: inventory, errors, log, warnings };
}
