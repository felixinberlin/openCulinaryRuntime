import type { Action } from "./action.ts";
import type { RecipeStep } from "./recipe.ts";
import { parseDurationSecondsParam } from "./in-progress-action.ts";

/**
 * Computes a deterministic, dependency-respecting execution SCHEDULE for a
 * recipe's steps, distinguishing ACTIVE steps (need an actor's ongoing
 * hands) from PASSIVE ones (run themselves once started) — as read-only
 * information, not a change to how `recipe-runner.ts` actually executes
 * (still one step at a time, still mutation-safe). `topologicalOrder` IS
 * wired into `runRecipe` to pick a valid execution order. See
 * `reference/dag-scheduler.md` for design rationale, scope, and history.
 */

/** Resolves a step's stable id: its own `id` if set, otherwise its array
 *  index as a string. */
export function resolveStepId(step: RecipeStep, index: number): string {
  return step.id ?? String(index);
}

/** Resolves the full dependency edge list for every step in `sequence`:
 *  a step's own explicit `dependsOn` when set, otherwise an auto-derived
 *  single edge to the immediately preceding step. */
export function deriveDependsOn(sequence: readonly RecipeStep[]): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  sequence.forEach((step, index) => {
    const id = resolveStepId(step, index);
    if (step.dependsOn !== undefined) {
      edges.set(id, step.dependsOn);
    } else if (index === 0) {
      edges.set(id, []);
    } else {
      edges.set(id, [resolveStepId(sequence[index - 1]!, index - 1)]);
    }
  });
  return edges;
}

/**
 * Kahn's algorithm: returns a valid topological order when the graph is
 * acyclic, or the ids forming one real cycle when it is not. Deterministic
 * — ties are broken by original `sequence` order. See `reference/dag-scheduler.md`.
 */
export function topologicalOrder(
  sequence: readonly RecipeStep[]
): { order: string[] } | { cycle: string[] } {
  const ids = sequence.map((step, index) => resolveStepId(step, index));
  const edges = deriveDependsOn(sequence);
  const indexById = new Map(ids.map((id, i) => [id, i]));

  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  const dependents = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const id of ids) {
    for (const dep of edges.get(id) ?? []) {
      if (!inDegree.has(dep)) {
        throw new Error(`Step "${id}" depends on unknown step id "${dep}"`);
      }
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      dependents.get(dep)!.push(id);
    }
  }

  const ready = ids.filter((id) => inDegree.get(id) === 0);
  // Sort by original position so a tie among simultaneously-ready nodes
  // resolves the same way every run — determinism, not just convenience.
  ready.sort((a, b) => indexById.get(a)! - indexById.get(b)!);

  const order: string[] = [];
  const queue = [...ready];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    const freed: string[] = [];
    for (const dependent of dependents.get(id)!) {
      const remaining = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) freed.push(dependent);
    }
    freed.sort((a, b) => indexById.get(a)! - indexById.get(b)!);
    // Insert freed nodes in position order, keeping the whole queue sorted.
    for (const id2 of freed) {
      const pos = queue.findIndex((q) => indexById.get(q)! > indexById.get(id2)!);
      if (pos === -1) queue.push(id2);
      else queue.splice(pos, 0, id2);
    }
  }

  if (order.length === ids.length) return { order };

  // A cycle exists: every id still holding a positive inDegree is part of
  // one, reported in original order for a stable, readable error.
  const cycle = ids.filter((id) => (inDegree.get(id) ?? 0) > 0);
  return { cycle };
}

export interface DagNode {
  id: string;
  dependsOn: string[];
  durationSeconds: number;
  /** Whether this node needs the single shared actor's ongoing hands. See
   *  `action.ts`'s `requiresActiveAttention`. */
  active: boolean;
  /** Tool entity ids this node occupies EXCLUSIVELY for its whole
   *  duration — a PASSIVE node (BOIL) still occupies its pot even though
   *  it frees the actor's hands. Scoped to exact tool ids only, not
   *  substitutable capabilities. See `reference/dag-scheduler.md`. */
  requiredToolIds: string[];
}

export interface ScheduledNode {
  id: string;
  startSeconds: number;
  finishSeconds: number;
}

