import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  secondsForYolkToReachTempC,
  YOLK_TARGET_TEMP_C,
  type EggSphereConductionParams,
} from "../src/egg-heat-penetration.ts";
import { EGG_SIZE_GRAMS, eggBoilDonenessRange } from "../src/egg-doneness.ts";

/**
 * Coverage for egg-heat-penetration.ts's Williams-formula spherical
 * conduction model — synthetic egg-like fixtures (matching egg.json's own
 * real cited values, kept independent of that file's contents the same
 * way heat-penetration.test.ts stays independent of potato.json).
 */

const EGG_LIKE = {
  specificHeatJPerKgK: 3320,
  densityKgPerM3: 1030,
  thermalConductivityWPerMK: 0.34,
};

function largeEggParams(overrides: Partial<EggSphereConductionParams> = {}): EggSphereConductionParams {
  return {
    massKg: EGG_SIZE_GRAMS.large / 1000,
    ...EGG_LIKE,
    initialTempC: 4,
    waterTempC: 100,
    ...overrides,
  };
}

describe("secondsForYolkToReachTempC", () => {
  test("a real 'large' egg's soft-target time falls INSIDE EGG_BOIL_DONENESS's empirical range", () => {
    const seconds = secondsForYolkToReachTempC(largeEggParams(), YOLK_TARGET_TEMP_C.soft);
    const empirical = eggBoilDonenessRange("soft");
    assert.ok(
      seconds >= empirical.min && seconds <= empirical.max,
      `expected ${seconds.toFixed(0)}s inside [${empirical.min}, ${empirical.max}]`
    );
  });

  test("real physical ordering: a bigger egg takes longer for the same target temperature", () => {
    const small = secondsForYolkToReachTempC(largeEggParams({ massKg: EGG_SIZE_GRAMS.small / 1000 }), YOLK_TARGET_TEMP_C.soft);
    const large = secondsForYolkToReachTempC(largeEggParams({ massKg: EGG_SIZE_GRAMS.large / 1000 }), YOLK_TARGET_TEMP_C.soft);
    const xl = secondsForYolkToReachTempC(largeEggParams({ massKg: EGG_SIZE_GRAMS.extra_large / 1000 }), YOLK_TARGET_TEMP_C.soft);
    assert.ok(small < large, "a small egg should reach the target faster than a large one");
    assert.ok(large < xl, "a large egg should reach the target faster than an extra-large one");
  });

  test("real physical ordering: a higher target temperature (hard vs. soft) takes longer", () => {
    const soft = secondsForYolkToReachTempC(largeEggParams(), YOLK_TARGET_TEMP_C.soft);
    const medium = secondsForYolkToReachTempC(largeEggParams(), YOLK_TARGET_TEMP_C.medium);
    const hard = secondsForYolkToReachTempC(largeEggParams(), YOLK_TARGET_TEMP_C.hard);
    assert.ok(soft < medium, "medium target is hotter than soft — should take longer");
    assert.ok(medium < hard, "hard target is hotter than medium — should take longer");
  });

  test("hotter water reaches the same yolk target faster", () => {
    const cooler = secondsForYolkToReachTempC(largeEggParams({ waterTempC: 91 }), YOLK_TARGET_TEMP_C.soft); // e.g. Bogotá altitude
    const hotter = secondsForYolkToReachTempC(largeEggParams({ waterTempC: 100 }), YOLK_TARGET_TEMP_C.soft);
    assert.ok(hotter < cooler, "hotter water should reach the same yolk target faster");
  });

  test("throws when waterTempC equals initialTempC — no driving force", () => {
    assert.throws(
      () => secondsForYolkToReachTempC(largeEggParams({ waterTempC: 4 }), YOLK_TARGET_TEMP_C.soft),
      /no driving force/
    );
  });

  test("throws when the target is on the wrong side of the driving force (heating case)", () => {
    assert.throws(() => secondsForYolkToReachTempC(largeEggParams(), 2), /can never reach it while heating/);
    assert.throws(() => secondsForYolkToReachTempC(largeEggParams(), 100), /can never reach it while heating/);
  });

  test("throws when the target is on the wrong side of the driving force (cooling case)", () => {
    const cooling = largeEggParams({ initialTempC: 100, waterTempC: 4 }); // e.g. shocking a hot egg in cold water
    assert.throws(() => secondsForYolkToReachTempC(cooling, 2), /can never reach it while cooling/);
    assert.throws(() => secondsForYolkToReachTempC(cooling, 100), /can never reach it while cooling/);
  });
});

describe("YOLK_TARGET_TEMP_C", () => {
  test("is monotonically increasing soft < medium < hard, a real physical ordering", () => {
    assert.ok(YOLK_TARGET_TEMP_C.soft < YOLK_TARGET_TEMP_C.medium);
    assert.ok(YOLK_TARGET_TEMP_C.medium < YOLK_TARGET_TEMP_C.hard);
  });
});

describe("EGG_SIZE_GRAMS", () => {
  test("is monotonically increasing small < medium < large < extra_large", () => {
    assert.ok(EGG_SIZE_GRAMS.small < EGG_SIZE_GRAMS.medium);
    assert.ok(EGG_SIZE_GRAMS.medium < EGG_SIZE_GRAMS.large);
    assert.ok(EGG_SIZE_GRAMS.large < EGG_SIZE_GRAMS.extra_large);
  });
});
