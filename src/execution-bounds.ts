import type { Action } from "./action.ts";
import type { Entity } from "./ingredient.ts";
import { requiredHoldSeconds, type CriticalControlPoint } from "./thermal.ts";

/**
 * The dual bound a continuous action's do-until loop must respect: a
 * safety floor (`minSafeHoldSeconds`, read from this repo's existing CCP
 * machinery) that a plausible sensory "looks done" signal must not be
 * allowed to override, and an upper-bound forced timeout
 * (`maxDurationSeconds`, `action.ts`) if the sensor never fires. Genuinely
 * different questions — "how long must this run at minimum to be safe"
 * vs. "how long may this run at most" — not two names for one concept.
 * `engine.ts`'s `applyAction` is unchanged by this module. See
 * `reference/execution-bounds.md` for design rationale, history, and
 * citations.
 */
export interface ExecutionBound {
  /** The earliest this action may terminate regardless of what a sensor
   *  reports — undefined when no CCP applies to this action/entity pair. */
  minSafeHoldSeconds?: number;
  /** The upper bound — `action.maxDurationSeconds`, read straight off the
   *  loaded `Action`, not recomputed here. */
  maxDurationSeconds: number;
  /** True exactly when `minSafeHoldSeconds` is set — a sensor-driven
   *  executor must not be allowed to end this step before it. */
  floorIsSafetyCritical: boolean;
  /** The CCP's own `source` string (or `thermalModel.source` when the D/z
   *  model computed `minSafeHoldSeconds`). */
  citation?: string;
}

/**
 * Computes the dual bound for one action/entity/params combination.
 * Returns `undefined` when the action isn't `continuous` or has no
 * `maxDurationSeconds`. Deterministic — a pure function of its arguments.
 * See `reference/execution-bounds.md`.
 */
export function executionBoundFor(
  action: Action,
  targetEntity: Entity,
  params: Readonly<Record<string, string>>,
  ccps: ReadonlyMap<string, CriticalControlPoint>
): ExecutionBound | undefined {
  if (action.actionKind !== "continuous" || action.maxDurationSeconds === undefined) {
    return undefined;
  }

  let minSafeHoldSeconds: number | undefined;
  let citation: string | undefined;

  const ccpId = targetEntity.criticalControlPointsByAction[action.id];
  if (ccpId) {
    const ccp = ccps.get(ccpId);
    if (ccp) {
      minSafeHoldSeconds = ccp.heldSeconds;
      citation = ccp.source;

      // Exact key/behavior match to engine.ts's applyAction — see
      // reference/execution-bounds.md for why "waterTempC only" is
      // deliberately reproduced, not generalized, here.
      const waterTempRaw = params["waterTempC"];
      if (ccp.thermalModel && waterTempRaw !== undefined) {
        const actualTempC = Number(waterTempRaw);
        if (!Number.isNaN(actualTempC)) {
          minSafeHoldSeconds = requiredHoldSeconds(ccp.thermalModel, actualTempC);
          citation = ccp.thermalModel.source;
        }
      }
    }
  }

  return {
    minSafeHoldSeconds,
    maxDurationSeconds: action.maxDurationSeconds,
    floorIsSafetyCritical: minSafeHoldSeconds !== undefined,
    citation,
  };
}
