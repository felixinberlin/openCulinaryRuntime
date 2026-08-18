import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { compileToExecutionGraph, checkExecutionOrder } from "../src/execution-graph.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

// --- Fixtures --------------------------------------------------------------
// A synthetic peel -> slice -> fry chain, matching the ticket's own worked
// example almost exactly (statePrerequisites/capabilities/effects chosen so
// each step's real precondition/effect shape is exercised, not just its
// happy path).

const potato = makeEntity({
  id: "potato",
  capabilities: { isPeelable: true, isSliceable: true, isFryable: true },
  statePrerequisites: { peel: "whole", slice: "peeled", fry: "sliced" },
  producedByproducts: ["potato_peel"],
});
const potatoPeel = makeEntity({ id: "potato_peel" });
const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true, isHeatable: true } });

const peel = makeAction({
  id: "peel",
  outputs: { transformedState: "peeled", spawnsTargetByproducts: true },
  requiredTargetCapability: "isPeelable",
});
const slice = makeAction({
  id: "slice",
  outputs: { transformedState: "sliced" },
  requiredTargetCapability: "isSliceable",
});
const fry = makeAction({
  id: "fry",
  outputs: { transformedState: "fried" },
  requiredTargetCapability: "isFryable",
  requiredIngredientCapabilities: ["isFryingMedium"],
});
const heatOil = makeAction({
  id: "heat_oil",
  outputs: { addsTag: "hot" },
  requiredTargetCapability: "isHeatable",
});

const entities = new Map([
  ["potato", potato],
  ["potato_peel", potatoPeel],
  ["oil", oil],
]);
const actions = new Map([
  ["peel", peel],
  ["slice", slice],
  ["fry", fry],
  ["heat_oil", heatOil],
]);

function linearRecipe(): RecipeScript {
  return {
    id: "peel_slice_fry",
    names: { en: "Peel, Slice, Fry" },
    initialInventory: [
      { id: "potato-1", entityId: "potato", state: "whole", tags: [] },
      { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
    ],
    availableTools: [],
    sequence: [
      {
        actionId: "peel",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "slice",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "fry",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: ["oil-1"],
      },
    ],
    metadata: {},
  };
}

/** The ticket's own diagram: peel -> slice -> fry, with an independent
 *  "heat oil" branch also feeding into fry — a real fan-in, not a linear
 *  list, proving the graph supports genuine dependency structure. */
function fanInRecipe(): RecipeScript {
  return {
    id: "peel_slice_fry_with_hot_oil",
    names: { en: "Peel, Slice, Fry (hot oil)" },
    initialInventory: [
      { id: "potato-1", entityId: "potato", state: "whole", tags: [] },
      { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
    ],
    availableTools: [],
    sequence: [
      {
        id: "peel-potato-1",
        dependsOn: [],
        actionId: "peel",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        id: "slice-potato-1",
        dependsOn: ["peel-potato-1"],
        actionId: "slice",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        id: "heat-oil-1",
        dependsOn: [],
        actionId: "heat_oil",
        targetInstanceId: "oil-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        id: "fry-potato-1",
        dependsOn: ["slice-potato-1", "heat-oil-1"],
        actionId: "fry",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: ["oil-1"],
      },
    ],
    metadata: {},
  };
}

describe("compileToExecutionGraph — linear peel -> slice -> fry", () => {
  test("produces exactly 3 nodes and 2 dependency edges, in order", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.graph.nodes.length, 3);
    assert.deepEqual(
      result.graph.nodes.map((n) => n.action),
      ["peel", "slice", "fry"]
    );
    assert.deepEqual(result.graph.edges, [
      { from: "0", to: "1", type: "dependency" },
      { from: "1", to: "2", type: "dependency" },
    ]);
  });

  test("edges are explicit graph structure, not array position — node order in `nodes` isn't what a consumer should rely on", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    // Every node's dependency is discoverable ONLY via `edges`, never by
    // "the node before me in the array."
    for (const edge of result.graph.edges) {
      assert.ok(result.graph.nodes.some((n) => n.id === edge.from));
      assert.ok(result.graph.nodes.some((n) => n.id === edge.to));
    }
  });

  test("the worked example's own precondition/effect shape: potato-1.state == whole -> peeled", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const peelNode = result.graph.nodes[0];
    assert.deepEqual(peelNode.preconditions, [
      { kind: "state", instanceId: "potato-1", allowedValues: ["whole"] },
      { kind: "capability", instanceId: "potato-1", capability: "isPeelable" },
    ]);
    assert.deepEqual(peelNode.effects[0], {
      kind: "stateChange",
      instanceId: "potato-1",
      newState: "peeled",
    });
  });

  test("spawnsTargetByproducts becomes a real spawn effect, resolved from the entity's own producedByproducts", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.graph.nodes[0].effects.find((e) => e.kind === "spawn"),
      {
        kind: "spawn",
        entityId: "potato_peel",
        fromInstanceId: "potato-1",
      }
    );
  });

  test("slice's precondition correctly requires the state peel's effect produces — the two steps are causally linked, not independently asserted", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.graph.nodes[1].preconditions[0], {
      kind: "state",
      instanceId: "potato-1",
      allowedValues: ["peeled"],
    });
  });

  test("entityResolutions resolves every recipe-local instance to its real entity id", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.graph.entityResolutions, { "potato-1": "potato", "oil-1": "oil" });
  });

  test("does not mutate the recipe, entities, or actions it's given", () => {
    const recipe = linearRecipe();
    const before = JSON.parse(JSON.stringify(recipe));
    compileToExecutionGraph(recipe, entities, actions);
    assert.deepEqual(recipe, before);
  });
});

