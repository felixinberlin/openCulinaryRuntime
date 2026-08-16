import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { executionBoundFor } from "../src/execution-bounds.ts";
import { makeEntity, makeAction, makeCcp } from "./helpers.ts";

/**
 * Coverage for src/execution-bounds.ts (TICKET 2, PAPER_NOTES_2608.04768.md)
 * — synthetic fixtures, same convention as place.ts/recipe-runner.ts's own
 * tests, no data/*.json dependency.
 */

const egg = makeEntity({ id: "egg", criticalControlPointsByAction: { boil: "egg_cooking" } });
const eggYolk = makeEntity({ id: "egg_yolk", criticalControlPointsByAction: { pasteurize: "egg_pasteurization" } });
const garlic = makeEntity({ id: "garlic" }); // no criticalControlPointsByAction at all

const boilContinuous = makeAction({
  id: "boil",
  actionKind: "continuous",
  maxDurationSeconds: 2400,
  outputs: { transformedState: "boiled" },
});
const beatInstantaneous = makeAction({ id: "beat", actionKind: "instantaneous", outputs: {} });
const mashUnaudited = makeAction({ id: "mash", outputs: {} }); // no actionKind at all
const crushContinuousNoMax = makeAction({ id: "crush", actionKind: "continuous", outputs: {} }); // no maxDurationSeconds

const flatCcp = makeCcp({ id: "egg_cooking", heldC: 63, heldSeconds: 15, source: "test fixture — flat CCP" });
const thermalModelCcp = makeCcp({
  id: "egg_pasteurization",
  heldC: 60,
  heldSeconds: 210,
  source: "test fixture — CCP with thermalModel",
  thermalModel: {
    referenceTempC: 60,
    referenceHoldSeconds: 210,
    zValueC: 4.5,
    validityCondition: "test fixture",
    source: "test fixture — thermalModel source",
  },
});
const ccps = new Map([
  ["egg_cooking", flatCcp],
  ["egg_pasteurization", thermalModelCcp],
]);

describe("executionBoundFor — applicability gates", () => {
  test("returns undefined for an instantaneous action", () => {
    const bound = executionBoundFor(beatInstantaneous, egg, {}, ccps);
    assert.equal(bound, undefined);
  });

  test("returns undefined for an unaudited action (no actionKind at all)", () => {
    const bound = executionBoundFor(mashUnaudited, egg, {}, ccps);
    assert.equal(bound, undefined);
  });

  test("returns undefined for a continuous action with no maxDurationSeconds set", () => {
    const bound = executionBoundFor(crushContinuousNoMax, egg, {}, ccps);
    assert.equal(bound, undefined);
  });
});

describe("executionBoundFor — CCP floor resolution", () => {
  test("no CCP applies to this action/entity pair -> floorIsSafetyCritical false, minSafeHoldSeconds undefined", () => {
    const bound = executionBoundFor(boilContinuous, garlic, {}, ccps);
    assert.ok(bound);
    assert.equal(bound!.maxDurationSeconds, 2400);
    assert.equal(bound!.minSafeHoldSeconds, undefined);
    assert.equal(bound!.floorIsSafetyCritical, false);
    assert.equal(bound!.citation, undefined);
  });

  test("a flat (no thermalModel) CCP resolves to its heldSeconds, with the CCP's own source as citation", () => {
    const bound = executionBoundFor(boilContinuous, egg, {}, ccps);
    assert.ok(bound);
    assert.equal(bound!.minSafeHoldSeconds, 15);
    assert.equal(bound!.floorIsSafetyCritical, true);
    assert.equal(bound!.citation, "test fixture — flat CCP");
  });

  test("a CCP with a thermalModel, and NO waterTempC supplied, falls back to the flat heldSeconds", () => {
    const pasteurizeContinuous = makeAction({
      id: "pasteurize",
      actionKind: "continuous",
      maxDurationSeconds: 7200,
      outputs: {},
    });
    const bound = executionBoundFor(pasteurizeContinuous, eggYolk, {}, ccps);
    assert.ok(bound);
    assert.equal(bound!.minSafeHoldSeconds, 210); // the flat heldSeconds, unchanged
    assert.equal(bound!.citation, "test fixture — CCP with thermalModel");
  });

  test("a CCP with a thermalModel AND waterTempC supplied computes the real D/z-derived hold time, citing thermalModel.source", () => {
    const pasteurizeContinuous = makeAction({
      id: "pasteurize",
      actionKind: "continuous",
      maxDurationSeconds: 7200,
      outputs: {},
    });
    // At exactly referenceTempC (60°C), requiredHoldSeconds returns exactly
    // referenceHoldSeconds (210s) — a direct sanity check against thermal.ts's
    // own formula, not just "some number came back".
    const atReference = executionBoundFor(pasteurizeContinuous, eggYolk, { waterTempC: "60" }, ccps);
    assert.equal(atReference!.minSafeHoldSeconds, 210);
    assert.equal(atReference!.citation, "test fixture — thermalModel source");

    // One full z-value hotter (64.5°C) -> required hold time cuts by 10x.
    const hotter = executionBoundFor(pasteurizeContinuous, eggYolk, { waterTempC: "64.5" }, ccps);
    assert.equal(hotter!.minSafeHoldSeconds, 21);
  });

  test("waterTempC only triggers the thermal model on the exact key engine.ts's applyAction uses — oilTempC does NOT (deliberate fidelity, see this file's own doc comment)", () => {
    const pasteurizeContinuous = makeAction({
      id: "pasteurize",
      actionKind: "continuous",
      maxDurationSeconds: 7200,
      outputs: {},
    });
    const bound = executionBoundFor(pasteurizeContinuous, eggYolk, { oilTempC: "60" }, ccps);
    // Falls back to the flat heldSeconds, exactly as if no temp param had been supplied at all.
    assert.equal(bound!.minSafeHoldSeconds, 210);
  });

  test("a garbled waterTempC (not a valid number) falls back to the flat heldSeconds rather than computing NaN", () => {
    const pasteurizeContinuous = makeAction({
      id: "pasteurize",
      actionKind: "continuous",
      maxDurationSeconds: 7200,
      outputs: {},
    });
    const bound = executionBoundFor(pasteurizeContinuous, eggYolk, { waterTempC: "not-a-number" }, ccps);
    assert.equal(bound!.minSafeHoldSeconds, 210);
  });

  test("a CCP id referenced by the entity but not present in the ccps map is treated as no CCP applying, not a throw", () => {
    const targetEntity = makeEntity({ id: "mystery", criticalControlPointsByAction: { boil: "nonexistent_ccp" } });
    const bound = executionBoundFor(boilContinuous, targetEntity, {}, ccps);
    assert.ok(bound);
    assert.equal(bound!.minSafeHoldSeconds, undefined);
    assert.equal(bound!.floorIsSafetyCritical, false);
  });
});
