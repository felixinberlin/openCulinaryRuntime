import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FoodOnCrosswalkEntrySchema,
  FoodOnCrosswalkFileSchema,
  foodOnIriFromCurie,
} from "../src/foodon-crosswalk.ts";

const CITATION = { source: "test fixture", confidence: "commonly_cited_unverified" as const };

describe("FoodOnCrosswalkEntrySchema", () => {
  test("parses a valid entry", () => {
    const result = FoodOnCrosswalkEntrySchema.safeParse({
      curie: "FOODON:03315354",
      iri: "http://purl.obolibrary.org/obo/FOODON_03315354",
      label: "potato",
      citation: CITATION,
    });
    assert.equal(result.success, true);
  });

  test("rejects a curie not in the FOODON:########## shape", () => {
    const result = FoodOnCrosswalkEntrySchema.safeParse({
      curie: "FOODON:123",
      iri: "http://purl.obolibrary.org/obo/FOODON_00000123",
      label: "not a real length",
      citation: CITATION,
    });
    assert.equal(result.success, false);
  });

  test("rejects a curie from a different ontology's namespace", () => {
    const result = FoodOnCrosswalkEntrySchema.safeParse({
      curie: "ENVO:00003064",
      iri: "http://purl.obolibrary.org/obo/ENVO_00003064",
      label: "drinking water",
      citation: CITATION,
    });
    assert.equal(result.success, false);
  });

  test("note is optional", () => {
    const result = FoodOnCrosswalkEntrySchema.safeParse({
      curie: "FOODON:03315354",
      iri: "http://purl.obolibrary.org/obo/FOODON_03315354",
      label: "potato",
      citation: CITATION,
    });
    assert.equal(result.success, true);
  });
});

describe("FoodOnCrosswalkFileSchema", () => {
  test("parses a minimal valid file", () => {
    const result = FoodOnCrosswalkFileSchema.safeParse({
      id: "potato",
      foodOn: {
        curie: "FOODON:03315354",
        iri: "http://purl.obolibrary.org/obo/FOODON_03315354",
        label: "potato",
        citation: CITATION,
      },
    });
    assert.equal(result.success, true);
  });

  test("rejects a missing id", () => {
    const result = FoodOnCrosswalkFileSchema.safeParse({
      foodOn: {
        curie: "FOODON:03315354",
        iri: "http://purl.obolibrary.org/obo/FOODON_03315354",
        label: "potato",
        citation: CITATION,
      },
    });
    assert.equal(result.success, false);
  });
});

describe("foodOnIriFromCurie", () => {
  test("converts a real curie to its PURL form", () => {
    assert.equal(
      foodOnIriFromCurie("FOODON:03315354"),
      "http://purl.obolibrary.org/obo/FOODON_03315354"
    );
  });

  test("throws on a malformed curie rather than guessing", () => {
    assert.throws(() => foodOnIriFromCurie("potato"));
  });

  test("throws on a curie from a different ontology's namespace", () => {
    assert.throws(() => foodOnIriFromCurie("ENVO:00003064"));
  });
});
