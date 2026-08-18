# `src/execution-graph.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

`ExecutionGraph` — a domain IR, the machine-oriented contract between a
planning/compiler layer and a runtime, per the "Execution Graph" ticket
(revised 2026-08-18; supersedes this file's own first pass the same day).
The ticket's own closing line is the design constraint this file is held
to: **"don't make ExecutionGraph a fancy version of Recipe.steps. It
should be the machine-oriented contract between planning and
execution."**

Concretely, that means this file:

- Imports NOTHING from this repo's own domain (`recipe.ts`, `action.ts`,
  `ingredient.ts`, `engine.ts`) — only `zod`. A runtime consuming an
  `ExecutionGraph` should never need to know what a "recipe," an
  "Action," or a "Cooklang file" is. Producing a graph FROM a real
  `RecipeScript` is a separate concern, `execution-graph-compiler.ts`
  (this ticket's own non-goals list names "recipe parsing," "capability
  discovery," and "state inference" as explicitly NOT this ticket's job —
  those belong to that producer, not to the IR itself).
- Exposes a deliberately SMALL API: `createExecutionGraph`/`addNode`/
  `addDependency`/`validateExecutionGraph`/`serializeExecutionGraph`/
  `deserializeExecutionGraph`. Not a general-purpose graph library — no
  traversal helpers, no query language, nothing beyond what building and
  structurally checking one small DAG needs.
- `validateExecutionGraph` checks STRUCTURE only (unique node ids, every
  edge references a real node, no self-loops, the graph is acyclic —
  "ExecutionGraph must be a DAG," documented here per the ticket's own
  instruction to do so explicitly). It does NOT check domain semantics
  (whether a node's `preconditions` are actually satisfiable, whether
  referenced entities/capabilities are real) — that IS "capability
  discovery"/"state inference," this ticket's own named non-goals, and
  stays `execution-graph-compiler.ts`'s job.
- Never mutates anything outside the graph object under construction.
  `addNode`/`addDependency` DO mutate the `ExecutionGraph` object passed
  in (the conventional shape for a graph-builder API, matching the
  ticket's own `addNode(graph, node)` signature rather than a
  copy-on-write `graph = addNode(graph, node)` one) — a categorically
  different thing from "the compiler/runtime must not mutate WORLD
  state," which this file has no way to violate at all: it has no notion
  of a world, an inventory, or simulated time.

## `ExecutionInputSchema`

One reference from a node to a concrete object already in the world —
"potato-1," not the abstract entity TYPE "potato" and not a copy of its
data. `role` is a free-form, open string (`"target"`, `"secondary"`,
`"ingredient"`, `"tool"`, ...) rather than a closed enum, deliberately:
this IR does not need to know the full, closed vocabulary of roles a
domain compiler might ever invent.

## `ConditionSchema`

A condition or an effect describes ONE fact about ONE world entity —
`{ type: "state", entityId: "potato-1", state: "whole" }`, this ticket's
own worked example, verbatim. Kept as a small, closed discriminated union
(not a generic `{subject, property, value}` bag) so a runtime never has
to guess what a fact "means" — but kept deliberately narrower than a full
re-implementation of this repo's own `engine.ts` checks (that richness
belongs to `execution-graph-compiler.ts`, which resolves it down to these
simple shapes when it can, and simply omits what it can't cleanly
express).

`state` is an array — the ticket's own example is exactly the
one-element case (`state: ["whole"]`, not the bare string
`"whole"|"peeled"` the illustration shows) — a deliberate, minimal
divergence to honestly represent a real, existing case in this repo's own
domain (e.g. potato's real `cut` prerequisite allows EITHER `"washed"` OR
`"peeled"`) without a second Condition variant just for the
two-or-more-allowed-values case.

## `EffectSchema`

Unlike `Condition`'s `state`, an effect always sets exactly ONE resulting
state — matching the ticket's own example exactly: `{ type: "state",
entityId: "potato-1", state: "peeled" }`.

## `ExecutionNodeSchema`

- `action`: A real, closed-vocabulary action id — a string a runtime looks up, never further parses.

## `ExecutionEdgeSchema`

`from` must complete before `to` may begin. No `type` field — every edge
in this graph IS a dependency; there is no second edge kind to
distinguish it from (a deliberate simplification from this file's own
first pass, corrected by this ticket's own, narrower `ExecutionEdge`
shape).

## `createExecutionGraph`

A fresh, empty graph — the only way to start building one.

## `addNode`

Appends `node` to `graph` and returns `graph` (mutated in place — see the
file-level notes above). Throws immediately on a duplicate node id — a
fast-fail at construction time, distinct from `validateExecutionGraph`'s
job of re-checking a WHOLE graph assembled some other way (e.g.
deserialized from JSON) after the fact.

## `addDependency`

Adds a `from -> to` dependency edge. Throws immediately on a
self-referencing edge or a reference to a node not yet in the graph —
`addNode` must be called for both ends before `addDependency` connects
them, the concrete mechanism that keeps "every edge references existing
nodes" true by construction, not just by later validation. Does NOT
check for a cycle here (a cycle can only be detected once the whole graph
exists, not incrementally per edge) — call `validateExecutionGraph` once
the graph is complete for that.

## `validateExecutionGraph`

Pure STRUCTURAL validation only — see the file-level notes above for why
domain-semantic checks (are these preconditions actually satisfiable)
deliberately live elsewhere. Checks, in this order: every node id is
unique, every edge references an existing node, no edge is
self-referencing, and the graph is acyclic (**ExecutionGraph must be a
DAG** — a cycle is reported as a structural error, not silently accepted
or hung on). Collects every problem found, not just the first. Never
mutates `graph`.

The early-return on structural errors: a malformed edge (dangling
reference) makes a real topological check meaningless — report the
structural errors first and stop, same "don't compound one real error
into a second, confusing one" choice `execution-graph-compiler.ts` makes
for its own validation.

The topological check itself: Kahn's algorithm, self-contained (no
dependency on `dag-scheduler.ts`, which operates on this repo's own
`RecipeStep[]` — this function must work on a bare `ExecutionGraph` with
no recipe involved at all).

## `serializeExecutionGraph`

Plain JSON — every field is already a string/array/plain object, so this
is `JSON.stringify` plus a schema pass to guarantee what comes out is
exactly what `deserializeExecutionGraph` can read back in.

## `deserializeExecutionGraph`

The reverse of `serializeExecutionGraph` — throws (via Zod) on malformed
JSON or a shape that doesn't match `ExecutionGraphSchema`, rather than
silently returning a partially-wrong graph. Does NOT run
`validateExecutionGraph` itself (schema-VALID and structurally-VALID are
different questions — a deserialized graph can be perfectly well-typed
and still contain a cycle or a dangling edge); call both when a caller
needs both guarantees.

## `checkExecutionOrder`

A minimal, read-only structural check — NOT a runtime (execution stays
out of scope for this ticket entirely). Useful for tests and future
tooling that want to confirm a candidate execution ORDER actually
respects a graph's real dependency edges, without executing anything.

True iff `attemptedOrder` never runs a node before every edge pointing
INTO it (`edge.to === node`) has its `edge.from` already present earlier
in `attemptedOrder`. Pure — reads `graph`, never mutates anything, never
executes a node's actual effects.
