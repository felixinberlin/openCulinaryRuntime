import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { CriticalControlPoint } from "./thermal.ts";

/**
 * Minimal execution engine — applies one canonical Action to one instance.
 *
 * This is a stepping stone toward ROADMAP.md Phase 4's full
 * `OcrValidationEngine` (a full INVALID_TRANSITIONS forbidden-transition
 * matrix, HACCP, an ordered recipe sequence). It checks: the target
 * entity's capability, required tools being on hand, `Entity.statePrerequisites`
 * (a narrower per-action "must already be in this state first" precondition,
 * e.g. potato.json: cut requires "peeled"), the action's declared
 * `parameters` (e.g. CUT's "shape"), and — new — `requiredIngredientCapabilities`
 * (e.g. FRY needs some available ingredient with isFryingMedium, like oil).
 * It does NOT yet check arbitrary forbidden state transitions in general
 * (e.g. nothing here stops peeling an already-boiled potato) — that needs
 * the fuller transition table Phase 4 will add. It also only checks that a
 * qualifying ingredient is *present*, not consume/decrement it — real
 * quantity tracking belongs to Phase 4's recipe-level inventory.
 *
 * `state` and `tags` are deliberately separate: `state` is the one
 * mutually-exclusive form/cooking-method value (raw/washed/.../boiled/
 * fried/...), while `tags` holds any number of orthogonal properties
 * (e.g. "salted") that coexist with whatever the current state is — see
 * ActionOutputsSchema.addsTag in action.ts.
 *
 * `ExecutionResult.destroyed` (driven by `action.outputs.destroysTarget`)
 * is the conservation-of-mass case CLAUDE_DEV_CTX.md and ROADMAP.md Phase 4
 * call out: e.g. SEPARATE on an egg — the caller (recipe-runner.ts) must
 * drop the target from inventory instead of writing `instance` back, while
 * still spawning `spawned` in its place. This engine only implements that
 * for a single explicit action's target; it is not the general "decrement
 * quantities against an arbitrary inventory" system Phase 4 ultimately
 * wants.
 *
 * HACCP (ROADMAP.md Phase 2/4, thermal.ts): if the target entity names a
 * CriticalControlPoint for this action (`criticalControlPointsByAction`,
 * ingredient.ts) and the step supplied a "durationSeconds" parameter, that
 * duration is checked against the CCP's `heldSeconds`. This engine does
 * NOT simulate heat transfer — it has no model of the actual internal
 * temperature reached, only the declared cook time. The check therefore
 * rests on an explicit, stated assumption: any heat level a cook would
 * plausibly use for this action (a hot pan, simmering water) is already
 * well above the CCP's `heldC` floor, so elapsed time is the binding
 * constraint, not temperature. That assumption is only reasonable for
 * thin, fast-heating preparations (a fried/poached/scrambled egg, a few
 * millimeters through) where the coldest point still heats quickly — it
 * would NOT hold for a thick dish (a baked egg casserole) where the
 * center can lag the surface by minutes; nothing here should be reused
 * for that case without revisiting this assumption first.
 *
 * A shortfall throws unless the CCP is `advisoryOnly`, in which case it's
 * appended to `ExecutionResult.warnings` instead — the FDA Food Code's
 * actual "increased risk, permitted with disclosure" posture for e.g. a
 * runny egg yolk, not a hard ban.
 */

export interface Instance {
  entityId: string;
  state: string;
  tags: string[];
}

export interface ExecutionResult {
  /** The target's state/tags right before this action finished — still
   *  populated even when `destroyed` is true, for logging purposes; the
   *  caller must not write it back into inventory in that case. */
  instance: Instance;
  spawned: Instance[];
  /** True when `action.outputs.destroysTarget` fired: the caller must
   *  remove the target from inventory rather than keep `instance`. */
  destroyed: boolean;
  /** Non-fatal HACCP notices (see the CCP paragraph in the file doc
   *  comment above) — e.g. a duration below an advisoryOnly CCP's
   *  heldSeconds. Empty when no CCP applies or the threshold was met. */
  warnings: string[];
}

