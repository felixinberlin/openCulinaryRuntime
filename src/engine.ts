import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";

/**
 * Minimal execution engine — applies one canonical Action to one instance.
 *
 * This is a stepping stone toward ROADMAP.md Phase 4's full
 * `OcrValidationEngine` (a full INVALID_TRANSITIONS forbidden-transition
 * matrix, HACCP, an ordered recipe sequence). It checks: the target
 * entity's capability, required tools being on hand, and — new —
 * `Entity.statePrerequisites`, a narrower per-action "must already be in
 * this state first" precondition (e.g. potato.json: cut requires "peeled").
 * It does NOT yet check arbitrary forbidden state transitions in general
 * (e.g. nothing here stops peeling an already-boiled potato) — that needs
 * the fuller transition table Phase 4 will add.
 */

export interface Instance {
  entityId: string;
  state: string;
}

export interface ExecutionResult {
  instance: Instance;
  spawned: Instance[];
}

export function applyAction(
  instance: Instance,
  action: Action,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>
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

  const updated: Instance = {
    entityId: instance.entityId,
    state: action.outputs.transformedState ?? instance.state,
  };

  const spawned: Instance[] = [];
  if (action.outputs.spawnsTargetByproducts) {
    for (const byproductId of target.producedByproducts) {
      const byproductEntity = entities.get(byproductId);
      spawned.push({
        entityId: byproductId,
        state: byproductEntity?.possibleStates[0] ?? "raw",
      });
    }
  }

  return { instance: updated, spawned };
}
