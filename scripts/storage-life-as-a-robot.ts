import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadRecipes } from "../src/registry.ts";
import { explainRecipe } from "../src/recipe-explain.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * First end-to-end proof for `ingredient.ts`'s `StorageLifeSchema`, added
 * 2026-08-17 (ROADMAP.md's "Storage/shelf-life common knowledge" gap —
 * "nothing here answers 'how long is this safe/good for' anywhere," true
 * until this change). Mirrors `allergens-as-a-robot.ts`'s role: run the
 * real pipeline against the real loaded data, not just reason about it.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const recipes = loadRecipes(join(root, "data", "recipes"));

console.log("1. Every real entity's real, cited storageLifeByState data, as shipped:\n");
for (const entity of entities.values()) {
  const entries = Object.entries(entity.storageLifeByState);
  if (entries.length === 0) continue;
  console.log(`  ${entity.id}:`);
  for (const [state, life] of entries) {
    const parts: string[] = [];
    if (life.refrigeratedDays) parts.push(`refrigerated ${life.refrigeratedDays.min}-${life.refrigeratedDays.max}d`);
    if (life.pantryMonths) parts.push(`pantry ${life.pantryMonths.min}-${life.pantryMonths.max}mo`);
    if (life.roomTempHours) parts.push(`room temp ${life.roomTempHours.min}-${life.roomTempHours.max}h`);
    if (life.doNotRefrigerate) parts.push("do NOT refrigerate");
    console.log(`    "${state}": ${parts.join(", ")}`);
  }
}

console.log(
  "\n2. State-specific keying, proven with a REAL entity (egg) — the same instance's own entity carries two " +
    "genuinely different figures depending on WHICH state a recipe starts it in, not one flat number:\n"
);
function tinyRecipe(state: string): RecipeScript {
  return {
    id: `storage-test-${state}`,
    names: { en: "storage test" },
    initialInventory: [{ id: "egg-1", entityId: "egg", state, tags: [] }],
    availableTools: [],
    sequence: [{ actionId: "salt", targetInstanceId: "egg-1", params: {}, availableIngredientInstanceIds: ["salt"] }],
    metadata: {},
  };
}
for (const state of ["raw", "boiled", "peeled"]) {
  const summary = explainRecipe(tinyRecipe(state), entities, actions, ccps).storageSummary;
  const life = summary[0]?.storageLife;
  console.log(
    `  egg starting "${state}": refrigeratedDays = ${life?.refrigeratedDays ? `${life.refrigeratedDays.min}-${life.refrigeratedDays.max}` : "none declared"}`
  );
}

console.log("\n3. storageSummary computed over every real data/recipes/*.json:\n");
for (const recipe of recipes.values()) {
  const summary = explainRecipe(recipe, entities, actions, ccps).storageSummary;
  const label = summary.length > 0 ? summary.map((s) => `${s.instanceId}("${s.state}")`).join(", ") : "(none)";
  console.log(`  ${recipe.id}: ${label}`);
}

console.log(
  "\n4. Potato's doNotRefrigerate — a real, cited, food-QUALITY (not safety) fact, connecting to this repo's " +
    "own existing frying-physics citations (fry.json/cut-dimensions.ts/heat-penetration.ts):\n"
);
const potatoLife = entities.get("potato")!.storageLifeByState.raw;
console.log(`  potato "raw": doNotRefrigerate = ${potatoLife.doNotRefrigerate}, pantryMonths = ${JSON.stringify(potatoLife.pantryMonths)}`);

console.log(
  "\nStill NOT closed by this addition, named rather than implied covered: this is DECLARATION only — no " +
    "elapsed-real-world-time concept exists anywhere in this engine (no purchase date, no 'how long has this " +
    "actually been in the fridge'), the same honest limitation egg.json's own freshnessNote already names for " +
    "fresh/aged tags, so nothing here can say whether a SPECIFIC instance is still within range, only what the " +
    "range is; a leftover COOKED dish's own shelf life (as opposed to a raw ingredient's) is a RecipeScript-level " +
    "fact this repo doesn't model at all; garlic-in-oil's real, shorter, food-SAFETY storage risk stays " +
    "deliberately uncovered here — see infuse.json's own safetyNote for why that's a genuinely different case; " +
    "only egg/egg_yolk/egg_white/potato/garlic have been audited — most entities in this repo still have none."
);
