import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { RecipeScriptSchema } from "../src/recipe.ts";
import { runRecipe } from "../src/recipe-runner.ts";
import {
  createPlayer,
  stepForward,
  stepBackward,
  currentNarration,
  canApplyNext,
  createVariation,
  type RecipePlayerState,
} from "../src/recipe-player.ts";

/**
 * Capability test for `recipe-player.ts` — engine only, no UI, per the
 * explicit scoping. Proves the three things asked for over a real
 * recipe: step-through playback, revert-is-just-recomputation (checked
 * by comparing against the original forward pass, not just "doesn't
 * crash"), and branching into a variation that actually runs.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const recipe = RecipeScriptSchema.parse(JSON.parse(readFileSync(join(root, "data", "recipes", "salted-fried-potatoes.json"), "utf8")));

console.log(`=== Stepping forward through "${recipe.names.en}" (${recipe.sequence.length} steps) ===\n`);
let player = createPlayer(recipe);
const finalInventoryByIndex: string[] = [];
for (let i = 0; i < recipe.sequence.length; i++) {
  player = stepForward(player, entities, actions, ccps);
  const n = currentNarration(player, entities, actions, ccps)!;
  const step = recipe.sequence[player.currentIndex];
  const inventorySummary = n.finalInventory.map((f) => `${f.instanceId}:${f.state}`).join(", ");
  console.log(`  step ${player.currentIndex} (${step.actionId} on ${step.targetInstanceId}): ${inventorySummary}`);
  finalInventoryByIndex.push(JSON.stringify(n.finalInventory));
}

console.log("\n=== Revert to step 1, then step forward again — must match the ORIGINAL forward pass exactly ===\n");
function jumpBack(p: RecipePlayerState, index: number): RecipePlayerState {
  let cur = p;
  while (cur.currentIndex > index) cur = stepBackward(cur);
  return cur;
}
player = jumpBack(player, 1);
console.log(`  reverted to step ${player.currentIndex}`);
player = stepForward(player, entities, actions, ccps);
const rewalked = currentNarration(player, entities, actions, ccps)!;
const matches = JSON.stringify(rewalked.finalInventory) === finalInventoryByIndex[player.currentIndex];
console.log(`  re-stepped to ${player.currentIndex}: matches original forward pass? ${matches ? "YES" : "NO — BUG"}`);

console.log("\n=== canApplyNext — a real true case and a real false case ===\n");
let midPlayer = createPlayer(recipe);
midPlayer = stepForward(midPlayer, entities, actions, ccps); // wash (sequence[0])
const trueCase = canApplyNext(midPlayer, entities, actions, ccps);
console.log(`  after step 0 (wash), can we apply step 1 (peel)? ${JSON.stringify(trueCase)}`);

// Note: FRY has no statePrerequisites entry for potato at all (see
// potato.json's parFryNote) — a raw, unpeeled, uncut potato is not
// actually infeasible to fry per this engine's own rules, so that
// isn't usable as the "false case" here. The real, engine-enforced
// failure mode is missing a frying medium: FRY's
// requiredIngredientCapabilities: ["isFryingMedium"] has nothing to
// check against when no oil instance is offered.
const brokenVariation = createVariation(recipe, 0, [
  { actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: [] },
]);
let brokenPlayer = createPlayer(brokenVariation);
brokenPlayer = stepForward(brokenPlayer, entities, actions, ccps); // wash (sequence[0])
const falseCase = canApplyNext(brokenPlayer, entities, actions, ccps);
console.log(`  variation (wash -> fry directly, skipping peel/cut, with NO oil offered): can we fry with no frying medium on hand? ${JSON.stringify(falseCase)}`);

console.log("\n=== A real variation, run end to end ===\n");
const skipSaltVariation = createVariation(recipe, 2, [
  { actionId: "fry", targetInstanceId: "potato-1", params: {}, availableIngredientInstanceIds: ["oil-1"] },
]);
console.log(`  variation id: "${skipSaltVariation.id}", sequence length: ${skipSaltVariation.sequence.length} (original: ${recipe.sequence.length})`);
const variationResult = runRecipe(skipSaltVariation, entities, actions, ccps);
console.log(`  variation runs cleanly: ${variationResult.errors.length === 0 ? "YES" : "NO — " + JSON.stringify(variationResult.errors)}`);
