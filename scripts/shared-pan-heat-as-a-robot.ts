import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * The FRY/oil sibling of `shared-pot-heat-as-a-robot.ts`, added 2026-08-16
 * the same day, once `fill.json`/`heat_place.json`/`place_in.json` were
 * generalized from `isBoilingMedium`/`isDeepVessel` (water-only) to
 * `isPourable`/`isVessel` (any medium/any real vessel) — see `fill.json`'s
 * own `scopeNote`. Proves the exact FRY-side analog of `assertPlaceReady`'s
 * `boil` check: a `fry` step that sets `params.placeId` is REJECTED when
 * the place isn't actually hot enough yet (reading the real minimum off
 * `fry.json`'s own declared `oilTempC` numericRange, not a duplicated
 * constant), and succeeds once `HEAT_PLACE` has actually gotten there.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

function makeRecipe(heatOilFirst: boolean): RecipeScript {
  return {
    id: heatOilFirst ? "shared-pan-heated" : "shared-pan-cold",
    names: { en: "shared pan test" },
    initialInventory: [
      { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
      { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
    ],
    availableTools: ["pan"],
    sequence: [
      {
        actionId: "fill",
        targetInstanceId: "oil-1",
        params: { placeId: "pan-1", toolEntityId: "pan", massKg: "0.3", startTempC: "20" },
        availableIngredientInstanceIds: [],
      },
      ...(heatOilFirst
        ? [
            {
              actionId: "heat_place",
              targetInstanceId: "oil-1",
              params: { placeId: "pan-1", heatSourceId: "gas", targetTempC: "175", tickSeconds: "15" },
              availableIngredientInstanceIds: [],
            },
          ]
        : []),
      {
        actionId: "fry",
        targetInstanceId: "egg-1",
        params: { durationSeconds: "90", yolkDoneness: "runny", oilTempC: "175", placeId: "pan-1" },
        availableIngredientInstanceIds: ["oil-1"],
      },
    ],
    metadata: {},
  };
}

for (const heatOilFirst of [false, true]) {
  console.log(`\n=== FRY with placeId, oil ${heatOilFirst ? "HEATED first" : "still cold"} ===`);
  const recipe = makeRecipe(heatOilFirst);
  const result = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
  for (const line of result.log) console.log(`  ${line}`);
  if (result.errors.length > 0) {
    console.log(`  ${result.errors.length} error(s):`);
    for (const { message } of result.errors) console.log(`    ${message}`);
  } else {
    console.log(`  egg-1 final state: ${result.finalInventory.get("egg-1")?.state}`);
  }
}

console.log(
  "\nThe cold-oil run is REJECTED at the FRY step itself, even though oil-1 is genuinely present and " +
    "isFryingMedium (the pre-existing availableIngredientInstanceIds presence check alone would have let it " +
    "through) — the new params.placeId check catches what that older, weaker check structurally cannot: " +
    "PRESENCE of a frying medium is not the same fact as that medium ACTUALLY being hot enough."
);

console.log(
  "\nStill NOT closed by this script: PAR_FRY (same shape, not wired); the placed egg's own internal " +
    "temperature (heat-penetration.ts's separate, potato-only concern); no batch-size/thermal-mass coupling " +
    "between a cold egg dropped in and the oil's own tracked temperature (fry-egg-as-a-robot.ts's own closing " +
    "note names this same gap — still open)."
);
