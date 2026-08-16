import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { RecipeScriptSchema } from "../src/recipe.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import { explainRecipe } from "../src/recipe-explain.ts";

/**
 * `npm run validate-recipe -- <path-to-recipe.json>` — the CLI entry point
 * for validating a recipe that ISN'T (yet) one of `data/recipes/*.json`,
 * e.g. one authored by a future external "recipe creator" frontend. See
 * `recipe-explain.ts`'s doc comment for the mechanism this wraps.
 *
 * Unlike `scripts/validate.ts` (which batch-checks every canonical recipe
 * already in this repo, plus schema/cross-reference checks on entities/
 * actions/etc. themselves), this script takes exactly one recipe file path
 * and answers "is THIS recipe, submitted against this repo's existing
 * rules, actually runnable" — the "system rules" being `data/entities`,
 * `data/actions`, `data/ccps` (loaded the same way every other script in
 * this repo loads them; nothing about the canonical vocabulary changes for
 * an externally-authored recipe).
 */

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run validate-recipe -- <path-to-recipe.json>");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(filePath, "utf8"));
} catch (err) {
  console.error(`Could not read/parse "${filePath}": ${(err as Error).message}`);
  process.exit(1);
}

const parsed = RecipeScriptSchema.safeParse(raw);
if (!parsed.success) {
  console.error(`FAIL "${filePath}" does not match RecipeScriptSchema:`);
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}
const recipe = parsed.data;

console.log(`=== Pre-flight report: "${recipe.names.en}" ===\n`);

const explanation = explainRecipe(recipe, entities, actions);

console.log(`Tools needed:  ${explanation.tools.needed.join(", ") || "(none)"}`);
console.log(`Tools declared (availableTools): ${recipe.availableTools.join(", ") || "(none)"}`);
if (explanation.tools.missing.length > 0) {
  console.log(`MISSING tools: ${explanation.tools.missing.join(", ")}`);
}
for (const { capability, candidates } of explanation.tools.missingCapabilities) {
  console.log(
    `MISSING tool capability "${capability}" — declared availableTools satisfy none of it. ` +
      `Candidates that would: ${candidates.join(", ") || "(none known in this vocabulary)"}`
  );
}

console.log(
  "\nStep actionKind (instantaneous | continuous | unaudited — action.ts, PAPER_NOTES_2608.04768.md TICKET 1):"
);
for (const { stepIndex, actionId, actionKind } of explanation.actionKinds) {
  console.log(`  [${stepIndex}] ${actionId}: ${actionKind ?? "unaudited"}`);
}

console.log(`\nIngredient capabilities needed: ${explanation.ingredients.needed.join(", ") || "(none)"}`);
for (const { capability, candidates } of explanation.ingredients.missing) {
  console.log(
    `MISSING ingredient capability "${capability}" — nothing in initialInventory satisfies it. ` +
      `Candidates that would: ${candidates.join(", ") || "(none known in this vocabulary)"}`
  );
}

if (explanation.timingAdvisories.length > 0) {
  console.log("\nTiming advisories:");
  for (const advisory of explanation.timingAdvisories) console.log(`  - ${advisory}`);
}
if (explanation.prepAdvisories.length > 0) {
  console.log("\nPrep advisories:");
  for (const advisory of explanation.prepAdvisories) console.log(`  - ${advisory}`);
}

console.log("\n=== Running the recipe (ground truth) ===\n");
const result = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
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

console.log("\nOK — recipe is schema-valid and runs end-to-end with zero step errors.");
