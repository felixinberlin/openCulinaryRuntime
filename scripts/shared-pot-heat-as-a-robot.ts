import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * Capability test for src/recipe-runner.ts's FILL/PLACE_IN/HEAT_PLACE
 * handling (added 2026-08-16), closing ROADMAP.md's "Heat as a shared,
 * time-varying property of a PLACE" entry's own literal complaint: "Two
 * ingredients simmering in the same pot right now get independent, unlinked
 * applyAction calls each carrying their own waterTempC/durationSeconds
 * guess, not one shared temperature."
 *
 * Proves TWO real, different techniques against the IDENTICAL mechanism —
 * boil.json's startMethod parameter ("cold_start" vs. "boiling_start") is
 * now literally expressible as step ORDER, not just an informational
 * string, exactly as heat_place.json's sequencingNote says:
 *
 * - "boiling_start": HEAT_PLACE runs to completion BEFORE either egg is
 *   PLACE_IN'd — data/recipes/two-eggs-shared-pot.json already proves this
 *   one end-to-end (`npm run recipe -- two_eggs_shared_pot`); reused here
 *   for a side-by-side comparison, not duplicated logic.
 * - "cold_start": both eggs are PLACE_IN'd into the place FIRST, then ONE
 *   HEAT_PLACE step heats the whole place — water AND both already-present
 *   eggs "cook gradually through the whole temperature ramp together"
 *   (boil.json's own startMethodNote) — this is the case that actually
 *   makes the "shared by [...], all now at the SAME X°C" log line fire on
 *   the HEAT_PLACE step itself, because placeContents is non-empty by the
 *   time it runs.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

function makeRecipe(id: string, order: "boiling_start" | "cold_start"): RecipeScript {
  const fill = {
    actionId: "fill",
    targetInstanceId: "water-1",
    params: { placeId: "pot-1", toolEntityId: "pot", massKg: "1.2", startTempC: "15" },
    availableIngredientInstanceIds: [],
  };
  const heat = {
    actionId: "heat_place",
    targetInstanceId: "water-1",
    params: { placeId: "pot-1", heatSourceId: "gas", tickSeconds: "30" },
    availableIngredientInstanceIds: [],
  };
  const placeIn1 = {
    actionId: "place_in",
    targetInstanceId: "egg-1",
    params: { placeId: "pot-1", placementMethod: "lowered_with_spoon" },
    availableIngredientInstanceIds: [],
  };
  const placeIn2 = {
    actionId: "place_in",
    targetInstanceId: "egg-2",
    params: { placeId: "pot-1", placementMethod: "lowered_with_spoon" },
    availableIngredientInstanceIds: [],
  };

  return {
    id,
    names: { en: id },
    initialInventory: [
      { id: "water-1", entityId: "water", state: "cold", tags: [] },
      { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
      { id: "egg-2", entityId: "egg", state: "raw", tags: [] },
    ],
    availableTools: ["pot"],
    sequence:
      order === "boiling_start" ? [fill, heat, placeIn1, placeIn2] : [fill, placeIn1, placeIn2, heat],
    metadata: {},
  };
}

for (const order of ["boiling_start", "cold_start"] as const) {
  console.log(`\n=== ${order} ===`);
  const recipe = makeRecipe(`shared-pot-${order}`, order);
  const result = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
  for (const line of result.log) console.log(`  ${line}`);
  if (result.errors.length > 0) {
    console.log(`  ${result.errors.length} error(s):`);
    for (const { message } of result.errors) console.log(`    ${message}`);
  }
  const place = result.places.get("pot-1")!;
  const contents = result.placeContents.get("pot-1") ?? [];
  console.log(`  Final place "pot-1": ${place.currentTempC.toFixed(1)}°C, co-located: [${contents.join(", ")}]`);
}

console.log(
  "\nBoth orders drive the SAME mechanism (one PlaceState per placeId) — the difference is real step ORDER, " +
    "not two different code paths. In 'cold_start', HEAT_PLACE's own log line names both eggs as already " +
    "'shared by', at the same temperature, at every tick — the concrete disproof of 'two ingredients in the " +
    "same pot get independent, unlinked applyAction calls, not one shared temperature.'"
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: this tracks the MEDIUM's (water's) " +
    "shared temperature only, not each egg's own internal temperature (heat-penetration.ts's separate, " +
    "potato-only concern) — a cold_start egg here is not modeled as heating any slower/faster than the water " +
    "around it. No FRY/oil case (fill.json/heat_place.json both require isBoilingMedium, not isFryingMedium — " +
    "see fill.json's own scopeNote). No Instance.inProgressAction/toolLockBehavior " +
    "(WORLD_MODEL_OPTIMIZATION.md, ROADMAP.md 2026-08-15). No periodic/alternating-temperature recipe proven " +
    "(the Di Lorenzo & Di Maio 'Periodic cooking of eggs' case) — mechanically HEAT_PLACE could be called " +
    "repeatedly with alternating targetTempC values, but that has not been built or proven here."
);
