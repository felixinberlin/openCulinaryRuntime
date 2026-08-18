import { z } from "zod";

/**
 * `ExecutionGraph` — a domain-agnostic IR, the machine-oriented contract
 * between a planning/compiler layer and a runtime (not a fancy version of
 * `Recipe.steps`). Imports nothing from this repo's own domain — only
 * `zod`. A small builder API plus pure structural (DAG) validation;
 * domain-semantic checks (are preconditions satisfiable, are entities
 * real) belong to `execution-graph-compiler.ts`, not here. See
 * `reference/execution-graph.md` for design rationale, scope, and history.
 */

// ---------------------------------------------------------------------------
// The IR itself
// ---------------------------------------------------------------------------

/** One reference from a node to a concrete object already in the world —
 *  "potato-1," not the abstract entity TYPE. `role` is a free-form, open
 *  string rather than a closed enum. */
export const ExecutionInputSchema = z.object({
  entityId: z.string().min(1),
  role: z.string().optional(),
});
export type ExecutionInput = z.infer<typeof ExecutionInputSchema>;

/** A condition describes ONE fact about ONE world entity. A small, closed
 *  discriminated union — deliberately narrower than a full
 *  re-implementation of `engine.ts`'s checks. See `reference/execution-graph.md`. */
export const ConditionSchema = z.discriminatedUnion("type", [
  /** `state` is an array (not a bare string) to honestly represent a real
   *  case in this repo's domain where more than one prior state is
   *  allowed (e.g. potato's `cut` prerequisite: washed OR peeled). */
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
  /** Unlike Condition's `state`, an effect always sets exactly ONE
   *  resulting state. */
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
 *  edge in this graph IS a dependency. */
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

/** Appends `node` to `graph` and returns `graph` (mutated in place).
 *  Throws immediately on a duplicate node id. */
export function addNode(graph: ExecutionGraph, node: ExecutionNode): ExecutionGraph {
  const parsed = ExecutionNodeSchema.parse(node);
  if (graph.nodes.some((n) => n.id === parsed.id)) {
    throw new Error(`addNode: duplicate node id "${parsed.id}"`);
  }
  graph.nodes.push(parsed);
  return graph;
}

/** Adds a `from -> to` dependency edge. Throws on a self-referencing edge
 *  or a reference to a node not yet in the graph. Does NOT check for a
 *  cycle here — call `validateExecutionGraph` once the graph is complete. */
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

/** Pure structural validation only — unique node ids, every edge
 *  references an existing node, no self-loops, and the graph is acyclic
 *  (ExecutionGraph must be a DAG). Collects every problem found. Never
 *  mutates `graph`. See `reference/execution-graph.md`. */
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

  // A malformed edge makes a real topological check meaningless — report
  // the structural errors first and stop.
  if (errors.length > 0) return { valid: false, errors };

  // Kahn's algorithm, self-contained (no dependency on dag-scheduler.ts,
  // which operates on RecipeStep[] — this must work on a bare ExecutionGraph).
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

/** Plain JSON via `JSON.stringify` plus a schema pass, guaranteeing what
 *  comes out is exactly what `deserializeExecutionGraph` can read back in. */
export function serializeExecutionGraph(graph: ExecutionGraph): string {
  return JSON.stringify(ExecutionGraphSchema.parse(graph));
}

/** The reverse of `serializeExecutionGraph` — throws on malformed JSON or
 *  a mismatched shape. Does NOT run `validateExecutionGraph` itself
 *  (schema-valid and structurally-valid are different questions); call
 *  both when a caller needs both guarantees. */
export function deserializeExecutionGraph(json: string): ExecutionGraph {
  return ExecutionGraphSchema.parse(JSON.parse(json));
}

// ---------------------------------------------------------------------------
// A minimal, read-only structural check — NOT a runtime.
// ---------------------------------------------------------------------------

export type OrderCheckResult = { valid: true } | { valid: false; violatedEdge: ExecutionEdge };

/** True iff `attemptedOrder` never runs a node before every edge pointing
 *  into it has its `from` already present earlier in the order. Pure —
 *  reads `graph`, never mutates anything, never executes a node's
 *  actual effects. */
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
