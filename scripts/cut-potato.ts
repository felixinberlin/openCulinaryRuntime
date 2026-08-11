import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife"]);

function run(sequence: string[]): Instance {
  let potato: Instance = { entityId: "potato", state: "raw" };
  for (const actionId of sequence) {
    const action = actions.get(actionId);
    if (!action) throw new Error(`Unknown action "${actionId}"`);
    console.log(`Applying ${action.verb} to potato (state: "${potato.state}")`);
    potato = applyAction(potato, action, entities, availableTools).instance;
    console.log(`  -> potato is now "${potato.state}"`);
  }
  return potato;
}

console.log('Recipe says "cut the potatoes" — trying it straight from washed, unpeeled:');
try {
  run(["wash", "cut"]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log('\nSame recipe, engine-satisfying order — wash, peel, then cut:');
const result = run(["wash", "peel", "cut"]);
console.log(`\nFinal state: potato is "${result.state}"`);
