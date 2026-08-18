import { type Entity, type Allergen, type StorageLife, isTerminalState } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import { eggBoilDonenessRangeForSize } from "./egg-doneness.ts";
import { potatoBoilDonenessRange } from "./potato-doneness.ts";
import { cutShapeDimensionMm, halvedOrQuarteredDimensionMm } from "./cut-dimensions.ts";
import {
  thermalDiffusivityM2PerS,
  effectiveHalfThicknessM,
  secondsForCenterToReachTempC,
  POTATO_FORK_TENDER_CENTER_TEMP_C,
  ROOM_TEMP_C,
} from "./heat-penetration.ts";
import { executionBoundFor, type ExecutionBound } from "./execution-bounds.ts";

/**
 * A pre-flight, read-only report over a `RecipeScript` — computed WITHOUT
 * executing anything. `recipe-runner.ts`'s `runRecipe` remains the sole
 * authoritative source of truth for whether a recipe works; this adds
 * upfront, human-readable framing: a whole-sequence tool/ingredient
 * needs summary, a doneness-vs-duration sanity check, a wash-before-cut
 * heuristic advisory, and a fry-timing-vs-geometry check. See
 * `reference/recipe-explain.md` for design rationale, scope, and history.
 */

export interface ToolReport {
  /** Exact `requiredTools` ids referenced anywhere in the sequence. */
  needed: string[];
  /** `needed` ids not present in `recipe.availableTools`. */
  missing: string[];
  /** `requiredToolCapabilities` referenced anywhere in the sequence that
   *  `recipe.availableTools` cannot satisfy, with candidate tool ids that
   *  would. */
  missingCapabilities: { capability: string; candidates: string[] }[];
}

export interface IngredientReport {
  /** `requiredIngredientCapabilities` referenced anywhere in the sequence. */
  needed: string[];
  /** Capabilities no step's `availableIngredientInstanceIds` can satisfy,
   *  with candidate entity ids that would. */
  missing: { capability: string; candidates: string[] }[];
}

/** One `recipe.sequence` step's `actionKind`, surfaced for visibility
 *  only — does not change `runRecipe`'s dispatch behavior. `null` means
 *  unaudited. */
export interface StepActionKind {
  stepIndex: number;
  actionId: string;
  actionKind: "instantaneous" | "continuous" | null;
}

export interface RecipeExplanation {
  tools: ToolReport;
  ingredients: IngredientReport;
  /** Advisory strings — never errors, only guidance. */
  timingAdvisories: string[];
  prepAdvisories: string[];
  /** actionKind for every step, in sequence order — display-only. */
  actionKinds: StepActionKind[];
  /** `execution-bounds.ts`'s dual sensory-timeout/safety-floor bound for
   *  every step where one applies — filtered to only steps
   *  `executionBoundFor` returns something for. Read-only, pre-flight
   *  display only. See `reference/recipe-explain.md`. */
  executionBounds: {
    stepIndex: number;
    actionId: string;
    targetInstanceId: string;
    bound: ExecutionBound;
  }[];
  /** Every allergen (`ingredient.ts`'s `AllergenSchema`, FDA "Big 9") any
   *  `initialInventory` entity carries, deduplicated and sorted. Computed
   *  from `initialInventory` alone — sufficient because `validate.ts`
   *  guarantees a composite entity's own allergens are already a superset
   *  of its components'. See `reference/recipe-explain.md`. */
  allergenSummary: Allergen[];
  /** Real, cited storage/shelf-life guidance for every `initialInventory`
   *  item whose AUTHORED starting state has a `storageLifeByState` entry.
   *  Declaration-only — can say what the guidance is, never whether this
   *  instance is still within it. See `reference/recipe-explain.md`. */
  storageSummary: {
    instanceId: string;
    entityId: string;
    state: string;
    storageLife: StorageLife;
  }[];
}

function candidatesForCapability(
  entities: Map<string, Entity>,
  capability: string,
  kind?: Entity["kind"]
): string[] {
  return [...entities.values()]
    .filter((e) => (kind === undefined || e.kind === kind) && e.capabilities[capability] === true)
    .map((e) => e.id);
}

