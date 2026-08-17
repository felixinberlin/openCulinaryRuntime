import type { Action } from "./action.ts";
import type { ExecutionBound } from "./execution-bounds.ts";

/**
 * The next real slice of ROADMAP.md's "Heat as a shared, time-varying
 * property of a PLACE" gap — specifically the half named but explicitly
 * NOT built as of that entry's own 2026-08-15 design-input update:
 * `Instance.inProgressAction: { actionId, startedAt, durationSeconds,
 * estimatedCompletion }`, "letting an instance be queried as 'still
 * cooking' mid-action rather than treating every action as instantaneous"
 * (from a user-supplied `WORLD_MODEL_OPTIMIZATION.md` read, cited there).
 *
 * `applyAction` (`engine.ts`) is genuinely atomic — one call maps one
 * `Instance` directly from its prior state to its NEXT state; there is no
 * way today to ask "how far along is this FRY that started 45 seconds
 * ago." This module answers exactly that question, as a set of pure
 * functions over a real, already-started action — composing directly with
 * `execution-bounds.ts`'s `ExecutionBound` (TICKET 2,
 * `PAPER_NOTES_2608.04768.md`) rather than re-deriving a second notion of
 * "how long should this take": the SAME `minSafeHoldSeconds`/
 * `maxDurationSeconds` pair that already answers "may a sensor end this
 * early" / "must this be force-stopped" now also anchors "where in that
 * range is this instance right now."
 *
 * SAME standalone-module-before-engine-wiring precedent as `place.ts`/
 * `heat-source.ts`/`execution-bounds.ts` itself: `engine.ts`'s `applyAction`
 * is completely UNCHANGED by this module's existence — it stays atomic.
 * Nothing in `recipe-runner.ts` pauses mid-step or constructs an
 * `InProgressAction` today; this only proves the QUERY mechanism is real
 * and correct, the same "real math, provable via a script, before — if
 * ever — being wired into the actual execution loop" discipline
 * `execution-bounds.ts`'s own doc comment states. Actually PAUSING a
 * recipe-runner step mid-execution (so a later step could interleave with
 * an already-started continuous one — the concrete "basting applied
 * repeatedly DURING frying" and "egg shape settling over its first several
 * seconds" cases ROADMAP.md's own entry also names) is a real, larger,
 * still-unbuilt extension, deliberately out of scope here — this module
 * answers "how far along, in TIME, is a started action," not "what does
 * the food actually look/behave like partway through," a genuinely harder
 * question this doesn't attempt.
 *
 * Deterministic (`ENGINE_INVARIANTS.md` #9): every function here is a pure
 * function of its arguments — `nowSeconds` is a caller-supplied SIMULATED
 * time (matching `place.ts`'s own elapsed-simulated-time discipline), not
 * a wall-clock read.
 */
export interface InProgressAction {
  actionId: string;
  /** Simulated seconds at which this action began — comparable only to
   *  other simulated-time values from the same run, never wall-clock time. */
  startedAtSeconds: number;
  /** The duration explicitly requested via this action's OWN
   *  `durationSeconds` parameter, when the action declares one and a value
   *  was actually supplied for THIS call — `undefined` when the action has
   *  no such parameter at all (BEAT/MASH/CRUSH/DISSOLVE/GRATE/MIX/SHOCK/
   *  WHISK/BAKE — real, common actions with no caller-specified target
   *  duration) or none was given. `undefined` here does NOT mean "unknown
   *  error" — it means completion is determined some other way (a sensory
   *  signal, in the paper's own framing, or `maxDurationSeconds`'s forced
   *  timeout), not a caller-specified target duration, and every function
   *  below treats it that way rather than guessing a number. */
  requestedDurationSeconds?: number;
}

/**
 * Reads a step's own `params.durationSeconds` — the shared extraction
 * `beginAction` below and `dag-scheduler.ts`'s `scheduleDagFromSteps` both
 * need (added 2026-08-17, a real, small duplication a whole-project review
 * found and closed: both files independently parsed the identical
 * `raw !== undefined ? Number(raw) : undefined` / `!Number.isNaN(...)`
 * shape). `undefined` for an absent or malformed value — never `NaN`
 * leaking downstream, and never guessed at; see `InProgressAction.
 * requestedDurationSeconds`'s own doc comment for why `undefined` here is a
 * real, first-class "not applicable," not an error. Callers that want a
 * different fallback (e.g. `dag-scheduler.ts`'s `0` for an unparameterized
 * duration) apply it themselves — this only does the parsing, not the
 * fallback policy, since that's genuinely different between callers.
 */
export function parseDurationSecondsParam(
  params: Readonly<Record<string, string>>
): number | undefined {
  const raw = params["durationSeconds"];
  const parsed = raw !== undefined ? Number(raw) : undefined;
  return parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
}

