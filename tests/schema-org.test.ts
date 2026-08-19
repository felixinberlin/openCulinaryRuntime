import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { compileToSchemaOrgIngredient, compileToSchemaOrgRecipe } from "../src/schema-org.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

describe("compileToSchemaOrgIngredient", () => {
  const potato = makeEntity({ id: "potato", names: { en: "Potato" } });
  const flour = makeEntity({ id: "flour", names: { en: "Flour" } });
  const entities = new Map([
    ["potato", potato],
    ["flour", flour],
  ]);

  test("precise quantity: amount + unit + name", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "precise", amount: 300, unit: "g" },
      "raw",
      entities
    );
    assert.equal(line, "300 g Potato");
  });

  test("precise quantity with unit 'count' omits a unit word", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "precise", amount: 2, unit: "count" },
      "raw",
      entities
    );
    assert.equal(line, "2 Potato");
  });

  test("no quantity: just the name", () => {
    const line = compileToSchemaOrgIngredient(potato, undefined, "raw", entities);
    assert.equal(line, "Potato");
  });

  test("imprecise descriptor other than to_taste: a natural-language prefix", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "imprecise", descriptor: "pinch" },
      "raw",
      entities
    );
    assert.equal(line, "a pinch of Potato");
  });

  test("imprecise to_taste: a trailing suffix, not a prefix", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "imprecise", descriptor: "to_taste" },
      "raw",
      entities
    );
    assert.equal(line, "Potato, to taste");
  });

  test("relative quantity: states the ratio and what it's relative to", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "relative", ratio: 0.02, ofEntityId: "flour", basis: "mass" },
      "raw",
      entities
    );
    assert.equal(line, "Potato (2% of Flour by mass)");
  });

  test("relative quantity with an unresolvable ofEntityId names it rather than guessing", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "relative", ratio: 0.02, ofEntityId: "nonexistent", basis: "mass" },
      "raw",
      entities
    );
    assert.equal(line, "Potato (2% of nonexistent by mass)");
  });

  test("a non-raw state is appended as a trailing preparation note", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "precise", amount: 2, unit: "count" },
      "peeled",
      entities
    );
    assert.equal(line, "2 Potato, peeled");
  });

  test("the generic starting 'raw' state is not appended", () => {
    const line = compileToSchemaOrgIngredient(
      potato,
      { kind: "precise", amount: 2, unit: "count" },
      "raw",
      entities
    );
    assert.equal(line, "2 Potato");
  });
});

describe("compileToSchemaOrgRecipe", () => {
  const potato = makeEntity({ id: "potato", names: { en: "Potato" } });
  const salt = makeEntity({ id: "salt", names: { en: "Salt" } });
  const oil = makeEntity({ id: "oil", names: { en: "Oil" } });
  const pan = makeEntity({ id: "pan", kind: "tool", names: { en: "Frying Pan" } });
  const entities = new Map([
    ["potato", potato],
    ["salt", salt],
    ["oil", oil],
    ["pan", pan],
  ]);
  const fry = makeAction({ id: "fry", names: { en: "Fry" } });
  const season = makeAction({ id: "season", names: { en: "Season" } });
  const actions = new Map([
    ["fry", fry],
    ["season", season],
  ]);

  const recipe: RecipeScript = {
    id: "test_recipe",
    names: { en: "Test Recipe" },
    initialInventory: [
      {
        id: "potato-1",
        entityId: "potato",
        state: "raw",
        tags: [],
        quantity: { kind: "precise", amount: 300, unit: "g" },
      },
      { id: "salt-1", entityId: "salt", state: "raw", tags: [] },
      { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
    ],
    availableTools: ["pan"],
    sequence: [
      {
        actionId: "fry",
        targetInstanceId: "potato-1",
        params: { durationSeconds: "600" },
        availableIngredientInstanceIds: ["oil-1"],
      },
      {
        actionId: "season",
        targetInstanceId: "potato-1",
        params: {},
        availableIngredientInstanceIds: ["salt-1"],
      },
    ],
    metadata: {},
  };

  test("emits @context/@type/name", () => {
    const doc = compileToSchemaOrgRecipe(recipe, entities, actions);
    assert.equal(doc["@context"], "https://schema.org");
    assert.equal(doc["@type"], "Recipe");
    assert.equal(doc.name, "Test Recipe");
  });

  test("recipeIngredient has one lossy string per initialInventory item", () => {
    const doc = compileToSchemaOrgRecipe(recipe, entities, actions);
    assert.deepEqual(doc.recipeIngredient, ["300 g Potato", "Salt", "Oil, cold"]);
  });

  test("recipeInstructions has one HowToStep per sequence step, referencing real entity names", () => {
    const doc = compileToSchemaOrgRecipe(recipe, entities, actions);
    assert.equal(doc.recipeInstructions.length, 2);
    assert.equal(doc.recipeInstructions[0]["@type"], "HowToStep");
    assert.equal(doc.recipeInstructions[0].text, "Fry the Potato using the Oil for 600 seconds.");
    assert.equal(doc.recipeInstructions[1].text, "Season the Potato using the Salt.");
  });

  test("tool is populated from availableTools", () => {
    const doc = compileToSchemaOrgRecipe(recipe, entities, actions);
    assert.deepEqual(doc.tool, ["Frying Pan"]);
  });

  test("tool is omitted (not an empty array) when availableTools is empty", () => {
    const doc = compileToSchemaOrgRecipe({ ...recipe, availableTools: [] }, entities, actions);
    assert.equal(doc.tool, undefined);
  });

  test("an unresolvable entityId falls back to the raw id, not a guess", () => {
    const recipeWithUnknown: RecipeScript = {
      ...recipe,
      initialInventory: [
        { id: "mystery-1", entityId: "mystery_entity", state: "raw", tags: [] },
      ],
    };
    const doc = compileToSchemaOrgRecipe(recipeWithUnknown, entities, actions);
    assert.deepEqual(doc.recipeIngredient, ["mystery_entity"]);
  });

  test("a spawned instance resolves via the optional spawnedEntityIds map", () => {
    const recipeWithSpawn: RecipeScript = {
      ...recipe,
      sequence: [
        ...recipe.sequence,
        { actionId: "season", targetInstanceId: "spawned-1", params: {}, availableIngredientInstanceIds: [] },
      ],
    };
    const spawnedEntityIds = new Map([["spawned-1", "salt"]]);
    const doc = compileToSchemaOrgRecipe(recipeWithSpawn, entities, actions, spawnedEntityIds);
    assert.equal(doc.recipeInstructions[2].text, "Season the Salt.");
  });

  test("a spawned instance without a spawnedEntityIds entry falls back to its raw instance id", () => {
    const recipeWithSpawn: RecipeScript = {
      ...recipe,
      sequence: [
        ...recipe.sequence,
        { actionId: "season", targetInstanceId: "spawned-1", params: {}, availableIngredientInstanceIds: [] },
      ],
    };
    const doc = compileToSchemaOrgRecipe(recipeWithSpawn, entities, actions);
    assert.equal(doc.recipeInstructions[2].text, "Season the spawned-1.");
  });
});
