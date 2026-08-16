import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { runRecipe } from "../src/recipe-runner.ts";
import { makeEntity, makeAction, makeHeatSource } from "./helpers.ts";
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

// ---------------------------------------------------------------------------
// FILL / PLACE_IN / HEAT_PLACE — 2026-08-16, ROADMAP.md's "Heat as a shared,
// time-varying property of a PLACE" entry. See recipe-runner.ts's own top
// doc comment for the full design reasoning; these tests are the concrete,
// synthetic-fixture proof (independent of data/*.json's actual current
// shape) that the mechanism itself behaves correctly.
// ---------------------------------------------------------------------------

const placeWater = makeEntity({
  id: "place-water",
  aggregationState: "liquid",
  capabilities: { isBoilingMedium: true },
  thermophysical: { boilingPointC: 100, specificHeatJPerKgK: 4186 },
});
const placeEgg = makeEntity({
  id: "place-egg",
  capabilities: { isBoilable: true, isSimmerable: true },
});
const placePot = makeEntity({ id: "place-pot", kind: "tool", capabilities: { isDeepVessel: true } });

const fillAction = makeAction({
  id: "fill",
  verb: "FILL",
  requiredTargetCapability: "isBoilingMedium",
  requiredToolCapabilities: ["isDeepVessel"],
  outputs: {},
});
const placeInAction = makeAction({
  id: "place_in",
  verb: "PLACE_IN",
  requiredToolCapabilities: ["isDeepVessel"],
  outputs: {},
  parameters: [
    { id: "placementMethod", required: false, allowedValues: ["dropped", "lowered_by_hand", "lowered_with_spoon"] },
  ],
});
const heatPlaceAction = makeAction({
  id: "heat_place",
  verb: "HEAT_PLACE",
  requiredTargetCapability: "isBoilingMedium",
  requiredToolCapabilities: ["isDeepVessel"],
  outputs: {},
});
const placeBoilAction = makeAction({
  id: "boil",
  verb: "BOIL",
  requiredTargetCapability: "isBoilable",
  requiredIngredientCapabilities: ["isBoilingMedium"],
  outputs: { transformedState: "boiled" },
});
const placeSimmerAction = makeAction({
  id: "simmer",
  verb: "SIMMER",
  requiredTargetCapability: "isSimmerable",
  requiredIngredientCapabilities: ["isBoilingMedium"],
  outputs: { transformedState: "boiled" },
  parameters: [{ id: "waterTempC", required: false, numericRange: { unit: "celsius", min: 85, max: 96 } }],
});

// FRY/oil fixtures (2026-08-16 generalization) — reuse the SAME
// requiredTargetCapability/requiredToolCapabilities strings fillAction/
// heatPlaceAction already declare (fixtures don't need to mirror
// data/entities/*.json's real isPourable/isVessel naming, only be
// internally consistent) so fill/heat_place/place_in work unmodified
// against a genuinely different medium/vessel, the same way the real
// data files were generalized.
const placeOil = makeEntity({
  id: "place-oil",
  aggregationState: "liquid",
  capabilities: { isBoilingMedium: true }, // fixture reuse, see comment above
  thermophysical: { specificHeatJPerKgK: 1970 }, // no boilingPointC — oil never boils
});
const placePan = makeEntity({ id: "place-pan", kind: "tool", capabilities: { isDeepVessel: true } }); // fixture reuse
const placeFryAction = makeAction({
  id: "fry",
  verb: "FRY",
  requiredTargetCapability: "isBoilable", // reuses placeEgg's existing capability
  requiredIngredientCapabilities: ["isBoilingMedium"], // fixture reuse — see placeOil comment
  outputs: { transformedState: "fried" },
  parameters: [{ id: "oilTempC", required: false, numericRange: { unit: "celsius", min: 120, max: 200 } }],
});

const placeEntities = new Map([
  ["place-water", placeWater],
  ["place-egg", placeEgg],
  ["place-pot", placePot],
  ["place-oil", placeOil],
  ["place-pan", placePan],
]);
const placeActions = new Map([
  ["fill", fillAction],
  ["place_in", placeInAction],
  ["heat_place", heatPlaceAction],
  ["boil", placeBoilAction],
  ["simmer", placeSimmerAction],
  ["fry", placeFryAction],
]);
// 1000W at 100% efficiency (helpers.ts's default "ideal" heat source) — 1.2kg
// water, specificHeatJPerKgK 4186: ΔT per 30s tick = (1000*30)/(1.2*4186) ≈ 5.97°C.
const idealHeatSource = new Map([["ideal", makeHeatSource({ id: "ideal" })]]);

function makePlaceRecipe(sequence: RecipeScript["sequence"]): RecipeScript {
  return {
    id: "place-test-recipe",
    names: { en: "Place test recipe" },
    initialInventory: [
      { id: "water-1", entityId: "place-water", state: "cold", tags: [] },
      { id: "egg-1", entityId: "place-egg", state: "raw", tags: [] },
      { id: "egg-2", entityId: "place-egg", state: "raw", tags: [] },
      { id: "oil-1", entityId: "place-oil", state: "cold", tags: [] },
    ],
    availableTools: ["place-pot", "place-pan"],
    sequence,
    metadata: {},
  };
}

