import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { runRecipe, runRecipeFromIntent } from "../src/recipe-runner.ts";
import { makeEntity, makeAction, makeHeatSource } from "./helpers.ts";
import type { RecipeScript } from "../src/recipe.ts";
import type { RecipeIntent } from "../src/recipe.ts";

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
      sequence: [
        {
          actionId: "fry",
          targetInstanceId: "potato-99",
          params: {},
          availableIngredientInstanceIds: [],
        },
      ],
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
const placePot = makeEntity({
  id: "place-pot",
  kind: "tool",
  capabilities: { isDeepVessel: true },
});

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
    {
      id: "placementMethod",
      required: false,
      allowedValues: ["dropped", "lowered_by_hand", "lowered_with_spoon"],
    },
  ],
});
const heatPlaceAction = makeAction({
  id: "heat_place",
  verb: "HEAT_PLACE",
  requiredTargetCapability: "isBoilingMedium",
  requiredToolCapabilities: ["isDeepVessel"],
  outputs: {},
});
const removeAction = makeAction({
  id: "remove",
  verb: "REMOVE",
  outputs: {},
  parameters: [
    {
      id: "removalMethod",
      required: false,
      allowedValues: ["slotted_spoon", "tongs", "strainer_drain", "poured_out"],
    },
  ],
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
  parameters: [
    { id: "waterTempC", required: false, numericRange: { unit: "celsius", min: 85, max: 96 } },
  ],
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
const placePan = makeEntity({
  id: "place-pan",
  kind: "tool",
  capabilities: { isDeepVessel: true },
}); // fixture reuse
const placeFryAction = makeAction({
  id: "fry",
  verb: "FRY",
  requiredTargetCapability: "isBoilable", // reuses placeEgg's existing capability
  requiredIngredientCapabilities: ["isBoilingMedium"], // fixture reuse — see placeOil comment
  outputs: { transformedState: "fried" },
  parameters: [
    { id: "oilTempC", required: false, numericRange: { unit: "celsius", min: 120, max: 200 } },
  ],
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
  ["remove", removeAction],
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );

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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /unknown heat source "nonexistent"/);
  });
});

