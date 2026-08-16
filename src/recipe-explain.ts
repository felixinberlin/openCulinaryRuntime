import { type Entity, type Allergen, isTerminalState } from "./ingredient.ts";
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
} from "./heat-penetration.ts";
import { executionBoundFor, type ExecutionBound } from "./execution-bounds.ts";

/**
 * A pre-flight, read-only report over a `RecipeScript` — computed WITHOUT
 * executing anything (no `applyAction` calls, no inventory mutation). Built
 * directly in response to "we'll eventually have a frontend recipe creator
 * that validates against this system's rules; what does that look like on
 * the command line first" (2026-08-15).
 *
 * `recipe-runner.ts`'s `runRecipe` is still the ONE authoritative source of
 * truth for whether a recipe actually works — this module does not
 * duplicate or second-guess any of `engine.ts`'s `applyAction` checks
 * (required tools, capabilities, state prerequisites, HACCP CCP
 * thresholds). What it adds is upfront, human-readable framing `runRecipe`
 * doesn't produce on its own:
 *
 * 1. A whole-sequence summary of what's needed vs. declared (today, a
 *    missing tool only surfaces as a runtime rejection on the FIRST step
 *    that needs it — nothing lists everything a recipe will ever need
 *    before running it).
 * 2. A sanity check between the *informational* doneness parameters
 *    (`yolkDoneness`, `pieceSize`) and the `durationSeconds` actually
 *    supplied — `applyAction` deliberately never reads these together (see
 *    `egg-doneness.ts`/`potato-doneness.ts`'s own doc comments: these
 *    parameters are human-readable hints, not enforced values), but a
 *    recipe-creation tool can still flag "you said soft but gave a
 *    hard-boiled duration" as advice, without engine.ts needing to
 *    enforce anything.
 * 3. A heuristic wash-before-peel/cut prep advisory. Explicitly a
 *    HEURISTIC, not a new enforcement mechanism: `ROADMAP.md`'s "Cross-
 *    contamination / hygiene knowledge" gap (danger to the FOOD from
 *    equipment/surface reuse, not just to the person) is real, unbuilt,
 *    and needs a genuinely different mechanism than this — this check
 *    does not claim to close it, only to notice the one narrow, concrete
 *    case of "you're about to cut into a raw, unwashed vegetable."
 * 4. A fry-timing-vs-geometry check (added 2026-08-15), composing
 *    `cut-dimensions.ts`'s real shape dimensions with `heat-
 *    penetration.ts`'s real heat-conduction physics — closes the exact
 *    gap `crispy_french_fries.json`'s own `shapeConnectionNote` named
 *    unprompted before either module existed. Deliberately RANGE-based
 *    (fastest vs. slowest real case), not a false-precision single
 *    verdict — see the check's own inline comment for why (no recipe
 *    today states how much oil is used).
 */

export interface ToolReport {
  /** Exact `requiredTools` ids referenced anywhere in the sequence. */
  needed: string[];
  /** `needed` ids not present in `recipe.availableTools`. */
  missing: string[];
  /**
   * `requiredToolCapabilities` referenced anywhere in the sequence that
   * `recipe.availableTools` cannot satisfy — with the actual candidate
   * tool ids (from the full entity catalog) that WOULD satisfy each one,
   * so the report can say what to add, not just that something's missing.
   */
  missingCapabilities: { capability: string; candidates: string[] }[];
}

export interface IngredientReport {
  /** `requiredIngredientCapabilities` referenced anywhere in the sequence. */
  needed: string[];
  /** Capabilities no step's `availableIngredientInstanceIds` can satisfy,
   *  with candidate entity ids that would. */
  missing: { capability: string; candidates: string[] }[];
}

