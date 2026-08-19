import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { RecipeScriptSchema, type RecipeScript } from "../src/recipe.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import { HeatSourceProfileSchema, type HeatSourceProfile } from "../src/heat-source.ts";
import {
  MealPatternContributionFileSchema,
  type MealPatternContributionFile,
} from "../src/nutrition-extension.ts";
import {
  FoodOnCrosswalkFileSchema,
  type FoodOnCrosswalkFile,
  foodOnIriFromCurie,
} from "../src/foodon-crosswalk.ts";
import { runRecipe } from "../src/recipe-runner.ts";

const root = join(import.meta.dirname, "..");

function loadDir<T extends { id: string }>(
  dir: string,
  label: string,
  schema: {
    safeParse: (
      v: unknown
    ) =>
      | { success: true; data: T }
      | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
  }
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
const ccps = loadDir<CriticalControlPoint>(
  join(root, "data", "ccps"),
  "ccps",
  CriticalControlPointSchema
);
const heatSources = loadDir<HeatSourceProfile>(
  join(root, "data", "heat-sources"),
  "heat-sources",
  HeatSourceProfileSchema
);
const mealPatternContributions = loadDir<MealPatternContributionFile>(
  join(root, "data", "meal-pattern-contributions"),
  "meal-pattern-contributions",
  MealPatternContributionFileSchema
);
const foodOnCrosswalk = loadDir<FoodOnCrosswalkFile>(
  join(root, "data", "foodon-crosswalk"),
  "foodon-crosswalk",
  FoodOnCrosswalkFileSchema
);

let crossFailed = 0;
function fail(msg: string) {
  crossFailed++;
  console.error(`FAIL ${msg}`);
}

/** Shared by every one-file-per-entity, `id`-IS-the-entity-id collection
 *  (`meal-pattern-contributions`, `foodon-crosswalk`) — a reference to an
 *  unknown entity is always an authoring bug, same hard-fail standard as
 *  every other cross-reference check in this file. `ccps`/`heat-sources`
 *  don't use this: their own `id` is a separately-invented id entities
 *  reference BY id from a different field, not this same relationship. */
function checkEntityIdReference(label: string, id: string): void {
  if (!entities.items.has(id)) {
    fail(`${label}/${id}.json: id references unknown entity "${id}"`);
  }
}

// typicalYieldFractionOfParent (ingredient.ts, "yield/waste factors" —
// ROADMAP.md) cross-check, shared by both the flat producedByproducts
// fallback and each byproductsByAction override below — same "hard fail on
// a wrong reference, soft NOTE on an implausible sum" split every other
// cross-reference check in this file already uses. A byproduct entity
// without typicalYieldFractionOfParent at all is not itself an error (many
// don't have a citable figure yet) — this only checks the ones that DO
// claim one.
//
// The ~100%-of-parent-mass expectation is checked ONLY for a
// `destroysTarget` action (`SEPARATE`/`CRACK` — the byproducts ARE the
// entire former parent, nothing else is kept). A non-destroying action
// (`PEEL`) transforms the parent in place and keeps the rest of its mass
// AS the same (now-trimmed) instance, not as a separate byproduct entity —
// its byproduct's fraction is legitimately small (e.g. potato_peel's
// ~10-25%), and checking THAT against ~100% would be a real category
// error (`isDestroyingAction` undefined/false skips the sum check
// entirely, not a lenient bound).
function checkYieldFractions(
  parent: Entity,
  byproductIds: string[],
  label: string,
  isDestroyingAction: boolean
): void {
  let sum = 0;
  let allHaveFraction = byproductIds.length > 0;
  for (const byproductId of byproductIds) {
    const byproduct = entities.items.get(byproductId);
    const yieldFraction = byproduct?.typicalYieldFractionOfParent;
    if (!yieldFraction) {
      allHaveFraction = false;
      continue;
    }
    if (yieldFraction.ofParentEntityId !== parent.id) {
      fail(
        `entities/${byproductId}.json: typicalYieldFractionOfParent.ofParentEntityId is "${yieldFraction.ofParentEntityId}", ` +
          `but it's spawned as a byproduct of "${parent.id}" (entities/${parent.id}.json's ${label})`
      );
    }
    sum += (yieldFraction.min + yieldFraction.max) / 2;
  }
  if (isDestroyingAction && allHaveFraction && (sum < 0.85 || sum > 1.15)) {
    console.log(
      `NOTE entities/${parent.id}.json: ${label}'s byproducts' typicalYieldFractionOfParent values sum to ` +
        `~${(sum * 100).toFixed(0)}% of parent mass (expected roughly 100% — this action destroys the target, ` +
        `so its byproducts should account for the WHOLE former mass) — confirm this is deliberate.`
    );
  }
}

for (const entity of entities.items.values()) {
  for (const byproductId of entity.producedByproducts) {
    if (!entities.items.has(byproductId)) {
      fail(
        `entities/${entity.id}.json: producedByproducts references unknown entity "${byproductId}"`
      );
    }
  }
  const nonOverriddenSpawningActions = entity.allowedTransformations
    .map((id) => actions.items.get(id))
    .filter(
      (a): a is Action =>
        !!a && a.outputs.spawnsTargetByproducts && !(a.id in entity.byproductsByAction)
    );
  checkYieldFractions(
    entity,
    entity.producedByproducts,
    "producedByproducts",
    nonOverriddenSpawningActions.some((a) => a.outputs.destroysTarget)
  );
  for (const actionId of entity.allowedTransformations) {
    const action = actions.items.get(actionId);
    if (!action) {
      fail(
        `entities/${entity.id}.json: allowedTransformations references unknown action "${actionId}"`
      );
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
  // invalidTransitions (ingredient.ts, closed 2026-08-15 — ROADMAP.md Phase
  // 4's INVALID_TRANSITIONS) references bare state ids on both sides, not
  // an action/entity id — unlike addsTag above, there's no legitimate
  // asymmetry that would make a reference to a state this entity never
  // lists a false positive, so this is a hard fail, the same standard
  // producedByproducts/byproductsByAction below hold themselves to.
  for (const [fromState, forbidden] of Object.entries(entity.invalidTransitions)) {
    if (!entity.possibleStates.includes(fromState)) {
      fail(
        `entities/${entity.id}.json: invalidTransitions references unknown state "${fromState}" (not in possibleStates) as a key`
      );
    }
    for (const toState of forbidden) {
      if (!entity.possibleStates.includes(toState)) {
        fail(
          `entities/${entity.id}.json: invalidTransitions["${fromState}"] references unknown state "${toState}" (not in possibleStates)`
        );
      }
    }
  }
  // rawContaminationRiskStates (ingredient.ts, src/tool-hygiene.ts, closed
  // 2026-08-16 — ROADMAP.md's "Cross-contamination / hygiene knowledge"
  // gap) — same hard-fail standard invalidTransitions above already holds
  // itself to: a state listed here that isn't in this entity's own
  // possibleStates is always an authoring bug, not a legitimate edge case.
  for (const state of entity.rawContaminationRiskStates) {
    if (!entity.possibleStates.includes(state)) {
      fail(
        `entities/${entity.id}.json: rawContaminationRiskStates references unknown state "${state}" (not in possibleStates)`
      );
    }
  }
  if (
    entity.capabilities.isRawContaminationRisk === true &&
    entity.rawContaminationRiskStates.length === 0
  ) {
    console.log(
      `NOTE entities/${entity.id}.json: capabilities.isRawContaminationRisk is true but rawContaminationRiskStates is empty — this capability can never actually trigger a warning.`
    );
  }
  // storageLifeByState (ingredient.ts, closed 2026-08-17 — ROADMAP.md's
  // "Storage/shelf-life common knowledge" gap) — same hard-fail standard as
  // invalidTransitions/rawContaminationRiskStates above: a key not in this
  // entity's own possibleStates is always an authoring bug (a typo, or
  // storage guidance authored against a state this entity doesn't actually
  // have), not a legitimate edge case.
  for (const state of Object.keys(entity.storageLifeByState)) {
    if (!entity.possibleStates.includes(state)) {
      fail(
        `entities/${entity.id}.json: storageLifeByState references unknown state "${state}" (not in possibleStates)`
      );
    }
  }
  for (const [actionId, byproductIds] of Object.entries(entity.byproductsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(
        `entities/${entity.id}.json: byproductsByAction references unknown action "${actionId}"`
      );
    }
    for (const byproductId of byproductIds) {
      if (!entities.items.has(byproductId)) {
        fail(
          `entities/${entity.id}.json: byproductsByAction["${actionId}"] references unknown entity "${byproductId}"`
        );
      }
    }
    checkYieldFractions(
      entity,
      byproductIds,
      `byproductsByAction["${actionId}"]`,
      actions.items.get(actionId)?.outputs.destroysTarget === true
    );
  }
  for (const [actionId, ccpId] of Object.entries(entity.criticalControlPointsByAction)) {
    if (!actions.items.has(actionId)) {
      fail(
        `entities/${entity.id}.json: criticalControlPointsByAction references unknown action "${actionId}"`
      );
    }
    if (!ccps.items.has(ccpId)) {
      fail(
        `entities/${entity.id}.json: criticalControlPointsByAction["${actionId}"] references unknown CCP "${ccpId}"`
      );
    }
  }
  // structure.components (ingredient.ts's StructureSchema) was never
  // actually cross-referenced against real entity ids until this check,
  // added 2026-08-16 alongside the allergen-superset check right below it
  // (which needs to look each component up to be meaningful at all — a
  // bogus component id silently skipped would defeat the point of that
  // check). A genuinely separate, pre-existing gap, closed here because it
  // was found in passing, not because it was the point of this change.
  if (entity.structure.composite) {
    for (const componentId of entity.structure.components) {
      if (!entities.items.has(componentId)) {
        fail(
          `entities/${entity.id}.json: structure.components references unknown entity "${componentId}"`
        );
      }
    }
  }
  // Allergens (ingredient.ts's AllergenSchema, ROADMAP.md's "Allergens" gap
  // — named there as "arguably the single highest-priority gap against
  // this repo's own stated mission"). A composite entity silently missing
  // an allergen one of its own components carries is exactly the "more
  // dangerous by omission" failure that gap warns about — a hard fail,
  // not a NOTE, the same severity this file already gives a wrong
  // typicalYieldFractionOfParent.ofParentEntityId reference. Checked one
  // level deep only (each component's OWN allergens, not a recursive walk
  // through a component that's itself composite) — every composite entity
  // in this repo as of 2026-08-16 is built from non-composite components,
  // so one level is sufficient today; a real, named limit if that changes.
  if (entity.structure.composite) {
    const missing = new Set<string>();
    for (const componentId of entity.structure.components) {
      const component = entities.items.get(componentId);
      if (!component) continue; // already reported by the structure.components check above
      for (const allergen of component.allergens) {
        if (!entity.allergens.includes(allergen)) missing.add(allergen);
      }
    }
    if (missing.size > 0) {
      fail(
        `entities/${entity.id}.json: is composite of [${entity.structure.components.join(", ")}] but its own ` +
          `allergens is missing ${[...missing].join(", ")}, carried by at least one component — a composite ` +
          `entity's allergens must be a superset of its components' allergens.`
      );
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
    console.log(
      `NOTE entities/${entity.id}.json: has a cooking capability but no criticalControlPointsByAction — confirm this is deliberate (no pathogen risk), not unaudited.`
    );
  }
  if (entity.composition?.nutrientsPer100g && !entity.composition.citation) {
    console.log(`NOTE entities/${entity.id}.json: composition.nutrientsPer100g has no citation.`);
  }
  if (
    entity.thermophysical &&
    Object.keys(entity.thermophysical).some((k) => k !== "citation") &&
    !entity.thermophysical.citation
  ) {
    console.log(`NOTE entities/${entity.id}.json: thermophysical has no citation.`);
  }
}

// meal-pattern-contributions (nutrition-extension.ts, ROADMAP.md Phase 6,
// closed 2026-08-19).
for (const contribution of mealPatternContributions.items.values()) {
  checkEntityIdReference("meal-pattern-contributions", contribution.id);
}

// foodon-crosswalk (foodon-crosswalk.ts, added 2026-08-19).
for (const crosswalk of foodOnCrosswalk.items.values()) {
  checkEntityIdReference("foodon-crosswalk", crosswalk.id);
  // iri/curie are both hand-authored (src/foodon-crosswalk.ts's own doc
  // comment: "every real data file stores its own iri directly ... so a
  // consumer reading the raw JSON file never needs this module's code").
  // Previously only capability-test:foodon-crosswalk (optional, not
  // CI-gating) caught the two drifting — recomputed here too, so `npm run
  // validate` — this repo's own "authoritative integration check" — is
  // the one that actually catches it.
  const recomputedIri = foodOnIriFromCurie(crosswalk.foodOn.curie);
  if (recomputedIri !== crosswalk.foodOn.iri) {
    fail(
      `foodon-crosswalk/${crosswalk.id}.json: iri "${crosswalk.foodOn.iri}" does not match ` +
        `foodOnIriFromCurie(curie) "${recomputedIri}" — curie/iri have drifted apart`
    );
  }
}

for (const action of actions.items.values()) {
  for (const toolId of action.requiredTools) {
    const tool = entities.items.get(toolId);
    if (!tool) {
      fail(`actions/${action.id}.json: requiredTools references unknown entity "${toolId}"`);
    } else if (tool.kind !== "tool") {
      fail(
        `actions/${action.id}.json: requiredTools references "${toolId}" which is kind "${tool.kind}", not "tool"`
      );
    }
  }
  // Same dead-capability shape the last session's verb audit went looking
  // for by hand (LEARNINGS_ENGINE.md, "audit for dead capabilities") — a
  // requiredToolCapabilities entry that no loaded tool entity ever asserts
  // true would make this action permanently unexecutable no matter what a
  // caller has on hand, the tool-side mirror of requiredTools referencing
  // an unknown id, so it's a hard fail, not a NOTE.
  for (const capability of action.requiredToolCapabilities) {
    const satisfied = [...entities.items.values()].some(
      (e) => e.kind === "tool" && e.capabilities[capability] === true
    );
    if (!satisfied) {
      fail(
        `actions/${action.id}.json: requiredToolCapabilities references "${capability}", which no tool entity asserts true — this action can never be executed`
      );
    }
  }
  if (action.outputs.combinesInto && !entities.items.has(action.outputs.combinesInto)) {
    fail(
      `actions/${action.id}.json: outputs.combinesInto references unknown entity "${action.outputs.combinesInto}"`
    );
  }
  if (!action.verification) {
    console.log(
      `NOTE actions/${action.id}.json: no verification criterion — how would a machine confirm this action's effect happened?`
    );
  }
  if (action.retrySafe === undefined) {
    console.log(
      `NOTE actions/${action.id}.json: retrySafe not audited — is blindly re-running this after an interruption safe?`
    );
  }
  // actionKind (action.ts, 2026-08-16, PAPER_NOTES_2608.04768.md TICKET 1) —
  // same "flag unaudited, don't fail" treatment as verification/retrySafe
  // above, so a NEW action added later without classifying it is visible,
  // not silently missed.
  if (action.actionKind === undefined) {
    console.log(
      `NOTE actions/${action.id}.json: actionKind not audited — one-off (instantaneous) or elapsed-time/do-until (continuous)?`
    );
  } else {
    // Soft correspondence check (TICKET 1 step 3): every manual_confirmation
    // action is precisely the paper's "cannot be reliably sensed" class, and
    // every thermal-verified action is a real elapsed-time heating/cooling
    // process — a NOTE here means the two fields were set inconsistently,
    // worth a human's attention, not necessarily wrong (a future action
    // could have a real reason to break the pattern).
    if (
      action.verification?.method === "manual_confirmation" &&
      action.actionKind !== "instantaneous"
    ) {
      console.log(
        `NOTE actions/${action.id}.json: verification.method is manual_confirmation (the paper's own "cannot be reliably ` +
          `sensed" class) but actionKind is "${action.actionKind}", not "instantaneous" — confirm this is deliberate.`
      );
    }
    if (action.verification?.method === "thermal" && action.actionKind !== "continuous") {
      console.log(
        `NOTE actions/${action.id}.json: verification.method is thermal (a real elapsed-time heating/cooling process) but ` +
          `actionKind is "${action.actionKind}", not "continuous" — confirm this is deliberate.`
      );
    }
    // requiresActiveAttention (action.ts, 2026-08-17, DAG-execution ticket) —
    // same "flag unaudited, don't fail" treatment, only meaningful for
    // continuous actions (an instantaneous action is always active by
    // definition — see that field's own doc comment).
    if (action.actionKind === "continuous" && action.requiresActiveAttention === undefined) {
      console.log(
        `NOTE actions/${action.id}.json: requiresActiveAttention not audited — does this need a chef/actor's ongoing ` +
          `hands-on attention (ACTIVE), or does it run itself once started (PASSIVE)?`
      );
    }
  }
}

for (const recipe of recipes.items.values()) {
  const knownEntityIds = new Set(recipe.initialInventory.map((i) => i.entityId));
  for (const item of recipe.initialInventory) {
    if (!entities.items.has(item.entityId)) {
      fail(
        `recipes/${recipe.id}.json: initialInventory references unknown entity "${item.entityId}"`
      );
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
      fail(
        `recipes/${recipe.id}.json: availableTools references "${toolId}" which is kind "${tool.kind}", not "tool"`
      );
    }
  }
  for (const [i, step] of recipe.sequence.entries()) {
    if (!actions.items.has(step.actionId)) {
      fail(
        `recipes/${recipe.id}.json: sequence[${i}] references unknown action "${step.actionId}"`
      );
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
    const result = runRecipe(
      recipe,
      entities.items,
      actions.items,
      ccps.items,
      undefined,
      heatSources.items
    );
    if (result.errors.length > 0) {
      for (const { step, message } of result.errors) {
        fail(
          `recipes/${recipe.id}.json: sequence step "${step.actionId}" on "${step.targetInstanceId}" failed to run: ${message}`
        );
      }
    } else {
      console.log(
        `OK   recipes/${recipe.id}.json simulated end-to-end, zero step errors (${recipe.sequence.length} steps)`
      );
    }
  }
}

const failed =
  entities.failed +
  actions.failed +
  recipes.failed +
  ccps.failed +
  heatSources.failed +
  mealPatternContributions.failed +
  foodOnCrosswalk.failed +
  crossFailed;
const total =
  entities.total +
  actions.total +
  recipes.total +
  ccps.total +
  heatSources.total +
  mealPatternContributions.total +
  foodOnCrosswalk.total;
if (failed > 0) {
  console.error(`\n${failed} problem(s) found.`);
  process.exit(1);
}
console.log(
  `\nAll ${total} files valid (${entities.total} entities, ${actions.total} actions, ${recipes.total} recipes, ${ccps.total} ccps, ${heatSources.total} heat-sources, ${mealPatternContributions.total} meal-pattern-contributions, ${foodOnCrosswalk.total} foodon-crosswalk); cross-references OK.`
);
