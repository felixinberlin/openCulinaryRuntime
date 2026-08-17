import type { Action } from "./action.ts";
import type { RecipeStep } from "./recipe.ts";
import { parseDurationSecondsParam } from "./in-progress-action.ts";

/**
 * ROADMAP.md's "Recipe execution as a DAG" entry — a directed-ticket
 * request to stop treating a recipe as a strictly linear, blocking array
 * ("a flat list requires a chef to stand idle... while water boils") and
 * instead schedule around real dependency structure, distinguishing
 * ACTIVE steps (need a chef/actor's ongoing hands, `action.ts`'s
 * `requiresActiveAttention`) from PASSIVE ones (driven by time/thermal
 * models, run themselves once started).
 *
 * SCOPE, decided deliberately rather than assumed: this module computes a
 * SCHEDULE — a deterministic, pure-function ESTIMATE of when each step
 * could start/finish if genuinely concurrent, and the resulting total
 * elapsed time — as read-only INFORMATION, the same standalone-module-
 * before-engine-wiring precedent as `execution-bounds.ts`/
 * `in-progress-action.ts`. It does NOT make `recipe-runner.ts`'s
 * `runRecipe` actually execute steps concurrently: that function mutates
 * one shared inventory `Map`, `PlaceState`s, and tool-contamination state
 * step by step, and real concurrent mutation of shared state is exactly
 * what `ENGINE_INVARIANTS.md` #9's determinism guarantee exists to rule
 * out (two steps racing to mutate the same inventory Map in a
 * nondeterministic interleaving is a bug class, not a feature) — "spin up
 * parallel threads" is interpreted here as "compute what a concurrent
 * schedule WOULD be," not literal OS/JS-runtime threads, which would gain
 * nothing for a synchronous simulation and would cost the one invariant
 * this whole engine is built on. `topologicalOrder` below IS wired into
 * `recipe-runner.ts` (a real, safe use of this module: pick a valid
 * dependency-respecting execution order instead of raw array order —
 * still single-pass, still deterministic, still mutation-safe, and
 * behavior-preserving for every existing recipe because their
 * auto-derived sequential edges reproduce the original array order
 * exactly) — see that file's own doc comment for the specific integration
 * point.
 *
 * Every function here is a pure function of its arguments — no hidden
 * state, no wall-clock read (`ENGINE_INVARIANTS.md` #9).
 */

/** Resolves a step's stable id: its own `id` if set, otherwise its array
 *  index as a string — the same fallback `RecipeStepSchema.id`'s own doc
 *  comment names, so every recipe written before `id`/`dependsOn` existed
 *  still has a fully addressable id for every step. */
export function resolveStepId(step: RecipeStep, index: number): string {
  return step.id ?? String(index);
}

/**
 * Resolves the FULL dependency edge list for every step in `sequence`:
 * a step's own explicit `dependsOn` when set (including a deliberately
 * empty array — "no prerequisite," not "not specified"), otherwise an
 * auto-derived single edge to the immediately preceding step — the exact
 * linear order every recipe already had before this field existed, made
 * explicit. This is also the concrete mechanism that satisfies "existing
 * linear imports auto-generate sequential dependsOn edges" for every one
 * of this repo's real recipes today (no Cooklang importer exists yet to
 * import FROM — see `CLAUDE.md`'s own module-layout table — but every
 * existing `data/recipes/*.json` IS already exactly this kind of flat,
 * linear import, and is treated identically here).
 */
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
 * Kahn's algorithm: returns a valid topological order (every id appears
 * after everything it `dependsOn`) when the graph is acyclic, or the
 * ids forming ONE real cycle when it is not — never both. Deterministic:
 * ties (multiple nodes simultaneously ready) are broken by original
 * `sequence` order, not object/Map iteration order, so the SAME recipe
 * always produces the SAME order (`ENGINE_INVARIANTS.md` #9) — this is
 * also exactly what keeps every existing linear recipe's derived
 * topological order identical to its original array order (see this
 * file's own top doc comment).
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
    // Insert freed nodes in position order, keeping the whole queue sorted —
    // an O(n) splice per batch is fine at this graph's real size (a recipe
    // has tens of steps, not thousands).
    for (const id2 of freed) {
      const pos = queue.findIndex((q) => indexById.get(q)! > indexById.get(id2)!);
      if (pos === -1) queue.push(id2);
      else queue.splice(pos, 0, id2);
    }
  }

  if (order.length === ids.length) return { order };

  // A cycle exists: every id still holding a positive inDegree is part of
  // one (or reachable only through one) — report them in original order
  // for a stable, readable error rather than raw Map iteration order.
  const cycle = ids.filter((id) => (inDegree.get(id) ?? 0) > 0);
  return { cycle };
}

