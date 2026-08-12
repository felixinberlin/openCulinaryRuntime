import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["pot", "knife", "mixer"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>,
  availableIngredients?: ReadonlySet<string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  console.log(`Applying ${action.verb} to ${instance.entityId} (state: "${instance.state}")`);
  const result = applyAction(instance, action, entities, availableTools, params, availableIngredients);
  console.log(
    result.destroyed
      ? `  -> ${instance.entityId} destroyed (conservation of mass) — was "${result.instance.state}" the instant before`
      : `  -> ${instance.entityId} is now "${result.instance.state}"`
  );
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}")`);
  return result;
}

console.log("--- Cracking a raw egg: separate ---");
const raw: Instance = { entityId: "egg", state: "raw", tags: [] };
const separated = apply(raw, "separate");
const yolk = separated.spawned.find((s) => s.entityId === "egg_yolk");
const white = separated.spawned.find((s) => s.entityId === "egg_white");
const shellFromSeparate = separated.spawned.find((s) => s.entityId === "egg_shell");
if (!yolk || !white || !shellFromSeparate) {
  throw new Error("Expected 'separate' to spawn egg_shell + egg_yolk + egg_white");
}
console.log("\nThe egg instance itself is gone — only its three children remain in the inventory.");

console.log("\n--- The yolk can be worked further, or not ---");
const beatenYolk = apply(yolk, "mix", undefined, new Set()).instance;
console.log(`(the white was left as-is: "${white.state}")`);

console.log("\n--- Peeling a *different*, boiled egg only sheds a shell — no yolk/white ---");
let boiledEgg: Instance = { entityId: "egg", state: "raw", tags: [] };
({ instance: boiledEgg } = apply(boiledEgg, "boil", undefined, new Set(["water"])));
const peeled = apply(boiledEgg, "peel");
const shellFromPeel = peeled.spawned.find((s) => s.entityId === "egg_shell");
if (!shellFromPeel || peeled.spawned.length !== 1) {
  throw new Error("Expected 'peel' to spawn only egg_shell, not egg_yolk/egg_white");
}

console.log("\nFinal state:");
console.log(`  egg_yolk: ${beatenYolk.state}`);
console.log(`  egg_white: ${white.state}`);
console.log(`  egg_shell (from separate): ${shellFromSeparate.state}`);
console.log(`  peeled egg: ${peeled.instance.state}`);
console.log(`  egg_shell (from peel): ${shellFromPeel.state}`);
