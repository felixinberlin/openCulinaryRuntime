import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { makeEntity, makeAction } from "./helpers.ts";
import { RecipeScriptSchema, type RecipeScript } from "../src/recipe.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import {
  createPlayer,
  stepForward,
  stepBackward,
  jumpTo,
  currentNarration,
  canApplyNext,
  createVariation,
} from "../src/recipe-player.ts";

/**
 * Synthetic-fixture coverage for recipe-player.ts, same convention as
 * recipe-runner.test.ts — a small two-step (peel, fry) recipe rather than
 * real data/*.json, so each test only exercises the player's own logic
 * (index arithmetic + composition), not the real potato/fry vocabulary
 * already covered by scripts/play-recipe.ts's capability test.
 */

const potato = makeEntity({ id: "potato", capabilities: { isPeelable: true, isFryable: true } });
const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
const peel = makeAction({ id: "peel", requiredTargetCapability: "isPeelable", outputs: { transformedState: "peeled" } });
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
const actions = new Map([
  ["peel", peel],
  ["fry", fry],
]);

function makeRecipe(overrides: Partial<RecipeScript> = {}): RecipeScript {
  return {
    id: "test-recipe",
    names: { en: "Test recipe" },
    initialInventory: [
      { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
      { id: "oil-1", entityId: "oil", state: "liquid", tags: [] },
    ],
    availableTools: [],
    sequence: [
      { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
      { actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: ["oil-1"] },
    ],
    metadata: {},
    ...overrides,
  };
}

describe("recipe-player — stepForward/stepBackward index arithmetic", () => {
  test("clamps at the start: stepBackward from the initial state is a no-op", () => {
    const player = createPlayer(makeRecipe());
    assert.equal(player.currentIndex, -1);
    const stillStart = stepBackward(player);
    assert.equal(stillStart.currentIndex, -1);
  });

  test("clamps at the end: stepForward past the last step is a no-op, not an error", () => {
    let player = createPlayer(makeRecipe());
    player = stepForward(player, entities, actions);
    player = stepForward(player, entities, actions);
    assert.equal(player.currentIndex, 1); // last valid index (2-step sequence)
    const stillEnd = stepForward(player, entities, actions);
    assert.equal(stillEnd.currentIndex, 1);
  });

  test("jumpTo clamps into range in both directions", () => {
    const recipe = makeRecipe();
    let player = createPlayer(recipe);
    assert.equal(jumpTo(player, 99).currentIndex, recipe.sequence.length - 1);
    assert.equal(jumpTo(player, -99).currentIndex, -1);
    assert.equal(jumpTo(player, 0).currentIndex, 0);
  });
});

describe("recipe-player — revert is recomputation, not rollback", () => {
  test("stepping back then forward again reaches identical narration to the original forward pass", () => {
    const recipe = makeRecipe();
    let player = createPlayer(recipe);
    player = stepForward(player, entities, actions); // index 0 (peel)
    player = stepForward(player, entities, actions); // index 1 (fry)
    const originalNarration = currentNarration(player, entities, actions);

    player = stepBackward(player); // back to index 0
    assert.equal(player.currentIndex, 0);
    player = stepForward(player, entities, actions); // forward to index 1 again
    const rewalkedNarration = currentNarration(player, entities, actions);

    assert.deepEqual(rewalkedNarration, originalNarration);
  });

  test("currentNarration is null before any step has executed", () => {
    const player = createPlayer(makeRecipe());
    assert.equal(currentNarration(player, entities, actions), null);
  });
});

describe("recipe-player — canApplyNext", () => {
  test("true case: the next step in the recipe is genuinely feasible", () => {
    let player = createPlayer(makeRecipe());
    player = stepForward(player, entities, actions); // peel done; next is fry, and oil-1 is offered
    assert.deepEqual(canApplyNext(player, entities, actions), { possible: true });
  });

  test("false case: the next step is missing a required ingredient capability", () => {
    const recipeWithNoOilOffered = makeRecipe({
      sequence: [
        { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
        { actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] }, // no oil offered
      ],
    });
    let player = createPlayer(recipeWithNoOilOffered);
    player = stepForward(player, entities, actions); // peel done
    const result = canApplyNext(player, entities, actions);
    assert.equal(result.possible, false);
    assert.match(result.reason ?? "", /isFryingMedium/);
  });

  test("false case: already at the last step", () => {
    const recipe = makeRecipe();
    let player = createPlayer(recipe);
    player = stepForward(player, entities, actions);
    player = stepForward(player, entities, actions); // now at the last step
    const result = canApplyNext(player, entities, actions);
    assert.equal(result.possible, false);
    assert.match(result.reason ?? "", /last step/);
  });
});

describe("recipe-player — createVariation", () => {
  test("produces a RecipeScript that validates against RecipeScriptSchema and runs cleanly", () => {
    const recipe = makeRecipe();
    const variation = createVariation(recipe, 0, [
      { actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: ["oil-1"] },
    ]);

    // Doesn't throw — a real, schema-valid RecipeScript, not just a shaped object.
    const parsed = RecipeScriptSchema.parse(variation);
    assert.equal(parsed.sequence.length, 2); // shared prefix (peel) + new tail (fry)
    assert.equal(parsed.id, `${recipe.id}_variation`);

    const result = runRecipe(variation, entities, actions);
    assert.equal(result.errors.length, 0);
    assert.equal(result.finalInventory.get("potato-1")?.state, "fried");
  });

  test("branching from -1 replaces the whole sequence", () => {
    const recipe = makeRecipe();
    const variation = createVariation(recipe, -1, [
      { actionId: "peel", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
    ]);
    assert.equal(variation.sequence.length, 1);
    assert.equal(variation.sequence[0].actionId, "peel");
  });

  test("throws rather than producing an unrunnable empty-sequence RecipeScript", () => {
    const recipe = makeRecipe();
    assert.throws(() => createVariation(recipe, -1, []), /empty/);
  });
});
