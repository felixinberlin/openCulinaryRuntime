import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 "complete potato" pass — closing three
 * gaps found by actually testing the edges rather than assuming coverage
 * (ROADMAP.md's "Common culinary knowledge coverage"):
 *
 *   1. Skin-on cuts (rustic wedges/fries) were IMPOSSIBLE — CUT hard-required
 *      "peeled". statePrerequisites now accepts an array of acceptable
 *      prior states (ingredient.ts), so potato.json's cut is ["washed",
 *      "peeled"] — either path is legal. ("washed" moved from a state to a
 *      tag 2026-08-15 — engine.ts's check now matches either — see the
 *      synthetic instance below, built with a tag rather than a state.)
 *   2. GRATE (hash browns/rösti) didn't exist at all — its own verb/tool
 *      (grater.json), not folded into CUT's shape enum (a grater and a
 *      knife are physically different mechanisms).
 *   3. MASH didn't exist — "mashed" had been a dead, unreachable
 *      possibleState since the very first potato.json. Requires the potato
 *      already be "boiled" OR "baked" (the same array mechanism), and a
 *      mashed potato can still be FRYed afterward with zero further engine
 *      changes (FRY has no statePrerequisites at all).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const tools = new Set(["knife", "grater", "masher", "pan", "pot", "oven"]);
const ingredients = new Set(["oil", "water"]);

const cut = actions.get("cut")!;
const grate = actions.get("grate")!;
const mash = actions.get("mash")!;
const boil = actions.get("boil")!;
const bake = actions.get("bake")!;
const fry = actions.get("fry")!;

console.log("=== 1. Skin-on cut: washed (NOT peeled) potato can now be cut ===");
const washed: Instance = { entityId: "potato", state: "raw", tags: ["washed"] };
const skinOnWedges = applyAction(washed, cut, entities, tools, { shape: "diced" }).instance;
console.log(
  `  CUT (skin-on): "raw" (tags [washed]) -> "${skinOnWedges.state}" — rustic wedges/skin-on fries are now representable\n`
);

console.log("=== 2. Peeled path still works unchanged (backward compatible) ===");
const peeled: Instance = { entityId: "potato", state: "peeled", tags: [] };
const peeledCut = applyAction(peeled, cut, entities, tools, { shape: "diced" }).instance;
console.log(`  CUT (peeled): "peeled" -> "${peeledCut.state}"\n`);

console.log(
  "=== 3. A raw (unwashed) potato still can't be cut — the prerequisite still means something ==="
);
try {
  applyAction({ entityId: "potato", state: "raw", tags: [] }, cut, entities, tools, {
    shape: "diced",
  });
  console.log("  UNEXPECTED: raw potato was cuttable");
} catch (err) {
  console.log(`  REJECTED as expected:\n    ${(err as Error).message}\n`);
}

console.log("=== 4. GRATE — its own verb/tool, for hash browns/rösti ===");
const grated = applyAction(washed, grate, entities, tools, {}).instance;
console.log(`  GRATE: "raw" (tags [washed]) -> "${grated.state}"\n`);

console.log("=== 5. MASH — 'mashed' was a dead label until today; both real paths now work ===");
const boiledPotato = applyAction(
  peeled,
  boil,
  entities,
  tools,
  { durationSeconds: "900" },
  ingredients
).instance;
const mashedFromBoiled = applyAction(boiledPotato, mash, entities, tools, {
  consistency: "smooth",
}).instance;
console.log(`  BOIL then MASH: "peeled" -> "${boiledPotato.state}" -> "${mashedFromBoiled.state}"`);

const bakedPotato = applyAction(peeled, bake, entities, tools, {
  durationSeconds: "3600",
}).instance;
const mashedFromBaked = applyAction(bakedPotato, mash, entities, tools, {
  consistency: "chunky",
}).instance;
console.log(`  BAKE then MASH: "peeled" -> "${bakedPotato.state}" -> "${mashedFromBaked.state}"\n`);

console.log(
  "=== 6. A raw potato still can't be mashed — MASH's prerequisite is real, not decorative ==="
);
try {
  applyAction({ entityId: "potato", state: "raw", tags: [] }, mash, entities, tools, {
    consistency: "smooth",
  });
  console.log("  UNEXPECTED: raw potato was mashable");
} catch (err) {
  console.log(`  REJECTED as expected:\n    ${(err as Error).message}\n`);
}

console.log(
  "=== 7. Mashed potato can still be FRYed — zero further engine changes needed (FRY has no prerequisite) ==="
);
const friedMash = applyAction(
  mashedFromBoiled,
  fry,
  entities,
  tools,
  { oilTempC: "180", durationSeconds: "300" },
  ingredients
).instance;
console.log(
  `  FRY: "${mashedFromBoiled.state}" -> "${friedMash.state}" — a simple potato-cake/leftover-mash technique, real and representable\n`
);

console.log(
  "Still NOT representable, named honestly rather than implied covered: a true breaded croquette\n" +
    "(mash -> shape -> bread/batter -> fry) — no coating/breading mechanism exists in this vocabulary yet."
);
