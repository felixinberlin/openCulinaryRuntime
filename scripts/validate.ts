import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { RecipeScriptSchema, type RecipeScript } from "../src/recipe.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import { HeatSourceProfileSchema, type HeatSourceProfile } from "../src/heat-source.ts";
import { runRecipe } from "../src/recipe-runner.ts";

const root = join(import.meta.dirname, "..");

function loadDir<T extends { id: string }>(
  dir: string,
  label: string,
  schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } }
) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = new Map<string, T>();
  let failed = 0;
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const result = schema.safeParse(raw);
    if (result.success) {
      console.log(`OK   ${label}/${file}  (id: ${result.data.id})`);
      items.set(result.data.id, result.data);
    } else {
      failed++;
      console.error(`FAIL ${label}/${file}`);
      for (const issue of result.error.issues) {
        console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
      }
    }
  }
  return { items, failed, total: files.length };
}

const entities = loadDir<Entity>(join(root, "data", "entities"), "entities", EntitySchema);
const actions = loadDir<Action>(join(root, "data", "actions"), "actions", ActionSchema);
const recipes = loadDir<RecipeScript>(join(root, "data", "recipes"), "recipes", RecipeScriptSchema);
const ccps = loadDir<CriticalControlPoint>(join(root, "data", "ccps"), "ccps", CriticalControlPointSchema);
const heatSources = loadDir<HeatSourceProfile>(join(root, "data", "heat-sources"), "heat-sources", HeatSourceProfileSchema);

let crossFailed = 0;
function fail(msg: string) {
  crossFailed++;
  console.error(`FAIL ${msg}`);
}

for (const entity of entities.items.values()) {
  for (const byproductId of entity.producedByproducts) {
    if (!entities.items.has(byproductId)) {
      fail(`entities/${entity.id}.json: producedByproducts references unknown entity "${byproductId}"`);
    }
  }
  for (const actionId of entity.allowedTransformations) {
    const action = actions.items.get(actionId);
    if (!action) {
      fail(`entities/${entity.id}.json: allowedTransformations references unknown action "${actionId}"`);
      continue;
    }
    // outputs.addsTag is applied by engine.ts unconditionally (never
    // checked against the target's own possibleTags — only byproduct/
    // combinesInto tag INHERITANCE is filtered that way, see engine.ts's
    // doc comment) — so this can't be a hard fail without risking a false
    // positive against that real asymmetry. Still worth a NOTE: an entity
    // that allows an addsTag-shaped action but never lists the resulting
    // tag in its own possibleTags is very likely an oversight, the same
    // shape of gap salt/pepper/chili's possibleTags wiring was checked for
    // by hand 2026-08-13 — this makes that check permanent instead of
    // relying on remembering to do it again next time a seasoning verb
    // (or any other addsTag action) is added to a new entity.
    if (action.outputs.addsTag && !entity.possibleTags.includes(action.outputs.addsTag)) {
      console.log(
        `NOTE entities/${entity.id}.json: allows "${actionId}" (which adds tag "${action.outputs.addsTag}") but doesn't list "${action.outputs.addsTag}" in possibleTags.`
      );
    }
  }
  for (const [actionId, byproductIds] of Object.entries(entity.byproductsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(`entities/${entity.id}.json: byproductsByAction references unknown action "${actionId}"`);
    }
    for (const byproductId of byproductIds) {
      if (!entities.items.has(byproductId)) {
        fail(`entities/${entity.id}.json: byproductsByAction["${actionId}"] references unknown entity "${byproductId}"`);
      }
    }
  }
  for (const [actionId, ccpId] of Object.entries(entity.criticalControlPointsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(`entities/${entity.id}.json: criticalControlPointsByAction references unknown action "${actionId}"`);
    }
    if (!ccps.items.has(ccpId)) {
      fail(`entities/${entity.id}.json: criticalControlPointsByAction["${actionId}"] references unknown CCP "${ccpId}"`);
    }
  }
  // Soft prompts, not failures — both found real gaps by being asked
  // explicitly (tortilla_mixture.json had a cooking capability and zero CCP
  // wiring until asked about tortilla de Betanzos; several entities had
  // composition/thermophysical numbers with no citation until asked to be
  // "ready to publish"). A NOTE here doesn't mean something is wrong — e.g.
  // potato/garlic correctly have no CCP — it means a human should confirm
  // that's deliberate, not silently unaudited.
  const cookingCapabilities = ["isFryable", "isBoilable", "isPoachable", "isScramblable"] as const;
  const hasCookingCapability = cookingCapabilities.some((c) => entity.capabilities[c]);
  if (hasCookingCapability && Object.keys(entity.criticalControlPointsByAction).length === 0) {
    console.log(`NOTE entities/${entity.id}.json: has a cooking capability but no criticalControlPointsByAction — confirm this is deliberate (no pathogen risk), not unaudited.`);
  }
  if (entity.composition?.nutrientsPer100g && !entity.composition.citation) {
    console.log(`NOTE entities/${entity.id}.json: composition.nutrientsPer100g has no citation.`);
  }
  if (entity.thermophysical && Object.keys(entity.thermophysical).some((k) => k !== "citation") && !entity.thermophysical.citation) {
    console.log(`NOTE entities/${entity.id}.json: thermophysical has no citation.`);
  }
}

