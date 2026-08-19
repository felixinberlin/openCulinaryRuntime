import { join } from "node:path";
import {
  loadEntities,
  loadActions,
  loadRecipes,
  loadCcps,
  loadHeatSources,
} from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import { compileToSchemaOrgIngredient, compileToSchemaOrgRecipe } from "../src/schema-org.ts";

/**
 * Capability test for `src/schema-org.ts` — `ROADMAP.md` Phase 5's last
 * unbuilt bullet, the OCR -> Schema.org export path. Real, independent
 * proof against real `data/*.json`:
 *
 * A. **A real recipe with no spawned instances** (`salted-fried-potatoes.json`)
 *    compiled straight from `initialInventory`/`sequence` to a Schema.org
 *    `Recipe` object — `recipeIngredient`/`recipeInstructions`/`tool` all
 *    populated from real data, nothing fabricated.
 * B. **A real recipe with a genuine SEPARATE spawn**
 *    (`handmade-alioli-egg-yolk.json`) actually run via `runRecipe`, then
 *    compiled with the real `spawnedEntityIds` — the step targeting
 *    `egg_yolk-3` (SEPARATE's own output, not in `initialInventory`)
 *    resolves to a real ingredient name in `recipeInstructions`, not a
 *    raw instance id. Same real-ground-truth-composition precedent as
 *    `cooklang.ts`'s own capability test.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// --- A. A real recipe, no spawns -------------------------------------------

section("A. salted_fried_potatoes -> Schema.org Recipe");

const potatoRecipe = recipes.get("salted_fried_potatoes");
if (!potatoRecipe) throw new Error("Fixture recipe missing: salted_fried_potatoes");

const potatoDoc = compileToSchemaOrgRecipe(potatoRecipe, entities, actions);
console.log(JSON.stringify(potatoDoc, null, 2));

if (potatoDoc["@type"] !== "Recipe" || potatoDoc["@context"] !== "https://schema.org") {
  throw new Error("Expected a well-formed Schema.org Recipe envelope.");
}
if (potatoDoc.recipeIngredient.length !== potatoRecipe.initialInventory.length) {
  throw new Error("Expected one recipeIngredient string per initialInventory item.");
}
if (potatoDoc.recipeInstructions.length !== potatoRecipe.sequence.length) {
  throw new Error("Expected one HowToStep per sequence step.");
}

// A standalone single-ingredient check too, against the same real entity/quantity.
const potatoEntity = entities.get("potato");
if (!potatoEntity) throw new Error("Fixture entity missing: potato");
const potatoInstance = potatoRecipe.initialInventory.find((i) => i.entityId === "potato");
if (!potatoInstance) throw new Error("Expected a potato instance in salted_fried_potatoes.");
console.log(
  "\ncompileToSchemaOrgIngredient(potato):",
  compileToSchemaOrgIngredient(
    potatoEntity,
    potatoInstance.quantity,
    potatoInstance.state,
    entities
  )
);

// --- B. A real recipe with a genuine SEPARATE spawn -------------------------

section("B. handmade_alioli_egg_yolk -> Schema.org Recipe, real spawnedEntityIds");

const alioliRecipe = recipes.get("handmade_alioli_egg_yolk");
if (!alioliRecipe) throw new Error("Fixture recipe missing: handmade_alioli_egg_yolk");

const runResult = runRecipe(alioliRecipe, entities, actions, ccps, undefined, heatSources);
if (runResult.errors.length > 0) {
  throw new Error(
    `Fixture recipe failed to run: ${runResult.errors.map((e) => e.message).join("; ")}`
  );
}
console.log("Real spawnedEntityIds from runRecipe:", [...runResult.spawnedEntityIds.entries()]);

const alioliDoc = compileToSchemaOrgRecipe(
  alioliRecipe,
  entities,
  actions,
  runResult.spawnedEntityIds
);
console.log(JSON.stringify(alioliDoc.recipeInstructions, null, 2));

const rawInstanceIdLeaked = alioliDoc.recipeInstructions.some((step) =>
  [...runResult.spawnedEntityIds.keys()].some((instanceId) => step.text.includes(instanceId))
);
if (rawInstanceIdLeaked) {
  throw new Error(
    "A spawned instance id leaked into recipeInstructions text instead of resolving to a real ingredient name."
  );
}

console.log(
  "\nConfirmed: the SPAWNED egg_yolk instance (SEPARATE's own output) resolved to a real ingredient " +
    "name in recipeInstructions, composed with runRecipe's real spawnedEntityIds — not a raw instance id."
);

console.log(
  "\nSpec: Schema.org Recipe/HowTo vocabulary, schema.org/Recipe + schema.org/HowTo — see REFERENCES.md."
);
console.log("\nAll schema-org.ts capability checks passed.");
