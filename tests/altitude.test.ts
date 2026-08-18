import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  atmosphericPressurePa,
  waterBoilingPointC,
  isWithinBarometricValidity,
  BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M,
  ANTOINE_EQUATION_VALIDITY_TEMP_C,
} from "../src/altitude.ts";

describe("atmosphericPressurePa", () => {
  test("matches standard sea-level pressure exactly at 0m", () => {
    assert.equal(atmosphericPressurePa(0), 101325);
  });

  test("decreases monotonically with altitude", () => {
    const p0 = atmosphericPressurePa(0);
    const p1000 = atmosphericPressurePa(1000);
    const p3000 = atmosphericPressurePa(3000);
    assert.ok(p1000 < p0);
    assert.ok(p3000 < p1000);
  });

  test("rejects a negative altitude", () => {
    assert.throws(() => atmosphericPressurePa(-1), /non-negative/);
  });
});

describe("waterBoilingPointC", () => {
  test("returns ~100°C at sea level — self-consistency check on the Antoine equation itself", () => {
    // The Antoine equation is a curve fit, not exact even at its own
    // reference point, so this checks "very close to 100," not "exactly."
    assert.ok(Math.abs(waterBoilingPointC(0) - 100) < 0.1);
  });

  test("decreases monotonically with altitude", () => {
    const sea = waterBoilingPointC(0);
    const low = waterBoilingPointC(1000);
    const high = waterBoilingPointC(3000);
    assert.ok(low < sea);
    assert.ok(high < low);
  });

  // Cross-checked against real, commonly-cited real-world figures for
  // specific altitudes — the same "internally cross-checked against a
  // real, independent figure" discipline egg-doneness.ts's own test
  // applies to soft-boiled-egg.json's 390s choice, applied here to a
  // computed formula instead of a table lookup.
  test("Denver (1609m) computes to approximately the commonly-cited ~95°C", () => {
    const denver = waterBoilingPointC(1609);
    assert.ok(Math.abs(denver - 95) < 1, `expected close to 95°C, got ${denver.toFixed(2)}°C`);
  });

  test("rejects a negative altitude", () => {
    assert.throws(() => waterBoilingPointC(-1), /non-negative/);
  });
});

describe("isWithinBarometricValidity — the formula's own stated bound, checkable not just asserted", () => {
  test("sea level and Denver are both within the troposphere bound", () => {
    assert.equal(isWithinBarometricValidity(0), true);
    assert.equal(isWithinBarometricValidity(1609), true);
  });

  test("the constant matches the ICAO troposphere bound this file's own doc comment cites (0-11,000m)", () => {
    assert.deepEqual(BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M, { min: 0, max: 11000 });
  });

  test("Mount Everest's summit (~8,849m) is still within the troposphere bound", () => {
    assert.equal(isWithinBarometricValidity(8849), true);
  });

  test("a genuinely stratospheric altitude falls outside it", () => {
    assert.equal(isWithinBarometricValidity(20000), false);
  });

  test("the Antoine equation's own stated validity range matches the NIST-cited 1-100°C", () => {
    assert.deepEqual(ANTOINE_EQUATION_VALIDITY_TEMP_C, { min: 1, max: 100 });
  });
});
