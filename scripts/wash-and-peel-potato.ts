import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const availableTools = new Set(["knife"]);

let potato: Instance = { entityId: "potato", state: "raw" };
const inventory: Instance[] = [potato];

for (const actionId of ["wash", "peel"]) {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);

  console.log(`Applying ${action.verb} to ${potato.entityId} (state: "${potato.state}")`);
  const result = applyAction(potato, action, entities, availableTools);

  potato = result.instance;
  inventory[0] = potato;
  inventory.push(...result.spawned);

  console.log(`  -> ${potato.entityId} is now "${potato.state}"`);
  for (const spawned of result.spawned) {
    console.log(`  -> spawned ${spawned.entityId} (state: "${spawned.state}")`);
  }
}

console.log("\nFinal inventory:");
for (const item of inventory) {
  console.log(`  ${item.entityId}: ${item.state}`);
}