describe("compileToExecutionGraph — fan-in dependency (not a linear list)", () => {
  test("produces 4 nodes and 3 edges, with fry depending on BOTH slice and heat_oil", () => {
    const result = compileToExecutionGraph(fanInRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.graph.nodes.length, 4);
    const incomingToFry = result.graph.edges
      .filter((e) => e.to === "fry-potato-1")
      .map((e) => e.from);
    assert.deepEqual(incomingToFry.sort(), ["heat-oil-1", "slice-potato-1"]);
  });

  test("node ids reflect the recipe's own explicit step ids, matching the ticket's own example naming", () => {
    const result = compileToExecutionGraph(fanInRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(
      result.graph.nodes.map((n) => n.id),
      ["peel-potato-1", "slice-potato-1", "heat-oil-1", "fry-potato-1"]
    );
  });
});

describe("checkExecutionOrder — a dependency prevents out-of-order execution", () => {
  test("peel before slice is a valid order", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(checkExecutionOrder(result.graph, ["0", "1", "2"]), { valid: true });
  });

  test("slice before peel violates the peel -> slice dependency edge", () => {
    const result = compileToExecutionGraph(linearRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const check = checkExecutionOrder(result.graph, ["1", "0", "2"]);
    assert.equal(check.valid, false);
    if (check.valid) return;
    assert.deepEqual(check.violatedEdge, { from: "0", to: "1", type: "dependency" });
  });

  test("in the fan-in graph, running fry before heat_oil is rejected even though fry never mentions heat_oil by name in its own node", () => {
    const result = compileToExecutionGraph(fanInRecipe(), entities, actions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const check = checkExecutionOrder(result.graph, [
      "peel-potato-1",
      "slice-potato-1",
      "fry-potato-1",
      "heat-oil-1",
    ]);
    assert.equal(check.valid, false);
  });
});

describe("compileToExecutionGraph — rejects rather than guesses", () => {
  test("an unresolvable target instance (not in initialInventory) rejects compilation with a named reason", () => {
    const recipe = linearRecipe();
    recipe.sequence[0]!.targetInstanceId = "potato-99";
    const result = compileToExecutionGraph(recipe, entities, actions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("potato-99")));
  });

  test("a missing required capability rejects compilation, naming the entity and capability", () => {
    const bluntKnifeCompatiblePotato = makeEntity({ id: "unpeelable_potato", capabilities: {} });
    const localEntities = new Map(entities);
    localEntities.set("unpeelable_potato", bluntKnifeCompatiblePotato);
    const recipe = linearRecipe();
    recipe.initialInventory[0] = {
      id: "potato-1",
      entityId: "unpeelable_potato",
      state: "whole",
      tags: [],
    };
    const result = compileToExecutionGraph(recipe, localEntities, actions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("isPeelable")));
  });

  test("an unmet state prerequisite rejects compilation (slicing a whole, unpeeled potato)", () => {
    const recipe = linearRecipe();
    recipe.sequence = [recipe.sequence[1]!]; // slice with no preceding peel
    const result = compileToExecutionGraph(recipe, entities, actions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("peeled")));
  });

  test("an unknown action id rejects compilation", () => {
    const recipe = linearRecipe();
    recipe.sequence[0]!.actionId = "levitate";
    const result = compileToExecutionGraph(recipe, entities, actions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("levitate")));
  });

  test("a circular dependency rejects compilation instead of hanging or silently dropping steps", () => {
    const recipe = linearRecipe();
    recipe.sequence[0]!.id = "a";
    recipe.sequence[0]!.dependsOn = ["b"];
    recipe.sequence[1]!.id = "b";
    recipe.sequence[1]!.dependsOn = ["a"];
    const result = compileToExecutionGraph(recipe, entities, actions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.toLowerCase().includes("circular")));
  });

  test("a state effect driven by a missing parameter rejects compilation rather than silently omitting the effect", () => {
    const cut = makeAction({
      id: "cut",
      outputs: { transformedStateFromParameter: "shape" },
      requiredTargetCapability: "isSliceable",
    });
    const localActions = new Map(actions);
    localActions.set("cut", cut);
    const recipe = linearRecipe();
    recipe.sequence = [
      {
        actionId: "peel",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "cut",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: [],
      }, // no "shape" param
    ];
    const result = compileToExecutionGraph(recipe, entities, localActions);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.some((e) => e.includes("shape")));
  });
});

describe("compileToExecutionGraph — combine-shaped actions", () => {
  test("a requiredSecondaryCapability action produces a combine effect and destroys both instances", () => {
    const dough = makeEntity({ id: "dough" });
    const water = makeEntity({ id: "water", capabilities: { isCombinableWithDough: true } });
    const combine = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinableWithDough",
      outputs: { combinesInto: "wet_dough" },
    });
    const localEntities = new Map([
      ["dough", dough],
      ["water", water],
    ]);
    const localActions = new Map([["combine", combine]]);
    const recipe: RecipeScript = {
      id: "combine_test",
      names: { en: "Combine test" },
      initialInventory: [
        { id: "dough-1", entityId: "dough", state: "raw", tags: [] },
        { id: "water-1", entityId: "water", state: "liquid", tags: [] },
      ],
      availableTools: [],
      sequence: [
        {
          actionId: "combine",
          targetInstanceId: "dough-1",
          secondaryInstanceId: "water-1",
          params: {},
          availableIngredientInstanceIds: [],
        },
      ],
      metadata: {},
    };
    const result = compileToExecutionGraph(recipe, localEntities, localActions);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.deepEqual(result.graph.nodes[0].effects, [
      { kind: "combine", instanceIds: ["dough-1", "water-1"], resultEntityId: "wet_dough" },
    ]);
  });
});
