import type { Action } from "./action.ts";
import type { Entity } from "./ingredient.ts";
import { requiredHoldSeconds, type CriticalControlPoint } from "./thermal.ts";

/**
 * `ExecutionBound` — TICKET 2 of `PAPER_NOTES_2608.04768.md` (Song, Huang,
 * Sun, Tian, Wang & Li, arXiv:2608.04768, 2026 — `REFERENCES.md`), the
 * direct follow-on to `actionKind` (TICKET 1, `action.ts`, closed
 * 2026-08-16): the paper's own generated control code renders every
 * continuous step as `Step(Continuous, Until(Condition)) with
 * Timeout(120s, ForceNext)` — a sensory termination condition ORed against
 * a hard upper-bound timeout, "derived from empirical cooking experience,"
 * that forces progress if the sensor never fires. That upper bound is
 * `Action.maxDurationSeconds` (`action.ts`).
 *
 * THE ASYMMETRY THIS MODULE EXISTS FOR, not just a convenience wrapper: in
 * the paper's own architecture, a sensory "looks done" signal ends a
 * continuous step outright — there is no floor a sensor cannot override.
 * This repo's CCP machinery (`thermal.ts`, `data/ccps/*.json`) already
 * enforces a REAL microbiological hold-time floor for actions where one
 * applies (an egg needs 15s at 63°C regardless of how quickly it LOOKS
 * cooked) — `ENGINE_INVARIANTS.md` #11 ("a future closed-loop control/
 * perception layer is a separate, larger piece of work") now has a
 * concrete adversary: a plausible-looking early-termination signal arriving
 * BEFORE the safety floor is met. `minSafeHoldSeconds` below is that floor,
 * `maxDurationSeconds` is the paper's ceiling — genuinely different
 * numbers answering genuinely different questions ("how long must this run
 * AT MINIMUM to be safe" vs. "how long may this run AT MOST before
 * something has clearly gone wrong"), not two names for one concept.
 *
 * SAME standalone-module-before-engine-wiring precedent as `place.ts`/
 * `heat-source.ts`/`egg-doneness.ts`: real reference math, provable via a
 * script (`scripts/reject-early-sensory-termination.ts`,
 * `npm run capability-test:execution-bounds`), BEFORE — if ever — being
 * wired into `engine.ts`'s own precondition checks. `applyAction` is
 * UNCHANGED by this module's existence, per this ticket's own explicit
 * acceptance criterion.
 *
 * `minSafeHoldSeconds` is read from the EXISTING CCP machinery only —
 * `target.criticalControlPointsByAction[action.id]`, `ccps.get(ccpId)`,
 * and (when the CCP declares one) `thermal.ts`'s real D/z-value
 * `requiredHoldSeconds` — deliberately NOT a second, parallel source of
 * hold-time truth. The `waterTempC`-only param key this reads to trigger
 * the thermal model is copy-exact from `engine.ts`'s own `applyAction`
 * (not `oilTempC`, even for an oil-medium action like FRY) — a real,
 * PRE-EXISTING narrowness in `engine.ts` itself (FRY's `oilTempC` never
 * actually triggers the D/z computation there either), reproduced
 * faithfully here rather than "fixed" in this module only, which would
 * itself have created the parallel-source-of-truth problem this doc
 * comment just said to avoid. Named, not silently inherited.
 */
export interface ExecutionBound {
  /** The earliest this action may terminate regardless of what a sensor
   *  reports — undefined when no CCP applies to this action/entity pair
   *  (most continuous actions: BEAT, MASH, INFUSE, ... have no
   *  microbiological floor at all, a real and correct absence, not an
   *  oversight). */
  minSafeHoldSeconds?: number;
  /** The paper's own upper bound — `action.maxDurationSeconds`, read
   *  straight off the loaded `Action`, not recomputed here. */
  maxDurationSeconds: number;
  /** True exactly when `minSafeHoldSeconds` is set — i.e., a real CCP
   *  applies, and a sensor-driven executor must not be allowed to end this
   *  step before it, no matter how confident the sensory reading is. */
  floorIsSafetyCritical: boolean;
  /** The CCP's own `source` string (or, when the D/z model actually
   *  computed `minSafeHoldSeconds`, `thermalModel.source`) — not a
   *  `CitationSchema` object, because `CriticalControlPointSchema` itself
   *  doesn't use one (a bespoke `source: string` field, `thermal.ts`); this
   *  matches that shape rather than forcing a conversion. */
  citation?: string;
}

/**
 * Computes the dual bound for one action/entity/params combination.
 * Returns `undefined` when this action isn't `continuous` (an instantaneous
 * action has no do-until loop for a timeout to apply to at all) or hasn't
 * been given a `maxDurationSeconds` (unaudited for this ticket, same
 * "absent means not yet decided" discipline `actionKind` itself uses — see
 * `action.ts`'s own doc comment).
 *
 * Deterministic (`ENGINE_INVARIANTS.md` #9) — a pure function of its
 * arguments, no hidden state, no wall-clock read.
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

      // Exact key/behavior match to engine.ts's applyAction — see this
      // file's own top doc comment for why "waterTempC only" is
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
