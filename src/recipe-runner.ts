import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import type { HeatSourceProfile } from "./heat-source.ts";
import { applyAction, type Instance, type SafetyPolicy } from "./engine.ts";
import type { RecipeIntent } from "./recipe.ts";
import { planIntent, stepsToRecipeSteps } from "./planner.ts";
import { isGoalReachable } from "./reachability.ts";
import {
  emptyPlace,
  pourInto,
  advanceTempSeconds,
  isAtTargetTemp,
  type PlaceState,
} from "./place.ts";
import { ROOM_TEMP_C } from "./heat-penetration.ts";
import {
  cleanTool,
  markContaminated,
  washTool,
  isRawContaminationRisk,
  type ToolContaminationState,
} from "./tool-hygiene.ts";
import { topologicalOrder, resolveStepId } from "./dag-scheduler.ts";

/**
 * Walks a RecipeScript's sequence against engine.ts's applyAction, in
 * dependency-respecting topological order. A step's failure does not halt
 * the recipe: it's recorded in `errors` and the run continues. Also
 * handles the PLACE verbs (FILL/PLACE_IN/HEAT_PLACE/REMOVE, a shared
 * heated vessel) and tool-hygiene tracking (WASH_TOOL, contamination),
 * both outside applyAction's generic instantaneous-transition model.
 * See `reference/recipe-runner.md` for design rationale, history, and citations.
 */

export interface RecipeStepError {
  step: RecipeStep;
  message: string;
}

export interface RecipeRunResult {
  finalInventory: Map<string, Instance>;
  errors: RecipeStepError[];
  log: string[];
  /** Non-fatal HACCP notices collected across the whole run. */
  warnings: string[];
  /** Every PLACE (pot/pan-as-filled) touched during this run, keyed by its
   *  recipe-local placeId. Empty when the recipe never uses FILL. */
  places: Map<string, PlaceState>;
  /** Which instance ids were PLACE_IN'd into each placeId, in placement order. */
  placeContents: Map<string, string[]>;
  /** Every spawned instance id's entity id, for the WHOLE run — including
   *  ones later destroyed and so no longer present in `finalInventory`.
   *  See `reference/recipe-runner.md`. */
  spawnedEntityIds: Map<string, string>;
  /** Every tool instance touched via a step's opt-in `params.toolInstanceId`
   *  during this run, keyed by that toolInstanceId. Empty when the recipe
   *  never sets `toolInstanceId` on any step. */
  toolContamination: Map<string, ToolContaminationState>;
}

function requireParam(
  params: Readonly<Record<string, string>>,
  key: string,
  actionVerb: string
): string {
  const value = params[key];
  if (value === undefined) {
    throw new Error(`${actionVerb} requires a "${key}" parameter.`);
  }
  return value;
}

function requireNumber(
  params: Readonly<Record<string, string>>,
  key: string,
  actionVerb: string
): number {
  const raw = requireParam(params, key, actionVerb);
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`${actionVerb} got "${key}: ${raw}", which is not a valid number.`);
  }
  return num;
}

function numberOrDefault(
  params: Readonly<Record<string, string>>,
  key: string,
  fallback: number
): number {
  const raw = params[key];
  if (raw === undefined) return fallback;
  const num = Number(raw);
  if (Number.isNaN(num)) {
    throw new Error(`"${key}: ${raw}" is not a valid number.`);
  }
  return num;
}

function assertToolCapabilities(
  action: Action,
  availableTools: ReadonlySet<string>,
  entities: Map<string, Entity>
): void {
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
}

function assertTargetCapability(action: Action, target: Entity): void {
  if (action.requiredTargetCapability) {
    const has = target.capabilities[action.requiredTargetCapability];
    if (has !== true) {
      throw new Error(
        `${action.verb} requires capability "${action.requiredTargetCapability}" on "${target.id}", but it is ` +
          `${has === false ? "explicitly false" : "unasserted"}.`
      );
    }
  }
}

/** FILL — pour a real, measured quantity of an ingredient into a place,
 *  creating the place if `params.placeId` hasn't been used yet. */
