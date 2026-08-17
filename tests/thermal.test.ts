import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  requiredHoldSeconds,
  CriticalControlPointSchema,
  type ThermalInactivationModel,
} from "../src/thermal.ts";
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
    assert.throws(() =>
      makeCcp({ id: "x", names: { es: "x" } as unknown as Record<string, string> })
    );
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

  // domainFacts — 2026-08-17, ROADMAP.md's "Structured DomainFact/
  // PhysicalProperty records" gap, egg_cooking.json's coagulationReferenceC
  // migration being the concrete forcing case.
  test("domainFacts defaults to {} — every CCP file written before this field existed needs no change", () => {
    const ccp = CriticalControlPointSchema.parse({
      id: "x",
      names: { en: "x" },
      instantaneousC: 74,
      heldC: 57,
      heldSeconds: 60,
      pathogen: "Salmonella spp.",
      source: "test fixture",
    });
    assert.deepEqual(ccp.domainFacts, {});
  });

  test("domainFacts accepts a real, typed, cited numeric-range fact keyed by an author-chosen id", () => {
    const ccp = CriticalControlPointSchema.parse({
      id: "egg_cooking",
      names: { en: "x" },
      instantaneousC: 71,
      heldC: 63,
      heldSeconds: 15,
      pathogen: "Salmonella spp.",
      source: "test fixture",
      domainFacts: {
        eggWhiteCoagulationTemp: {
          value: { min: 62, max: 65 },
          unit: "celsius",
          citation: {
            source: "Harold McGee, On Food and Cooking",
            confidence: "commonly_cited_unverified",
          },
          verified: false,
        },
      },
    });
    assert.deepEqual(ccp.domainFacts.eggWhiteCoagulationTemp.value, { min: 62, max: 65 });
  });

  test("a malformed domainFacts entry (missing unit) is rejected — exactly the validation the old ad-hoc metadata object never had", () => {
    assert.throws(() =>
      CriticalControlPointSchema.parse({
        id: "x",
        names: { en: "x" },
        instantaneousC: 74,
        heldC: 57,
        heldSeconds: 60,
        pathogen: "Salmonella spp.",
        source: "test fixture",
        domainFacts: {
          someFact: {
            value: 100,
            citation: { source: "test", confidence: "standard_reference" },
            verified: true,
          },
        },
      })
    );
  });
});
