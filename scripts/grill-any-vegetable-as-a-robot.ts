import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Proves GRILL (data/actions/grill.json) — closed 2026-08-17, ROADMAP.md's
 * "More common technique verbs" gap. Generalizes across the same three
 * real entities ROAST already proved (potato/garlic/onion), each with a
 * real, genuinely different starting point, plus a direct side-by-side
 * against ROAST showing the two verbs are mechanically distinct tools
 * (`grill` vs `oven`), not the same action renamed.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const grill = actions.get("grill")!;
const roast = actions.get("roast")!;
const OIL = new Set(["oil"]);

console.log("1. GRILL across three real, genuinely different starting points:\n");
for (const [entityId, startState] of [
  ["potato", "quartered"],
  ["garlic", "raw"], // whole, unpeeled bulb — real technique, same as ROAST
  ["onion", "quartered"],
] as const) {
  const instance: Instance = { entityId, state: startState, tags: [] };
  const result = applyAction(
    instance,
    grill,
    entities,
    new Set(["grill"]),
    { grillTempC: "218", durationSeconds: "900" },
    OIL,
    ccps
  );
  console.log(`  ${entityId} ("${startState}"): GRILL -> "${result.instance.state}"`);
}

console.log(
  "\n2. GRILL and ROAST are mechanically distinct tools, not the same action renamed — GRILL rejects an " +
    "oven-only kitchen, ROAST rejects a grill-only one:\n"
);
try {
  applyAction(
    { entityId: "potato", state: "quartered", tags: [] },
    grill,
    entities,
    new Set(["oven"]),
    {},
    OIL
  );
  console.log("  Unexpected: GRILL with only an oven (no grill) should have been rejected.");
} catch (e) {
  console.log(`  GRILL with only an oven on hand: REJECTED — ${(e as Error).message}`);
}
try {
  applyAction(
    { entityId: "potato", state: "quartered", tags: [] },
    roast,
    entities,
    new Set(["grill"]),
    {},
    OIL
  );
  console.log("  Unexpected: ROAST with only a grill (no oven) should have been rejected.");
} catch (e) {
  console.log(`  ROAST with only a grill on hand: REJECTED — ${(e as Error).message}`);
}

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no place.ts/heat-source.ts wiring " +
    "for the grill (grill.json has no thermophysical data, same honest gap oven.json's own actionKindNote " +
    "already names for its own tool); no char/smoke-flavor modeling beyond the verification.description string " +
    "— purely categorical, same depth limit as every other technique verb in this vocabulary."
);
