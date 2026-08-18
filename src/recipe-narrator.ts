import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { explainRecipe, type RecipeExplanation } from "./recipe-explain.ts";
import { runRecipe } from "./recipe-runner.ts";

/**
 * A human-readable "read this recipe back to me" narration — composes
 * `recipe-explain.ts`'s `explainRecipe` (pre-flight needs/advisories)
 * with `recipe-runner.ts`'s `runRecipe` (the ground-truth execution),
 * adding two things neither computes: per-step capability resolution
 * (which real instance satisfied a requirement) and a stated-vs-unstated
 * active duration tally. The duration tally is a SUM of stated
 * `durationSeconds` values, a lower bound, not a real elapsed-time
 * simulation. See `reference/recipe-narrator.md` for design rationale
 * and scope.
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
  /** The instance's tags in the FINAL inventory — always accurate. */
  state: string;
  tags: string[];
  /** Non-empty ONLY when `tags` can be confidently attributed to
   *  conservation-of-mass tag inheritance at spawn time — i.e. this
   *  instance was never targeted again by a later step. See
   *  `reference/recipe-narrator.md`. */
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
   *  requirement work — which real instance satisfied it. */
  capabilityResolutions: CapabilityResolution[];
  /** Unique verbs, in order of first appearance in the sequence. */
  verbsUsed: string[];
  stepCount: number;
  createdElements: SpawnedElement[];
  finalInventory: {
    instanceId: string;
    entityId: string;
    entityName: string;
    state: string;
    tags: string[];
  }[];
  /** Sum of every step's `durationSeconds`, when stated — a lower bound,
   *  not a real elapsed-time total. See `reference/recipe-narrator.md`. */
  statedActiveDurationSeconds: number;
  /** Verb + target labels for steps that COULD have stated a duration
   *  but didn't, named explicitly rather than folded into the tally as
   *  zero. */
  stepsWithUnstatedDuration: string[];
  timingAdvisories: string[];
  prepAdvisories: string[];
  /** `explainRecipe`'s `allergenSummary`, surfaced here so a read-back
   *  recipe says what it contains. */
  allergenSummary: string[];
  /** `explainRecipe`'s `storageSummary`, surfaced here for the same reason. */
  storageSummary: RecipeExplanation["storageSummary"];
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

  // Initial inventory ids resolve directly; ids spawned mid-recipe are
  // recovered from the run's own final inventory.
  const entityIdForInstance = new Map<string, string>();
  for (const item of recipe.initialInventory) entityIdForInstance.set(item.id, item.entityId);
  for (const [id, instance] of result.finalInventory)
    entityIdForInstance.set(id, instance.entityId);

  const verbsUsed: string[] = [];
  const capabilityResolutions: CapabilityResolution[] = [];
  let statedActiveDurationSeconds = 0;
  const stepsWithUnstatedDuration: string[] = [];
  // Every instance id ever named as a target or secondary target,
  // anywhere in the sequence — gates the tag-inheritance claim below. See
  // reference/recipe-narrator.md for why (a re-targeted instance may have
  // gained tags from that later step too).
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

  // Created elements: everything in the final inventory not present at
  // the start. See SpawnedElement's own notes for confidentlyInheritedTags.
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
    storageSummary: explanation.storageSummary,
    runErrors: result.errors.map(
      (e) => `${e.step.actionId} on ${e.step.targetInstanceId}: ${e.message}`
    ),
    ranCleanly: result.errors.length === 0,
  };
}

