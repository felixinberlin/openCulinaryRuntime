import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { isGoalReachable } from "../src/reachability.ts";
import { makeEntity, makeAction } from "./helpers.ts";

/**
 * Coverage for src/reachability.ts (TICKET 4, PAPER_NOTES_2608.04768.md) —
 * synthetic fixtures, same convention as place.ts/recipe-runner.ts's own
 * tests, no data/*.json dependency. scripts/is-goal-still-reachable.ts
 * covers the real-data acceptance-criteria cases separately.
 */

describe("isGoalReachable — trivial cases", () => {
  test("start state already matches the goal -> reachable with an empty path", () => {
    const potato = makeEntity({
      id: "potato",
      possibleStates: ["raw"],
      allowedTransformations: [],
    });
    const result = isGoalReachable({
      entity: potato,
      entities: new Map([["potato", potato]]),
      actions: new Map(),
      startState: "raw",
      startTags: [],
      goal: { state: "raw" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, { reachable: true, path: [] });
  });

  test("a required tag already present on the start satisfies a tag-only goal", () => {
    const potato = makeEntity({ id: "potato", allowedTransformations: [] });
    const result = isGoalReachable({
      entity: potato,
      entities: new Map([["potato", potato]]),
      actions: new Map(),
      startState: "raw",
      startTags: ["washed"],
      goal: { requiredTags: ["washed"] },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, { reachable: true, path: [] });
  });
});

describe("isGoalReachable — a simple real path", () => {
  const potato = makeEntity({
    id: "potato",
    capabilities: { isPeelable: true, isFryable: true },
    allowedTransformations: ["peel", "fry"],
    statePrerequisites: { fry: ["peeled"] }, // forces the 2-step path — FRY isn't available straight from "raw" in this fixture
  });
  const peel = makeAction({
    id: "peel",
    requiredTargetCapability: "isPeelable",
    outputs: { transformedState: "peeled" },
  });
  const fry = makeAction({
    id: "fry",
    requiredTargetCapability: "isFryable",
    requiredIngredientCapabilities: ["isFryingMedium"],
    outputs: { transformedState: "fried" },
  });
  const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
  const entities = new Map([
    ["potato", potato],
    ["oil", oil],
  ]);
  const actions = new Map([
    ["peel", peel],
    ["fry", fry],
  ]);

  test("finds a real 2-step path", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "fried" },
      availableTools: new Set(),
      availableIngredients: new Set(["oil"]),
    });
    assert.deepEqual(result, {
      reachable: true,
      path: [{ actionId: "peel" }, { actionId: "fry" }],
    });
  });

  test("missing the required ingredient capability blocks FRY, with a specific reason", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "fried" },
      availableTools: new Set(),
      availableIngredients: new Set(), // no oil
    });
    assert.equal(result.reachable, false);
    if (result.reachable) throw new Error("unreachable");
    assert.deepEqual(
      result.blockedBy.filter((r) => r.kind === "missing_ingredient_capability"),
      [{ kind: "missing_ingredient_capability", actionId: "fry", capability: "isFryingMedium" }]
    );
  });
});

describe("isGoalReachable — BFS finds the SHORTEST path, deterministically", () => {
  // Two routes to "fried": a direct one-step FRY, and a longer PEEL-then-FRY
  // detour that also ends at "fried". BFS must return the 1-step path, not
  // the 2-step one, and must do so identically on repeat runs.
  const potato = makeEntity({
    id: "potato",
    capabilities: { isPeelable: true, isFryable: true },
    allowedTransformations: ["peel", "fry"],
  });
  const peel = makeAction({
    id: "peel",
    requiredTargetCapability: "isPeelable",
    outputs: { transformedState: "peeled" },
  });
  const fry = makeAction({
    id: "fry",
    requiredTargetCapability: "isFryable",
    outputs: { transformedState: "fried" },
  });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([
    ["peel", peel],
    ["fry", fry],
  ]);

  test("returns the shorter path", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "fried" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, { reachable: true, path: [{ actionId: "fry" }] });
  });

  test("is deterministic across repeated runs of the identical query", () => {
    const query = {
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "fried" },
      availableTools: new Set<string>(),
      availableIngredients: new Set<string>(),
    };
    const a = isGoalReachable(query);
    const b = isGoalReachable(query);
    assert.deepEqual(a, b);
  });
});

describe("isGoalReachable — a transformedStateFromParameter action fans out into one edge per allowedValues entry", () => {
  const potato = makeEntity({
    id: "potato",
    capabilities: { isChoppable: true },
    allowedTransformations: ["cut"],
  });
  const cut = makeAction({
    id: "cut",
    requiredTargetCapability: "isChoppable",
    parameters: [{ id: "shape", allowedValues: ["sliced", "diced", "julienne"] }],
    outputs: { transformedStateFromParameter: "shape" },
  });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([["cut", cut]]);

  test("finds the specific shape value that reaches the goal, recorded as `param`", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "diced" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, { reachable: true, path: [{ actionId: "cut", param: "diced" }] });
  });

  test("a value never in allowedValues is correctly unreachable", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "minced" }, // not in this cut's allowedValues
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.equal(result.reachable, false);
  });
});

