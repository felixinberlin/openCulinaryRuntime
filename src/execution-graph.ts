import { z } from "zod";
import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import { resolveStepId, deriveDependsOn, topologicalOrder } from "./dag-scheduler.ts";

/**
 * ExecutionGraph — a compiler IR, the contract between a compiler
 * (`compileToExecutionGraph` below) and a runtime this ticket does not
 * build. Deliberately a SEPARATE representation from this repo's own
 * `Instance`/`RecipeStep`/`RecipeScript` types (`engine.ts`/`recipe.ts`),
 * not a thin rename of them — a runtime consuming this graph should never
 * need to import `recipe.ts`, know what a "recipe" or Cooklang or a
 * planner is, or resolve anything against `data/entities/*.json` itself.
 * Every fact a runtime would need (which entity a node acts on, what must
 * be true before it runs, what becomes true after) is already resolved
 * and baked into the graph by the time this module hands it over.
 *
 * Scope, decided deliberately: this is a COMPILER pass, not an execution
 * engine. `compileToExecutionGraph` never calls `engine.ts`'s
 * `applyAction` or `recipe-runner.ts`'s `runRecipe` — it never mutates an
 * inventory, never advances simulated time, never asserts world state.
 * What it DOES do, for real: resolve every step's instance references to
 * real `entityId`s, look up each step's real `Action` definition, and
 * statically re-derive — via a bounded internal state/tag model, seeded
 * from `initialInventory` and updated by each node's own predicted
 * effects — whether each step's real preconditions (from `engine.ts`'s
 * own checks: `Entity.statePrerequisites`, `requiredTargetCapability`,
 * `requiredTools`/`requiredToolCapabilities`, `requiredIngredientCapabilities`,
 * `requiredSecondaryCapability`) would actually be satisfiable, given
 * everything compiled so far. This is real static validation, not a
 * second engine — `engine.ts`'s own runtime checks in `applyAction` are
 * unchanged and remain the actual authority when a graph is executed;
 * this pass exists to reject an obviously-broken recipe BEFORE handing a
 * graph to a runtime, the same "catch it earlier, cheaper" role a
 * type-checker plays relative to a program's actual runtime behavior.
 *
 * Deliberately, honestly NOT attempted here (named, not hidden):
 * - **Resolving a SPAWNED instance's entity id** (e.g. a step targeting
 *   `egg_yolk-3`, `SEPARATE`'s own output) — `recipe-runner.ts`'s
 *   `spawnedEntityIds` is the one real ground truth for that, and it only
 *   exists AFTER actually running a recipe, which this pass never does.
 *   A step whose `targetInstanceId`/`secondaryInstanceId`/
 *   `availableIngredientInstanceIds` isn't in `recipe.initialInventory`
 *   fails compilation with a clear, named reason — not a guess. Every
 *   recipe this ticket's own acceptance criteria describes (peel → slice
 *   → fry, everything already in `initialInventory`) compiles cleanly
 *   under this limit; extending resolution to spawned instances (a real,
 *   separate static-prediction problem — replicating a bounded slice of
 *   `recipe-runner.ts`'s own spawn-id-naming scheme) is future work, not
 *   silently faked here.
 * - **Anything CCP/HACCP, thermal, or timing-related** — those are
 *   `thermal.ts`/`place.ts`/`execution-bounds.ts`'s domain, checked for
 *   real at RUN time (`recipe-runner.ts`), not compile time. This pass's
 *   `preconditions`/`effects` cover state/tag/capability facts only.
 * - Anything this ticket's own non-goals name: no LLM, no natural-language
 *   parsing, no autonomous planning, no graph optimization, no parallel
 *   execution, no failure recovery, no robot control, no UI.
 */

// ---------------------------------------------------------------------------
// The IR itself
// ---------------------------------------------------------------------------

/** Every precondition kind `engine.ts`'s `applyAction` actually checks,
 *  mapped 1:1 onto its real fields — not a generic/open-ended shape, so a
 *  runtime consuming this never has to guess what a condition "means." */
