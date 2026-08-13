import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { RecipeInstanceSchema, RecipeScriptSchema } from "../src/recipe.ts";

describe("RecipeInstanceSchema", () => {
  test("quantity is optional — a recipe instance can still be named with no amount, unchanged from before quantity existed", () => {
    const i = RecipeInstanceSchema.parse({ id: "salt-1", entityId: "salt", state: "dry" });
    assert.equal(i.quantity, undefined);
    assert.deepEqual(i.tags, []);
  });

  test("quantity, when given, is validated as a real QuantitySchema shape (invalid kind rejected here too)", () => {
    const i = RecipeInstanceSchema.parse({
      id: "salt-1",
      entityId: "salt",
      state: "dry",
      quantity: { kind: "imprecise", descriptor: "pinch" },
    });
    assert.deepEqual(i.quantity, { kind: "imprecise", descriptor: "pinch" });

    assert.throws(() =>
      RecipeInstanceSchema.parse({
        id: "salt-1",
        entityId: "salt",
        state: "dry",
        quantity: { kind: "imprecise", descriptor: "a bit" },
      })
    );
  });
});

describe("RecipeScriptSchema", () => {
  const base = {
    id: "test_recipe",
    names: { en: "Test Recipe" },
    initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw" }],
    sequence: [{ actionId: "wash", targetInstanceId: "potato-1" }],
  };

  test("requires at least one initialInventory item and one sequence step", () => {
    assert.doesNotThrow(() => RecipeScriptSchema.parse(base));
    assert.throws(() => RecipeScriptSchema.parse({ ...base, initialInventory: [] }));
    assert.throws(() => RecipeScriptSchema.parse({ ...base, sequence: [] }));
  });

  test("names must include an 'en' entry", () => {
    assert.throws(() => RecipeScriptSchema.parse({ ...base, names: { es: "Receta de Prueba" } }));
  });
});