for (const action of actions.items.values()) {
  for (const toolId of action.requiredTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`actions/${action.id}.json: requiredTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`actions/${action.id}.json: requiredTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
  // Same dead-capability shape the last session's verb audit went looking
  // for by hand (LEARNINGS.md, "audit for dead capabilities") — a
  // requiredToolCapabilities entry that no loaded tool entity ever asserts
  // true would make this action permanently unexecutable no matter what a
  // caller has on hand, the tool-side mirror of requiredTools referencing
  // an unknown id, so it's a hard fail, not a NOTE.
  for (const capability of action.requiredToolCapabilities) {
    const satisfied = [...entities.items.values()].some(
      (e) => e.kind === "tool" && e.capabilities[capability] === true
    );
    if (!satisfied) {
      fail(`actions/${action.id}.json: requiredToolCapabilities references "${capability}", which no tool entity asserts true — this action can never be executed`);
    }
  }
  if (action.outputs.combinesInto && !entities.items.has(action.outputs.combinesInto)) {
    fail(`actions/${action.id}.json: outputs.combinesInto references unknown entity "${action.outputs.combinesInto}"`);
  }
  if (!action.verification) {
    console.log(`NOTE actions/${action.id}.json: no verification criterion — how would a machine confirm this action's effect happened?`);
  }
  if (action.retrySafe === undefined) {
    console.log(`NOTE actions/${action.id}.json: retrySafe not audited — is blindly re-running this after an interruption safe?`);
  }
}

for (const recipe of recipes.items.values()) {
  const knownInstanceIds = new Set(recipe.initialInventory.map((i) => i.id));
  const knownEntityIds = new Set(recipe.initialInventory.map((i) => i.entityId));
  for (const item of recipe.initialInventory) {
    if (!entities.items.has(item.entityId)) {
      fail(`recipes/${recipe.id}.json: initialInventory references unknown entity "${item.entityId}"`);
    }
    // A "relative" quantity (e.g. baker's-percentage salt) is meaningless
    // without the entity it's a ratio OF actually being present in the
    // same recipe — unlike targetInstanceId/secondaryInstanceId below,
    // this checks against entityId (a recipe-wide ingredient), not a
    // specific instance id, so it can be a hard fail rather than a NOTE:
    // there's no "assumed to be spawned later" escape hatch for an entity
    // that was never in this recipe at all.
    if (item.quantity?.kind === "relative" && !knownEntityIds.has(item.quantity.ofEntityId)) {
      fail(
        `recipes/${recipe.id}.json: initialInventory["${item.id}"].quantity.ofEntityId references entity "${item.quantity.ofEntityId}", which isn't used anywhere in this recipe's initialInventory`
      );
    }
  }
  for (const toolId of recipe.availableTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`recipes/${recipe.id}.json: availableTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(`recipes/${recipe.id}.json: availableTools references "${toolId}" which is kind "${tool.kind}", not "tool"`);
    }
  }
  for (const [i, step] of recipe.sequence.entries()) {
    if (!actions.items.has(step.actionId)) {
      fail(`recipes/${recipe.id}.json: sequence[${i}] references unknown action "${step.actionId}"`);
    }
    // A step referencing an id not in initialInventory isn't necessarily
    // wrong here — it might be an instance a prior step spawns at runtime
    // (e.g. potato_peel-1), which this static, per-field pass has no way to
    // predict (runner.ts's spawnCounter only exists once the recipe
    // actually runs). Left unflagged at this stage on purpose — the
    // simulation pass below is what actually resolves it, one way or the
    // other, instead of leaving "assumed to be spawned, not checked
    // further" as the final word.
  }
}

// Actual simulation, not just static reference-checking — closes exactly
// the gap the comment above (and this whole loop, before this addition)
// used to name and stop at: only running every recipe for real can confirm
// a targetInstanceId/secondaryInstanceId/availableIngredientInstanceIds
// reference that looked unresolved statically was in fact a legitimately
// spawned instance, versus a genuine typo that only recipe-runner.ts's own
// unknown-id checks (src/recipe-runner.ts, 2026-08-14 fix) can catch. A
// recipe that errors at runtime is a real correctness bug, not a NOTE-level
// concern — same severity as the schema/cross-reference checks above.
if (entities.failed === 0 && actions.failed === 0 && ccps.failed === 0) {
  for (const recipe of recipes.items.values()) {
    const result = runRecipe(recipe, entities.items, actions.items, ccps.items);
    if (result.errors.length > 0) {
      for (const { step, message } of result.errors) {
        fail(`recipes/${recipe.id}.json: sequence step "${step.actionId}" on "${step.targetInstanceId}" failed to run: ${message}`);
      }
    } else {
      console.log(`OK   recipes/${recipe.id}.json simulated end-to-end, zero step errors (${recipe.sequence.length} steps)`);
    }
  }
}

const failed = entities.failed + actions.failed + recipes.failed + ccps.failed + heatSources.failed + crossFailed;
const total = entities.total + actions.total + recipes.total + ccps.total + heatSources.total;
if (failed > 0) {
  console.error(`\n${failed} problem(s) found.`);
  process.exit(1);
}
console.log(
  `\nAll ${total} files valid (${entities.total} entities, ${actions.total} actions, ${recipes.total} recipes, ${ccps.total} ccps, ${heatSources.total} heat-sources); cross-references OK.`
);
