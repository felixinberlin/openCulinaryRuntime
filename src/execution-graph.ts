import { z } from "zod";

/**
 * ExecutionGraph — a domain IR, the machine-oriented contract between a
 * planning/compiler layer and a runtime, per the "Execution Graph" ticket
 * (revised 2026-08-18; supersedes this file's own first pass the same
 * day). The ticket's own closing line is the design constraint this file
 * is held to: **"don't make ExecutionGraph a fancy version of
 * Recipe.steps. It should be the machine-oriented contract between
 * planning and execution."**
 *
 * Concretely, that means this file:
 * - Imports NOTHING from this repo's own domain (`recipe.ts`, `action.ts`,
 *   `ingredient.ts`, `engine.ts`) — only `zod`. A runtime consuming an
 *   `ExecutionGraph` should never need to know what a "recipe," an
 *   "Action," or a "Cooklang file" is. Producing a graph FROM a real
 *   `RecipeScript` is a separate concern, `execution-graph-compiler.ts`
 *   (this ticket's own non-goals list names "recipe parsing," "capability
 *   discovery," and "state inference" as explicitly NOT this ticket's
 *   job — those belong to that producer, not to the IR itself).
 * - Exposes a deliberately SMALL API: `createExecutionGraph`/`addNode`/
 *   `addDependency`/`validateExecutionGraph`/`serializeExecutionGraph`/
 *   `deserializeExecutionGraph`. Not a general-purpose graph library —
 *   no traversal helpers, no query language, nothing beyond what building
 *   and structurally checking one small DAG needs.
 * - `validateExecutionGraph` checks STRUCTURE only (unique node ids,
 *   every edge references a real node, no self-loops, the graph is
 *   acyclic — "ExecutionGraph must be a DAG," documented here per the
 *   ticket's own instruction to do so explicitly). It does NOT check
 *   domain semantics (whether a node's `preconditions` are actually
 *   satisfiable, whether referenced entities/capabilities are real) —
 *   that IS "capability discovery"/"state inference," this ticket's own
 *   named non-goals, and stays `execution-graph-compiler.ts`'s job.
 * - Never mutates anything outside the graph object under construction.
 *   `addNode`/`addDependency` DO mutate the `ExecutionGraph` object
 *   passed in (the conventional shape for a graph-builder API, matching
 *   the ticket's own `addNode(graph, node)` signature rather than a
 *   copy-on-write `graph = addNode(graph, node)` one) — a categorically
 *   different thing from "the compiler/runtime must not mutate WORLD
 *   state," which this file has no way to violate at all: it has no
 *   notion of a world, an inventory, or simulated time.
 */

// ---------------------------------------------------------------------------
// The IR itself
// ---------------------------------------------------------------------------

/** One reference from a node to a concrete object already in the world —
 *  "potato-1," not the abstract entity TYPE "potato" and not a copy of
 *  its data. `role` is a free-form, open string (`"target"`,
 *  `"secondary"`, `"ingredient"`, `"tool"`, ...) rather than a closed
 *  enum, deliberately: this IR does not need to know the full, closed
 *  vocabulary of roles a domain compiler might ever invent. */
export const ExecutionInputSchema = z.object({
  entityId: z.string().min(1),
  role: z.string().optional(),
});
export type ExecutionInput = z.infer<typeof ExecutionInputSchema>;

/**
 * A condition or an effect describes ONE fact about ONE world entity —
 * `{ type: "state", entityId: "potato-1", state: "whole" }`, this
 * ticket's own worked example, verbatim. Kept as a small, closed
 * discriminated union (not a generic `{subject, property, value}` bag)
 * so a runtime never has to guess what a fact "means" — but kept
 * deliberately narrower than a full re-implementation of this repo's own
 * `engine.ts` checks (that richness belongs to
 * `execution-graph-compiler.ts`, which resolves it down to these simple
 * shapes when it can, and simply omits what it can't cleanly express).
 */
export const ConditionSchema = z.discriminatedUnion("type", [
  /** `state` is an array — the ticket's own example is exactly the
   *  one-element case (`state: ["whole"]`, not the bare string
   *  `"whole"|"peeled"` the illustration shows) — a deliberate, minimal
   *  divergence to honestly represent a real, existing case in this
   *  repo's own domain (e.g. potato's real `cut` prerequisite allows
   *  EITHER `"washed"` OR `"peeled"`) without a second Condition variant
   *  just for the two-or-more-allowed-values case. */
  z.object({
    type: z.literal("state"),
    entityId: z.string().min(1),
    state: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    type: z.literal("capability"),
    entityId: z.string().min(1),
    capability: z.string().min(1),
  }),
]);
export type Condition = z.infer<typeof ConditionSchema>;