/**
 * Begins tracking an already-validated continuous action. Returns
 * `undefined` for an `instantaneous` action (CUT, PEEL, ... — there is no
 * partial-completion concept for a single discrete act; `ENGINE_INVARIANTS.md`
 * #9's determinism and `action.ts`'s own `actionKind` split already draw
 * this exact line) or one with no `actionKind` asserted yet (unaudited,
 * same "absent means not yet decided" discipline as `action.ts`/
 * `execution-bounds.ts`).
 */
export function beginAction(
  action: Action,
  params: Readonly<Record<string, string>>,
  startedAtSeconds: number
): InProgressAction | undefined {
  if (action.actionKind !== "continuous") return undefined;
  const requestedDurationSeconds = parseDurationSecondsParam(params);
  return { actionId: action.id, startedAtSeconds, requestedDurationSeconds };
}

/** Simulated seconds elapsed since this action began. Never negative — a
 *  `nowSeconds` before `startedAtSeconds` is a caller bug, clamped rather
 *  than allowed to produce a negative "elapsed" reading downstream. */
export function elapsedSeconds(inProgress: InProgressAction, nowSeconds: number): number {
  return Math.max(0, nowSeconds - inProgress.startedAtSeconds);
}

export type ProgressStatus =
  /** A real CCP applies (`bound.minSafeHoldSeconds`) and elapsed time
   *  hasn't reached it yet — the SAME floor `execution-bounds.ts` already
   *  says a sensory reading may not override; querying progress here
   *  answers the identical question from the "checking in on it" angle
   *  instead of the "a signal just fired" angle. */
  | "below_safety_floor"
  /** Elapsed time has reached `bound.maxDurationSeconds` — the paper's own
   *  forced-timeout ceiling (`Timeout(120s, ForceNext)`); this action must
   *  not still be running. */
  | "forced_timeout"
  /** Elapsed time has reached the CALLER's own requested duration
   *  (`requestedDurationSeconds`) — only reachable when one was actually
   *  supplied; an action with none (BEAT, MASH, ...) can never report this
   *  status, only "in_progress" or "forced_timeout". */
  | "at_requested_duration"
  /** Still running, no floor/ceiling/target reached yet — the ordinary
   *  "still cooking, ask again later" case. */
  | "in_progress";

/**
 * The real payoff: composes `InProgressAction` (what WAS asked for and
 * when it started) with `ExecutionBound` (the safety floor and forced
 * ceiling `execution-bounds.ts` already computes) into one status a
 * caller can act on. `bound` is optional because not every action has one
 * (`executionBoundFor` itself returns `undefined` for a non-continuous
 * action or one missing `maxDurationSeconds` — see that function's own
 * doc comment); without it, only the caller's own requested duration (if
 * any) can be checked, never the safety floor or forced ceiling.
 */
export function progressStatus(
  inProgress: InProgressAction,
  bound: ExecutionBound | undefined,
  nowSeconds: number
): ProgressStatus {
  const elapsed = elapsedSeconds(inProgress, nowSeconds);
  if (bound?.minSafeHoldSeconds !== undefined && elapsed < bound.minSafeHoldSeconds) {
    return "below_safety_floor";
  }
  if (bound !== undefined && elapsed >= bound.maxDurationSeconds) {
    return "forced_timeout";
  }
  if (
    inProgress.requestedDurationSeconds !== undefined &&
    elapsed >= inProgress.requestedDurationSeconds
  ) {
    return "at_requested_duration";
  }
  return "in_progress";
}

/** `0..1`, clamped — `undefined` when no `requestedDurationSeconds` exists
 *  to measure progress against (see that field's own doc comment: this is
 *  a real "not applicable," not a missing value to guess at). */
export function fractionOfRequestedDuration(
  inProgress: InProgressAction,
  nowSeconds: number
): number | undefined {
  if (
    inProgress.requestedDurationSeconds === undefined ||
    inProgress.requestedDurationSeconds <= 0
  ) {
    return undefined;
  }
  return Math.min(1, elapsedSeconds(inProgress, nowSeconds) / inProgress.requestedDurationSeconds);
}

/** Seconds remaining until the caller's own requested duration — `undefined`
 *  for the same reason as `fractionOfRequestedDuration` above. Never
 *  negative (a status of "at_requested_duration" or beyond reads as 0, not
 *  a negative "remaining" figure). */
export function remainingRequestedSeconds(
  inProgress: InProgressAction,
  nowSeconds: number
): number | undefined {
  if (inProgress.requestedDurationSeconds === undefined) return undefined;
  return Math.max(0, inProgress.requestedDurationSeconds - elapsedSeconds(inProgress, nowSeconds));
}
