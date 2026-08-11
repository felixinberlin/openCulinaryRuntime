import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife", "pan"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const label = params
    ? ` (${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
    : "";
  console.log(`Applying ${action.verb}${label} to ${instance.entityId} (state: "${instance.state}")`);
  const result = applyAction(instance, action, entities, availableTools, params);
  console.log(`  -> ${instance.entityId} is now "${result.instance.state}"`);
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}")`);
  return result;
}

let potato: Instance = { entityId: "potato", state: "raw" };
({ instance: potato } = apply(potato, "wash"));

const peelResult = apply(potato, "peel");
potato = peelResult.instance;
const peel = peelResult.spawned.find((s) => s.entityId === "potato_peel");
if (!peel) throw new Error("Expected 'peel' to spawn a potato_peel byproduct");

({ instance: potato } = apply(potato, "cut", { shape: "diced" }));

console.log("\nThe spawned potato_peel isn't discarded — it's a full instance and can take its own actions:");
const friedPeel = apply(peel, "fry").instance;

console.log("\nFinal inventory:");
console.log(`  potato: ${potato.state}`);
console.log(`  potato_peel: ${friedPeel.state}`);
