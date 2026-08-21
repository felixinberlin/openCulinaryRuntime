import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { runRecipe, runRecipeFromIntent } from "../src/recipe-runner.ts";
import { planIntent, planLowestCost, stepsToRecipeSteps, defaultEdgeCost } from "../src/planner.ts";
import { isGoalReachable } from "../src/reachability.ts";
import type { RecipeIntent } from "../src/recipe.ts";

/**
 * First end-to-end proof for `src/planner.ts` — closes the five gaps
 * named in `ROADMAP.md`'s "actual planner" entry: path -> RecipeScript
 * conversion, `RecipeIntentSchema`, cost-aware search, bounded
 * multi-instance/COMBINE planning, and (via `recipe-runner.ts`'s new
 * `runRecipeFromIntent`) closed-loop replanning.
 *
 * The flagship proof: a `RecipeIntent` for `tortilla_de_patatas` — no
 * `RecipeScript` steps hand-authored at all, only a starting inventory
 * and a goal — planned end to end (fry the potato, prep the egg via a
 * predicted CRACK spawn, combine, fry the result) and then ACTUALLY RUN
 * against the real `recipe-runner.ts`, matching this repo's own standing
 * discipline (`is-goal-still-reachable.ts`, `boil-egg-as-a-robot.ts`, ...)
 * that a plan is proven by running it, not by trusting the search result.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

console.log("=== 1. Path -> RecipeScript conversion, over a real single-instance goal ===\n");
const potato = entities.get("potato")!;
const singleResult = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: [],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
if (singleResult.reachable) {
  const steps = stepsToRecipeSteps(singleResult.path, {
    targetInstanceId: "potato-1",
    entities,
    actions,
    availableIngredientInstances: [{ id: "oil-1", entityId: "oil" }],
  });
  console.log(`  path: ${singleResult.path.map((s) => s.actionId).join(" -> ")}`);
  console.log(`  RecipeSteps: ${JSON.stringify(steps)}`);
}

console.log(
  "\n=== 2. RecipeIntentSchema + planIntent — a single-instance intent, no hand-authored steps ===\n"
);
const singleIntent: RecipeIntent = {
  id: "planned-fried-potato",
  names: { en: "Planned fried potato" },
  initialInventory: [
    { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
    { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
  ],
  availableTools: ["knife", "pan"],
  goals: [{ instanceId: "potato-1", state: "fried", requiredTags: [] }],
  metadata: {},
};
const singlePlan = planIntent(singleIntent, entities, actions);
if (singlePlan.success) {
  console.log(`  sequence: ${singlePlan.recipe.sequence.map((s) => s.actionId).join(" -> ")}`);
  const runResult = runRecipe(singlePlan.recipe, entities, actions, ccps);
  console.log(
    `  run against the REAL recipe-runner.ts: ${runResult.errors.length} error(s), final potato-1 state = "${runResult.finalInventory.get("potato-1")?.state}"`
  );
} else {
  console.log(`  FAILED: ${JSON.stringify(singlePlan.failures)}`);
}

console.log(
  "\n=== 3. Cost-aware search — prefers fewer/less-severe hazards among equal-length paths ===\n"
);
const shortest = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: [],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
const cheapest = planLowestCost({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: [],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
console.log(
  `  plain BFS (fewest steps): ${shortest.reachable ? shortest.path.map((s) => s.actionId).join(" -> ") : "unreachable"}`
);
if (cheapest.reachable) {
  console.log(
    `  cost-aware:               ${cheapest.path.map((s) => s.actionId).join(" -> ")} (totalCost = ${cheapest.totalCost.toFixed(2)})`
  );
  const fryAction = actions.get("fry")!;
  console.log(
    `  FRY's own defaultEdgeCost: ${defaultEdgeCost(fryAction).toFixed(2)} (1 + hazard penalty)`
  );
}
console.log(
  '  Same path here (FRY is on the only real route to "fried") — the real proof is that both searches ' +
    "agree when there's only one route, and that cost-aware search still terminates/returns correctly, not " +
    "that this specific case diverges (see tests/planner.test.ts for a synthetic fixture where two equal-" +
    "length paths genuinely differ in hazard cost, and cost-aware search picks the safer one)."
);

console.log(
  "\n=== 4. Bounded multi-instance planning — the FULL tortilla_de_patatas dish, zero hand-authored steps ===\n"
);
const tortillaIntent: RecipeIntent = {
  id: "planned-tortilla-de-patatas",
  names: { en: "Planned tortilla de patatas" },
  initialInventory: [
    { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
    { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
    { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
    { id: "salt-1", entityId: "salt", state: "dry", tags: [] },
  ],
  availableTools: ["knife", "pan", "bowl"],
  goals: [
    { instanceId: "potato-1", state: "fried", requiredTags: [] },
    {
      instanceId: "potato-1",
      requiredTags: [], // ignored when combine is set — required only to satisfy InstanceGoalSchema's own refine
      combine: {
        actionId: "combine",
        secondaryInstanceId: "egg-1",
        secondaryDesiredState: "beaten",
        secondaryDesiredTags: [],
      },
    },
    { instanceId: "$combineResult:1", state: "fried", requiredTags: [] },
  ],
  metadata: {},
};
const tortillaPlan = planIntent(tortillaIntent, entities, actions);
if (tortillaPlan.success) {
  console.log(
    `  planned sequence:\n    ${tortillaPlan.recipe.sequence
      .map(
        (s) =>
          `${s.actionId}(${s.targetInstanceId}${s.secondaryInstanceId ? " + " + s.secondaryInstanceId : ""})`
      )
      .join("\n    ")}`
  );
  const runResult = runRecipe(tortillaPlan.recipe, entities, actions, ccps);
  console.log(`\n  run against the REAL recipe-runner.ts: ${runResult.errors.length} error(s)`);
  if (runResult.errors.length > 0) {
    for (const e of runResult.errors) console.log(`    ${e.step.actionId}: ${e.message}`);
  } else {
    for (const [id, inst] of runResult.finalInventory) {
      console.log(`    ${id}: entity=${inst.entityId} state="${inst.state}" tags=[${inst.tags}]`);
    }
  }
} else {
  console.log(`  FAILED: ${JSON.stringify(tortillaPlan.failures)}`);
}

console.log(
  "\n=== 5. Closed-loop replanning against REAL data — the honest 'no alternative' case ===\n"
);
console.log(
  '  Real data has no knife-free cutting technique — CUT always requires "knife", no substitute action ' +
    "exists anywhere in this vocabulary (confirmed directly, not assumed). Planned assuming a knife is on " +
    "hand; executed with only a pan — a genuine, honest STUCK case, proving replanning correctly reports a " +
    "real final failure rather than a false success:\n"
);
const dicedIntent: RecipeIntent = {
  id: "planned-diced-potato",
  names: { en: "Planned diced potato" },
  initialInventory: [{ id: "potato-1", entityId: "potato", state: "raw", tags: [] }],
  availableTools: ["knife", "pan"], // assumed at PLAN time
  goals: [{ instanceId: "potato-1", state: "diced", requiredTags: [] }],
  metadata: {},
};
const dicedOutcome = runRecipeFromIntent(
  dicedIntent,
  entities,
  actions,
  ccps,
  undefined,
  new Set(["pan"]) // ACTUALLY only a pan on hand — no knife
);
if (dicedOutcome.planned) {
  console.log(
    `  planned sequence (assuming a knife): ${dicedOutcome.result.log[0] ?? "(none logged yet)"}`
  );
  console.log(`  errors: ${dicedOutcome.result.errors.length}`);
  console.log(`  replans: ${JSON.stringify(dicedOutcome.result.replans)}`);
  for (const e of dicedOutcome.result.errors) console.log(`    ${e.step.actionId}: ${e.message}`);
} else {
  console.log(`  planning itself failed: ${JSON.stringify(dicedOutcome.failures)}`);
}

console.log(
  "\n=== 6. Two real bugs a peer session found in planCombine/planSecondaryRole, both fixed here ===\n"
);
console.log(
  "  Bug 1: the primary/secondary path's own stepsToRecipeSteps call used to fabricate ingredient " +
    'INSTANCES from the availableIngredients ENTITY-id Set ({id: entityId, entityId}) instead of the ' +
    "real instance pool planIntent already tracks — any requiredIngredientCapabilities step inside a " +
    "combine goal (e.g. FRY needing oil) produced a RecipeStep referencing a nonexistent instance id " +
    '("oil" instead of "oil-1"). Repro: a combine goal with NO prior explicit fry goal, so planCombine ' +
    "itself has to plan the primary's FRY step:\n"
);
const bug1Intent: RecipeIntent = {
  id: "bug1-repro",
  names: { en: "Bug 1 repro — FRY inside planCombine's own primary path" },
  initialInventory: [
    { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
    { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
    { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
  ],
  availableTools: ["knife", "pan", "bowl"],
  goals: [
    {
      instanceId: "potato-1",
      requiredTags: [],
      combine: {
        actionId: "combine",
        secondaryInstanceId: "egg-1",
        secondaryDesiredState: "beaten",
        secondaryDesiredTags: [],
      },
    },
  ],
  metadata: {},
};
const bug1Plan = planIntent(bug1Intent, entities, actions);
if (bug1Plan.success) {
  const fryStep = bug1Plan.recipe.sequence.find((s) => s.actionId === "fry")!;
  console.log(`  FRY step's availableIngredientInstanceIds: ${JSON.stringify(fryStep.availableIngredientInstanceIds)}`);
  const bug1Run = runRecipe(bug1Plan.recipe, entities, actions, ccps);
  console.log(`  run against the REAL recipe-runner.ts: ${bug1Run.errors.length} error(s)`);
  for (const e of bug1Run.errors) console.log(`    ${e.step.actionId}: ${e.message}`);
} else {
  console.log(`  FAILED: ${JSON.stringify(bug1Plan.failures)}`);
}

console.log(
  '\n  Bug 2: planSecondaryRole only checked the secondary role\'s own real statePrerequisites (the ' +
    'SAME "secondary" check engine.ts\'s checkStatePrerequisite performs at execution time, e.g. ' +
    'egg_cracked.json\'s combine: ["beaten", "well_beaten"]) when a caller explicitly supplied ' +
    "secondaryDesiredState — omitting it produced a success:true plan missing the required BEAT step, " +
    'which then failed at the last step against the real engine. Repro: the exact same combine goal, ' +
    "secondaryDesiredState OMITTED this time:\n"
);
const bug2Intent: RecipeIntent = {
  id: "bug2-repro",
  names: { en: "Bug 2 repro — secondaryDesiredState omitted" },
  initialInventory: [
    { id: "potato-1", entityId: "potato", state: "raw", tags: [] },
    { id: "egg-1", entityId: "egg", state: "raw", tags: [] },
    { id: "oil-1", entityId: "oil", state: "cold", tags: [] },
  ],
  availableTools: ["knife", "pan", "bowl"],
  goals: [
    { instanceId: "potato-1", state: "fried", requiredTags: [] },
    {
      instanceId: "potato-1",
      requiredTags: [],
      combine: {
        actionId: "combine",
        secondaryInstanceId: "egg-1",
        secondaryDesiredTags: [],
        // secondaryDesiredState deliberately omitted — the exact Bug 2 shape.
      },
    },
  ],
  metadata: {},
};
const bug2Plan = planIntent(bug2Intent, entities, actions);
if (bug2Plan.success) {
  console.log(
    `  planned sequence (note BEAT is now included, unasked-for): ${bug2Plan.recipe.sequence.map((s) => s.actionId).join(" -> ")}`
  );
  const bug2Run = runRecipe(bug2Plan.recipe, entities, actions, ccps);
  console.log(`  run against the REAL recipe-runner.ts: ${bug2Run.errors.length} error(s)`);
  for (const e of bug2Run.errors) console.log(`    ${e.step.actionId}: ${e.message}`);
} else {
  console.log(`  FAILED: ${JSON.stringify(bug2Plan.failures)}`);
}

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: goals are resolved IN ARRAY ORDER " +
    "only, no backtracking/reordering across goals; planCombine takes an already-chosen combineActionId, it " +
    "does not resolve which COMBINE-shaped action to use from a target entity id alone (potato_onion_mixture." +
    "json's own capabilityAmbiguityNote names why guessing that would be unsound); planSecondaryRole is a " +
    "bounded ONE-HOP spawn search, not a general entity-graph planner; cost-aware search is a real, simple, " +
    "UNTUNED heuristic (step count + hazard severity), not a validated cost model; engine.ts/applyAction and " +
    "reachability.ts/isGoalReachable are both completely unchanged."
);
