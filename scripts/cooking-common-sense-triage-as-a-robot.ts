import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Proves the real, actionable findings from triaging the externally-
 * supplied "300 Common Sense Cooking Rules" document (2026-08-17, moved
 * to olddocs/ after this triage — same convention as every other external
 * report this repo has reviewed). Most of the 300 rules were either
 * already covered by this repo's own existing, cited work (confirmed, not
 * re-built — see this script's own closing summary), out of this
 * vocabulary's real ingredient scope (meat/fish/baking-with-flour), or
 * generic kitchen-safety advice this schema doesn't model at the
 * per-technique level. Three genuinely new, real, cited gaps were found
 * and closed:
 *
 * 1. Rule #253 — steam-dry a boiled potato before mashing (DRAIN then a
 *    brief REST, generalizing both verbs beyond their original oil/fry
 *    forcing cases). This repo's first real recipe to actually exercise
 *    MASH.
 * 2. Rule #255 — piercing a whole potato before baking, checked and
 *    honestly CALIBRATED (real but rare risk for oven baking, per the
 *    same Idaho Potato Commission already cited elsewhere in this repo)
 *    rather than overstated as a routine hazard.
 * 3. Rule #113/#99 — whole vs. ground black pepper's real, dramatically
 *    different shelf life, closing black_pepper.json's own long-standing
 *    flavorChemistryNote admission that no shelf-life mechanic existed.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

console.log(
  "1. DRAIN and REST generalized beyond their original oil/fry forcing case — a boiled potato:\n"
);
const boiledPotato: Instance = { entityId: "potato", state: "boiled", tags: [] };
const drain = actions.get("drain")!;
const rest = actions.get("rest")!;
const mash = actions.get("mash")!;
const drained = applyAction(
  boiledPotato,
  drain,
  entities,
  new Set(),
  { method: "colander_shake" },
  new Set(),
  ccps
);
console.log(`  DRAIN(colander_shake) on boiled potato: tags [${drained.instance.tags}]`);
const rested = applyAction(
  drained.instance,
  rest,
  entities,
  new Set(),
  { durationSeconds: "60" },
  new Set(),
  ccps
);
console.log(
  `  REST for 60s (rest.json's own NEWLY WIDENED floor — was 120s): tags [${rested.instance.tags}]`
);
const mashed = applyAction(
  rested.instance,
  mash,
  entities,
  new Set(["masher"]),
  { consistency: "smooth" },
  new Set(),
  ccps
);
console.log(
  `  MASH: "${rested.instance.state}" -> "${mashed.instance.state}" — this repo's first real MASH proof`
);

console.log(
  "\n2. REST at the OLD 120s floor still works too (this widening is additive, not a breaking change) — and " +
    "below the new 60s floor is still correctly rejected:\n"
);
const oldFloorResult = applyAction(
  { entityId: "potato", state: "boiled", tags: [] },
  rest,
  entities,
  new Set(),
  { durationSeconds: "120" },
  new Set(),
  ccps
);
console.log(
  `  REST for 120s (the OLD floor): still succeeds — tags [${oldFloorResult.instance.tags}]`
);
try {
  applyAction(
    { entityId: "potato", state: "boiled", tags: [] },
    rest,
    entities,
    new Set(),
    { durationSeconds: "30" },
    new Set(),
    ccps
  );
  console.log("  Unexpected: a 30s rest should have been rejected (below the new 60s floor).");
} catch (e) {
  console.log(`  REST for 30s: REJECTED — ${(e as Error).message}`);
}

console.log(
  "\n3. Black pepper's real, dramatically different whole-vs-ground shelf life, now queryable:\n"
);
const blackPepper = entities.get("black_pepper")!;
for (const [state, life] of Object.entries(blackPepper.storageLifeByState)) {
  console.log(
    `  black_pepper "${state}": pantry ${life.pantryMonths?.min}-${life.pantryMonths?.max} months`
  );
}

console.log(
  "\nStill NOT closed, honestly named rather than implied covered: rule #255 (pierce before baking) is " +
    "recorded as informational technique context ONLY (potato.json's own pierceBeforeBakeNote) — deliberately " +
    "NOT added as a new HazardSchema entry, since the real, checked risk is rare for oven baking specifically, " +
    "and adding one would have overstated it; the great majority of the other 297 rules in the source document " +
    "were either already covered by this repo's own existing, independently-cited work (simmer-vs-boil, " +
    "carryover cooking, smoke points, cold-start potato boiling, flaky finishing salt — all confirmed, not " +
    "re-built), genuinely out of this vocabulary's current ingredient scope (meat/fish/yeasted baking), or " +
    "generic kitchen-safety/cleaning advice this schema does not model at the per-technique level at all."
);
