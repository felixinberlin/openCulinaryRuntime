import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { RecipeScriptSchema, type RecipeScript } from "../src/recipe.ts";

const root = join(import.meta.dirname, "..");

function loadDir<T extends { id: string }>(
  dir: string,
  label: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }
) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = new Map<string, T>();
  let failed = 0;
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const result = schema.safeParse(raw);
    if (result.success) {
      console.log(`OK   ${label}/${file}  (id: ${result.data.id})`);
      items.set(result.data.id, result.data);
    } else {
      failed++;
      console.error(`FAIL ${label}/${file}`);
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
  }
  return { items, failed, total: files.length };
}

const entities = loadDir<Entity>(join(root, "data", "entities"), "entities", EntitySchema);
const actions = loadDir<Action>(join(root, "data", "actions"), "actions", ActionSchema);
const recipes = loadDir<RecipeScript>(join(root, "data", "recipes"), "recipes", RecipeScriptSchema);

let crossFailed = 0;
function fail(msg: string) {
  crossFailed++;
  console.error(`FAIL ${msg}`);
}

for (const entity of entities.items.values()) {
  for (const byproductId of entity.producedByproducts) {
    if (!entities.items.has(byproductId)) {
      fail(`entities/${entity.id}.json: producedByproducts references unknown entity "${byproductId}"`);
    }
  }
  for (const actionId of entity.allowedTransformations) {
    if (!actions.items.has(actionId)) {
      fail(`entities/${entity.id}.json: allowedTransformations references unknown action "${actionId}"`);
    }
  }
}

for (const action of actions.items.values()) {
  for (const toolId of action.requiredTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`actions/${action.id}.json: requiredTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`actions/${action.id}.json: requiredTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
}

for (const recipe of recipes.items.values()) {
  const knownInstanceIds = new Set(recipe.initialInventory.map((i) => i.id));
  for (const item of recipe.initialInventory) {
    if (!entities.items.has(item.entityId)) {
      fail(`recipes/${recipe.id}.json: initialInventory references unknown entity "${item.entityId}"`);
    }
  }
  for (const toolId of recipe.availableTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`recipes/${recipe.id}.json: availableTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`recipes/${recipe.id}.json: availableTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
  for (const [i, step] of recipe.sequence.entries()) {
    if (!actions.items.has(step.actionId)) {
      fail(`recipes/${recipe.id}.json: sequence[${i}] references unknown action "${step.actionId}"`);
    }
    // Only checks against initialInventory ids, not ids a prior step might
    // spawn (e.g. potato_peel-1) — runner.ts assigns those at run time, so
    // a step correctly targeting a spawned instance can't be verified
    // statically here without simulating the whole run.
    if (!knownInstanceIds.has(step.targetInstanceId)) {
      console.log(
        `NOTE recipes/${recipe.id}.json: sequence[${i}].targetInstanceId "${step.targetInstanceId}" isn't in initialInventory — assumed to be a spawned instance, not checked further.`
      );
    }
  }
}

const failed = entities.failed + actions.failed + recipes.failed + crossFailed;
const total = entities.total + actions.total + recipes.total;
if (failed > 0) {
  console.error(`\n${failed} problem(s) found.`);
  process.exit(1);
}
console.log(
  `\nAll ${total} files valid (${entities.total} entities, ${actions.total} actions, ${recipes.total} recipes); cross-references OK.`
);
