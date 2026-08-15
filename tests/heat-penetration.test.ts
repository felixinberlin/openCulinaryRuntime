import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  centerTempCAfterSeconds,
  secondsForCenterToReachTempC,
  thermalDiffusivityM2PerS,
  isWithinValidityCondition,
  type SlabConductionParams,
} from "../src/heat-penetration.ts";
import { makeEntity } from "./helpers.ts";

describe("thermalDiffusivityM2PerS", () => {
  test("computes alpha = k / (rho * cp) from an entity's thermophysical fields", () => {
    const entity = makeEntity({
      id: "test",
      thermophysical: { thermalConductivityWPerMK: 0.5, densityKgPerM3: 1000, specificHeatJPerKgK: 4000 },
    });
    assert.equal(thermalDiffusivityM2PerS(entity), 0.5 / (1000 * 4000));
  });

  test("throws (not undefined) when any required field is missing", () => {
    const noThermophysical = makeEntity({ id: "test" });
    assert.throws(() => thermalDiffusivityM2PerS(noThermophysical), /Cannot compute thermal diffusivity/);

    const missingCp = makeEntity({
      id: "test",
      thermophysical: { thermalConductivityWPerMK: 0.5, densityKgPerM3: 1000 },
    });
    assert.throws(() => thermalDiffusivityM2PerS(missingCp), /Cannot compute thermal diffusivity/);
  });
});

describe("centerTempCAfterSeconds / secondsForCenterToReachTempC — the one-term slab approximation", () => {
  // Realistic potato-like inputs (matches potato.json's own actual values,
  // not hardcoded to the exact entity to keep this test independent of
  // that file's contents).
  const alpha = 0.5 / (1080 * 3730); // k / (rho * cp)
  const params: SlabConductionParams = { halfThicknessM: 0.0015, diffusivityM2PerS: alpha, initialTempC: 20, surfaceTempC: 175 };

  test("round-trips: the time to reach a target center temp, fed back in, reproduces that temp", () => {
    const seconds = secondsForCenterToReachTempC(params, 97);
    const back = centerTempCAfterSeconds(params, seconds);
    assert.ok(Math.abs(back - 97) < 1e-6, `expected ~97, got ${back}`);
  });

  test("real physical ordering: a thicker slice takes longer to reach the same center target", () => {
    const thin = { ...params, halfThicknessM: 0.0015 };
    const thick = { ...params, halfThicknessM: 0.0025 };
    const secondsThin = secondsForCenterToReachTempC(thin, 97);
    const secondsThick = secondsForCenterToReachTempC(thick, 97);
    assert.ok(secondsThick > secondsThin, "a thicker slice should take longer for its center to reach the same temperature");
  });

  test("real physical ordering: hotter oil reaches the same center target faster", () => {
    const cooler = { ...params, surfaceTempC: 165 };
    const hotter = { ...params, surfaceTempC: 200 };
    const secondsCooler = secondsForCenterToReachTempC(cooler, 97);
    const secondsHotter = secondsForCenterToReachTempC(hotter, 97);
    assert.ok(secondsHotter < secondsCooler, "hotter oil should reach the same center target faster");
  });

  test("throws when surfaceTempC equals initialTempC — no driving force", () => {
    const noDrivingForce = { ...params, surfaceTempC: params.initialTempC };
    assert.throws(() => secondsForCenterToReachTempC(noDrivingForce, 50), /no driving force/);
  });

  test("throws when the target is on the wrong side of the driving force (heating case)", () => {
    // Heating toward 175C — a target below the starting 20C, or at/above
    // the surface itself, can never physically be reached this way.
    assert.throws(() => secondsForCenterToReachTempC(params, 10), /can never reach it while heating/);
    assert.throws(() => secondsForCenterToReachTempC(params, 175), /can never reach it while heating/);
  });

  test("throws when the target is on the wrong side of the driving force (cooling case)", () => {
    const cooling: SlabConductionParams = { ...params, initialTempC: 175, surfaceTempC: 4 }; // e.g. shocking a hot potato in cold water
    assert.throws(() => secondsForCenterToReachTempC(cooling, 200), /can never reach it while cooling/);
  });

  test("the capability-test script's real scenarios stay within the model's own Fo > 0.2 validity condition", () => {
    // Mirrors scripts/potato-heat-penetration.ts's actual thin/thick x
    // oil-temp combinations — proving the model is used within its own
    // stated limits, not just claimed to be.
    for (const halfThicknessM of [0.0015, 0.0025]) {
      for (const surfaceTempC of [120, 165, 191, 200]) {
        const p: SlabConductionParams = { halfThicknessM, diffusivityM2PerS: alpha, initialTempC: 20, surfaceTempC };
        const seconds = secondsForCenterToReachTempC(p, 97);
        assert.ok(isWithinValidityCondition(p, seconds), `Fo <= 0.2 for halfThicknessM=${halfThicknessM}, surfaceTempC=${surfaceTempC}`);
      }
    }
  });
});