// REMOVE — 2026-08-16, ROADMAP.md's "no verb for physically removing
// something from a shared vessel" gap, closing garlic-oil-potatoes.json's
// own removalNote.
describe("runRecipe — REMOVE", () => {
  function filledPotRecipe(sequence: RecipeScript["sequence"]) {
    return makePlaceRecipe([
      {
        actionId: "fill",
        targetInstanceId: "water-1",
        params: { placeId: "pot-1", toolEntityId: "place-pot", massKg: "1.2", startTempC: "15" },
        availableIngredientInstanceIds: [],
      },
      ...sequence,
    ]);
  }

  test("removes a placed instance from placeContents, leaving co-located instances behind", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "place_in",
        targetInstanceId: "egg-2",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1", removalMethod: "tongs" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.deepEqual(result.placeContents.get("pot-1"), ["egg-2"]);
  });

  test("removing the only occupant leaves an empty (not missing) placeContents entry", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.deepEqual(result.placeContents.get("pot-1"), []);
  });

  test("rejected against a place that doesn't exist yet — same error shape as PLACE_IN's", () => {
    const recipe = makePlaceRecipe([
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /FILL it first/);
  });

  test("rejected for an instance that was never PLACE_IN'd — a real authoring mistake, not a silent no-op", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /not currently there/);
  });

  test("rejected the SECOND time on the same instance — retrySafe: true means fails loudly, not that it's idempotent", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /not currently there/);
  });

  test("an unrecognized removalMethod value is rejected, same validation as placementMethod's", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1", removalMethod: "bare_hands" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0].message, /removalMethod: bare_hands/);
  });

  test("does not transform the removed instance's own state/tags — bookkeeping only, same as PLACE_IN", () => {
    const recipe = filledPotRecipe([
      {
        actionId: "place_in",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "remove",
        targetInstanceId: "egg-1",
        params: { placeId: "pot-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.finalInventory.get("egg-1")?.state, "raw");
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
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
    const result = runRecipe(
      recipe,
      placeEntities,
      placeActions,
      new Map(),
      undefined,
      idealHeatSource
    );
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.places.get("pan-1")?.currentTempC, 175);
    assert.equal(result.finalInventory.get("egg-1")?.state, "fried");
  });
});

// spawnedEntityIds — 2026-08-16, PAPER_NOTES_2608.04768.md TICKET 2. Added
// so recipe-explain.ts can resolve a step targeting a spawned instance with
// real ground truth instead of silently skipping it — see that file's own
// executionBounds tests for the actual consumer.
describe("runRecipe — spawnedEntityIds", () => {
  const potato = makeEntity({
    id: "potato",
    capabilities: { isPeelable: true },
    producedByproducts: ["potato_peel"],
  });
  const potatoPeel = makeEntity({ id: "potato_peel" });
  const peel = makeAction({
    id: "peel",
    requiredTargetCapability: "isPeelable",
    outputs: { transformedState: "peeled", spawnsTargetByproducts: true },
  });
  const entities = new Map([
    ["potato", potato],
    ["potato_peel", potatoPeel],
  ]);
  const actions = new Map([["peel", peel]]);

  test("records every spawned instance id's entity id, even ones later destroyed", () => {
    const combine = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "mash" },
    });
    const mash = makeEntity({ id: "mash" });
    const potatoPeelCombinable = makeEntity({
      id: "potato_peel",
      capabilities: { isCombinable: true },
    });
    const allEntities = new Map([
      ["potato", potato],
      ["potato_peel", potatoPeelCombinable],
      ["mash", mash],
    ]);
    const allActions = new Map([
      ["peel", peel],
      ["combine", combine],
    ]);
    const recipe: RecipeScript = {
      id: "spawn-test",
      names: { en: "Spawn test" },
      initialInventory: [
        { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
        { id: "other-1", entityId: "potato", state: "raw", tags: [] },
      ],
      availableTools: [],
      sequence: [
        {
          actionId: "peel",
          targetInstanceId: "potato-1",
          params: {},
          availableIngredientInstanceIds: [],
        },
        // Consumes potato_peel-1 into a combined "mash" instance — it will
        // no longer be in finalInventory, but spawnedEntityIds must still
        // remember it existed and what entity it was.
        {
          actionId: "combine",
          targetInstanceId: "other-1",
          params: {},
          availableIngredientInstanceIds: [],
          secondaryInstanceId: "potato_peel-1",
        },
      ],
      metadata: {},
    };
    const result = runRecipe(recipe, allEntities, allActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    // potato_peel-1 was consumed by COMBINE — gone from finalInventory...
    assert.equal(result.finalInventory.has("potato_peel-1"), false);
    // ...but spawnedEntityIds still has it, with its real entity id.
    assert.equal(result.spawnedEntityIds.get("potato_peel-1"), "potato_peel");
    // The COMBINE output itself is also recorded.
    assert.equal(result.spawnedEntityIds.get("mash-2"), "mash");
  });

  test("a recipe that never spawns anything has an empty spawnedEntityIds map", () => {
    const recipe: RecipeScript = {
      id: "no-spawn-test",
      names: { en: "No spawn test" },
      initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
      availableTools: [],
      sequence: [],
      metadata: {},
    };
    const result = runRecipe(recipe, entities, actions);
    assert.equal(result.spawnedEntityIds.size, 0);
  });
});

// ---------------------------------------------------------------------------
// TOOL HYGIENE / CROSS-CONTAMINATION — 2026-08-16, ROADMAP.md's
// "Cross-contamination / hygiene knowledge" gap. See recipe-runner.ts's own
// top doc comment / src/tool-hygiene.ts for the full design reasoning; these
// are the concrete, synthetic-fixture proof (independent of data/*.json's
// actual current shape) that the mechanism itself behaves correctly.
// ---------------------------------------------------------------------------

const hygieneEgg = makeEntity({
  id: "hygiene-egg",
  rawContaminationRiskStates: ["raw"],
  capabilities: { isCrackable: true, isRawContaminationRisk: true },
});
const hygieneGarlic = makeEntity({
  id: "hygiene-garlic",
  possibleStates: ["raw", "peeled", "cut"],
  capabilities: { isChoppable: true },
});
const crackAction = makeAction({
  id: "crack",
  verb: "CRACK",
  requiredTargetCapability: "isCrackable",
  outputs: { destroysTarget: true },
  parameters: [{ id: "toolInstanceId", required: false, allowedValues: ["knife-1", "knife-2"] }],
});
const hygieneCutAction = makeAction({
  id: "cut",
  verb: "CUT",
  requiredTargetCapability: "isChoppable",
  outputs: { transformedState: "cut" },
  parameters: [{ id: "toolInstanceId", required: false, allowedValues: ["knife-1", "knife-2"] }],
});
const washToolAction = makeAction({
  id: "wash_tool",
  verb: "WASH_TOOL",
  outputs: {},
  parameters: [{ id: "toolInstanceId", required: true, allowedValues: ["knife-1", "knife-2"] }],
});
const hygieneEntities = new Map([
  ["hygiene-egg", hygieneEgg],
  ["hygiene-garlic", hygieneGarlic],
]);
const hygieneActions = new Map([
  ["crack", crackAction],
  ["cut", hygieneCutAction],
  ["wash_tool", washToolAction],
]);

