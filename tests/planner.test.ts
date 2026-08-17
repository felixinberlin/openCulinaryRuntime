import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  stepsToRecipeSteps,
  resolveDefaultParamValue,
  planLowestCost,
  planSecondaryRole,
  planCombine,
  planIntent,
  SpawnIdTracker,
  defaultEdgeCost,
} from "../src/planner.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeIntent } from "../src/recipe.ts";

const NO_TOOLS = new Set<string>();
const NO_INGREDIENTS = new Set<string>();

describe("resolveDefaultParamValue", () => {
  test("allowedValues -> first entry", () => {
    const param = { id: "shape", required: true, allowedValues: ["a", "b", "c"] } as any;
    assert.equal(resolveDefaultParamValue(param), "a");
  });

  test("numericRange -> the midpoint", () => {
    const param = {
      id: "temp",
      required: true,
      numericRange: { unit: "celsius", min: 100, max: 200 },
    } as any;
    assert.equal(resolveDefaultParamValue(param), "150");
  });
});

describe("stepsToRecipeSteps", () => {
  const potato = makeEntity({ id: "potato", capabilities: { isFryable: true } });
  const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
  const fry = makeAction({
    id: "fry",
    requiredTargetCapability: "isFryable",
    requiredIngredientCapabilities: ["isFryingMedium"],
    outputs: { transformedState: "fried" },
  });
  const entities = new Map([
    ["potato", potato],
    ["oil", oil],
  ]);
  const actions = new Map([["fry", fry]]);

  test("resolves a requiredIngredientCapabilities entry to a real instance id from the pool", () => {
    const steps = stepsToRecipeSteps([{ actionId: "fry" }], {
      targetInstanceId: "potato-1",
      entities,
      actions,
      availableIngredientInstances: [{ id: "oil-1", entityId: "oil" }],
    });
    assert.deepEqual(steps, [
      {
        actionId: "fry",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: ["oil-1"],
      },
    ]);
  });

  test("throws when no instance in the pool satisfies a required capability", () => {
    assert.throws(
      () =>
        stepsToRecipeSteps([{ actionId: "fry" }], {
          targetInstanceId: "potato-1",
          entities,
          actions,
          availableIngredientInstances: [],
        }),
      /no available ingredient instance satisfies/
    );
  });

  test("a transformedStateFromParameter step writes the chosen param under the right key", () => {
    const cut = makeAction({
      id: "cut",
      outputs: { transformedStateFromParameter: "shape" },
      parameters: [{ id: "shape", required: true, allowedValues: ["diced", "sliced"] }],
    });
    const steps = stepsToRecipeSteps([{ actionId: "cut", param: "diced" }], {
      targetInstanceId: "potato-1",
      entities,
      actions: new Map([["cut", cut]]),
      availableIngredientInstances: [],
    });
    assert.deepEqual(steps[0].params, { shape: "diced" });
  });

  test("a required-but-not-state-determining param gets a schema-valid default when not overridden", () => {
    const pasteurize = makeAction({
      id: "pasteurize",
      outputs: { addsTag: "pasteurized" },
      parameters: [
        { id: "waterTempC", required: true, numericRange: { unit: "celsius", min: 55, max: 63 } },
      ],
    });
    const steps = stepsToRecipeSteps([{ actionId: "pasteurize" }], {
      targetInstanceId: "egg-1",
      entities,
      actions: new Map([["pasteurize", pasteurize]]),
      availableIngredientInstances: [],
    });
    assert.equal(steps[0].params.waterTempC, "59");
  });

  test("paramOverrides wins over the default", () => {
    const pasteurize = makeAction({
      id: "pasteurize",
      outputs: { addsTag: "pasteurized" },
      parameters: [
        { id: "waterTempC", required: true, numericRange: { unit: "celsius", min: 55, max: 63 } },
      ],
    });
    const steps = stepsToRecipeSteps([{ actionId: "pasteurize" }], {
      targetInstanceId: "egg-1",
      entities,
      actions: new Map([["pasteurize", pasteurize]]),
      availableIngredientInstances: [],
      paramOverrides: { 0: { waterTempC: "61" } },
    });
    assert.equal(steps[0].params.waterTempC, "61");
  });
});

