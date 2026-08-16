import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { explainRecipe } from "./recipe-explain.ts";
import { runRecipe } from "./recipe-runner.ts";

/**
 * A human-readable "read this recipe back to me" narration — added
 * 2026-08-15, directly answering a request to explain a recipe's
 * structure, needs, inferences, created elements, verbs, and timing "in
 * a nice document." Deliberately NOT a new source of truth: every fact
 * here comes from composing two modules that already exist and are
 * already the authority on their own piece — `recipe-explain.ts`'s
 * `explainRecipe` (pre-flight needs/advisories) and `recipe-runner.ts`'s
 * `runRecipe` (actual execution, the ONE ground-truth source for what a
 * recipe does). This module adds narrative framing and one new piece of
 * real information neither of those computes: PER-STEP capability
 * resolution (not just "is isFryingMedium satisfiable at all" but "which
 * actual instance satisfied it, this step") and a stated-vs-unstated
 * active duration tally.
 *
 * Honesty caveat, stated once here rather than scattered: the duration
 * tally is a SUM OF STATED `durationSeconds` VALUES, not a real elapsed-
 * time simulation — wash/peel/cut/salt steps have no `durationSeconds`
 * parameter at all in this vocabulary (matching this repo's own
 * established assumption that quick prep steps aren't timed), and a step
 * CAN omit `durationSeconds` even when the action supports it (this
 * repo's own `garlic-oil-potatoes.json` does exactly this for its potato
 * FRY step). Reported as a lower bound with the untimed steps named
 * explicitly, not implied to be the recipe's real total time.
 */

export interface CapabilityResolution {
  stepIndex: number;
  verb: string;
  capability: string;
  satisfiedByInstanceId: string;
  satisfiedByEntityId: string;
}

export interface SpawnedElement {
  instanceId: string;
  entityId: string;
  entityName: string;
  /** The instance's tags in the FINAL inventory — always accurate,
   *  regardless of how they got there. */
  state: string;
  tags: string[];
  /**
   * Non-empty ONLY when `tags` above can be confidently attributed to
   * conservation-of-mass tag inheritance at spawn time (engine.ts,
   * 2026-08-12) — i.e. this instance id is NEVER targeted by any later
   * step in the sequence, so nothing could have added a tag to it after
   * it was created. When an instance IS re-targeted later (e.g. a
   * COMBINE-spawned `tortilla_mixture` that a later `FLIP` step also
   * targets), its final tags may include ones that later step added
   * itself — reporting those as "inherited" would be a real, checkable
   * inaccuracy, not a rounding error. Left empty rather than guessed in
   * that case; `tags` above still reports the real final value.
   */
  confidentlyInheritedTags: string[];
}

export interface RecipeNarration {
  id: string;
  nameEn: string;
  initialInventory: { instanceId: string; entityId: string; entityName: string; state: string }[];
  availableTools: string[];
  toolsNeeded: string[];
  toolsMissing: string[];
  toolCapabilitiesMissing: { capability: string; candidates: string[] }[];
  ingredientCapabilitiesNeeded: string[];
  ingredientCapabilitiesMissing: { capability: string; candidates: string[] }[];
  /** What the system inferred to make each ingredient-capability
   *  requirement work — the "which real instance actually satisfied
   *  this" narrative `explainRecipe`'s own needed/missing summary
   *  doesn't provide. */
  capabilityResolutions: CapabilityResolution[];
  /** Unique verbs, in order of first appearance in the sequence. */
  verbsUsed: string[];
  stepCount: number;
  createdElements: SpawnedElement[];
  finalInventory: { instanceId: string; entityId: string; entityName: string; state: string; tags: string[] }[];
  /** Sum of every step's `durationSeconds`, when stated — see this
   *  file's own doc comment for why this is a lower bound, not a real
   *  elapsed-time total. */
  statedActiveDurationSeconds: number;
  /** Verb + target labels for steps that COULD have stated a duration
   *  (the action has a `durationSeconds` parameter) but didn't, named
   *  explicitly rather than silently folded into the tally as zero. */
  stepsWithUnstatedDuration: string[];
  timingAdvisories: string[];
  prepAdvisories: string[];
  /** `explainRecipe`'s `allergenSummary` — the FDA "Big 9" allergens this
   *  dish's `initialInventory` carries (`ingredient.ts`'s `AllergenSchema`,
   *  `ROADMAP.md`'s "Allergens" gap). Surfaced here, not just in
   *  `RecipeExplanation`, so a narrated/read-back recipe says "this dish
   *  contains egg" the same way it already says what tools it needs. */
  allergenSummary: string[];
  runErrors: string[];
  ranCleanly: boolean;
}