function makeHygieneRecipe(sequence: RecipeScript["sequence"]): RecipeScript {
  return {
    id: "hygiene-test-recipe",
    names: { en: "Hygiene test recipe" },
    initialInventory: [
      { id: "egg-1", entityId: "hygiene-egg", state: "raw", tags: [] },
      { id: "garlic-1", entityId: "hygiene-garlic", state: "peeled", tags: [] },
    ],
    availableTools: [],
    sequence,
    metadata: {},
  };
}

describe("runRecipe — tool hygiene / cross-contamination", () => {
  test("a step with no toolInstanceId is completely unaffected — toolContamination stays empty", () => {
    const recipe = makeHygieneRecipe([
      {
        actionId: "crack",
        targetInstanceId: "egg-1",
        params: {},
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, hygieneEntities, hygieneActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.toolContamination.size, 0);
  });

  test("contact with a raw-contamination-risk instance marks the named tool instance contaminated", () => {
    const recipe = makeHygieneRecipe([
      {
        actionId: "crack",
        targetInstanceId: "egg-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, hygieneEntities, hygieneActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    const state = result.toolContamination.get("knife-1");
    assert.equal(state?.contaminated, true);
    assert.equal(state?.contaminatedByEntityId, "hygiene-egg");
    assert.equal(state?.contaminatedByState, "raw");
  });

  test("reusing a contaminated tool instance warns, but does NOT reject the step (advisory, per explicit design decision)", () => {
    const recipe = makeHygieneRecipe([
      {
        actionId: "crack",
        targetInstanceId: "egg-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "cut",
        targetInstanceId: "garlic-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, hygieneEntities, hygieneActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /reuses "knife-1" without washing it first/);
    // The step still ran and mutated the target normally.
    assert.equal(result.finalInventory.get("garlic-1")?.state, "cut");
  });

  test("WASH_TOOL clears contamination — a subsequent reuse warns no more", () => {
    const recipe = makeHygieneRecipe([
      {
        actionId: "crack",
        targetInstanceId: "egg-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "wash_tool",
        targetInstanceId: "knife-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "cut",
        targetInstanceId: "garlic-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, hygieneEntities, hygieneActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.warnings.length, 0);
    assert.equal(result.toolContamination.get("knife-1")?.contaminated, false);
  });

  test("a different, never-contaminated tool instance is unaffected by another instance's contamination", () => {
    const recipe = makeHygieneRecipe([
      {
        actionId: "crack",
        targetInstanceId: "egg-1",
        params: { toolInstanceId: "knife-1" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "cut",
        targetInstanceId: "garlic-1",
        params: { toolInstanceId: "knife-2" },
        availableIngredientInstanceIds: [],
      },
    ]);
    const result = runRecipe(recipe, hygieneEntities, hygieneActions);
    assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
    assert.equal(result.warnings.length, 0);
    assert.equal(result.toolContamination.get("knife-2")?.contaminated, false);
  });
});

// runRecipeFromIntent — 2026-08-17, ROADMAP.md's "actual planner" gap 4
// (closed-loop replanning). `runRecipe` above is completely untouched and
// re-tested unchanged throughout this whole file — these are new,
// additive tests for the new function only.
describe("runRecipeFromIntent — closed-loop replanning", () => {
  // Two genuinely different real routes to the same goal, needing
  // DIFFERENT tools — the synthetic forcing case a real forcing case in
  // this repo's actual data doesn't currently have (every real cutting/
  // peeling verb needs a knife with no substitute — see this test file's
  // own home in LEARNINGS_ENGINE.md 2026-08-17 for why this is synthetic,
  // not real-data, on purpose).
  const widget = makeEntity({
    id: "widget",
    allowedTransformations: ["make_with_a", "make_with_b"],
  });
  const makeWithA = makeAction({
    id: "make_with_a",
    requiredTools: ["toolA"],
    outputs: { transformedState: "done" },
  });
  const makeWithB = makeAction({
    id: "make_with_b",
    requiredTools: ["toolB"],
    outputs: { transformedState: "done" },
  });
  const entities = new Map([["widget", widget]]);
  const actions = new Map([
    ["make_with_a", makeWithA],
    ["make_with_b", makeWithB],
  ]);

  function makeIntent(availableTools: string[]): RecipeIntent {
    return {
      id: "widget-intent",
      names: { en: "test" },
      initialInventory: [{ id: "widget-1", entityId: "widget", state: "raw", tags: [] }],
      availableTools,
      goals: [{ instanceId: "widget-1", state: "done", requiredTags: [] }],
      metadata: {},
    };
  }

  test("plans and runs cleanly with ZERO replans when the execution world matches the plan", () => {
    const intent = makeIntent(["toolA", "toolB"]);
    const outcome = runRecipeFromIntent(intent, entities, actions);
    assert.equal(outcome.planned, true);
    if (outcome.planned) {
      assert.equal(outcome.result.errors.length, 0);
      assert.equal(outcome.result.replans.length, 0);
      assert.equal(outcome.result.finalInventory.get("widget-1")?.state, "done");
    }
  });

  test("a missing tool at EXECUTION time (planned with toolA, actually only toolB on hand) triggers a real replan that succeeds", () => {
    const intent = makeIntent(["toolA", "toolB"]); // planIntent picks make_with_a (declared first)
    const outcome = runRecipeFromIntent(
      intent,
      entities,
      actions,
      new Map(),
      undefined,
      new Set(["toolB"]) // toolA is missing at EXECUTION time
    );
    assert.equal(outcome.planned, true);
    if (outcome.planned) {
      assert.equal(outcome.result.errors.length, 0, JSON.stringify(outcome.result.errors));
      assert.deepEqual(outcome.result.replans, [{ goalIndex: 0, succeeded: true }]);
      assert.equal(outcome.result.finalInventory.get("widget-1")?.state, "done");
      assert.deepEqual(
        outcome.result.executedSequence.map((s) => s.actionId),
        ["make_with_b"]
      );
    }
  });

  test("a goal with NO alternative route reports a real, final failure — not a silent success or an infinite retry", () => {
    const intent = makeIntent(["toolA"]); // only route is make_with_a
    const outcome = runRecipeFromIntent(
      intent,
      entities,
      actions,
      new Map(),
      undefined,
      new Set() // toolA missing, and there is no toolB either — genuinely stuck
    );
    assert.equal(outcome.planned, true);
    if (outcome.planned) {
      assert.equal(outcome.result.errors.length, 1);
      assert.deepEqual(outcome.result.replans, [
        { goalIndex: 0, succeeded: false, reason: "no alternative path found from the current state" },
      ]);
    }
  });

  test("a combine goal is rejected up front, honestly, not silently mishandled", () => {
    const intent: RecipeIntent = {
      id: "combo-intent",
      names: { en: "test" },
      initialInventory: [
        { id: "widget-1", entityId: "widget", state: "raw", tags: [] },
        { id: "widget-2", entityId: "widget", state: "raw", tags: [] },
      ],
      availableTools: [],
      goals: [
        {
          instanceId: "widget-1",
          requiredTags: [],
          combine: { actionId: "combine", secondaryInstanceId: "widget-2", secondaryDesiredTags: [] },
        },
      ],
      metadata: {},
    };
    const outcome = runRecipeFromIntent(intent, entities, actions);
    assert.equal(outcome.planned, false);
    if (!outcome.planned) {
      assert.match(outcome.failures[0].reason, /scoped to single-instance goals only/);
    }
  });

  test("the replannedGoals guard fires exactly once per goal — replans array never grows past one entry for a single goal, even when that one replan attempt itself fails", () => {
    // Neither tool available at all: the first (and, per the guard, ONLY)
    // replan attempt also finds no route — this exercises the SAME guard
    // that stops a genuinely recoverable goal from being retried forever,
    // just on a fixture where the one attempt happens to fail too (see
    // this describe block's own top comment for why constructing a
    // "succeeds once, fails again later" case isn't possible without an
    // artificial inconsistency between planning and execution — the two
    // are consistent by construction whenever they read the same
    // available-tools set, which they always do here).
    const intent = makeIntent(["toolA", "toolB"]);
    const outcome = runRecipeFromIntent(intent, entities, actions, new Map(), undefined, new Set());
    assert.equal(outcome.planned, true);
    if (outcome.planned) {
      assert.equal(outcome.result.replans.length, 1); // exactly one attempt, not repeated
      assert.equal(outcome.result.errors.length, 1);
    }
  });
});
