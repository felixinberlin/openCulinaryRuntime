import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { emptyPlace, pourInto, advanceTempSeconds, isAtTargetTemp } from "../src/place.ts";

/**
 * The FRY sibling of `boil-egg-as-a-robot.ts`, added 2026-08-14: "extend
 * FRY with everything we learned from BOIL." Reuses the exact same real
 * sequence (pour real quantity -> tick real elapsed time, polling for the
 * real state, not trusting one precomputed total -> execute the cooking
 * action with a real resolved parameter), applied to a genuinely different
 * physical situation this time: oil heated to a chosen SETPOINT (not a
 * phase-change plateau) via `advanceTempSeconds`/`isAtTargetTemp`, the
 * general form `advanceHeatSeconds`/`isAtBoiling` were generalized into.
 *
 * Also demonstrates the one real safety mechanism that only matters for
 * this ingredient, not water: refusing to heat toward a target at or past
 * oil's real smoke point (`oil.json`'s new `smokePointC`).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const oil = entities.get("oil")!;
const heatSource = heatSources.get("gas")!;
const targetOilTempC = 175; // real value inside fry.json's oilTempC range (120-200), safely below smokePointC
const oilMassKg = 0.3; // a shallow pool for pan-frying an egg, not a deep-fry submersion
const startTempC = 20;

console.log(`Goal: fry an egg, oil heated to ${targetOilTempC}°C, ${oilMassKg}kg oil from ${startTempC}°C, on ${heatSource.names.en}.\n`);

// ---------------------------------------------------------------------
// 1. Smoke-point safety demonstrated FIRST, deliberately, before the real
//    run: a real robot control loop should validate its target BEFORE
//    committing to heat toward it, not discover the problem partway
//    through. Water never needed this check — oil genuinely does.
// ---------------------------------------------------------------------
console.log(`1. Safety check: oil's smokePointC is ${oil.thermophysical!.smokePointC}°C.`);
try {
  const unsafePlace = pourInto(emptyPlace("pan"), "oil", oilMassKg, startTempC);
  advanceTempSeconds(unsafePlace, heatSource, 30, oil, 220); // deliberately above smokePointC
  console.log("   Unexpected: 220°C should have been rejected.");
} catch (e) {
  console.log(`   Requesting 220°C correctly REJECTED: ${(e as Error).message}\n`);
}

// ---------------------------------------------------------------------
// 2. Pour oil, tick real elapsed time toward the real (safe) target —
//    identical mechanism to place.ts's water case, proven reusable for a
//    genuinely different medium (no boilingPointC involved anywhere here).
// ---------------------------------------------------------------------
let place = pourInto(emptyPlace("pan"), "oil", oilMassKg, startTempC);
const TICK_SECONDS = 15;
let elapsedPreheatSeconds = 0;
console.log(`2. Heating oil toward ${targetOilTempC}°C, polling every 15s:`);
while (!isAtTargetTemp(place, targetOilTempC)) {
  place = advanceTempSeconds(place, heatSource, TICK_SECONDS, oil, targetOilTempC);
  elapsedPreheatSeconds += TICK_SECONDS;
  console.log(`   +${elapsedPreheatSeconds}s: ${place.currentTempC.toFixed(1)}°C`);
}
console.log(`   Target reached after ${elapsedPreheatSeconds}s.\n`);

// ---------------------------------------------------------------------
// 3. FRY, using huevo_frito.json's own real, already-chosen parameters
//    (90s, runny yolk, puntilla) — now with a real, computed oilTempC to
//    go with them instead of only the vague heatLevel: "high" that
//    recipe originally shipped with.
// ---------------------------------------------------------------------
const tools = new Set(["pan"]);
const ingredients = new Set(["oil"]);
const rawEgg: Instance = { entityId: "egg", state: "raw", tags: [] };
const fried = applyAction(
  rawEgg,
  actions.get("fry")!,
  entities,
  tools,
  {
    durationSeconds: "90",
    oilTempC: String(targetOilTempC),
    yolkDoneness: "runny",
    edgeStyle: "crispy_lace_puntilla",
  },
  ingredients,
  ccps
);
console.log(`3. FRY executed: "${rawEgg.state}" -> "${fried.instance.state}"`);
console.log(`   HACCP warnings: ${fried.warnings.length === 0 ? "none" : fried.warnings.join("; ")}\n`);

console.log(
  `Total real elapsed time: ${elapsedPreheatSeconds}s to reach ${targetOilTempC}°C + 90s frying = ` +
    `${elapsedPreheatSeconds + 90}s — proving place.ts/heat-source.ts generalize to a genuinely different medium ` +
    "(oil, no boilingPointC, a chosen setpoint instead of a phase-change ceiling) with zero changes to either file."
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: oilTempC remains informational — " +
    "applyAction's FRY check doesn't consume the resolved target the way engine.ts's CCP check consumes " +
    "durationSeconds; the batch-size/thermal-mass coupling between a cold target instance and the oil's own " +
    "temperature (par-fry.json's loadNote) is still unmodeled — place.ts models the oil heating up, not what " +
    "happens to that temperature once food is actually dropped in."
);
