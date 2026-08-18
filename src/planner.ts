import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript, RecipeStep } from "./recipe.ts";
import type { RecipeIntent, InstanceGoal } from "./recipe.ts";
import {
  isGoalReachable,
  enumerateEdges,
  type GoalPredicate,
  type ReachabilityStep,
  type BlockingReason,
  type Edge,
} from "./reachability.ts";

/**
 * Turns `reachability.ts`'s `isGoalReachable` search results into real,
 * runnable `RecipeScript`s, resolves a `RecipeIntent` (goals/constraints)
 * end to end via `planIntent`, offers a cost-aware search
 * (`planLowestCost`), and a bounded (single-secondary-hop) answer to
 * COMBINE-shaped multi-instance planning (`planCombine`/
 * `planSecondaryRole`). Never executes anything itself — only produces a
 * `RecipeScript` for something else to run. See `reference/planner.md`
 * for design rationale, scope, and history.
 */

// ---------------------------------------------------------------------
// Path -> RecipeScript conversion
// ---------------------------------------------------------------------

/** Mirrors `recipe-runner.ts`'s own real spawn-id scheme: a single
 *  counter, global across every entity type, incremented once per
 *  spawned instance in the order they're actually spawned. See
 *  `reference/planner.md`. */
export class SpawnIdTracker {
  private counter = 0;
  next(entityId: string): string {
    return `${entityId}-${++this.counter}`;
  }
}

export interface PlannerIngredientInstance {
  id: string;
  entityId: string;
}

/** Picks a schema-valid placeholder for a required-but-not-state-
 *  determining parameter — not a cited/technique-verified choice, just a
 *  value within the declared valid range. See `reference/planner.md`. */
export function resolveDefaultParamValue(param: Action["parameters"][number]): string {
  if (param.allowedValues) return param.allowedValues[0];
  const range = param.numericRange!;
  return String(Math.round((range.min + range.max) / 2));
}

export interface StepsToRecipeStepsOptions {
  targetInstanceId: string;
  entities: ReadonlyMap<string, Entity>;
  actions: ReadonlyMap<string, Action>;
  /** Real ingredient instances on hand — each `requiredIngredientCapabilities`
   *  entry resolves to the FIRST instance (array order) whose entity
   *  asserts that capability. See `reference/planner.md`. */
  availableIngredientInstances: readonly PlannerIngredientInstance[];
  /** Per-step-index parameter overrides — the escape hatch for a value
   *  `resolveDefaultParamValue` would otherwise have to guess at. */
  paramOverrides?: Record<number, Record<string, string>>;
}

export function stepsToRecipeSteps(
  steps: readonly ReachabilityStep[],
  opts: StepsToRecipeStepsOptions
): RecipeStep[] {
  return steps.map((s, index) => {
    const action = opts.actions.get(s.actionId);
    if (!action) {
      throw new Error(`stepsToRecipeSteps: unknown action "${s.actionId}" at step ${index}`);
    }

    const params: Record<string, string> = { ...opts.paramOverrides?.[index] };
    if (s.param !== undefined && action.outputs.transformedStateFromParameter) {
      params[action.outputs.transformedStateFromParameter] = s.param;
    }
    for (const p of action.parameters) {
      if (p.required && params[p.id] === undefined) {
        params[p.id] = resolveDefaultParamValue(p);
      }
    }

    const availableIngredientInstanceIds: string[] = [];
    for (const capability of action.requiredIngredientCapabilities) {
      const match = opts.availableIngredientInstances.find(
        (inst) => opts.entities.get(inst.entityId)?.capabilities[capability] === true
      );
      if (!match) {
        // The search already verified some ENTITY satisfying this
        // capability was in the availableIngredients set — reaching here
        // means the instance pool disagrees, a real caller error.
        throw new Error(
          `stepsToRecipeSteps: no available ingredient instance satisfies "${capability}" for step ${index} (${action.verb}).`
        );
      }
      if (!availableIngredientInstanceIds.includes(match.id)) {
        availableIngredientInstanceIds.push(match.id);
      }
    }

    return {
      actionId: s.actionId,
      targetInstanceId: opts.targetInstanceId,
      params,
      availableIngredientInstanceIds,
    };
  });
}