export function explainRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>,
  /** Optional — omitting it just means executionBounds comes back empty
   *  rather than wrong. See `reference/recipe-explain.md`. */
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(),
  /** Optional — lets a step targeting a mid-recipe-SPAWNED instance
   *  resolve for executionBounds. See `reference/recipe-explain.md`. */
  spawnedEntityIds: ReadonlyMap<string, string> = new Map()
): RecipeExplanation {
  const availableTools = new Set(recipe.availableTools);

  const toolsNeeded = new Set<string>();
  const toolCapsNeeded = new Set<string>();
  const ingredientCapsNeeded = new Set<string>();
  const timingAdvisories: string[] = [];
  const prepAdvisories: string[] = [];

  // Terminal starting-state check — checked against initialInventory
  // only, since this module is execution-free. isTerminalState is
  // computed from invalidTransitions/possibleStates directly, not a
  // second source of truth.
  for (const item of recipe.initialInventory) {
    const entity = entities.get(item.entityId);
    if (entity && isTerminalState(entity, item.state)) {
      prepAdvisories.push(
        `"${item.id}" (${entity.id}) starts in "${item.state}" — a TERMINAL state for this entity (no ` +
          `transformation can change its form/cooking state again, per invalidTransitions). If this is deliberate ` +
          `(e.g. testing failure-recovery handling), fine; otherwise this is very likely an authoring mistake.`
      );
    }
  }

  // Tracks, per recipe-local instance id, whether a WASH step has been
  // seen for it yet — for the heuristic below.
  const washedInstanceIds = new Set<string>();

  // Tracks, per recipe-local instance id, the most recent CUT shape
  // applied — for the fry-timing-vs-geometry check below. A COMBINE
  // spawns a new instance id with no entry, correctly skipped there.
  const shapeByInstanceId = new Map<string, string>();

  const actionKinds: StepActionKind[] = [];
  const executionBounds: RecipeExplanation["executionBounds"] = [];

  for (const [stepIndex, step] of recipe.sequence.entries()) {
    const action = actions.get(step.actionId);
    if (!action) continue; // unknown action ids are runRecipe's job to reject, not this report's

    actionKinds.push({ stepIndex, actionId: step.actionId, actionKind: action.actionKind ?? null });

    const targetEntityId =
      recipe.initialInventory.find((i) => i.id === step.targetInstanceId)?.entityId ??
      spawnedEntityIds.get(step.targetInstanceId);
    const targetEntity = targetEntityId ? entities.get(targetEntityId) : undefined;
    if (targetEntity) {
      const bound = executionBoundFor(action, targetEntity, step.params, ccps);
      if (bound) {
        executionBounds.push({
          stepIndex,
          actionId: step.actionId,
          targetInstanceId: step.targetInstanceId,
          bound,
        });
      }
    }

    for (const toolId of action.requiredTools) toolsNeeded.add(toolId);
    for (const cap of action.requiredToolCapabilities) toolCapsNeeded.add(cap);
    for (const cap of action.requiredIngredientCapabilities) ingredientCapsNeeded.add(cap);

    if (action.verb === "WASH") {
      washedInstanceIds.add(step.targetInstanceId);
    } else if (action.verb === "PEEL" || action.verb === "CUT") {
      if (action.verb === "CUT" && step.params["shape"]) {
        shapeByInstanceId.set(step.targetInstanceId, step.params["shape"]);
      }
      const targetEntityId = recipe.initialInventory.find(
        (i) => i.id === step.targetInstanceId
      )?.entityId;
      const entity = targetEntityId ? entities.get(targetEntityId) : undefined;
      // Capability-based (isWashable), not state/tag-based — see
      // reference/recipe-explain.md for why.
      if (
        entity?.capabilities.isWashable === true &&
        !washedInstanceIds.has(step.targetInstanceId)
      ) {
        prepAdvisories.push(
          `${action.verb} on "${step.targetInstanceId}" (${entity.id}) happens before any WASH step on it — ` +
            `"${entity.id}" is washable; consider washing it first. (Heuristic advice only — ` +
            `not a hygiene/cross-contamination check, see ROADMAP.md.)`
        );
      }
    }

    // Timing-vs-doneness advisory — only meaningful when a duration and a
    // known doneness-shaped parameter are both present. Hardcoded to
    // these exact parameter ids; see reference/recipe-explain.md.
    const durationRaw = step.params["durationSeconds"];
    if (durationRaw !== undefined && action.parameters.some((p) => p.id === "yolkDoneness")) {
      const yolkDoneness = step.params["yolkDoneness"];
      if (yolkDoneness === "soft" || yolkDoneness === "medium" || yolkDoneness === "hard") {
        const eggSizeRaw = step.params["eggSize"];
        const eggSize =
          eggSizeRaw === "small" ||
          eggSizeRaw === "medium" ||
          eggSizeRaw === "large" ||
          eggSizeRaw === "extra_large"
            ? eggSizeRaw
            : "large";
        const seconds = Number(durationRaw);
        const { min, max } = eggBoilDonenessRangeForSize(yolkDoneness, eggSize);
        if (!Number.isNaN(seconds) && (seconds < min || seconds > max)) {
          timingAdvisories.push(
            `${action.verb} on "${step.targetInstanceId}": durationSeconds ${seconds}s is outside EGG_BOIL_DONENESS's ` +
              `"${yolkDoneness}" range for a "${eggSize}" egg (${min}-${max}s) — double-check this is the duration you meant.`
          );
        }
      }
    }
    if (durationRaw !== undefined && action.parameters.some((p) => p.id === "pieceSize")) {
      const pieceSize = step.params["pieceSize"];
      if (pieceSize === "whole" || pieceSize === "halved_or_quartered" || pieceSize === "diced") {
        const seconds = Number(durationRaw);
        const { min, max } = potatoBoilDonenessRange(pieceSize);
        if (!Number.isNaN(seconds) && (seconds < min || seconds > max)) {
          timingAdvisories.push(
            `${action.verb} on "${step.targetInstanceId}": durationSeconds ${seconds}s is outside POTATO_BOIL_DONENESS's ` +
              `"${pieceSize}" range (${min}-${max}s) — double-check this is the duration you meant.`
          );
        }
      }
    }

    // Fry-timing-vs-geometry check — composes cut-dimensions.ts's real
    // shape dimensions with heat-penetration.ts's real heat-conduction
    // physics. Deliberately RANGE-based (fastest vs. slowest face-count
    // case), scoped to entities with complete thermophysical data (today:
    // potato only). See reference/recipe-explain.md.
    if (
      (action.verb === "FRY" || action.verb === "PAR_FRY") &&
      durationRaw !== undefined &&
      step.params["oilTempC"] !== undefined
    ) {
      const shape = shapeByInstanceId.get(step.targetInstanceId);
      const targetEntityId = recipe.initialInventory.find(
        (i) => i.id === step.targetInstanceId
      )?.entityId;
      const entity = targetEntityId ? entities.get(targetEntityId) : undefined;
      const oilTempC = Number(step.params["oilTempC"]);
      const fryDurationSeconds = Number(durationRaw);

      if (
        shape &&
        entity &&
        targetEntityId === "potato" &&
        !Number.isNaN(oilTempC) &&
        !Number.isNaN(fryDurationSeconds)
      ) {
        try {
          const diffusivity = thermalDiffusivityM2PerS(entity);
          let dimensionMm: { min: number; max: number } | undefined;
          if (
            shape === "sliced" ||
            shape === "diced" ||
            shape === "julienne" ||
            shape === "chopped" ||
            shape === "minced"
          ) {
            dimensionMm = cutShapeDimensionMm(shape);
          } else if (
            (shape === "halved" || shape === "quartered") &&
            entity.physicalDimensions?.typicalDiameterCm
          ) {
            dimensionMm = halvedOrQuarteredDimensionMm(
              entity.physicalDimensions.typicalDiameterCm,
              shape === "halved" ? 2 : 4
            );
          }

          if (dimensionMm) {
            const targetC =
              (POTATO_FORK_TENDER_CENTER_TEMP_C.min + POTATO_FORK_TENDER_CENTER_TEMP_C.max) / 2;
            const initialTempC = ROOM_TEMP_C;

            const topCookingMethod = step.params["topCookingMethod"];
            const oneFaceOnly =
              topCookingMethod === "basted" ||
              topCookingMethod === "covered" ||
              topCookingMethod === "untouched";
            const faceCounts: (1 | 2)[] = oneFaceOnly ? [1] : [1, 2];

            let fastestSeconds: number | undefined;
            let slowestSeconds: number | undefined;
            for (const faceCount of faceCounts) {
              for (const thicknessMm of [dimensionMm.min, dimensionMm.max]) {
                const halfThicknessM = effectiveHalfThicknessM(thicknessMm / 1000, faceCount);
                const t = secondsForCenterToReachTempC(
                  {
                    halfThicknessM,
                    diffusivityM2PerS: diffusivity,
                    initialTempC,
                    surfaceTempC: oilTempC,
                  },
                  targetC
                );
                if (fastestSeconds === undefined || t < fastestSeconds) fastestSeconds = t;
                if (slowestSeconds === undefined || t > slowestSeconds) slowestSeconds = t;
              }
            }

            if (fastestSeconds !== undefined && slowestSeconds !== undefined) {
              const coverageNote = oneFaceOnly
                ? `topCookingMethod: "${topCookingMethod}" (one face in oil)`
                : "oil coverage not stated — both submerged and shallow considered";
              if (fryDurationSeconds < fastestSeconds) {
                timingAdvisories.push(
                  `${action.verb} on "${step.targetInstanceId}": durationSeconds ${fryDurationSeconds}s is below even the FASTEST real ` +
                    `case (${fastestSeconds.toFixed(1)}s) for a "${shape}" piece (${dimensionMm.min}-${dimensionMm.max}mm) in ${oilTempC}°C oil ` +
                    `to reach a fork-tender center — very likely undercooked. (${coverageNote}; pure heat-conduction estimate, see heat-penetration.ts.)`
                );
              } else if (fryDurationSeconds < slowestSeconds) {
                timingAdvisories.push(
                  `${action.verb} on "${step.targetInstanceId}": durationSeconds ${fryDurationSeconds}s is within a genuinely UNCERTAIN ` +
                    `range (${fastestSeconds.toFixed(1)}-${slowestSeconds.toFixed(1)}s) for a "${shape}" piece in ${oilTempC}°C oil to reach a ` +
                    `fork-tender center — could be done or not depending on the exact thickness/oil coverage. (${coverageNote}.)`
                );
              }
            }
          }
        } catch (err) {
          // thermalDiffusivityM2PerS throws for incomplete thermophysical
          // data — not applicable, skip silently.
          // secondsForCenterToReachTempC throws when oilTempC can never
          // reach the target — that ONE case is worth surfacing.
          if (err instanceof Error && err.message.includes("can never reach it")) {
            timingAdvisories.push(
              `${action.verb} on "${step.targetInstanceId}": oilTempC ${step.params["oilTempC"]}°C is at or below the fork-tender target ` +
                `(${POTATO_FORK_TENDER_CENTER_TEMP_C.min}-${POTATO_FORK_TENDER_CENTER_TEMP_C.max}°C) — the center can NEVER reach doneness by ` +
                `conduction alone at this oil temperature, no matter how long it fries.`
            );
          }
        }
      }
    }
  }

  const missingTools = [...toolsNeeded].filter((id) => !availableTools.has(id));
  const missingToolCapabilities = [...toolCapsNeeded]
    .filter(
      (cap) => ![...availableTools].some((id) => entities.get(id)?.capabilities[cap] === true)
    )
    .map((capability) => ({
      capability,
      candidates: candidatesForCapability(entities, capability, "tool"),
    }));

  // Whole-sequence pre-flight summary: "is this capability satisfiable by
  // ANYTHING in initialInventory at all" — runRecipe's own per-step check
  // remains the authoritative one. See reference/recipe-explain.md.
  const initialInventoryEntityIds = new Set(recipe.initialInventory.map((i) => i.entityId));
  const missingIngredientCapabilities = [...ingredientCapsNeeded]
    .filter(
      (cap) =>
        ![...initialInventoryEntityIds].some((id) => entities.get(id)?.capabilities[cap] === true)
    )
    .map((capability) => ({
      capability,
      candidates: candidatesForCapability(entities, capability),
    }));

  const allergenSet = new Set<Allergen>();
  for (const item of recipe.initialInventory) {
    const entity = entities.get(item.entityId);
    if (!entity) continue;
    for (const allergen of entity.allergens) allergenSet.add(allergen);
  }
  const allergenSummary = [...allergenSet].sort();

  const storageSummary: RecipeExplanation["storageSummary"] = [];
  for (const item of recipe.initialInventory) {
    const entity = entities.get(item.entityId);
    const storageLife = entity?.storageLifeByState[item.state];
    if (storageLife) {
      storageSummary.push({
        instanceId: item.id,
        entityId: item.entityId,
        state: item.state,
        storageLife,
      });
    }
  }

  return {
    tools: {
      needed: [...toolsNeeded],
      missing: missingTools,
      missingCapabilities: missingToolCapabilities,
    },
    ingredients: { needed: [...ingredientCapsNeeded], missing: missingIngredientCapabilities },
    timingAdvisories,
    prepAdvisories,
    actionKinds,
    executionBounds,
    allergenSummary,
    storageSummary,
  };
}
