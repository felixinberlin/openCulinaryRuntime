import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";

/**
 * `isGoalReachable` — TICKET 4 of `PAPER_NOTES_2608.04768.md` (Song et al.,
 * arXiv:2608.04768, 2026 — `REFERENCES.md`), deliberately the LAST of that
 * ticket list ("the real work... do last, do slowly").
 *
 * Their equation (9) triggers "recipe migration" when the minimum
 * achievable deviation from the goal state exceeds a tolerance:
 * `min_actions D(S_proj, S_goal) > ε`. Strip the robotics off and this is a
 * pure offline validator query: given the current world state, is the
 * declared goal still reachable through the action graph? That's
 * `CONCEPT.md` §12's victory conditions plus §13's validation engine, and
 * the kind of question `SIMULATION_TARGETS.md` candidate #1 (PDDL) exists
 * to buy — and a question no system in that paper's own citation list can
 * answer OFFLINE; they need a physical wok and a running dish to discover
 * it empirically.
 *
 * DELIBERATELY SCOPED AS REACHABILITY ONLY, not migration (per the ticket's
 * own instruction) — proposing an alternative goal is planning, which this
 * repo doesn't have a planner for. `D(·,·)` itself is also NOT
 * reproduced: it's a weighted sum over continuous variables (concentration,
 * thermal distribution, appearance) with no stated weights in the paper —
 * attempting it would be inventing numbers this repo has no basis for. This
 * is BFS over the DISCRETE state/tag graph only — no numeric fluents, no
 * thermal dose, no tolerance metric — which `SIMULATION_TARGETS.md` already
 * notes is exactly where classical PDDL sits (no numeric fluents either),
 * and is a real, answerable, useful question on its own.
 *
 * SCOPED TO ONE INSTANCE'S OWN STATE GRAPH, not a full multi-instance
 * world — the same narrowing this repo's other standalone-before-engine-
 * wiring modules use (`place.ts`, `execution-bounds.ts`, ...). Concretely:
 * - Edges come from the THREE pieces of data that already exist for this
 *   exact purpose, per the ticket's own explicit instruction ("all three
 *   already exist; do not invent a new graph representation"):
 *   `Entity.allowedTransformations` (candidate verbs), `Action`'s own
 *   `requiredTargetCapability`/`requiredTools`/`requiredToolCapabilities`/
 *   `requiredIngredientCapabilities` (whether an edge is actually usable
 *   given the tools/ingredients on hand), and `Entity.invalidTransitions`
 *   (closures — the exact matrix `606f056`/narrowed `3e2050a` built).
 * - A `transformedStateFromParameter` action (e.g. `CUT`'s `shape`) fans
 *   out into one candidate edge per `allowedValues` entry — a planner
 *   could choose any of them; this is genuinely multiple real edges, not
 *   one ambiguous one.
 * - A `requiredSecondaryCapability` (COMBINE-shaped) action is a real,
 *   NAMED non-goal, not silently mishandled: this search tracks ONE
 *   instance's own reachability, has no model of a second instance being
 *   available, and refuses to guess — recorded as a `requires_secondary_
 *   instance` blocking reason and the edge is not explored.
 * - `destroysTarget`/`combinesInto` (conservation-of-mass actions —
 *   `SEPARATE`, `CRACK`, `COMBINE`) are real dead ends for THIS instance:
 *   once fired, the instance no longer exists to reach anything further,
 *   correctly modeled as a `instance_destroyed` blocking reason with zero
 *   outgoing edges, not a state this search pretends persists. This is
 *   the exact, real mechanism behind "an egg separated into yolk/white can
 *   never reach a goal of 'a whole boiled egg' again" — not because
 *   `invalidTransitions` forbids it, but because the ORIGINAL instance is
 *   gone; no verb in this vocabulary recombines yolk+white+shell back into
 *   one egg.
 *
 * DETERMINISM (`ENGINE_INVARIANTS.md` #9): plain BFS, FIFO queue, visiting
 * `entity.allowedTransformations` in its own declared array order at each
 * node and — for a parameter-driven action — `parameters[].allowedValues`
 * in its own declared array order. Neither depends on `Map`/`Set`
 * iteration order for the RESULT (tool/ingredient capability checks are
 * boolean membership tests, not order-sensitive) — the same path is
 * returned for the same inputs every time; see `tests/reachability.test.ts`
 * for a direct check of this, not just an assumption.
 */

export interface GoalPredicate {
  /** Target `state`, if the goal cares about it. */
  state?: string;
  /** Tags the goal requires ALL of, if any — the instance may carry others too. */
  requiredTags?: string[];
}

/**
 * Why a specific action/edge could not be used, ANYWHERE it was tried
 * during the search — the accumulated, deduplicated answer to "the reason
 * is the useful part," not a single guess at the one true cause. Multiple
 * reasons can (and often do) apply across the whole search.
 */
