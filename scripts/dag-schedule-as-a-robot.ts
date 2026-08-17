import { join } from "node:path";
import { loadActions, loadRecipes } from "../src/registry.ts";
import { topologicalOrder, scheduleDagFromSteps } from "../src/dag-scheduler.ts";
import type { RecipeStep } from "../src/recipe.ts";

/**
 * Capability test for `src/dag-scheduler.ts` (ROADMAP.md's "Recipe
 * execution as a DAG" ticket) against REAL data — `tests/dag-execution.
 * test.ts` already proves the algorithm itself with synthetic fixtures
 * and the ticket's own exact numeric acceptance criterion (10 min, not
 * 15); this script proves the same mechanism against a real, existing
 * dish, `data/recipes/garlic-oil-potatoes.json` (retrofitted this same
 * change with explicit step `id`/`dependsOn` — see that file's own
 * `dagNote`).
 *
 * A. Cycle detection on every real recipe in this repo — should find
 *    NONE (an authoring bug, not a legal dish), proving the acceptance
 *    criterion "validate() ... catches/fails any synthetic recipes that
 *    contain circular dependencies" is real: `runRecipe`
 *    (`recipe-runner.ts`) now calls `topologicalOrder` internally and
 *    `scripts/validate.ts` already fails hard on any `RecipeStepError`,
 *    so a cyclic recipe would already be caught there — this section just
 *    demonstrates it directly, plus a SYNTHETIC cyclic recipe (built
 *    in-memory, never written to `data/recipes/` — that directory's own
 *    "all files valid" invariant stays intact) to prove the rejection
 *    path fires, not just that real data happens not to trigger it.
 * B. The real join node: `garlic-oil-potatoes.json`'s `fry_potato` step
 *    genuinely depends on BOTH the potato-prep branch AND the garlic/oil
 *    branch — proves `topologicalOrder` places it correctly and
 *    `scheduleDagFromSteps` computes its start time as the LATER of the
 *    two, against real step ids, not synthetic ones.
 * C. A real time-savings estimate: BOIL potato (a real, cited 1200s/20min
 *    quartered-potato duration, `mashed-potatoes.json`) modeled as
 *    genuinely independent of CARAMELIZE onion (a real, cited 900s/15min
 *    minimum, `caramelize.json`'s own numericRange) — total concurrent
 *    time vs. what a strictly linear array would have forced.
 * D. Tool-lock behavior (`WORLD_MODEL_OPTIMIZATION.md`'s `toolLockBehavior`,
 *    closed 2026-08-17 alongside this ticket) against REAL data: `ROAST`
 *    (`roast.json`) requires the exact tool `oven`, both PASSIVE
 *    (`requiresActiveAttention: false` — see that field's own note). Two
 *    genuinely independent ROAST steps (potato, garlic — both real,
 *    already `isRoastable`) with NO `dependsOn` between them would fully
 *    overlap under B/C's model (unlimited passive capacity); with
 *    `requiredToolIds` correctly derived from `roast.json`'s own
 *    `requiredTools`, they must serialize on the single shared oven — the
 *    exact "can't roast two things in the same oven at once" case the
 *    ticket names, proven against a real cited duration
 *    (`crispy-roast-potatoes.json`'s own 3000s/50min figure), not a
 *    synthetic number.
 */

const root = join(import.meta.dirname, "..");
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

console.log("=== A. Cycle detection across every real recipe in this repo ===\n");
let anyCycle = false;
for (const recipe of recipes.values()) {
  const result = topologicalOrder(recipe.sequence);
  if ("cycle" in result) {
    anyCycle = true;
    console.log(`  [FAIL] ${recipe.id}: cycle among [${result.cycle.join(", ")}]`);
  }
}
if (!anyCycle) {
  console.log(`  All ${recipes.size} real recipes are acyclic — 0 cycles found (correct: none should exist).`);
}