// ---------------------------------------------------------------------
// Cost-aware search — built on the same edges isGoalReachable uses
// ---------------------------------------------------------------------

/** A real, simple, documented cost heuristic — not a citation-backed
 *  figure. Every step costs 1 plus a penalty for its own declared
 *  `hazards` severity, so among equally-short paths the search prefers
 *  the least risky one. See `reference/planner.md`. */
export function defaultEdgeCost(action: Action): number {
  const severityPenalty = { low: 0.1, medium: 0.3, high: 0.6 };
  const hazardCost = action.hazards.reduce((sum, h) => sum + severityPenalty[h.severity], 0);
  return 1 + hazardCost;
}

export interface CostAwareQuery {
  entity: Entity;
  entities: ReadonlyMap<string, Entity>;
  actions: ReadonlyMap<string, Action>;
  startState: string;
  startTags: readonly string[];
  goal: GoalPredicate;
  availableTools: ReadonlySet<string>;
  availableIngredients: ReadonlySet<string>;
  /** Defaults to `defaultEdgeCost` above. */
  edgeCost?: (action: Action) => number;
}

/** Dijkstra over the identical edge set `isGoalReachable` explores (via
 *  the shared `enumerateEdges`), with a real, non-uniform cost per edge.
 *  Deterministic — a binary-heap-free O(V*E) relaxation loop, visiting
 *  edges in declared array order at every tie. See `reference/planner.md`. */
export function planLowestCost(query: CostAwareQuery): ReachabilityResultWithCost {
  const {
    entity,
    entities,
    actions,
    startState,
    startTags,
    goal,
    availableTools,
    availableIngredients,
  } = query;
  const edgeCost = query.edgeCost ?? defaultEdgeCost;

  function key(state: string, tags: readonly string[]): string {
    return `${state}|${[...new Set(tags)].sort().join(",")}`;
  }
  function matches(state: string, tags: readonly string[]): boolean {
    if (goal.state !== undefined && state !== goal.state) return false;
    if (goal.requiredTags && goal.requiredTags.length > 0) {
      const tagSet = new Set(tags);
      if (!goal.requiredTags.every((t) => tagSet.has(t))) return false;
    }
    return true;
  }

  interface Node {
    state: string;
    tags: string[];
    cost: number;
    path: ReachabilityStep[];
  }
  const best = new Map<string, Node>();
  const startKey = key(startState, startTags);
  const startNode: Node = { state: startState, tags: [...startTags], cost: 0, path: [] };
  best.set(startKey, startNode);

  const blockedBy: BlockingReason[] = [];
  const blockedByKeys = new Set<string>();
  function recordBlock(reason: BlockingReason): void {
    const k = JSON.stringify(reason);
    if (!blockedByKeys.has(k)) {
      blockedByKeys.add(k);
      blockedBy.push(reason);
    }
  }

  // Simple deterministic relaxation over this repo's small (well under
  // 100 nodes) state graphs — correctness/determinism matter more here
  // than micro-optimizing with a priority queue. See reference/planner.md.
  const settled = new Set<string>();
  for (let iterations = 0; iterations < 10000; iterations++) {
    let frontierKey: string | undefined;
    let frontierCost = Infinity;
    for (const [k, node] of best) {
      if (!settled.has(k) && node.cost < frontierCost) {
        frontierCost = node.cost;
        frontierKey = k;
      }
    }
    if (frontierKey === undefined) break; // nothing left to relax
    const node = best.get(frontierKey)!;
    settled.add(frontierKey);

    if (matches(node.state, node.tags)) {
      return { reachable: true, path: node.path, totalCost: node.cost };
    }

    const edges: Edge[] = enumerateEdges(
      entity,
      entities,
      actions,
      node.state,
      node.tags,
      availableTools,
      availableIngredients,
      recordBlock
    );
    for (const edge of edges) {
      const action = actions.get(edge.step.actionId)!;
      const nextCost = node.cost + edgeCost(action);
      const nextKey = key(edge.nextState, edge.nextTags);
      const existing = best.get(nextKey);
      if (!existing || nextCost < existing.cost) {
        best.set(nextKey, {
          state: edge.nextState,
          tags: edge.nextTags,
          cost: nextCost,
          path: [...node.path, edge.step],
        });
      }
    }
  }

  return { reachable: false, blockedBy };
}