export interface DagNode {
  id: string;
  dependsOn: string[];
  durationSeconds: number;
  /** Whether this node needs the single shared actor's ongoing hands —
   *  see `action.ts`'s `requiresActiveAttention` doc comment for the real
   *  reasoning. `scheduleDagFromSteps` derives this automatically from a
   *  loaded `Action`; only `scheduleDag` itself takes it as a raw input,
   *  for direct unit testing without a full `Action`/`RecipeStep` pair. */
  active: boolean;
  /**
   * Tool entity ids this node occupies EXCLUSIVELY for its whole duration
   * — added 2026-08-17, `WORLD_MODEL_OPTIMIZATION.md`'s named-but-unbuilt
   * `toolLockBehavior` idea ("a tool held exclusively for a duration, e.g.
   * can't fry two things in the same pan at once"), the direct sequel to
   * this file's own top doc comment naming "unlimited passive capacity"
   * as a real, named simplification. A DIFFERENT constraint from `active`:
   * a PASSIVE node (BOIL) still occupies its pot for its whole duration
   * even though it frees the actor's hands — the pot itself, not the
   * actor, is the scarce resource being modeled here. Defaults to `[]`
   * (no tool lock) — every node built before this field existed is
   * unaffected. Deliberately scoped to `requiredTools` (exact tool id)
   * ONLY, not `requiredToolCapabilities` (substitutable — e.g. "any deep
   * vessel"): which SPECIFIC capability-satisfying tool a step actually
   * occupies is genuinely ambiguous without a real per-recipe tool-
   * instance binding this schema doesn't have (unlike ingredients,
   * `RecipeScript.availableTools` is a flat list of tool TYPES available
   * throughout the whole recipe, not `RecipeInstanceSchema`-style
   * individually tracked instances) — named as a real, honest limit
   * rather than guessed at.
   */
  requiredToolIds: string[];
}

export interface ScheduledNode {
  id: string;
  startSeconds: number;
  finishSeconds: number;
}

export interface DagSchedule {
  nodes: Map<string, ScheduledNode>;
  /** The real payoff — total elapsed simulated time for the WHOLE graph,
   *  i.e. `max(finishSeconds)` across every node. This is the number that
   *  answers "10 minutes, not 15" for a passive-boil-concurrent-with-
   *  active-chop graph. */
  totalSeconds: number;
}

