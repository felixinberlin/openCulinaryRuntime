import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import { importCooklangDraft } from "../src/cooklang.ts";

/**
 * `npm run cooklang-import -- <path-to-file.cook | url>` — the CLI entry
 * point for `importCooklangDraft` (`src/cooklang.ts`). Prints the parsed
 * steps, every ingredient token matched against a real
 * `data/entities/*.json` entity, every unresolved token named (not
 * silently dropped), and a DRAFT `initialInventory` a human still has to
 * turn into a real `RecipeScript` (add `sequence`, then `npm run
 * validate-recipe`) — same "never `.parse()`d here" precedent
 * `cooklang.ts` itself documents.
 *
 * The URL form (added 2026-08-19, direct user request naming
 * https://recipes.cooklang.org/ specifically) uses the platform's global
 * `fetch` — the first, and as of this change the ONLY, place in this
 * repo's execution path that makes a real network call; every other
 * script/`src/*.ts` file is offline (see `CLAUDE.md`'s "package.json's
 * only dependency is zod" framing — still true, this is Node's own
 * built-in `fetch`, no new dependency). A `recipes.cooklang.org/recipes/
 * <id>` browser page URL is auto-rewritten to that site's own raw-text
 * `/api/recipes/<id>/download` endpoint (confirmed live, 2026-08-19 — the
 * page itself is HTML, not parseable Cooklang text); any other URL is
 * fetched as-is, so a raw GitHub `.cook` file URL (or any other plain-text
 * host) works unchanged.
 */

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: npm run cooklang-import -- <path-to-file.cook | url>");
  process.exit(1);
}

const COOKLANG_FEDERATION_RECIPE_PAGE =
  /^https?:\/\/recipes\.cooklang\.org\/recipes\/(\d+)\/?$/i;

async function loadSource(input: string): Promise<string> {
  if (!/^https?:\/\//i.test(input)) {
    return readFileSync(input, "utf8");
  }

  let url = input;
  const pageMatch = COOKLANG_FEDERATION_RECIPE_PAGE.exec(url);
  if (pageMatch) {
    url = `https://recipes.cooklang.org/api/recipes/${pageMatch[1]}/download`;
    console.error(`(recipes.cooklang.org recipe page detected — fetching raw .cook from ${url})`);
  }

  console.error(`Fetching ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }
  return await response.text();
}

let source: string;
try {
  source = await loadSource(arg);
} catch (err) {
  console.error(`Could not load "${arg}": ${(err as Error).message}`);
  process.exit(1);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));

const draft = importCooklangDraft(source, entities);

console.log(`\n=== Parsed "${arg}" ===\n`);
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