function handleFill(
  action: Action,
  step: RecipeStep,
  instance: Instance,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  places: Map<string, PlaceState>,
  log: string[]
): void {
  const target = entities.get(instance.entityId);
  if (!target) {
    throw new Error(`Unknown entity "${instance.entityId}"`);
  }
  assertTargetCapability(action, target);
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const toolEntityId = requireParam(step.params, "toolEntityId", action.verb);
  const massKg = requireNumber(step.params, "massKg", action.verb);
  const startTempC = numberOrDefault(step.params, "startTempC", ROOM_TEMP_C);

  const place = places.get(placeId) ?? emptyPlace(toolEntityId, startTempC);
  places.set(placeId, pourInto(place, instance.entityId, massKg, startTempC));
  log.push(
    `${action.verb} ${step.targetInstanceId} (${massKg}kg ${instance.entityId} @ ${startTempC}°C) into place "${placeId}" (${toolEntityId})`
  );
}

/** PLACE_IN — record that `step.targetInstanceId` is now physically located
 *  in an already-FILLed place. Establishes co-location only; does not
 *  itself transform the placed instance's state. */
function handlePlaceIn(
  action: Action,
  step: RecipeStep,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const place = places.get(placeId);
  if (!place) {
    throw new Error(`${action.verb} requires place "${placeId}" to already exist — FILL it first.`);
  }

  const placementMethod = step.params.placementMethod;
  const allowedPlacementMethods = action.parameters.find(
    (p) => p.id === "placementMethod"
  )?.allowedValues;
  if (
    placementMethod !== undefined &&
    allowedPlacementMethods &&
    !allowedPlacementMethods.includes(placementMethod)
  ) {
    throw new Error(
      `${action.verb} got "placementMethod: ${placementMethod}", but only ${allowedPlacementMethods.join(", ")} are valid.`
    );
  }

  const contents = placeContents.get(placeId) ?? [];
  if (!contents.includes(step.targetInstanceId)) {
    contents.push(step.targetInstanceId);
  }
  placeContents.set(placeId, contents);
  log.push(
    `${action.verb} ${step.targetInstanceId} into place "${placeId}" (currently ${place.currentTempC.toFixed(1)}°C` +
      `${placementMethod ? `, ${placementMethod}` : ""}) — now shared by [${contents.join(", ")}]`
  );
}

/** REMOVE — the inverse of PLACE_IN: take `step.targetInstanceId` out of a
 *  place's shared contents. Bookkeeping only; does not itself transform
 *  the instance's own state/tags. */
function handleRemove(
  action: Action,
  step: RecipeStep,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  const placeId = requireParam(step.params, "placeId", action.verb);
  const place = places.get(placeId);
  if (!place) {
    throw new Error(`${action.verb} requires place "${placeId}" to already exist — FILL it first.`);
  }

  const removalMethod = step.params.removalMethod;
  const allowedRemovalMethods = action.parameters.find(
    (p) => p.id === "removalMethod"
  )?.allowedValues;
  if (
    removalMethod !== undefined &&
    allowedRemovalMethods &&
    !allowedRemovalMethods.includes(removalMethod)
  ) {
    throw new Error(
      `${action.verb} got "removalMethod: ${removalMethod}", but only ${allowedRemovalMethods.join(", ")} are valid.`
    );
  }

  const contents = placeContents.get(placeId) ?? [];
  if (!contents.includes(step.targetInstanceId)) {
    throw new Error(
      `${action.verb} cannot remove "${step.targetInstanceId}" from place "${placeId}" — it is not currently there ` +
        `(never PLACE_IN'd, or already removed). Currently in "${placeId}": [${contents.join(", ") || "nothing"}].`
    );
  }

  const remaining = contents.filter((id) => id !== step.targetInstanceId);
  placeContents.set(placeId, remaining);
  log.push(
    `${action.verb} ${step.targetInstanceId} from place "${placeId}" (currently ${place.currentTempC.toFixed(1)}°C` +
      `${removalMethod ? `, ${removalMethod}` : ""}) — now shared by [${remaining.join(", ") || "nothing"}]`
  );
}