describe("planLowestCost", () => {
  test("agrees with plain shortest-path when there's only one real route", () => {
    const widget = makeEntity({ id: "widget", capabilities: {}, allowedTransformations: ["make"] });
    const make = makeAction({ id: "make", outputs: { transformedState: "done" } });
    const entities = new Map([["widget", widget]]);
    const actions = new Map([["make", make]]);
    const result = planLowestCost({
      entity: widget,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "done" },
      availableTools: NO_TOOLS,
      availableIngredients: NO_INGREDIENTS,
    });
    assert.equal(result.reachable, true);
    if (result.reachable) {
      assert.deepEqual(result.path, [{ actionId: "make" }]);
      assert.equal(result.totalCost, 1);
    }
  });

  test("prefers the LESS hazardous of two equal-length routes to the same goal", () => {
    const widget = makeEntity({
      id: "widget",
      allowedTransformations: ["risky_route", "safe_route"],
    });
    const risky = makeAction({
      id: "risky_route",
      outputs: { transformedState: "done" },
      hazards: [{ type: "hot_liquid", severity: "high", note: "test" }],
    });
    const safe = makeAction({
      id: "safe_route",
      outputs: { transformedState: "done" },
      hazards: [],
    });
    const entities = new Map([["widget", widget]]);
    const actions = new Map([
      ["risky_route", risky],
      ["safe_route", safe],
    ]);
    const result = planLowestCost({
      entity: widget,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "done" },
      availableTools: NO_TOOLS,
      availableIngredients: NO_INGREDIENTS,
    });
    assert.equal(result.reachable, true);
    if (result.reachable) {
      assert.deepEqual(result.path, [{ actionId: "safe_route" }]);
    }
    // Plain BFS (isGoalReachable), by contrast, would take the FIRST
    // declared action regardless of hazard — the real behavioral
    // difference this function exists to add. Not re-asserted here
    // (reachability.test.ts already covers isGoalReachable's own
    // declared-order tie-break) — just confirming the two genuinely
    // diverge on this fixture.
    assert.notEqual(result.path[0].actionId, "risky_route");
  });

  test("determinism — identical query, run twice, identical result", () => {
    const widget = makeEntity({ id: "widget", allowedTransformations: ["a", "b"] });
    const a = makeAction({ id: "a", outputs: { transformedState: "mid" } });
    const b = makeAction({ id: "b", outputs: { transformedState: "done" } });
    const entities = new Map([["widget", widget]]);
    const actions = new Map([
      ["a", a],
      ["b", b],
    ]);
    const query = {
      entity: widget,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "done" },
      availableTools: NO_TOOLS,
      availableIngredients: NO_INGREDIENTS,
    };
    assert.deepEqual(planLowestCost(query), planLowestCost(query));
  });

  test("defaultEdgeCost sums hazard severity penalties on top of the base 1-per-step cost", () => {
    const action = makeAction({
      id: "x",
      outputs: {},
      hazards: [
        { type: "hot_liquid", severity: "low", note: "test" },
        { type: "sharp_object", severity: "medium", note: "test" },
      ],
    });
    assert.ok(Math.abs(defaultEdgeCost(action) - (1 + 0.1 + 0.3)) < 1e-9);
  });
});

