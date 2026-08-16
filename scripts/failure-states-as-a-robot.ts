import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { isTerminalState } from "../src/ingredient.ts";
import { explainRecipe } from "../src/recipe-explain.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * Capability test for TICKET 5 (`PAPER_NOTES_2608.04768.md`) — "burned"/
 * "overcooked" as real, reachable, terminal states. Proves three things a
 * dead vocabulary entry would not survive:
 *
 * 1. `isTerminalState` correctly identifies the failure states as terminal
 *    (and a normal state as NOT terminal).
 * 2. A real cooking action against a `"burned"` instance is REJECTED by
 *    `invalidTransitions`, the same mechanism (and the same rigor —
 *    per-entity, not global — `ROADMAP.md`'s `606f056`/`7d497d4`/`3e2050a`)
 *    every other forbidden transition in this repo already uses.
 * 3. A tag-only action (SALT) on the SAME burned instance still succeeds —
 *    the deliberate state-vs-tag distinction named in every entity's own
 *    `failureStateNote`, not a gap this script papers over.
 *
 * Deliberately does NOT attempt to detect burning — no timer, no
 * probability. The burned/overcooked instance below is AUTHORED directly,
 * the only way this repo can honestly reach these states today
 * (`ENGINE_INVARIANTS.md` #11 — a real perception layer is what would
 * actually assert this in a deployed system).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const potato = entities.get("potato")!;
const garlic = entities.get("garlic")!;

console.log("1. isTerminalState — burned is unconditionally terminal; overcooked is NOT (deliberately left able to");
console.log("   degrade further into burned — see each entity's own failureStateNote); a normal state is neither:");
console.log(`   potato "burned": ${isTerminalState(potato, "burned")}`);
console.log(`   potato "overcooked": ${isTerminalState(potato, "overcooked")} (terminal for RECOVERY, not absolutely)`);
console.log(`   potato "boiled" (normal, reversible-ish): ${isTerminalState(potato, "boiled")}`);
console.log(`   garlic "burned": ${isTerminalState(garlic, "burned")}\n`);

console.log("2. FRY against a burned potato — REJECTED, per-entity invalidTransitions, no detection involved:");
const burnedPotato: Instance = { entityId: "potato", state: "burned", tags: [] };
try {
  applyAction(burnedPotato, actions.get("fry")!, entities, new Set(["pan"]), {}, new Set(["oil"]));
  console.log("   Unexpected: FRY on a burned potato should have been rejected.");
} catch (e) {
  console.log(`   REJECTED: ${(e as Error).message}\n`);
}

console.log("3. SALT against the SAME burned potato — still succeeds (tag-only, not a state change):");
const salted = applyAction(burnedPotato, actions.get("salt")!, entities, new Set([]), {}, new Set(["salt"]));
console.log(
  `   SALT executed: "${burnedPotato.state}" -> "${salted.instance.state}", tags [${salted.instance.tags}] — ` +
    "pointless in reality (nobody seasons a discarded burnt potato), but not schema-forbidden, the same " +
    "state-vs-tag distinction engine.ts already draws everywhere else, not a new gap this ticket introduced.\n"
);

console.log("4. recipe-explain.ts's pre-flight report flags a recipe that starts an instance already burned:");
const badRecipe: RecipeScript = {
  id: "already-burned-garlic",
  names: { en: "Already-burned garlic (authoring mistake or deliberate failure-recovery test)" },
  initialInventory: [{ id: "garlic-1", entityId: "garlic", state: "burned", tags: [] }],
  availableTools: [],
  sequence: [{ actionId: "peel", targetInstanceId: "garlic-1", params: {}, availableIngredientInstanceIds: [] }],
  metadata: {},
};
const explanation = explainRecipe(badRecipe, entities, actions);
for (const advisory of explanation.prepAdvisories) console.log(`   ${advisory}`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no burn-detection mechanism exists " +
    "or is implied (no timer, no probability, no inference — ENGINE_INVARIANTS.md #11 unchanged); " +
    "'overcooked' forbids reverting/re-cooking into every NORMAL state as a stated, deliberate SIMPLIFICATION, " +
    "not a claim that every real rescue technique (e.g. mashing an over-boiled potato) is actually impossible " +
    "— see potato.json's own failureStateNote for the honest gap (MASH's statePrerequisites doesn't list " +
    "'overcooked' as an allowed starting state, so wiring that real rescue through needs a small follow-up " +
    "this ticket deliberately didn't do)."
);