/** WASH_TOOL — resets a tool instance's `ToolContaminationState` back to clean. */
function handleWashTool(
  action: Action,
  step: RecipeStep,
  toolContamination: Map<string, ToolContaminationState>,
  log: string[]
): void {
  const toolInstanceId = requireParam(step.params, "toolInstanceId", action.verb);
  const current = toolContamination.get(toolInstanceId) ?? cleanTool(toolInstanceId);
  toolContamination.set(toolInstanceId, washTool(current));
  log.push(
    current.contaminated
      ? `${action.verb} ${toolInstanceId}: was contaminated (by ${current.contaminatedByEntityId}, state "${current.contaminatedByState}") — now clean`
      : `${action.verb} ${toolInstanceId}: already clean`
  );
}

/** Fallback tick-count bound, used only if an action lacks `maxDurationSeconds`.
 *  See `reference/recipe-runner.md`. */
const FALLBACK_MAX_HEAT_TICKS = 400;

/** HEAT_PLACE — advance a place's real, persistent temperature toward a
 *  target over elapsed simulated time, ticking `place.ts`'s
 *  `advanceTempSeconds` forward and polling `isAtTargetTemp`. */
function handleHeatPlace(
  action: Action,
  step: RecipeStep,
  entities: Map<string, Entity>,
  availableTools: ReadonlySet<string>,
  heatSources: Map<string, HeatSourceProfile>,
  places: Map<string, PlaceState>,
  placeContents: Map<string, string[]>,
  log: string[]
): void {
  assertToolCapabilities(action, availableTools, entities);

  const placeId = requireParam(step.params, "placeId", action.verb);
  const place0 = places.get(placeId);
  if (!place0 || place0.contentsEntityId === null) {
    throw new Error(
      `${action.verb} requires place "${placeId}" to already exist and be filled — FILL it first.`
    );
  }
  const contentsEntity = entities.get(place0.contentsEntityId);
  if (!contentsEntity) {
    throw new Error(
      `${action.verb}: place "${placeId}" contains unknown entity "${place0.contentsEntityId}".`
    );
  }

  const heatSourceId = requireParam(step.params, "heatSourceId", action.verb);
  const heatSource = heatSources.get(heatSourceId);
  if (!heatSource) {
    throw new Error(
      `${action.verb} references unknown heat source "${heatSourceId}" — was heatSources not loaded/passed into runRecipe?`
    );
  }

  let targetTempC: number;
  if (step.params.targetTempC !== undefined) {
    targetTempC = Number(step.params.targetTempC);
    if (Number.isNaN(targetTempC)) {
      throw new Error(
        `${action.verb} got "targetTempC: ${step.params.targetTempC}", which is not a valid number.`
      );
    }
  } else if (contentsEntity.thermophysical?.boilingPointC !== undefined) {
    targetTempC = contentsEntity.thermophysical.boilingPointC;
  } else {
    throw new Error(
      `${action.verb}: "targetTempC" was not supplied and "${contentsEntity.id}" has no thermophysical.boilingPointC to default to.`
    );
  }

  const tickSeconds = numberOrDefault(step.params, "tickSeconds", 30);

  // Real upper bound: action.maxDurationSeconds, falling back to a tick
  // count only if the action genuinely has none set.
  const maxElapsedSeconds = action.maxDurationSeconds ?? FALLBACK_MAX_HEAT_TICKS * tickSeconds;

  let place = place0;
  let elapsedSeconds = 0;
  let ticks = 0;
  while (!isAtTargetTemp(place, targetTempC)) {
    if (elapsedSeconds >= maxElapsedSeconds) {
      throw new Error(
        `${action.verb}: place "${placeId}" did not reach ${targetTempC}°C after ${elapsedSeconds}s (${ticks} ticks) — ` +
          `exceeded maxDurationSeconds (${maxElapsedSeconds}s); check heatSourceId/targetTempC.`
      );
    }
    place = advanceTempSeconds(place, heatSource, tickSeconds, contentsEntity, targetTempC);
    elapsedSeconds += tickSeconds;
    ticks++;
  }
  places.set(placeId, place);

  const coLocated = placeContents.get(placeId) ?? [];
  const sharedNote =
    coLocated.length > 0
      ? ` — shared by [${coLocated.join(", ")}], all now at the SAME ${place.currentTempC.toFixed(1)}°C`
      : "";
  log.push(
    `${action.verb} place "${placeId}" toward ${targetTempC}°C via ${heatSource.names.en}: reached ${place.currentTempC.toFixed(1)}°C in ${elapsedSeconds}s (${ticks} ticks)${sharedNote}`
  );
}

