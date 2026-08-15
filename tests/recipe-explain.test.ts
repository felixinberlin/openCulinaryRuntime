import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { explainRecipe } from "../src/recipe-explain.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * Coverage for recipe-explain.ts's four report sections — synthetic
 * fixtures, same convention as recipe-runner.test.ts, no data/*.json
 * dependency. Each `describe` block isolates one section so a failure
 * names exactly which advisory/report stopped firing correctly.
 */

function makeRecipe(overrides: Partial<RecipeScript>): RecipeScript {
  return {
    id: "test-recipe",
    names: { en: "Test recipe" },
    initialInventory: [],
    availableTools: [],
    sequence: [],
    metadata: {},
    ...overrides,
  };
}

describe("explainRecipe — tools", () => {
  const pan = makeEntity({ id: "pan", kind: "tool", capabilities: { isFryingVessel: true } });
  const pot = makeEntity({ id: "pot", kind: "tool", capabilities: { isDeepVessel: true } });
  const egg = makeEntity({ id: "egg" });
  const fry = makeAction({ id: "fry", requiredTools: ["pan"], outputs: { transformedState: "fried" } });
  const boil = makeAction({ id: "boil", requiredToolCapabilities: ["isDeepVessel"], outputs: { transformedState: "boiled" } });
  const entities = new Map([
    ["pan", pan],
    ["pot", pot],
    ["egg", egg],
  ]);
  const actions = new Map([
    ["fry", fry],
    ["boil", boil],
  ]);

  test("an exact requiredTools id missing from availableTools is reported", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      availableTools: [],
      sequence: [{ actionId: "fry", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.tools.needed, ["pan"]);
    assert.deepEqual(report.tools.missing, ["pan"]);
  });

  test("a satisfied requiredTools id is NOT reported missing", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      availableTools: ["pan"],
      sequence: [{ actionId: "fry", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.tools.missing, []);
  });

  test("a requiredToolCapabilities gap names real candidate tool ids", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      availableTools: ["pan"], // pan doesn't assert isDeepVessel — pot does
      sequence: [{ actionId: "boil", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.equal(report.tools.missingCapabilities.length, 1);
    assert.equal(report.tools.missingCapabilities[0].capability, "isDeepVessel");
    assert.deepEqual(report.tools.missingCapabilities[0].candidates, ["pot"]);
  });

  test("a satisfied requiredToolCapabilities is NOT reported missing", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      availableTools: ["pot"],
      sequence: [{ actionId: "boil", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.tools.missingCapabilities, []);
  });
});

describe("explainRecipe — ingredients", () => {
  const potato = makeEntity({ id: "potato" });
  const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
  const fry = makeAction({
    id: "fry",
    requiredIngredientCapabilities: ["isFryingMedium"],
    outputs: { transformedState: "fried" },
  });
  const actions = new Map([["fry", fry]]);

  test("a requiredIngredientCapabilities gap names real candidate entity ids", () => {
    const entities = new Map([
      ["potato", potato],
      ["oil", oil],
    ]);
    const recipe = makeRecipe({
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }], // no oil in this recipe at all
      sequence: [{ actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.equal(report.ingredients.missing.length, 1);
    assert.equal(report.ingredients.missing[0].capability, "isFryingMedium");
    assert.deepEqual(report.ingredients.missing[0].candidates, ["oil"]);
  });

  test("present in initialInventory is NOT reported missing", () => {
    const entities = new Map([
      ["potato", potato],
      ["oil", oil],
    ]);
    const recipe = makeRecipe({
      initialInventory: [
        { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
        { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
      ],
      sequence: [{ actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: ["oil-1"] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.ingredients.missing, []);
  });
});

describe("explainRecipe — timing advisories", () => {
  const egg = makeEntity({ id: "egg" });
  const potato = makeEntity({ id: "potato" });
  const boil = makeAction({
    id: "boil",
    parameters: [
      { id: "durationSeconds", numericRange: { unit: "seconds", min: 0, max: 3600 } },
      { id: "yolkDoneness", allowedValues: ["soft", "medium", "hard"] },
    ],
    outputs: { transformedState: "boiled" },
  });
  const boilPotato = makeAction({
    id: "boil_potato",
    parameters: [
      { id: "durationSeconds", numericRange: { unit: "seconds", min: 0, max: 3600 } },
      { id: "pieceSize", allowedValues: ["whole", "halved_or_quartered", "diced"] },
    ],
    outputs: { transformedState: "boiled" },
  });
  const entities = new Map([
    ["egg", egg],
    ["potato", potato],
  ]);
  const actions = new Map([
    ["boil", boil],
    ["boil_potato", boilPotato],
  ]);

  test("a duration far outside the cited EGG_BOIL_DONENESS range for the stated doneness fires an advisory", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      sequence: [
        {
          actionId: "boil",
          targetInstanceId: "egg-1",
          params: { durationSeconds: "700", yolkDoneness: "soft" }, // 700s is well into "hard" territory
          availableIngredientInstanceIds: [],
        },
      ],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.equal(report.timingAdvisories.length, 1);
    assert.match(report.timingAdvisories[0], /outside EGG_BOIL_DONENESS's "soft" range/);
  });

  test("a duration inside the cited range does NOT fire an advisory", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      sequence: [
        {
          actionId: "boil",
          targetInstanceId: "egg-1",
          params: { durationSeconds: "390", yolkDoneness: "soft" },
          availableIngredientInstanceIds: [],
        },
      ],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.timingAdvisories, []);
  });

  test("same check, potato/pieceSize side (POTATO_BOIL_DONENESS)", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      sequence: [
        {
          actionId: "boil_potato",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "60", pieceSize: "whole" }, // whole needs 900-1080s
          availableIngredientInstanceIds: [],
        },
      ],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.equal(report.timingAdvisories.length, 1);
    assert.match(report.timingAdvisories[0], /outside POTATO_BOIL_DONENESS's "whole" range/);
  });
});

describe("explainRecipe — prep advisories (wash-before-peel/cut heuristic)", () => {
  const potato = makeEntity({ id: "potato", possibleStates: ["raw", "washed", "peeled"] });
  const peel = makeAction({ id: "peel", outputs: { transformedState: "peeled" } });
  const wash = makeAction({ id: "wash", outputs: { transformedState: "washed" } });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([
    ["peel", peel],
    ["wash", wash],
  ]);

  test("PEEL with no prior WASH on a washable entity fires a heuristic advisory", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      sequence: [{ actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.equal(report.prepAdvisories.length, 1);
    assert.match(report.prepAdvisories[0], /PEEL on "potato-1"/);
    assert.match(report.prepAdvisories[0], /Heuristic advice only/);
  });

  test("WASH before PEEL on the same instance does NOT fire the advisory", () => {
    const recipe = makeRecipe({
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      sequence: [
        { actionId: "wash", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
      ],
    });
    const report = explainRecipe(recipe, entities, actions);
    assert.deepEqual(report.prepAdvisories, []);
  });

  test("an entity with no 'washed' possibleState is never flagged (nothing to wash toward)", () => {
    const eggEntity = makeEntity({ id: "egg", possibleStates: ["raw", "peeled"] }); // no "washed" state
    const localEntities = new Map([["egg", eggEntity]]);
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      sequence: [{ actionId: "peel", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, localEntities, actions);
    assert.deepEqual(report.prepAdvisories, []);
  });
});