export const ConditionSchema = z.discriminatedUnion("kind", [
  /** `Entity.statePrerequisites[action.id]` — the target (or secondary)
   *  instance's `state` or a tag in `tags` must be one of `allowedValues`. */
  z.object({
    kind: z.literal("state"),
    instanceId: z.string().min(1),
    allowedValues: z.array(z.string()).min(1),
  }),
  /** `Action.requiredTargetCapability` / `requiredSecondaryCapability`. */
  z.object({
    kind: z.literal("capability"),
    instanceId: z.string().min(1),
    capability: z.string().min(1),
  }),
  /** `Action.requiredTools` — one exact tool entity id, must be available. */
  z.object({ kind: z.literal("tool"), toolId: z.string().min(1) }),
  /** `Action.requiredToolCapabilities` — any available tool asserting this. */
  z.object({ kind: z.literal("toolCapability"), capability: z.string().min(1) }),
  /** `Action.requiredIngredientCapabilities` — any available ingredient asserting this. */
  z.object({ kind: z.literal("ingredientCapability"), capability: z.string().min(1) }),
]);
export type Condition = z.infer<typeof ConditionSchema>;

/** Every effect kind `engine.ts`'s `applyAction`/`ActionOutputsSchema`
 *  actually produces, mapped 1:1 onto its real fields. */
export const EffectSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("stateChange"),
    instanceId: z.string().min(1),
    newState: z.string().min(1),
  }),
  z.object({ kind: z.literal("addTag"), instanceId: z.string().min(1), tag: z.string().min(1) }),
  z.object({ kind: z.literal("destroy"), instanceId: z.string().min(1) }),
  /** `outputs.spawnsTargetByproducts` — one entry per real byproduct
   *  entity id (`Entity.byproductsByAction[action.id]` or, absent that,
   *  `Entity.producedByproducts`), known statically since both live on
   *  the entity, not on run-time state. */
  z.object({
    kind: z.literal("spawn"),
    entityId: z.string().min(1),
    fromInstanceId: z.string().min(1),
  }),
  /** `outputs.combinesInto` — target + secondary both consumed, one new
   *  instance of `resultEntityId` takes their place. */
  z.object({
    kind: z.literal("combine"),
    instanceIds: z.tuple([z.string().min(1), z.string().min(1)]),
    resultEntityId: z.string().min(1),
  }),
]);
export type Effect = z.infer<typeof EffectSchema>;

export const ExecutionNodeSchema = z.object({
  /** Stable id — reuses `dag-scheduler.ts`'s own `resolveStepId` (the
   *  step's explicit `id`, or its array index as a string) rather than
   *  inventing a second id scheme; see this file's top doc comment. */
  id: z.string().min(1),
  /** The compiled step's `actionId` (`recipe.ts`'s `RecipeStep.actionId`) —
   *  a real, closed vocabulary id (`data/actions/*.json`), not a verb
   *  string a runtime would have to further interpret. */
  action: z.string().min(1),
  /** Recipe-local instance ids this node reads/consumes: the target,
   *  then (if any) the secondary instance, then every available
   *  ingredient instance — in that order. Each one's real entity id is
   *  in the graph's own `entityResolutions` map, not repeated per node. */
  inputs: z.array(z.string().min(1)).min(1),
  /** The one exact required tool id, when `Action.requiredTools` names
   *  EXACTLY one — left unset (not guessed) when zero or more than one
   *  apply, or when the requirement is capability-based
   *  (`requiredToolCapabilities`, genuinely substitutable — see
   *  `dag-scheduler.ts`'s `DagNode.requiredToolIds` doc comment for the
   *  identical reasoning). The full picture is always in `preconditions`
   *  regardless of what this convenience field holds. */
  tool: z.string().optional(),
  preconditions: z.array(ConditionSchema).default([]),
  effects: z.array(EffectSchema).default([]),
  metadata: z
    .object({
      /** The original `RecipeStep.id`, when the recipe set one explicitly
       *  — omitted (not defaulted to the derived graph node id) when the
       *  recipe never named this step, so a runtime can tell the
       *  difference between "this step was explicitly named" and "this id
       *  is just its array position." */
      sourceStep: z.string().optional(),
    })
    .default({}),
});
export type ExecutionNode = z.infer<typeof ExecutionNodeSchema>;