export type ReachabilityResultWithCost =
  | { reachable: true; path: ReachabilityStep[]; totalCost: number }
  | { reachable: false; blockedBy: BlockingReason[] };

// ---------------------------------------------------------------------
// Multi-instance / COMBINE planning — bounded, not general
// ---------------------------------------------------------------------

export interface SecondaryRoleResult {
  found: true;
  /** Steps to run against the STARTING instance to reach the point where
   *  it (or a spawned successor) satisfies `requiredCapability`. */
  steps: RecipeStep[];
  /** The instance id COMBINE's `secondaryInstanceId` should actually
   *  reference — either `startInstanceId` unchanged, or a NEW predicted id. */
  finalInstanceId: string;
  finalEntityId: string;
}
export interface SecondaryRoleFailure {
  found: false;
  reason: string;
}

/**
 * Finds a way to make `startInstanceId` (or something spawned from it)
 * satisfy a `requiredSecondaryCapability` for a COMBINE-shaped action.
 * Two cases: already satisfies it (used as-is), or a one-hop spawn does
 * (bounded search, not unbounded recursion). `desiredState`/`desiredTags`
 * let a caller ask for a realistic rather than merely engine-legal
 * secondary instance. See `reference/planner.md` for the full reasoning,
 * including the real pre-existing engine limitation this planner does
 * not invent.
 */
export function planSecondaryRole(
  startInstanceId: string,
  startEntity: Entity,
  startState: string,
  startTags: readonly string[],
  requiredCapability: string,
  entities: ReadonlyMap<string, Entity>,
  actions: ReadonlyMap<string, Action>,
  availableTools: ReadonlySet<string>,
  availableIngredients: ReadonlySet<string>,
  spawnIds: SpawnIdTracker,
  desiredState?: string,
  desiredTags?: readonly string[]
): SecondaryRoleResult | SecondaryRoleFailure {
  function finishOn(
    entity: Entity,
    entityId: string,
    instanceId: string,
    state: string,
    tags: readonly string[],
    priorSteps: RecipeStep[]
  ): SecondaryRoleResult | SecondaryRoleFailure {
    if (desiredState === undefined && (!desiredTags || desiredTags.length === 0)) {
      return {
        found: true,
        steps: priorSteps,
        finalInstanceId: instanceId,
        finalEntityId: entityId,
      };
    }
    const result = isGoalReachable({
      entity,
      entities,
      actions,
      startState: state,
      startTags: tags,
      goal: { state: desiredState, requiredTags: desiredTags ? [...desiredTags] : undefined },
      availableTools,
      availableIngredients,
    });
    if (!result.reachable) {
      return {
        found: false,
        reason: `secondary instance "${instanceId}" (${entityId}) satisfies "${requiredCapability}" but can't reach the desired state/tags`,
      };
    }
    const steps = stepsToRecipeSteps(result.path, {
      targetInstanceId: instanceId,
      entities,
      actions,
      availableIngredientInstances: [...availableIngredients].map((id) => ({ id, entityId: id })),
    });
    return {
      found: true,
      steps: [...priorSteps, ...steps],
      finalInstanceId: instanceId,
      finalEntityId: entityId,
    };
  }

  if (startEntity.capabilities[requiredCapability] === true) {
    return finishOn(startEntity, startEntity.id, startInstanceId, startState, startTags, []);
  }

  // One-hop spawn search — see reference/planner.md for why bounded.
  for (const actionId of startEntity.allowedTransformations) {
    const action = actions.get(actionId);
    if (!action || !action.outputs.spawnsTargetByproducts) continue;
    const byproductIds = startEntity.byproductsByAction[actionId] ?? startEntity.producedByproducts;
    const matchIndex = byproductIds.findIndex(
      (id) => entities.get(id)?.capabilities[requiredCapability] === true
    );
    if (matchIndex === -1) continue;

    // The spawning action itself may have its own state prerequisite —
    // reuse isGoalReachable to get there first.
    const requiredPrior = startEntity.statePrerequisites[actionId];
    let prefixSteps: RecipeStep[] = [];
    let tagsBeforeSpawn = [...startTags];
    if (requiredPrior) {
      const allowed = Array.isArray(requiredPrior) ? requiredPrior : [requiredPrior];
      const already = allowed.includes(startState) || allowed.some((s) => startTags.includes(s));
      if (!already) {
        const prep = isGoalReachable({
          entity: startEntity,
          entities,
          actions,
          startState,
          startTags,
          goal: { state: allowed[0] },
          availableTools,
          availableIngredients,
        });
        if (!prep.reachable) continue;
        prefixSteps = stepsToRecipeSteps(prep.path, {
          targetInstanceId: startInstanceId,
          entities,
          actions,
          availableIngredientInstances: [...availableIngredients].map((id) => ({
            id,
            entityId: id,
          })),
        });
      }
    }

    // Predict the spawned instance's id/state, mirroring engine.ts's own
    // spawn logic exactly. See reference/planner.md.
    let spawnedInstanceId = "";
    for (let i = 0; i <= matchIndex; i++) {
      spawnedInstanceId = spawnIds.next(byproductIds[i]);
    }
    const spawnedEntityId = byproductIds[matchIndex];
    const spawnedEntity = entities.get(spawnedEntityId)!;
    const spawnedState = spawnedEntity.possibleStates[0] ?? "raw";
    const spawnedTags = tagsBeforeSpawn.filter((t) => spawnedEntity.possibleTags?.includes(t));

    const spawnStep: RecipeStep = {
      actionId,
      targetInstanceId: startInstanceId,
      params: {},
      availableIngredientInstanceIds: [],
    };
    return finishOn(spawnedEntity, spawnedEntityId, spawnedInstanceId, spawnedState, spawnedTags, [
      ...prefixSteps,
      spawnStep,
    ]);
  }

  return {
    found: false,
    reason: `no path found from "${startInstanceId}" (${startEntity.id}) to anything satisfying "${requiredCapability}" within one spawn hop`,
  };
}

