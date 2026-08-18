import type { Action } from "./action.ts";
import type { ExecutionBound } from "./execution-bounds.ts";

/**
 * Pure functions for querying an already-started continuous action: how
 * far along is it, has it crossed its CCP safety floor, its caller-
 * requested duration, or its forced timeout ceiling — the "still cooking"
 * query `applyAction` (`engine.ts`, genuinely atomic) has no way to
 * answer. Composes with `execution-bounds.ts`'s `ExecutionBound` rather
 * than a second notion of "how long should this take." `engine.ts` is
 * unchanged by this module. Deterministic — `nowSeconds` is a
 * caller-supplied simulated time, never wall-clock. See
 * `reference/in-progress-action.md` for design rationale, history, and
 * scope.
 */
export interface InProgressAction {
  actionId: string;
  /** Simulated seconds at which this action began — comparable only to
   *  other simulated-time values from the same run. */
  startedAtSeconds: number;
  /** The duration explicitly requested via this action's own
   *  `durationSeconds` parameter, when supplied — `undefined` when the
   *  action has no such parameter, or none was given, meaning completion
   *  is determined some other way. See `reference/in-progress-action.md`. */
  requestedDurationSeconds?: number;
}

/** Reads a step's own `params.durationSeconds` — `undefined` for an
 *  absent or malformed value, never `NaN` leaking downstream. Shared with
 *  `dag-scheduler.ts`'s `scheduleDagFromSteps`. */
export function parseDurationSecondsParam(
  params: Readonly<Record<string, string>>
): number | undefined {
  const raw = params["durationSeconds"];
  const parsed = raw !== undefined ? Number(raw) : undefined;
  return parsed !== undefined && !Number.isNaN(parsed) ? parsed : undefined;
}

/** Begins tracking an already-validated continuous action. Returns
 *  `undefined` for an `instantaneous` action or one with no `actionKind`
 *  asserted yet. */
export function beginAction(
  action: Action,
  params: Readonly<Record<string, string>>,
  startedAtSeconds: number
): InProgressAction | undefined {
  if (action.actionKind !== "continuous") return undefined;
  const requestedDurationSeconds = parseDurationSecondsParam(params);
  return { actionId: action.id, startedAtSeconds, requestedDurationSeconds };
}

/** Simulated seconds elapsed since this action began. Never negative —
 *  clamped rather than allowed to produce a negative reading. */
export function elapsedSeconds(inProgress: InProgressAction, nowSeconds: number): number {
  return Math.max(0, nowSeconds - inProgress.startedAtSeconds);
}

export type ProgressStatus =
  /** A real CCP applies and elapsed time hasn't reached its floor yet. */
  | "below_safety_floor"
  /** Elapsed time has reached `bound.maxDurationSeconds` — this action
   *  must not still be running. */
  | "forced_timeout"
  /** Elapsed time has reached the caller's own requested duration — only
   *  reachable when one was actually supplied. */
  | "at_requested_duration"
  /** Still running, no floor/ceiling/target reached yet. */
  | "in_progress";

/**
 * Composes `InProgressAction` (what was asked for and when it started)
 * with `ExecutionBound` (the safety floor and forced ceiling) into one
 * status a caller can act on. `bound` is optional — without it, only the
 * caller's own requested duration (if any) can be checked. See
 * `reference/in-progress-action.md`.
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

/** `0..1`, clamped — `undefined` when no `requestedDurationSeconds`
 *  exists to measure progress against. */
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

/** Seconds remaining until the caller's own requested duration —
 *  `undefined` for the same reason as `fractionOfRequestedDuration`.
 *  Never negative. */
export function remainingRequestedSeconds(
  inProgress: InProgressAction,
  nowSeconds: number
): number | undefined {
  if (inProgress.requestedDurationSeconds === undefined) return undefined;
  return Math.max(0, inProgress.requestedDurationSeconds - elapsedSeconds(inProgress, nowSeconds));
}
