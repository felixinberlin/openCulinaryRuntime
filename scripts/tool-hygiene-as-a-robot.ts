import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import type { RecipeScript } from "../src/recipe.ts";

/**
 * First end-to-end proof for src/tool-hygiene.ts / data/actions/wash_tool.json,
 * added 2026-08-16 — closes ROADMAP.md's long-open "Cross-contamination /
 * hygiene knowledge" gap: the same knife used on raw egg, then reused on a
 * ready-to-eat ingredient (garlic) with no wash in between.
 *
 * No existing recipe in data/recipes/*.json can demonstrate this (checked
 * directly before building this mechanism — see recipe-runner.ts's own top
 * doc comment): CUT/PEEL are the only actions requiring a knife, and egg's
 * own statePrerequisites mean a knife can never legally touch RAW egg via
 * CUT (cut requires 'peeled', peel requires 'boiled' first). CRACK, the
 * only action that ever touches raw egg, is tool-agnostic — so this repo's
 * crack.json gained an optional toolInstanceId parameter (2026-08-16,
 * alongside this script) purely so the named scenario is reachable at all.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function makeRecipe(sequence: RecipeScript["sequence"]): RecipeScript {
  return {
    id: "tool-hygiene-test",
    names: { en: "Tool hygiene test" },
    initialInventory: [
      { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
      { id: "garlic-1", entityId: "garlic", state: "peeled", tags: [] },
    ],
    availableTools: ["knife"],
    sequence,
    metadata: {},
  };
}

console.log(
  "Goal: prove tool-hygiene tracks contamination, warns on unwashed reuse, and clears on WASH_TOOL.\n"
);

// ---------------------------------------------------------------------
// 1. CRACK raw egg with a named knife instance — contaminates it.
// ---------------------------------------------------------------------
const crackRecipe = makeRecipe([
  {
    actionId: "crack",
    targetInstanceId: "egg-1",
    params: { toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
]);
const crackResult = runRecipe(crackRecipe, entities, actions);
const contamination = crackResult.toolContamination.get("knife-1");
console.log(`1. After CRACK egg-1 with knife-1: contaminated = ${contamination?.contaminated}`);
console.log(
  `   ${crackResult.log.find((l) => l.includes("contaminated by contact with")) ?? "(no contamination line found — BUG)"}\n`
);

// ---------------------------------------------------------------------
// 2. Reuse the SAME (now-contaminated) knife instance on raw garlic — a
//    real ready-to-eat ingredient in this vocabulary (crushed raw into
//    alioli, data/recipes/handmade-alioli.json) — with no wash in
//    between. Advisory, per explicit user decision: warns, does not
//    reject; the step still succeeds.
// ---------------------------------------------------------------------
const reuseRecipe = makeRecipe([
  {
    actionId: "crack",
    targetInstanceId: "egg-1",
    params: { toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
  {
    actionId: "cut",
    targetInstanceId: "garlic-1",
    params: { shape: "minced", toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
]);
const reuseResult = runRecipe(reuseRecipe, entities, actions);
console.log(
  `2. CUT garlic-1 with the still-contaminated knife-1, no wash: ${reuseResult.warnings.length} warning(s)`
);
console.log(`   "${reuseResult.warnings.find((w) => w.includes("reuses")) ?? "(none — BUG)"}"`);
console.log(
  `   Step still succeeded (advisory, not a reject): ${reuseResult.errors.length === 0 ? "yes" : "no"}\n`
);

// ---------------------------------------------------------------------
// 3. Same sequence, but WASH_TOOL knife-1 before reusing it on garlic —
//    no warning, and toolContamination reports clean.
// ---------------------------------------------------------------------
const washedRecipe = makeRecipe([
  {
    actionId: "crack",
    targetInstanceId: "egg-1",
    params: { toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
  {
    actionId: "wash_tool",
    targetInstanceId: "knife-1",
    params: { toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
  {
    actionId: "cut",
    targetInstanceId: "garlic-1",
    params: { shape: "minced", toolInstanceId: "knife-1" },
    availableIngredientInstanceIds: [],
  },
]);
const washedResult = runRecipe(washedRecipe, entities, actions);
const washedContamination = washedResult.toolContamination.get("knife-1");
console.log(
  `3. WASH_TOOL knife-1 before reuse: ${washedResult.warnings.filter((w) => w.includes("reuses")).length} reuse warning(s), ` +
    `final contaminated = ${washedContamination?.contaminated}`
);
console.log(`   ${washedResult.log.find((l) => l.startsWith("WASH_TOOL"))}`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no ready-to-eat-vs-will-be-" +
    "cooked-again distinction (any food-contact reuse of a contaminated tool warns, not just against RTE " +
    "targets), no cutting-board entity, no general contamination graph beyond egg/egg_cracked/egg_yolk/" +
    "egg_white — see src/tool-hygiene.ts's own doc comment for the full out-of-scope list."
);