describe("planSecondaryRole", () => {
  const entities = new Map([
    ["egg", makeEntity({ id: "egg", allowedTransformations: ["crack"] })],
    [
      "egg_cracked",
      makeEntity({
        id: "egg_cracked",
        possibleStates: ["raw"],
        capabilities: { isCombinableAddition: true },
      }),
    ],
    ["egg_shell", makeEntity({ id: "egg_shell", possibleStates: ["raw"] })],
  ]);
  const crack = makeAction({
    id: "crack",
    outputs: { transformedState: "cracked", spawnsTargetByproducts: true, destroysTarget: true },
  });
  const actions = new Map([["crack", crack]]);

  test("already-satisfying entity is used as-is, zero steps", () => {
    const beatable = makeEntity({
      id: "egg_cracked",
      capabilities: { isCombinableAddition: true },
    });
    const result = planSecondaryRole(
      "egg_cracked-1",
      beatable,
      "raw",
      [],
      "isCombinableAddition",
      new Map([["egg_cracked", beatable]]),
      new Map(),
      NO_TOOLS,
      NO_INGREDIENTS,
      new SpawnIdTracker()
    );
    assert.equal(result.found, true);
    if (result.found) {
      assert.deepEqual(result.steps, []);
      assert.equal(result.finalInstanceId, "egg_cracked-1");
    }
  });

  test("a one-hop spawn (CRACK) is found and the predicted instance id matches byproductsByAction order", () => {
    const egg = makeEntity({
      id: "egg",
      allowedTransformations: ["crack"],
      byproductsByAction: { crack: ["egg_shell", "egg_cracked"] },
    });
    const spawnIds = new SpawnIdTracker();
    const result = planSecondaryRole(
      "egg-1",
      egg,
      "raw",
      [],
      "isCombinableAddition",
      new Map([...entities, ["egg", egg]]),
      actions,
      NO_TOOLS,
      NO_INGREDIENTS,
      spawnIds
    );
    assert.equal(result.found, true);
    if (result.found) {
      assert.equal(result.finalInstanceId, "egg_cracked-2"); // egg_shell takes 1, egg_cracked takes 2
      assert.equal(result.finalEntityId, "egg_cracked");
      assert.deepEqual(result.steps, [
        {
          actionId: "crack",
          targetInstanceId: "egg-1",
          params: {},
          availableIngredientInstanceIds: [],
        },
      ]);
    }
  });

  test("desiredState reuses isGoalReachable on the SPAWNED entity", () => {
    const eggCrackedBeatable = makeEntity({
      id: "egg_cracked",
      possibleStates: ["raw", "beaten"],
      allowedTransformations: ["beat"],
      capabilities: { isCombinableAddition: true, isBeatable: true },
    });
    const beat = makeAction({ id: "beat", outputs: { transformedState: "beaten" } });
    const egg = makeEntity({
      id: "egg",
      allowedTransformations: ["crack"],
      byproductsByAction: { crack: ["egg_cracked"] },
    });
    const result = planSecondaryRole(
      "egg-1",
      egg,
      "raw",
      [],
      "isCombinableAddition",
      new Map([
        ["egg", egg],
        ["egg_cracked", eggCrackedBeatable],
      ]),
      new Map([
        ["crack", crack],
        ["beat", beat],
      ]),
      NO_TOOLS,
      NO_INGREDIENTS,
      new SpawnIdTracker(),
      "beaten"
    );
    assert.equal(result.found, true);
    if (result.found) {
      assert.equal(result.steps.length, 2); // crack, then beat
      assert.equal(result.steps[1].actionId, "beat");
    }
  });

  test("no qualifying capability anywhere within one hop — reports not found, not a false success", () => {
    const egg = makeEntity({ id: "egg", allowedTransformations: [] });
    const result = planSecondaryRole(
      "egg-1",
      egg,
      "raw",
      [],
      "isCombinableAddition",
      new Map([["egg", egg]]),
      new Map(),
      NO_TOOLS,
      NO_INGREDIENTS,
      new SpawnIdTracker()
    );
    assert.equal(result.found, false);
  });
});

