import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";

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
 */

export interface Instance {
  entityId: string;
  state: string;
  tags: string[];
}

export interface ExecutionResult {
  instance: Instance;
  spawned: Instance[];
}

export function applyAction(
  instance: Instance,
  action: Action,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  params: Readonly<Record<string, string>> = {},
  availableIngredients: ReadonlySet<string> = new Set()
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
        throw new Error(
          `${action.verb} requires a "${param.id}" parameter: one of ${param.allowedValues.join(", ")}.`
        );
      }
      continue;
    }
    if (!param.allowedValues.includes(value)) {
      throw new Error(
        `${action.verb} got "${param.id}: ${value}", but only ${param.allowedValues.join(", ")} are valid.`
      );
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
    for (const byproductId of target.producedByproducts) {
      const byproductEntity = entities.get(byproductId);
      spawned.push({
        entityId: byproductId,
        state: byproductEntity?.possibleStates[0] ?? "raw",
        tags: [],
      });
    }
  }

  return { instance: updated, spawned };
}
