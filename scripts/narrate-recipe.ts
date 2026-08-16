import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { RecipeScriptSchema } from "../src/recipe.ts";
import { narrateRecipe, renderNarrationMarkdown } from "../src/recipe-narrator.ts";

/**
 * `npm run narrate-recipe -- <path-to-recipe.json> <output-path>` — "read
 * this recipe back to me": structure, needs, system inferences, created
 * elements, verbs used, timing, final inventory, all composed from
 * `recipe-explain.ts` + `recipe-runner.ts` (see `recipe-narrator.ts`'s own
 * doc comment — nothing here is a new source of truth). Output format is
 * chosen by the output path's extension: `.json` writes the structured
 * `RecipeNarration` object directly; anything else (default `.md`) writes
 * the rendered Markdown document.
 */

const recipePath = process.argv[2];
const outputPath = process.argv[3];
if (!recipePath || !outputPath) {
  console.error("Usage: npm run narrate-recipe -- <path-to-recipe.json> <output-path.md|.json>");
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const raw = JSON.parse(readFileSync(recipePath, "utf8"));
const parsed = RecipeScriptSchema.safeParse(raw);
if (!parsed.success) {
  console.error(`"${recipePath}" does not match RecipeScriptSchema:`);
  for (const issue of parsed.error.issues)
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const narration = narrateRecipe(parsed.data, entities, actions, ccps);

if (outputPath.endsWith(".json")) {
  writeFileSync(outputPath, JSON.stringify(narration, null, 2) + "\n", "utf8");
} else {
  writeFileSync(outputPath, renderNarrationMarkdown(narration) + "\n", "utf8");
}

console.log(`Wrote ${outputPath}`);
