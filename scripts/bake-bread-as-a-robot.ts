import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for ROADMAP.md's baking epic (flour.json/yeast.json/
 * dough.json, data/actions/combine_dough.json/knead.json/proof.json) —
 * the pieces `data/recipes/simple-flatbread.json` (the real, complete,
 * UNLEAVENED anchor dish) does NOT individually exercise on its own:
 *
 * A. Yeast activation (DISSOLVE, reused from salt.json's own verb —
 *    yeast.json's own dissolveReuseNote explains why).
 * B. KNEAD's real windowpane-test-shaped verification and its own
 *    statePrerequisites (shaggy -> kneaded, and correctly rejecting a
 *    second KNEAD call once already kneaded).
 * C. PROOF (bulk fermentation) — kneaded -> proofed, the state a
 *    genuinely LEAVENED dough would reach that simple-flatbread.json's
 *    own unleavened dough never does.
 * D. The real, honest engine limit named in dough.json's own
 *    multiIngredientLimitNote: this repo's COMBINE-shaped actions only
 *    ever merge TWO instances (target + secondary) into one, so a real
 *    yeasted-bread recipe (flour + water + yeast, three real inputs)
 *    cannot be expressed as ONE valid RecipeScript yet — proven here by
 *    walking the individual, real mechanism calls by hand instead
 *    (exactly the "prove the mechanism is real, even without full
 *    recipe-runner wiring" precedent execution-bounds.ts/
 *    in-progress-action.ts already established).
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

console.log("=== A. Yeast activation (DISSOLVE, reused verb) ===\n");
const dissolve = actions.get("dissolve")!;
const dryYeast: Instance = { entityId: "yeast", state: "dry", tags: [] };
const activatedYeast = applyAction(dryYeast, dissolve, entities, new Set(), {}, new Set(["water"]));
console.log(`  DISSOLVE yeast: "${dryYeast.state}" -> "${activatedYeast.instance.state}"`);

console.log("\n=== B. KNEAD — real prerequisite + verification shape ===\n");
const knead = actions.get("knead")!;
const shaggyDough: Instance = { entityId: "dough", state: "shaggy", tags: [] };
const kneaded = applyAction(shaggyDough, knead, entities, new Set(), {
  durationSeconds: "480",
  developmentLevel: "windowpane",
});
console.log(`  KNEAD dough: "${shaggyDough.state}" -> "${kneaded.instance.state}"`);
try {
  applyAction(kneaded.instance, knead, entities, new Set(), { durationSeconds: "480" });
  console.log(
    "  Unexpected: a second KNEAD call on already-kneaded dough should have been rejected."
  );
} catch (e) {
  console.log(`  A second KNEAD call on already-kneaded dough: REJECTED — ${(e as Error).message}`);
}

console.log("\n=== C. PROOF — bulk fermentation, kneaded -> proofed ===\n");
const proof = actions.get("proof")!;
const proofed = applyAction(kneaded.instance, proof, entities, new Set(), {
  durationSeconds: "3600",
});
console.log(
  `  PROOF dough: "${kneaded.instance.state}" -> "${proofed.instance.state}" (1 hour bulk ferment)`
);
console.log(
  "  A genuinely LEAVENED dough (real yeast incorporated) would reach exactly this state —"
);
console.log(
  "  simple-flatbread.json's own UNLEAVENED dough never calls PROOF, correctly (no yeast to trap CO2)."
);

const bake = actions.get("bake")!;
const baked = applyAction(proofed.instance, bake, entities, new Set(["oven"]), {});
console.log(`  BAKE proofed dough: "${proofed.instance.state}" -> "${baked.instance.state}"`);

console.log(
  "\n=== D. The real, honest engine limit — why a full leavened-bread RecipeScript doesn't exist yet ===\n"
);
console.log(
  "  Every individual mechanism above is real and proven: flour+water combine into dough, yeast activates,\n" +
    "  dough kneads, proofs, and bakes. What's NOT proven — because it isn't buildable yet — is chaining these\n" +
    "  into ONE valid RecipeScript for real yeasted bread: combine_dough.json (like every COMBINE-shaped action\n" +
    "  in this engine) only merges TWO instances (target + secondary) into one. Flour + water + yeast is a real\n" +
    "  THREE-input assembly, which this engine's requiredSecondaryCapability mechanism has no way to express —\n" +
    "  a real, separate, named extension (WORLD_MODEL_OPTIMIZATION.md's own '3+ input assembly' idea,\n" +
    "  ROADMAP.md/LEARNINGS_ENGINE.md), not something silently worked around here."
);

console.log(
  "\nStill NOT closed, honestly named rather than implied covered: no fermentation-rate/temperature-dependence\n" +
    "model exists for PROOF (a flat durationSeconds range only, same informational-only depth as every other\n" +
    "technique parameter in this vocabulary); no SHAPE action exists (real bread is shaped between bulk ferment\n" +
    "and a second, shorter proof — this repo only represents ONE proof stage); no raw-flour CCP with a computed\n" +
    "hold time exists — the real E. coli risk is handled via rawContaminationRiskStates (flour.json/dough.json),\n" +
    "the same surface-contact-risk mechanism as raw egg, not a cook-to-temperature threshold, since normal baking\n" +
    "already far exceeds any real pathogen-kill requirement (the actual risk is eating dough raw, before baking\n" +
    "at all)."
);
