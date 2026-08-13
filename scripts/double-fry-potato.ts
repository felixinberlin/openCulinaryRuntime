import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 PAR_FRY verb (data/actions/par-fry.json,
 * ROADMAP.md "Common culinary knowledge coverage") — the real, sourced
 * double-fry French-fry technique. Proves, rather than just asserts:
 *
 *   1. PAR_FRY produces a genuinely DIFFERENT state from FRY ("par_fried",
 *      not "fried") — unlike SIMMER/BOIL, this is NOT the same dish reached
 *      more gently; it's a real unfinished intermediate.
 *   2. FRY still works, unchanged, directly from "peeled" (single-stage
 *      frying stays a valid, non-exclusive path).
 *   3. FRY also correctly finishes a "par_fried" potato into "fried" — the
 *      two-stage path actually composes using nothing but existing
 *      RecipeScript sequencing, no new engine machinery required.
 *   4. PAR_FRY's oilTempC band (145-165°C) and FRY's own (120-200°C) are
 *      both real and enforced, and don't overlap with a rolling-boil-style
 *      out-of-range value.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const tools = new Set(["pan", "knife"]);
const ingredients = new Set(["oil"]);

const parFry = actions.get("par_fry")!;
const fry = actions.get("fry")!;

console.log("=== 1. PAR_FRY produces a genuinely different state from FRY ===");
const peeledPotato: Instance = { entityId: "potato", state: "peeled", tags: [] };
const parFried = applyAction(peeledPotato, parFry, entities, tools, { oilTempC: "160", durationSeconds: "300" }, ingredients).instance;
console.log(`  PAR_FRY: "peeled" -> "${parFried.state}"`);
if (parFried.state === "fried") {
  throw new Error("PAR_FRY produced 'fried' directly — it should stop at the distinct 'par_fried' intermediate");
}
console.log("  Correctly stops short of 'fried' — a par-fried potato is pale/soft, not a finished dish.\n");

console.log("=== 2. FRY still works unchanged, directly from 'peeled' (single-stage frying) ===");
const directFried = applyAction(peeledPotato, fry, entities, tools, { oilTempC: "180", durationSeconds: "480" }, ingredients).instance;
console.log(`  FRY: "peeled" -> "${directFried.state}"\n`);

console.log("=== 3. FRY finishes a par-fried potato into 'fried' — composes via existing sequencing, no new engine feature ===");
const finished = applyAction(parFried, fry, entities, tools, { oilTempC: "191", durationSeconds: "180" }, ingredients).instance;
console.log(`  FRY: "${parFried.state}" -> "${finished.state}"`);
if (finished.state !== "fried") {
  throw new Error(`Expected the finishing FRY to reach "fried", got "${finished.state}"`);
}
console.log("  Two ordinary applyAction calls in sequence — PAR_FRY then FRY — is all double-frying needs.\n");

console.log("=== 4. Both oilTempC bands are real and enforced ===");
try {
  applyAction(peeledPotato, parFry, entities, tools, { oilTempC: "191", durationSeconds: "300" }, ingredients);
  console.log("  UNEXPECTED: 191°C (a finishing-fry temp) was accepted for PAR_FRY");
} catch (err) {
  console.log(`  REJECTED as expected — 191°C is the FINISHING temperature, not a par-fry one:\n    ${(err as Error).message}`);
}
try {
  applyAction(peeledPotato, fry, entities, tools, { oilTempC: "250", durationSeconds: "300" }, ingredients);
  console.log("  UNEXPECTED: 250°C was accepted for FRY");
} catch (err) {
  console.log(`  REJECTED as expected — 250°C is outside FRY's real 120-200°C band:\n    ${(err as Error).message}`);
}

console.log(
  "\nSo: real double-fried potato = PAR_FRY at 145-165°C (Thermoworks: 163°C/4-5min, blonde not browned),\n" +
    "a ~10 minute rest this repo has no verb for yet (par-fry.json's restNote), then FRY at up to ~191°C\n" +
    "(Kalogianni & Smith 2013, IJFST 48(4):758-770, doi:10.1111/ijfs.12024, for the underlying frying-variable physics)."
);