export interface CombinePlanResult {
  success: true;
  steps: RecipeStep[];
  resultInstanceId: string;
  resultEntityId: string;
}
export interface CombinePlanFailure {
  success: false;
  reason: string;
}

export interface CombinePlanQuery {
  combineActionId: string;
  primaryInstanceId: string;
  primaryEntity: Entity;
  primaryStartState: string;
  primaryStartTags: readonly string[];
  secondaryInstanceId: string;
  secondaryEntity: Entity;
  secondaryStartState: string;
  secondaryStartTags: readonly string[];
  secondaryDesiredState?: string;
  secondaryDesiredTags?: readonly string[];
  entities: ReadonlyMap<string, Entity>;
  actions: ReadonlyMap<string, Action>;
  availableTools: ReadonlySet<string>;
  availableIngredients: ReadonlySet<string>;
  spawnIds: SpawnIdTracker;
}

/** Assembles a full COMBINE plan: the primary instance's path to whatever
 *  state `combineActionId` requires, the secondary instance's path (via
 *  `planSecondaryRole`), and the COMBINE step itself with a correctly-
 *  predicted `resultInstanceId`. Takes `combineActionId` as a required
 *  input, resolved by the caller — never guessed. See `reference/planner.md`. */
export function planCombine(query: CombinePlanQuery): CombinePlanResult | CombinePlanFailure {
  const action = query.actions.get(query.combineActionId);
  if (!action || !action.outputs.combinesInto) {
    return { success: false, reason: `"${query.combineActionId}" is not a COMBINE-shaped action` };
  }
  if (!action.requiredSecondaryCapability) {
    return {
      success: false,
      reason: `"${query.combineActionId}" has no requiredSecondaryCapability`,
    };
  }

  const requiredPrior = query.primaryEntity.statePrerequisites[query.combineActionId];
  const primaryGoal: GoalPredicate = requiredPrior
    ? { state: Array.isArray(requiredPrior) ? requiredPrior[0] : requiredPrior }
    : { state: query.primaryStartState }; // trivially satisfied — no prerequisite declared
  const primaryPlan = isGoalReachable({
    entity: query.primaryEntity,
    entities: query.entities,
    actions: query.actions,
    startState: query.primaryStartState,
    startTags: query.primaryStartTags,
    goal: primaryGoal,
    availableTools: query.availableTools,
    availableIngredients: query.availableIngredients,
  });
  if (!primaryPlan.reachable) {
    return {
      success: false,
      reason: `primary instance "${query.primaryInstanceId}" can't reach the state "${query.combineActionId}" requires`,
    };
  }
  const primarySteps = stepsToRecipeSteps(primaryPlan.path, {
    targetInstanceId: query.primaryInstanceId,
    entities: query.entities,
    actions: query.actions,
    availableIngredientInstances: [...query.availableIngredients].map((id) => ({
      id,
      entityId: id,
    })),
  });

  const secondaryResult = planSecondaryRole(
    query.secondaryInstanceId,
    query.secondaryEntity,
    query.secondaryStartState,
    query.secondaryStartTags,
    action.requiredSecondaryCapability,
    query.entities,
    query.actions,
    query.availableTools,
    query.availableIngredients,
    query.spawnIds,
    query.secondaryDesiredState,
    query.secondaryDesiredTags
  );
  if (!secondaryResult.found) {
    return { success: false, reason: secondaryResult.reason };
  }

  if (
    action.requiredTargetCapability &&
    !query.primaryEntity.capabilities[action.requiredTargetCapability]
  ) {
    return {
      success: false,
      reason: `primary entity "${query.primaryEntity.id}" lacks capability "${action.requiredTargetCapability}"`,
    };
  }
  // COMBINE's own requiredTools is checked explicitly here since COMBINE
  // is the terminal step, never explored as an intermediate edge by
  // isGoalReachable's primary-path search above. See reference/planner.md.
  for (const toolId of action.requiredTools) {
    if (!query.availableTools.has(toolId)) {
      return { success: false, reason: `COMBINE requires tool "${toolId}", not available` };
    }
  }

  const resultEntityId = action.outputs.combinesInto!;
  const resultInstanceId = query.spawnIds.next(resultEntityId);
  const combineStep: RecipeStep = {
    actionId: query.combineActionId,
    targetInstanceId: query.primaryInstanceId,
    params: {},
    availableIngredientInstanceIds: [],
    secondaryInstanceId: secondaryResult.finalInstanceId,
  };

  return {
    success: true,
    steps: [...primarySteps, ...secondaryResult.steps, combineStep],
    resultInstanceId,
    resultEntityId,
  };
}

