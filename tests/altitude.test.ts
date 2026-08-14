import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { atmosphericPressurePa, waterBoilingPointC } from "../src/altitude.ts";

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
