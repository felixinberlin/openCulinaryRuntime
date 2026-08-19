import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  UsdaMealPatternContributionSchema,
  MealPatternContributionFileSchema,
  creditedAmount,
  type UsdaMealPatternContribution,
} from "../src/nutrition-extension.ts";

const CITATION = { source: "test fixture", confidence: "commonly_cited_unverified" as const };

describe("UsdaMealPatternContributionSchema", () => {
  test("parses a not_creditable contribution", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "not_creditable",
      citation: CITATION,
    });
    assert.equal(result.success, true);
  });

  test("parses a meat_meat_alternate contribution", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "meat_meat_alternate",
      unit: "ounce_equivalent",
      perCount: 2.0,
      citation: CITATION,
    });
    assert.equal(result.success, true);
  });

  test("parses a vegetable contribution with a subgroup", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "vegetable",
      subgroup: "starchy",
      unit: "cup_equivalent",
      perCup: 1.0,
      citation: CITATION,
    });
    assert.equal(result.success, true);
  });

  test("rejects a vegetable contribution missing its subgroup", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "vegetable",
      unit: "cup_equivalent",
      perCup: 1.0,
      citation: CITATION,
    });
    assert.equal(result.success, false);
  });

  test("rejects an unrecognized subgroup value", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "vegetable",
      subgroup: "nonexistent_subgroup",
      unit: "cup_equivalent",
      perCup: 1.0,
      citation: CITATION,
    });
    assert.equal(result.success, false);
  });

  test("rejects a negative crediting rate", () => {
    const result = UsdaMealPatternContributionSchema.safeParse({
      component: "grains",
      unit: "ounce_equivalent",
      creditableGramsPerOzEq: -16,
      citation: CITATION,
    });
    assert.equal(result.success, false);
  });
});

describe("MealPatternContributionFileSchema", () => {
  test("parses a minimal valid file", () => {
    const result = MealPatternContributionFileSchema.safeParse({
      id: "egg",
      contribution: {
        component: "meat_meat_alternate",
        unit: "ounce_equivalent",
        perCount: 2.0,
        citation: CITATION,
      },
    });
    assert.equal(result.success, true);
  });

  test("rejects a missing id", () => {
    const result = MealPatternContributionFileSchema.safeParse({
      contribution: { component: "not_creditable", citation: CITATION },
    });
    assert.equal(result.success, false);
  });
});

describe("creditedAmount", () => {
  const meatAlternate: UsdaMealPatternContribution = {
    component: "meat_meat_alternate",
    unit: "ounce_equivalent",
    perCount: 2.0,
    citation: CITATION,
  };
  const milk: UsdaMealPatternContribution = {
    component: "milk",
    unit: "cup_equivalent",
    perCup: 1.0,
    citation: CITATION,
  };
  const vegetable: UsdaMealPatternContribution = {
    component: "vegetable",
    subgroup: "starchy",
    unit: "cup_equivalent",
    perCup: 1.0,
    citation: CITATION,
  };
  const grains: UsdaMealPatternContribution = {
    component: "grains",
    unit: "ounce_equivalent",
    creditableGramsPerOzEq: 16,
    citation: CITATION,
  };
  const notCreditable: UsdaMealPatternContribution = {
    component: "not_creditable",
    citation: CITATION,
  };

  test("meat_meat_alternate: credits count * perCount", () => {
    const credit = creditedAmount(meatAlternate, { kind: "precise", amount: 2, unit: "count" });
    assert.deepEqual(credit, { amount: 4, unit: "ounce_equivalent" });
  });

  test("meat_meat_alternate: a non-count unit is not credited", () => {
    const credit = creditedAmount(meatAlternate, { kind: "precise", amount: 100, unit: "g" });
    assert.equal(credit, undefined);
  });

  test("milk: credits cup * perCup", () => {
    const credit = creditedAmount(milk, { kind: "precise", amount: 1.5, unit: "cup" });
    assert.deepEqual(credit, { amount: 1.5, unit: "cup_equivalent" });
  });

  test("milk: a non-cup unit (e.g. ml) is not credited — no unit conversion is attempted", () => {
    const credit = creditedAmount(milk, { kind: "precise", amount: 240, unit: "ml" });
    assert.equal(credit, undefined);
  });

  test("vegetable: credits cup * perCup", () => {
    const credit = creditedAmount(vegetable, { kind: "precise", amount: 2, unit: "cup" });
    assert.deepEqual(credit, { amount: 2, unit: "cup_equivalent" });
  });

  test("grains: credits grams / creditableGramsPerOzEq", () => {
    const credit = creditedAmount(grains, { kind: "precise", amount: 320, unit: "g" });
    assert.deepEqual(credit, { amount: 20, unit: "ounce_equivalent" });
  });

  test("grains: converts kg to grams before crediting", () => {
    const credit = creditedAmount(grains, { kind: "precise", amount: 0.32, unit: "kg" });
    assert.deepEqual(credit, { amount: 20, unit: "ounce_equivalent" });
  });

  test("grains: a non-mass unit is not credited", () => {
    const credit = creditedAmount(grains, { kind: "precise", amount: 2, unit: "cup" });
    assert.equal(credit, undefined);
  });

  test("not_creditable: always undefined, regardless of quantity", () => {
    const credit = creditedAmount(notCreditable, { kind: "precise", amount: 500, unit: "g" });
    assert.equal(credit, undefined);
  });

  test("a missing quantity is not credited, not guessed", () => {
    const credit = creditedAmount(meatAlternate, undefined);
    assert.equal(credit, undefined);
  });

  test("an imprecise quantity (e.g. a pinch) is not credited, not guessed", () => {
    const credit = creditedAmount(vegetable, { kind: "imprecise", descriptor: "handful" });
    assert.equal(credit, undefined);
  });

  test("a relative quantity (e.g. a baker's percentage) is not credited, not guessed", () => {
    const credit = creditedAmount(grains, {
      kind: "relative",
      ratio: 0.02,
      ofEntityId: "flour",
      basis: "mass",
    });
    assert.equal(credit, undefined);
  });
});