/**
 * The scheduler itself: a deterministic GREEDY list-scheduling algorithm
 * over one shared "active" resource (one actor's hands) plus per-tool
 * exclusive-occupancy resources (`requiredToolIds` — added 2026-08-17,
 * `toolLockBehavior`), with genuinely unlimited capacity ONLY for whatever
 * neither of those two constraints covers (e.g. two independent MARINATE
 * steps in two different, unnamed bowls really can run fully concurrently
 * — a real simplification, still named rather than silently assumed: a
 * genuinely resource-constrained kitchen has a finite number of bowls
 * too, just not modeled at that granularity here).
 *
 * NOT claimed to be provably minimal-makespan — true resource-constrained
 * project scheduling with precedence constraints is NP-hard in general;
 * this is a real, honest, "earliest-ready-time-first" heuristic (process
 * nodes in the order their dependencies clear, breaking ties by original
 * `sequence` position for determinism), the same engineering-honesty
 * depth this repo already holds every other non-exhaustive algorithm to
 * (e.g. `planner.ts`'s own `planIntent`, resolved in ARRAY ORDER, not
 * globally optimized). For the graph shapes this repo's real recipes
 * actually have (a handful of independent prep branches converging on a
 * final cook step), earliest-ready-first IS optimal — but that is a
 * property of these specific graphs, not a general guarantee this
 * function makes.
 *
 * Requires `nodes` to already be a valid DAG (see `topologicalOrder` —
 * call that FIRST and handle a `{ cycle }` result before ever reaching
 * this function; a cyclic graph has no valid schedule and this function
 * does not itself detect one).
 */
export function scheduleDag(nodes: readonly DagNode[]): DagSchedule {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id); // caller-supplied order IS the tie-break order
  const finishOf = new Map<string, number>();
  const scheduled = new Map<string, ScheduledNode>();

  let actorFreeAtSeconds = 0;
  const toolFreeAtSeconds = new Map<string, number>();
  // Process in a topological-compatible order: since `nodes` must already
  // respect dependency order for this to be correct (the caller's own
  // `topologicalOrder` output, or any order where every dependency
  // precedes its dependents), a single forward pass is sufficient — no
  // need to re-derive readiness via a queue the way `topologicalOrder`
  // itself does, since ordering is already guaranteed.
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

    // A node waits on EVERY constraint that applies to it: its own
    // dependencies (readySeconds), the shared actor if it's active, AND
    // every tool it exclusively occupies — a passive BOIL still waits for
    // its own pot to free up even though it doesn't touch the actor
    // constraint at all.
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
 * `Action`s: resolves each step's duration via `in-progress-action.ts`'s
 * `parseDurationSecondsParam` (the SAME extraction `beginAction` there
 * uses — a shared function, not parallel duplicated logic), falling back
 * to 0 for a step with no caller-specified duration (an instantaneous
 * action, or a continuous one called without `durationSeconds` — this is
 * a scheduling ESTIMATE, not a safety bound; `execution-bounds.ts`'s
 * `maxDurationSeconds` is the real ceiling for that separate concern).
 * `active` is
 * `action.requiresActiveAttention` when the action is continuous and
 * that field has been audited, else `true` for EVERY instantaneous
 * action (this vocabulary's real, structural rule — see
 * `requiresActiveAttention`'s own doc comment) and `true` (the SAFE
 * default — assume it needs an actor unless proven otherwise) for an
 * unaudited continuous action, so an unclassified action can never be
 * silently scheduled as if it were free/passive.
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
  // Build nodes in the VALIDATED topological order, not raw array order —
  // scheduleDag requires every dependency to already be scheduled before
  // its dependent is processed, which an explicit out-of-order dependsOn
  // (a later step id referenced by an earlier one) would violate if the
  // original sequence order were used unchanged.
  const nodes: DagNode[] = topo.order.map((id) => {
    const step = byId.get(id)!;
    const action = actions.get(step.actionId);
    const durationSeconds = parseDurationSecondsParam(step.params) ?? 0;
    const active =
      action?.actionKind !== "continuous" ? true : (action.requiresActiveAttention ?? true);
    // requiredTools only — requiredToolCapabilities deliberately excluded,
    // see DagNode.requiredToolIds' own doc comment for why (which specific
    // capability-satisfying tool a step occupies is genuinely ambiguous
    // without per-recipe tool-instance tracking this schema doesn't have).
    const requiredToolIds = action?.requiredTools ?? [];
    return { id, dependsOn: edges.get(id) ?? [], durationSeconds, active, requiredToolIds };
  });
  return scheduleDag(nodes);
}
