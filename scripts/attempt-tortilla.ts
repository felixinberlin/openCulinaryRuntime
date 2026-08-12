import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Empirical test: how far can the CURRENT vocabulary actually get toward a
 * tortilla de patatas (Spanish potato omelette) — not a reasoned guess, an
 * actual attempted run against the real registry, same discipline as every
 * other claim made this session. Onion-free (sin cebolla) on purpose: no
 * onion entity exists yet, and it's a legitimate traditional variant, not a
 * cop-out — see tortilladepatatas.org's own "facciones" debate on exactly
 * this, a separate repo, referenced only as prior art, not reused here.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const tools = new Set(["knife", "pan", "bowl"]);
const ingredients = new Set(["oil", "salt"]);

function apply(instance: Instance, actionId: string, params?: Record<string, string>) {
  const action = actions.get(actionId)!;
  const result = applyAction(instance, action, entities, tools, params, ingredients);
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  return result;
}

console.log("--- Potato component ---");
let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
potato = apply(potato, "peel").instance;
potato = apply(potato, "cut", { shape: "sliced" }).instance;
// Real technique: potato confit-fried low and slow until SOFT, deliberately
// NOT browned. fry.json's doneness enum is ["golden","brown"] — both
// browning descriptors, borrowed from the garlic use case (infuse.json) —
// there is no "soft, unbrowned" option. Omitting doneness entirely rather
// than picking a wrong one.
potato = apply(potato, "fry", { heatLevel: "low", durationSeconds: "900" }).instance;
console.log(`  Potato component done: "${potato.state}" (soft-fried, unbrowned — doneness param has no vocabulary for this)`);

console.log("\n--- Egg component ---");
const crackResult = applyAction({ entityId: "egg", state: "raw", tags: [] }, actions.get("crack")!, entities, tools, {}, ingredients);
let egg = crackResult.spawned.find((s) => s.entityId === "egg_cracked")!;
console.log(`  CRACK: spawned egg_cracked ("${egg.state}")`);
egg = apply(egg, "beat", { intensity: "beaten" }).instance;
egg = apply(egg, "salt").instance;
console.log(`  Egg component done: "${egg.state}", tags [${egg.tags}]`);

console.log("\n--- The actual tortilla step: combine potato + egg into one mixture ---");
const combineAction = actions.get("combine") ?? actions.get("assemble") ?? actions.get("mix_in");
if (!combineAction) {
  console.log("  BLOCKED: no action in data/actions/ combines two separate instances into a new one.");
  console.log("  MIX (mix.json) blends ONE target with a mixer tool — it doesn't take a second instance as input.");
  console.log("  EMULSIFY (emulsify.json) is the closest precedent (garlic target + oil ingredient) but still");
  console.log("  only ever changes ONE target's state — it never produces a genuinely new entity from two.");
} else {
  console.log(`  Found ${combineAction.verb} — this comment is stale, script needs updating.`);
}

console.log("\n--- Even if combined: flipping the tortilla ---");
const flipAction = actions.get("flip");
if (!flipAction) {
  console.log("  BLOCKED: no FLIP verb exists. Cooking the second side of a whole tortilla — inverted onto a");
  console.log("  plate, slid back into the pan — is its own mechanically distinct, notoriously difficult action,");
  console.log("  not a parameter of FRY.");
} else {
  console.log(`  Found ${flipAction.verb} — this comment is stale, script needs updating.`);
}

console.log("\n=== VERDICT ===");
console.log("Two components (fried potato, beaten+salted egg) ARE fully makeable with the current vocabulary.");
console.log("The dish is NOT: no COMBINE/ASSEMBLE verb exists to merge two instances into one, and no FLIP verb");
console.log("exists for the step that defines the technique. Both are genuine, scoped gaps — not simulation depth,");
console.log("not robot control/perception (ENGINE_INVARIANTS.md #11) — the VOCABULARY itself stops short.");
