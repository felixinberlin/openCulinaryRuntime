import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { loadRecipes } from "../src/registry.ts";
import { explainRecipe } from "../src/recipe-explain.ts";

/**
 * First end-to-end proof for `ingredient.ts`'s `AllergenSchema`, added
 * 2026-08-16 (ROADMAP.md's "Allergens" gap — "arguably the single
 * highest-priority gap against this repo's own stated mission"). Mirrors
 * caramelize-onion-as-a-robot.ts's role: run the real pipeline against the
 * real loaded data, not just reason about it.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const recipes = loadRecipes(join(root, "data", "recipes"));

console.log(
  "Goal: a recipe can say 'this dish contains X' before a single step runs, over the REAL data.\n"
);

// ---------------------------------------------------------------------
// 1. An egg-free recipe correctly reports zero tracked allergens.
// ---------------------------------------------------------------------
const potatoRecipe = recipes.get("salted_fried_potatoes")!;
const potatoAllergens = explainRecipe(potatoRecipe, entities, actions, ccps).allergenSummary;
console.log(
  `1. "${potatoRecipe.names.en}": allergens = [${potatoAllergens.join(", ")}] (expected empty)`
);

// ---------------------------------------------------------------------
// 2. Every real recipe containing egg correctly reports "egg" — proves
//    the union-over-initialInventory approach against every real recipe
//    in this repo, not just one hand-picked example.
// ---------------------------------------------------------------------
console.log("\n2. Real recipes' allergenSummary, computed over data/recipes/*.json:");
for (const recipe of recipes.values()) {
  const summary = explainRecipe(recipe, entities, actions, ccps).allergenSummary;
  console.log(`   ${recipe.id}: [${summary.join(", ") || "none"}]`);
}

// ---------------------------------------------------------------------
// 3. egg_shell (a real byproduct of egg) correctly carries NO allergen —
//    the shell isn't eaten and carries none of the actual allergenic
//    proteins, a deliberate distinction from egg_cracked/egg_yolk/
//    egg_white, which DO inherit "egg".
// ---------------------------------------------------------------------
const eggShell = entities.get("egg_shell")!;
const eggCracked = entities.get("egg_cracked")!;
console.log(
  `\n3. egg_shell.allergens = [${eggShell.allergens.join(", ") || "none"}] ` +
    `(byproduct of egg, but not eaten — correctly empty)`
);
console.log(
  `   egg_cracked.allergens = [${eggCracked.allergens.join(", ")}] ` +
    `(the part actually eaten — correctly carries "egg")`
);

// ---------------------------------------------------------------------
// 4. The composite-entity superset check (scripts/validate.ts) — proven
//    directly against the schema/validation logic here, not by re-running
//    the whole validate.ts script: a composite entity whose allergens
//    DON'T cover its components' union is a real, catchable authoring
//    mistake, not just a documentation convention.
// ---------------------------------------------------------------------
const tortillaMixture = entities.get("tortilla_mixture")!;
const potato = entities.get("potato")!;
const egg = entities.get("egg")!;
const componentAllergens = new Set([...potato.allergens, ...egg.allergens]);
const missing = [...componentAllergens].filter((a) => !tortillaMixture.allergens.includes(a));
console.log(
  `\n4. tortilla_mixture.allergens = [${tortillaMixture.allergens.join(", ")}], ` +
    `components' union = [${[...componentAllergens].join(", ")}] — ` +
    `${missing.length === 0 ? "correctly a full superset (see scripts/validate.ts's hard-fail check for the enforcement)" : `MISSING: ${missing.join(", ")}`}`
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no consumer-facing 'avoid this " +
    "allergen' CONSTRAINT exists anywhere (RecipeScriptSchema has no way to say 'reject any recipe containing " +
    "egg') — this closes DECLARATION (can the system say what's in a dish) not ENFORCEMENT (can it refuse to " +
    "serve someone an allergen they can't have), a real, further, unbuilt gap. Only the FDA's 'Big 9' is " +
    "tracked, not the EU's wider 14-item list (see AllergenSchema's own doc comment)."
);