function entityName(entities: Map<string, Entity>, entityId: string): string {
  return entities.get(entityId)?.names.en ?? entityId;
}

export function narrateRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  ccps: Map<string, CriticalControlPoint> = new Map()
): RecipeNarration {
  const explanation = explainRecipe(recipe, entities, actions, ccps);
  const result = runRecipe(recipe, entities, actions, ccps);

  // targetEntityId lookup: initial inventory ids resolve directly; ids
  // spawned mid-recipe (e.g. potato_peel-1) are recovered from the run's
  // own final inventory, the same way recipe-runner.ts's own log already
  // knows about them — no re-deriving spawnCounter logic here.
  const entityIdForInstance = new Map<string, string>();
  for (const item of recipe.initialInventory) entityIdForInstance.set(item.id, item.entityId);
  for (const [id, instance] of result.finalInventory) entityIdForInstance.set(id, instance.entityId);

  const verbsUsed: string[] = [];
  const capabilityResolutions: CapabilityResolution[] = [];
  let statedActiveDurationSeconds = 0;
  const stepsWithUnstatedDuration: string[] = [];
  // Every instance id ever named as a target or secondary target,
  // ANYWHERE in the sequence — used below to gate the tag-inheritance
  // claim. An id that's ONLY ever the thing a step spawns (never itself
  // targeted afterward) can safely be said to carry only its at-spawn
  // (inherited) tags; one that's targeted again later (e.g. FLIP on a
  // COMBINE-spawned tortilla_mixture) may have gained tags from THAT
  // step too — conflating the two would misreport a later-added tag
  // (`FLIP`'s `addsTag: "flipped"`) as if conservation-of-mass put it
  // there, a real bug this file's own test recipes caught by comparing
  // against `tortilla-de-patatas.json`, a more complex real case than
  // `garlic-oil-potatoes.json` alone exercised.
  const everTargeted = new Set<string>();

  recipe.sequence.forEach((step, index) => {
    everTargeted.add(step.targetInstanceId);
    if (step.secondaryInstanceId) everTargeted.add(step.secondaryInstanceId);

    const action = actions.get(step.actionId);
    if (!action) return; // unknown action ids are runRecipe's own error, already in result.errors

    if (!verbsUsed.includes(action.verb)) verbsUsed.push(action.verb);

    const durationRaw = step.params["durationSeconds"];
    const supportsDuration = action.parameters.some((p) => p.id === "durationSeconds");
    if (durationRaw !== undefined) {
      const seconds = Number(durationRaw);
      if (!Number.isNaN(seconds)) statedActiveDurationSeconds += seconds;
    } else if (supportsDuration) {
      stepsWithUnstatedDuration.push(`${action.verb} on "${step.targetInstanceId}"`);
    }

    for (const capability of action.requiredIngredientCapabilities) {
      for (const ingredientId of step.availableIngredientInstanceIds) {
        const ingredientEntityId = entityIdForInstance.get(ingredientId);
        const ingredientEntity = ingredientEntityId ? entities.get(ingredientEntityId) : undefined;
        if (ingredientEntity?.capabilities[capability] === true) {
          capabilityResolutions.push({
            stepIndex: index,
            verb: action.verb,
            capability,
            satisfiedByInstanceId: ingredientId,
            satisfiedByEntityId: ingredientEntity.id,
          });
          break; // one real instance is enough to explain the resolution
        }
      }
    }
  });

  // Created elements: everything in the final inventory that ISN'T in
  // the initial inventory — i.e. actually spawned during the run, not
  // just present from the start. See SpawnedElement's own doc comment
  // for why `confidentlyInheritedTags` is gated on `everTargeted` rather
  // than just reporting every tag as "inherited."
  const initialIds = new Set(recipe.initialInventory.map((i) => i.id));
  const createdElements: SpawnedElement[] = [];
  for (const [instanceId, instance] of result.finalInventory) {
    if (initialIds.has(instanceId)) continue;
    createdElements.push({
      instanceId,
      entityId: instance.entityId,
      entityName: entityName(entities, instance.entityId),
      state: instance.state,
      tags: instance.tags,
      confidentlyInheritedTags: everTargeted.has(instanceId) ? [] : instance.tags,
    });
  }

  return {
    id: recipe.id,
    nameEn: recipe.names["en"] ?? recipe.id,
    initialInventory: recipe.initialInventory.map((i) => ({
      instanceId: i.id,
      entityId: i.entityId,
      entityName: entityName(entities, i.entityId),
      state: i.state,
    })),
    availableTools: recipe.availableTools,
    toolsNeeded: explanation.tools.needed,
    toolsMissing: explanation.tools.missing,
    toolCapabilitiesMissing: explanation.tools.missingCapabilities,
    ingredientCapabilitiesNeeded: explanation.ingredients.needed,
    ingredientCapabilitiesMissing: explanation.ingredients.missing,
    capabilityResolutions,
    verbsUsed,
    stepCount: recipe.sequence.length,
    createdElements,
    finalInventory: [...result.finalInventory].map(([instanceId, instance]) => ({
      instanceId,
      entityId: instance.entityId,
      entityName: entityName(entities, instance.entityId),
      state: instance.state,
      tags: instance.tags,
    })),
    statedActiveDurationSeconds,
    stepsWithUnstatedDuration,
    timingAdvisories: explanation.timingAdvisories,
    prepAdvisories: explanation.prepAdvisories,
    allergenSummary: explanation.allergenSummary,
    runErrors: result.errors.map((e) => `${e.step.actionId} on ${e.step.targetInstanceId}: ${e.message}`),
    ranCleanly: result.errors.length === 0,
  };
}

