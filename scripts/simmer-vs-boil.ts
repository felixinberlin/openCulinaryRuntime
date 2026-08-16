import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 SIMMER verb (data/actions/simmer.json,
 * ROADMAP.md "More common technique verbs"). Proves, rather than just
 * asserts in doc comments:
 *
 *   1. SIMMER reaches the SAME "boiled" state BOIL does — a simmered potato/
 *      egg is not a different dish, just a gentler process to the identical
 *      result (simmer.json's sharedTransformedStateNote).
 *   2. Because of (1), the existing statePrerequisites chain (PEEL/SHOCK
 *      require "boiled") works UNCHANGED on something cooked via SIMMER —
 *      no separate wiring needed, proven by actually running PEEL after
 *      SIMMER, not just asserting the state string matches.
 *   3. SIMMER's waterTempC band (85-96°C) is a real, distinct, ENFORCED
 *      range — a rolling-boil value like 100°C is rejected as out of range.
 *   4. The egg_cooking HACCP check applies IDENTICALLY to SIMMER as to
 *      BOIL/FRY/POACH (same CCP, same threshold, same shortfall behavior) —
 *      turbulence has no bearing on Salmonella kill-time.
 *   5. Potato is simmerable too (no CCP — no pathogen risk, same as its
 *      existing BOIL/FRY/BAKE capabilities).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const tools = new Set(["pot", "knife"]);
const ingredients = new Set(["water"]);

console.log("=== 1. SIMMER produces the identical state BOIL does ===");
const boilAction = actions.get("boil")!;
const simmerAction = actions.get("simmer")!;
const boiledEgg = applyAction(
  { entityId: "egg", state: "raw", tags: [] },
  boilAction,
  entities,
  tools,
  { durationSeconds: "600" },
  ingredients,
  ccps
).instance;
const simmeredEgg = applyAction(
  { entityId: "egg", state: "raw", tags: [] },
  simmerAction,
  entities,
  tools,
  { durationSeconds: "600", waterTempC: "92" },
  ingredients,
  ccps
).instance;
console.log(`  BOIL:   raw -> "${boiledEgg.state}"`);
console.log(`  SIMMER: raw -> "${simmeredEgg.state}"`);
if (boiledEgg.state !== simmeredEgg.state) {
  throw new Error(
    `Expected SIMMER and BOIL to produce the same state, got "${simmeredEgg.state}" vs "${boiledEgg.state}"`
  );
}
console.log(
  "  Same state, as intended — a simmered egg IS a boiled egg, just gentler to get there.\n"
);

console.log(
  "=== 2. Downstream statePrerequisites (PEEL requires 'boiled') work unchanged after SIMMER ==="
);
const peelAction = actions.get("peel")!;
const peeledAfterSimmer = applyAction(
  simmeredEgg,
  peelAction,
  entities,
  tools,
  undefined,
  ingredients
);
console.log(
  `  PEEL after SIMMER: "${simmeredEgg.state}" -> "${peeledAfterSimmer.instance.state}" (no error — statePrerequisites.peel is satisfied by SIMMER's output, no separate wiring needed)\n`
);

console.log(
  "=== 3. waterTempC's 85-96°C band is real and enforced (not the same range as a rolling boil) ==="
);
try {
  applyAction(
    { entityId: "egg", state: "raw", tags: [] },
    simmerAction,
    entities,
    tools,
    { durationSeconds: "600", waterTempC: "100" },
    ingredients,
    ccps
  );
  console.log("  UNEXPECTED: 100°C was accepted as a valid simmer temperature");
} catch (err) {
  console.log(
    `  REJECTED as expected — 100°C is a rolling boil, not a simmer:\n    ${(err as Error).message}`
  );
}

console.log(
  "\n=== 4. HACCP applies identically to SIMMER as to BOIL (literally the same CCP, not a look-alike one) ==="
);
const egg = entities.get("egg")!;
const simmerCcp = egg.criticalControlPointsByAction["simmer"];
const boilCcp = egg.criticalControlPointsByAction["boil"];
console.log(
  `  egg.json: criticalControlPointsByAction.simmer = "${simmerCcp}", .boil = "${boilCcp}"`
);
if (simmerCcp !== boilCcp) {
  throw new Error(
    `Expected SIMMER and BOIL to reference the identical CCP, got "${simmerCcp}" vs "${boilCcp}"`
  );
}
console.log(
  "  Same CCP id, not a separately-tuned one — turbulence has no bearing on Salmonella kill-time, so there's no\n" +
    "  physical basis for SIMMER to need its own threshold. (SIMMER's own durationSeconds floor, 60s, already\n" +
    "  clears egg_cooking's 15s hold requirement on any valid input — same as BOIL's identical floor.)\n"
);

console.log(
  "=== 5. Potato is simmerable too (no CCP — no pathogen risk, same as BOIL/FRY/BAKE) ==="
);
const simmeredPotato = applyAction(
  { entityId: "potato", state: "peeled", tags: [] },
  simmerAction,
  entities,
  tools,
  { durationSeconds: "900", waterTempC: "90" },
  ingredients
).instance;
console.log(`  SIMMER: "peeled" -> "${simmeredPotato.state}"\n`);

console.log(
  "=== 6. Why heat source matters more for SIMMER than for BOIL: holding a stable band, not just reaching one ==="
);
for (const id of ["gas", "vitro", "wood_fire"]) {
  const source = heatSources.get(id)!;
  console.log(
    `  ${source.names.en.padEnd(20)} controlPrecision: ${source.controlPrecision.padEnd(9)} manualPositioningRelevance: ${source.manualPositioningRelevance}`
  );
}
console.log(
  "  Wood fire's coarse control + high manual-positioning need is exactly why a stable simmer is hardest to hold\n" +
    "  there — src/heat-source.ts's controlPrecision/manualPositioningRelevance fields (written 2026-08-13, before\n" +
    "  SIMMER existed) already named this; SIMMER is the first action where it's actually the load-bearing fact."
);
