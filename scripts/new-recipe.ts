import { writeFileSync, existsSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import { buildRecipeScaffold } from "../src/recipe-scaffold.ts";

/**
 * `npm run new-recipe -- <output-path.json> <entityId1> [entityId2 ...]`
 * — the scaffold generator `AUTHORING.md` §3 named as a real, unbuilt
 * gap. See `recipe-scaffold.ts`'s own doc comment for why the generated
 * file is intentionally NOT yet a valid `RecipeScript` (empty
 * `sequence`) — this script's job ends at writing that honest starting
 * point and printing what to do next, not at producing something
 * `validate-recipe` would already accept.
 */

const outputPath = process.argv[2];
const entityIds = process.argv.slice(3);

if (!outputPath || entityIds.length === 0) {
  console.error("Usage: npm run new-recipe -- <output-path.json> <entityId1> [entityId2 ...]");
  console.error("Example: npm run new-recipe -- my-recipe.json potato oil");
  process.exit(1);
}

if (existsSync(outputPath)) {
  console.error(`Refusing to overwrite existing file: ${outputPath}`);
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));

const slug = basename(outputPath, extname(outputPath));

let scaffold;
try {
  scaffold = buildRecipeScaffold({ slug, entityIds }, entities);
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}

writeFileSync(outputPath, JSON.stringify(scaffold, null, 2) + "\n", "utf8");

console.log(`Wrote ${outputPath}\n`);
console.log(`id: "${scaffold.id}"`);
console.log(`names.en: "${scaffold.names.en}"\n`);

console.log("Initial inventory (real entities, real starting states — check these against data/entities/*.json):");
for (const item of scaffold.initialInventory) {
  const entity = entities.get(item.entityId)!;
  const capabilities = Object.entries(entity.capabilities)
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  console.log(`  ${item.id}: ${entity.names.en} (${item.entityId}), starting state "${item.state}"`);
  console.log(`    capabilities: ${capabilities.join(", ") || "(none)"}`);
  console.log(`    other possible states: ${entity.possibleStates.filter((s) => s !== item.state).join(", ") || "(none)"}`);
}

console.log(
  "\nNOT yet a valid recipe — sequence is empty (RecipeScriptSchema requires at least one step) and " +
    "availableTools is empty too. Browse data/actions/*.json for verbs whose requiredTargetCapability matches " +
    "one of the capabilities listed above, add steps to \"sequence\", then run:\n"
);
console.log(`  npm run validate-recipe -- ${outputPath}\n`);
console.log("...and follow AUTHORING.md's loop (read the pre-flight report + execution log, fix, repeat) until it's clean.");