export function applyAction(
  instance: Instance,
  action: Action,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  params: Readonly<Record<string, string>> = {},
  availableIngredients: ReadonlySet<string> = new Set(),
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map()
): ExecutionResult {
  const target = entities.get(instance.entityId);
  if (!target) {
    throw new Error(`Unknown entity "${instance.entityId}"`);
  }

  if (!action.validTargetKinds.includes(target.kind)) {
    throw new Error(`${action.verb} cannot target entity kind "${target.kind}" ("${target.id}")`);
  }

  const requiredPriorState = target.statePrerequisites[action.id];
  if (requiredPriorState && instance.state !== requiredPriorState) {
    throw new Error(
      `${action.verb} requires "${target.id}" to already be "${requiredPriorState}" (currently "${instance.state}").`
    );
  }

  if (action.requiredTargetCapability) {
    const has = target.capabilities[action.requiredTargetCapability];
    if (has !== true) {
      const why = has === false ? "explicitly false" : "unasserted";
      throw new Error(
        `${action.verb} requires capability "${action.requiredTargetCapability}" on "${target.id}", but it is ${why}.`
      );
    }
  }

  for (const toolId of action.requiredTools) {
    if (!availableTools.has(toolId)) {
      throw new Error(`${action.verb} requires tool "${toolId}", which is not available.`);
    }
  }

  for (const capability of action.requiredIngredientCapabilities) {
    const satisfied = [...availableIngredients].some(
      (id) => entities.get(id)?.capabilities[capability] === true
    );
    if (!satisfied) {
      throw new Error(
        `${action.verb} requires an available ingredient with capability "${capability}", but none is on hand.`
      );
    }
  }

  for (const param of action.parameters) {
    const value = params[param.id];
    if (value === undefined) {
      if (param.required) {
        const allowed = param.allowedValues
          ? `one of ${param.allowedValues.join(", ")}`
          : `a number between ${param.numericRange!.min} and ${param.numericRange!.max} ${param.numericRange!.unit}`;
        throw new Error(`${action.verb} requires a "${param.id}" parameter: ${allowed}.`);
      }
      continue;
    }
    if (param.allowedValues) {
      if (!param.allowedValues.includes(value)) {
        throw new Error(
          `${action.verb} got "${param.id}: ${value}", but only ${param.allowedValues.join(", ")} are valid.`
        );
      }
    } else {
      const range = param.numericRange!;
      const num = Number(value);
      if (Number.isNaN(num) || num < range.min || num > range.max) {
        throw new Error(
          `${action.verb} got "${param.id}: ${value}", but expected a number between ${range.min} and ${range.max} ${range.unit}.`
        );
      }
    }
  }

  let nextState = instance.state;
  if (action.outputs.transformedState) {
    nextState = action.outputs.transformedState;
  } else if (action.outputs.transformedStateFromParameter) {
    const value = params[action.outputs.transformedStateFromParameter];
    if (value === undefined) {
      // Only reachable if that parameter was declared optional; a required
      // one is already guaranteed present by the loop above.
      throw new Error(
        `${action.verb} needs "${action.outputs.transformedStateFromParameter}" to determine the resulting state.`
      );
    }
    nextState = value;
  }

  let nextTags = instance.tags;
  if (action.outputs.addsTag && !instance.tags.includes(action.outputs.addsTag)) {
    nextTags = [...instance.tags, action.outputs.addsTag];
  }

  const updated: Instance = { entityId: instance.entityId, state: nextState, tags: nextTags };

  const spawned: Instance[] = [];
  if (action.outputs.spawnsTargetByproducts) {
    const byproductIds = target.byproductsByAction[action.id] ?? target.producedByproducts;
    for (const byproductId of byproductIds) {
      const byproductEntity = entities.get(byproductId);
      spawned.push({
        entityId: byproductId,
        state: byproductEntity?.possibleStates[0] ?? "raw",
        tags: [],
      });
    }
  }

  // Gated on durationSeconds actually being supplied, not merely on the
  // target having a criticalControlPointsByAction entry: durationSeconds is
  // an optional parameter, and CCP checking is opt-in along with it. A
  // caller that never passes a duration (or never loads/passes `ccps` at
  // all) sees zero behavior change — this must stay true for every
  // pre-existing call site that fries/pokes an egg without caring about
  // HACCP timing.
  const warnings: string[] = [];
  const durationRaw = params["durationSeconds"];
  if (durationRaw !== undefined) {
    const ccpId = target.criticalControlPointsByAction[action.id];
    if (ccpId) {
      const ccp = ccps.get(ccpId);
      if (!ccp) {
        throw new Error(
          `${action.verb} on "${target.id}" references unknown CriticalControlPoint "${ccpId}" — was ccps not loaded/passed into applyAction?`
        );
      }
      const seconds = Number(durationRaw);
      if (seconds < ccp.heldSeconds) {
        const msg =
          `${action.verb} on "${target.id}": ${seconds}s is below "${ccp.names.en}"'s minimum hold of ` +
          `${ccp.heldSeconds}s at ${ccp.heldC}°C (or ${ccp.instantaneousC}°C instantaneous) for ${ccp.pathogen}. ${ccp.source}`;
        if (ccp.advisoryOnly) {
          warnings.push(msg);
        } else {
          throw new Error(msg);
        }
      }
    }
  }

  return { instance: updated, spawned, destroyed: action.outputs.destroysTarget, warnings };
}
