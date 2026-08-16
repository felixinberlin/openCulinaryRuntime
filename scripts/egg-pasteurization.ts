import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Demonstrates data/ccps/egg_pasteurization_raw.json's enforcement —
 * built after finding data/recipes/handmade-alioli-egg-yolk.json used raw
 * egg yolk with ZERO food-safety checking (see that recipe's
 * safetyHistory note). Unlike egg_cooking.json's runny-yolk CCP
 * (advisoryOnly: true — a human can knowingly accept it), this one is
 * advisoryOnly: false: a shortfall is a hard reject in EVERY SafetyPolicy
 * mode, not just autonomous. There's no "diner accepted the risk"
 * framing for silently serving under-pasteurized raw egg.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const tools = new Set(["pot"]);

function pasteurize(
  waterTempC: number,
  durationSeconds: number,
  policy?: { mode: "human" | "autonomous" }
) {
  const action = actions.get("pasteurize")!;
  const instance: Instance = { entityId: "egg", state: "raw", tags: [] };
  const result = applyAction(
    instance,
    action,
    entities,
    tools,
    { waterTempC: String(waterTempC), durationSeconds: String(durationSeconds) },
    new Set(),
    ccps,
    policy
  );
  console.log(
    `  ${waterTempC}°C for ${durationSeconds}s (${policy?.mode ?? "human"} mode): tags [${result.instance.tags}]`
  );
  return result;
}

console.log("--- Adequate pasteurization (57°C, 65 min) — human mode ---");
pasteurize(57, 3900);

console.log("\n--- Adequate pasteurization — autonomous mode ---");
pasteurize(57, 3900, { mode: "autonomous" });

// 2400s (40 min) is deliberately WITHIN pasteurize.json's own declared
// numericRange (1800-7200s, a plausible-attempt sanity bound) but BELOW
// egg_pasteurization_raw.json's actual heldSeconds (3900s) — this exercises
// the CCP threshold check specifically, not just basic parameter bounds.
console.log(
  "\n--- Plausible but insufficient (57°C, 40 min — within range, below CCP threshold) — human mode ---"
);
try {
  pasteurize(57, 2400);
  console.log("  UNEXPECTED: did not reject");
} catch (err) {
  console.log(
    `  REJECTED (human mode too — advisoryOnly: false, no 'diner accepts the risk' path here):`
  );
  console.log(`    ${(err as Error).message}`);
}

console.log("\n--- Same shortfall — autonomous mode ---");
try {
  pasteurize(57, 2400, { mode: "autonomous" });
  console.log("  UNEXPECTED: did not reject");
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message.split(".")[0]}.`);
}

console.log(
  "\nSame shortfall rejected in BOTH modes, unlike egg_cooking.json's runny-yolk case (egg-haccp.ts) — " +
    "egg_pasteurization_raw.json's advisoryOnly: false means there is no execution mode where this is " +
    "merely a warning. See that CCP's metadata.note for why."
);
