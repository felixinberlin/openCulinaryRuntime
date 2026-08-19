import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { applyAction, type Instance, type SafetyPolicy } from "./engine.ts";
import { resolveDefaultParamValue } from "./planner.ts";

/**
 * "Which of this entity's own `allowedTransformations` can I press right
 * now, and why not the rest?" — a sandbox-UI primitive. Deliberately NOT
 * built on `reachability.ts`'s `enumerateEdges`: that function correctly
 * reports a COMBINE-shaped or destructive action as a graph-search dead
 * end (nothing to continue a *path* from), which is the wrong answer for
 * "is this button pressable" — SEPARATE/COMBINE/etc. are perfectly
 * executable via `applyAction`, just not continuable in a reachability
 * search. Instead this dry-runs the real `applyAction` (pure — never
 * mutates `instance`) per candidate action and reuses its thrown `Error`
 * message verbatim as the reason, the same precedent `recipe-player.ts`'s
 * `canApplyNext` already established for "is this possible?" queries. See
 * `SIMULATOR_API.md`.
 */

export interface ApplicableAction {
  actionId: string;
  applicable: boolean;
  /** True for a COMBINE-shaped action (`requiredSecondaryCapability` set) —
   *  the caller must supply a `secondaryInstance` and re-check before this
   *  can ever be `applicable`. */
  requiresSecondaryInstance: boolean;
  /** `applyAction`'s own thrown message, verbatim. Free text, not a typed
   *  `BlockingReason` union like `reachability.ts` — getting a typed
   *  reason for the COMBINE-shaped case would require re-implementing
   *  `enumerateEdges`'s own guard logic. Absent when `applicable` is true. */
  reason?: string;
}

export function listApplicableActions(
  instance: Instance,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  availableTools: ReadonlySet<string>,
  availableIngredients: ReadonlySet<string> = new Set(),
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy,
  secondaryInstance?: Instance
): ApplicableAction[] {
  const entity = entities.get(instance.entityId);
  if (!entity) throw new Error(`Unknown entity "${instance.entityId}"`);

  const results: ApplicableAction[] = [];
  for (const actionId of entity.allowedTransformations) {
    const action = actions.get(actionId);
    if (!action) continue;

    const requiresSecondaryInstance = !!action.requiredSecondaryCapability;
    if (requiresSecondaryInstance && !secondaryInstance) {
      results.push({
        actionId,
        applicable: false,
        requiresSecondaryInstance,
        reason: "requires a second instance to combine with",
      });
      continue;
    }

    const params: Record<string, string> = {};
    for (const param of action.parameters) {
      params[param.id] = resolveDefaultParamValue(param);
    }

    try {
      applyAction(
        instance,
        action,
        entities,
        availableTools,
        params,
        availableIngredients,
        ccps,
        policy,
        requiresSecondaryInstance ? secondaryInstance : undefined
      );
      results.push({ actionId, applicable: true, requiresSecondaryInstance });
    } catch (err) {
      results.push({
        actionId,
        applicable: false,
        requiresSecondaryInstance,
        reason: (err as Error).message,
      });
    }
  }
  return results;
}
