import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import { importCooklangDraft } from "../src/cooklang.ts";

/**
 * `npm run cooklang-import -- <path-to-file.cook>` — the CLI entry point
 * for `importCooklangDraft` (`src/cooklang.ts`). Prints the parsed steps,
 * every ingredient token matched against a real `data/entities/*.json`
 * entity, every unresolved token named (not silently dropped), and a
 * DRAFT `initialInventory` a human still has to turn into a real
 * `RecipeScript` (add `sequence`, then `npm run validate-recipe`) — same
 * "never `.parse()`d here" precedent `cooklang.ts` itself documents.
 */

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: npm run cooklang-import -- <path-to-file.cook>");
  process.exit(1);
}

let source: string;
try {
  source = readFileSync(filePath, "utf8");
} catch (err) {
  console.error(`Could not read "${filePath}": ${(err as Error).message}`);
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));

const draft = importCooklangDraft(source, entities);

console.log(`=== Parsed "${filePath}" ===\n`);
console.log(`Metadata: ${JSON.stringify(draft.metadata)}`);
console.log(`Steps: ${draft.steps.length}`);
for (const [i, step] of draft.steps.entries()) {
  console.log(`  [${i}]${step.section ? ` (${step.section})` : ""} ${step.text}`);
}

console.log(`\nResolved ingredients (${draft.resolvedIngredients.length}):`);
for (const { ref, entityId } of draft.resolvedIngredients) {
  console.log(`  @${ref.token} -> ${entityId}`);
}

if (draft.unresolvedTokens.length > 0) {
  console.log(`\nUnresolved tokens (${draft.unresolvedTokens.length}) — named, not guessed at:`);
  for (const token of draft.unresolvedTokens) console.log(`  @${token}`);
  console.log(
    "  (no matching Entity.cooklang.canonicalToken or bare entity id in data/entities/*.json)"
  );
}

console.log(`\nProposed initialInventory draft (${draft.proposedInventory.length} instances):`);
console.log(JSON.stringify(draft.proposedInventory, null, 2));

console.log(
  "\nThis is a DRAFT, not a runnable RecipeScript: turning step prose into typed actionId/params " +
    "is not attempted here (see cooklang-translate.ts's translateCooklangDocument for that piece, or " +
    "author `sequence` by hand) — then `npm run validate-recipe -- <path>` before treating it as real."
);
