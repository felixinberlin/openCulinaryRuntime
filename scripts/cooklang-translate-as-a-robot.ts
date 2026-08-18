import { join } from "node:path";
import {
  loadEntities,
  loadActions,
  loadRecipes,
  loadCcps,
  loadHeatSources,
} from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import { exportToCooklang } from "../src/cooklang.ts";
import { translateCooklangDocument } from "../src/cooklang-translate.ts";

/**
 * Capability test for `src/cooklang-translate.ts` — the free-text
 * step-prose -> typed `actionId`/parameter translator `AUTHORING.md` §2
 * (point 2) and `ROADMAP.md` Phase 5 both named as the one piece of
 * Cooklang support that isn't mechanical, closed 2026-08-18 as a real,
 * bounded, DETERMINISTIC keyword/allowed-value matcher (no LLM call —
 * see the module's own top doc comment for why that's a real boundary,
 * not a shortcut).
 *
 * Proof: take a REAL multi-step recipe with a genuine `COMBINE`-shaped
 * step (`handmade-alioli-egg-yolk.json`'s `EMULSIFY`,
 * `requiredSecondaryCapability`) and a genuine `SEPARATE` spawn, export
 * it to Cooklang text (`cooklang.ts`, already proven independently), then
 * translate that text BACK into a draft `RecipeScript` — with no access
 * to the original `RecipeStep`s, only the prose+tokens a human would
 * actually author. Checks how much of the original sequence a
 * deterministic matcher recovers, and that everything it can't recover
 * is named in `stepTranslations[].notes`, not silently wrong.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

const recipe = recipes.get("handmade_alioli_egg_yolk");
if (!recipe) throw new Error("Fixture recipe missing: handmade_alioli_egg_yolk");

const runResult = runRecipe(recipe, entities, actions, ccps, undefined, heatSources);
if (runResult.errors.length > 0) {
  throw new Error(
    `Fixture recipe failed to run: ${runResult.errors.map((e) => e.message).join("; ")}`
  );
}

const cookText = exportToCooklang(recipe, entities, actions, runResult.spawnedEntityIds);
console.log("--- Cooklang text (produced by cooklang.ts, not hand-authored) ---");
console.log(cookText);

const translation = translateCooklangDocument(cookText, "alioli-retranslated", entities, actions);

console.log("--- Translated sequence ---");
for (const [i, step] of translation.stepTranslations.entries()) {
  const inSequence = translation.draft.sequence.some(
    (s) => s.actionId === step.actionId && s.targetInstanceId === step.targetInstanceId
  );
  console.log(
    `Step ${i + 1}: "${step.sourceText}"\n` +
      `  -> actionId=${step.actionId ?? "(none)"} target=${step.targetInstanceId ?? "(none)"} inSequence=${inSequence}\n` +
      `  notes: ${step.notes.length > 0 ? step.notes.join(" | ") : "(none)"}`
  );
}

const expectedActionIds = ["peel", "salt", "crush", "separate", "pasteurize", "emulsify"];
const translatedActionIds = translation.draft.sequence.map((s) => s.actionId);
console.log("\nExpected actionIds (original recipe):", expectedActionIds);
console.log("Recovered actionIds (translated draft):", translatedActionIds);

if (JSON.stringify(translatedActionIds) !== JSON.stringify(expectedActionIds)) {
  throw new Error(
    `Translator regressed: expected to recover all 6 original actionIds in order, got ${JSON.stringify(translatedActionIds)}.`
  );
}

// EMULSIFY is NOT a COMBINE-shaped action in this repo's real data (it uses
// requiredIngredientCapabilities, not requiredSecondaryCapability — both
// oil and egg_yolk are genuinely "available," never "consumed as a
// second instance"). So the correct check here is that BOTH resolve into
// availableIngredientInstanceIds, not that either becomes secondaryInstanceId.
const emulsifyStep = translation.draft.sequence.find((s) => s.actionId === "emulsify");
if (
  !emulsifyStep ||
  !["aceite-5", "yema-4"].every((id) => emulsifyStep.availableIngredientInstanceIds.includes(id))
) {
  throw new Error(
    `Translator regressed: expected EMULSIFY's available ingredients to include both aceite-5 and yema-4, got ${JSON.stringify(emulsifyStep?.availableIngredientInstanceIds)}.`
  );
}
console.log(
  `\nConfirmed: EMULSIFY's two ingredient references ("aceite", "yema") both resolved into ` +
    "availableIngredientInstanceIds — correctly NOT treated as a COMBINE-shaped secondaryInstanceId guess, " +
    "since real emulsify.json has no requiredSecondaryCapability."
);

const pasteurizeStep = translation.stepTranslations.find((s) => s.actionId === "pasteurize");
if (!pasteurizeStep || !pasteurizeStep.notes.some((n) => n.includes("waterTempC"))) {
  throw new Error(
    "Translator regressed: PASTEURIZE's required waterTempC (a numeric parameter never in the exported prose) should be named as missing, not silently guessed."
  );
}
console.log(
  `\nConfirmed: PASTEURIZE's real, required "waterTempC" safety parameter — which never appears as text in the ` +
    "exported Cooklang (only in a parenthetical param dump this module deliberately doesn't parse as prose) — " +
    "is named as missing, not fabricated. This is the module's own documented boundary working as intended, " +
    "not a gap discovered by accident."
);

// --- Part B: a real cross-action verb collision (an honest finding, not a
// contrived one) --- EMULSIFY (Part A) turned out not to exercise
// requiredSecondaryCapability against real data — combine.json does, and
// tortilla-de-patatas.json genuinely uses it. But this repo's real data has
// its OWN gap: combine.json/combine_dough.json/combine_potato_onion.json/
// combine_con_cebolla.json all share the IDENTICAL verb COMBINE, so the
// bare word "Combine" (what a human naturally writes, and what
// exportToCooklang naturally emits — see cooklang.ts) is genuinely
// ambiguous among four distinct real actions. This module's job here is
// to prove it reports that ambiguity rather than silently guessing one
// (which would be wrong 3 times out of 4).

console.log(
  "\n\n=== Part B: a real cross-action verb collision — tortilla_de_patatas' COMBINE step ==="
);

const tortilla = recipes.get("tortilla_de_patatas");
if (!tortilla) throw new Error("Fixture recipe missing: tortilla_de_patatas");

const tortillaRun = runRecipe(tortilla, entities, actions, ccps, undefined, heatSources);
if (tortillaRun.errors.length > 0) {
  throw new Error(
    `Fixture recipe failed to run: ${tortillaRun.errors.map((e) => e.message).join("; ")}`
  );
}
const tortillaCookText = exportToCooklang(
  tortilla,
  entities,
  actions,
  tortillaRun.spawnedEntityIds
);
console.log(tortillaCookText);

const tortillaTranslation = translateCooklangDocument(
  tortillaCookText,
  "tortilla-retranslated",
  entities,
  actions
);
const combineTranslation = tortillaTranslation.stepTranslations.find((s) =>
  s.sourceText.startsWith("Combine ")
);
if (!combineTranslation)
  throw new Error('Expected a Cooklang step starting with "Combine " — export shape changed?');

const inSequence = combineTranslation.actionId !== undefined;
const reportsAmbiguity = combineTranslation.notes.some((n) =>
  n.startsWith("ambiguous action verb")
);
if (inSequence || !reportsAmbiguity) {
  throw new Error(
    `Translator regressed: expected "${combineTranslation.sourceText}" to be reported as an ambiguous verb ` +
      `(4 real actions share COMBINE), not resolved to one. Got actionId=${combineTranslation.actionId}, notes=${JSON.stringify(combineTranslation.notes)}.`
  );
}
console.log(
  `\nConfirmed against REAL data: "${combineTranslation.sourceText}" was correctly reported as AMBIGUOUS ` +
    `(${combineTranslation.notes[0]}) rather than silently resolved to one of the four real actions that share ` +
    "the verb COMBINE — this repo's own data has a genuine verb collision here, and this module names it " +
    "instead of guessing. requiredSecondaryCapability inference itself (once a verb IS unambiguous) is proven " +
    "separately in tests/cooklang-translate.test.ts."
);

console.log("\nAll cooklang-translate.ts capability checks passed.");
