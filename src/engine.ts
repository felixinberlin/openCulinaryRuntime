import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import { requiredHoldSeconds, type CriticalControlPoint } from "./thermal.ts";

/**
 * Minimal execution engine — applies one canonical Action to one instance.
 *
 * This is a stepping stone toward ROADMAP.md Phase 4's full
 * `OcrValidationEngine` (HACCP, an ordered recipe sequence — still not a
 * dedicated class here, `applyAction` covers the same ground as a plain
 * function). It checks: the target entity's capability, required tools
 * being on hand, `Entity.statePrerequisites` (a narrower per-action "must
 * already be in this state first" precondition, e.g. potato.json: cut
 * requires "peeled"), the action's declared `parameters` (e.g. CUT's
 * "shape"), `requiredIngredientCapabilities` (e.g. FRY needs some available
 * ingredient with isFryingMedium, like oil), and — closed 2026-08-15,
 * `Entity.invalidTransitions` (ingredient.ts) — arbitrary forbidden state
 * transitions in general (e.g. potato.json now genuinely stops mashed
 * potato from reverting to a pre-mash state — see that field's own doc
 * comment for why it's keyed per-entity rather than the one global matrix
 * CLAUDE_DEV_CTX.md's literal example shows, AND for a real mistake this
 * field caught in its own first draft, worth reading before trusting any
 * single example in this codebase over checking real technique). It also
 * only checks that a qualifying ingredient is *present*, not consume/
 * decrement it — real quantity tracking belongs
 * to Phase 4's recipe-level inventory.
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
 * `secondaryInstance` / `ExecutionResult.secondaryDestroyed` (ROADMAP.md
 * Phase 4, "multi-instance composition" — added once the tortilla
 * capability test proved it necessary, see LEARNINGS_PROCESS.md 2026-08-12): a
 * COMBINE-shaped action (`action.requiredSecondaryCapability` set) merges a
 * SECOND instance into the result, not just the primary target — e.g. fried
 * potato + beaten egg -> tortilla_mixture. Both the primary target and
 * `secondaryInstance` are destroyed; one new instance of
 * `action.outputs.combinesInto` is spawned in `spawned`, same array
 * `spawnsTargetByproducts` already uses. `secondaryInstance` is optional and
 * `requiredSecondaryCapability` defaults unset, so every action that
 * doesn't declare it — i.e. everything before this addition — is completely
 * unaffected.
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
 * runny egg yolk, not a hard ban — UNLESS `policy.mode === "autonomous"`
 * (SafetyPolicy, below), where an unoverridden advisory is *also* a hard
 * reject: CONCEPT.md §17 says a robot drives the same event timeline as a
 * human, same API, but "same API" cannot mean "same default judgment call"
 * when there is no human to make it. "human" (the default) preserves the
 * original warn-and-continue behavior unchanged for every existing caller.
 *
 * CONCEPT.md §17 also means every categorical "informational only, not
 * enforced" parameter this codebase has accumulated (fry.json's heatLevel/
 * agitation/doneness, scramble.json's curdSize, emulsify.json's
 * oilAdditionRate, poach.json's waterTempC, ...) needs to be read
 * correctly for what it actually is: a human-readable technique hint, NOT
 * a calibrated robot control setpoint. "heatLevel: high" has no defined
 * mapping to an actual actuator command — a controller that invented one
 * unilaterally would itself be a safety problem, not a solution to one.
 * Autonomous execution of any of this would need a real translation/
 * control/perception layer (closed-loop temperature control, computer
 * vision for "golden" vs "brown", force feedback for CRUSH's fineness,
 * physical proximity/hazard sensing for a knife or a hot pan near a
 * person) that does not exist in this repo. SafetyPolicy's "autonomous"
 * mode only changes what happens to a stated HACCP time threshold — it
 * does NOT mean the rest of this engine is robot-ready. Flagged here
 * deliberately rather than letting "autonomous mode exists now" imply
 * more than it does.
 */

export interface Instance {
  entityId: string;
  state: string;
  tags: string[];
}

/**
 * Execution policy for who's actually driving — CONCEPT.md §17: a robot
 * "consumes/drives the same event timeline a human session would," same
 * API, but that can't mean same DEFAULT for a safety shortfall. An
 * advisoryOnly CCP shortfall (thermal.ts) warns-and-continues under
 * "human" — the existing default, and the right one when a person is
 * present to judge a runny yolk for themselves. Under "autonomous" (a
 * robot with no human directly supervising this step), the same shortfall
 * is a hard reject by default: no judgment call to defer to. It only
 * proceeds if the specific CCP id is in `humanOverrides` — an explicit,
 * prior authorization (e.g. a diner ordered a soft yolk knowingly), not a
 * blanket "trust the robot" switch. Defaults to "human" so every existing
 * caller's behavior is unchanged unless it opts in.
 */
