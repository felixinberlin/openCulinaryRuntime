import { join } from "node:path";
import { loadEntities, loadActions, loadRecipes, loadHeatSources } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * First end-to-end proof for data/actions/remove.json, added 2026-08-16
 * alongside it — the direct closure of garlic-oil-potatoes.json's own
 * removalNote. data/recipes/garlic-oil-potatoes-shared-pan.json (`npm run
 * recipe -- garlic_oil_potatoes_shared_pan`) already proves the SUCCESS
 * path end-to-end; this script proves the two REJECTION paths a successful
 * recipe run can't demonstrate — a real, catchable authoring mistake, not
 * a silent no-op.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

console.log("Goal: prove REMOVE's rejection paths, not just its success path.\n");

// ---------------------------------------------------------------------
// 1. The real, working recipe — reused here for the actual log line,
//    not re-derived, to keep this script and that recipe as one source
//    of truth for the success case.
// ---------------------------------------------------------------------
const workingRecipe = recipes.get("garlic_oil_potatoes_shared_pan")!;
const workingResult = runRecipe(
  workingRecipe,
  entities,
  actions,
  new Map(),
  undefined,
  heatSources
);
const removeLine = workingResult.log.find((l) => l.startsWith("REMOVE"));
console.log(`1. Real recipe's REMOVE line: "${removeLine}"`);
console.log(
  `   placeContents["pan-1"] after the full run: [${workingResult.placeContents.get("pan-1")?.join(", ") || "nothing"}]\n`
);

// ---------------------------------------------------------------------
// 2. REMOVE something that was NEVER placed anywhere — correctly
//    rejected, not a silent no-op.
// ---------------------------------------------------------------------
const neverPlacedRecipe: RecipeScript = {
  ...workingRecipe,
  id: "test-never-placed",
  sequence: [
    {
      actionId: "fill",
      targetInstanceId: "oil-1",
      params: { placeId: "pan-1", toolEntityId: "pan", massKg: "0.3", startTempC: "20" },
      availableIngredientInstanceIds: [],
    },
    {
      actionId: "remove",
      targetInstanceId: "potato-1",
      params: { placeId: "pan-1", removalMethod: "tongs" },
      availableIngredientInstanceIds: [],
    },
  ],
};
const neverPlacedResult = runRecipe(
  neverPlacedRecipe,
  entities,
  actions,
  new Map(),
  undefined,
  heatSources
);
console.log(`2. REMOVE on a never-placed instance: ${neverPlacedResult.errors.length} error(s)`);
console.log(`   "${neverPlacedResult.errors[0]?.message}"\n`);

// ---------------------------------------------------------------------
// 3. REMOVE something TWICE — the second attempt correctly rejected
//    (retrySafe: true because it fails LOUDLY, not because it's a
//    silent no-op — see remove.json's own retrySafeNote).
// ---------------------------------------------------------------------
const removedTwiceRecipe: RecipeScript = {
  ...workingRecipe,
  id: "test-removed-twice",
  sequence: [
    {
      actionId: "fill",
      targetInstanceId: "oil-1",
      params: { placeId: "pan-1", toolEntityId: "pan", massKg: "0.3", startTempC: "20" },
      availableIngredientInstanceIds: [],
    },
    {
      actionId: "place_in",
      targetInstanceId: "garlic-1",
      params: { placeId: "pan-1" },
      availableIngredientInstanceIds: [],
    },
    {
      actionId: "remove",
      targetInstanceId: "garlic-1",
      params: { placeId: "pan-1" },
      availableIngredientInstanceIds: [],
    },
    {
      actionId: "remove",
      targetInstanceId: "garlic-1",
      params: { placeId: "pan-1" },
      availableIngredientInstanceIds: [],
    },
  ],
};
const removedTwiceResult = runRecipe(
  removedTwiceRecipe,
  entities,
  actions,
  new Map(),
  undefined,
  heatSources
);
console.log(`3. REMOVE the same instance twice: ${removedTwiceResult.errors.length} error(s)`);
console.log(`   "${removedTwiceResult.errors[0]?.message}"`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no idle-time-causes-burning " +
    "simulation exists (remove.json's own idleTimeScopeNote) — REMOVE proves an instance CAN leave a place's " +
    "shared heat, not that staying too long has any modeled consequence."
);
