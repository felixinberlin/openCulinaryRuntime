import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { estimatedPreheatSeconds } from "../src/heat-source.ts";
import { makeHeatSource } from "./helpers.ts";

describe("HeatSourceProfileSchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() => makeHeatSource({ id: "x", names: { es: "x" } as any }));
  });

  test("efficiency is bounded to 0-100", () => {
    assert.throws(() =>
      makeHeatSource({ id: "x", thermalEfficiencyPercentRange: { min: 50, max: 150 } })
    );
  });
});

describe("estimatedPreheatSeconds", () => {
  test("matches the textbook Q=mcΔT / P formula exactly for a clean, deterministic case", () => {
    // 1kg water, 20C -> 100C, 1000W at 100% efficiency, specific heat 4186 J/(kg*K).
    const source = makeHeatSource({ id: "ideal" });
    const seconds = estimatedPreheatSeconds(1, 20, 100, source, 4186);
    const expected = (1 * 4186 * 80) / 1000;
    assert.equal(seconds, expected);
  });

  test("throws when the target temperature isn't above the initial temperature", () => {
    const source = makeHeatSource({ id: "ideal" });
    assert.throws(() => estimatedPreheatSeconds(1, 100, 100, source), /must be above/);
    assert.throws(() => estimatedPreheatSeconds(1, 100, 20, source), /must be above/);
  });

  test("lower efficiency means more time, all else equal — a real physical ordering, not just a different number", () => {
    const efficient = makeHeatSource({
      id: "efficient",
      thermalEfficiencyPercentRange: { min: 80, max: 80 },
    });
    const inefficient = makeHeatSource({
      id: "inefficient",
      thermalEfficiencyPercentRange: { min: 20, max: 20 },
    });
    const fastTime = estimatedPreheatSeconds(1, 20, 100, efficient);
    const slowTime = estimatedPreheatSeconds(1, 20, 100, inefficient);
    assert.ok(
      slowTime > fastTime,
      "a less efficient heat source should take longer to reach the same target"
    );
  });

  test("more water takes proportionally longer to reach the same target temperature", () => {
    const source = makeHeatSource({ id: "ideal" });
    const oneLiter = estimatedPreheatSeconds(1, 20, 100, source);
    const twoLiters = estimatedPreheatSeconds(2, 20, 100, source);
    assert.equal(twoLiters, oneLiter * 2);
  });
});
