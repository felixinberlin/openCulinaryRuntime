import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { buildRecipeScaffold } from "../src/recipe-scaffold.ts";
import { makeEntity } from "./helpers.ts";

describe("buildRecipeScaffold", () => {
  const potato = makeEntity({
    id: "potato",
    possibleStates: ["raw", "peeled"],
    capabilities: { isFryable: true },
  });
  const oil = makeEntity({
    id: "oil",
    possibleStates: ["cold", "hot"],
    capabilities: { isFryingMedium: true },
  });
  const entities = new Map([
    ["potato", potato],
    ["oil", oil],
  ]);

  test("derives id and names.en from the slug, same convention every data/recipes/*.json file uses", () => {
    const scaffold = buildRecipeScaffold(
      { slug: "quick-fried-potatoes", entityIds: ["potato"] },
      entities
    );
    assert.equal(scaffold.id, "quick_fried_potatoes");
    assert.equal(scaffold.names.en, "Quick Fried Potatoes");
  });

  test("initialInventory uses each entity's real first possibleStates value as the starting state", () => {
    const scaffold = buildRecipeScaffold({ slug: "test", entityIds: ["potato", "oil"] }, entities);
    assert.deepEqual(scaffold.initialInventory, [
      { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
      { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
    ]);
  });

  test("numbers instance ids PER ENTITY TYPE, not with one shared global counter (regression)", () => {
    // The real bug this file's own manual check caught: a naive global
    // index would produce "oil-2" for the second entity regardless of
    // type. Every real data/recipes/*.json file numbers per-type
    // (egg-1, oil-1, salt-1 all independently start at 1).
    const scaffold = buildRecipeScaffold(
      { slug: "test", entityIds: ["potato", "oil", "potato"] },
      entities
    );
    assert.deepEqual(
      scaffold.initialInventory.map((i) => i.id),
      ["potato-1", "oil-1", "potato-2"]
    );
  });

  test("sequence and availableTools are intentionally empty — a scaffold, not a valid recipe", () => {
    const scaffold = buildRecipeScaffold({ slug: "test", entityIds: ["potato"] }, entities);
    assert.deepEqual(scaffold.sequence, []);
    assert.deepEqual(scaffold.availableTools, []);
  });

  test("throws on an unknown entity id rather than producing a silently-broken scaffold", () => {
    assert.throws(
      () => buildRecipeScaffold({ slug: "test", entityIds: ["potatoo"] }, entities),
      /unknown entity id "potatoo"/
    );
  });

  test("throws when given zero entity ids (RecipeScriptSchema requires initialInventory.min(1))", () => {
    assert.throws(
      () => buildRecipeScaffold({ slug: "test", entityIds: [] }, entities),
      /at least one entity id is required/
    );
  });
});