export type BlockingReason =
  | { kind: "missing_target_capability"; actionId: string; capability: string }
  | { kind: "missing_tool"; actionId: string; toolId: string }
  | { kind: "missing_tool_capability"; actionId: string; capability: string }
  | { kind: "missing_ingredient_capability"; actionId: string; capability: string }
  | { kind: "unsatisfied_state_prerequisite"; actionId: string; fromState: string; requiredAnyOf: string[] }
  | { kind: "forbidden_transition"; actionId: string; fromState: string; toState: string }
  | { kind: "requires_secondary_instance"; actionId: string }
  | { kind: "instance_destroyed"; actionId: string }
  | { kind: "invalid_target_kind"; actionId: string };

export interface ReachabilityStep {
  actionId: string;
  /** Which `allowedValues` entry was chosen, for a `transformedStateFromParameter`-driven step (e.g. CUT's `shape: "diced"`). Absent for a fixed-`transformedState` or tag-only step. */
  param?: string;
}

export type ReachabilityResult =
  | { reachable: true; path: ReachabilityStep[] }
  | { reachable: false; blockedBy: BlockingReason[] };

export interface ReachabilityQuery {
  entity: Entity;
  /** Every known entity — needed to resolve a candidate tool/ingredient's own capabilities, the same lookup `engine.ts`'s `applyAction` does. */
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

export function isGoalReachable(query: ReachabilityQuery): ReachabilityResult {
  const { entity, entities, actions, startState, startTags, goal, availableTools, availableIngredients } = query;

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

    for (const actionId of entity.allowedTransformations) {
      const action = actions.get(actionId);
      if (!action) continue; // an unresolvable action id is a data-integrity issue scripts/validate.ts's own cross-reference already catches; not this function's job to re-flag

      if (!action.validTargetKinds.includes(entity.kind)) {
        recordBlock({ kind: "invalid_target_kind", actionId });
        continue;
      }
      if (action.requiredSecondaryCapability) {
        recordBlock({ kind: "requires_secondary_instance", actionId });
        continue;
      }
      if (action.requiredTargetCapability && entity.capabilities[action.requiredTargetCapability] !== true) {
        recordBlock({ kind: "missing_target_capability", actionId, capability: action.requiredTargetCapability });
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
        const satisfied = [...availableTools].some((id) => entities.get(id)?.capabilities[capability] === true);
        if (!satisfied) {
          recordBlock({ kind: "missing_tool_capability", actionId, capability });
          toolsOk = false;
        }
      }
      if (!toolsOk) continue;

      let ingredientsOk = true;
      for (const capability of action.requiredIngredientCapabilities) {
        const satisfied = [...availableIngredients].some((id) => entities.get(id)?.capabilities[capability] === true);
        if (!satisfied) {
          recordBlock({ kind: "missing_ingredient_capability", actionId, capability });
          ingredientsOk = false;
        }
      }
      if (!ingredientsOk) continue;

      const requiredPrior = entity.statePrerequisites[actionId];
      if (requiredPrior) {
        const allowed = Array.isArray(requiredPrior) ? requiredPrior : [requiredPrior];
        const satisfied = allowed.includes(node.state) || allowed.some((s) => node.tags.includes(s));
        if (!satisfied) {
          recordBlock({ kind: "unsatisfied_state_prerequisite", actionId, fromState: node.state, requiredAnyOf: allowed });
          continue;
        }
      }

      // Conservation-of-mass actions are a real dead end for THIS
      // instance — see this file's own top doc comment. Recorded, not
      // silently skipped, and deliberately explored with ZERO outgoing
      // edges (never pushed to the queue).
      if (action.outputs.destroysTarget || action.outputs.combinesInto) {
        recordBlock({ kind: "instance_destroyed", actionId });
        continue;
      }

      const candidates: { state: string; param?: string }[] = [];
      if (action.outputs.transformedState) {
        candidates.push({ state: action.outputs.transformedState });
      } else if (action.outputs.transformedStateFromParameter) {
        const paramDef = action.parameters.find((p) => p.id === action.outputs.transformedStateFromParameter);
        for (const value of paramDef?.allowedValues ?? []) {
          candidates.push({ state: value, param: value });
        }
      } else {
        // Tag-only (or otherwise state-preserving) action — state doesn't change.
        candidates.push({ state: node.state });
      }

      for (const { state: nextState, param } of candidates) {
        if (entity.invalidTransitions[node.state]?.includes(nextState)) {
          recordBlock({ kind: "forbidden_transition", actionId, fromState: node.state, toState: nextState });
          continue;
        }
        let nextTags = node.tags;
        if (action.outputs.addsTag && !node.tags.includes(action.outputs.addsTag)) {
          nextTags = [...node.tags, action.outputs.addsTag];
        }
        const step: ReachabilityStep = param !== undefined ? { actionId, param } : { actionId };
        const nextPath = [...node.path, step];

        if (matchesGoal(nextState, nextTags, goal)) {
          return { reachable: true, path: nextPath };
        }

        const nextKey = nodeKey(nextState, nextTags);
        if (!visited.has(nextKey)) {
          visited.add(nextKey);
          queue.push({ state: nextState, tags: nextTags, path: nextPath });
        }
      }
    }
  }

  return { reachable: false, blockedBy };
}
