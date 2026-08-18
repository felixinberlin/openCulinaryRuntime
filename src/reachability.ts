import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";

/**
 * `isGoalReachable` — BFS over one instance's own discrete state/tag
 * graph: given the current state, is a declared goal still reachable
 * through the action graph? Edges come from `Entity.allowedTransformations`,
 * `Action`'s own required-capability/tool/ingredient fields, and
 * `Entity.invalidTransitions` — no new graph representation. Scoped to
 * one instance only: a COMBINE-shaped action's secondary-instance
 * requirement, and a conservation-of-mass action's destruction of the
 * instance, are both real, named dead ends, not silently mishandled.
 * Deterministic — plain FIFO BFS in declared array order. See
 * `reference/reachability.md` for design rationale and scope.
 */

export interface GoalPredicate {
  /** Target `state`, if the goal cares about it. */
  state?: string;
  /** Tags the goal requires ALL of, if any — the instance may carry others too. */
  requiredTags?: string[];
}

/** Why a specific action/edge could not be used, anywhere it was tried
 *  during the search — accumulated and deduplicated, not a single guess
 *  at the one true cause. */
export type BlockingReason =
  | { kind: "missing_target_capability"; actionId: string; capability: string }
  | { kind: "missing_tool"; actionId: string; toolId: string }
  | { kind: "missing_tool_capability"; actionId: string; capability: string }
  | { kind: "missing_ingredient_capability"; actionId: string; capability: string }
  | {
      kind: "unsatisfied_state_prerequisite";
      actionId: string;
      fromState: string;
      requiredAnyOf: string[];
    }
  | { kind: "forbidden_transition"; actionId: string; fromState: string; toState: string }
  | { kind: "requires_secondary_instance"; actionId: string }
  | { kind: "instance_destroyed"; actionId: string }
  | { kind: "invalid_target_kind"; actionId: string };

export interface ReachabilityStep {
  actionId: string;
  /** Which `allowedValues` entry was chosen, for a
   *  `transformedStateFromParameter`-driven step (e.g. CUT's
   *  `shape: "diced"`). Absent otherwise. */
  param?: string;
}

export type ReachabilityResult =
  { reachable: true; path: ReachabilityStep[] } | { reachable: false; blockedBy: BlockingReason[] };

export interface ReachabilityQuery {
  entity: Entity;
  /** Every known entity — needed to resolve a candidate tool/ingredient's
   *  own capabilities, the same lookup `engine.ts`'s `applyAction` does. */
  entities: ReadonlyMap<string, Entity>;
  actions: ReadonlyMap<string, Action>;
  startState: string;
  startTags: readonly string[];
  goal: GoalPredicate;
  availableTools: ReadonlySet<string>;
  availableIngredients: ReadonlySet<string>;
}

function nodeKey(state: string, tags: readonly string[]): string {
  return `${state}|${[...new Set(tags)].sort().join(",")}`;
}

function matchesGoal(state: string, tags: readonly string[], goal: GoalPredicate): boolean {
  if (goal.state !== undefined && state !== goal.state) return false;
  if (goal.requiredTags && goal.requiredTags.length > 0) {
    const tagSet = new Set(tags);
    if (!goal.requiredTags.every((t) => tagSet.has(t))) return false;
  }
  return true;
}

export interface Edge {
  step: ReachabilityStep;
  nextState: string;
  nextTags: string[];
}

/** One usable outgoing transition from `(fromState, fromTags)`. Shared by
 *  `isGoalReachable` below and `planner.ts`'s cost-aware search, so both
 *  use identical precondition-checking logic. See `reference/reachability.md`. */
