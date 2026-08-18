import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import { requiredHoldSeconds, type CriticalControlPoint } from "./thermal.ts";

/**
 * Minimal execution engine — applies one canonical Action to one instance:
 * checks capability/tool/state/parameter/ingredient preconditions and
 * forbidden-transition rules, computes the resulting state/tags, handles
 * byproduct spawning and COMBINE-shaped merges, and enforces any linked
 * HACCP critical control point. See `reference/engine.md` for design
 * rationale, history, and citations.
 */

export interface Instance {
  entityId: string;
  state: string;
  tags: string[];
}

/**
 * Execution policy for who's actually driving: under "human" (default) an
 * advisoryOnly CCP shortfall warns-and-continues; under "autonomous" the
 * same shortfall is a hard reject unless the CCP id is explicitly in
 * `humanOverrides`. See `reference/engine.md`.
 */
export interface SafetyPolicy {
  mode: "human" | "autonomous";
  humanOverrides?: ReadonlySet<string>;
}

const DEFAULT_SAFETY_POLICY: SafetyPolicy = { mode: "human" };

export interface ExecutionResult {
  /** The target's state/tags right before this action finished — still
   *  populated even when `destroyed` is true; the caller must not write
   *  it back into inventory in that case. */
  instance: Instance;
  spawned: Instance[];
  /** True when `action.outputs.destroysTarget` fired: the caller must
   *  remove the target from inventory rather than keep `instance`. */
  destroyed: boolean;
  /** True when a secondary instance (COMBINE-shaped action) was consumed —
   *  the caller must remove it from inventory too. */
  secondaryDestroyed: boolean;
  /** Non-fatal HACCP notices — e.g. a duration below an advisoryOnly CCP's
   *  heldSeconds. Empty when no CCP applies or the threshold was met. */
  warnings: string[];
  /** The `availableIngredients` instance id that satisfied
   *  `action.requiredIngredientCapabilityFromParameter`, if any. See
   *  `reference/engine.md`. */
  matchedIngredientInstanceId?: string;
}

/** Does `entity.statePrerequisites[action.id]` (if any) allow this
 *  instance's current state/tags — shared by both the primary target and
 *  a COMBINE-shaped action's secondary instance. See `reference/engine.md`. */
function checkStatePrerequisite(
  entity: Entity,
  instance: Instance,
  action: Action,
  role: "target" | "secondary"
): void {
  const requiredPriorState = entity.statePrerequisites[action.id];
  if (!requiredPriorState) return;
  const allowedPriorStates = Array.isArray(requiredPriorState)
    ? requiredPriorState
    : [requiredPriorState];
  const satisfied =
    allowedPriorStates.includes(instance.state) ||
    allowedPriorStates.some((s) => instance.tags.includes(s));
  if (!satisfied) {
    const roleLabel = role === "secondary" ? "secondary instance " : "";
    throw new Error(
      `${action.verb} requires ${roleLabel}"${entity.id}" to already be "${allowedPriorStates.join('" or "')}" (currently "${instance.state}", tags [${instance.tags}]).`
    );
  }
}