export const EffectSchema = z.discriminatedUnion("type", [
  /** Unlike `Condition`'s `state`, an effect always sets exactly ONE
   *  resulting state — matching the ticket's own example exactly:
   *  `{ type: "state", entityId: "potato-1", state: "peeled" }`. */
  z.object({ type: z.literal("state"), entityId: z.string().min(1), state: z.string().min(1) }),
  z.object({ type: z.literal("tag"), entityId: z.string().min(1), tag: z.string().min(1) }),
  z.object({ type: z.literal("destroy"), entityId: z.string().min(1) }),
  z.object({
    type: z.literal("spawn"),
    entityId: z.string().min(1),
    fromEntityId: z.string().min(1),
  }),
  z.object({
    type: z.literal("combine"),
    entityIds: z.tuple([z.string().min(1), z.string().min(1)]),
    resultEntityId: z.string().min(1),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const ExecutionNodeSchema = z.object({
  id: z.string().min(1),
  /** A real, closed-vocabulary action id — a string a runtime looks up,
   *  never further parses. */
  action: z.string().min(1),
  inputs: z.array(ExecutionInputSchema),
  preconditions: z.array(ConditionSchema).default([]),
  effects: z.array(EffectSchema).default([]),
});
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

/** `from` must complete before `to` may begin. No `type` field — every
 *  edge in this graph IS a dependency; there is no second edge kind to
 *  distinguish it from (a deliberate simplification from this file's own
 *  first pass, corrected by this ticket's own, narrower `ExecutionEdge`
 *  shape). */
export const ExecutionEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type ExecutionEdge = z.infer<typeof ExecutionEdgeSchema>;

export const ExecutionGraphSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(ExecutionNodeSchema).default([]),
  edges: z.array(ExecutionEdgeSchema).default([]),
});
export type ExecutionGraph = z.infer<typeof ExecutionGraphSchema>;

// ---------------------------------------------------------------------------
// The minimal API
// ---------------------------------------------------------------------------

/** A fresh, empty graph — the only way to start building one. */
export function createExecutionGraph(id: string): ExecutionGraph {
  return ExecutionGraphSchema.parse({ id, nodes: [], edges: [] });
}

/**
 * Appends `node` to `graph` and returns `graph` (mutated in place, see
 * this file's top doc comment). Throws immediately on a duplicate node
 * id — a fast-fail at construction time, distinct from
 * `validateExecutionGraph`'s job of re-checking a WHOLE graph assembled
 * some other way (e.g. deserialized from JSON) after the fact.
 */
export function addNode(graph: ExecutionGraph, node: ExecutionNode): ExecutionGraph {
  const parsed = ExecutionNodeSchema.parse(node);
  if (graph.nodes.some((n) => n.id === parsed.id)) {
    throw new Error(`addNode: duplicate node id "${parsed.id}"`);
  }
  graph.nodes.push(parsed);
  return graph;
}

/**
 * Adds a `from -> to` dependency edge. Throws immediately on a
 * self-referencing edge or a reference to a node not yet in the graph —
 * `addNode` must be called for both ends before `addDependency` connects
 * them, the concrete mechanism that keeps "every edge references
 * existing nodes" true by construction, not just by later validation.
 * Does NOT check for a cycle here (a cycle can only be detected once the
 * whole graph exists, not incrementally per edge) — call
 * `validateExecutionGraph` once the graph is complete for that.
 */
export function addDependency(graph: ExecutionGraph, from: string, to: string): ExecutionGraph {
  if (from === to) {
    throw new Error(`addDependency: a node cannot depend on itself ("${from}")`);
  }
  if (!graph.nodes.some((n) => n.id === from)) {
    throw new Error(`addDependency: unknown node "${from}"`);
  }
  if (!graph.nodes.some((n) => n.id === to)) {
    throw new Error(`addDependency: unknown node "${to}"`);
  }
  graph.edges.push({ from, to });
  return graph;
}

export type GraphValidationResult = { valid: true } | { valid: false; errors: string[] };

/**
 * Pure STRUCTURAL validation only — see this file's top doc comment for
 * why domain-semantic checks (are these preconditions actually
 * satisfiable) deliberately live elsewhere. Checks, in this order:
 * every node id is unique, every edge references an existing node, no
 * edge is self-referencing, and the graph is acyclic (**ExecutionGraph
 * must be a DAG** — a cycle is reported as a structural error, not
 * silently accepted or hung on). Collects every problem found, not just
 * the first. Never mutates `graph`.
 */
export function validateExecutionGraph(graph: ExecutionGraph): GraphValidationResult {
  const errors: string[] = [];

  const seenIds = new Set<string>();
  for (const node of graph.nodes) {
    if (seenIds.has(node.id)) errors.push(`Duplicate node id "${node.id}"`);
    seenIds.add(node.id);
  }

  for (const edge of graph.edges) {
    if (edge.from === edge.to) errors.push(`Self-referencing edge on node "${edge.from}"`);
    if (!seenIds.has(edge.from)) errors.push(`Edge references unknown node "${edge.from}"`);
    if (!seenIds.has(edge.to)) errors.push(`Edge references unknown node "${edge.to}"`);
  }

  // A malformed edge (dangling reference) makes a real topological check
  // meaningless — report the structural errors above first and stop,
  // same "don't compound one real error into a second, confusing one"
  // choice `execution-graph-compiler.ts` makes for its own validation.
  if (errors.length > 0) return { valid: false, errors };

  // Kahn's algorithm, self-contained (no dependency on dag-scheduler.ts,
  // which operates on this repo's own RecipeStep[] — this function must
  // work on a bare ExecutionGraph with no recipe involved at all).
  const inDegree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  const dependents = new Map<string, string[]>(graph.nodes.map((n) => [n.id, []]));
  for (const edge of graph.edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
    dependents.get(edge.from)!.push(edge.to);
  }

  const queue = [...inDegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
  let visitedCount = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visitedCount++;
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, remaining);
      if (remaining === 0) queue.push(dependent);
    }
  }

  if (visitedCount !== graph.nodes.length) {
    return { valid: false, errors: ["Graph contains a cycle — ExecutionGraph must be a DAG"] };
  }

  return { valid: true };
}

