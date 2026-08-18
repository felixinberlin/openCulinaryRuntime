import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseCooklang, importCooklangDraft, exportToCooklang } from "../src/cooklang.ts";
import { makeEntity, makeAction } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";

describe("parseCooklang", () => {
  test("extracts metadata lines and strips them from steps", () => {
    const doc = parseCooklang(">> title: Test\n>> servings: 2\n\nDo a thing.");
    assert.deepEqual(doc.metadata, { title: "Test", servings: "2" });
    assert.equal(doc.steps.length, 1);
    assert.equal(doc.steps[0].text, "Do a thing.");
  });

  test("bare single-word ingredient/cookware references, no quantity", () => {
    const doc = parseCooklang("Peel @potato and put it in #bowl.");
    assert.equal(doc.steps.length, 1);
    assert.deepEqual(
      doc.steps[0].ingredients.map((i) => i.token),
      ["potato"]
    );
    assert.equal(doc.steps[0].ingredients[0].quantity, undefined);
    assert.deepEqual(
      doc.steps[0].cookware.map((c) => c.token),
      ["bowl"]
    );
  });

  test("a trailing sentence period is not swallowed into a bare token", () => {
    const doc = parseCooklang("Season with @salt.");
    assert.equal(doc.steps[0].ingredients[0].token, "salt");
  });

  test("braced quantity with unit", () => {
    const doc = parseCooklang("Add @flour{200%g} to the bowl.");
    const ref = doc.steps[0].ingredients[0];
    assert.equal(ref.token, "flour");
    assert.deepEqual(ref.quantity, { raw: "200", amount: 200, unit: "g" });
    assert.equal(ref.spiceLock, false);
  });

  test("multi-word ingredient name requires the braced form", () => {
    const doc = parseCooklang("Add @olive oil{50%ml} to the pan.");
    assert.equal(doc.steps[0].ingredients[0].token, "olive oil");
  });

  test("a stray later brace does not get absorbed by an earlier bare token", () => {
    const doc = parseCooklang("Add @salt and cook for ~{5%minutes}.");
    assert.equal(doc.steps[0].ingredients[0].token, "salt");
    assert.equal(doc.steps[0].ingredients[0].quantity, undefined);
    assert.equal(doc.steps[0].timers.length, 1);
    assert.equal(doc.steps[0].timers[0].quantity.amount, 5);
  });

  test("spice-lock `=` prefix is recorded and stripped from the parsed amount", () => {
    const doc = parseCooklang("Add @salt{=1%tsp}.");
    const ref = doc.steps[0].ingredients[0];
    assert.equal(ref.spiceLock, true);
    assert.equal(ref.quantity?.amount, 1);
    assert.equal(ref.quantity?.raw, "=1");
  });

  test("named and unnamed timers", () => {
    const doc = parseCooklang("Rest for ~rest{10%minutes} then serve ~{2%minutes}.");
    assert.equal(doc.steps[0].timers.length, 2);
    assert.equal(doc.steps[0].timers[0].name, "rest");
    assert.equal(doc.steps[0].timers[1].name, undefined);
  });

  test("line comments are stripped, block comments spanning lines are stripped", () => {
    const doc = parseCooklang(
      "Peel @potato. -- a line comment\n[- a block\ncomment spanning lines -]\nCut it."
    );
    assert.equal(doc.steps.length, 2);
    assert.equal(doc.steps[0].text, "Peel @potato.");
    assert.equal(doc.steps[1].text, "Cut it.");
  });

  test("section headings attach to the steps that follow them", () => {
    const doc = parseCooklang("= Prep =\nPeel @potato.\n\n= Cook =\nFry it.");
    assert.equal(doc.steps[0].section, "Prep");
    assert.equal(doc.steps[1].section, "Cook");
  });

  test("a blank-line-separated paragraph is one step, even across multiple lines", () => {
    const doc = parseCooklang("Peel @potato\nand cut it into pieces.\n\nFry it.");
    assert.equal(doc.steps.length, 2);
    assert.equal(doc.steps[0].text, "Peel @potato and cut it into pieces.");
  });
});

