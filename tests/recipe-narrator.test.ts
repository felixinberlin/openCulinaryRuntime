import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { narrateRecipe, renderNarrationMarkdown } from "../src/recipe-narrator.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * Coverage for recipe-narrator.ts — synthetic fixtures mirroring
 * garlic-oil-potatoes.json's real shape (a fry + infuse + fry pipeline
 * with a byproduct that inherits a tag) closely enough to exercise every
 * section of the narration without depending on that file's exact
 * contents.
 */

const potato = makeEntity({
  id: "potato",
  producedByproducts: ["potato_peel"],
  capabilities: { isFryingMedium: false },
});
const potatoPeel = makeEntity({ id: "potato_peel", possibleStates: ["raw"], possibleTags: ["washed"] });
const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
const wash = makeAction({ id: "wash", outputs: { addsTag: "washed" } });
const peel = makeAction({ id: "peel", outputs: { transformedState: "peeled", spawnsTargetByproducts: true } });
const fry = makeAction({
  id: "fry",
  requiredIngredientCapabilities: ["isFryingMedium"],
  parameters: [{ id: "durationSeconds", numericRange: { unit: "seconds", min: 0, max: 3600 } }],
  outputs: { transformedState: "fried" },
});
const entities = new Map([
  ["potato", potato],
  ["potato_peel", potatoPeel],
  ["oil", oil],
]);
const actions = new Map([
  ["wash", wash],
  ["peel", peel],
  ["fry", fry],
]);

function makeRecipe(overrides: Partial<RecipeScript>): RecipeScript {
  return {
    id: "test-recipe",
    names: { en: "Test Recipe" },
    initialInventory: [
      { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
      { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
    ],
    availableTools: [],
    sequence: [],
    metadata: {},
    ...overrides,
  };
}

describe("narrateRecipe", () => {
  test("verbsUsed is unique, in order of first appearance", () => {
    const recipe = makeRecipe({
      sequence: [
        { actionId: "wash", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "300" },
          availableIngredientInstanceIds: ["oil-1"],
        },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    assert.deepEqual(n.verbsUsed, ["WASH", "PEEL", "FRY"]);
    assert.equal(n.stepCount, 3);
  });

  test("capabilityResolutions names the real instance that satisfied each requirement", () => {
    const recipe = makeRecipe({
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "300" },
          availableIngredientInstanceIds: ["oil-1"],
        },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    assert.equal(n.capabilityResolutions.length, 1);
    assert.equal(n.capabilityResolutions[0].capability, "isFryingMedium");
    assert.equal(n.capabilityResolutions[0].satisfiedByInstanceId, "oil-1");
    assert.equal(n.capabilityResolutions[0].satisfiedByEntityId, "oil");
  });

  test("createdElements lists only spawned instances, with inherited tags surfaced", () => {
    const recipe = makeRecipe({
      sequence: [
        { actionId: "wash", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    assert.equal(n.createdElements.length, 1);
    assert.equal(n.createdElements[0].entityId, "potato_peel");
    assert.deepEqual(n.createdElements[0].tags, ["washed"]);
    assert.deepEqual(n.createdElements[0].confidentlyInheritedTags, ["washed"]);
    // Initial-inventory instances (potato-1, oil-1) must NOT appear as "created."
    assert.ok(!n.createdElements.some((e) => e.instanceId === "potato-1" || e.instanceId === "oil-1"));
  });

  test("a created element that's re-targeted AFTER spawning does NOT claim its later tags were inherited (regression: tortilla_mixture/FLIP case)", () => {
    // Mirrors the real bug this file's own manual check against
    // tortilla-de-patatas.json caught: a COMBINE-spawned instance later
    // targeted by FLIP (addsTag: "flipped") must not have "flipped"
    // reported as conservation-of-mass inheritance — it wasn't there at
    // spawn time, a later step added it.
    const mixture = makeEntity({ id: "mixture", possibleStates: ["raw", "fried"], possibleTags: ["flipped"], capabilities: { isFryable: true } });
    const localEntities = new Map([...entities, ["mixture", mixture]] as [string, ReturnType<typeof makeEntity>][]);
    const combine = makeAction({ id: "combine", requiredSecondaryCapability: "isFryingMedium", outputs: { combinesInto: "mixture" } });
    const flip = makeAction({ id: "flip", outputs: { addsTag: "flipped" } });
    const localActions = new Map([...actions, ["combine", combine], ["flip", flip]]);

    const recipe = makeRecipe({
      initialInventory: [
        { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
        { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
      ],
      sequence: [
        { actionId: "combine", targetInstanceId: "potato-1", secondaryInstanceId: "oil-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "flip", targetInstanceId: "mixture-1", params: {}, availableIngredientInstanceIds: [] },
      ],
    });
    const n = narrateRecipe(recipe, localEntities, localActions);
    const spawned = n.createdElements.find((e) => e.entityId === "mixture")!;
    assert.ok(spawned, "expected the combined mixture to appear in createdElements");
    assert.deepEqual(spawned.tags, ["flipped"], "final tags must still be accurate");
    assert.deepEqual(spawned.confidentlyInheritedTags, [], "flipped was NOT present at spawn time, must not be claimed as inherited");
  });

  test("statedActiveDurationSeconds sums stated durations; unstated ones are named, not zeroed", () => {
    const recipe = makeRecipe({
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "240" },
          availableIngredientInstanceIds: ["oil-1"],
        },
        {
          // Same action, but no durationSeconds this time — a real,
          // legal omission (matches garlic-oil-potatoes.json's own
          // potato FRY step).
          actionId: "fry",
          targetInstanceId: "oil-1",
          params: {},
          availableIngredientInstanceIds: ["oil-1"],
        },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    assert.equal(n.statedActiveDurationSeconds, 240);
    assert.deepEqual(n.stepsWithUnstatedDuration, [`FRY on "oil-1"`]);
  });

  test("a failing step is reflected in runErrors and ranCleanly", () => {
    const recipe = makeRecipe({
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "300" },
          availableIngredientInstanceIds: [], // no oil available -> requiredIngredientCapabilities fails
        },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    assert.equal(n.ranCleanly, false);
    assert.equal(n.runErrors.length, 1);
    assert.match(n.runErrors[0], /isFryingMedium/);
  });

  test("renderNarrationMarkdown produces a document containing every major section", () => {
    const recipe = makeRecipe({
      sequence: [
        { actionId: "wash", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: { durationSeconds: "300" },
          availableIngredientInstanceIds: ["oil-1"],
        },
      ],
    });
    const n = narrateRecipe(recipe, entities, actions);
    const md = renderNarrationMarkdown(n);
    for (const heading of [
      "## Structure",
      "## What it needs",
      "## What the system inferred",
      "## Verbs used",
      "## Elements created",
      "## How long it takes",
      "## Final inventory",
      "## Result",
    ]) {
      assert.ok(md.includes(heading), `expected markdown to include "${heading}"`);
    }
    assert.match(md, /Runs end-to-end with zero errors/);
  });
});
