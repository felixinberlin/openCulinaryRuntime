import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Proves MARINATE (data/actions/marinate.json) — closed 2026-08-17,
 * ROADMAP.md's "More common technique verbs" gap. Three real entities,
 * three genuinely different real starting points AND timescales — not
 * built against onion alone:
 *
 * 1. Onion (sliced) — the flagship quick-pickle case, ~30 minutes.
 * 2. Garlic (peeled cloves) — pickled garlic, a different real prep
 *    (individual cloves, not the whole-bulb technique ROAST/GRILL use).
 * 3. Egg (peeled, hard-boiled) — British pub pickled eggs, DAYS not
 *    minutes — proving marinate.json's own deliberately wide
 *    durationSeconds range (30min-10 days) is real, not padding.
 *
 * Also proves MARINATE is mechanically, not just rhetorically, distinct
 * from ACID (data/actions/acid.json): ACID succeeds instantly with no
 * duration; MARINATE requires a real durationSeconds parameter.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const marinate = actions.get("marinate")!;
const acid = actions.get("acid")!;
const TOOLS = new Set(["bowl"]);
const VINEGAR = new Set(["vinegar"]);

console.log("1. MARINATE across three real, genuinely different starting points and timescales:\n");
for (const [entityId, startState, durationSeconds, label] of [
  ["onion", "sliced", "1800", "30 min — quick-pickled onion"],
  ["garlic", "peeled", "259200", "3 days — pickled garlic cloves"],
  ["egg", "peeled", "864000", "10 days — British pub pickled egg"],
] as const) {
  const instance: Instance = { entityId, state: startState, tags: [] };
  const result = applyAction(instance, marinate, entities, TOOLS, { durationSeconds }, VINEGAR, ccps);
  console.log(`  ${entityId} ("${startState}", ${label}): MARINATE -> "${result.instance.state}"`);
}

console.log(
  "\n2. MARINATE vs. ACID — mechanically distinct, not the same verb renamed: ACID succeeds instantly with " +
    "no duration; MARINATE requires a real, declared durationSeconds:\n"
);
const acidResult = applyAction(
  { entityId: "onion", state: "sliced", tags: [] },
  acid,
  entities,
  new Set(),
  {},
  VINEGAR
);
console.log(`  ACID (no duration given): succeeds instantly — tags [${acidResult.instance.tags}]`);
try {
  applyAction({ entityId: "onion", state: "sliced", tags: [] }, marinate, entities, TOOLS, { durationSeconds: "5" }, VINEGAR);
  console.log("  Unexpected: MARINATE with a 5-second duration should have been rejected (below its own declared minimum).");
} catch (e) {
  console.log(`  MARINATE with a 5-second duration: REJECTED — ${(e as Error).message}`);
}

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no elapsed-real-world-time or " +
    "refrigeration-duration tracking anywhere in this engine — 'marinated for 10 days, refrigerated' is an " +
    "authored fact, never verified; no place.ts wiring; the real food-safety CONTRAST between acid-marinated " +
    "(vinegar's own preservation-grade acidity) and oil-infused (infuse.json's real botulism risk) is named in " +
    "marinate.json's own foodSafetyNote but not modeled as any kind of check."
);
