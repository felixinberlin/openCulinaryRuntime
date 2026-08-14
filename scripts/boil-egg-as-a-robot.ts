import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";
import { emptyPlace, pourInto, advanceHeatSeconds, isAtBoiling } from "../src/place.ts";
import { eggBoilDonenessRange } from "../src/egg-doneness.ts";

/**
 * Capability test for `src/place.ts`, added 2026-08-14 directly in response
 * to being asked, step by step, what a robot actually needs to know to boil
 * an egg: "put water in a pan. apply warm to the pan till the water boil
 * 100grad. put the egg very delicated. is salt needed? wait for XX minutes,
 * depending on heat, water amount and desired egg grad."
 *
 * DIFFERENT FROM `oma-boils-an-egg.ts`, deliberately, not a duplicate of it:
 * that script resolves "medium" to a duration and computes ONE total
 * preheat number via `estimatedPreheatSeconds` — a one-shot calculation
 * trusted blindly. This script instead TICKS real elapsed time forward
 * through `place.ts`'s `advanceHeatSeconds` and polls `isAtBoiling` after
 * each tick — the actual "wait for XX minutes... depending on heat, water
 * amount" step made real and checkable, not precomputed and assumed, and
 * the concrete mechanism a robot's own control loop (checking a real
 * temperature reading against a real threshold, not sleeping for a
 * predicted duration) would actually need.
 *
 * Walks the whole real sequence, one physical step at a time:
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const water = entities.get("water")!;
const heatSource = heatSources.get("gas")!;
const yolkDoneness = "medium" as const;
const potWaterMassKg = 1.2; // a realistic small-pot quantity for boiling a couple of eggs
const startTempC = 15; // tap-cold

console.log(`Goal: a "${yolkDoneness}" boiled egg, ${potWaterMassKg}kg water, starting at ${startTempC}°C, on ${heatSource.names.en}.\n`);

// ---------------------------------------------------------------------
// 1. "Put water in a pan." — a real quantity, actually poured, not an
//    unconsumed presence check (boil.json's requiredIngredientCapabilities
//    only ever asked "is some water around," never "how much, at what
//    temperature, in THIS pot").
// ---------------------------------------------------------------------
let place = pourInto(emptyPlace("pot"), "water", potWaterMassKg, startTempC);
console.log(`1. Poured ${place.massKg}kg water into the pot at ${place.currentTempC}°C.\n`);

// ---------------------------------------------------------------------
// 2. "Apply warm to the pan till the water boils 100°C." — real elapsed
//    time, ticked forward in 30s increments, polling the actual state
//    (isAtBoiling) rather than trusting one precomputed total. This is the
//    part that's genuinely new: a robot control loop checks a real reading
//    against a real threshold at each step, not "sleep(preheatSeconds)".
// ---------------------------------------------------------------------
const TICK_SECONDS = 30;
let elapsedPreheatSeconds = 0;
console.log("2. Heating, polling every 30s:");
while (!isAtBoiling(place, water)) {
  place = advanceHeatSeconds(place, heatSource, TICK_SECONDS, water);
  elapsedPreheatSeconds += TICK_SECONDS;
  console.log(`   +${elapsedPreheatSeconds}s: ${place.currentTempC.toFixed(1)}°C`);
}
console.log(`   Boiling reached (${water.thermophysical!.boilingPointC}°C) after ${elapsedPreheatSeconds}s.\n`);

// ---------------------------------------------------------------------
// 3. "Put the egg very delicately." — closed 2026-08-14 (boil.json's new
//    placementMethod parameter, egg.json's crackPreventionNote):
//    "lowered_with_spoon" is the real, cited technique that avoids the
//    mechanical-impact crack a drop risks. Still informational only — no
//    crack-probability simulation, same honesty limit as every other
//    categorical technique parameter here — but the technique choice is
//    now real, named vocabulary a robot's plan can record, not silently
//    absent. See egg.json's crackPreventionNote for the OTHER two real
//    crack mechanisms (thermal shock at entry, turbulence during cooking)
//    this one parameter deliberately does NOT also cover.
// ---------------------------------------------------------------------
const placementMethod = "lowered_with_spoon" as const;
console.log(`3. Egg placement: "${placementMethod}" — avoids the mechanical-impact crack a drop risks (boil.json's placementMethodNote).\n`);

// ---------------------------------------------------------------------
// 4. "Is salt needed?" — No. egg.json's own crackContainmentNote is
//    explicit: salt in the boiling water doesn't affect doneness or safety
//    at all — its only real purpose is speeding coagulation to CONTAIN a
//    leak if the shell already cracked, a contingency, not a requirement.
//    Correctly not called here — this recipe has no reason to.
// ---------------------------------------------------------------------
console.log("4. Salt needed? No — see egg.json's crackContainmentNote: salt only helps CONTAIN a leak if the shell");
console.log("   cracks, it has no effect on doneness or safety. Not used in this run.\n");

// ---------------------------------------------------------------------
// 5. "Wait XX minutes, depending on heat, water amount, and desired grade."
//    — heat + water amount already spent themselves as elapsedPreheatSeconds
//    above; "desired grade" resolves here, via EGG_BOIL_DONENESS. For this
//    boiling_start method (egg went in only once already boiling — exactly
//    what just happened), the two numbers genuinely just add — see
//    egg-doneness.ts's own doc comment for why that's NOT true for
//    cold_start.
// ---------------------------------------------------------------------
const { min, max } = eggBoilDonenessRange(yolkDoneness);
const holdSeconds = Math.round((min + max) / 2); // midpoint of the cited range
console.log(`5. "${yolkDoneness}" resolves to ${min}-${max}s held at boiling — using the midpoint, ${holdSeconds}s.\n`);

const policy: SafetyPolicy = { mode: "autonomous" }; // no human present — ENGINE_INVARIANTS.md #11
const tools = new Set(["pot"]);
const ingredients = new Set(["water"]);
const rawEgg: Instance = { entityId: "egg", state: "raw", tags: [] };
const boiled = applyAction(
  rawEgg,
  actions.get("boil")!,
  entities,
  tools,
  { durationSeconds: String(holdSeconds), yolkDoneness, placementMethod },
  ingredients,
  ccps,
  policy
);
console.log(`   BOIL executed: "${rawEgg.state}" -> "${boiled.instance.state}"`);
console.log(`   HACCP warnings: ${boiled.warnings.length === 0 ? "none" : boiled.warnings.join("; ")}\n`);

const shocked = applyAction(boiled.instance, actions.get("shock")!, entities, new Set(["bowl"]), {}, ingredients).instance;
console.log(`6. SHOCK immediately (carryover cooking — shock.json's carryoverCookingNote): "${boiled.instance.state}" -> "${shocked.state}"\n`);

const totalSeconds = elapsedPreheatSeconds + holdSeconds;
console.log(
  `Total real elapsed time: ${elapsedPreheatSeconds}s to boil + ${holdSeconds}s held = ${totalSeconds}s ` +
    `(${(totalSeconds / 60).toFixed(1)} min) — two genuinely separate, now-computed numbers that add cleanly ` +
    "because the egg only went in once boiling was actually confirmed, not assumed."
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no FILL/PLACE Action exists in " +
    "data/actions/*.json (this sequence is procedural TypeScript, not a validated recipe.sequence step a robot's " +
    "planner could select the way it selects boil.json today); placementMethod (above) records a real technique " +
    "CHOICE, not a crack-probability simulation — no shell-integrity/fragility model exists; no real closed-loop " +
    "temperature SENSOR (isAtBoiling here reads place.ts's own simulated state, not a physical thermometer) — " +
    "ENGINE_INVARIANTS.md #11's control/perception gap stands exactly as documented."
);