export interface DagSchedule {
  nodes: Map<string, ScheduledNode>;
  /** Total elapsed simulated time for the whole graph —
   *  `max(finishSeconds)` across every node. */
  totalSeconds: number;
}

/**
 * A deterministic greedy list-scheduling algorithm over one shared
 * "active" resource (the actor's hands) plus per-tool exclusive-occupancy
 * resources (`requiredToolIds`), with unlimited capacity for everything
 * else. Not provably minimal-makespan — an honest earliest-ready-first
 * heuristic, not a general optimizer. Requires `nodes` already in
 * topological order (call `topologicalOrder` first). See
 * `reference/dag-scheduler.md`.
 */
export function scheduleDag(nodes: readonly DagNode[]): DagSchedule {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id); // caller-supplied order IS the tie-break order
  const finishOf = new Map<string, number>();
  const scheduled = new Map<string, ScheduledNode>();

  let actorFreeAtSeconds = 0;
  const toolFreeAtSeconds = new Map<string, number>();
  // A single forward pass suffices since `nodes` is already in
  // dependency-respecting order (no need to re-derive readiness via a
  // queue the way topologicalOrder itself does).
  for (const id of order) {
    const node = byId.get(id)!;
    const readySeconds = node.dependsOn.reduce((max, depId) => {
      const depFinish = finishOf.get(depId);
      if (depFinish === undefined) {
        throw new Error(
          `scheduleDag: "${id}" depends on "${depId}", which has not been scheduled yet — nodes must be in topological order`
        );
      }
      return Math.max(max, depFinish);
    }, 0);

    // A node waits on every applicable constraint: its own dependencies,
    // the shared actor if active, and every tool it exclusively occupies.
    let startSeconds = readySeconds;
    if (node.active) startSeconds = Math.max(startSeconds, actorFreeAtSeconds);
    for (const toolId of node.requiredToolIds) {
      startSeconds = Math.max(startSeconds, toolFreeAtSeconds.get(toolId) ?? 0);
    }
    const finishSeconds = startSeconds + node.durationSeconds;

    if (node.active) actorFreeAtSeconds = finishSeconds;
    for (const toolId of node.requiredToolIds) {
      toolFreeAtSeconds.set(toolId, finishSeconds);
    }
    finishOf.set(id, finishSeconds);
    scheduled.set(id, { id, startSeconds, finishSeconds });
  }

  const totalSeconds = Math.max(0, ...[...scheduled.values()].map((n) => n.finishSeconds));
  return { nodes: scheduled, totalSeconds };
}

/**
 * The real end-to-end entry point against actual `RecipeStep`s/loaded
 * `Action`s: resolves each step's duration via
 * `in-progress-action.ts`'s `parseDurationSecondsParam`, falling back to
 * 0 (a scheduling ESTIMATE, not a safety bound). `active` defaults to
 * `true` (the safe default) for any unaudited continuous action. See
 * `reference/dag-scheduler.md`.
 */
export function scheduleDagFromSteps(
  sequence: readonly RecipeStep[],
  actions: ReadonlyMap<string, Action>
): DagSchedule {
  const topo = topologicalOrder(sequence);
  if ("cycle" in topo) {
    throw new Error(
      `scheduleDagFromSteps: circular dependency among steps [${topo.cycle.join(", ")}]`
    );
  }
  const edges = deriveDependsOn(sequence);
  const byId = new Map(sequence.map((step, index) => [resolveStepId(step, index), step] as const));
  // Built in the VALIDATED topological order, not raw array order —
  // scheduleDag requires every dependency to already be scheduled first.
  const nodes: DagNode[] = topo.order.map((id) => {
    const step = byId.get(id)!;
    const action = actions.get(step.actionId);
    const durationSeconds = parseDurationSecondsParam(step.params) ?? 0;
    const active =
      action?.actionKind !== "continuous" ? true : (action.requiresActiveAttention ?? true);
    // requiredTools only — requiredToolCapabilities deliberately
    // excluded, see DagNode.requiredToolIds's own notes.
    const requiredToolIds = action?.requiredTools ?? [];
    return { id, dependsOn: edges.get(id) ?? [], durationSeconds, active, requiredToolIds };
  });
  return scheduleDag(nodes);
}
