import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import { secondsForYolkToReachTempC, YOLK_TARGET_TEMP_C } from "../src/egg-heat-penetration.ts";
import { EGG_SIZE_GRAMS, eggBoilDonenessRange } from "../src/egg-doneness.ts";
import { waterBoilingPointC } from "../src/altitude.ts";

/**
 * Capability test for `src/egg-heat-penetration.ts`, added 2026-08-16 —
 * "check if there's newer/other real math" against `egg-doneness.ts`'s
 * existing EMPIRICAL `EGG_BOIL_DONENESS` table. Proves the real, computed
 * cross-check that file's own doc comment describes in prose — run here
 * against the actual loaded `egg.json` data, not just asserted.
 *
 * Also directly closes part of what `boil-at-altitude.ts`'s own closing
 * note named as still-open ("EGG_BOIL_DONENESS's hold-time ranges are NOT
 * adjusted for altitude... needs real heat-transfer-rate modeling into
 * the food itself") — for WHOLE-EGG boiling specifically, that modeling
 * now exists, and composes with `altitude.ts` for free (see the altitude
 * section below).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const egg = entities.get("egg")!;
const t = egg.thermophysical!;

console.log(
  "Goal: cross-check Williams' computed spherical-conduction time against the real empirical table.\n"
);

// ---------------------------------------------------------------------
// 1. The real cross-check, for a "large" egg (this repo's own baseline
//    assumption) — soft/medium/hard, computed vs. empirical.
// ---------------------------------------------------------------------
console.log('1. "large" egg (55g), 4°C start, 100°C sea-level water:');
for (const doneness of ["soft", "medium", "hard"] as const) {
  const params = {
    massKg: EGG_SIZE_GRAMS.large / 1000,
    specificHeatJPerKgK: t.specificHeatJPerKgK!,
    densityKgPerM3: t.densityKgPerM3!,
    thermalConductivityWPerMK: t.thermalConductivityWPerMK!,
    initialTempC: 4,
    waterTempC: 100,
  };
  const computedSeconds = secondsForYolkToReachTempC(params, YOLK_TARGET_TEMP_C[doneness]);
  const empirical = eggBoilDonenessRange(doneness);
  const inRange = computedSeconds >= empirical.min && computedSeconds <= empirical.max;
  console.log(
    `   ${doneness.padEnd(6)} (target yolk ${YOLK_TARGET_TEMP_C[doneness]}°C): computed ${computedSeconds.toFixed(0)}s ` +
      `— empirical range ${empirical.min}-${empirical.max}s — ${inRange ? "INSIDE the range" : "outside the range"}`
  );
}

// ---------------------------------------------------------------------
// 2. Real physical ordering across all 4 sizes — a bigger egg should
//    always take longer for the same target, computed, not assumed.
// ---------------------------------------------------------------------
console.log(
  "\n2. Same check (soft, 65°C target) across all 4 real sizes — bigger egg, longer time:"
);
let previousSeconds = 0;
for (const size of ["small", "medium", "large", "extra_large"] as const) {
  const params = {
    massKg: EGG_SIZE_GRAMS[size] / 1000,
    specificHeatJPerKgK: t.specificHeatJPerKgK!,
    densityKgPerM3: t.densityKgPerM3!,
    thermalConductivityWPerMK: t.thermalConductivityWPerMK!,
    initialTempC: 4,
    waterTempC: 100,
  };
  const seconds = secondsForYolkToReachTempC(params, YOLK_TARGET_TEMP_C.soft);
  const ordered = seconds > previousSeconds;
  console.log(
    `   ${size.padEnd(12)} (${EGG_SIZE_GRAMS[size]}g): ${seconds.toFixed(0)}s ${ordered || previousSeconds === 0 ? "" : "— WARNING: not monotonically increasing"}`
  );
  previousSeconds = seconds;
}

// ---------------------------------------------------------------------
// 3. Composes with altitude.ts for free — a real altitude-adjusted
//    waterTempC, zero changes to either file, the same reuse story
//    place.ts/altitude.ts already told for potato and oil.
// ---------------------------------------------------------------------
const altitudeMeters = 2640; // Bogotá, same reference point boil-at-altitude.ts uses
const altitudeWaterTempC = waterBoilingPointC(altitudeMeters);
const seaLevelParams = {
  massKg: EGG_SIZE_GRAMS.large / 1000,
  specificHeatJPerKgK: t.specificHeatJPerKgK!,
  densityKgPerM3: t.densityKgPerM3!,
  thermalConductivityWPerMK: t.thermalConductivityWPerMK!,
  initialTempC: 4,
  waterTempC: 100,
};
const altitudeParams = { ...seaLevelParams, waterTempC: altitudeWaterTempC };
const seaLevelSeconds = secondsForYolkToReachTempC(seaLevelParams, YOLK_TARGET_TEMP_C.soft);
const altitudeSeconds = secondsForYolkToReachTempC(altitudeParams, YOLK_TARGET_TEMP_C.soft);
console.log(
  `\n3. Bogotá (2640m, water boils at ${altitudeWaterTempC.toFixed(1)}°C): soft-boil takes ${altitudeSeconds.toFixed(0)}s ` +
    `vs. ${seaLevelSeconds.toFixed(0)}s at sea level — a real, computed altitude effect on egg-boiling time, composing ` +
    "src/altitude.ts + src/egg-heat-penetration.ts with zero changes to either file."
);

console.log(
  "\nHonest result, not smoothed over: 'soft' converges well with the empirical table; 'medium' is a near-miss " +
    "(a bit short of the empirical range); 'hard' diverges substantially (well short) — see egg-heat-penetration.ts's " +
    "own doc comment for the stated hypothesis why, and EGG_BOIL_DONENESS/YOLK_TARGET_TEMP_C for what's directly " +
    "cited vs. this repo's own reasoned interpretation. This model also treats the egg as ONE homogeneous sphere " +
    `(white and yolk are two real, different materials) — a much larger, numerical two-material model exists in the ` +
    "literature (Di Lorenzo & Di Maio 2025, REFERENCES.md) and is NOT implemented here, named as a real, separately-" +
    "scoped possibility, not attempted."
);
