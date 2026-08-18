import type { Entity } from "./ingredient.ts";

/**
 * Cross-contamination / hygiene tracking: danger to the FOOD from a tool
 * reused on a ready-to-eat ingredient without washing in between (distinct
 * from `HazardSchema`'s danger-to-the-person, and from
 * `CriticalControlPointSchema`'s thermal-only HACCP model). Same
 * structural precedent as `place.ts` — a tool instance's state tracked
 * outside `Instance`/`applyAction`, threaded through `recipe-runner.ts`
 * keyed by an author-chosen `toolInstanceId`. Advisory only (a warning,
 * not a step rejection). See `reference/tool-hygiene.md` for design
 * rationale, history, and scope.
 */
export interface ToolContaminationState {
  /** The recipe-author-chosen id naming one specific physical tool
   *  instance, e.g. "knife-1" — mirrors `PlaceState`'s `placeId` keying. */
  readonly toolInstanceId: string;
  readonly contaminated: boolean;
  /** Entity id of whatever last contaminated this tool. Null when
   *  `contaminated` is false. */
  readonly contaminatedByEntityId: string | null;
  /** The contaminating instance's state at the moment of contact. Null
   *  when `contaminated` is false. */
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

/** Pure state transition — returns a new object, never mutates. */
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

/** True when `entity` (at its instance's CURRENT `state`) is a
 *  raw-contamination-risk hazard — requires both the entity-level
 *  capability flag and the instance's current state to be listed. See
 *  `ingredient.ts`'s `rawContaminationRiskStates`. */
export function isRawContaminationRisk(entity: Entity, instanceState: string): boolean {
  return (
    entity.capabilities.isRawContaminationRisk === true &&
    entity.rawContaminationRiskStates.includes(instanceState)
  );
}
