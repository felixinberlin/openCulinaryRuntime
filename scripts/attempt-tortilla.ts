import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Originally an empirical capability test (2026-08-12) that PROVED, by
 * trying and failing, that the vocabulary couldn't make a tortilla de
 * patatas: two real components (fried potato, beaten egg) were makeable,
 * but nothing combined two instances into one, and no FLIP verb existed.
 * See ROADMAP.md's capability-test table and LEARNINGS_PROCESS.md's 2026-08-12
 * entry for the original findings.
 *
 * Both gaps are now closed (data/actions/combine.json, data/actions/
 * flip.json, data/entities/tortilla_mixture.json) — this script is kept,
 * updated, as a standing regression check that they STAY closed, rather
 * than deleted or left claiming "BLOCKED" after the fact (which would be
 * exactly the stale-docs failure mode CLAUDE.md warns against). The
 * canonical, full recipe is data/recipes/tortilla-de-patatas.json — run it
 * with `npm run recipe -- tortilla_de_patatas`. This script is the narrower
 * "does the vocabulary itself still support it" check.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const tools = new Set(["knife", "pan", "bowl"]);
const ingredients = new Set(["oil", "salt"]);

function apply(instance: Instance, actionId: string, params?: Record<string, string>) {
  const action = actions.get(actionId)!;
  const result = applyAction(instance, action, entities, tools, params, ingredients, ccps);
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  for (const warning of result.warnings) console.log(`  WARNING: ${warning.slice(0, 100)}...`);
  return result;
}

console.log("--- Potato component ---");
let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
potato = apply(potato, "peel").instance;
potato = apply(potato, "cut", { shape: "sliced" }).instance;
potato = apply(potato, "fry", { heatLevel: "low", durationSeconds: "900" }).instance;
console.log(`  Potato component done: "${potato.state}" (soft-fried, unbrowned)`);

console.log("\n--- Egg component ---");
const crackResult = applyAction(
  { entityId: "egg", state: "raw", tags: [] },
  actions.get("crack")!,
  entities,
  tools,
  {},
  ingredients
);
let egg = crackResult.spawned.find((s) => s.entityId === "egg_cracked")!;
console.log(`  CRACK: spawned egg_cracked ("${egg.state}")`);
egg = apply(egg, "beat", { intensity: "beaten" }).instance;
egg = apply(egg, "salt").instance;
console.log(`  Egg component done: "${egg.state}", tags [${egg.tags}]`);

console.log("\n--- Combine: potato (target) + egg (secondary) -> tortilla_mixture ---");
const combineAction = actions.get("combine")!;
const combineResult = applyAction(
  potato,
  combineAction,
  entities,
  tools,
  {},
  new Set(),
  new Map(),
  undefined,
  egg
);
if (!combineResult.destroyed || !combineResult.secondaryDestroyed) {
  throw new Error("Expected COMBINE to consume BOTH the potato and the egg instance");
}
let tortilla = combineResult.spawned.find((s) => s.entityId === "tortilla_mixture")!;
if (!tortilla) throw new Error("Expected COMBINE to spawn tortilla_mixture");
console.log(
  `  Both potato and egg instances consumed. Spawned tortilla_mixture ("${tortilla.state}").`
);

console.log("\n--- Fry, flip, fry again ---");
tortilla = apply(tortilla, "fry", { heatLevel: "medium", durationSeconds: "180" }).instance;
tortilla = apply(tortilla, "flip").instance;
tortilla = apply(tortilla, "fry", { heatLevel: "medium", durationSeconds: "120" }).instance;

console.log("\n=== VERDICT ===");
console.log(
  `Tortilla de patatas: state "${tortilla.state}", tags [${tortilla.tags}]. Fully makeable end-to-end.`
);
console.log(
  "Original blockers (no multi-instance merge, no FLIP) are closed. Not closed by this change:"
);
console.log(
  "real robot control/perception for heatLevel/doneness/etc. — see ENGINE_INVARIANTS.md #11."
);
