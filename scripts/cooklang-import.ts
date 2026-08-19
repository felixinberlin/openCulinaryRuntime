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

/** Matches a `recipes.cooklang.org` browser recipe-PAGE path (`/recipes/<id>`)
 *  against `URL.pathname` alone — not the full URL string — so a real
 *  browser-copied link with a trailing `?utm_source=...` query string or
 *  `#section` fragment (both stripped from `pathname` by the `URL` parser
 *  itself) still matches, rather than silently falling through to
 *  fetching the HTML page as-is. */
const COOKLANG_FEDERATION_RECIPE_PAGE_PATH = /^\/recipes\/(\d+)\/?$/;

async function loadSource(input: string): Promise<string> {
  if (!/^https?:\/\//i.test(input)) {
    return readFileSync(input, "utf8");
  }

  let url = new URL(input);
  if (url.hostname === "recipes.cooklang.org") {
    const pageMatch = COOKLANG_FEDERATION_RECIPE_PAGE_PATH.exec(url.pathname);
    if (pageMatch) {
      url = new URL(`https://recipes.cooklang.org/api/recipes/${pageMatch[1]}/download`);
      console.error(`(recipes.cooklang.org recipe page detected — fetching raw .cook from ${url})`);
    }
  }

  console.error(`Fetching ${url} ...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} fetching ${url}`);
  }
  // A guard against exactly the failure the pathname rewrite above exists
  // to avoid: silently "parsing" an HTML page as Cooklang text and
  // producing a garbage draft with no diagnostic. Catches it even for a
  // URL this script has no site-specific rewrite for (a future
  // recipes.cooklang.org URL-scheme change, or any other HTML-serving
  // host) — `parseCooklang` itself has no format validation to fall back on.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `${url} returned HTML (content-type: ${contentType}), not plain Cooklang text — refusing to parse it as one.`
    );
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
