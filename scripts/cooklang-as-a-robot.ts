import { join } from "node:path";
import {
  loadEntities,
  loadActions,
  loadRecipes,
  loadCcps,
  loadHeatSources,
} from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import { parseCooklang, importCooklangDraft, exportToCooklang } from "../src/cooklang.ts";

/**
 * Capability test for `src/cooklang.ts` — `ROADMAP.md` Phase 5's Cooklang
 * parser/exporter, scoped exactly along the mechanical-vs-not boundary
 * `AUTHORING.md` §2 already drew before any code existed (see
 * `cooklang.ts`'s own top doc comment). Two real, independent proofs:
 *
 * A. **Import**: a hand-authored `.cook` snippet, exercising the real
 *    grammar (metadata, multi-word names, spice lock, unnamed timer, line
 *    + block comments, section headings) — parsed, then matched against
 *    this repo's REAL `data/entities/*.json` via `Entity.cooklang.
 *    canonicalToken`, with the one deliberately-unresolvable token named,
 *    not silently dropped.
 * B. **Export + round-trip**: a REAL recipe with a SPAWNED instance
 *    (`handmade-alioli-egg-yolk.json`'s `SEPARATE` -> `egg_yolk-3`, fed to
 *    `PASTEURIZE`/`EMULSIFY` two steps later) exported to Cooklang text —
 *    composing with `runRecipe`'s own `spawnedEntityIds`, the same
 *    real-ground-truth precedent `execution-bounds.ts`/`in-progress-
 *    action.ts` already established, not a second static re-derivation of
 *    the spawn-naming scheme. The exported text is then re-parsed and
 *    re-resolved, proving every ingredient token — including the one that
 *    only exists because SEPARATE spawned it mid-recipe — survives the
 *    round trip back to the correct real entity id.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// --- A. Import: real grammar, matched against real entities ---------------

section("A. Import — a hand-authored .cook snippet");

const source = `
>> title: Garlic Oil Potatoes, Cooklang draft
>> servings: 2

-- prep
Peel @patata{500%g} and cut into wedges. -- discard the peel

[- block comment:
 skip the next bit for now -]
Peel and crush @ajo{2%count}.

= Cook =
Fry @patata in #sarten{} with @aceite{50%ml} for ~{600%seconds}.
Season with @sal{=1%tsp} and @some_spice_this_repo_does_not_have{1%tsp}.
`;

const doc = parseCooklang(source);
console.log(`Parsed ${doc.steps.length} steps, metadata:`, doc.metadata);
for (const step of doc.steps) {
  console.log(`  [${step.section ?? "(no section)"}] ${step.text}`);
}

const draft = importCooklangDraft(source, entities);
console.log(
  "\nResolved ingredients:",
  draft.resolvedIngredients.map((r) => `${r.ref.token} -> ${r.entityId}`)
);
console.log("Unresolved tokens (named, not dropped):", draft.unresolvedTokens);
console.log("Proposed initialInventory draft:", JSON.stringify(draft.proposedInventory, null, 2));

if (
  draft.unresolvedTokens.length !== 1 ||
  draft.unresolvedTokens[0] !== "some_spice_this_repo_does_not_have"
) {
  throw new Error(
    "Expected exactly one deliberately-unresolvable token — import resolution regressed."
  );
}
if (draft.resolvedIngredients.length !== 4) {
  throw new Error(
    `Expected 4 resolved ingredients (patata/ajo/aceite/sal, deduped), got ${draft.resolvedIngredients.length}.`
  );
}

// --- B. Export + round-trip a real recipe with a spawned instance ---------

section("B. Export + round-trip — handmade_alioli_egg_yolk (a real SEPARATE spawn)");

const recipe = recipes.get("handmade_alioli_egg_yolk");
if (!recipe) throw new Error("Fixture recipe missing: handmade_alioli_egg_yolk");

const runResult = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
if (runResult.errors.length > 0) {
  throw new Error(
    `Fixture recipe failed to run: ${runResult.errors.map((e) => e.message).join("; ")}`
  );
}
console.log("Real spawnedEntityIds from runRecipe:", [...runResult.spawnedEntityIds.entries()]);

const cookText = exportToCooklang(recipe, entities, actions, runResult.spawnedEntityIds);
console.log("\n--- exported .cook text ---");
console.log(cookText);

const reimported = importCooklangDraft(cookText, entities);
console.log(
  "Re-resolved on import:",
  reimported.resolvedIngredients.map((r) => `${r.ref.token} -> ${r.entityId}`)
);
console.log("Unresolved on re-import:", reimported.unresolvedTokens);

const resolvedEntityIds = new Set(reimported.resolvedIngredients.map((r) => r.entityId));
for (const expected of ["garlic", "egg_yolk", "oil"]) {
  if (!resolvedEntityIds.has(expected)) {
    throw new Error(
      `Round-trip regressed: expected "${expected}" to survive export -> re-import, it didn't.`
    );
  }
}
if (reimported.unresolvedTokens.length > 0) {
  throw new Error(
    `Round-trip regressed: unexpected unresolved tokens after re-import: ${reimported.unresolvedTokens.join(", ")}`
  );
}

console.log(
  "\nConfirmed: the SPAWNED egg_yolk instance (SEPARATE's own output, not in initialInventory) exported to a " +
    'real @token and resolved back to entity id "egg_yolk" on re-import — composed with runRecipe\'s real ' +
    "spawnedEntityIds, not guessed at."
);

console.log("\nGrammar source: Cooklang spec, cooklang.org/docs/spec — see REFERENCES.md.");
console.log("\nAll cooklang.ts capability checks passed.");
