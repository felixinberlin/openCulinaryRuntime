import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { requiredHoldSeconds, CriticalControlPointSchema, type ThermalInactivationModel } from "../src/thermal.ts";
import { makeCcp } from "./helpers.ts";

describe("requiredHoldSeconds — D-value/z-value thermal death time model", () => {
  const model: ThermalInactivationModel = {
    referenceTempC: 57,
    referenceHoldSeconds: 1000,
    zValueC: 10,
    validityCondition: "test fixture",
    source: "test fixture",
  };

  test("at the reference temperature, returns exactly the reference hold time", () => {
    assert.equal(requiredHoldSeconds(model, 57), 1000);
  });

  test("one z-value hotter cuts the required time by a factor of 10", () => {
    assert.equal(requiredHoldSeconds(model, 67), 100);
  });

  test("one z-value colder multiplies the required time by 10", () => {
    assert.equal(requiredHoldSeconds(model, 47), 10000);
  });
});

describe("CriticalControlPointSchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() => makeCcp({ id: "x", names: { es: "x" } as unknown as Record<string, string> }));
  });

  test("advisoryOnly defaults to false", () => {
    const ccp = CriticalControlPointSchema.parse({
      id: "x",
      names: { en: "x" },
      instantaneousC: 74,
      heldC: 57,
      heldSeconds: 60,
      pathogen: "Salmonella spp.",
      source: "test fixture",
    });
    assert.equal(ccp.advisoryOnly, false);
  });

  test("a missing source is rejected — an unsourced threshold is exactly the failure mode this schema exists to prevent", () => {
    assert.throws(() =>
      CriticalControlPointSchema.parse({
        id: "x",
        names: { en: "x" },
        instantaneousC: 74,
        heldC: 57,
        heldSeconds: 60,
        pathogen: "Salmonella spp.",
      })
    );
  });
});
