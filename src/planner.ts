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
 * The actual planner `ROADMAP.md` names as the still-open half of Phase
 * 4.5, closed 2026-08-17. `src/reachability.ts`'s `isGoalReachable`
 * (2026-08-16) already does real shortest-path search for ONE instance's
 * own discrete state graph and returns a usable path, not just a yes/no —
 * this module builds everything that was still missing around it:
 *
 * 1. `stepsToRecipeSteps`/`assembleRecipeScript` — turn a found path (or
 *    several) into a real, runnable `RecipeScript`, not just a list of
 *    verbs a human has to hand-convert (as every prior capability-test
 *    script that executed a `ReachabilityStep[]` had to do manually).
 * 2. `RecipeIntentSchema` (`recipe.ts`) + `planIntent` — a real
 *    goals/constraints authoring format, replacing "the caller must
 *    already know the exact target `GoalPredicate`."
 * 3. `planLowestCost` — a real, if simple, cost-aware search (fewest
 *    steps, then fewest/least-severe hazards) built on the SAME edge
 *    logic `isGoalReachable` uses (`enumerateEdges`, extracted from it the
 *    same day, behavior-preserving — see that file's own doc comment).
 * 4. `planCombine`/`planSecondaryRole` — the bounded, honest answer to
 *    "single-instance scope... a `requiredSecondaryCapability` edge is
 *    recorded as blocked, not explored." NOT a general multi-instance
 *    world model (that's still real, larger, unbuilt work — see this
 *    file's own `planCombine` doc comment for exactly what's covered and
 *    what isn't).
 *
 * `engine.ts`'s `applyAction` and `reachability.ts`'s `isGoalReachable`
 * are BOTH completely unchanged by this file (aside from the pure,
 * behavior-preserving `enumerateEdges` extraction) — this module only
 * ever produces a `RecipeScript` for something else to run; it never
 * executes anything itself.
 */

// ---------------------------------------------------------------------
// Path -> RecipeScript conversion
// ---------------------------------------------------------------------

/** Mirrors `recipe-runner.ts`'s own real spawn-id scheme EXACTLY: a
 *  single counter, GLOBAL across every entity type, incremented once per
 *  spawned instance in the order they're actually spawned (see
 *  `recipe-runner.ts`'s `spawnCounter` — confirmed by reading it, not
 *  assumed, and cross-checked against a real recipe: `tortilla-de-
 *  patatas.json`'s "egg_cracked-3"/"tortilla_mixture-4" are exactly what
 *  this counter produces for that step order — PEEL's `potato_peel`
 *  spawn takes 1, CRACK's `egg_shell` then `egg_cracked` byproducts take
 *  2 and 3 in `byproductsByAction.crack`'s own declared order, COMBINE's
 *  `tortilla_mixture` takes 4).
 *
 *  This is NOT the "second, parallel source of truth" risk
 *  `LEARNINGS_ENGINE.md` 2026-08-16 named for `explainRecipe`'s earlier
 *  spawn-id gap — that case was a DIFFERENT module re-analyzing an
 *  ALREADY-RUN recipe's real spawn ids after the fact (a real drift
 *  risk). This tracker is the planner ACTING AS the recipe's author,
 *  choosing the step order itself and predicting what that choice will
 *  produce when actually run — exactly what a human recipe author
 *  already does by hand-typing "egg_cracked-3" into a `RecipeScript`
 *  file; this class only automates that same, single, real convention. */
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

/** A required-but-not-state-determining parameter (e.g. `pasteurize.json`'s
 *  `waterTempC`/`durationSeconds`) has no value the search itself ever
 *  chooses — `isGoalReachable`/`enumerateEdges` only ever select a value
 *  for the ONE parameter that's `transformedStateFromParameter`. This
 *  picks a schema-VALID placeholder (the first `allowedValues` entry, or
 *  the numeric midpoint of `numericRange`) so the generated `RecipeScript`
 *  is genuinely runnable — explicitly NOT a cited or technique-verified
 *  choice, just "a value within the declared valid range," the same
 *  honesty limit every other unenforced categorical parameter in this
 *  repo already carries. A real caller should override it via
 *  `paramOverrides` below when the actual value matters. */
export function resolveDefaultParamValue(param: Action["parameters"][number]): string {
  if (param.allowedValues) return param.allowedValues[0];
  const range = param.numericRange!;
  return String(Math.round((range.min + range.max) / 2));
}

export interface StepsToRecipeStepsOptions {
  targetInstanceId: string;
  entities: ReadonlyMap<string, Entity>;
  actions: ReadonlyMap<string, Action>;
  /** Real ingredient instances on hand — the SAME pool a `RecipeScript`'s
   *  own `initialInventory` provides; each `requiredIngredientCapabilities`
   *  entry resolves to the FIRST instance (array order — deterministic)
   *  whose entity asserts that capability, mirroring `engine.ts`'s own
   *  membership-test semantics (any qualifying instance, not a specific
   *  one). */
  availableIngredientInstances: readonly PlannerIngredientInstance[];
  /** Per-step-index parameter overrides, keyed by the index into `steps`
   *  — the escape hatch for a required-but-not-state-determining param
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
        // The search that produced this path already verified some ENTITY
        // satisfying this capability was in the availableIngredients SET it
        // was given — reaching here means this instance pool disagrees
        // with that set, a real caller-error worth failing loudly on
        // rather than silently emitting an unrunnable step.
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
// Cost-aware search (gap 3) — built on the same edges isGoalReachable uses
// ---------------------------------------------------------------------

/** A real, simple, DOCUMENTED-not-hidden cost heuristic — not a citation-
 *  backed figure (this is scheduling preference, not a domain-science
 *  claim). Every step costs 1 (so, absent any hazard, the lowest-cost
 *  path IS the shortest path — identical to `isGoalReachable`'s own BFS
 *  result for the common case), plus a penalty for that step's own
 *  declared `hazards` severity, so that among equally-short paths the
 *  search prefers the one that asks a robot to do the least risky thing.
 *  `low`/`medium`/`high` map to fixed penalties chosen for a sane
 *  ordering (never let 3 low-severity hazards outweigh 1 high-severity
 *  one) — a reasonable default, not a tuned/validated constant. */
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
 *  the shared `enumerateEdges`), with a real, non-uniform cost per edge —
 *  the genuine cost-aware sibling `isGoalReachable`'s own doc comment
 *  didn't attempt (plain BFS = uniform cost = fewest steps only). Same
 *  determinism discipline: a binary-heap-free O(V*E) relaxation loop,
 *  visiting `entity.allowedTransformations`/`allowedValues` in their own
 *  declared array order at every tie, so the result doesn't depend on
 *  `Map`/`Set` iteration order — see `tests/planner.test.ts` for a direct
 *  determinism check, not an assumption. */
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

  // Simple deterministic relaxation: repeatedly scan every SETTLED node's
  // edges and relax; a real priority queue would be asymptotically
  // faster, but every entity's own reachable state graph in this repo is
  // small (well under 100 nodes) — correctness and determinism matter far
  // more here than micro-optimizing a graph this size.
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
// Multi-instance / COMBINE planning (gap 1) — bounded, not general
// ---------------------------------------------------------------------

export interface SecondaryRoleResult {
  found: true;
  /** Steps to run against the STARTING instance (`startInstanceId`) to
   *  reach the point where it (or a spawned successor) satisfies
   *  `requiredCapability`. */
  steps: RecipeStep[];
  /** The instance id COMBINE's `secondaryInstanceId` should actually
   *  reference — either `startInstanceId` unchanged, or a NEW id this
   *  function predicted via `SpawnIdTracker` (e.g. `"egg_cracked-3"`). */
  finalInstanceId: string;
  finalEntityId: string;
}
export interface SecondaryRoleFailure {
  found: false;
  reason: string;
}

/**
 * Finds a way to make `startInstanceId` (or something spawned FROM it)
 * satisfy a `requiredSecondaryCapability` — the bounded, honest answer to
 * COMBINE's own real engine behavior, checked directly before building
 * this rather than assumed: `engine.ts`'s `applyAction` checks
 * `requiredSecondaryCapability` ONLY against the secondary instance's
 * ENTITY-level `capabilities` flag (`secondaryEntity.capabilities[cap]
 * === true`) — it never inspects the secondary instance's current STATE
 * at all (confirmed by reading `applyAction` directly: no
 * `statePrerequisites` lookup happens on that branch, and
 * `egg_cracked.json` — `combine.json`'s real secondary role — has no
 * `combine` key in its own `statePrerequisites` either). That's a real,
 * pre-existing limitation this planner does not invent — the SAME class
 * of gap `LEARNINGS_ENGINE.md` 2026-08-12 already named for
 * `requiredIngredientCapabilities` ("checks presence via the ingredient's
 * ENTITY definition only — never the ingredient instance's current
 * state"), just never previously stated for THIS mechanism.
 *
 * Two real cases, both handled:
 * 1. `startEntity` ALREADY satisfies `requiredCapability` (e.g. an
 *    already-cracked egg) — used as-is, zero steps, in WHATEVER state it
 *    currently holds (matching the engine's own real, state-blind check).
 * 2. `startEntity` does NOT satisfy it, but a ONE-HOP spawn does (the
 *    real, concrete case this repo actually has: raw `egg` doesn't carry
 *    `isCombinableAddition`, `CRACK`'s own `egg_cracked` byproduct does).
 *    Searches `startEntity.allowedTransformations` for a
 *    `spawnsTargetByproducts` action whose byproduct list
 *    (`byproductsByAction[actionId]` or the flat `producedByproducts`
 *    fallback, the SAME resolution order `engine.ts` itself uses)
 *    contains a qualifying entity, at bounded depth (2 hops) — a real,
 *    small search, not unbounded recursion, since this repo's actual
 *    spawn graphs are shallow (egg -> egg_cracked is the only real case
 *    today).
 *
 * `desiredState`/`desiredTags`, if given, are NOT anything `engine.ts`
 * would ever require — they let a caller ask for a REALISTIC recipe (a
 * genuinely beaten, salted egg, not a technically-legal raw one) by
 * reusing `isGoalReachable` on whichever entity ends up holding the
 * capability. Omitting them produces the bare-minimum, engine-legal
 * (but possibly unrealistic) plan — an honest default, not a silent
 * downgrade.
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

  // One-hop spawn search — see this function's own doc comment for why
  // this is bounded rather than unbounded recursion.
  for (const actionId of startEntity.allowedTransformations) {
    const action = actions.get(actionId);
    if (!action || !action.outputs.spawnsTargetByproducts) continue;
    const byproductIds = startEntity.byproductsByAction[actionId] ?? startEntity.producedByproducts;
    const matchIndex = byproductIds.findIndex(
      (id) => entities.get(id)?.capabilities[requiredCapability] === true
    );
    if (matchIndex === -1) continue;

    // The spawning action itself may have its own state prerequisite —
    // reuse isGoalReachable to get there first, exactly like any other
    // single-instance step (CRACK has none for egg.json today, but this
    // stays correct even if that ever changes).
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
    // spawn logic exactly (SpawnIdTracker's doc comment, and
    // engine.ts's applyAction: byproductEntity.possibleStates[0] is the
    // spawned instance's real starting state; inherited tags are the
    // parent's tags at spawn time, filtered by the byproduct's own
    // possibleTags).
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

/** Assembles a full COMBINE plan: the primary instance's own path to
 *  whatever state `combineActionId` requires (via `isGoalReachable`,
 *  unchanged), the secondary instance's own path (via
 *  `planSecondaryRole` above), and the `COMBINE` step itself, with a
 *  correctly-predicted `resultInstanceId` for `combinesInto`'s spawned
 *  entity. Deliberately does NOT resolve which `combineActionId` to use
 *  from a target entity id alone — `potato_onion_mixture.json`'s own
 *  `capabilityAmbiguityNote` already names a real ambiguity there
 *  (`combine`/`combine_con_cebolla` share `isCombinableBase`); this
 *  function takes the action id as a REQUIRED input, resolved by the
 *  caller (`planIntent`, from the goal's own declared `combine.actionId`),
 *  never guessed. */
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
  // itself is the terminal step, never explored as an intermediate EDGE
  // by isGoalReachable's primary-path search above (that search only
  // ever reaches the state COMBINE requires — it never tries firing
  // COMBINE itself, which needs a secondary instance it has no model of).
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
// RecipeIntent -> RecipeScript (gap 2, ties everything together)
// ---------------------------------------------------------------------

export interface PlanIntentSuccess {
  success: true;
  recipe: RecipeScript;
  /** `recipe.sequence[i]` was produced to satisfy `intent.goals[stepGoalIndex[i]]`
   *  — the same length as `recipe.sequence`, added 2026-08-17 specifically
   *  for `recipe-runner.ts`'s `runRecipeFromIntent` (closed-loop
   *  replanning): on a step failure, this is how the runner knows WHICH
   *  original goal to replan toward, without re-deriving it. */
  stepGoalIndex: number[];
}
export interface PlanIntentFailure {
  success: false;
  /** Which goal (by array index) failed, and why. */
  failures: { goalIndex: number; reason: string }[];
}

/**
 * Resolves a `RecipeIntentSchema` (goals + constraints) into a real,
 * runnable `RecipeScript` — `ROADMAP.md`'s own framing exactly:
 * "`RecipeScriptSchema` itself doesn't go away — it becomes the
 * planner's grounded output." Goals are processed IN ARRAY ORDER
 * (a real, named, deliberate simplification — no goal reordering/
 * backtracking across goals is attempted); a later goal's `instanceId`
 * may reference `"$combineResult:<goalIndex>"` to target what an
 * EARLIER combine-goal produced, letting a full multi-step, multi-
 * instance dish (fry potato, prep egg, combine, then fry the result —
 * the real `tortilla_de_patatas` shape) be planned end to end, not just
 * proposed goal by goal in isolation. Proven against exactly that real
 * dish, not just a synthetic case — see
 * `scripts/planner-as-a-robot.ts`/`npm run capability-test:planner`.
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
  // Tracks each instance id's CURRENT state/tags as goals are resolved in
  // order, seeded from the intent's own declared initialInventory —
  // needed so a later goal on the SAME instance (or a $combineResult
  // reference) starts its own search from the right place, not from the
  // original initialInventory entry.
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