/** Renders a `RecipeNarration` as a readable Markdown document. Pure
 *  presentation — every fact was already computed by `narrateRecipe`. */
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

  p(`## Storage & shelf life`);
  p();
  if (n.storageSummary.length > 0) {
    for (const entry of n.storageSummary) {
      const parts: string[] = [];
      if (entry.storageLife.refrigeratedDays) {
        const { min, max } = entry.storageLife.refrigeratedDays;
        parts.push(`refrigerated: ${min}-${max} days`);
      }
      if (entry.storageLife.roomTempHours) {
        const { min, max } = entry.storageLife.roomTempHours;
        parts.push(`room temperature: ${min}-${max} hours`);
      }
      if (entry.storageLife.pantryMonths) {
        const { min, max } = entry.storageLife.pantryMonths;
        parts.push(`pantry: ${min}-${max} months`);
      }
      if (entry.storageLife.doNotRefrigerate) parts.push("do NOT refrigerate");
      p(
        `- **${entry.instanceId}** (${entry.entityId}, starting state "${entry.state}"): ${parts.join(", ")} — ${entry.storageLife.citation.source}`
      );
    }
  } else {
    p(
      `No storage/shelf-life guidance (\`ingredient.ts\`'s \`StorageLifeSchema\`) is declared for any ` +
        `\`initialInventory\` ingredient at its starting state — either none has been audited yet, or every ` +
        `ingredient here starts already mid-preparation (a state this repo doesn't have separate storage ` +
        `guidance for).`
    );
  }
  p();
  p(
    `_Reference knowledge only — this repo has no concept of elapsed real-world time (no purchase date, no ` +
      `"how long has this actually been stored"), so this cannot say whether THIS instance is still within range, ` +
      `only what the range is._`
  );
  p();

  p(`## Structure — initial inventory`);
  p();
  for (const item of n.initialInventory) {
    p(
      `- \`${item.instanceId}\`: ${item.entityName} (${item.entityId}), starting state \`${item.state}\``
    );
  }
  p();

  p(`## What it needs`);
  p();
  p(`**Tools** — declared: ${n.availableTools.join(", ") || "(none)"}`);
  p(`Needed by the sequence: ${n.toolsNeeded.join(", ") || "(none)"}`);
  if (n.toolsMissing.length > 0) p(`⚠️ MISSING: ${n.toolsMissing.join(", ")}`);
  for (const m of n.toolCapabilitiesMissing) {
    p(
      `⚠️ MISSING tool capability "${m.capability}" — candidates: ${m.candidates.join(", ") || "(none known)"}`
    );
  }
  p();
  p(`**Ingredient capabilities needed**: ${n.ingredientCapabilitiesNeeded.join(", ") || "(none)"}`);
  for (const m of n.ingredientCapabilitiesMissing) {
    p(
      `⚠️ MISSING ingredient capability "${m.capability}" — candidates: ${m.candidates.join(", ") || "(none known)"}`
    );
  }
  p();

  p(`## What the system inferred`);
  p();
  if (n.capabilityResolutions.length === 0) {
    p(`No ingredient-capability resolutions were needed by this sequence.`);
  } else {
    for (const r of n.capabilityResolutions) {
      p(
        `- Step ${r.stepIndex + 1} (${r.verb}) needed \`${r.capability}\` — satisfied by \`${r.satisfiedByInstanceId}\` (${r.satisfiedByEntityId}).`
      );
    }
  }
  const inherited = n.createdElements.filter((e) => e.confidentlyInheritedTags.length > 0);
  if (inherited.length > 0) {
    p();
    p(
      `Tag inheritance (conservation of mass — a byproduct carries the parent's real, applicable tags forward; only shown when this instance was never targeted again afterward, so the tags can't have come from anything else):`
    );
    for (const e of inherited) {
      p(
        `- \`${e.instanceId}\` (${e.entityName}) inherited tags [${e.confidentlyInheritedTags.join(", ")}].`
      );
    }
  }
  if (n.timingAdvisories.length > 0 || n.prepAdvisories.length > 0) {
    p();
    p(`Advisories raised by the pre-flight check:`);
    for (const a of [...n.timingAdvisories, ...n.prepAdvisories]) p(`- ${a}`);
  } else {
    p();
    p(
      `Zero advisories — every pre-flight check (timing-vs-doneness, wash-before-peel/cut, fry-timing-vs-geometry) passed cleanly.`
    );
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
      p(
        `- \`${e.instanceId}\`: ${e.entityName} (${e.entityId}), state \`${e.state}\`${e.tags.length ? `, tags [${e.tags.join(", ")}]` : ""}`
      );
    }
  }
  p();

  p(`## How long it takes`);
  p();
  p(
    `Stated active duration: **${n.statedActiveDurationSeconds}s** (${(n.statedActiveDurationSeconds / 60).toFixed(1)} min) — sum of every step's own \`durationSeconds\`, not a real elapsed-time simulation.`
  );
  if (n.stepsWithUnstatedDuration.length > 0) {
    p();
    p(
      `Steps that COULD state a duration but don't (not counted above, not zero — genuinely unstated):`
    );
    for (const s of n.stepsWithUnstatedDuration) p(`- ${s}`);
  }
  p();

  p(`## Final inventory`);
  p();
  for (const item of n.finalInventory) {
    p(
      `- \`${item.instanceId}\`: ${item.entityName} (${item.entityId}), state \`${item.state}\`${item.tags.length ? `, tags [${item.tags.join(", ")}]` : ""}`
    );
  }
  p();

  p(`## Result`);
  p();
  p(
    n.ranCleanly
      ? `✅ Runs end-to-end with zero errors.`
      : `❌ ${n.runErrors.length} step(s) failed:`
  );
  for (const e of n.runErrors) p(`- ${e}`);

  return lines.join("\n");
}
