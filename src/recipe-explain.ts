import type { Entity } from "./ingredient.ts";
import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import { eggBoilDonenessRangeForSize } from "./egg-doneness.ts";
import { potatoBoilDonenessRange } from "./potato-doneness.ts";

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

export interface RecipeExplanation {
  tools: ToolReport;
  ingredients: IngredientReport;
  /** Advisory strings — never errors, only guidance. */
  timingAdvisories: string[];
  prepAdvisories: string[];
}

function candidatesForCapability(entities: Map<string, Entity>, capability: string, kind?: Entity["kind"]): string[] {
  return [...entities.values()]
    .filter((e) => (kind === undefined || e.kind === kind) && e.capabilities[capability] === true)
    .map((e) => e.id);
}

export function explainRecipe(
  recipe: RecipeScript,
  entities: Map<string, Entity>,
  actions: Map<string, Action>
): RecipeExplanation {
  const availableTools = new Set(recipe.availableTools);

  const toolsNeeded = new Set<string>();
  const toolCapsNeeded = new Set<string>();
  const ingredientCapsNeeded = new Set<string>();
  const timingAdvisories: string[] = [];
  const prepAdvisories: string[] = [];

  // Tracks, per recipe-local instance id, whether a WASH step has been seen
  // for it yet — for the heuristic below. Keyed on targetInstanceId, the
  // same id space `recipe-runner.ts`'s inventory uses.
  const washedInstanceIds = new Set<string>();

  for (const step of recipe.sequence) {
    const action = actions.get(step.actionId);
    if (!action) continue; // unknown action ids are runRecipe's job to reject, not this report's

    for (const toolId of action.requiredTools) toolsNeeded.add(toolId);
    for (const cap of action.requiredToolCapabilities) toolCapsNeeded.add(cap);
    for (const cap of action.requiredIngredientCapabilities) ingredientCapsNeeded.add(cap);

    if (action.verb === "WASH") {
      washedInstanceIds.add(step.targetInstanceId);
    } else if (action.verb === "PEEL" || action.verb === "CUT") {
      const targetEntityId = recipe.initialInventory.find((i) => i.id === step.targetInstanceId)?.entityId;
      const entity = targetEntityId ? entities.get(targetEntityId) : undefined;
      // Capability-based (isWashable), not state/tag-based — "washed" is a
      // TAG (2026-08-15: see wash.json/ingredient.ts's statePrerequisites
      // doc comment), so checking possibleTags would work too, but
      // isWashable is the actual marker wash.json's own
      // requiredTargetCapability checks, and doesn't depend on this
      // heuristic staying in sync with exactly how "washability" happens
      // to be represented elsewhere.
      if (entity?.capabilities.isWashable === true && !washedInstanceIds.has(step.targetInstanceId)) {
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
        const eggSize = eggSizeRaw === "small" || eggSizeRaw === "medium" || eggSizeRaw === "large" || eggSizeRaw === "extra_large" ? eggSizeRaw : "large";
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
  }

  const missingTools = [...toolsNeeded].filter((id) => !availableTools.has(id));
  const missingToolCapabilities = [...toolCapsNeeded]
    .filter((cap) => ![...availableTools].some((id) => entities.get(id)?.capabilities[cap] === true))
    .map((capability) => ({ capability, candidates: candidatesForCapability(entities, capability, "tool") }));

  // Ingredient capabilities are checked per-step in the real engine
  // (availableIngredientInstanceIds is per-step, not recipe-wide like
  // availableTools) — but for a whole-sequence PRE-FLIGHT summary, "is this
  // capability satisfiable by ANYTHING in the recipe's initial inventory at
  // all" is the useful question; runRecipe's own per-step check remains the
  // authoritative one.
  const initialInventoryEntityIds = new Set(recipe.initialInventory.map((i) => i.entityId));
  const missingIngredientCapabilities = [...ingredientCapsNeeded]
    .filter((cap) => ![...initialInventoryEntityIds].some((id) => entities.get(id)?.capabilities[cap] === true))
    .map((capability) => ({ capability, candidates: candidatesForCapability(entities, capability) }));

  return {
    tools: { needed: [...toolsNeeded], missing: missingTools, missingCapabilities: missingToolCapabilities },
    ingredients: { needed: [...ingredientCapsNeeded], missing: missingIngredientCapabilities },
    timingAdvisories,
    prepAdvisories,
  };
}