export const ExecutionEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.literal("dependency"),
});
export type ExecutionEdge = z.infer<typeof ExecutionEdgeSchema>;

export const ExecutionGraphSchema = z.object({
  id: z.string().min(1),
  nodes: z.array(ExecutionNodeSchema),
  edges: z.array(ExecutionEdgeSchema),
  /** Recipe-local instance id -> resolved real `Entity.id`, for every
   *  instance referenced anywhere in `nodes[].inputs`. Graph-level rather
   *  than repeated per node: the same instance is very often an input to
   *  more than one node (e.g. `potato-1` across peel/slice/fry), and
   *  which entity an instance IS is a fact about the world's inventory,
   *  not about any one action — this is also the concrete, inspectable
   *  answer to "resolve recipe entities to actual entityIds where
   *  possible." */
  entityResolutions: z.record(z.string(), z.string()).default({}),
});
export type ExecutionGraph = z.infer<typeof ExecutionGraphSchema>;

// ---------------------------------------------------------------------------
// The compiler
// ---------------------------------------------------------------------------

export type CompileResult = { ok: true; graph: ExecutionGraph } | { ok: false; errors: string[] };

interface PredictedState {
  state: string;
  tags: string[];
}

/**
 * Compiles a validated `RecipeScript` into an `ExecutionGraph`. Pure and
 * read-only: never calls `engine.ts`'s `applyAction` or
 * `recipe-runner.ts`'s `runRecipe`, never mutates `entities`/`actions`,
 * never mutates `recipe`. Collects EVERY compile error found (not just
 * the first) into `errors` — a recipe with two independent problems gets
 * told about both in one pass, same as a real compiler's diagnostics.
 * See this file's top doc comment for exactly what "validate
 * preconditions"/"resolve entities" means here vs. what stays runtime's
 * job.
 */
