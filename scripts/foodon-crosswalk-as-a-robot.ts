import { join } from "node:path";
import { loadEntities, loadFoodOnCrosswalk } from "../src/registry.ts";
import { foodOnIriFromCurie } from "../src/foodon-crosswalk.ts";

/**
 * Capability test for `src/foodon-crosswalk.ts` — real FoodOn (foodon.org)
 * classes matched against real `data/entities/*.json`, live via EBI OLS4,
 * 2026-08-19. Confirms: every crosswalk file's `id` resolves to a real
 * entity (also checked by `npm run validate`'s own hard-fail cross-
 * reference, re-confirmed here read-only); `foodOnIriFromCurie` recomputes
 * the exact same `iri` each file already stores directly (no drift between
 * the two); and the honestly-scoped gaps (composites, tools, a few
 * genuinely unmatched entities) are named, not silently absent.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const crosswalk = loadFoodOnCrosswalk(join(root, "data", "foodon-crosswalk"));

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

section("Real crosswalk entries, resolved against real entities");

let mismatches = 0;
for (const [entityId, file] of [...crosswalk.entries()].sort()) {
  const entity = entities.get(entityId);
  if (!entity) throw new Error(`Crosswalk references unknown entity: ${entityId}`);
  const recomputedIri = foodOnIriFromCurie(file.foodOn.curie);
  const iriMatches = recomputedIri === file.foodOn.iri;
  if (!iriMatches) mismatches++;
  console.log(
    `${entity.names.en.padEnd(16)} -> ${file.foodOn.curie}  "${file.foodOn.label}"` +
      `  [${file.foodOn.citation.confidence}]${iriMatches ? "" : "  IRI MISMATCH"}`
  );
}
if (mismatches > 0) {
  throw new Error(
    `${mismatches} crosswalk file(s) store an iri that doesn't match foodOnIriFromCurie(curie) — real drift, not expected.`
  );
}

section("Honestly-scoped gaps — named, not silently missing");

const toolEntityIds = [...entities.values()]
  .filter((e) => e.kind === "tool")
  .map((e) => e.id)
  .sort();
const ingredientEntityIds = [...entities.values()]
  .filter((e) => e.kind === "ingredient")
  .map((e) => e.id)
  .sort();
const uncoveredIngredients = ingredientEntityIds.filter((id) => !crosswalk.has(id));

console.log(`Entities total: ${entities.size} (${ingredientEntityIds.length} ingredients, ${toolEntityIds.length} tools)`);
console.log(`Real FoodOn matches: ${crosswalk.size}`);
console.log(`Tools (categorically out of scope — FoodOn doesn't model cookware): ${toolEntityIds.join(", ")}`);
console.log(`Ingredients with no FoodOn match found this session: ${uncoveredIngredients.join(", ")}`);

if (toolEntityIds.some((id) => crosswalk.has(id))) {
  throw new Error(
    "A tool entity has a FoodOn crosswalk entry — FoodOn doesn't model cookware, this would be a real scope violation."
  );
}

const expectedUncovered = [
  "kosher_salt",
  "onion_peel",
  "garlic_peel",
  "egg_cracked",
  "potato_onion_mixture",
  "tortilla_mixture",
  "tortilla_mixture_con_cebolla",
].sort();
if (JSON.stringify(uncoveredIngredients) !== JSON.stringify(expectedUncovered)) {
  throw new Error(
    `Uncovered-ingredient list changed since this was last checked — was [${expectedUncovered.join(", ")}], ` +
      `is now [${uncoveredIngredients.join(", ")}]. Either update this script's expectation (a real new gap ` +
      `was found or closed) or investigate why coverage silently changed.`
  );
}

console.log(
  "\nConfirmed: every real crosswalk entry resolves to a real entity with a self-consistent iri/curie pair, " +
    "no tool entity was force-fit into a food ontology, and the entities with no FoodOn match are exactly " +
    "the ones named as gaps in reference/foodon-crosswalk.md — not a silently shrinking or growing set."
);

console.log("\nSource: FoodOn (foodon.org), OBO Foundry, CC BY 4.0 — see REFERENCES.md.");
console.log("\nAll foodon-crosswalk.ts capability checks passed.");
