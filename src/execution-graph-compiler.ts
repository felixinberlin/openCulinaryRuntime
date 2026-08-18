import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import { resolveStepId, deriveDependsOn, topologicalOrder } from "./dag-scheduler.ts";
import {
  createExecutionGraph,
  addNode,
  addDependency,
  type ExecutionGraph,
  type ExecutionInput,
  type Condition,
  type Effect,
} from "./execution-graph.ts";

/**
 * The domain-aware PRODUCER of an `ExecutionGraph` from a `RecipeScript`
 * — kept separate from `execution-graph.ts` (the domain-agnostic IR)
 * deliberately, so the boundary is enforced at the import graph level.
 * Never calls `engine.ts`'s `applyAction` or `runRecipe` — no mutation,
 * no simulated time; it statically re-derives a bounded state/tag model
 * to check whether each step's preconditions would be satisfiable, the
 * same "catch it earlier, cheaper" role a type-checker plays. Does not
 * resolve spawned instances (out of scope — no real ground truth exists
 * before execution) or emit existentially-quantified "some qualifying
 * entity" requirements as graph Conditions (still validated, just not
 * re-emitted). See `reference/execution-graph-compiler.md` for design
 * rationale and scope.
 */

export type CompileResult =
  | {
      ok: true;
      graph: ExecutionGraph;
      /** Recipe-local instance id -> resolved real `Entity.id` — internal
       *  bookkeeping, not part of `ExecutionGraph` itself. */
      entityTypes: Record<string, string>;
    }
  | { ok: false; errors: string[] };

interface PredictedState {
  state: string;
  tags: string[];
}