export function compileToExecutionGraph(
  recipe: RecipeScript,
  entities: ReadonlyMap<string, Entity>,
  actions: ReadonlyMap<string, Action>
): CompileResult {
  const topo = topologicalOrder(recipe.sequence);
  if ("cycle" in topo) {
    return { ok: false, errors: [`Circular dependency among steps: [${topo.cycle.join(", ")}]`] };
  }

  const depsById = deriveDependsOn(recipe.sequence);
  const stepById = new Map(
    recipe.sequence.map((step, i) => [resolveStepId(step, i), step] as const)
  );

  const entityIdByInstance = new Map<string, string>();
  for (const item of recipe.initialInventory) entityIdByInstance.set(item.id, item.entityId);

  const predictedState = new Map<string, PredictedState>();
  for (const item of recipe.initialInventory) {
    predictedState.set(item.id, { state: item.state, tags: [...item.tags] });
  }
  const destroyedInstances = new Set<string>();

  const errors: string[] = [];
  const entityResolutions: Record<string, string> = {};
  const nodes: ExecutionNode[] = [];

  const resolveInstance = (
    stepLabel: string,
    instanceId: string,
    role: string
  ): string | undefined => {
    if (destroyedInstances.has(instanceId)) {
      errors.push(
        `Step "${stepLabel}": ${role} instance "${instanceId}" was already destroyed by an earlier step`
      );
      return undefined;
    }
    const entityId = entityIdByInstance.get(instanceId);
    if (!entityId) {
      errors.push(
        `Step "${stepLabel}": cannot resolve ${role} instance "${instanceId}" to a real entity — it is not in ` +
          `initialInventory (resolving a SPAWNED instance is out of scope for this compiler pass, see execution-graph.ts's own doc comment)`
      );
      return undefined;
    }
    entityResolutions[instanceId] = entityId;
    return entityId;
  };

  for (const id of topo.order) {
    const step = stepById.get(id)!;
    let stepValid = true;
    const fail = (message: string) => {
      errors.push(`Step "${id}": ${message}`);
      stepValid = false;
    };

    const action = actions.get(step.actionId);
    if (!action) {
      fail(`unknown action "${step.actionId}"`);
      continue;
    }

    const targetEntityId = resolveInstance(id, step.targetInstanceId, "target");
    const secondaryEntityId = step.secondaryInstanceId
      ? resolveInstance(id, step.secondaryInstanceId, "secondary")
      : undefined;
    const availableResolutions = step.availableIngredientInstanceIds.map((instanceId) => ({
      instanceId,
      entityId: resolveInstance(id, instanceId, "available ingredient"),
    }));
    if (!targetEntityId) continue;
    const targetEntity = entities.get(targetEntityId);
    if (!targetEntity) {
      fail(`entity "${targetEntityId}" not found in entity catalog`);
      continue;
    }

    const preconditions: Condition[] = [];

    const requiredPriorState = targetEntity.statePrerequisites[action.id];
    if (requiredPriorState) {
      const allowed = Array.isArray(requiredPriorState) ? requiredPriorState : [requiredPriorState];
      preconditions.push({
        kind: "state",
        instanceId: step.targetInstanceId,
        allowedValues: allowed,
      });
      const current = predictedState.get(step.targetInstanceId);
      const satisfied =
        !!current &&
        (allowed.includes(current.state) || allowed.some((s) => current.tags.includes(s)));
      if (!satisfied) {
        fail(
          `"${step.targetInstanceId}" must be in state/tag [${allowed.join(", ")}] for ${action.verb}, but is ` +
            `predicted to be "${current?.state ?? "(unknown — already destroyed or unresolved)"}"`
        );
      }
    }

    if (action.requiredTargetCapability) {
      preconditions.push({
        kind: "capability",
        instanceId: step.targetInstanceId,
        capability: action.requiredTargetCapability,
      });
      if (targetEntity.capabilities[action.requiredTargetCapability] !== true) {
        fail(`"${targetEntityId}" lacks required capability "${action.requiredTargetCapability}"`);
      }
    }

    for (const toolId of action.requiredTools) {
      preconditions.push({ kind: "tool", toolId });
      if (!recipe.availableTools.includes(toolId)) {
        fail(`required tool "${toolId}" is not in recipe.availableTools`);
      }
    }
    for (const capability of action.requiredToolCapabilities) {
      preconditions.push({ kind: "toolCapability", capability });
      const satisfied = recipe.availableTools.some(
        (tid) => entities.get(tid)?.capabilities[capability] === true
      );
      if (!satisfied) fail(`no available tool satisfies capability "${capability}"`);
    }
    for (const capability of action.requiredIngredientCapabilities) {
      preconditions.push({ kind: "ingredientCapability", capability });
      const satisfied = availableResolutions.some(
        ({ entityId }) => entityId && entities.get(entityId)?.capabilities[capability] === true
      );
      if (!satisfied) fail(`no available ingredient satisfies capability "${capability}"`);
    }

    let secondaryEntity: Entity | undefined;
    if (action.requiredSecondaryCapability) {
      if (!secondaryEntityId) {
        fail(
          `requires a secondary instance (capability "${action.requiredSecondaryCapability}"), none resolved`
        );
      } else {
        secondaryEntity = entities.get(secondaryEntityId);
        preconditions.push({
          kind: "capability",
          instanceId: step.secondaryInstanceId!,
          capability: action.requiredSecondaryCapability,
        });
        if (
          !secondaryEntity ||
          secondaryEntity.capabilities[action.requiredSecondaryCapability] !== true
        ) {
          fail(
            `secondary "${secondaryEntityId}" lacks required capability "${action.requiredSecondaryCapability}"`
          );
        } else {
          const reqState = secondaryEntity.statePrerequisites[action.id];
          if (reqState) {
            const allowed = Array.isArray(reqState) ? reqState : [reqState];
            preconditions.push({
              kind: "state",
              instanceId: step.secondaryInstanceId!,
              allowedValues: allowed,
            });
            const current = predictedState.get(step.secondaryInstanceId!);
            const satisfied =
              !!current &&
              (allowed.includes(current.state) || allowed.some((s) => current.tags.includes(s)));
            if (!satisfied) {
              fail(
                `secondary "${step.secondaryInstanceId}" must be in state/tag [${allowed.join(", ")}], but is ` +
                  `predicted to be "${current?.state ?? "(unknown)"}"`
              );
            }
          }
        }
      }
    }

    const effects: Effect[] = [];
    if (stepValid) {
      if (action.outputs.combinesInto && secondaryEntityId) {
        effects.push({
          kind: "combine",
          instanceIds: [step.targetInstanceId, step.secondaryInstanceId!],
          resultEntityId: action.outputs.combinesInto,
        });
        destroyedInstances.add(step.targetInstanceId);
        destroyedInstances.add(step.secondaryInstanceId!);
        predictedState.delete(step.targetInstanceId);
        predictedState.delete(step.secondaryInstanceId!);
      } else {
        let newState = action.outputs.transformedState;
        if (action.outputs.transformedStateFromParameter) {
          const paramId = action.outputs.transformedStateFromParameter;
          const value = step.params[paramId];
          if (value === undefined) {
            fail(
              `resulting state depends on parameter "${paramId}", which this step does not supply`
            );
          } else {
            newState = value;
          }
        }
        if (newState) {
          effects.push({ kind: "stateChange", instanceId: step.targetInstanceId, newState });
          const current = predictedState.get(step.targetInstanceId);
          if (current) current.state = newState;
        }

        let tag = action.outputs.addsTag;
        if (action.outputs.addsTagFromParameter) {
          const { parameter, tagByValue } = action.outputs.addsTagFromParameter;
          const value = step.params[parameter];
          const resolvedTag = value ? tagByValue[value] : undefined;
          if (!resolvedTag) {
            fail(
              `resulting tag depends on parameter "${parameter}", not resolvable from this step's params`
            );
          } else {
            tag = resolvedTag;
          }
        }
        if (tag) {
          effects.push({ kind: "addTag", instanceId: step.targetInstanceId, tag });
          const current = predictedState.get(step.targetInstanceId);
          if (current && !current.tags.includes(tag)) current.tags.push(tag);
        }

        if (action.outputs.destroysTarget) {
          effects.push({ kind: "destroy", instanceId: step.targetInstanceId });
          destroyedInstances.add(step.targetInstanceId);
          predictedState.delete(step.targetInstanceId);
        }

        if (action.outputs.spawnsTargetByproducts) {
          const byproducts =
            targetEntity.byproductsByAction[action.id] ?? targetEntity.producedByproducts;
          for (const entityId of byproducts) {
            effects.push({ kind: "spawn", entityId, fromInstanceId: step.targetInstanceId });
          }
        }
      }
    }

    const inputs = [
      step.targetInstanceId,
      ...(step.secondaryInstanceId ? [step.secondaryInstanceId] : []),
      ...step.availableIngredientInstanceIds,
    ];
    const tool = action.requiredTools.length === 1 ? action.requiredTools[0] : undefined;

    nodes.push({
      id,
      action: action.id,
      inputs,
      tool,
      preconditions,
      effects,
      metadata: step.id ? { sourceStep: step.id } : {},
    });
  }

  if (errors.length > 0) return { ok: false, errors };

  const edges: ExecutionEdge[] = [];
  for (const id of topo.order) {
    for (const dep of depsById.get(id) ?? []) {
      edges.push({ from: dep, to: id, type: "dependency" });
    }
  }

  const graph = ExecutionGraphSchema.parse({ id: recipe.id, nodes, edges, entityResolutions });
  return { ok: true, graph };
}

// ---------------------------------------------------------------------------
// A minimal, read-only structural check — NOT a runtime (see this file's
// top doc comment: execution stays out of the compiler, and out of this
// module entirely). Useful for tests and future tooling that want to
// confirm a candidate execution ORDER actually respects a graph's real
// dependency edges, without building or mutating any world state.
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
