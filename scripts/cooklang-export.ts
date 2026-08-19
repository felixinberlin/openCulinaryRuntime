import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  loadEntities,
  loadActions,
  loadRecipes,
  loadCcps,
  loadHeatSources,
} from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import { exportToCooklang } from "../src/cooklang.ts";

/**
 * `npm run cooklang-export -- <recipeId> [output-path.cook]` — the CLI
 * entry point for `exportToCooklang` (`src/cooklang.ts`). Runs the recipe
 * first (silently) so a step targeting a mid-recipe-SPAWNED instance
 * (e.g. SEPARATE's own `egg_yolk-3`) resolves to a real `@token` instead
 * of a raw instance id — same real-ground-truth-composition precedent
 * `cooklang-as-a-robot.ts`'s own capability test already proves; if the
 * recipe fails to run, export still proceeds (any step targeting an
 * instance only the run would have resolved falls back to its raw id,
 * named not guessed — the pre-existing, documented `exportToCooklang`
 * behavior with no `spawnedEntityIds`), with a warning printed.
 */

const recipeId = process.argv[2];
const outputPath = process.argv[3];
if (!recipeId) {
  console.error("Usage: npm run cooklang-export -- <recipeId> [output-path.cook]");
  process.exit(1);
}
if (outputPath && existsSync(outputPath)) {
  console.error(`Refusing to overwrite existing file: ${outputPath}`);
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const recipe = recipes.get(recipeId);
if (!recipe) {
  console.error(`Unknown recipe "${recipeId}". Known: ${[...recipes.keys()].join(", ")}`);
  process.exit(1);
}

const result = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
if (result.errors.length > 0) {
  console.error(
    `Warning: "${recipeId}" did not run cleanly (${result.errors.length} step error(s)) — exporting ` +
      "anyway, but any step targeting an instance only the run would have spawned falls back to its raw id."
  );
}

const cookText = exportToCooklang(recipe, entities, actions, result.spawnedEntityIds);

if (outputPath) {
  writeFileSync(outputPath, cookText, "utf8");
  console.log(`Wrote ${outputPath}`);
} else {
  process.stdout.write(cookText);
}
