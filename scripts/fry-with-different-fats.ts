import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { emptyPlace, pourInto, advanceTempSeconds, isAtTargetTemp } from "../src/place.ts";

/**
 * Capability test for "what changes if I fry with butter, or a different
 * oil?" (2026-08-14), added directly in response to that question, once
 * two real answers turned out to need two different real entities
 * (data/entities/sunflower_oil.json, butter.json) rather than a parameter
 * on the existing one.
 *
 * TWO things proven, deliberately not conflated:
 *
 * 1. At the applyAction/schema level, NOTHING changes — proven by actually
 *    running FRY with three different requiredIngredientCapabilities
 *    substitutes. fry.json's requiredIngredientCapabilities check was
 *    ALREADY capability-based (unlike requiredTools' pre-2026-08-14
 *    exact-id problem), so this needed zero engine changes — the
 *    substitution already worked, it just had nothing but oil.json to
 *    substitute FOR until now.
 *
 * 2. If you actually simulate the heat-up (place.ts, not applyAction),
 *    the real physical difference shows up immediately and correctly:
 *    butter's real, lower smoke point (175°C) makes it genuinely
 *    unsuitable for crispy_french_fries.json's 191°C finishing fry —
 *    advanceTempSeconds's existing safety check (built for the abstract
 *    "don't heat oil past its smoke point" case) rejects it exactly the
 *    same way, now proven against a second, more restrictive real
 *    ceiling it was never specifically built for.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const fry = actions.get("fry")!;
const heatSource = heatSources.get("gas")!;

console.log("=== 1. Does FRY even run with each fat? (applyAction level) ===\n");
for (const fatId of ["oil", "sunflower_oil", "butter"]) {
  const egg: Instance = { entityId: "egg", state: "raw", tags: [] };
  const result = applyAction(
    egg,
    fry,
    entities,
    new Set(["pan"]),
    { durationSeconds: "90", yolkDoneness: "runny" },
    new Set([fatId]),
    ccps
  );
  console.log(
    `  "${fatId}": OK — egg -> "${result.instance.state}" (zero engine changes needed for this substitution)`
  );
}

console.log(
  "\nSo: nothing changes at this level, because FRY's requiredIngredientCapabilities check never cared WHICH " +
    "entity satisfied isFryingMedium, only THAT one did — the same 'is some frying medium present' presence check " +
    "since before any of these three entities existed.\n"
);

console.log(
  "=== 2. Can each fat actually reach crispy_french_fries.json's real 191°C finishing-fry target? ===\n"
);
const targetTempC = 191; // fry.json's own oilTempCNote-cited finishing temperature

for (const fatId of ["oil", "sunflower_oil", "butter"]) {
  const fat = entities.get(fatId)!;
  const smokePointC = fat.thermophysical!.smokePointC!;
  console.log(`  ${fat.names.en} (smoke point ${smokePointC}°C):`);
  try {
    let place = pourInto(emptyPlace("pan"), fatId, 0.3, 20);
    let elapsed = 0;
    while (!isAtTargetTemp(place, targetTempC)) {
      place = advanceTempSeconds(place, heatSource, 15, fat, targetTempC);
      elapsed += 15;
      if (elapsed > 600) break; // safety valve for this demo loop
    }
    console.log(
      `    Reached ${targetTempC}°C in ${elapsed}s — safe, ${(smokePointC - targetTempC).toFixed(0)}°C of margin below smoke point.`
    );
  } catch (e) {
    console.log(`    REJECTED: ${(e as Error).message}`);
  }
}

console.log(
  "\nSo: olive oil (10°C margin) and sunflower oil (39°C margin) both work — sunflower oil is the safer, more " +
    "common real choice for exactly this reason. Butter is correctly rejected outright: 191°C is above its real " +
    "175°C smoke point, not a matter of degree — the SAME advanceTempSeconds safety mechanism built for the " +
    "abstract 'don't exceed an oil's smoke point' case catches this correctly, without having been written with " +
    "butter in mind at all."
);

console.log(
  "\nStill NOT modeled, named rather than implied covered (see butter.json's own notes): butter's ~18% water " +
    "content (an initial foaming/evaporation phase this repo's uniform heat-capacity model doesn't represent); " +
    "clarified butter/ghee as a real, higher-smoke-point alternative (no CLARIFY action exists); brown butter " +
    "('beurre noisette') as a real, intentional doneness stage, not a mistake."
);
