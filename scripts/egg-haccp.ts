import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";

/**
 * Demonstrates the HACCP check wired into FRY/SCRAMBLE/POACH/BOIL on eggs
 * (data/ccps/egg_cooking.json, criticalControlPointsByAction), and —
 * ENGINE_INVARIANTS.md #11 — how SafetyPolicy changes what happens to an
 * advisoryOnly shortfall depending on who's actually driving:
 *
 * 1. human execution, 10s flash fry: warns, completes (a person can judge
 *    a runny yolk for themselves — the FDA Food Code's actual posture).
 * 2. autonomous execution, same 10s flash fry, no override: hard rejects.
 *    No human present to make that judgment call, so the safe default
 *    wins, not the permissive one.
 * 3. autonomous execution, same shortfall, WITH an explicit prior
 *    human authorization for this exact CCP: proceeds, but the fact that
 *    it was overridden stays visible in the warning text — not silently
 *    absorbed into "no warnings".
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["pan"]);
const ingredients = new Set(["oil"]);

function fry(instance: Instance, durationSeconds: number, policy?: SafetyPolicy) {
  const action = actions.get("fry")!;
  const result = applyAction(
    instance,
    action,
    entities,
    tools,
    { durationSeconds: String(durationSeconds), heatLevel: "medium" },
    ingredients,
    ccps,
    policy
  );
  console.log(`FRY for ${durationSeconds}s: "${instance.state}" -> "${result.instance.state}"`);
  if (result.warnings.length === 0) {
    console.log("  No HACCP warnings.");
  } else {
    for (const w of result.warnings) console.log(`  WARNING: ${w}`);
  }
  return result;
}

console.log("=== 1. Human execution (default policy) ===");
console.log("--- A normal fried egg, 120 seconds ---");
fry({ entityId: "egg", state: "raw", tags: [] }, 120);

console.log("\n--- A deliberately unrealistic 10-second flash fry ---");
const humanFlash = fry({ entityId: "egg", state: "raw", tags: [] }, 10);
console.log(`Completed: state "${humanFlash.instance.state}". The warning is informational — a human reads it and judges.`);

console.log("\n=== 2. Autonomous execution, same 10s flash fry, no override ===");
try {
  fry({ entityId: "egg", state: "raw", tags: [] }, 10, { mode: "autonomous" });
  console.log("UNEXPECTED: did not reject");
} catch (err) {
  console.log(`REJECTED as expected — no human present to accept this risk:\n  ${(err as Error).message}`);
}

console.log("\n=== 3. Autonomous execution, same shortfall, WITH a prior human override for this CCP ===");
fry({ entityId: "egg", state: "raw", tags: [] }, 10, { mode: "autonomous", humanOverrides: new Set(["egg_cooking"]) });

console.log(
  "\nSame underlying shortfall, three different outcomes depending on SafetyPolicy — " +
    "ENGINE_INVARIANTS.md #11: autonomous execution defaults safe, not permissive, and stays that way " +
    "until a human explicitly says otherwise for that specific CCP, not as a blanket switch."
);
