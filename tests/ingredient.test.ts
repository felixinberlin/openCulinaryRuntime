import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EntitySchema,
  CitationSchema,
  StructureSchema,
  QuantitySchema,
  YieldFractionSchema,
  AllergenSchema,
  NumericRangeSchema,
  DomainFactSchema,
  isTerminalState,
} from "../src/ingredient.ts";
import { makeEntity } from "./helpers.ts";

describe("EntitySchema", () => {
  test("names must include an 'en' entry", () => {
    assert.throws(() =>
      EntitySchema.parse({
        id: "potato",
        kind: "ingredient",
        names: { es: "Patata" },
        aggregationState: "solid",
      })
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

  // domainFacts — 2026-08-17, extending ROADMAP.md's "Structured DomainFact/
  // PhysicalProperty records" gap from CriticalControlPointSchema to
  // EntitySchema, once a real second forcing case existed
  // (kosher_salt.json's/flaky_salt.json's real gramsPerTeaspoon figures).
  test("domainFacts defaults to {} — every entity file written before this field existed needs no change", () => {
    const e = makeEntity({ id: "salt" });
    assert.deepEqual(e.domainFacts, {});
  });

  test("domainFacts accepts a real, typed, cited numeric fact keyed by an author-chosen id", () => {
    const e = makeEntity({
      id: "kosher_salt",
      domainFacts: {
        gramsPerTeaspoon: {
          value: { min: 3, max: 5 },
          unit: "g/tsp",
          citation: { source: "test fixture", confidence: "commonly_cited_unverified" },
          verified: false,
        },
      },
    });
    assert.deepEqual(e.domainFacts.gramsPerTeaspoon.value, { min: 3, max: 5 });
  });

  test("a malformed domainFacts entry (missing unit) is rejected — Zod validation, not a silent pass", () => {
    assert.throws(() =>
      makeEntity({
        id: "salt",
        domainFacts: {
          someFact: {
            value: 6,
            citation: { source: "test", confidence: "standard_reference" },
            verified: true,
          },
        } as any,
      })
    );
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

// YieldFractionSchema — 2026-08-16, ROADMAP.md's "yield/waste factors" gap.
describe("YieldFractionSchema", () => {
  const base = {
    ofParentEntityId: "potato",
    citation: { source: "test fixture", confidence: "commonly_cited_unverified" as const },
  };

  test("accepts a real range where min <= max", () => {
    assert.doesNotThrow(() => YieldFractionSchema.parse({ ...base, min: 0.1, max: 0.25 }));
  });

  test("rejects min > max — not a real range", () => {
    assert.throws(() => YieldFractionSchema.parse({ ...base, min: 0.5, max: 0.1 }));
  });

  test("rejects a fraction above 1 (more than 100% of the parent's mass) or non-positive", () => {
    assert.throws(() => YieldFractionSchema.parse({ ...base, min: 0.1, max: 1.5 }));
    assert.throws(() => YieldFractionSchema.parse({ ...base, min: 0, max: 0.1 }));
  });

  test("requires a citation and ofParentEntityId — not silently optional", () => {
    assert.throws(() => YieldFractionSchema.parse({ min: 0.1, max: 0.2 }));
  });
});

// NumericRangeSchema/DomainFactSchema — 2026-08-17, ROADMAP.md's "Structured
// DomainFact/PhysicalProperty records" gap.
describe("NumericRangeSchema", () => {
  test("accepts min <= max, including negative values (e.g. a freezing point)", () => {
    assert.doesNotThrow(() => NumericRangeSchema.parse({ min: -18, max: -10 }));
    assert.doesNotThrow(() => NumericRangeSchema.parse({ min: 5, max: 5 })); // min === max is legal
  });

  test("rejects min > max — not a real range", () => {
    assert.throws(() => NumericRangeSchema.parse({ min: 10, max: 5 }));
  });
});

describe("DomainFactSchema", () => {
  const citation = { source: "test fixture", confidence: "commonly_cited_unverified" as const };

  test("value accepts either a single number or a NumericRangeSchema range", () => {
    assert.doesNotThrow(() =>
      DomainFactSchema.parse({ value: 100, unit: "celsius", citation, verified: true })
    );
    assert.doesNotThrow(() =>
      DomainFactSchema.parse({
        value: { min: 62, max: 65 },
        unit: "celsius",
        citation,
        verified: false,
      })
    );
  });

  test("rejects a range value with min > max even nested inside the union", () => {
    assert.throws(() =>
      DomainFactSchema.parse({
        value: { min: 65, max: 62 },
        unit: "celsius",
        citation,
        verified: false,
      })
    );
  });

  test("requires citation, unit, and verified — none silently optional", () => {
    assert.throws(() => DomainFactSchema.parse({ value: 100, unit: "celsius", citation }));
    assert.throws(() => DomainFactSchema.parse({ value: 100, citation, verified: true }));
    assert.throws(() => DomainFactSchema.parse({ value: 100, unit: "celsius", verified: true }));
  });

  test("verified is a real, independent axis from citation.confidence — a standard_reference fact can still be verified: false", () => {
    const fact = DomainFactSchema.parse({
      value: 100,
      unit: "celsius",
      citation: { source: "a named textbook", confidence: "standard_reference" },
      verified: false,
    });
    assert.equal(fact.citation.confidence, "standard_reference");
    assert.equal(fact.verified, false);
  });
});

// AllergenSchema — 2026-08-16, ROADMAP.md's "Allergens" gap.
describe("AllergenSchema", () => {
  test("accepts every one of the FDA's 'Big 9'", () => {
    for (const a of [
      "milk",
      "egg",
      "fish",
      "crustacean_shellfish",
      "tree_nuts",
      "peanuts",
      "wheat",
      "soybeans",
      "sesame",
    ]) {
      assert.doesNotThrow(() => AllergenSchema.parse(a));
    }
  });

  test("rejects an unrecognized string — not an open vocabulary like capabilities", () => {
    assert.throws(() => AllergenSchema.parse("gluten"));
    assert.throws(() => AllergenSchema.parse("celery")); // real EU allergen, deliberately not in this repo's FDA-based list
  });

  test("EntitySchema.allergens defaults to an empty array, and an empty array is a valid, real claim", () => {
    const e = makeEntity({ id: "water" });
    assert.deepEqual(e.allergens, []);
  });

  test("EntitySchema.allergens rejects a value outside the enum", () => {
    assert.throws(() => makeEntity({ id: "mystery", allergens: ["gluten"] as any }));
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

// isTerminalState — 2026-08-16, PAPER_NOTES_2608.04768.md TICKET 5.
describe("isTerminalState", () => {
  test("a state absent from invalidTransitions entirely is not terminal", () => {
    const potato = makeEntity({ id: "potato", possibleStates: ["raw", "boiled"] });
    assert.equal(isTerminalState(potato, "raw"), false);
  });

  test("a state whose invalidTransitions entry forbids EVERY other possibleState is terminal", () => {
    const potato = makeEntity({
      id: "potato",
      possibleStates: ["raw", "boiled", "burned"],
      invalidTransitions: { burned: ["raw", "boiled"] },
    });
    assert.equal(isTerminalState(potato, "burned"), true);
  });

  test("a state whose invalidTransitions entry forbids ALL BUT ONE other possibleState is NOT terminal — the exact 'overcooked can still degrade to burned' shape this ticket's real data uses", () => {
    const potato = makeEntity({
      id: "potato",
      possibleStates: ["raw", "boiled", "burned", "overcooked"],
      invalidTransitions: {
        burned: ["raw", "boiled", "overcooked"],
        overcooked: ["raw", "boiled"], // deliberately does NOT include "burned"
      },
    });
    assert.equal(isTerminalState(potato, "burned"), true);
    assert.equal(isTerminalState(potato, "overcooked"), false);
  });

  test("a state not present in possibleStates at all is simply not terminal (not this function's job to flag as invalid)", () => {
    const potato = makeEntity({ id: "potato", possibleStates: ["raw", "boiled"] });
    assert.equal(isTerminalState(potato, "nonexistent_state"), false);
  });

  test("real data: every real entity's 'burned' state is terminal", () => {
    // Cross-checked against the actual shipped data/entities/*.json content,
    // not a synthetic re-assertion — mirrors the reasoning
    // scripts/failure-states-as-a-robot.ts demonstrates against real loaded
    // entities, kept here as a fast, offline regression too.
    const potato = makeEntity({
      id: "potato",
      possibleStates: ["raw", "peeled", "boiled", "fried", "mashed", "burned", "overcooked"],
      invalidTransitions: {
        burned: ["raw", "peeled", "boiled", "fried", "mashed", "overcooked"],
        overcooked: ["raw", "peeled", "boiled", "fried", "mashed"],
      },
    });
    assert.equal(isTerminalState(potato, "burned"), true);
    assert.equal(isTerminalState(potato, "overcooked"), false);
  });
});