export function enumerateEdges(
  entity: Entity,
  entities: ReadonlyMap<string, Entity>,
  actions: ReadonlyMap<string, Action>,
  fromState: string,
  fromTags: readonly string[],
  availableTools: ReadonlySet<string>,
  availableIngredients: ReadonlySet<string>,
  recordBlock: (reason: BlockingReason) => void
): Edge[] {
  const edges: Edge[] = [];

  for (const actionId of entity.allowedTransformations) {
    const action = actions.get(actionId);
    if (!action) continue; // data-integrity issue caught elsewhere (validate.ts), not this function's job

    if (!action.validTargetKinds.includes(entity.kind)) {
      recordBlock({ kind: "invalid_target_kind", actionId });
      continue;
    }
    if (action.requiredSecondaryCapability) {
      recordBlock({ kind: "requires_secondary_instance", actionId });
      continue;
    }
    if (
      action.requiredTargetCapability &&
      entity.capabilities[action.requiredTargetCapability] !== true
    ) {
      recordBlock({
        kind: "missing_target_capability",
        actionId,
        capability: action.requiredTargetCapability,
      });
      continue;
    }

    let toolsOk = true;
    for (const toolId of action.requiredTools) {
      if (!availableTools.has(toolId)) {
        recordBlock({ kind: "missing_tool", actionId, toolId });
        toolsOk = false;
      }
    }
    for (const capability of action.requiredToolCapabilities) {
      const satisfied = [...availableTools].some(
        (id) => entities.get(id)?.capabilities[capability] === true
      );
      if (!satisfied) {
        recordBlock({ kind: "missing_tool_capability", actionId, capability });
        toolsOk = false;
      }
    }
    if (!toolsOk) continue;

    let ingredientsOk = true;
    for (const capability of action.requiredIngredientCapabilities) {
      const satisfied = [...availableIngredients].some(
        (id) => entities.get(id)?.capabilities[capability] === true
      );
      if (!satisfied) {
        recordBlock({ kind: "missing_ingredient_capability", actionId, capability });
        ingredientsOk = false;
      }
    }
    if (!ingredientsOk) continue;

    const requiredPrior = entity.statePrerequisites[actionId];
    if (requiredPrior) {
      const allowed = Array.isArray(requiredPrior) ? requiredPrior : [requiredPrior];
      const satisfied = allowed.includes(fromState) || allowed.some((s) => fromTags.includes(s));
      if (!satisfied) {
        recordBlock({
          kind: "unsatisfied_state_prerequisite",
          actionId,
          fromState,
          requiredAnyOf: allowed,
        });
        continue;
      }
    }

    // Conservation-of-mass actions are a real dead end for THIS instance —
    // recorded, not silently skipped, yielded with zero outgoing edges.
    if (action.outputs.destroysTarget || action.outputs.combinesInto) {
      recordBlock({ kind: "instance_destroyed", actionId });
      continue;
    }

    const candidates: { state: string; param?: string }[] = [];
    if (action.outputs.transformedState) {
      candidates.push({ state: action.outputs.transformedState });
    } else if (action.outputs.transformedStateFromParameter) {
      const paramDef = action.parameters.find(
        (p) => p.id === action.outputs.transformedStateFromParameter
      );
      for (const value of paramDef?.allowedValues ?? []) {
        candidates.push({ state: value, param: value });
      }
    } else {
      // Tag-only (or otherwise state-preserving) action — state doesn't change.
      candidates.push({ state: fromState });
    }

    for (const { state: nextState, param } of candidates) {
      if (entity.invalidTransitions[fromState]?.includes(nextState)) {
        recordBlock({ kind: "forbidden_transition", actionId, fromState, toState: nextState });
        continue;
      }
      let nextTags = [...fromTags];
      if (action.outputs.addsTag && !fromTags.includes(action.outputs.addsTag)) {
        nextTags = [...fromTags, action.outputs.addsTag];
      }
      const step: ReachabilityStep = param !== undefined ? { actionId, param } : { actionId };
      edges.push({ step, nextState, nextTags });
    }
  }

  return edges;
}

export function isGoalReachable(query: ReachabilityQuery): ReachabilityResult {
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

  if (matchesGoal(startState, startTags, goal)) {
    return { reachable: true, path: [] };
  }

  const blockedBy: BlockingReason[] = [];
  const blockedByKeys = new Set<string>();
  function recordBlock(reason: BlockingReason): void {
    const k = JSON.stringify(reason);
    if (!blockedByKeys.has(k)) {
      blockedByKeys.add(k);
      blockedBy.push(reason);
    }
  }

  interface QueueNode {
    state: string;
    tags: readonly string[];
    path: ReachabilityStep[];
  }
  const visited = new Set<string>([nodeKey(startState, startTags)]);
  const queue: QueueNode[] = [{ state: startState, tags: startTags, path: [] }];

  while (queue.length > 0) {
    const node = queue.shift()!; // FIFO — BFS, deterministic given deterministic push order below

    const edges = enumerateEdges(
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
      const nextPath = [...node.path, edge.step];

      if (matchesGoal(edge.nextState, edge.nextTags, goal)) {
        return { reachable: true, path: nextPath };
      }

      const nextKey = nodeKey(edge.nextState, edge.nextTags);
      if (!visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push({ state: edge.nextState, tags: edge.nextTags, path: nextPath });
      }
    }
  }

  return { reachable: false, blockedBy };
}
