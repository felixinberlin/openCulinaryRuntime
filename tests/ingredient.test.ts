import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EntitySchema, CitationSchema, StructureSchema, QuantitySchema } from "../src/ingredient.ts";
import { makeEntity } from "./helpers.ts";

describe("EntitySchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() =>
      EntitySchema.parse({ id: "potato", kind: "ingredient", names: { es: "Patata" }, aggregationState: "solid" })
    );
  });

  test("structure/possibleStates/possibleTags/byproductsByAction/capabilities all default sensibly", () => {
    const e = makeEntity({ id: "salt" });
    assert.deepEqual(e.structure, { composite: false, components: [] });
    assert.deepEqual(e.possibleStates, []);
    assert.deepEqual(e.possibleTags, []);
    assert.deepEqual(e.byproductsByAction, {});
    assert.deepEqual(e.criticalControlPointsByAction, {});
    assert.deepEqual(e.capabilities, {});
  });

  test("capabilities is an open map — an unrecognized key still parses (dynamic capability inference)", () => {
    const e = makeEntity({ id: "mystery_root", capabilities: { isFooBarable: true } as any });
    assert.equal((e.capabilities as any).isFooBarable, true);
  });

  test("kind distinguishes ingredient from tool", () => {
    const knife = makeEntity({ id: "knife", kind: "tool" });
    assert.equal(knife.kind, "tool");
    assert.throws(() => makeEntity({ id: "bad", kind: "vegetable" as any }));
  });
});

describe("CitationSchema", () => {
  test("confidence is restricted to the two honest tiers — no 'primary_source' escape hatch", () => {
    assert.throws(() =>
      CitationSchema.parse({ source: "USDA FoodData Central", confidence: "primary_source" })
    );
    assert.doesNotThrow(() =>
      CitationSchema.parse({ source: "USDA FoodData Central", confidence: "standard_reference" })
    );
    assert.doesNotThrow(() =>
      CitationSchema.parse({ source: "commonly taught", confidence: "commonly_cited_unverified" })
    );
  });
});

describe("StructureSchema", () => {
  test("defaults to non-composite with no components when omitted entirely", () => {
    assert.deepEqual(StructureSchema.parse(undefined), { composite: false, components: [] });
  });
});

describe("QuantitySchema", () => {
  test("'precise' requires a positive amount and a real unit", () => {
    assert.doesNotThrow(() => QuantitySchema.parse({ kind: "precise", amount: 5, unit: "g" }));
    assert.throws(() => QuantitySchema.parse({ kind: "precise", amount: 0, unit: "g" }));
    assert.throws(() => QuantitySchema.parse({ kind: "precise", amount: 5, unit: "smidgen" }));
  });

  test("'imprecise' takes a real culinary descriptor, not an arbitrary string, and doesn't require a gram range", () => {
    assert.doesNotThrow(() => QuantitySchema.parse({ kind: "imprecise", descriptor: "pinch" }));
    assert.throws(() => QuantitySchema.parse({ kind: "imprecise", descriptor: "a bit" }));
  });

  test("'imprecise' approxRangeGrams, when given, is non-authoritative reference context, not a hard number", () => {
    const q = QuantitySchema.parse({
      kind: "imprecise",
      descriptor: "pinch",
      approxRangeGrams: { min: 0.3, max: 0.6 },
      citation: { source: "commonly cited conversion", confidence: "commonly_cited_unverified" },
    });
    if (q.kind !== "imprecise") throw new Error("expected imprecise");
    assert.deepEqual(q.approxRangeGrams, { min: 0.3, max: 0.6 });
  });

  test("'relative' expresses a ratio against another entity — e.g. baker's-percentage salt", () => {
    const q = QuantitySchema.parse({ kind: "relative", ratio: 0.02, ofEntityId: "flour" });
    if (q.kind !== "relative") throw new Error("expected relative");
    assert.equal(q.ratio, 0.02);
    assert.equal(q.ofEntityId, "flour");
    assert.equal(q.basis, "mass", "basis defaults to mass, not count");
  });

  test("an unrecognized 'kind' is rejected — not silently accepted as a 4th shape", () => {
    assert.throws(() => QuantitySchema.parse({ kind: "vague", amount: 1 }));
  });
});
