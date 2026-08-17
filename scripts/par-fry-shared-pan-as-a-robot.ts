import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * The PAR_FRY sibling of `shared-pan-heat-as-a-robot.ts`, added 2026-08-17 to
 * close the exact gap that script's own closing note named as still open:
 * "PAR_FRY (same shape, not wired)". Proves `assertPlaceReady`'s merged
 * `fry`/`par_fry` branch (`src/recipe-runner.ts`) picks up `par-fry.json`'s
 * own genuinely different 145-165°C floor — narrower and hotter-starting than
 * `fry.json`'s 120-200°C — rather than accidentally reusing FRY's range: a
 * pan heated only to 130°C (comfortably inside FRY's own band) is still
 * correctly REJECTED for PAR_FRY, and only succeeds once heated to 150°C.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

function makeRecipe(targetTempC: number): RecipeScript {
  return {
    id: `shared-pan-par-fry-${targetTempC}`,
    names: { en: "shared pan par-fry test" },
    initialInventory: [
      { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
      { id: "potato-1", entityId: "potato", state: "peeled", tags: [] },
    ],
    availableTools: ["pan"],
    sequence: [
      {
        actionId: "fill",
        targetInstanceId: "oil-1",
        params: { placeId: "pan-1", toolEntityId: "pan", massKg: "0.3", startTempC: "20" },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "heat_place",
        targetInstanceId: "oil-1",
        params: {
          placeId: "pan-1",
          heatSourceId: "gas",
          targetTempC: String(targetTempC),
          tickSeconds: "15",
        },
        availableIngredientInstanceIds: [],
      },
      {
        actionId: "par_fry",
        targetInstanceId: "potato-1",
        params: { durationSeconds: "180", oilTempC: "150", placeId: "pan-1" },
        availableIngredientInstanceIds: ["oil-1"],
      },
    ],
    metadata: {},
  };
}

for (const targetTempC of [130, 150]) {
  const insideFryOutsideParFry = targetTempC === 130;
  console.log(
    `\n=== PAR_FRY with placeId, oil heated to ${targetTempC}°C` +
      (insideFryOutsideParFry
        ? " (inside FRY's 120-200°C band, below PAR_FRY's 145°C floor)"
        : " (above PAR_FRY's 145°C floor)") +
      " ==="
  );
  const recipe = makeRecipe(targetTempC);
  const result = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
  for (const line of result.log) console.log(`  ${line}`);
  if (result.errors.length > 0) {
    console.log(`  ${result.errors.length} error(s):`);
    for (const { message } of result.errors) console.log(`    ${message}`);
  } else {
    console.log(`  potato-1 final state: ${result.finalInventory.get("potato-1")?.state}`);
  }
}

console.log(
  "\n130°C is REJECTED for PAR_FRY even though it would have been perfectly valid for FRY itself — proof " +
    "assertPlaceReady's merged fry/par_fry branch reads the range off the ACTUAL action running, not a single " +
    "shared oilTempC threshold. 150°C succeeds. Still NOT closed by this script: the placed potato's own " +
    "internal temperature (heat-penetration.ts's separate concern, untouched); no batch-size/thermal-mass " +
    "coupling between a cold potato dropped in and the oil's own tracked temperature (the same gap named by " +
    "fry-egg-as-a-robot.ts and shared-pan-heat-as-a-robot.ts, still open here too)."
);
