import { join } from "node:path";
import {
  loadEntities,
  loadActions,
  loadRecipes,
  loadCcps,
  loadHeatSources,
  loadMealPatternContributions,
  loadFoodOnCrosswalk,
} from "./registry.ts";
import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import type { HeatSourceProfile } from "./heat-source.ts";
import type { MealPatternContributionFile } from "./nutrition-extension.ts";
import type { FoodOnCrosswalkFile } from "./foodon-crosswalk.ts";

/**
 * Loads every `data/*` collection at once, resolved relative to this
 * package's own root (`import.meta.dirname`) rather than `process.cwd()` —
 * so a consumer importing this package (e.g. via `file:`/workspace, the
 * cooking-simulator sibling project) gets the right files regardless of
 * where it runs from. See `SIMULATOR_API.md`.
 */

const packageRoot = join(import.meta.dirname, "..");

export interface KnowledgeBase {
  entities: Map<string, Entity>;
  actions: Map<string, Action>;
  recipes: Map<string, RecipeScript>;
  ccps: Map<string, CriticalControlPoint>;
  heatSources: Map<string, HeatSourceProfile>;
  mealPatternContributions: Map<string, MealPatternContributionFile>;
  foodOnCrosswalk: Map<string, FoodOnCrosswalkFile>;
}

/** Pass `dataDir` to override the default (this package's own `data/`
 *  directory) — e.g. a test fixture directory. */
export function loadKnowledgeBase(dataDir: string = join(packageRoot, "data")): KnowledgeBase {
  return {
    entities: loadEntities(join(dataDir, "entities")),
    actions: loadActions(join(dataDir, "actions")),
    recipes: loadRecipes(join(dataDir, "recipes")),
    ccps: loadCcps(join(dataDir, "ccps")),
    heatSources: loadHeatSources(join(dataDir, "heat-sources")),
    mealPatternContributions: loadMealPatternContributions(
      join(dataDir, "meal-pattern-contributions")
    ),
    foodOnCrosswalk: loadFoodOnCrosswalk(join(dataDir, "foodon-crosswalk")),
  };
}