/**
 * Compiles a validated `RecipeScript` into an `ExecutionGraph`. Pure and
 * read-only: never mutates `recipe`/`entities`/`actions`. Collects EVERY
 * compile error found (not just the first).
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

  const entityTypeByInstance = new Map<string, string>();
  for (const item of recipe.initialInventory) entityTypeByInstance.set(item.id, item.entityId);

  const predictedState = new Map<string, PredictedState>();
  for (const item of recipe.initialInventory) {
    predictedState.set(item.id, { state: item.state, tags: [...item.tags] });
  }
  const destroyedInstances = new Set<string>();

  const errors: string[] = [];
  const graph = createExecutionGraph(recipe.id);

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
    const entityType = entityTypeByInstance.get(instanceId);
    if (!entityType) {
      errors.push(
        `Step "${stepLabel}": cannot resolve ${role} instance "${instanceId}" to a real entity — it is not in ` +
          `initialInventory (resolving a SPAWNED instance is out of scope for this compiler pass, see reference/execution-graph-compiler.md)`
      );
      return undefined;
    }
    return entityType;
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

    const targetEntityType = resolveInstance(id, step.targetInstanceId, "target");
    const secondaryEntityType = step.secondaryInstanceId
      ? resolveInstance(id, step.secondaryInstanceId, "secondary")
      : undefined;
    const availableResolutions = step.availableIngredientInstanceIds.map((instanceId) => ({
      instanceId,
      entityType: resolveInstance(id, instanceId, "available ingredient"),
    }));
    if (!targetEntityType) continue;
    const targetEntity = entities.get(targetEntityType);
    if (!targetEntity) {
      fail(`entity "${targetEntityType}" not found in entity catalog`);
      continue;
    }

    const preconditions: Condition[] = [];

    const requiredPriorState = targetEntity.statePrerequisites[action.id];
    if (requiredPriorState) {
      const allowed = Array.isArray(requiredPriorState) ? requiredPriorState : [requiredPriorState];
      preconditions.push({ type: "state", entityId: step.targetInstanceId, state: allowed });
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
        type: "capability",
        entityId: step.targetInstanceId,
        capability: action.requiredTargetCapability,
      });
      if (targetEntity.capabilities[action.requiredTargetCapability] !== true) {
        fail(
          `"${targetEntityType}" lacks required capability "${action.requiredTargetCapability}"`
        );
      }
    }

    // Tool/ingredient-capability requirements are real preconditions,
    // validated for real below — but deliberately NOT emitted as graph
    // Conditions. See reference/execution-graph-compiler.md.
    for (const toolId of action.requiredTools) {
      if (!recipe.availableTools.includes(toolId)) {
        fail(`required tool "${toolId}" is not in recipe.availableTools`);
      }
    }
    for (const capability of action.requiredToolCapabilities) {
      const satisfied = recipe.availableTools.some(
        (tid) => entities.get(tid)?.capabilities[capability] === true
      );
      if (!satisfied) fail(`no available tool satisfies capability "${capability}"`);
    }
    for (const capability of action.requiredIngredientCapabilities) {
      const satisfied = availableResolutions.some(
        ({ entityType }) =>
          entityType && entities.get(entityType)?.capabilities[capability] === true
      );
      if (!satisfied) fail(`no available ingredient satisfies capability "${capability}"`);
    }

    let secondaryEntity: Entity | undefined;
    if (action.requiredSecondaryCapability) {
      if (!secondaryEntityType) {
        fail(
          `requires a secondary instance (capability "${action.requiredSecondaryCapability}"), none resolved`
        );
      } else {
        secondaryEntity = entities.get(secondaryEntityType);
        preconditions.push({
          type: "capability",
          entityId: step.secondaryInstanceId!,
          capability: action.requiredSecondaryCapability,
        });
        if (
          !secondaryEntity ||
          secondaryEntity.capabilities[action.requiredSecondaryCapability] !== true
        ) {
          fail(
            `secondary "${secondaryEntityType}" lacks required capability "${action.requiredSecondaryCapability}"`
          );
        } else {
          const reqState = secondaryEntity.statePrerequisites[action.id];
          if (reqState) {
            const allowed = Array.isArray(reqState) ? reqState : [reqState];
            preconditions.push({
              type: "state",
              entityId: step.secondaryInstanceId!,
              state: allowed,
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
      if (action.outputs.combinesInto && secondaryEntityType) {
        effects.push({
          type: "combine",
          entityIds: [step.targetInstanceId, step.secondaryInstanceId!],
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
          effects.push({ type: "state", entityId: step.targetInstanceId, state: newState });
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
          effects.push({ type: "tag", entityId: step.targetInstanceId, tag });
          const current = predictedState.get(step.targetInstanceId);
          if (current && !current.tags.includes(tag)) current.tags.push(tag);
        }

        if (action.outputs.destroysTarget) {
          effects.push({ type: "destroy", entityId: step.targetInstanceId });
          destroyedInstances.add(step.targetInstanceId);
          predictedState.delete(step.targetInstanceId);
        }

        if (action.outputs.spawnsTargetByproducts) {
          const byproducts =
            targetEntity.byproductsByAction[action.id] ?? targetEntity.producedByproducts;
          for (const entityId of byproducts) {
            effects.push({ type: "spawn", entityId, fromEntityId: step.targetInstanceId });
          }
        }
      }
    }

    const inputs: ExecutionInput[] = [
      { entityId: step.targetInstanceId, role: "target" },
      ...(step.secondaryInstanceId
        ? [{ entityId: step.secondaryInstanceId, role: "secondary" }]
        : []),
      ...step.availableIngredientInstanceIds.map((entityId) => ({ entityId, role: "ingredient" })),
      // Tools have no per-recipe instance id in this repo's data model —
      // the tool's own type id is the only real identifier available.
      ...action.requiredTools.map((entityId) => ({ entityId, role: "tool" })),
    ];

    addNode(graph, { id, action: action.id, inputs, preconditions, effects });
  }

  if (errors.length > 0) return { ok: false, errors };

  for (const id of topo.order) {
    for (const dep of depsById.get(id) ?? []) {
      addDependency(graph, dep, id);
    }
  }

  return { ok: true, graph, entityTypes: Object.fromEntries(entityTypeByInstance) };
}
