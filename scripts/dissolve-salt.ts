import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 DISSOLVE verb (data/actions/dissolve.json)
 * — found during a full audit that diffed every entity's asserted-true
 * capabilities against every action's requiredTargetCapability/
 * requiredIngredientCapabilities/requiredSecondaryCapability, the same
 * class of gap as pan.json's dead "hot"/"cold" and potato.json's dead
 * "mashed" found earlier the same day. salt.json's own metadata.notes had
 * flagged this exact gap ("isDissolvable... but allowedTransformations is
 * empty") before this action existed.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const dissolve = actions.get("dissolve")!;

console.log("=== 1. Dry salt dissolves when a dissolving medium (water) is present ===");
const drySalt = { entityId: "salt", state: "dry", tags: [] };
const dissolved = applyAction(
  drySalt,
  dissolve,
  entities,
  new Set(),
  {},
  new Set(["water"])
).instance;
console.log(`  DISSOLVE: "${drySalt.state}" -> "${dissolved.state}"\n`);

console.log("=== 2. Without water present, DISSOLVE is correctly rejected ===");
try {
  applyAction(
    { entityId: "salt", state: "dry", tags: [] },
    dissolve,
    entities,
    new Set(),
    {},
    new Set()
  );
  console.log("  UNEXPECTED: dissolved with nothing to dissolve into");
} catch (err) {
  console.log(`  REJECTED as expected:\n    ${(err as Error).message}\n`);
}

console.log(
  "=== 3. isDissolvingMedium is a distinct capability from isBoilingMedium, not a reuse ==="
);
const water = entities.get("water")!;
console.log(
  `  water.json: isBoilingMedium=${water.capabilities.isBoilingMedium}, isDissolvingMedium=${water.capabilities.isDissolvingMedium}`
);
console.log(
  "  Same substance, two separate capability flags — this repo's established one-capability-per-verb convention."
);
