import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  beginAction,
  elapsedSeconds,
  progressStatus,
  fractionOfRequestedDuration,
  remainingRequestedSeconds,
  parseDurationSecondsParam,
} from "../src/in-progress-action.ts";
import type { ExecutionBound } from "../src/execution-bounds.ts";
import { makeAction } from "./helpers.ts";

/**
 * Coverage for src/in-progress-action.ts — synthetic fixtures, same
 * convention as execution-bounds.test.ts (no data/*.json dependency),
 * composed with a hand-built ExecutionBound rather than calling
 * executionBoundFor itself, since that function already has its own
 * dedicated test file.
 */

const fryContinuous = makeAction({
  id: "fry",
  actionKind: "continuous",
  maxDurationSeconds: 1800,
  outputs: { transformedState: "fried" },
});
const beatInstantaneous = makeAction({ id: "beat", actionKind: "instantaneous", outputs: {} });
const mashUnaudited = makeAction({ id: "mash", outputs: {} }); // no actionKind at all
const mashContinuousNoDurationParam = makeAction({
  id: "mash",
  actionKind: "continuous",
  maxDurationSeconds: 600,
  outputs: {},
}); // real shape: MASH has no durationSeconds parameter at all

describe("parseDurationSecondsParam — the shared helper dag-scheduler.ts also reuses", () => {
  test("parses a valid numeric string", () => {
    assert.equal(parseDurationSecondsParam({ durationSeconds: "300" }), 300);
  });

  test("undefined when the param is absent", () => {
    assert.equal(parseDurationSecondsParam({}), undefined);
  });

  test("undefined for a malformed value, never NaN leaking out", () => {
    const result = parseDurationSecondsParam({ durationSeconds: "not-a-number" });
    assert.equal(result, undefined);
    assert.notEqual(result, NaN); // trivially true, but the real point: it's undefined, not NaN
  });
});

describe("beginAction — applicability and requestedDurationSeconds extraction", () => {
  test("returns undefined for an instantaneous action", () => {
    assert.equal(beginAction(beatInstantaneous, { durationSeconds: "60" }, 0), undefined);
  });

  test("returns undefined for an unaudited action (no actionKind at all)", () => {
    assert.equal(beginAction(mashUnaudited, {}, 0), undefined);
  });

  test("requestedDurationSeconds is undefined when the action has no durationSeconds param supplied (MASH, BEAT, CRUSH, ...)", () => {
    const inProgress = beginAction(mashContinuousNoDurationParam, { consistency: "smooth" }, 100);
    assert.ok(inProgress);
    assert.equal(inProgress!.actionId, "mash");
    assert.equal(inProgress!.startedAtSeconds, 100);
    assert.equal(inProgress!.requestedDurationSeconds, undefined);
  });

  test("requestedDurationSeconds is populated when durationSeconds was actually supplied", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "180" }, 50);
    assert.ok(inProgress);
    assert.equal(inProgress!.requestedDurationSeconds, 180);
  });

  test("a malformed durationSeconds value is treated as absent, not NaN leaking downstream", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "not-a-number" }, 0);
    assert.ok(inProgress);
    assert.equal(inProgress!.requestedDurationSeconds, undefined);
  });
});

describe("elapsedSeconds", () => {
  test("normal case", () => {
    const inProgress = beginAction(fryContinuous, {}, 100)!;
    assert.equal(elapsedSeconds(inProgress, 145), 45);
  });

  test("clamped to 0, never negative, for a nowSeconds before startedAtSeconds", () => {
    const inProgress = beginAction(fryContinuous, {}, 100)!;
    assert.equal(elapsedSeconds(inProgress, 50), 0);
  });
});

describe("progressStatus — composes with ExecutionBound", () => {
  const boundWithSafetyFloor: ExecutionBound = {
    minSafeHoldSeconds: 15,
    maxDurationSeconds: 1800,
    floorIsSafetyCritical: true,
    citation: "test fixture",
  };
  const boundNoFloor: ExecutionBound = {
    maxDurationSeconds: 1800,
    floorIsSafetyCritical: false,
  };

  test("below_safety_floor when elapsed hasn't reached minSafeHoldSeconds yet", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "180" }, 0)!;
    assert.equal(progressStatus(inProgress, boundWithSafetyFloor, 5), "below_safety_floor");
  });

  test("in_progress once past the safety floor but before the requested duration", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "180" }, 0)!;
    assert.equal(progressStatus(inProgress, boundWithSafetyFloor, 100), "in_progress");
  });

  test("at_requested_duration once elapsed reaches the caller's own requested duration", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "180" }, 0)!;
    assert.equal(progressStatus(inProgress, boundWithSafetyFloor, 180), "at_requested_duration");
  });

  test("forced_timeout once elapsed reaches maxDurationSeconds, even if requestedDurationSeconds is longer", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "3000" }, 0)!; // longer than the 1800s ceiling
    assert.equal(progressStatus(inProgress, boundWithSafetyFloor, 1800), "forced_timeout");
  });

  test("no requestedDurationSeconds at all (MASH-shaped): in_progress until forced_timeout, never at_requested_duration", () => {
    const inProgress = beginAction(mashContinuousNoDurationParam, { consistency: "smooth" }, 0)!;
    assert.equal(progressStatus(inProgress, boundNoFloor, 300), "in_progress");
    assert.equal(progressStatus(inProgress, boundNoFloor, 1800), "forced_timeout");
  });

  test("no ExecutionBound at all: only requestedDurationSeconds (if any) can ever be reached, no floor/ceiling checks", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "180" }, 0)!;
    assert.equal(progressStatus(inProgress, undefined, 5), "in_progress"); // no floor to be "below" of
    assert.equal(progressStatus(inProgress, undefined, 180), "at_requested_duration");
  });
});

describe("fractionOfRequestedDuration / remainingRequestedSeconds", () => {
  test("undefined when no requestedDurationSeconds exists — a real 'not applicable', not a guessed 0", () => {
    const inProgress = beginAction(mashContinuousNoDurationParam, { consistency: "smooth" }, 0)!;
    assert.equal(fractionOfRequestedDuration(inProgress, 100), undefined);
    assert.equal(remainingRequestedSeconds(inProgress, 100), undefined);
  });

  test("normal case, midway through", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "200" }, 0)!;
    assert.equal(fractionOfRequestedDuration(inProgress, 50), 0.25);
    assert.equal(remainingRequestedSeconds(inProgress, 50), 150);
  });

  test("clamped to 1 / 0 once past the requested duration, not an overshoot value", () => {
    const inProgress = beginAction(fryContinuous, { durationSeconds: "200" }, 0)!;
    assert.equal(fractionOfRequestedDuration(inProgress, 500), 1);
    assert.equal(remainingRequestedSeconds(inProgress, 500), 0);
  });
});
