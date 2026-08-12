import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Demonstrates the HACCP check wired into FRY/SCRAMBLE/POACH/BOIL on eggs
 * (data/ccps/egg_cooking.json, criticalControlPointsByAction). Two runs:
 * one that clears the CCP's 15-second hold with room to spare, one that
 * deliberately doesn't — a 10-second "flash fry", well short of any normal
 * cook time, chosen specifically to demonstrate the warning path rather
 * than to represent a realistic recipe.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["pan"]);
const ingredients = new Set(["oil"]);

function fry(instance: Instance, durationSeconds: number) {
  const action = actions.get("fry")!;
  const result = applyAction(
    instance,
    action,
    entities,
    tools,
    { durationSeconds: String(durationSeconds), heatLevel: "medium" },
    ingredients,
    ccps
  );
  console.log(`FRY for ${durationSeconds}s: "${instance.state}" -> "${result.instance.state}"`);
  if (result.warnings.length === 0) {
    console.log("  No HACCP warnings.");
  } else {
    for (const w of result.warnings) console.log(`  WARNING: ${w}`);
  }
  return result;
}

console.log("--- A normal fried egg, 120 seconds ---");
fry({ entityId: "egg", state: "raw", tags: [] }, 120);

console.log("\n--- A deliberately unrealistic 10-second flash fry ---");
const flash = fry({ entityId: "egg", state: "raw", tags: [] }, 10);

console.log(
  "\nNot rejected outright: egg_cooking.json's advisoryOnly:true reflects the FDA Food Code's actual " +
    "posture — a still-runny/undercooked egg is a recognized 'increased risk' practice permitted with " +
    "disclosure, not a banned one. A non-advisory CCP (none defined yet in data/ccps/) would throw instead."
);
console.log(`\nFinal state either way: "${flash.instance.state}" — the warning is informational, not blocking.`);