export interface SafetyPolicy {
  mode: "human" | "autonomous";
  humanOverrides?: ReadonlySet<string>;
}

const DEFAULT_SAFETY_POLICY: SafetyPolicy = { mode: "human" };

export interface ExecutionResult {
  /** The target's state/tags right before this action finished — still
   *  populated even when `destroyed` is true, for logging purposes; the
   *  caller must not write it back into inventory in that case. */
  instance: Instance;
  spawned: Instance[];
  /** True when `action.outputs.destroysTarget` fired: the caller must
   *  remove the target from inventory rather than keep `instance`. */
  destroyed: boolean;
  /** True when a secondary instance (COMBINE-shaped action) was consumed —
   *  the caller must remove IT from inventory too, same as `destroyed` for
   *  the primary target. Always false when the action has no
   *  requiredSecondaryCapability. */
  secondaryDestroyed: boolean;
  /** Non-fatal HACCP notices (see the CCP paragraph in the file doc
   *  comment above) — e.g. a duration below an advisoryOnly CCP's
   *  heldSeconds. Empty when no CCP applies or the threshold was met. */
  warnings: string[];
}

/**
 * Shared by both the primary target and (added 2026-08-17) the secondary
 * instance of a COMBINE-shaped action — `role` only affects the error
 * message's wording, the check itself is identical either way: does
 * `entity.statePrerequisites[action.id]` (if any) allow this instance's
 * current state/tags. Extracted from what used to be inline-only logic in
 * `applyAction` when the secondary-instance gap below was found and fixed;
 * behavior for the primary/target call site is completely unchanged.
 */
