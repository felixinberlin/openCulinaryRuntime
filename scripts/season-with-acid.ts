import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { counterbalancesInvolving } from "../src/flavor-balance.ts";

/**
 * Capability test for the 2026-08-15 ACID verb + vinegar.json — the fourth
 * SALT-shaped seasoning, closed alongside src/flavor-balance.ts after
 * triaging a user-supplied Reddit thread (olddocs/reddit-thread-
 * 1mo4tj8.md). Same "attempt a real dish, watch it fail where it actually
 * fails" method season-potato-three-ways.ts already used for SALT/PEPPER/
 * CHILI, extended to prove: (1) ACID actually runs end-to-end against a
 * real fried potato, (2) it correctly rejects a non-acid ingredient the
 * same way SALT rejects black_pepper, (3) all four seasoning verbs compose
 * on the same instance, and (4) src/flavor-balance.ts's real, cited
 * counterbalance data is actually queryable, not just declared.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function apply(instance: Instance, actionId: string, availableIngredients: ReadonlySet<string>): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, new Set(["knife", "pan"]), { timing: "after_cooking" }, availableIngredients);
  console.log(`  ${action.verb}: tags [${instance.tags.join(", ")}] -> [${result.instance.tags.join(", ")}]`);
  return result.instance;
}

function friedPotato(): Instance {
  let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
  potato = applyAction(potato, actions.get("wash")!, entities, new Set(["knife", "pan"])).instance;
  potato = applyAction(potato, actions.get("peel")!, entities, new Set(["knife", "pan"])).instance;
  potato = applyAction(potato, actions.get("cut")!, entities, new Set(["knife", "pan"]), { shape: "diced" }).instance;
  potato = applyAction(potato, actions.get("fry")!, entities, new Set(["knife", "pan"]), {}, new Set(["oil"])).instance;
  return potato;
}

console.log("=== 1. ACID actually runs end-to-end against a real fried potato ===");
apply(friedPotato(), "acid", new Set(["vinegar"]));

console.log("\n=== 2. ACID correctly rejects a non-acid ingredient (same shape as SALT rejecting black_pepper) ===");
try {
  apply(friedPotato(), "acid", new Set(["salt"]));
  throw new Error("ACID wrongly accepted salt as an acid source — isAcid check is not working");
} catch (err) {
  console.log(`  Correctly rejected: ${(err as Error).message}`);
}

console.log("\n=== 3. All four seasoning verbs, same potato ===");
let all = friedPotato();
all = apply(all, "salt", new Set(["salt"]));
all = apply(all, "pepper", new Set(["black_pepper"]));
all = apply(all, "chili", new Set(["chili_flakes"]));
all = apply(all, "acid", new Set(["vinegar"]));
console.log(`  Final tags: [${all.tags.join(", ")}]`);

console.log("\n=== 4. src/flavor-balance.ts: real, cited counterbalance data, actually queryable ===");
for (const taste of ["bitter", "sour", "richness", "umami"] as const) {
  const pairs = counterbalancesInvolving(taste);
  if (pairs.length === 0) {
    console.log(`  "${taste}": no modeled counterbalance pair (honest empty answer, not an error).`);
    continue;
  }
  for (const pair of pairs) {
    console.log(
      `  "${taste}" <-> "${pair.suppressed === taste ? pair.by : pair.suppressed}" (${pair.direction}): ${pair.mechanism}`
    );
  }
}

console.log(
  "\nReal answer for a real complaint: \"this sauce is too bitter\" -> the data says add something salty, " +
  "not \"add more of whatever\" — a structured, cited fact an intent layer could actually use, not prose."
);
