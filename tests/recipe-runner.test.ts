import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { runRecipe } from "../src/recipe-runner.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * Focused coverage for recipe-runner.ts — previously had none (only
 * exercised indirectly via `npm run recipe -- <id>` against real data).
 * Centered on the 2026-08-14 fix below rather than an exhaustive audit of
 * the whole module (a real, separate gap, named rather than silently
 * closed by this file alone).
 */

const potato = makeEntity({ id: "potato" });
const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
const fry = makeAction({
  id: "fry",
  requiredIngredientCapabilities: ["isFryingMedium"],
  outputs: { transformedState: "fried" },
});
const entities = new Map([
  ["potato", potato],
  ["oil", oil],
]);
const actions = new Map([["fry", fry]]);

function makeRecipe(overrides: Partial<RecipeScript>): RecipeScript {
  return {
    id: "test-recipe",
    names: { en: "Test recipe" },
    initialInventory: [
      { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
      { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
    ],
    availableTools: [],
    sequence: [],
    metadata: {},
    ...overrides,
  };
}

describe("runRecipe — availableIngredientInstanceIds resolution", () => {
  test("a typo'd/unknown ingredient instance id fails the step loudly, not silently", () => {
    const recipe = makeRecipe({
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: {},
          availableIngredientInstanceIds: ["oyl-1"], // typo — never declared
        },
      ],
    });
    const result = runRecipe(recipe, entities, actions);

    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Unknown ingredient instance "oyl-1"/);
    // The step must not have silently proceeded and mutated the target either.
    assert.equal(result.finalInventory.get("potato-1")?.state, "raw");
  });

  test("does NOT mask the typo just because another listed instance happens to also qualify", () => {
    const recipe = makeRecipe({
      initialInventory: [
        { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
        { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
      ],
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: {},
          // "oil-1" genuinely qualifies on its own — a naive implementation
          // could still let this step succeed and hide that "oyl-1" was a
          // real authoring mistake never actually checked.
          availableIngredientInstanceIds: ["oil-1", "oyl-1"],
        },
      ],
    });
    const result = runRecipe(recipe, entities, actions);

    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Unknown ingredient instance "oyl-1"/);
  });

  test("a real, fully-resolved ingredient instance id still works exactly as before", () => {
    const recipe = makeRecipe({
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-1",
          params: {},
          availableIngredientInstanceIds: ["oil-1"],
        },
      ],
    });
    const result = runRecipe(recipe, entities, actions);

    assert.equal(result.errors.length, 0);
    assert.equal(result.finalInventory.get("potato-1")?.state, "fried");
  });
});

describe("runRecipe — unknown target/secondary instance (pre-existing behavior, sanity-checked)", () => {
  test("unknown targetInstanceId fails the step loudly", () => {
    const recipe = makeRecipe({
      sequence: [{ actionId: "fry", targetInstanceId: "potato-99", params: {}, availableIngredientInstanceIds: [] }],
    });
    const result = runRecipe(recipe, entities, actions);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /Unknown target instance "potato-99"/);
  });
});
