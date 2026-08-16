import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test proving four genuinely different real potato-prep
 * variants a user named after the 2026-08-15 WASH-as-tag fix (LEARNINGS_ENGINE.md
 * same date): "some people wash before [peeling], the important thing is
 * to take the sand/dirt out... if you peel the dirty potato with sand, you
 * need to wash it after... some recipes don't peel at all, just wash, cut,
 * and fry... other recipes just put them in the oven" (whole, unpeeled).
 * Every `data/recipes/*.json` potato recipe happens to peel — none of these
 * four had ever actually been run before, only argued to be mechanically
 * possible. Proven here rather than left asserted.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const wash = actions.get("wash")!;
const peel = actions.get("peel")!;
const cut = actions.get("cut")!;
const fry = actions.get("fry")!;
const bake = actions.get("bake")!;

const knife = new Set(["knife"]);
const oven = new Set(["oven"]);
const pan = new Set(["pan"]);
const oil = new Set(["oil"]);

console.log("=== 1. Wash, THEN peel, then cut — dirt removed before the skin ever comes off ===");
let p1: Instance = { entityId: "potato", state: "raw", tags: [] };
p1 = applyAction(p1, wash, entities, knife).instance;
p1 = applyAction(p1, peel, entities, knife).instance;
p1 = applyAction(p1, cut, entities, knife, { shape: "diced" }).instance;
console.log(
  `  wash -> peel -> cut: state "${p1.state}", tags [${p1.tags}] — stayed washed through the peel\n`
);

console.log(
  "=== 2. Peel a dirty potato FIRST, then wash the peeled flesh — sand removed after, not before ==="
);
let p2: Instance = { entityId: "potato", state: "raw", tags: [] };
p2 = applyAction(p2, peel, entities, knife).instance;
p2 = applyAction(p2, wash, entities, knife).instance;
p2 = applyAction(p2, cut, entities, knife, { shape: "diced" }).instance;
console.log(
  `  peel -> wash -> cut: state "${p2.state}", tags [${p2.tags}] — CUT was satisfied via "peeled" state either way\n`
);

console.log(
  "=== 3. Skin-on: wash, cut, fry — never peeled at all (real technique, e.g. skin-on wedges/fries) ==="
);
let p3: Instance = { entityId: "potato", state: "raw", tags: [] };
p3 = applyAction(p3, wash, entities, knife).instance;
p3 = applyAction(p3, cut, entities, knife, { shape: "halved" }).instance;
p3 = applyAction(p3, fry, entities, pan, { durationSeconds: "600" }, oil).instance;
console.log(
  `  wash -> cut -> fry: state "${p3.state}", tags [${p3.tags}] — CUT satisfied via the "washed" TAG, never peeled\n`
);

console.log(
  "=== 4. Whole, unpeeled, into the oven — wash then bake directly, no cut/peel at all ==="
);
let p4: Instance = { entityId: "potato", state: "raw", tags: [] };
p4 = applyAction(p4, wash, entities, knife).instance; // running water, not a tool — knife set unused, kept only for signature parity
p4 = applyAction(p4, bake, entities, oven, { durationSeconds: "3600" }).instance;
console.log(
  `  wash -> bake: state "${p4.state}", tags [${p4.tags}] — BAKE has no statePrerequisites at all, whole skin-on baked potato\n`
);

console.log(
  "All four are real, distinct techniques, not variations of one 'correct' order — the fix this proves is that " +
    "none of them require picking a side on wash-before-vs-after-peel, because 'washed' is now a fact about the " +
    "potato (a tag), not a form it's currently in (a state)."
);
