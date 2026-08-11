import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function apply(
  instance: Instance,
  actionId: string,
  availableTools: ReadonlySet<string>,
  availableIngredients?: ReadonlySet<string>
): Instance {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const result = applyAction(instance, action, entities, availableTools, undefined, availableIngredients);
  console.log(`  ${action.verb}: "${instance.state}" -> "${result.instance.state}"`);
  return result.instance;
}

function washedAndPeeledPotato(): Instance {
  let potato: Instance = { entityId: "potato", state: "raw" };
  potato = apply(potato, "wash", new Set(["knife"]));
  potato = apply(potato, "peel", new Set(["knife"]));
  return potato;
}

console.log("Boiled (cooked in water, pot):");
const boiled = apply(washedAndPeeledPotato(), "boil", new Set(["pot"]), new Set(["water"]));

console.log("\nFried (cooked in oil, pan):");
const fried = apply(washedAndPeeledPotato(), "fry", new Set(["pan"]), new Set(["oil"]));

console.log("\nBaked (dry heat, oven — no medium at all):");
const baked = apply(washedAndPeeledPotato(), "bake", new Set(["oven"]));

console.log("\nMixed method — parboiled, then fried:");
let mixed = washedAndPeeledPotato();
mixed = apply(mixed, "boil", new Set(["pot"]), new Set(["water"]));
mixed = apply(mixed, "fry", new Set(["pan"]), new Set(["oil"]));

console.log("\nThese are not the same result:");
console.log(`  boiled only:    "${boiled.state}"`);
console.log(`  fried only:     "${fried.state}"`);
console.log(`  baked only:     "${baked.state}"`);
console.log(
  `  boiled + fried: "${mixed.state}"  (passed through "boiled" first — visible in the log above, ` +
    `but the instance itself only tracks its current state, not the method history that got it there)`
);