export function applyAction(
  instance: Instance,
  action: Action,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  params: Readonly<Record<string, string>> = {},
  availableIngredients: ReadonlySet<string> = new Set(),
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(),
  policy: SafetyPolicy = DEFAULT_SAFETY_POLICY,
  secondaryInstance?: Instance
): ExecutionResult {
  const target = entities.get(instance.entityId);
  if (!target) {
    throw new Error(`Unknown entity "${instance.entityId}"`);
  }

  if (!action.validTargetKinds.includes(target.kind)) {
    throw new Error(`${action.verb} cannot target entity kind "${target.kind}" ("${target.id}")`);
  }

  checkStatePrerequisite(target, instance, action, "target");

  if (action.requiredTargetCapability) {
    const has = target.capabilities[action.requiredTargetCapability];
    if (has !== true) {
      const why = has === false ? "explicitly false" : "unasserted";
      throw new Error(
        `${action.verb} requires capability "${action.requiredTargetCapability}" on "${target.id}", but it is ${why}.`
      );
    }
  }

  let secondaryEntity: Entity | undefined;
  if (action.requiredSecondaryCapability) {
    if (!secondaryInstance) {
      throw new Error(
        `${action.verb} requires a secondary instance (capability "${action.requiredSecondaryCapability}"), but none was supplied.`
      );
    }
    secondaryEntity = entities.get(secondaryInstance.entityId);
    if (!secondaryEntity) {
      throw new Error(`Unknown secondary entity "${secondaryInstance.entityId}"`);
    }
    const has = secondaryEntity.capabilities[action.requiredSecondaryCapability];
    if (has !== true) {
      const why = has === false ? "explicitly false" : "unasserted";
      throw new Error(
        `${action.verb} requires secondary capability "${action.requiredSecondaryCapability}" on "${secondaryEntity.id}", but it is ${why}.`
      );
    }
    // Same statePrerequisites check the primary target gets, extended to
    // the secondary instance — see reference/engine.md.
    checkStatePrerequisite(secondaryEntity, secondaryInstance, action, "secondary");
  }

  for (const toolId of action.requiredTools) {
    if (!availableTools.has(toolId)) {
      throw new Error(`${action.verb} requires tool "${toolId}", which is not available.`);
    }
  }

  // Capability-based tool check — substitutable sibling of the exact-id
  // loop above (any available tool asserting the capability satisfies it).
  for (const capability of action.requiredToolCapabilities) {
    const satisfied = [...availableTools].some(
      (id) => entities.get(id)?.capabilities[capability] === true
    );
    if (!satisfied) {
      throw new Error(
        `${action.verb} requires an available tool with capability "${capability}", but none is on hand.`
      );
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

  // requiredIngredientCapabilityFromParameter: the required capability is
  // looked up from the actual value supplied for the named parameter, and
  // the matching instance id is recorded. Checked before the generic
  // parameter-validation loop below for a more specific error. See
  // reference/engine.md.
  let matchedIngredientInstanceId: string | undefined;
  if (action.requiredIngredientCapabilityFromParameter) {
    const { parameter, capabilityByValue } = action.requiredIngredientCapabilityFromParameter;
    const value = params[parameter];
    if (value === undefined) {
      throw new Error(
        `${action.verb} needs "${parameter}" to determine which ingredient capability is required.`
      );
    }
    const capability = capabilityByValue[value];
    if (!capability) {
      throw new Error(
        `${action.verb} has no known ingredient capability for "${parameter}: ${value}" (known: ${Object.keys(capabilityByValue).join(", ")}).`
      );
    }
    const matchId = [...availableIngredients].find(
      (id) => entities.get(id)?.capabilities[capability] === true
    );
    if (!matchId) {
      throw new Error(
        `${action.verb} requires an available ingredient with capability "${capability}" (for "${parameter}: ${value}"), but none is on hand.`
      );
    }
    matchedIngredientInstanceId = matchId;
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

  // Forbidden-transition check, against the COMPUTED nextState (so it also
  // catches a parameter-driven output like CUT's shape). See
  // reference/engine.md and ingredient.ts's invalidTransitions.
  if (target.invalidTransitions[instance.state]?.includes(nextState)) {
    throw new Error(
      `${action.verb} would move "${target.id}" from "${instance.state}" to "${nextState}", which is a forbidden transition for this entity (see invalidTransitions).`
    );
  }

  let nextTags = instance.tags;
  if (action.outputs.addsTag && !instance.tags.includes(action.outputs.addsTag)) {
    nextTags = [...instance.tags, action.outputs.addsTag];
  } else if (action.outputs.addsTagFromParameter) {
    // Mirrors transformedStateFromParameter's own param-lookup, adapted
    // for a value-to-tag map. See reference/engine.md.
    const { parameter, tagByValue } = action.outputs.addsTagFromParameter;
    const value = params[parameter];
    if (value === undefined) {
      throw new Error(`${action.verb} needs "${parameter}" to determine which tag to add.`);
    }
    const tag = tagByValue[value];
    if (!tag) {
      throw new Error(
        `${action.verb} has no known tag for "${parameter}: ${value}" (known: ${Object.keys(tagByValue).join(", ")}).`
      );
    }
    if (!instance.tags.includes(tag)) {
      nextTags = [...instance.tags, tag];
    }
  }

  const updated: Instance = { entityId: instance.entityId, state: nextState, tags: nextTags };

  const spawned: Instance[] = [];
  if (action.outputs.spawnsTargetByproducts) {
    const byproductIds = target.byproductsByAction[action.id] ?? target.producedByproducts;
    for (const byproductId of byproductIds) {
      const byproductEntity = entities.get(byproductId);
      // Byproducts are pieces of the SAME original substance — a
      // whole-substance safety property carries to every piece, filtered
      // against the byproduct's own possibleTags. See reference/engine.md.
      const inheritable = nextTags.filter((t) => byproductEntity?.possibleTags?.includes(t));
      spawned.push({
        entityId: byproductId,
        state: byproductEntity?.possibleStates[0] ?? "raw",
        tags: inheritable,
      });
    }
  }
  if (action.outputs.combinesInto) {
    const combinedEntity = entities.get(action.outputs.combinesInto);
    // Merge tags from both instances being combined. See reference/engine.md.
    const mergedTags = [...new Set([...nextTags, ...(secondaryInstance?.tags ?? [])])];
    const inheritable = mergedTags.filter((t) => combinedEntity?.possibleTags?.includes(t));
    spawned.push({
      entityId: action.outputs.combinesInto,
      state: combinedEntity?.possibleStates[0] ?? "raw",
      tags: inheritable,
    });
  }
  const destroyed = action.outputs.destroysTarget || !!action.outputs.combinesInto;
  const secondaryDestroyed =
    action.requiredSecondaryCapability !== undefined && secondaryInstance !== undefined;

  // CCP duration check — opt-in: only reached when durationSeconds was
  // actually supplied. See reference/engine.md.
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
      // NaN < ccp.heldSeconds is false in JS — guard explicitly so a
      // garbled duration fails loudly instead of silently skipping the
      // check. See reference/engine.md.
      if (Number.isNaN(seconds)) {
        throw new Error(
          `${action.verb} on "${target.id}": durationSeconds "${durationRaw}" is not a valid number — cannot verify the "${ccp.names.en}" threshold, so refusing to proceed.`
        );
      }

      // If the CCP has a real thermal model and an actual temperature was
      // supplied, compute the required hold time at that temperature
      // instead of only checking the fixed heldC/heldSeconds anchor.
      let requiredSeconds = ccp.heldSeconds;
      let thresholdDescription = `${ccp.heldSeconds}s at ${ccp.heldC}°C (or ${ccp.instantaneousC}°C instantaneous)`;
      const waterTempRaw = params["waterTempC"];
      if (ccp.thermalModel && waterTempRaw !== undefined) {
        const actualTempC = Number(waterTempRaw);
        if (Number.isNaN(actualTempC)) {
          throw new Error(
            `${action.verb} on "${target.id}": waterTempC "${waterTempRaw}" is not a valid number — cannot compute the "${ccp.names.en}" threshold, so refusing to proceed.`
          );
        }
        requiredSeconds = requiredHoldSeconds(ccp.thermalModel, actualTempC);
        thresholdDescription =
          `${requiredSeconds.toFixed(1)}s, computed for the actual ${actualTempC}°C via thermal.ts's D/z model ` +
          `(reference ${ccp.thermalModel.referenceHoldSeconds}s @ ${ccp.thermalModel.referenceTempC}°C, z=${ccp.thermalModel.zValueC}°C — ${ccp.thermalModel.validityCondition})`;
      }

      if (seconds < requiredSeconds) {
        const msg =
          `${action.verb} on "${target.id}": ${seconds}s is below "${ccp.names.en}"'s minimum hold of ` +
          `${thresholdDescription} for ${ccp.pathogen}. ${ccp.source}`;
        const overridden =
          policy.mode === "autonomous" && policy.humanOverrides?.has(ccp.id) === true;
        if (ccp.advisoryOnly && (policy.mode === "human" || overridden)) {
          warnings.push(
            overridden ? `${msg} [autonomous mode: proceeding on explicit human override]` : msg
          );
        } else if (ccp.advisoryOnly) {
          // Autonomous, not overridden: no human present to judge this
          // advisory, so the safe default is reject.
          throw new Error(
            `${msg} [autonomous mode: no human present to accept this risk — rejected by default; pass this CCP's id in humanOverrides to proceed]`
          );
        } else {
          throw new Error(msg);
        }
      }
    }
  }

  return {
    instance: updated,
    spawned,
    destroyed,
    secondaryDestroyed,
    warnings,
    matchedIngredientInstanceId,
  };
}
