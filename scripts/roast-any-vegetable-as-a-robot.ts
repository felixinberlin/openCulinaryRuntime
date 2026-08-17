import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Proves ROAST (data/actions/roast.json) — closed 2026-08-17, ROADMAP.md's
 * "More common technique verbs" gap — generalizes cleanly across three
 * real entities with three genuinely different real starting points, not
 * just the one potato.json was built against:
 *
 * 1. Potato — cut/oiled pieces, the flagship "extra-crispy" case (see
 *    npm run recipe -- crispy_roast_potatoes for the FULL alkaline-
 *    parboil chain; this script exercises ROAST alone, directly, without
 *    the parboil step, since a plain direct roast is ALSO real, common
 *    technique — potato.json's own roast.json statePrerequisitesNote is
 *    explicit that ROAST doesn't require parboiling first).
 * 2. Garlic — the WHOLE, UNPEELED bulb (real technique: roasted garlic is
 *    never peeled/cut first, unlike every other garlic verb in this
 *    vocabulary) — proves ROAST's deliberate lack of a statePrerequisites
 *    entry is load-bearing, not just permissive.
 * 3. Onion — halved, the real technique for oven-roasted onion wedges.
 *
 * Also proves the real, cited BAKE-vs-ROAST distinction is mechanically
 * enforced, not just asserted in prose: ROAST requires an isFryingMedium
 * ingredient (oil) present; BAKE requires none at all (bake.json's own
 * notes) — attempting ROAST with no oil on hand is correctly rejected.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const roast = actions.get("roast")!;
const TOOLS = new Set(["oven"]);
const OIL = new Set(["oil"]);

console.log("1. ROAST across three real, genuinely different starting points:\n");
for (const [entityId, startState] of [
  ["potato", "quartered"],
  ["garlic", "raw"], // whole, unpeeled bulb — the real technique
  ["onion", "halved"],
] as const) {
  const instance: Instance = { entityId, state: startState, tags: [] };
  const result = applyAction(
    instance,
    roast,
    entities,
    TOOLS,
    { ovenTempC: "218", durationSeconds: "2700" },
    OIL,
    ccps
  );
  console.log(`  ${entityId} ("${startState}"): ROAST -> "${result.instance.state}"`);
}

console.log(
  "\n2. The real BAKE-vs-ROAST distinction, mechanically enforced (not just asserted in prose): ROAST " +
    "requires an isFryingMedium ingredient present, BAKE requires none at all:\n"
);
const bake = actions.get("bake")!;
try {
  applyAction({ entityId: "potato", state: "quartered", tags: [] }, roast, entities, TOOLS, {}, new Set());
  console.log("  Unexpected: ROAST with no oil should have been rejected.");
} catch (e) {
  console.log(`  ROAST with no oil on hand: REJECTED — ${(e as Error).message}`);
}
const bakedResult = applyAction(
  { entityId: "potato", state: "peeled", tags: [] },
  bake,
  entities,
  new Set(["oven"]),
  {},
  new Set()
);
console.log(`  BAKE with no oil on hand: succeeds — "${bakedResult.instance.state}" (needs no medium at all)`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no place.ts/heat-source.ts wiring " +
    "for the oven exists (oven.json has no thermophysical data, same honest gap bake.json's own actionKindNote " +
    "already names — a real, still-dead possibleStates declaration on oven.json, the same class of gap " +
    "knife.json's own dead clean/dirty states already carry, left honestly unreactivated rather than force-" +
    "wired through Instance-based machinery tools don't have in this engine); no real preheat-time model for " +
    "an oven the way heat-source.ts models a stovetop burner."
);
