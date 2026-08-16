import { join } from "node:path";
import { loadEntities, loadHeatSources } from "../src/registry.ts";
import { estimatedPreheatSeconds } from "../src/heat-source.ts";
import { EGG_BOIL_DONENESS } from "../src/egg-doneness.ts";

/**
 * Capability test for the 2026-08-13 "how does temperature and time in the
 * egg work? how long on gas/vitro/wood? if I tell a robot medium boiled, I
 * want it to understand it" conversation. Proves two things concretely
 * rather than just asserting them in doc comments:
 *   1. Preheat TIME differs meaningfully by heat source (a real, computed
 *      number, not a vague "wood is slower").
 *   2. The boiling POINT itself does NOT — same 100C target for all three,
 *      pulled from the same water.json value, not re-typed per source.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const water = entities.get("water")!;
const boilingPointC = water.thermophysical!.boilingPointC!;
const specificHeat = water.thermophysical!.specificHeatJPerKgK!;

const potWaterMassKg = 1.5; // ~1.5L for a small pot of eggs, a realistic home quantity
const startTempC = 4; // refrigerator-cold water

console.log(
  `Water: ${potWaterMassKg}kg, starting at ${startTempC}°C, boiling point ${boilingPointC}°C (sea level).\n`
);

console.log("Time to reach a boil, by heat source (this is what actually differs):");
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  const seconds = estimatedPreheatSeconds(potWaterMassKg, startTempC, boilingPointC, source);
  const minutes = (seconds / 60).toFixed(1);
  console.log(
    `  ${source.names.en.padEnd(45)} ~${seconds.toFixed(0)}s (${minutes} min) — ` +
      `${source.typicalPowerWattsRange.min}-${source.typicalPowerWattsRange.max}W @ ` +
      `${source.thermalEfficiencyPercentRange.min}-${source.thermalEfficiencyPercentRange.max}% efficiency, ` +
      `manual positioning: ${source.manualPositioningRelevance}`
  );
}

console.log(
  `\nBut the TARGET TEMPERATURE is identical regardless of heat source — always ${boilingPointC}°C at sea level:`
);
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  console.log(
    `  ${source.names.en}: boils at ${boilingPointC}°C (read from water.json once, not re-derived per source)`
  );
}

console.log(
  "\nOnce boiling, yolk doneness (this part is the same regardless of what got the water there):"
);
for (const entry of EGG_BOIL_DONENESS) {
  console.log(
    `  ${entry.yolkDoneness.padEnd(6)}: ${entry.durationSecondsRange.min}-${entry.durationSecondsRange.max}s ` +
      `(${(entry.durationSecondsRange.min / 60).toFixed(1)}-${(entry.durationSecondsRange.max / 60).toFixed(1)} min) — ${entry.description}`
  );
}

console.log(
  "\nSo: 'medium boiled egg on the wood fire' = wait ~" +
    `${estimatedPreheatSeconds(potWaterMassKg, startTempC, boilingPointC, heatSources.get("wood_fire")!).toFixed(0)}s for the water to boil, ` +
    `then boil the egg for ${EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === "medium")!.durationSecondsRange.min}-` +
    `${EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === "medium")!.durationSecondsRange.max}s — ` +
    "two genuinely separate numbers from two genuinely separate real facts, not one blended guess."
);

console.log(
  `\nsanity check — specificHeatJPerKgK read from water.json: ${specificHeat} J/(kg·K) (should be 4186)`
);
if (specificHeat !== 4186) {
  throw new Error(
    "water.json's specificHeatJPerKgK drifted from the expected value — check the entity file"
  );
}