/** Plain JSON — every field is already a string/array/plain object, so
 *  this is `JSON.stringify` plus a schema pass to guarantee what comes
 *  out is exactly what `deserializeExecutionGraph` can read back in. */
export function serializeExecutionGraph(graph: ExecutionGraph): string {
  return JSON.stringify(ExecutionGraphSchema.parse(graph));
}

/** The reverse of `serializeExecutionGraph` — throws (via Zod) on
 *  malformed JSON or a shape that doesn't match `ExecutionGraphSchema`,
 *  rather than silently returning a partially-wrong graph. Does NOT run
 *  `validateExecutionGraph` itself (schema-VALID and structurally-VALID
 *  are different questions — a deserialized graph can be perfectly
 *  well-typed and still contain a cycle or a dangling edge); call both
 *  when a caller needs both guarantees. */
export function deserializeExecutionGraph(json: string): ExecutionGraph {
  return ExecutionGraphSchema.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// A minimal, read-only structural check — NOT a runtime (execution stays
// out of scope for this ticket entirely). Useful for tests and future
// tooling that want to confirm a candidate execution ORDER actually
// respects a graph's real dependency edges, without executing anything.
// ---------------------------------------------------------------------------

export type OrderCheckResult = { valid: true } | { valid: false; violatedEdge: ExecutionEdge };

/**
 * True iff `attemptedOrder` never runs a node before every edge pointing
 * INTO it (`edge.to === node`) has its `edge.from` already present
 * earlier in `attemptedOrder`. Pure — reads `graph`, never mutates
 * anything, never executes a node's actual effects.
 */
export function checkExecutionOrder(
  graph: ExecutionGraph,
  attemptedOrder: readonly string[]
): OrderCheckResult {
  const positionOf = new Map(attemptedOrder.map((id, i) => [id, i] as const));
  for (const edge of graph.edges) {
    const fromPos = positionOf.get(edge.from);
    const toPos = positionOf.get(edge.to);
    if (toPos === undefined) continue; // dependent not yet attempted at all
    if (fromPos === undefined || fromPos > toPos) {
      return { valid: false, violatedEdge: edge };
    }
  }
  return { valid: true };
}
