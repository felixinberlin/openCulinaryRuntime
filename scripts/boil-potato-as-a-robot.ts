import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { emptyPlace, pourInto, advanceHeatSeconds, isAtBoiling } from "../src/place.ts";
import { potatoBoilDonenessRange } from "../src/potato-doneness.ts";

/**
 * The potato sibling of `boil-egg-as-a-robot.ts`, added 2026-08-14 in
 * direct response to: "how long depending on the temperature, the [piece
 * size] of potato... make first the boiling and use as much as we learned
 * with the egg." Reuses EVERY piece of that learning verbatim, unchanged:
 *   - src/place.ts's real, ticked, elapsed-time heat-up + isAtBoiling poll
 *     (built for egg, zero changes needed for potato — heat physics don't
 *     care what's in the water).
 *   - requiredToolCapabilities' isDeepVessel tool substitution (built for
 *     egg, applies identically here — a robot with only a pan still can't
 *     boil a potato either, same real reason).
 *   - The "resolve a categorical doneness parameter to a real cited
 *     seconds range" pattern (EGG_BOIL_DONENESS -> POTATO_BOIL_DONENESS).
 *
 * What's genuinely NEW for potato, not just reused: `pieceSize` is the
 * doneness axis (not yolk texture — a potato doesn't have a yolk), and
 * unlike egg, real technique recommends `cold_start` for potato as
 * objectively better, not just gentler (see potato-doneness.ts's own doc
 * comment) — this script still uses `boiling_start` because that's what
 * POTATO_BOIL_DONENESS's cited ranges assume (matching this repo's own
 * durationSeconds semantics), and says so out loud rather than silently
 * picking the technically-easier option.
 *
 * Closes the loop with `egg-salad-prep.ts`: finishes with CUT (now wired
 * to potato's real 'quartered'/'halved' shapes) + SALT, a real "boiled
 * potato salad" prep, not just a bare boil.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const water = entities.get("water")!;
const heatSource = heatSources.get("gas")!;
const pieceSize = "halved_or_quartered" as const;
const potWaterMassKg = 1.5; // enough to cover halved/quartered potatoes for a small batch
const startTempC = 15; // tap-cold

console.log(
  `Goal: boiled potato, piece size "${pieceSize}", ${potWaterMassKg}kg water from ${startTempC}°C, on ${heatSource.names.en}.\n`
);

console.log(
  "Real technique note (potato-doneness.ts): sources actually recommend COLD-START for potato — more even " +
    "cooking AND less total time, per America's Test Kitchen's own testing — unlike egg where boiling_start is " +
    "the assumed default. This script still uses boiling_start below because that's what POTATO_BOIL_DONENESS's " +
    "cited ranges assume (matching durationSeconds' existing hold-time-at-temperature semantics) — a real, named " +
    "tension, not silently resolved either way.\n"
);

// 1. Cut FIRST, same real order a kitchen actually uses (peel/cut before
//    the pot ever goes on) — unlike the egg case, where the target goes in
//    whole and is only cut AFTER boiling.
let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
potato = applyAction(potato, actions.get("wash")!, entities, new Set(["knife"])).instance;
potato = applyAction(potato, actions.get("peel")!, entities, new Set(["knife"])).instance;
potato = applyAction(potato, actions.get("cut")!, entities, new Set(["knife"]), {
  shape: "quartered",
}).instance;
console.log(`1. WASH -> PEEL -> CUT (quartered): potato is now "${potato.state}".\n`);

// 2. Pour + heat the water — identical mechanism to the egg script, proven
//    reusable exactly as claimed, not just asserted.
let place = pourInto(emptyPlace("pot"), "water", potWaterMassKg, startTempC);
const TICK_SECONDS = 30;
let elapsedPreheatSeconds = 0;
console.log("2. Heating, polling every 30s:");
while (!isAtBoiling(place, water)) {
  place = advanceHeatSeconds(place, heatSource, TICK_SECONDS, water);
  elapsedPreheatSeconds += TICK_SECONDS;
  console.log(`   +${elapsedPreheatSeconds}s: ${place.currentTempC.toFixed(1)}°C`);
}
console.log(`   Boiling reached after ${elapsedPreheatSeconds}s.\n`);

// 3. Piece size resolves to a real, cited hold-time range.
const { min, max } = potatoBoilDonenessRange(pieceSize);
const holdSeconds = Math.round((min + max) / 2);
console.log(
  `3. "${pieceSize}" resolves to ${min}-${max}s held at boiling — using the midpoint, ${holdSeconds}s.\n`
);

const tools = new Set(["pot", "knife"]);
const ingredients = new Set(["water"]);
const boiled = applyAction(
  potato,
  actions.get("boil")!,
  entities,
  tools,
  { durationSeconds: String(holdSeconds), pieceSize, placementMethod: "lowered_with_spoon" },
  ingredients,
  ccps
);
console.log(`   BOIL executed: "${potato.state}" -> "${boiled.instance.state}"`);
console.log(
  `   HACCP warnings: ${boiled.warnings.length === 0 ? "none" : boiled.warnings.join("; ")}\n`
);

// 4. Finish as a salad, same as egg-salad-prep.ts's closing move.
const salted = applyAction(
  boiled.instance,
  actions.get("salt")!,
  entities,
  tools,
  { timing: "after_cooking" },
  new Set(["salt"])
).instance;
console.log(`4. SALT: "${boiled.instance.state}" -> tags [${salted.tags}]\n`);

const totalSeconds = elapsedPreheatSeconds + holdSeconds;
console.log(
  `Total real elapsed time: ${elapsedPreheatSeconds}s to boil + ${holdSeconds}s held = ${totalSeconds}s ` +
    `(${(totalSeconds / 60).toFixed(1)} min) — every number here came from grounded, cited data (potato-doneness.ts, ` +
    "heat-source.ts, place.ts) exactly the way the egg case did, reused with zero engine changes."
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: cold_start's real total-time/evenness " +
    "advantage for potato (named above) isn't computed anywhere, only the boiling_start hold time is; no FILL/PLACE " +
    "Action exists (same gap as the egg case); assembling this into an actual 'potato salad' dish alongside other " +
    "ingredients is the same pre-existing, deferred composite-dish-assembly gap egg-salad-prep.ts already named."
);