/** One `recipe.sequence` step's `actionKind` (action.ts, 2026-08-16,
 *  PAPER_NOTES_2608.04768.md TICKET 1), surfaced here for visibility only —
 *  per that ticket's own scoping, this does NOT change `runRecipe`'s
 *  dispatch behavior at all; `null` means the referenced action predates
 *  auditing and hasn't been classified (see `validate.ts`'s matching NOTE
 *  check for the same "unaudited, not silently defaulted" signal). */
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
  /** actionKind for every step, in sequence order — see StepActionKind's
   *  own doc comment for why this is display-only. */
  actionKinds: StepActionKind[];
  /**
   * `execution-bounds.ts`'s dual sensory-timeout/safety-floor bound for
   * every step where one actually applies (TICKET 2,
   * `PAPER_NOTES_2608.04768.md`) — filtered, unlike `actionKinds` above,
   * to only the steps `executionBoundFor` returns something for
   * (instantaneous actions and continuous actions with no
   * `maxDurationSeconds` are skipped rather than listed as "none", to
   * avoid drowning the real entries in noise). Read-only, pre-flight
   * display only — does NOT change `runRecipe`'s dispatch behavior, same
   * scoping `actionKinds` itself uses.
   */
  executionBounds: {
    stepIndex: number;
    actionId: string;
    targetInstanceId: string;
    bound: ExecutionBound;
  }[];
  /**
   * Every allergen (`ingredient.ts`'s `AllergenSchema`, the FDA "Big 9")
   * any `initialInventory` entity carries, deduplicated and sorted —
   * `ROADMAP.md`'s "Allergens" gap, named there as "arguably the single
   * highest-priority gap against this repo's own stated mission": a
   * system meant to eventually cook unattended for someone relying on it
   * should be able to say "this dish contains egg" without a human
   * re-deriving it by reading every entity file by hand.
   *
   * Computed from `recipe.initialInventory` alone — sufficient despite
   * this module's execution-free design (see the top doc comment):
   * `scripts/validate.ts` hard-fails any composite entity (a `COMBINE`
   * result, e.g. `tortilla_mixture`) whose own `allergens` isn't already a
   * superset of its `structure.components`' allergens, so nothing spawned
   * mid-recipe can introduce an allergen absent from the starting
   * ingredients — the union over `initialInventory` is already complete,
   * not an approximation of it.
   */
  allergenSummary: Allergen[];
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
  // Optional, defaulted — added 2026-08-16 (TICKET 2,
  // PAPER_NOTES_2608.04768.md) alongside executionBounds below. Every
  // pre-existing call site (this file's own 20+ synthetic-fixture tests
  // included) is unaffected: omitting ccps just means executionBoundFor
  // never finds a CCP, so executionBounds comes back empty rather than
  // wrong — the same "additive, non-breaking" convention every other
  // optional parameter in this codebase follows.
  ccps: ReadonlyMap<string, CriticalControlPoint> = new Map(),
  // Optional, defaulted, added alongside ccps above — a step targeting a
  // SPAWNED instance id (e.g. PASTEURIZE on egg_yolk-3, SEPARATE's own
  // output) can't be resolved against recipe.initialInventory alone; a
  // caller that already ran runRecipe (e.g. scripts/validate-recipe.ts)
  // can pass its real RecipeRunResult.spawnedEntityIds here to close that
  // gap with REAL ground truth. Omitting it just means those steps are
  // silently skipped in executionBounds below, same as before this
  // parameter existed — not wrong, just less complete.
  spawnedEntityIds: ReadonlyMap<string, string> = new Map()
): RecipeExplanation {
  const availableTools = new Set(recipe.availableTools);

  const toolsNeeded = new Set<string>();
  const toolCapsNeeded = new Set<string>();
  const ingredientCapsNeeded = new Set<string>();
  const timingAdvisories: string[] = [];
  const prepAdvisories: string[] = [];

  // Terminal starting-state check (TICKET 5, PAPER_NOTES_2608.04768.md) —
  // "so recipe-explain.ts can say 'this state is unrecoverable' rather
  // than silently listing zero options." Deliberately checked against
  // initialInventory only, not every mid-recipe state (this file is
  // execution-free — see this module's own top doc comment — it has no
  // way to know an instance's state partway through the sequence without
  // actually running it). isTerminalState is computed from
  // invalidTransitions/possibleStates directly (ingredient.ts), not a
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

  // Tracks, per recipe-local instance id, whether a WASH step has been seen
  // for it yet — for the heuristic below. Keyed on targetInstanceId, the
  // same id space `recipe-runner.ts`'s inventory uses.
  const washedInstanceIds = new Set<string>();

  // Tracks, per recipe-local instance id, the most recent CUT shape
  // applied to it — for the fry-timing-vs-geometry check below. A
  // COMBINE step spawns a genuinely new instance id (e.g. tortilla_
  // mixture-4) with no entry here, which is correct: that instance isn't
  // "sliced potato" in the geometric sense anymore, so the check below
  // naturally skips it rather than needing special-case handling.
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
      // Capability-based (isWashable), not state/tag-based — "washed" is a
      // TAG (2026-08-15: see wash.json/ingredient.ts's statePrerequisites
      // doc comment), so checking possibleTags would work too, but
      // isWashable is the actual marker wash.json's own
      // requiredTargetCapability checks, and doesn't depend on this
      // heuristic staying in sync with exactly how "washability" happens
      // to be represented elsewhere.
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

    // Timing-vs-doneness advisory: only meaningful when this step actually
    // supplied both a duration AND one of the two known doneness-shaped
    // parameters this repo has real cited tables for. Deliberately
    // hardcoded to these exact parameter ids (not a generic mechanism) —
    // same convention egg-doneness.ts/potato-doneness.ts themselves use;
    // there is no third table to generalize toward yet.
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

    // Fry-timing-vs-geometry check: composes cut-dimensions.ts's real
    // shape dimensions with heat-penetration.ts's real heat-conduction
    // physics — closes the exact gap crispy_french_fries.json's own
    // shapeConnectionNote named before either module existed ("nothing
    // connects CUT's shape state to FRY's/PAR_FRY's durationSeconds").
    // Deliberately RANGE-based, not a single verdict: no recipe today
    // states how much oil is used, so whether a slice is heated from one
    // face (shallow oil) or two (submerged) is genuinely unknown most of
    // the time — computed for BOTH and reported as the resulting time
    // window, not guessed as one default. fry.json's own
    // topCookingMethod ("basted"/"covered"/"untouched" — all imply the
    // top face isn't submerged) is a real signal, used to narrow the
    // window to one face when a recipe actually sets it. Scoped to only
    // entities with COMPLETE thermophysical data (today: potato only) —
    // capability-based on data completeness via the try/catch below, not
    // hardcoded to one entity id, so this applies automatically the day
    // a second entity gains full thermophysical data. The doneness
    // TARGET temperature is potato-specific by name
    // (POTATO_FORK_TENDER_CENTER_TEMP_C) — the one piece that doesn't
    // yet generalize, gated explicitly rather than silently assumed.
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
            const initialTempC = 20; // room temperature, stated assumption — same as scripts/potato-heat-penetration.ts

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
          // data — not applicable, skip silently, same "informational,
          // not forced" convention as the rest of this module.
          // secondsForCenterToReachTempC also throws when oilTempC itself
          // can never reach the target (e.g. at or below it) — that ONE
          // specific case is worth surfacing, not swallowing.
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

  // Ingredient capabilities are checked per-step in the real engine
  // (availableIngredientInstanceIds is per-step, not recipe-wide like
  // availableTools) — but for a whole-sequence PRE-FLIGHT summary, "is this
  // capability satisfiable by ANYTHING in the recipe's initial inventory at
  // all" is the useful question; runRecipe's own per-step check remains the
  // authoritative one.
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
  };
}
