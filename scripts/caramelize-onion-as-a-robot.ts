import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { isTerminalState } from "../src/ingredient.ts";

/**
 * First end-to-end proof for onion.json/caramelize.json, added 2026-08-16
 * alongside the entity itself. Mirrors boil-potato-as-a-robot.ts's role for
 * potato.json: run the real pipeline against the real loaded data, not just
 * reason about it — the same discipline this session's PLACE/reachability
 * work repeatedly found real gaps by actually doing.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["knife", "pan", "pot"]);
const ingredients = new Set(["oil", "water"]);

console.log("Goal: raw onion -> peeled -> sliced -> caramelized, plus proving the real gates around it.\n");

// ---------------------------------------------------------------------
// 1. CARAMELIZE correctly REFUSED on a raw (not yet sliced/chopped) onion —
//    statePrerequisites.caramelize: ["sliced","chopped"] on onion.json.
// ---------------------------------------------------------------------
const tooEarly: Instance = { entityId: "onion", state: "raw", tags: [] };
try {
  applyAction(tooEarly, actions.get("caramelize")!, entities, tools, {}, ingredients, ccps);
  console.log("1. Unexpected: caramelizing a raw onion should have been rejected.");
} catch (e) {
  console.log(`1. CARAMELIZE on raw onion correctly REJECTED: ${(e as Error).message}\n`);
}

// ---------------------------------------------------------------------
// 2. The real path: PEEL -> CUT(sliced) -> CARAMELIZE.
// ---------------------------------------------------------------------
let onion: Instance = { entityId: "onion", state: "raw", tags: [] };
const peeled = applyAction(onion, actions.get("peel")!, entities, tools, {}, ingredients, ccps);
onion = peeled.instance;
console.log(`2. PEEL: "raw" -> "${onion.state}" (byproducts spawned: ${peeled.spawned.map((b) => b.entityId).join(", ") || "none"})`);

const sliced = applyAction(onion, actions.get("cut")!, entities, tools, { shape: "sliced" }, ingredients, ccps);
onion = sliced.instance;
console.log(`   CUT (sliced): "peeled" -> "${onion.state}"`);

const caramelized = applyAction(
  onion,
  actions.get("caramelize")!,
  entities,
  tools,
  { heatLevel: "low", durationSeconds: "1800", technique: "low_and_slow", doneness: "deep_caramel" },
  ingredients,
  ccps
);
onion = caramelized.instance;
console.log(`   CARAMELIZE (low_and_slow, 1800s): "sliced" -> "${onion.state}"\n`);

// ---------------------------------------------------------------------
// 3. invalidTransitions: caramelized onion correctly refuses to go back to
//    "peeled" (the 2026-08-16 audit's WEAKER-confidence entry).
// ---------------------------------------------------------------------
try {
  applyAction(onion, actions.get("peel")!, entities, tools, {}, ingredients, ccps);
  console.log("3. Unexpected: peeling an already-caramelized onion should have been rejected.");
} catch (e) {
  console.log(`3. PEEL on caramelized onion correctly REJECTED: ${(e as Error).message}\n`);
}

// ---------------------------------------------------------------------
// 4. Real exception: blanch-to-peel a BOILED onion — deliberately still
//    legal, the same real technique carve-out potato.json's own boiled
//    state gets (see onion.json's boiledPeeledNote).
// ---------------------------------------------------------------------
let pearlOnion: Instance = { entityId: "onion", state: "raw", tags: [] };
const boiled = applyAction(pearlOnion, actions.get("boil")!, entities, tools, {}, ingredients, ccps);
pearlOnion = boiled.instance;
const peeledAfterBoil = applyAction(pearlOnion, actions.get("peel")!, entities, tools, {}, ingredients, ccps);
console.log(`4. Blanch-then-peel: "raw" -> "${pearlOnion.state}" -> "${peeledAfterBoil.instance.state}" — correctly ALLOWED (pearl-onion technique).\n`);

// ---------------------------------------------------------------------
// 5. isTerminalState — burned is a dead end, overcooked is not.
// ---------------------------------------------------------------------
const onionEntity = entities.get("onion")!;
console.log(`5. isTerminalState(onion, "burned") = ${isTerminalState(onionEntity, "burned")} (expected true)`);
console.log(`   isTerminalState(onion, "overcooked") = ${isTerminalState(onionEntity, "overcooked")} (expected false)`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no tortilla-de-patatas-con-cebolla " +
    "recipe yet (COMBINE is still fixed to potato+egg only — see onion.json's combineScopeNote), and " +
    "durationSeconds/heatLevel/technique remain informational-only on CARAMELIZE, same non-enforcement " +
    "limit as every other timing/temperature parameter in this vocabulary."
);