describe("importCooklangDraft", () => {
  const potato = makeEntity({
    id: "potato",
    cooklang: { canonicalToken: "patata", spiceLock: false },
  });
  const salt = makeEntity({ id: "salt", cooklang: { canonicalToken: "sal", spiceLock: true } });
  const entities = new Map([
    ["potato", potato],
    ["salt", salt],
  ]);

  test("resolves tokens against Entity.cooklang.canonicalToken, case/whitespace-insensitively", () => {
    const draft = importCooklangDraft(
      "Peel @Patata{2%count} and season with @SAL{=1%tsp}.",
      entities
    );
    assert.deepEqual(draft.resolvedIngredients.map((r) => r.entityId).sort(), ["potato", "salt"]);
    assert.deepEqual(draft.unresolvedTokens, []);
  });

  test("names unresolved tokens rather than silently dropping them", () => {
    const draft = importCooklangDraft("Add @some_unknown_thing{1%count}.", entities);
    assert.deepEqual(draft.unresolvedTokens, ["some_unknown_thing"]);
    assert.equal(draft.resolvedIngredients.length, 0);
    assert.equal(draft.proposedInventory.length, 0);
  });

  test("proposed inventory carries a real quantity when the unit maps to QuantitySchema's enum", () => {
    const draft = importCooklangDraft("Add @patata{2%count}.", entities);
    assert.deepEqual(draft.proposedInventory[0].quantity, {
      kind: "precise",
      amount: 2,
      unit: "count",
    });
    assert.equal(draft.proposedInventory[0].state, "raw");
  });

  test("an unmapped unit leaves quantity unset rather than guessing", () => {
    const draft = importCooklangDraft("Add @patata{2%bunches}.", entities);
    assert.equal(draft.proposedInventory[0].quantity, undefined);
  });

  test("a token seen twice is only proposed once, using its first occurrence", () => {
    const draft = importCooklangDraft("Add @patata{2%count}. Later, use @patata again.", entities);
    assert.equal(draft.proposedInventory.length, 1);
  });
});

describe("exportToCooklang", () => {
  const potato = makeEntity({
    id: "potato",
    cooklang: { canonicalToken: "patata", spiceLock: false },
  });
  const salt = makeEntity({ id: "salt", cooklang: { canonicalToken: "sal", spiceLock: true } });
  const oil = makeEntity({ id: "oil" }); // no cooklang field — falls back to entity id
  const entities = new Map([
    ["potato", potato],
    ["salt", salt],
    ["oil", oil],
  ]);
  const fry = makeAction({ id: "fry", names: { en: "Fry" } });
  const salt_action = makeAction({ id: "season", names: { en: "Salt" } });
  const actions = new Map([
    ["fry", fry],
    ["season", salt_action],
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
    availableTools: [],
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

  test("emits a title metadata line and one line per step", () => {
    const text = exportToCooklang(recipe, entities, actions);
    assert.match(text, /^>> title: Test Recipe/);
    assert.match(text, /Fry @patata\{300%g\}/);
  });

  test("only the first mention of an instance carries its quantity", () => {
    const text = exportToCooklang(recipe, entities, actions);
    const fryLine = text.split("\n").find((l) => l.startsWith("Fry"))!;
    assert.match(fryLine, /@patata\{300%g\}/);
  });

  test("an entity with no cooklang field falls back to its bare entity id", () => {
    const text = exportToCooklang(recipe, entities, actions);
    assert.match(text, /@oil\b/);
  });

  test("spiceLock entities re-export with the `=` prefix", () => {
    const recipeWithSaltQty: RecipeScript = {
      ...recipe,
      initialInventory: recipe.initialInventory.map((i) =>
        i.id === "salt-1"
          ? { ...i, quantity: { kind: "precise" as const, amount: 1, unit: "tsp" as const } }
          : i
      ),
    };
    const text = exportToCooklang(recipeWithSaltQty, entities, actions);
    assert.match(text, /@sal\{=1%tsp\}/);
  });

  test("round-trips: exported text re-parses and re-resolves to the same entities", () => {
    const text = exportToCooklang(recipe, entities, actions);
    const draft = importCooklangDraft(text, entities);
    assert.deepEqual(draft.resolvedIngredients.map((r) => r.entityId).sort(), [
      "oil",
      "potato",
      "salt",
    ]);
    assert.deepEqual(draft.unresolvedTokens, []);
  });

  test("a spawned instance (not in initialInventory) resolves via the optional spawnedEntityIds map", () => {
    const recipeWithSpawn: RecipeScript = {
      ...recipe,
      sequence: [
        ...recipe.sequence,
        {
          actionId: "season",
          targetInstanceId: "spawned-1",
          params: {},
          availableIngredientInstanceIds: [],
        },
      ],
    };
    const spawnedEntityIds = new Map([["spawned-1", "salt"]]);
    const text = exportToCooklang(recipeWithSpawn, entities, actions, spawnedEntityIds);
    assert.match(text, /Salt @sal/);
  });

  test("a spawned instance without a spawnedEntityIds entry falls back to its raw instance id, not a guess", () => {
    const recipeWithSpawn: RecipeScript = {
      ...recipe,
      sequence: [
        ...recipe.sequence,
        {
          actionId: "season",
          targetInstanceId: "spawned-1",
          params: {},
          availableIngredientInstanceIds: [],
        },
      ],
    };
    const text = exportToCooklang(recipeWithSpawn, entities, actions);
    assert.match(text, /Salt spawned-1/);
  });
});