function checkStatePrerequisite(entity: Entity, instance: Instance, action: Action, role: "target" | "secondary"): void {
  const requiredPriorState = entity.statePrerequisites[action.id];
  if (!requiredPriorState) return;
  // A single required state is treated as a one-element allowed set, so this
  // branch's behavior/error message is unchanged for every statePrerequisites
  // entry written before array values existed (ingredient.ts's own doc
  // comment) — only a genuinely multi-valued entry (e.g. potato.json's cut:
  // ["washed", "peeled"]) takes the OR path.
  //
  // Each allowed entry is checked against EITHER instance.state OR
  // instance.tags (added 2026-08-15, potato.json's "cut"/"grate":
  // ["washed", "peeled"] being the forcing case): "washed" used to be
  // modeled as a STATE (WASH's outputs.transformedState), which meant
  // washing a potato and then peeling it silently overwrote away the fact
  // it had ever been washed — `state` is documented as the one
  // mutually-exclusive value an instance holds, so "washed" and "peeled"
  // could never both be true of the same instance at once even though
  // physically they obviously can. WASH now sets a TAG instead (see
  // wash.json), matching SALT/PEPPER/etc.'s existing addsTag pattern — an
  // orthogonal fact that survives whatever state comes next. This check
  // treating state-prerequisite entries as satisfiable by a matching tag,
  // not just a matching state, is what keeps that precondition meaningful
  // now that "washed" isn't a state value anymore; every entry that names
  // an actual state (the overwhelming majority) is completely unaffected,
  // since instance.state is still checked first/either way.
  const allowedPriorStates = Array.isArray(requiredPriorState) ? requiredPriorState : [requiredPriorState];
  const satisfied =
    allowedPriorStates.includes(instance.state) || allowedPriorStates.some((s) => instance.tags.includes(s));
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
    // Added 2026-08-17, self-authored common-sense audit (LEARNINGS_PROCESS.md
    // this date): requiredSecondaryCapability is a static, state-independent
    // boolean (onion.json asserts isCombinableWithPotato regardless of
    // whether that onion instance is raw and whole or peeled and sliced), so
    // before this fix nothing stopped COMBINE_POTATO_ONION from accepting a
    // never-prepped secondary onion — the identical class of gap
    // statePrerequisites already closes for the PRIMARY target, just never
    // extended to the secondary instance. Reuses the exact same
    // statePrerequisites map/lookup-by-action-id mechanism, not a new field —
    // safe because no entity used here as a SECONDARY (onion.json,
    // egg_cracked.json) is ever the PRIMARY target of the same action id, so
    // there is no ambiguity about which role a given entry describes.
    checkStatePrerequisite(secondaryEntity, secondaryInstance, action, "secondary");
  }

  for (const toolId of action.requiredTools) {
    if (!availableTools.has(toolId)) {
      throw new Error(`${action.verb} requires tool "${toolId}", which is not available.`);
    }
  }

  // Capability-based tool check — the substitutable sibling of the exact-id
  // loop above, mirroring requiredIngredientCapabilities' own logic exactly
  // (any available tool asserting the capability satisfies it, not one
  // hardcoded id). See action.ts's requiredToolCapabilities doc comment.
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

  // Forbidden-transition check (ROADMAP.md Phase 4, ingredient.ts's
  // invalidTransitions doc comment for the full reasoning) — runs against
  // the COMPUTED nextState above, not the action id, so it also catches a
  // parameter-driven output (CUT's shape). A no-op transition (nextState
  // === instance.state, e.g. an addsTag-only action like SALT) can never
  // trip this, since no author would list a state as forbidden from
  // itself. Deliberately checked here, after every precondition above has
  // already passed — this is a distinct concern (is the RESULT physically
  // sane) from "may this action even start," not a replacement for it.
  if (target.invalidTransitions[instance.state]?.includes(nextState)) {
    throw new Error(
      `${action.verb} would move "${target.id}" from "${instance.state}" to "${nextState}", which is a forbidden transition for this entity (see invalidTransitions).`
    );
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
      // Byproducts are pieces of the SAME original substance (egg ->
      // egg_yolk/white/shell) — a whole-substance safety property like
      // "pasteurized" legitimately carries to every piece, conservation-
      // of-mass style. Filtered against the byproduct entity's own
      // possibleTags so nothing nonsensical leaks through (e.g. a spawned
      // potato_peel never declares "flipped" as valid, so it can't
      // inherit it even if the parent somehow had it).
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
    // Merge tags from BOTH instances being combined — e.g. a salted beaten
    // egg combined with plain fried potato should leave the resulting
    // tortilla_mixture "salted" too. Same possibleTags filter as above.
    const mergedTags = [...new Set([...nextTags, ...(secondaryInstance?.tags ?? [])])];
    const inheritable = mergedTags.filter((t) => combinedEntity?.possibleTags?.includes(t));
    spawned.push({
      entityId: action.outputs.combinesInto,
      state: combinedEntity?.possibleStates[0] ?? "raw",
      tags: inheritable,
    });
  }
  // combinesInto implies both instances are gone, same conservation-of-mass
  // logic as destroysTarget but for two instances at once — see
  // ActionOutputsSchema.combinesInto's doc comment (action.ts).
  const destroyed = action.outputs.destroysTarget || !!action.outputs.combinesInto;
  const secondaryDestroyed =
    action.requiredSecondaryCapability !== undefined && secondaryInstance !== undefined;

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
      // Self-defending against malformed input, not just relying on the
      // parameters[] loop above having already validated durationSeconds as
      // a numericRange param: `NaN < ccp.heldSeconds` is FALSE in JS, so
      // without this guard a garbled duration would silently SKIP the
      // safety check entirely rather than fail it — the exact failure mode
      // this whole mechanism exists to prevent. That the parameters loop
      // currently always catches this first (every CCP-linked action
      // declares durationSeconds formally) is a convention, not an enforced
      // invariant; this check must not depend on that convention holding.
      if (Number.isNaN(seconds)) {
        throw new Error(
          `${action.verb} on "${target.id}": durationSeconds "${durationRaw}" is not a valid number — cannot verify the "${ccp.names.en}" threshold, so refusing to proceed.`
        );
      }

      // If this CCP has a real, computable thermal model AND the step
      // supplied an actual temperature (waterTempC), compute the required
      // hold time at THAT exact temperature instead of only ever checking
      // against the one fixed heldC/heldSeconds anchor — see
      // ThermalInactivationModelSchema's doc comment (thermal.ts) for the
      // real D/z-value math and its validity condition.
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
          // autonomous, not overridden: an advisory a human could judge for
          // themselves has no judge here, so the safe default is reject —
          // see SafetyPolicy's doc comment.
          throw new Error(
            `${msg} [autonomous mode: no human present to accept this risk — rejected by default; pass this CCP's id in humanOverrides to proceed]`
          );
        } else {
          throw new Error(msg);
        }
      }
    }
  }

  return { instance: updated, spawned, destroyed, secondaryDestroyed, warnings };
}