/** Renders a `RecipeNarration` as a readable Markdown document. Pure
 *  presentation — every fact it prints was already computed by
 *  `narrateRecipe`, nothing is derived here. */
export function renderNarrationMarkdown(n: RecipeNarration): string {
  const lines: string[] = [];
  const p = (s = "") => lines.push(s);

  p(`# ${n.nameEn}`);
  p();
  p(`Recipe id: \`${n.id}\` — ${n.stepCount} steps, ${n.verbsUsed.length} distinct verbs used.`);
  p();

  p(`## Allergens`);
  p();
  p(
    n.allergenSummary.length > 0
      ? `⚠️ Contains: **${n.allergenSummary.join(", ")}** (FDA "Big 9" — \`ingredient.ts\`'s \`AllergenSchema\`).`
      : `None of the FDA "Big 9" major allergens (\`ingredient.ts\`'s \`AllergenSchema\`) are declared on any \`initialInventory\` ingredient.`
  );
  p();

  p(`## Structure — initial inventory`);
  p();
  for (const item of n.initialInventory) {
    p(`- \`${item.instanceId}\`: ${item.entityName} (${item.entityId}), starting state \`${item.state}\``);
  }
  p();

  p(`## What it needs`);
  p();
  p(`**Tools** — declared: ${n.availableTools.join(", ") || "(none)"}`);
  p(`Needed by the sequence: ${n.toolsNeeded.join(", ") || "(none)"}`);
  if (n.toolsMissing.length > 0) p(`⚠️ MISSING: ${n.toolsMissing.join(", ")}`);
  for (const m of n.toolCapabilitiesMissing) {
    p(`⚠️ MISSING tool capability "${m.capability}" — candidates: ${m.candidates.join(", ") || "(none known)"}`);
  }
  p();
  p(`**Ingredient capabilities needed**: ${n.ingredientCapabilitiesNeeded.join(", ") || "(none)"}`);
  for (const m of n.ingredientCapabilitiesMissing) {
    p(`⚠️ MISSING ingredient capability "${m.capability}" — candidates: ${m.candidates.join(", ") || "(none known)"}`);
  }
  p();

  p(`## What the system inferred`);
  p();
  if (n.capabilityResolutions.length === 0) {
    p(`No ingredient-capability resolutions were needed by this sequence.`);
  } else {
    for (const r of n.capabilityResolutions) {
      p(`- Step ${r.stepIndex + 1} (${r.verb}) needed \`${r.capability}\` — satisfied by \`${r.satisfiedByInstanceId}\` (${r.satisfiedByEntityId}).`);
    }
  }
  const inherited = n.createdElements.filter((e) => e.confidentlyInheritedTags.length > 0);
  if (inherited.length > 0) {
    p();
    p(`Tag inheritance (conservation of mass — a byproduct carries the parent's real, applicable tags forward; only shown when this instance was never targeted again afterward, so the tags can't have come from anything else):`);
    for (const e of inherited) {
      p(`- \`${e.instanceId}\` (${e.entityName}) inherited tags [${e.confidentlyInheritedTags.join(", ")}].`);
    }
  }
  if (n.timingAdvisories.length > 0 || n.prepAdvisories.length > 0) {
    p();
    p(`Advisories raised by the pre-flight check:`);
    for (const a of [...n.timingAdvisories, ...n.prepAdvisories]) p(`- ${a}`);
  } else {
    p();
    p(`Zero advisories — every pre-flight check (timing-vs-doneness, wash-before-peel/cut, fry-timing-vs-geometry) passed cleanly.`);
  }
  p();

  p(`## Verbs used`);
  p();
  p(n.verbsUsed.map((v) => `\`${v}\``).join(", "));
  p();

  p(`## Elements created`);
  p();
  if (n.createdElements.length === 0) {
    p(`Nothing spawned — every instance in the final inventory was already present at the start.`);
  } else {
    for (const e of n.createdElements) {
      p(`- \`${e.instanceId}\`: ${e.entityName} (${e.entityId}), state \`${e.state}\`${e.tags.length ? `, tags [${e.tags.join(", ")}]` : ""}`);
    }
  }
  p();

  p(`## How long it takes`);
  p();
  p(`Stated active duration: **${n.statedActiveDurationSeconds}s** (${(n.statedActiveDurationSeconds / 60).toFixed(1)} min) — sum of every step's own \`durationSeconds\`, not a real elapsed-time simulation.`);
  if (n.stepsWithUnstatedDuration.length > 0) {
    p();
    p(`Steps that COULD state a duration but don't (not counted above, not zero — genuinely unstated):`);
    for (const s of n.stepsWithUnstatedDuration) p(`- ${s}`);
  }
  p();

  p(`## Final inventory`);
  p();
  for (const item of n.finalInventory) {
    p(`- \`${item.instanceId}\`: ${item.entityName} (${item.entityId}), state \`${item.state}\`${item.tags.length ? `, tags [${item.tags.join(", ")}]` : ""}`);
  }
  p();

  p(`## Result`);
  p();
  p(n.ranCleanly ? `✅ Runs end-to-end with zero errors.` : `❌ ${n.runErrors.length} step(s) failed:`);
  for (const e of n.runErrors) p(`- ${e}`);

  return lines.join("\n");
}
