import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for the 2026-08-13 seasoning generalization: proves SALT/
 * PEPPER/CHILI actually run end-to-end against the same fried potato, not
 * just that the JSON files individually validate. Same "attempt a real
 * dish, watch it fail where it actually fails" method LEARNINGS.md/
 * ROADMAP.md already establish for capability tests generally.
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

console.log("Salt only:");
const salted = apply(friedPotato(), "salt", new Set(["salt"]));

console.log("\nPepper only:");
const peppered = apply(friedPotato(), "pepper", new Set(["black_pepper"]));

console.log("\nChili only:");
const chilied = apply(friedPotato(), "chili", new Set(["chili_flakes"]));

console.log("\nAll three, same potato:");
let all = friedPotato();
all = apply(all, "salt", new Set(["salt"]));
all = apply(all, "pepper", new Set(["black_pepper"]));
all = apply(all, "chili", new Set(["chili_flakes"]));

console.log("\nCross-check: SALT must NOT accept black_pepper as a substitute (isSaltySeasoning, not generic isSeasoning):");
try {
  apply(friedPotato(), "salt", new Set(["black_pepper"]));
  throw new Error("SALT wrongly accepted black_pepper as a salt source — isSaltySeasoning check is not working");
} catch (err) {
  console.log(`  Correctly rejected: ${(err as Error).message}`);
}

console.log("\nFinal tags:");
console.log(`  salted:   [${salted.tags.join(", ")}]`);
console.log(`  peppered: [${peppered.tags.join(", ")}]`);
console.log(`  chilied:  [${chilied.tags.join(", ")}]`);
console.log(`  all three: [${all.tags.join(", ")}]`);
