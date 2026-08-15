import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance, type ExecutionResult } from "../src/engine.ts";

/**
 * Reusing the potato_peel byproduct — extended 2026-08-15 (was originally
 * just "can a spawned byproduct take its own actions") to actually prove a
 * user's precise real-world correction: peeling a DIRTY (unwashed) potato
 * produces a dirty peel, and washing the potato's FLESH afterward does
 * nothing for it — by then it's a separate, already-spawned instance
 * (conservation of mass). See potato_peel.json's washedNote and
 * LEARNINGS_ENGINE.md 2026-08-15 for the full reasoning; this script is the proof.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const availableTools = new Set(["knife", "pan"]);

function apply(
  instance: Instance,
  actionId: string,
  params?: Record<string, string>,
  availableIngredients?: ReadonlySet<string>
): ExecutionResult {
  const action = actions.get(actionId);
  if (!action) throw new Error(`Unknown action "${actionId}"`);
  const label = params
    ? ` (${Object.entries(params).map(([k, v]) => `${k}: ${v}`).join(", ")})`
    : "";
  console.log(`Applying ${action.verb}${label} to ${instance.entityId} (state: "${instance.state}", tags [${instance.tags}])`);
  const result = applyAction(instance, action, entities, availableTools, params, availableIngredients);
  console.log(`  -> ${instance.entityId} is now "${result.instance.state}", tags [${result.instance.tags}]`);
  for (const s of result.spawned) console.log(`  -> spawned ${s.entityId} (state: "${s.state}", tags [${s.tags}])`);
  return result;
}

console.log("=== Case A: potato washed BEFORE peeling — the peel inherits 'washed' for free ===\n");
let potatoA: Instance = { entityId: "potato", state: "raw", tags: [] };
({ instance: potatoA } = apply(potatoA, "wash"));
const peelResultA = apply(potatoA, "peel");
potatoA = peelResultA.instance;
const peelA = peelResultA.spawned.find((s) => s.entityId === "potato_peel")!;
console.log(
  `\nThe spawned peel already carries tags [${peelA.tags}] — conservation-of-mass tag inheritance ` +
    "(engine.ts, 2026-08-12), no extra wash step needed for THIS peel.\n"
);
const friedPeelA = apply(peelA, "fry", undefined, new Set(["oil"])).instance;
console.log(`\nFRY succeeded directly: "${friedPeelA.state}".\n`);

console.log("=== Case B: potato peeled BEFORE washing — the peel comes off dirty and STAYS dirty ===\n");
let potatoB: Instance = { entityId: "potato", state: "raw", tags: [] };
const peelResultB = apply(potatoB, "peel"); // no wash first — a real, common case (peel first, then rinse the flesh)
potatoB = peelResultB.instance;
const peelB = peelResultB.spawned.find((s) => s.entityId === "potato_peel")!;
console.log(`\nThe spawned peel has tags [${peelB.tags}] — genuinely dirty, nothing to inherit yet.\n`);

console.log("Washing the POTATO FLESH now does nothing for the already-spawned peel (separate instance):");
({ instance: potatoB } = apply(potatoB, "wash"));
console.log(`  (potato flesh is now washed; peelB is untouched: tags [${peelB.tags}])\n`);

console.log("Trying to FRY the still-dirty peel directly:");
try {
  apply(peelB, "fry", undefined, new Set(["oil"]));
  console.log("  UNEXPECTED: a never-washed peel was fryable");
} catch (err) {
  console.log(`  REJECTED as expected: ${(err as Error).message}\n`);
}

console.log("The peel has to be washed ON ITS OWN before it can be reused:");
const washedPeelB = apply(peelB, "wash").instance;
const friedPeelB = apply(washedPeelB, "fry", undefined, new Set(["oil"])).instance;
console.log(`\nNOW it fries: "${friedPeelB.state}".`);
