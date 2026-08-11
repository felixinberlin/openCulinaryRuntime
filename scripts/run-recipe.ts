import { join } from "node:path";
import { loadEntities, loadActions, loadRecipes } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";

const recipeId = process.argv[2] ?? "salted_fried_potatoes";

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

const recipe = recipes.get(recipeId);
if (!recipe) {
  throw new Error(`Unknown recipe "${recipeId}". Known: ${[...recipes.keys()].join(", ")}`);
}

console.log(`Running "${recipe.names.en}"\n`);
const result = runRecipe(recipe, entities, actions);

for (const line of result.log) console.log(line);

console.log("\nFinal inventory:");
for (const [id, instance] of result.finalInventory) {
  const tagsLabel = instance.tags.length ? `, tags [${instance.tags}]` : "";
  console.log(`  ${id}: ${instance.entityId}, state "${instance.state}"${tagsLabel}`);
}

if (result.errors.length > 0) {
  console.log(`\n${result.errors.length} step(s) failed:`);
  for (const { step, message } of result.errors) {
    console.log(`  ${step.actionId} on ${step.targetInstanceId}: ${message}`);
  }
  process.exit(1);
}
