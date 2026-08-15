import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  CUT_SHAPE_DIMENSIONS,
  cutShapeDimensionMm,
  halvedOrQuarteredDimensionMm,
  CutShapeDimensionSchema,
} from "../src/cut-dimensions.ts";

describe("CUT_SHAPE_DIMENSIONS", () => {
  // cut.json's allowedValues has 7 entries (sliced, diced, julienne,
  // chopped, minced, halved, quartered) — this table covers 5 of them;
  // halved/quartered are deliberately handled by halvedOrQuarteredDimensionMm
  // instead (derived from a potato's own size, not an independent standard —
  // see cut-dimensions.ts's own doc comment).
  test("has exactly one entry per non-derived shape, each schema-valid", () => {
    const shapes = CUT_SHAPE_DIMENSIONS.map((e) => e.shape);
    assert.deepEqual([...shapes].sort(), ["chopped", "diced", "julienne", "minced", "sliced"]);
    for (const entry of CUT_SHAPE_DIMENSIONS) {
      assert.doesNotThrow(() => CutShapeDimensionSchema.parse(entry));
    }
  });

  test("minced is finer than julienne, which is finer than diced (real physical ordering)", () => {
    const minced = cutShapeDimensionMm("minced");
    const julienne = cutShapeDimensionMm("julienne");
    const diced = cutShapeDimensionMm("diced");
    assert.ok(minced.max <= julienne.max, "minced should never be coarser than julienne");
    assert.ok(julienne.max <= diced.min, "julienne's cross-section should be no coarser than dice's edge");
  });

  test("cutShapeDimensionMm throws for an out-of-vocabulary value instead of returning undefined", () => {
    assert.throws(() => cutShapeDimensionMm("brunoise" as any));
  });

  test("halvedOrQuarteredDimensionMm derives from the potato's own diameter, not an independent citation", () => {
    const potatoDiameterCm = { min: 5, max: 6.35 }; // potato.json's own physicalDimensions.typicalDiameterCm
    const halved = halvedOrQuarteredDimensionMm(potatoDiameterCm, 2);
    const quartered = halvedOrQuarteredDimensionMm(potatoDiameterCm, 4);
    assert.deepEqual(halved, { min: 25, max: 31.75 });
    assert.deepEqual(quartered, { min: 12.5, max: 15.875 });
    // Quartering should always yield a smaller piece than halving the same potato.
    assert.ok(quartered.max < halved.max);
  });
});