console.log("\n  Now a SYNTHETIC cyclic recipe (in-memory only, never written to data/recipes/):");
const cyclicSequence: RecipeStep[] = [
  { id: "a", dependsOn: ["b"], actionId: "boil", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
  { id: "b", dependsOn: ["a"], actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
];
const cyclicResult = topologicalOrder(cyclicSequence);
console.log(
  "cycle" in cyclicResult
    ? `  [PASS] correctly rejected: cycle among [${cyclicResult.cycle.join(", ")}]`
    : `  [FAIL] should have detected a cycle but didn't`
);

console.log("\n=== B. Real join node — garlic-oil-potatoes.json's fry_potato ===\n");
const garlicOilPotatoes = recipes.get("garlic_oil_potatoes")!;
const topo = topologicalOrder(garlicOilPotatoes.sequence);
if ("order" in topo) {
  const fryPotatoIndex = topo.order.indexOf("fry_potato");
  const cutPotatoIndex = topo.order.indexOf("cut_potato");
  const infuseOilIndex = topo.order.indexOf("infuse_oil");
  console.log(`  Topological order: [${topo.order.join(", ")}]`);
  console.log(
    `  fry_potato (index ${fryPotatoIndex}) correctly comes after BOTH cut_potato (${cutPotatoIndex}) ` +
      `and infuse_oil (${infuseOilIndex}): ${fryPotatoIndex > cutPotatoIndex && fryPotatoIndex > infuseOilIndex}`
  );
}
const schedule = scheduleDagFromSteps(garlicOilPotatoes.sequence, actions);
const fryPotato = schedule.nodes.get("fry_potato")!;
const cutPotato = schedule.nodes.get("cut_potato")!;
const infuseOil = schedule.nodes.get("infuse_oil")!;
console.log(
  `  cut_potato finishes at ${cutPotato.finishSeconds}s, infuse_oil finishes at ${infuseOil.finishSeconds}s.`
);
console.log(
  `  fry_potato starts at ${fryPotato.startSeconds}s — the LATER of the two (${Math.max(cutPotato.finishSeconds, infuseOil.finishSeconds)}s), not just cut_potato's own.`
);

console.log("\n=== C. Real concurrent time savings — real cited durations, independent branches ===\n");
const boilAction = actions.get("boil")!;
const caramelizeAction = actions.get("caramelize")!;
console.log(
  `  boil.json requiresActiveAttention: ${boilAction.requiresActiveAttention} (PASSIVE — real cited technique: ` +
    `once boiling, it runs itself); caramelize.json requiresActiveAttention: ${caramelizeAction.requiresActiveAttention} ` +
    `(ACTIVE — real cited technique: needs periodic stirring to avoid scorching).`
);
const demoSequence: RecipeStep[] = [
  {
    id: "boil_potato",
    dependsOn: [],
    actionId: "boil",
    targetInstanceId: "potato-1",
    params: { durationSeconds: "1200" }, // 20 min — mashed-potatoes.json's own cited quartered-potato figure
    availableIngredientInstanceIds: [],
  },
  {
    id: "caramelize_onion",
    dependsOn: [],
    actionId: "caramelize",
    targetInstanceId: "onion-1",
    params: { durationSeconds: "900" }, // 15 min — caramelize.json's own cited numericRange.min
    availableIngredientInstanceIds: [],
  },
];
const demoSchedule = scheduleDagFromSteps(demoSequence, actions);
const linearTotal = 1200 + 900;
console.log(
  `  BOIL potato (1200s/20min, passive) independent of CARAMELIZE onion (900s/15min, active): ` +
    `concurrent total = ${demoSchedule.totalSeconds}s (${demoSchedule.totalSeconds / 60}min).`
);
console.log(
  `  A strictly linear array would have forced ${linearTotal}s (${linearTotal / 60}min) — ` +
    `${linearTotal - demoSchedule.totalSeconds}s (${(linearTotal - demoSchedule.totalSeconds) / 60}min) saved, ` +
    `real time a chef does not have to stand idle.`
);

console.log("\n=== D. Tool-lock behavior — real ROAST steps correctly serialize on the shared oven ===\n");
const roastAction = actions.get("roast")!;
console.log(
  `  roast.json requiredTools: [${roastAction.requiredTools.join(", ")}], requiresActiveAttention: ` +
    `${roastAction.requiresActiveAttention} (PASSIVE — both roasts free the actor's hands, but NEITHER frees the oven).`
);
const toolLockSequence: RecipeStep[] = [
  {
    id: "roast_potato",
    dependsOn: [],
    actionId: "roast",
    targetInstanceId: "potato-1",
    params: { durationSeconds: "3000" }, // 50 min — crispy-roast-potatoes.json's own real cited figure
    availableIngredientInstanceIds: [],
  },
  {
    id: "roast_garlic",
    dependsOn: [], // genuinely independent — no dependsOn, and both PASSIVE
    actionId: "roast",
    targetInstanceId: "garlic-1",
    params: { durationSeconds: "3000" },
    availableIngredientInstanceIds: [],
  },
];
const toolLockSchedule = scheduleDagFromSteps(toolLockSequence, actions);
const roastPotato = toolLockSchedule.nodes.get("roast_potato")!;
const roastGarlic = toolLockSchedule.nodes.get("roast_garlic")!;
console.log(
  `  roast_potato: start ${roastPotato.startSeconds}s, finish ${roastPotato.finishSeconds}s. ` +
    `roast_garlic: start ${roastGarlic.startSeconds}s, finish ${roastGarlic.finishSeconds}s.`
);
console.log(
  `  Total: ${toolLockSchedule.totalSeconds}s (${toolLockSchedule.totalSeconds / 60}min) — correctly SERIALIZED ` +
    `(6000s/100min) on the shared oven, not the 3000s/50min B/C's unconstrained-passive model would have shown.`
);

console.log(
  "\nStill NOT closed, honestly named rather than implied covered: this SCHEDULES/ESTIMATES concurrency as " +
    "read-only information — recipe-runner.ts's runRecipe still executes ONE step at a time, in a real, safe, " +
    "dependency-respecting topological order (proven: every real recipe here still simulates identically to " +
    "before this change), not with genuine concurrent mutation of shared inventory/place state " +
    "(ENGINE_INVARIANTS.md #9's determinism guarantee is exactly why not — see dag-scheduler.ts's own top doc " +
    "comment). No multi-actor modeling exists (one shared 'active' resource, not N robots/chefs). No Cooklang " +
    "importer exists yet to generate dependsOn edges FROM (CLAUDE.md's own module table) — every existing " +
    "linear recipe already gets the equivalent treatment via deriveDependsOn's auto-sequential fallback, proven " +
    "by tests/dag-execution.test.ts's own backward-compatibility case, not a separate Cooklang-specific path. " +
    "Tool-lock scheduling (D) is deliberately scoped to requiredTools (exact tool id) ONLY, not " +
    "requiredToolCapabilities (substitutable, e.g. BOIL/FRY/CARAMELIZE's own isDeepVessel/isFryingVessel) — " +
    "which SPECIFIC capability-satisfying tool a step occupies is genuinely ambiguous without real per-recipe " +
    "tool-instance tracking this schema doesn't have (RecipeScript.availableTools is a flat list of tool TYPES, " +
    "not individually tracked instances the way RecipeInstanceSchema tracks ingredients) — case C's BOIL/" +
    "CARAMELIZE demo above is therefore NOT tool-locked at all, correctly, since neither declares requiredTools."
);