// ---------------------------------------------------------------------
// RecipeIntent -> RecipeScript — ties everything together
// ---------------------------------------------------------------------

export interface PlanIntentSuccess {
  success: true;
  recipe: RecipeScript;
  /** `recipe.sequence[i]` was produced to satisfy
   *  `intent.goals[stepGoalIndex[i]]` — used by `runRecipeFromIntent`
   *  (closed-loop replanning) to know which original goal to replan toward. */
  stepGoalIndex: number[];
}
export interface PlanIntentFailure {
  success: false;
  /** Which goal (by array index) failed, and why. */
  failures: { goalIndex: number; reason: string }[];
}

/**
 * Resolves a `RecipeIntentSchema` (goals + constraints) into a real,
 * runnable `RecipeScript`. Goals are processed IN ARRAY ORDER — a
 * deliberate simplification, no reordering/backtracking across goals.
 * A later goal's `instanceId` may reference `"$combineResult:<goalIndex>"`
 * to target what an earlier combine-goal produced, letting a full
 * multi-step, multi-instance dish be planned end to end. See
 * `reference/planner.md`.
 */
export function planIntent(
  intent: RecipeIntent,
  entities: ReadonlyMap<string, Entity>,
  actions: ReadonlyMap<string, Action>
): PlanIntentSuccess | PlanIntentFailure {
  const availableTools = new Set(intent.availableTools);
  const availableIngredientEntityIds = new Set(intent.initialInventory.map((i) => i.entityId));
  const instancePool: PlannerIngredientInstance[] = intent.initialInventory.map((i) => ({
    id: i.id,
    entityId: i.entityId,
  }));
  const spawnIds = new SpawnIdTracker();
  const failures: { goalIndex: number; reason: string }[] = [];
  const sequence: RecipeStep[] = [];
  const stepGoalIndex: number[] = [];
  // Tracks each instance id's current state/tags as goals are resolved
  // in order, so a later goal on the same instance (or a $combineResult
  // reference) starts its search from the right place.
  const currentState = new Map<string, { entityId: string; state: string; tags: string[] }>();
  for (const item of intent.initialInventory) {
    currentState.set(item.id, { entityId: item.entityId, state: item.state, tags: [...item.tags] });
  }
  const combineResultByGoal = new Map<number, string>();

  function resolveInstanceId(ref: string): string {
    const m = /^\$combineResult:(\d+)$/.exec(ref);
    if (!m) return ref;
    const resolved = combineResultByGoal.get(Number(m[1]));
    if (!resolved) throw new Error(`planIntent: goal ${m[1]} hasn't produced a combine result yet`);
    return resolved;
  }

  intent.goals.forEach((goal: InstanceGoal, goalIndex: number) => {
    const instanceId = resolveInstanceId(goal.instanceId);
    const current = currentState.get(instanceId);
    if (!current) {
      failures.push({ goalIndex, reason: `unknown instance "${instanceId}"` });
      return;
    }
    const entity = entities.get(current.entityId);
    if (!entity) {
      failures.push({ goalIndex, reason: `unknown entity "${current.entityId}"` });
      return;
    }

    if (goal.combine) {
      const secondaryId = resolveInstanceId(goal.combine.secondaryInstanceId);
      const secondaryCurrent = currentState.get(secondaryId);
      const secondaryEntity = secondaryCurrent && entities.get(secondaryCurrent.entityId);
      if (!secondaryCurrent || !secondaryEntity) {
        failures.push({ goalIndex, reason: `unknown secondary instance "${secondaryId}"` });
        return;
      }
      const result = planCombine({
        combineActionId: goal.combine.actionId,
        primaryInstanceId: instanceId,
        primaryEntity: entity,
        primaryStartState: current.state,
        primaryStartTags: current.tags,
        secondaryInstanceId: secondaryId,
        secondaryEntity,
        secondaryStartState: secondaryCurrent.state,
        secondaryStartTags: secondaryCurrent.tags,
        secondaryDesiredState: goal.combine.secondaryDesiredState,
        secondaryDesiredTags: goal.combine.secondaryDesiredTags,
        entities,
        actions,
        availableTools,
        availableIngredients: availableIngredientEntityIds,
        spawnIds,
      });
      if (!result.success) {
        failures.push({ goalIndex, reason: result.reason });
        return;
      }
      sequence.push(...result.steps);
      stepGoalIndex.push(...result.steps.map(() => goalIndex));
      currentState.delete(instanceId);
      currentState.delete(secondaryId);
      const resultEntity = entities.get(result.resultEntityId)!;
      currentState.set(result.resultInstanceId, {
        entityId: result.resultEntityId,
        state: resultEntity.possibleStates[0] ?? "raw",
        tags: [],
      });
      combineResultByGoal.set(goalIndex, result.resultInstanceId);
      return;
    }

    const result = isGoalReachable({
      entity,
      entities,
      actions,
      startState: current.state,
      startTags: current.tags,
      goal: { state: goal.state, requiredTags: goal.requiredTags },
      availableTools,
      availableIngredients: availableIngredientEntityIds,
    });
    if (!result.reachable) {
      failures.push({
        goalIndex,
        reason: `goal unreachable: ${result.blockedBy.map((b) => b.kind).join(", ") || "no path found"}`,
      });
      return;
    }
    const steps = stepsToRecipeSteps(result.path, {
      targetInstanceId: instanceId,
      entities,
      actions,
      availableIngredientInstances: instancePool,
    });
    sequence.push(...steps);
    stepGoalIndex.push(...steps.map(() => goalIndex));
    if (goal.state !== undefined) current.state = goal.state;
    if (goal.requiredTags) current.tags = [...new Set([...current.tags, ...goal.requiredTags])];
  });

  if (failures.length > 0) return { success: false, failures };

  return {
    success: true,
    recipe: {
      id: intent.id,
      names: intent.names,
      initialInventory: intent.initialInventory,
      availableTools: intent.availableTools,
      sequence,
      metadata: { plannedFromIntent: intent.id },
    },
    stepGoalIndex,
  };
}
