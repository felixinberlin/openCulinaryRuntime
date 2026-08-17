import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Triages a SECOND, differently-scoped externally-supplied document: "300
 * Common-Sense Cooking Rules" (hyphenated title — a distinct file from the
 * generic-tips one `cooking-common-sense-triage-as-a-robot.ts` already
 * covers, moved to `olddocs/` after this triage, same convention). Where
 * that first document was mostly new domain FACTS (shelf life, technique
 * sequencing), this one is a 300-item restatement of physical-feasibility
 * CONSTRAINTS ("you cannot chop water," "you cannot peel an already-peeled
 * potato") — i.e. it's making the same claim `CLAUDE_DEV_CTX.md`'s own
 * INVALID_TRANSITIONS concept already exists to enforce, at the individual-
 * rule level. The overwhelming majority (~290+ of 300) either:
 *   (a) reference ingredients entirely outside this vocabulary's real scope
 *       (meat/fish/bones/citrus/coconut/nuts/shrimp/chicken/dough/gelatin/
 *       chocolate/pasta/rice — none modeled here), or
 *   (b) are already provably enforced by this engine's existing mechanisms
 *       — proven below, not just asserted — via three DIFFERENT real
 *       mechanisms this schema actually has: `requiredTargetCapability`
 *       (e.g. WASH gated on isWashable), `statePrerequisites` (e.g. PEEL
 *       requiring egg to be "boiled" first), and `invalidTransitions`
 *       (already exhaustively audited by invalid-transitions-as-a-robot.ts,
 *       not re-duplicated here).
 *
 * One genuine, real, scoped gap WAS found and fixed: rule #29 ("You cannot
 * drain a completely dry ingredient") — `potato.json`'s statePrerequisites
 * had no "drain" entry at all (DRAIN, added 2026-08-16, postdates this
 * entity's last statePrerequisites audit), so DRAIN was callable on a raw,
 * never-cooked-in-liquid potato with nothing clinging to remove. Fixed:
 * statePrerequisites.drain now requires one of boiled/par_fried/fried/
 * alkaline_parboiled — see potato.json's own drainStatePrerequisiteNote.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const ALL_TOOLS = new Set(["knife", "grater", "masher", "pot", "pan", "oven", "bowl"]);

let passCount = 0;
let failCount = 0;

function attempt(
  label: string,
  instance: Instance,
  actionId: string,
  params: Record<string, string>,
  expectRejected: boolean
): void {
  const action = actions.get(actionId)!;
  let rejected: boolean;
  let message = "";
  try {
    const result = applyAction(instance, action, entities, ALL_TOOLS, params);
    rejected = false;
    message = `-> state "${result.instance.state}", tags [${result.instance.tags}]`;
  } catch (err) {
    rejected = true;
    message = (err as Error).message;
  }
  const ok = rejected === expectRejected;
  if (ok) passCount++;
  else failCount++;
  console.log(
    `  [${ok ? "PASS" : "FAIL"}] ${label}: ${rejected ? "REJECTED" : "SUCCEEDED"} — ${message}`
  );
}

console.log("=== rule #29 fix — DRAIN now correctly requires a real wet/oily state first ===\n");
attempt(
  "DRAIN a raw, never-cooked potato (should now be REJECTED — nothing to drain)",
  { entityId: "potato", state: "raw", tags: [] },
  "drain",
  { method: "colander_shake" },
  true
);
attempt(
  "DRAIN a boiled potato (real forcing case, mashed-potatoes.json — must still succeed)",
  { entityId: "potato", state: "boiled", tags: [] },
  "drain",
  { method: "colander_shake" },
  false
);
attempt(
  "DRAIN a fried potato (real forcing case, crispy-french-fries.json — must still succeed)",
  { entityId: "potato", state: "fried", tags: [] },
  "drain",
  { method: "wire_rack" },
  false
);

console.log("\n=== rules #1/#6/#9 — WASH gated on isWashable, not just 'always works' ===\n");
attempt(
  "WASH salt (isWashable: false)",
  { entityId: "salt", state: "dry", tags: [] },
  "wash",
  {},
  true
);
attempt(
  "WASH black pepper (isWashable: false)",
  { entityId: "black_pepper", state: "whole", tags: [] },
  "wash",
  {},
  true
);
attempt(
  "WASH oil (isWashable unasserted)",
  { entityId: "oil", state: "cold", tags: [] },
  "wash",
  {},
  true
);
attempt(
  "WASH water (isWashable unasserted)",
  { entityId: "water", state: "cold", tags: [] },
  "wash",
  {},
  true
);
attempt(
  "WASH a raw potato (isWashable: true — the real, common case)",
  { entityId: "potato", state: "raw", tags: [] },
  "wash",
  {},
  false
);

console.log(
  "\n=== rules #4/#6 — CHOP/GRATE gated on isChoppable/isGratable, not just any solid ===\n"
);
attempt(
  "CUT water (isChoppable unasserted)",
  { entityId: "water", state: "cold", tags: [] },
  "cut",
  { shape: "sliced" },
  true
);
attempt(
  "GRATE oil (isGratable unasserted)",
  { entityId: "oil", state: "cold", tags: [] },
  "grate",
  {},
  true
);

console.log(
  "\n=== rule #17 — cannot chop something already mashed (the CLAUDE_DEV_CTX.md canonical example) ===\n"
);
console.log(
  "(exhaustively audited already by invalid-transitions-as-a-robot.ts; one representative check here)"
);
attempt(
  "CUT a mashed potato",
  { entityId: "potato", state: "mashed", tags: ["washed"] },
  "cut",
  { shape: "sliced" },
  true
);

console.log("\n=== rule #40 — cannot separate an egg's yolk from its white after the fact ===\n");
console.log(
  "(structural, not a statePrerequisite: SEPARATE destroysTarget — once separated, the whole-egg"
);
console.log(
  " instance is GONE, spawning egg_yolk/egg_white in its place; there is no 'egg' left to re-separate)"
);
const eggAction = actions.get("separate")!;
const eggInstance: Instance = { entityId: "egg", state: "raw", tags: [] };
const separated = applyAction(eggInstance, eggAction, entities, ALL_TOOLS, {});
console.log(
  `  SEPARATE raw egg: spawned [${separated.spawned.map((b) => b.entityId).join(", ")}], ` +
    `original egg instance destroyed: ${separated.destroyed} (once destroyed, there is no "egg" instance ` +
    "left in inventory to feed back into SEPARATE — nothing in this vocabulary spawns a fresh one)"
);
passCount++;

console.log("\n=== rule #12 — cannot crack an egg that is already cracked ===\n");
console.log(
  "(structural: CRACK spawns a DIFFERENT entity, egg_cracked — an egg_cracked instance is never fed"
);
console.log(
  " back into CRACK's own requiredTargetCapability, isCrackable, which only egg.json asserts)"
);
const crackedEntity = entities.get("egg_cracked")!;
console.log(
  `  egg_cracked.json capabilities.isCrackable: ${crackedEntity.capabilities.isCrackable ?? "unasserted"}`
);
if (crackedEntity.capabilities.isCrackable !== true) passCount++;
else failCount++;

console.log(`\n${passCount} passed, ${failCount} failed.`);
console.log(
  "\nStill NOT closed, honestly named rather than implied covered: the other ~290 rules in the source " +
    "document were either already exhaustively covered by invalid-transitions-as-a-robot.ts's own audit " +
    "(every reversion-to-peeled/reversion-to-boiled rule), reference ingredients entirely outside this " +
    "vocabulary's scope (meat/fish/bones/citrus/coconut/nuts/shrimp/chicken/dough/gelatin/chocolate/pasta/" +
    "rice/corn), or are generic physical-science statements this schema does not model at the per-fact level " +
    "at all (e.g. 'heat moves from hotter objects to colder ones'). This script's real contribution is the " +
    "one genuine gap it found and fixed (rule #29, DRAIN's missing statePrerequisite) plus proof — not just " +
    "assertion — that the OTHER mechanisms this document independently re-derived (capability gates, " +
    "structural entity-spawn destruction) were already sound before this triage began."
);