describe("isGoalReachable — real dead-end reasons, one per mechanism", () => {
  test("forbidden_transition: invalidTransitions blocks a specific edge, with the fromState/toState named", () => {
    const potato = makeEntity({
      id: "potato",
      possibleStates: ["mashed", "peeled"],
      capabilities: { isPeelable: true },
      allowedTransformations: ["peel"],
      invalidTransitions: { mashed: ["peeled"] },
    });
    const peel = makeAction({
      id: "peel",
      requiredTargetCapability: "isPeelable",
      outputs: { transformedState: "peeled" },
    });
    const result = isGoalReachable({
      entity: potato,
      entities: new Map([["potato", potato]]),
      actions: new Map([["peel", peel]]),
      startState: "mashed",
      startTags: [],
      goal: { state: "peeled" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, {
      reachable: false,
      blockedBy: [
        { kind: "forbidden_transition", actionId: "peel", fromState: "mashed", toState: "peeled" },
      ],
    });
  });

  test("unsatisfied_state_prerequisite: a real statePrerequisite that isn't met", () => {
    const potato = makeEntity({
      id: "potato",
      capabilities: { isChoppable: true },
      allowedTransformations: ["cut"],
      statePrerequisites: { cut: ["peeled"] },
    });
    const cut = makeAction({
      id: "cut",
      requiredTargetCapability: "isChoppable",
      outputs: { transformedState: "diced" },
    });
    const result = isGoalReachable({
      entity: potato,
      entities: new Map([["potato", potato]]),
      actions: new Map([["cut", cut]]),
      startState: "raw",
      startTags: [],
      goal: { state: "diced" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, {
      reachable: false,
      blockedBy: [
        {
          kind: "unsatisfied_state_prerequisite",
          actionId: "cut",
          fromState: "raw",
          requiredAnyOf: ["peeled"],
        },
      ],
    });
  });

  test("missing_target_capability, missing_tool, missing_tool_capability", () => {
    const potato = makeEntity({ id: "potato", allowedTransformations: ["peel", "boil", "fry"] });
    const peel = makeAction({
      id: "peel",
      requiredTargetCapability: "isPeelable",
      outputs: { transformedState: "peeled" },
    });
    const boil = makeAction({
      id: "boil",
      requiredTools: ["pot"],
      outputs: { transformedState: "boiled" },
    });
    const fry = makeAction({
      id: "fry",
      requiredToolCapabilities: ["isFryingVessel"],
      outputs: { transformedState: "fried" },
    });
    const result = isGoalReachable({
      entity: potato,
      entities: new Map([["potato", potato]]),
      actions: new Map([
        ["peel", peel],
        ["boil", boil],
        ["fry", fry],
      ]),
      startState: "raw",
      startTags: [],
      goal: { state: "nonexistent_unreachable_goal" },
      availableTools: new Set(), // no pot, no fry-capable tool
      availableIngredients: new Set(),
    });
    assert.equal(result.reachable, false);
    if (result.reachable) throw new Error("unreachable");
    assert.deepEqual(result.blockedBy, [
      { kind: "missing_target_capability", actionId: "peel", capability: "isPeelable" },
      { kind: "missing_tool", actionId: "boil", toolId: "pot" },
      { kind: "missing_tool_capability", actionId: "fry", capability: "isFryingVessel" },
    ]);
  });

  test("requires_secondary_instance: a COMBINE-shaped action is recorded as blocked, not explored", () => {
    const mixture = makeEntity({ id: "mixture", allowedTransformations: ["combine"] });
    const combine = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "result" },
    });
    const result = isGoalReachable({
      entity: mixture,
      entities: new Map([["mixture", mixture]]),
      actions: new Map([["combine", combine]]),
      startState: "raw",
      startTags: [],
      goal: { state: "result" },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, {
      reachable: false,
      blockedBy: [{ kind: "requires_secondary_instance", actionId: "combine" }],
    });
  });

  test("instance_destroyed: destroysTarget is a real dead end, zero outgoing edges from the destroyed instance", () => {
    const egg = makeEntity({
      id: "egg",
      capabilities: { isSeparable: true },
      allowedTransformations: ["separate"],
    });
    const separate = makeAction({
      id: "separate",
      requiredTargetCapability: "isSeparable",
      outputs: { transformedState: "separated", destroysTarget: true },
    });
    const result = isGoalReachable({
      entity: egg,
      entities: new Map([["egg", egg]]),
      actions: new Map([["separate", separate]]),
      startState: "boiled",
      startTags: [],
      goal: { state: "separated" }, // even the action's OWN nominal output state is unreachable — the instance is destroyed, not transformed
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.deepEqual(result, {
      reachable: false,
      blockedBy: [{ kind: "instance_destroyed", actionId: "separate" }],
    });
  });
});

describe("isGoalReachable — addsTag actions preserve state and accumulate tags across the search", () => {
  const potato = makeEntity({
    id: "potato",
    capabilities: { isWashable: true, isSaltable: true },
    allowedTransformations: ["wash", "salt"],
  });
  const wash = makeAction({
    id: "wash",
    requiredTargetCapability: "isWashable",
    outputs: { addsTag: "washed" },
  });
  const salt = makeAction({
    id: "salt",
    requiredTargetCapability: "isSaltable",
    outputs: { addsTag: "salted" },
  });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([
    ["wash", wash],
    ["salt", salt],
  ]);

  test("reaches a goal requiring multiple accumulated tags, state unchanged throughout", () => {
    const result = isGoalReachable({
      entity: potato,
      entities,
      actions,
      startState: "raw",
      startTags: [],
      goal: { state: "raw", requiredTags: ["washed", "salted"] },
      availableTools: new Set(),
      availableIngredients: new Set(),
    });
    assert.equal(result.reachable, true);
    if (!result.reachable) throw new Error("reachable");
    assert.equal(result.path.length, 2);
    assert.deepEqual(new Set(result.path.map((s) => s.actionId)), new Set(["wash", "salt"]));
  });
});