describe("planCombine", () => {
  const potato = makeEntity({
    id: "potato",
    allowedTransformations: ["fry"],
    statePrerequisites: { combine: "fried" },
    capabilities: { isFryable: true, isCombinableBase: true },
  });
  const eggCracked = makeEntity({
    id: "egg_cracked",
    capabilities: { isCombinableAddition: true },
  });
  const fry = makeAction({
    id: "fry",
    requiredTargetCapability: "isFryable",
    outputs: { transformedState: "fried" },
  });
  const combine = makeAction({
    id: "combine",
    requiredTargetCapability: "isCombinableBase",
    requiredSecondaryCapability: "isCombinableAddition",
    outputs: { combinesInto: "mixture" },
  });
  const mixture = makeEntity({ id: "mixture", possibleStates: ["raw"] });
  const entities = new Map([
    ["potato", potato],
    ["egg_cracked", eggCracked],
    ["mixture", mixture],
  ]);
  const actions = new Map([
    ["fry", fry],
    ["combine", combine],
  ]);

  test("assembles primary path + combine step, predicts the spawned result id", () => {
    const result = planCombine({
      combineActionId: "combine",
      primaryInstanceId: "potato-1",
      primaryEntity: potato,
      primaryStartState: "raw",
      primaryStartTags: [],
      secondaryInstanceId: "egg_cracked-1",
      secondaryEntity: eggCracked,
      secondaryStartState: "raw",
      secondaryStartTags: [],
      entities,
      actions,
      availableTools: NO_TOOLS,
      availableIngredients: NO_INGREDIENTS,
      spawnIds: new SpawnIdTracker(),
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(
        result.steps.map((s) => s.actionId),
        ["fry", "combine"]
      );
      assert.equal(result.steps[1].targetInstanceId, "potato-1");
      assert.equal(result.steps[1].secondaryInstanceId, "egg_cracked-1");
      assert.equal(result.resultInstanceId, "mixture-1");
      assert.equal(result.resultEntityId, "mixture");
    }
  });

  test("fails honestly when the primary can never reach the required state", () => {
    const stuckPotato = makeEntity({
      id: "potato",
      allowedTransformations: [],
      statePrerequisites: { combine: "fried" },
      capabilities: { isCombinableBase: true },
    });
    const result = planCombine({
      combineActionId: "combine",
      primaryInstanceId: "potato-1",
      primaryEntity: stuckPotato,
      primaryStartState: "raw",
      primaryStartTags: [],
      secondaryInstanceId: "egg_cracked-1",
      secondaryEntity: eggCracked,
      secondaryStartState: "raw",
      secondaryStartTags: [],
      entities: new Map([...entities, ["potato", stuckPotato]]),
      actions,
      availableTools: NO_TOOLS,
      availableIngredients: NO_INGREDIENTS,
      spawnIds: new SpawnIdTracker(),
    });
    assert.equal(result.success, false);
  });
});

describe("planIntent", () => {
  const potato = makeEntity({
    id: "potato",
    allowedTransformations: ["fry"],
    capabilities: { isFryable: true },
  });
  const fry = makeAction({
    id: "fry",
    requiredTargetCapability: "isFryable",
    outputs: { transformedState: "fried" },
  });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([["fry", fry]]);

  test("a single-instance intent plans a real, runnable RecipeScript", () => {
    const intent: RecipeIntent = {
      id: "test-intent",
      names: { en: "test" },
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      availableTools: [],
      goals: [{ instanceId: "potato-1", state: "fried", requiredTags: [] }],
      metadata: {},
    };
    const result = planIntent(intent, entities, actions);
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(
        result.recipe.sequence.map((s) => s.actionId),
        ["fry"]
      );
      assert.deepEqual(result.stepGoalIndex, [0]);
    }
  });

  test("an unreachable goal reports a real, specific failure, not a thrown exception", () => {
    const stuck = makeEntity({ id: "potato", allowedTransformations: [] });
    const intent: RecipeIntent = {
      id: "test-intent",
      names: { en: "test" },
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      availableTools: [],
      goals: [{ instanceId: "potato-1", state: "fried", requiredTags: [] }],
      metadata: {},
    };
    const result = planIntent(intent, new Map([["potato", stuck]]), actions);
    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.failures[0].goalIndex, 0);
    }
  });

  test("$combineResult:<goalIndex> lets a later goal target an earlier combine goal's spawned output", () => {
    const eggCracked = makeEntity({
      id: "egg_cracked",
      capabilities: { isCombinableAddition: true },
    });
    const combinableFriedPotato = makeEntity({
      id: "potato",
      allowedTransformations: ["fry"],
      statePrerequisites: { combine: "fried" },
      capabilities: { isFryable: true, isCombinableBase: true },
    });
    const combine = makeAction({
      id: "combine",
      requiredTargetCapability: "isCombinableBase",
      requiredSecondaryCapability: "isCombinableAddition",
      outputs: { combinesInto: "mixture" },
    });
    const mixture = makeEntity({
      id: "mixture",
      possibleStates: ["raw", "fried"],
      allowedTransformations: ["fry"],
      capabilities: { isFryable: true },
    });
    const entitiesLocal = new Map([
      ["potato", combinableFriedPotato],
      ["egg_cracked", eggCracked],
      ["mixture", mixture],
    ]);
    const actionsLocal = new Map([
      ["fry", fry],
      ["combine", combine],
    ]);
    const intent: RecipeIntent = {
      id: "combo-intent",
      names: { en: "test" },
      initialInventory: [
        { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
        { id: "egg_cracked-1", entityId: "egg_cracked", state: "raw", tags: [] },
      ],
      availableTools: [],
      goals: [
        {
          instanceId: "potato-1",
          requiredTags: [],
          combine: {
            actionId: "combine",
            secondaryInstanceId: "egg_cracked-1",
            secondaryDesiredTags: [],
          },
        },
        { instanceId: "$combineResult:0", state: "fried", requiredTags: [] },
      ],
      metadata: {},
    };
    const result = planIntent(intent, entitiesLocal, actionsLocal);
    assert.equal(result.success, true);
    if (result.success) {
      assert.deepEqual(
        result.recipe.sequence.map((s) => s.actionId),
        ["fry", "combine", "fry"]
      );
      assert.equal(result.recipe.sequence[2].targetInstanceId, "mixture-1");
    }
  });
});
