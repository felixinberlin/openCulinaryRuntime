import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife"]);

interface Step {
  id: string;
  params?: Record<string, string>;
}

function run(steps: Step[]): Instance {
  let potato: Instance = { entityId: "potato", state: "raw", tags: [] };
  for (const step of steps) {
    const action = actions.get(step.id);
    if (!action) throw new Error(`Unknown action "${step.id}"`);
    const label = step.params
      ? ` (${Object.entries(step.params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
      : "";
    console.log(`Applying ${action.verb}${label} to potato (state: "${potato.state}")`);
    potato = applyAction(potato, action, entities, availableTools, step.params).instance;
    console.log(`  -> potato is now "${potato.state}"`);
  }
  return potato;
}

console.log('Recipe says "cut the potatoes" — trying it straight from washed, unpeeled:');
try {
  run([{ id: "wash" }, { id: "cut", params: { shape: "diced" } }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log("\nCorrect order, diced:");
run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "diced" } }]);

console.log("\nCorrect order, julienne:");
run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "julienne" } }]);

console.log("\nCUT with no shape given:");
try {
  run([{ id: "wash" }, { id: "peel" }, { id: "cut" }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}

console.log("\nCUT with an invalid shape:");
try {
  run([{ id: "wash" }, { id: "peel" }, { id: "cut", params: { shape: "shredded" } }]);
} catch (err) {
  console.log(`  REJECTED: ${(err as Error).message}`);
}
