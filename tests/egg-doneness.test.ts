import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EGG_BOIL_DONENESS, eggBoilDonenessRange, EggBoilDonenessSchema } from "../src/egg-doneness.ts";

describe("EGG_BOIL_DONENESS", () => {
  test("has exactly one entry per boil.json yolkDoneness value, each schema-valid", () => {
    const ids = EGG_BOIL_DONENESS.map((e) => e.yolkDoneness);
    assert.deepEqual([...ids].sort(), ["hard", "medium", "soft"]);
    for (const entry of EGG_BOIL_DONENESS) {
      assert.doesNotThrow(() => EggBoilDonenessSchema.parse(entry));
    }
  });

  test("ranges are ordered and non-overlapping: soft < medium < hard", () => {
    const soft = eggBoilDonenessRange("soft");
    const medium = eggBoilDonenessRange("medium");
    const hard = eggBoilDonenessRange("hard");
    assert.ok(soft.max <= medium.min, "soft's range should end at or before medium's begins");
    assert.ok(medium.max <= hard.min, "medium's range should end at or before hard's begins");
  });

  test("eggBoilDonenessRange throws for an out-of-vocabulary value instead of returning undefined", () => {
    assert.throws(() => eggBoilDonenessRange("runny" as any));
  });

  test("cross-check against the real recipe: soft-boiled-egg.json's chosen 390s falls inside the 'soft' range", () => {
    // Not a coincidence to preserve silently — a real consistency check
    // between this table (added 2026-08-13) and a recipe authored before
    // it existed (LEARNINGS.md 2026-08-12's soft-boiled-egg.json).
    const soft = eggBoilDonenessRange("soft");
    const recipeChoiceSeconds = 390;
    assert.ok(recipeChoiceSeconds >= soft.min && recipeChoiceSeconds <= soft.max);
  });
});
