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
  const potato = makeEntity({ id: "potato", possibleStates: ["raw", "peeled"], capabilities: { isWashable: true } });
  const peel = makeAction({ id: "peel", outputs: { transformedState: "peeled" } });
  const wash = makeAction({ id: "wash", outputs: { addsTag: "washed" } });
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

  test("an entity with no isWashable capability is never flagged (nothing to wash toward)", () => {
    const eggEntity = makeEntity({ id: "egg", possibleStates: ["raw", "peeled"] }); // no isWashable capability
    const localEntities = new Map([["egg", eggEntity]]);
    const recipe = makeRecipe({
      initialInventory: [{ id: "egg-1", entityId: "egg", state: "raw", tags: [] }],
      sequence: [{ actionId: "peel", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: [] }],
    });
    const report = explainRecipe(recipe, localEntities, actions);
    assert.deepEqual(report.prepAdvisories, []);
  });
});

describe("explainRecipe — fry-timing-vs-geometry (cut-dimensions.ts + heat-penetration.ts composition)", () => {
  // Real potato-like thermophysical values (matches potato.json's own
  // actual numbers, not hardcoded to that exact file's contents).
  const potato = makeEntity({
    id: "potato",
    thermophysical: { thermalConductivityWPerMK: 0.5, densityKgPerM3: 1080, specificHeatJPerKgK: 3730 },
    physicalDimensions: { typicalDiameterCm: { min: 5, max: 6.35 } },
  });
  const cut = makeAction({
    id: "cut",
    parameters: [{ id: "shape", allowedValues: ["sliced", "diced", "julienne", "chopped", "minced", "halved", "quartered"] }],
    outputs: { transformedStateFromParameter: "shape" },
  });
  const fry = makeAction({
    id: "fry",
    parameters: [
      { id: "oilTempC", numericRange: { unit: "celsius", min: 0, max: 300 } },
      { id: "durationSeconds", numericRange: { unit: "seconds", min: 0, max: 3600 } },
      { id: "topCookingMethod", allowedValues: ["untouched", "basted", "covered", "flipped"], required: false },
    ],
    outputs: { transformedState: "fried" },
  });
  const entities = new Map([["potato", potato]]);
  const actions = new Map([
    ["cut", cut],
    ["fry", fry],
  ]);

  function friedPotatoRecipe(shape: string, oilTempC: string, durationSeconds: string, topCookingMethod?: string) {
    return makeRecipe({
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      sequence: [
        { actionId: "cut", targetInstanceId: "potato-1", params: { shape }, availableIngredientInstanceIds: [] },
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: topCookingMethod ? { oilTempC, durationSeconds, topCookingMethod } : { oilTempC, durationSeconds },
          availableIngredientInstanceIds: [],
        },
      ],
    });
  }

  test("duration below even the fastest real case fires a strong advisory", () => {
    const report = explainRecipe(friedPotatoRecipe("diced", "175", "3"), entities, actions);
    const hit = report.timingAdvisories.find((a) => a.includes("FASTEST real"));
    assert.ok(hit, `expected a FASTEST-case advisory, got: ${JSON.stringify(report.timingAdvisories)}`);
    assert.match(hit!, /"diced" piece/);
  });

  test("duration inside the genuinely uncertain window fires a distinctly-worded advisory", () => {
    // diced (6.35-12.7mm): fastest (2 faces, thin) and slowest (1 face,
    // thick) cases are far apart at 175C — pick a duration in between.
    const report = explainRecipe(friedPotatoRecipe("diced", "175", "40"), entities, actions);
    const hit = report.timingAdvisories.find((a) => a.includes("UNCERTAIN"));
    assert.ok(hit, `expected an UNCERTAIN-range advisory, got: ${JSON.stringify(report.timingAdvisories)}`);
  });

  test("duration comfortably above the slowest real case does NOT fire", () => {
    const report = explainRecipe(friedPotatoRecipe("diced", "175", "600"), entities, actions);
    assert.deepEqual(report.timingAdvisories, []);
  });

  test("topCookingMethod: basted narrows the window to one heated face, distinguishable from the no-signal case", () => {
    const noSignal = explainRecipe(friedPotatoRecipe("diced", "175", "3"), entities, actions);
    const basted = explainRecipe(friedPotatoRecipe("diced", "175", "3", "basted"), entities, actions);
    const noSignalHit = noSignal.timingAdvisories.find((a) => a.includes("FASTEST real"))!;
    const bastedHit = basted.timingAdvisories.find((a) => a.includes("FASTEST real"))!;
    assert.match(noSignalHit, /oil coverage not stated — both submerged and shallow considered/);
    assert.match(bastedHit, /topCookingMethod: "basted" \(one face in oil\)/);
  });

  test("oilTempC at or below the fork-tender target fires a distinct, real 'can never reach it' advisory", () => {
    const report = explainRecipe(friedPotatoRecipe("sliced", "80", "600"), entities, actions);
    const hit = report.timingAdvisories.find((a) => a.includes("can NEVER reach doneness"));
    assert.ok(hit, `expected the unreachable-target advisory, got: ${JSON.stringify(report.timingAdvisories)}`);
  });

  test("an entity with incomplete thermophysical data is silently skipped, not an error", () => {
    const undercooked = makeEntity({ id: "garlic" }); // no thermophysical block at all
    const localEntities = new Map([["garlic", undercooked]]);
    const recipe = makeRecipe({
      initialInventory: [{ id: "garlic-1", entityId: "garlic", state: "raw", tags: [] }],
      sequence: [
        { actionId: "cut", targetInstanceId: "garlic-1", params: { shape: "sliced" }, availableIngredientInstanceIds: [] },
        {
          actionId: "fry",
          targetInstanceId: "garlic-1",
          params: { oilTempC: "175", durationSeconds: "3" },
          availableIngredientInstanceIds: [],
        },
      ],
    });
    assert.doesNotThrow(() => explainRecipe(recipe, localEntities, actions));
    // Also correctly produces no advisory — the doneness target
    // (POTATO_FORK_TENDER_CENTER_TEMP_C) is potato-specific by name, so
    // even a fully-specified non-potato entity is out of scope, gated
    // explicitly rather than silently assumed to apply.
    const report = explainRecipe(recipe, localEntities, actions);
    assert.deepEqual(report.timingAdvisories, []);
  });

  test("halved/quartered derive from the entity's own physicalDimensions, not cut-dimensions.ts", () => {
    // 5-6.35cm diameter halved -> 25-31.75mm largest dimension, comfortably
    // thick enough that 3s should still fire the FASTEST-case advisory.
    const report = explainRecipe(friedPotatoRecipe("halved", "175", "3"), entities, actions);
    const hit = report.timingAdvisories.find((a) => a.includes("FASTEST real"));
    assert.ok(hit, `expected a FASTEST-case advisory for "halved", got: ${JSON.stringify(report.timingAdvisories)}`);
    assert.match(hit!, /"halved" piece/);
  });
});