/** Opt-in cross-check for `boil`/`simmer`/`fry`/`par_fry` steps that set
 *  `params.placeId`: is this place ACTUALLY at temperature, reading each
 *  action's own declared range rather than a duplicated magic number. A
 *  step that never sets `params.placeId` never reaches this function. */
function assertPlaceReady(
  action: Action,
  placeId: string,
  places: Map<string, PlaceState>,
  entities: Map<string, Entity>
): void {
  const place = places.get(placeId);
  if (!place || place.contentsEntityId === null) {
    throw new Error(
      `${action.verb} references place "${placeId}", but it doesn't exist or hasn't been FILLed yet.`
    );
  }
  const contentsEntity = entities.get(place.contentsEntityId);

  if (action.id === "boil") {
    const boilingPointC = contentsEntity?.thermophysical?.boilingPointC;
    if (boilingPointC === undefined || place.currentTempC < boilingPointC) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's only at ${place.currentTempC.toFixed(1)}°C — not yet at ` +
          `${boilingPointC ?? "an unknown"}°C boiling. HEAT_PLACE it first.`
      );
    }
  } else if (action.id === "simmer") {
    const range = action.parameters.find((p) => p.id === "waterTempC")?.numericRange;
    if (range && (place.currentTempC < range.min || place.currentTempC > range.max)) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's at ${place.currentTempC.toFixed(1)}°C — outside SIMMER's own ` +
          `declared ${range.min}-${range.max}°C band. HEAT_PLACE it into range first.`
      );
    }
  } else if (action.id === "fry" || action.id === "par_fry") {
    const range = action.parameters.find((p) => p.id === "oilTempC")?.numericRange;
    if (range && place.currentTempC < range.min) {
      throw new Error(
        `${action.verb} references place "${placeId}", but it's only at ${place.currentTempC.toFixed(1)}°C — below ${action.verb}'s own ` +
          `declared ${range.min}°C minimum. HEAT_PLACE it first.`
      );
    }
  }
}

/** Recipe-local instance id -> real `Entity.id`. See `reference/recipe-runner.md`. */
export function resolveInstanceEntityIds(
  recipe: RecipeScript,
  spawnedEntityIds: Map<string, string> = new Map()
): Map<string, string> {
  const instanceEntityId = new Map<string, string>();
  for (const item of recipe.initialInventory) instanceEntityId.set(item.id, item.entityId);
  for (const [instanceId, entityId] of spawnedEntityIds) instanceEntityId.set(instanceId, entityId);
  return instanceEntityId;
}

export function runRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy,
  heatSources: Map<string, HeatSourceProfile> = new Map()
): RecipeRunResult {
  const inventory = new Map<string, Instance>();
  for (const item of recipe.initialInventory) {
    inventory.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }

  const availableTools = new Set(recipe.availableTools);
  const log: string[] = [];
  const errors: RecipeStepError[] = [];
  const warnings: string[] = [];
  const places = new Map<string, PlaceState>();
  const placeContents = new Map<string, string[]>();
  const spawnedEntityIds = new Map<string, string>();
  const toolContamination = new Map<string, ToolContaminationState>();
  let spawnCounter = 0;

  // Steps execute in dependency-respecting topological order, not raw
  // array position — see reference/recipe-runner.md for why this is
  // behavior-preserving for every recipe written before RecipeStep.id/
  // dependsOn existed, and why a step cycle aborts before touching inventory.
  const topo = topologicalOrder(recipe.sequence);
  if ("cycle" in topo) {
    errors.push({
      step: recipe.sequence[0]!,
      message: `Circular dependency among steps [${topo.cycle.join(", ")}] — no valid execution order exists.`,
    });
    return {
      finalInventory: inventory,
      errors,
      log,
      warnings,
      places,
      placeContents,
      spawnedEntityIds,
      toolContamination,
    };
  }
  const stepById = new Map(recipe.sequence.map((s, i) => [resolveStepId(s, i), s] as const));
  const orderedSteps = topo.order.map((id) => stepById.get(id)!);

  for (const step of orderedSteps) {
    const action = actions.get(step.actionId);

    if (!action) {
      errors.push({ step, message: `Unknown action "${step.actionId}"` });
      continue;
    }

    // WASH_TOOL's real target is a ToolContaminationState keyed by
    // params.toolInstanceId, never an inventory Instance — dispatched
    // before the instance lookup below.
    if (action.id === "wash_tool") {
      try {
        handleWashTool(action, step, toolContamination, log);
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
      }
      continue;
    }

    const instance = inventory.get(step.targetInstanceId);
    if (!instance) {
      errors.push({ step, message: `Unknown target instance "${step.targetInstanceId}"` });
      continue;
    }

    // PLACE steps — handled entirely outside applyAction's generic
    // instantaneous-transition model; see reference/recipe-runner.md.
    if (
      action.id === "fill" ||
      action.id === "place_in" ||
      action.id === "heat_place" ||
      action.id === "remove"
    ) {
      try {
        if (action.id === "fill") {
          handleFill(action, step, instance, entities, availableTools, places, log);
        } else if (action.id === "place_in") {
          handlePlaceIn(action, step, entities, availableTools, places, placeContents, log);
        } else if (action.id === "remove") {
          handleRemove(action, step, places, placeContents, log);
        } else {
          handleHeatPlace(
            action,
            step,
            entities,
            availableTools,
            heatSources,
            places,
            placeContents,
            log
          );
        }
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
      }
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

    // A stale/typo'd availableIngredientInstanceIds entry is always an
    // authoring bug — fail loudly rather than silently dropping it from
    // the Set (which could mask the mistake behind an unrelated pass/fail).
    const availableIngredientEntityIds = new Set<string>();
    let hasUnknownIngredientInstance = false;
    for (const id of step.availableIngredientInstanceIds) {
      const ingredientInstance = inventory.get(id);
      if (!ingredientInstance) {
        errors.push({
          step,
          message: `Unknown ingredient instance "${id}" in availableIngredientInstanceIds`,
        });
        hasUnknownIngredientInstance = true;
        continue;
      }
      availableIngredientEntityIds.add(ingredientInstance.entityId);
    }
    if (hasUnknownIngredientInstance) {
      continue;
    }

    // Opt-in real-place readiness check — see assertPlaceReady above.
    if (step.params.placeId) {
      try {
        assertPlaceReady(action, step.params.placeId, places, entities);
      } catch (err) {
        const message = (err as Error).message;
        errors.push({ step, message });
        log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
        continue;
      }
    }

    // Opt-in tool-hygiene pre-check — advisory only, the step still
    // proceeds to applyAction either way.
    if (step.params.toolInstanceId) {
      const existing = toolContamination.get(step.params.toolInstanceId);
      if (existing?.contaminated) {
        const message =
          `${action.verb} reuses "${step.params.toolInstanceId}" without washing it first — ` +
          `contaminated by contact with "${existing.contaminatedByEntityId}" (state "${existing.contaminatedByState}"). ` +
          `WASH_TOOL it before reusing on other food.`;
        warnings.push(message);
        log.push(`  WARNING: ${message}`);
      }
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
      // Does contact with this target's PRE-action state mark the named
      // tool instance contaminated? See tool-hygiene.ts's isRawContaminationRisk.
      if (step.params.toolInstanceId) {
        const target = entities.get(instance.entityId);
        if (target && isRawContaminationRisk(target, instance.state)) {
          const current =
            toolContamination.get(step.params.toolInstanceId) ??
            cleanTool(step.params.toolInstanceId);
          toolContamination.set(
            step.params.toolInstanceId,
            markContaminated(current, target.id, instance.state)
          );
          log.push(
            `  ${step.params.toolInstanceId} contaminated by contact with ${target.id} (state "${instance.state}") — WASH_TOOL required before reuse.`
          );
        } else if (!toolContamination.has(step.params.toolInstanceId)) {
          toolContamination.set(step.params.toolInstanceId, cleanTool(step.params.toolInstanceId));
        }
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
        log.push(
          `  consumed secondary instance ${step.secondaryInstanceId} (${secondaryInstance!.entityId})`
        );
      }
      for (const spawned of result.spawned) {
        const spawnedId = `${spawned.entityId}-${++spawnCounter}`;
        inventory.set(spawnedId, spawned);
        spawnedEntityIds.set(spawnedId, spawned.entityId);
        log.push(`  spawned ${spawnedId} (${spawned.entityId}, state: "${spawned.state}")`);
      }
    } catch (err) {
      const message = (err as Error).message;
      errors.push({ step, message });
      log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
    }
  }

  return {
    finalInventory: inventory,
    errors,
    log,
    warnings,
    places,
    placeContents,
    spawnedEntityIds,
    toolContamination,
  };
}

// ---------------------------------------------------------------------
// Closed-loop replanning — a genuinely NEW, additive execution mode.
// `runRecipe` above is completely UNCHANGED and remains the offline-
// validation default every existing caller still gets, unmodified.
// See reference/recipe-runner.md.
// ---------------------------------------------------------------------

export interface RecipeIntentRunResult {
  finalInventory: Map<string, Instance>;
  errors: RecipeStepError[];
  log: string[];
  warnings: string[];
  /** One entry per goal that needed a replan after its step failed. */
  replans: { goalIndex: number; succeeded: boolean; reason?: string }[];
  /** The plan actually run, step by step — may differ from planIntent's
   *  original sequence when a replan spliced in a different path. */
  executedSequence: RecipeStep[];
}

export type RunFromIntentResult =
  | { planned: true; result: RecipeIntentRunResult }
  | { planned: false; failures: { goalIndex: number; reason: string }[] };

/**
 * A real robot's execution loop: when a step genuinely fails, this stops
 * advancing that goal's original scripted steps and calls
 * `isGoalReachable` fresh from the instance's real current state toward
 * the same original goal, splicing in an alternative path (or reporting a
 * final failure if none exists) rather than blindly running the rest of a
 * now-stale plan. Deliberately scoped narrower than "replan anything" —
 * single-instance goals only, at most one replan attempt per goal, no
 * PLACE/WASH_TOOL support. See `reference/recipe-runner.md`.
 */
export function runRecipeFromIntent(
  intent: RecipeIntent,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map(),
  policy?: SafetyPolicy,
  /** The real, currently-on-hand tools/ingredient entity ids — defaults to
   *  `intent.availableTools`/every `initialInventory` entity id. Passing a
   *  narrower set is what actually gives replanning something to recover
   *  from. See `reference/recipe-runner.md`. */
  executionAvailableTools?: ReadonlySet<string>,
  executionAvailableIngredientEntityIds?: ReadonlySet<string>
): RunFromIntentResult {
  const unsupportedGoals = intent.goals
    .map((g, i) => ({ g, i }))
    .filter(({ g }) => g.combine)
    .map(({ i }) => ({
      goalIndex: i,
      reason:
        "runRecipeFromIntent: closed-loop replanning is scoped to single-instance goals only (no combine) — see this function's own doc comment for why.",
    }));
  if (unsupportedGoals.length > 0) return { planned: false, failures: unsupportedGoals };

  const plan = planIntent(intent, entities, actions);
  if (!plan.success) return { planned: false, failures: plan.failures };

  const PLACE_AWARE_ACTIONS = new Set(["fill", "heat_place", "place_in", "remove", "wash_tool"]);
  if (plan.recipe.sequence.some((s) => PLACE_AWARE_ACTIONS.has(s.actionId))) {
    return {
      planned: false,
      failures: [
        {
          goalIndex: -1,
          reason:
            "runRecipeFromIntent: this plan uses a PLACE/WASH_TOOL action — not supported by this function's simpler interpreter (see its own doc comment).",
        },
      ],
    };
  }

  const inventory = new Map<string, Instance>();
  for (const item of intent.initialInventory) {
    inventory.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }
  const availableTools = new Set(executionAvailableTools ?? intent.availableTools);
  const availableIngredientEntityIds = new Set(
    executionAvailableIngredientEntityIds ?? intent.initialInventory.map((i) => i.entityId)
  );
  const ingredientInstancePool = intent.initialInventory
    .filter((i) => availableIngredientEntityIds.has(i.entityId))
    .map((i) => ({ id: i.id, entityId: i.entityId }));

  const errors: RecipeStepError[] = [];
  const log: string[] = [];
  const warnings: string[] = [];
  const replans: RecipeIntentRunResult["replans"] = [];
  const executedSequence: RecipeStep[] = [];
  const replannedGoals = new Set<number>();
  let spawnCounter = 0;

  let sequence = [...plan.recipe.sequence];
  let stepGoalIndex = [...plan.stepGoalIndex];

  let i = 0;
  while (i < sequence.length) {
    const step = sequence[i];
    const goalIndex = stepGoalIndex[i];
    const instance = inventory.get(step.targetInstanceId);
    const action = actions.get(step.actionId);
    if (!instance || !action) {
      errors.push({ step, message: `Unknown target instance or action for step ${i}` });
      break;
    }
    const availableIngredientEntityIdsForStep = new Set(
      step.availableIngredientInstanceIds
        .map((id) => inventory.get(id)?.entityId)
        .filter((x): x is string => x !== undefined)
    );

    try {
      const result = applyAction(
        instance,
        action,
        entities,
        availableTools,
        step.params,
        availableIngredientEntityIdsForStep,
        ccps,
        policy
      );
      for (const warning of result.warnings) {
        warnings.push(warning);
        log.push(`  WARNING: ${warning}`);
      }
      if (result.destroyed) inventory.delete(step.targetInstanceId);
      else inventory.set(step.targetInstanceId, result.instance);
      log.push(`${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
      for (const spawned of result.spawned) {
        const spawnedId = `${spawned.entityId}-${++spawnCounter}`;
        inventory.set(spawnedId, spawned);
        log.push(`  spawned ${spawnedId} (${spawned.entityId}, state: "${spawned.state}")`);
      }
      executedSequence.push(step);
      i++;
    } catch (err) {
      const message = (err as Error).message;
      if (goalIndex !== undefined && goalIndex >= 0 && !replannedGoals.has(goalIndex)) {
        replannedGoals.add(goalIndex);
        const goal = intent.goals[goalIndex];
        const entity = entities.get(instance.entityId)!;
        const fresh = isGoalReachable({
          entity,
          entities,
          actions,
          startState: instance.state,
          startTags: instance.tags,
          goal: { state: goal.state, requiredTags: goal.requiredTags },
          availableTools,
          availableIngredients: availableIngredientEntityIds,
        });
        if (fresh.reachable) {
          const newSteps = stepsToRecipeSteps(fresh.path, {
            targetInstanceId: step.targetInstanceId,
            entities,
            actions,
            availableIngredientInstances: ingredientInstancePool,
          });
          let end = i;
          while (end < sequence.length && stepGoalIndex[end] === goalIndex) end++;
          sequence = [...sequence.slice(0, i), ...newSteps, ...sequence.slice(end)];
          stepGoalIndex = [
            ...stepGoalIndex.slice(0, i),
            ...newSteps.map(() => goalIndex),
            ...stepGoalIndex.slice(end),
          ];
          replans.push({ goalIndex, succeeded: true });
          log.push(
            `REPLANNED goal ${goalIndex} after "${action.verb}" failed ("${message}") — new path: ` +
              `${fresh.path.map((s) => s.actionId).join(" -> ") || "(already at goal)"}`
          );
          continue; // retry at the SAME index i, now the first replanned step
        }
        replans.push({
          goalIndex,
          succeeded: false,
          reason: "no alternative path found from the current state",
        });
      }
      errors.push({ step, message });
      log.push(`REJECTED ${action.verb} ${step.targetInstanceId}: ${message}`);
      break; // a real, unrecoverable failure — stop rather than continuing to
      // run the rest of a now-stale plan against a diverged world.
    }
  }

  return {
    planned: true,
    result: { finalInventory: inventory, errors, log, warnings, replans, executedSequence },
  };
}
