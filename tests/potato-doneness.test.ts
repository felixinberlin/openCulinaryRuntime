import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { POTATO_BOIL_DONENESS, potatoBoilDonenessRange, PotatoBoilDonenessSchema } from "../src/potato-doneness.ts";

describe("POTATO_BOIL_DONENESS", () => {
  test("has exactly one entry per boil.json pieceSize value, each schema-valid", () => {
    const ids = POTATO_BOIL_DONENESS.map((e) => e.pieceSize);
    assert.deepEqual([...ids].sort(), ["diced", "halved_or_quartered", "whole"]);
    for (const entry of POTATO_BOIL_DONENESS) {
      assert.doesNotThrow(() => PotatoBoilDonenessSchema.parse(entry));
    }
  });

  // Deliberately NOT "ranges are non-overlapping" (egg-doneness.test.ts's
  // equivalent assertion) — see potato-doneness.ts's own doc comment for
  // why: each category still spans a real range of actual potato sizes,
  // so a big diced piece and a small halved/quartered piece can genuinely
  // take about the same time. What DOES hold, and is real: the MINIMUM
  // (fastest plausible case) is ordered diced <= halved_or_quartered <=
  // whole, matching the real physical ordering (more surface area relative
  // to volume cooks faster) even though the ranges themselves overlap.
  test("minimums are ordered by real physical size: diced <= halved_or_quartered <= whole", () => {
    const diced = potatoBoilDonenessRange("diced");
    const halved = potatoBoilDonenessRange("halved_or_quartered");
    const whole = potatoBoilDonenessRange("whole");
    assert.ok(diced.min <= halved.min, "smaller pieces should never have a higher minimum than larger ones");
    assert.ok(halved.min <= whole.min);
  });

  test("potatoBoilDonenessRange throws for an out-of-vocabulary value instead of returning undefined", () => {
    assert.throws(() => potatoBoilDonenessRange("julienned" as any));
  });
});
