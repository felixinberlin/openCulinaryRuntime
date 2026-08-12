import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { applyAction, type Instance } from "./engine.ts";

/**
 * Walks a RecipeScript's sequence against engine.ts's applyAction, the way
 * CLAUDE_DEV_CTX.md's reference OcrValidationEngine walks recipe.sequence —
 * but built on the capability/parameter/tag model this codebase actually
 * has, not that reference's INVALID_TRANSITIONS matrix (still Phase 4).
 *
 * A step's failure does not halt the recipe: it's recorded in `errors` and
 * the run continues, mirroring the reference engine's "collect all errors,
 * then report" behavior rather than throwing on the first problem.
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
  ccps: Map<string, CriticalControlPoint> = new Map()
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

    const availableIngredientEntityIds = new Set(
      step.availableIngredientInstanceIds
        .map((id) => inventory.get(id)?.entityId)
        .filter((id): id is string => id !== undefined)
    );

    try {
      const result = applyAction(instance, action, entities, availableTools, step.params, availableIngredientEntityIds, ccps);
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
