import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { EntitySchema, CitationSchema, StructureSchema } from "../src/ingredient.ts";
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
