# `src/execution-graph-compiler.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The PRODUCER half of the "Execution Graph" ticket's own architecture
diagram — deliberately a SEPARATE file from `execution-graph.ts` (the IR
+ its minimal builder API), so the boundary the ticket asks for is
enforced at the import graph level, not just by convention:
`execution-graph.ts` imports nothing from this repo's domain; everything
domain-aware (recipes, entities, actions, capability checks, state
prediction) lives here instead, and this file is built ON TOP of
`execution-graph.ts`'s own `createExecutionGraph`/`addNode`/`addDependency`
rather than constructing `ExecutionGraph` objects by hand — the IR's own
invariants (unique ids, edges only between real nodes, no self-loops) are
enforced by construction, not re-derived here a second time.

The ticket's own non-goals list names "recipe parsing," "capability
discovery," and "state inference" as explicitly NOT the IR ticket's job —
this file is exactly where that real work belongs instead. It never
calls `engine.ts`'s `applyAction` or `recipe-runner.ts`'s `runRecipe` —
no mutation, no simulated time; it resolves entity references, looks up
real `Action` definitions, and STATICALLY re-derives (a bounded internal
state/tag model, seeded from `initialInventory`, updated by each node's
own predicted effects as the graph is walked in dependency order) whether
each step's real preconditions would actually be satisfiable — the same
"catch it earlier, cheaper" role a type-checker plays relative to a
program's real runtime behavior. `engine.ts`'s own runtime checks remain
unchanged and are the actual authority once a graph is executed.

Deliberately, honestly NOT attempted here (named, not hidden):

- **Resolving a SPAWNED instance's entity id** (e.g. a step targeting
  `egg_yolk-3`, `SEPARATE`'s own output) — `recipe-runner.ts`'s
  `spawnedEntityIds` is the one real ground truth for that, and it only
  exists AFTER actually running a recipe, which this pass never does. A
  step referencing an instance not in `recipe.initialInventory` fails
  compilation with a clear, named reason — not a guess.
- **Representing "needs SOME available ingredient/tool with capability
  X" as a graph `Condition`.** `execution-graph.ts`'s `Condition` is
  deliberately entity-fact-shaped (`{ type, entityId, ... }`, this
  ticket's own worked example) — an existentially-quantified "any
  qualifying entity in the world" requirement doesn't fit that shape
  without inventing a richer Condition kind the ticket never asked for.
  This compiler still VALIDATES those requirements for real (rejecting
  compilation when unsatisfiable) — it just doesn't re-emit them as graph
  `Condition`s, only conditions about the node's own resolved inputs
  (target/secondary) are.
- Anything CCP/HACCP, thermal, or timing-related — `thermal.ts`/
  `place.ts`/`execution-bounds.ts`'s domain, checked for real at RUN
  time, not compile time.

## `CompileResult`

- `entityTypes`: Recipe-local instance id -> resolved real `Entity.id` — internal bookkeeping this compiler needed to check capabilities/state, kept around here (NOT on `ExecutionGraph` itself — that type has no room for it, and a runtime consuming the graph never needs it, since every `Condition`/`Effect`/`ExecutionInput` already references the concrete world entity id directly) purely for a caller who wants to inspect what this compiler resolved.

## `compileToExecutionGraph`

Compiles a validated `RecipeScript` into an `ExecutionGraph`. Pure and
read-only: never mutates `recipe`/`entities`/`actions`. Collects EVERY
compile error found (not just the first).

The tool/ingredient-capability requirements loop: real preconditions of
this step, validated for real — but deliberately NOT emitted as graph
Conditions (they're "some qualifying entity in the world," not a fact
about one specific resolved input); see the file-level notes above.

The `inputs` array's tool references: Tools have no per-recipe instance
id in this repo's data model (`RecipeScript.availableTools` is a flat
list of tool TYPES, not individually tracked instances —
`dag-scheduler.ts`'s own `DagNode.requiredToolIds` doc comment makes the
identical point) — the tool's own type id is the only real identifier
available, so that's what's referenced here.