describe("runRecipe — FILL/PLACE_IN/HEAT_PLACE", () => {
  test("FILL creates a place; HEAT_PLACE advances it; two PLACE_IN'd instances share the identical resulting temperature", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "1.2", startTempC: "15" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1", placementMethod: "lowered_with_spoon" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "place_in",
        targetInstanceId: "egg-2",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "heat_place",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", heatSourceId: "ideal" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);

    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    const place = result.places.get("pot-1");
    assert.ok(place);
    assert.equal(place!.currentTempC, 100); // clamped at water's boilingPointC
    assert.deepEqual(result.placeContents.get("pot-1"), ["egg-1", "egg-2"]);
  });

  test("FILL into an already-filled place is rejected (pourInto's own mixing-math limit)", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "1.2", startTempC: "15" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "fill",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "0.5", startTempC: "15" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /already contains/);
  });

  test("PLACE_IN into a place that doesn't exist yet is rejected", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /FILL it first/);
  });

  test("HEAT_PLACE against an unknown heatSourceId fails loudly, naming the id", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "1.2", startTempC: "15" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "heat_place",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", heatSourceId: "nonexistent" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /unknown heat source "nonexistent"/);
  });
});

describe("runRecipe — BOIL/SIMMER's opt-in params.placeId readiness check", () => {
  function fillStep(startTempC: string) {
    return {
      actionId: "fill",
      targetInstanceId: "water-1",
      params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "1.2", startTempC },
      availableIngredientInstanceIds: [],
    };
  }
  function heatStep(targetTempC?: string) {
    return {
      actionId: "heat_place",
      targetInstanceId: "water-1",
      params: { placeId: "pot-1", heatSourceId: "ideal", ...(targetTempC ? { targetTempC } : {}) },
      availableIngredientInstanceIds: [],
    };
  }

  test("BOIL with a placeId that's not yet at boiling is REJECTED, even though the plain ingredient-presence check would pass", () => {
    const recipe = makePlaceRecipe([
      fillStep("15"),
      {
        actionId: "boil",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: ["water-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /not yet at 100°C boiling/);
    // The egg must not have silently transitioned despite the rejection.
    assert.equal(result.finalInventory.get("egg-1")?.state, "raw");
  });

  test("BOIL with a placeId that IS at boiling succeeds", () => {
    const recipe = makePlaceRecipe([
      fillStep("15"),
      heatStep(),
      {
        actionId: "boil",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: ["water-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.finalInventory.get("egg-1")?.state, "boiled");
  });

  test("a BOIL step with NO placeId is completely unaffected — pre-existing behavior unchanged", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "boil",
        targetInstanceId: "egg-1",
        params: {},
        availableIngredientInstanceIds: ["water-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.finalInventory.get("egg-1")?.state, "boiled");
  });

  test("SIMMER with a placeId inside its own declared waterTempC band succeeds", () => {
    const recipe = makePlaceRecipe([
      fillStep("15"),
      heatStep("90"), // inside SIMMER's declared 85-96 band
      {
        actionId: "simmer",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: ["water-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.finalInventory.get("egg-1")?.state, "boiled");
  });

  test("SIMMER with a placeId OUTSIDE its own declared waterTempC band is rejected, reading the band off the action's own parameters (not a duplicated constant)", () => {
    const recipe = makePlaceRecipe([
      fillStep("15"),
      heatStep(), // heats all the way to 100°C — above SIMMER's 96°C ceiling
      {
        actionId: "simmer",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: ["water-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /outside SIMMER's own declared 85-96°C band/);
  });

  test("FRY with a placeId that's below FRY's own declared oilTempC minimum is REJECTED, even though the plain ingredient-presence check would pass", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "oil-1",
        params: { placeId: "pan-1", toolEntityId: "place-pan", massKg: "0.3", startTempC: "20" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "fry",
        targetInstanceId: "egg-1",
        params: { oilTempC: "175", placeId: "pan-1" },
        availableIngredientInstanceIds: ["oil-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /below FRY's own declared 120°C minimum/);
    assert.equal(result.finalInventory.get("egg-1")?.state, "raw");
  });

  test("FRY with a placeId that IS at/above FRY's own declared oilTempC minimum succeeds (no boilingPointC involved anywhere — the oil setpoint case, not a phase change)", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "oil-1",
        params: { placeId: "pan-1", toolEntityId: "place-pan", massKg: "0.3", startTempC: "20" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "heat_place",
        targetInstanceId: "oil-1",
        params: { placeId: "pan-1", heatSourceId: "ideal", targetTempC: "175" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "fry",
        targetInstanceId: "egg-1",
        params: { oilTempC: "175", placeId: "pan-1" },
        availableIngredientInstanceIds: ["oil-1"],
      },
    ]);
    const result = runRecipe(recipe, placeEntities, placeActions, new Map(), undefined, idealHeatSource);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.places.get("pan-1")?.currentTempC, 175);
    assert.equal(result.finalInventory.get("egg-1")?.state, "fried");
  });
});
