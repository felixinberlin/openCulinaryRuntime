import type { Entity } from "./ingredient.ts";

/**
 * Cross-contamination / hygiene tracking — closes ROADMAP.md's long-open
 * gap: `HazardSchema` (action.ts) models danger to the PERSON performing an
 * action (a blade, hot oil); nothing modeled danger to the FOOD from a
 * tool/surface reused on a ready-to-eat ingredient without washing in
 * between (the exact scenario ROADMAP.md/LEARNINGS_TOOLING.md/
 * LEARNINGS_ENGINE.md/olddocs/scientific_review_report.md all repeatedly
 * name and, until now, none proposed a mechanism for). `CriticalControlPointSchema`
 * (thermal.ts) is thermal-only by design and can't be stretched to cover
 * this — it needed a genuinely different mechanism, built here.
 *
 * SAME STRUCTURAL PRECEDENT `place.ts` SET: a tool instance carrying real,
 * evolving state OUTSIDE the normal `Instance`/`applyAction` model — pure
 * functions over an immutable state object, threaded through
 * `recipe-runner.ts` as a runner-local `Map<string, ToolContaminationState>`
 * keyed by an author-chosen `toolInstanceId`, exactly like `places`/
 * `placeContents` are keyed by `placeId`. This is a deliberate choice, not
 * an oversight: `engine.ts`'s `applyAction` takes `availableTools:
 * ReadonlySet<string>` — a FLAT SET OF ENTITY IDS with no per-instance
 * identity at all (confirmed by direct inspection before this file was
 * written: tools are never `Instance` objects anywhere in this codebase,
 * unlike ingredients, which `recipe-runner.ts`'s `inventory` does track
 * per-instance). Nothing here changes that.
 *
 * `knife.json` already declares `possibleStates: ["clean", "dirty", "dull",
 * "sharp"]` with `allowedTransformations: []` — a real, previously-dead
 * vocabulary slot (same shape as other dead-state gaps this repo has found
 * and fixed before). THAT machinery is deliberately NOT reactivated here:
 * it's `Instance`-based (`engine.ts`'s normal state-transition model), and
 * giving every tool a real per-instance inventory entry for the first time
 * — just so `knife.json`'s "clean"/"dirty" could mean something — would be
 * a materially bigger, structurally different engine change than this gap
 * needs. `ToolContaminationState` below IS the actual mechanism for
 * "clean"/"dirty" on a tool; `knife.json`'s own `possibleStates` stays an
 * honest, named, unenforced declaration, cross-referenced back here rather
 * than silently implied to be wired up.
 *
 * DESIGN DECISION — advisory, not hard reject: unlike
 * `egg_pasteurization_raw.json`'s unconditional hard-reject posture for
 * raw-egg risk, reuse of a contaminated tool is a WARNING
 * (`RecipeRunResult.warnings`/`log`), not a step rejection — an explicit
 * user choice, mirroring `egg_cooking.json`'s `advisoryOnly: true`
 * runny-yolk case rather than `egg_pasteurization_raw.json`'s hard-reject
 * one. The step still proceeds normally either way. This also means this
 * mechanism does NOT interact with `engine.ts`'s `SafetyPolicy` at all —
 * there is nothing to override, in any mode.
 *
 * EXPLICITLY OUT OF SCOPE, named rather than silently implied covered:
 * - No "is the downstream target ready-to-eat" inference — a contaminated
 *   tool warns on reuse against ANY subsequent food-contact step, not just
 *   ones touching a ready-to-eat ingredient specifically. Conservative by
 *   design; a real simplification, not a modeled distinction.
 * - No cutting-board entity or general surface-contamination graph across
 *   arbitrary ingredient pairs — only entities that set
 *   `rawContaminationRiskStates` (ingredient.ts) participate at all.
 * - No probability/detection modeling, no sensor/vision check for "was the
 *   tool actually clean" — same `ENGINE_INVARIANTS.md` #11 boundary every
 *   other hazard/verification field in this repo already respects.
 */
export interface ToolContaminationState {
  /** The recipe-author-chosen id naming one specific physical tool
   *  instance, e.g. "knife-1" — mirrors `PlaceState`'s `placeId` keying,
   *  not an `Entity.id`. */
  readonly toolInstanceId: string;
  readonly contaminated: boolean;
  /** Entity id of whatever last contaminated this tool, e.g. "egg" — for a
   *  clear warning message; not itself consulted by any check. Null when
   *  `contaminated` is false. */
  readonly contaminatedByEntityId: string | null;
  /** The contaminating instance's state at the moment of contact, e.g.
   *  "raw" — the `rawContaminationRiskStates` entry that tripped this.
   *  Null when `contaminated` is false. */
  readonly contaminatedByState: string | null;
}

/** A tool instance's state before it has ever been recorded — same role
 *  `place.ts`'s `emptyPlace` plays for a never-yet-`FILL`ed place. */
export function cleanTool(toolInstanceId: string): ToolContaminationState {
  return {
    toolInstanceId,
    contaminated: false,
    contaminatedByEntityId: null,
    contaminatedByState: null,
  };
}

/** Pure state transition — never mutates `state`, returns a new object,
 *  same discipline as `place.ts`'s `pourInto`/`advanceTempSeconds`. */
export function markContaminated(
  state: ToolContaminationState,
  byEntityId: string,
  byState: string
): ToolContaminationState {
  return {
    toolInstanceId: state.toolInstanceId,
    contaminated: true,
    contaminatedByEntityId: byEntityId,
    contaminatedByState: byState,
  };
}

/** WASH_TOOL's effect — see `data/actions/wash_tool.json` and
 *  `recipe-runner.ts`'s `handleWashTool`. */
export function washTool(state: ToolContaminationState): ToolContaminationState {
  return cleanTool(state.toolInstanceId);
}

/**
 * True when `entity` (at its instance's CURRENT `state`) is a raw-
 * contamination-risk hazard — requires BOTH the entity-level capability
 * flag AND the instance's actual current state to be listed, resolving
 * "capabilities are static, risk is state-dependent" directly (see
 * `ingredient.ts`'s `rawContaminationRiskStates` doc comment for the full
 * reasoning behind the two-part check).
 */
export function isRawContaminationRisk(entity: Entity, instanceState: string): boolean {
  return (
    entity.capabilities.isRawContaminationRisk === true &&
    entity.rawContaminationRiskStates.includes(instanceState)
  );
}
