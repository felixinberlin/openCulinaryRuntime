import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  FLAVOR_COUNTERBALANCES,
  FlavorCounterbalanceSchema,
  counterbalancesInvolving,
  dilutionVolumeToTarget,
} from "../src/flavor-balance.ts";

describe("FLAVOR_COUNTERBALANCES", () => {
  test("every entry is schema-valid and has a real citation", () => {
    for (const entry of FLAVOR_COUNTERBALANCES) {
      assert.doesNotThrow(() => FlavorCounterbalanceSchema.parse(entry));
      assert.ok(entry.citation.source.length > 0);
    }
  });

  test("ids are unique", () => {
    const ids = FLAVOR_COUNTERBALANCES.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test("the two peer-reviewed pairs (sweet/sour, salt/bitter) are cited at standard_reference confidence; the weaker acid/richness pair is not", () => {
    const sweetSour = FLAVOR_COUNTERBALANCES.find((e) => e.id === "sweet_sour_mutual")!;
    const saltBitter = FLAVOR_COUNTERBALANCES.find((e) => e.id === "salt_suppresses_bitter")!;
    const acidRichness = FLAVOR_COUNTERBALANCES.find((e) => e.id === "acid_cuts_richness")!;
    assert.equal(sweetSour.citation.confidence, "standard_reference");
    assert.equal(saltBitter.citation.confidence, "standard_reference");
    assert.equal(acidRichness.citation.confidence, "commonly_cited_unverified");
  });

  test("the salt/bitter pair honestly records its real limit (compound-dependent, not universal)", () => {
    const saltBitter = FLAVOR_COUNTERBALANCES.find((e) => e.id === "salt_suppresses_bitter")!;
    assert.ok(saltBitter.realWorldCaveat && saltBitter.realWorldCaveat.length > 0);
  });
});

describe("counterbalancesInvolving", () => {
  test("finds a pair regardless of which side of it is queried", () => {
    const bySuppressed = counterbalancesInvolving("bitter");
    const byAgent = counterbalancesInvolving("salty");
    assert.equal(bySuppressed.length, 1);
    assert.ok(byAgent.some((e) => e.id === "salt_suppresses_bitter"));
  });

  test("the mutual sweet/sour pair is found from EITHER taste", () => {
    const fromSour = counterbalancesInvolving("sour");
    const fromSweet = counterbalancesInvolving("sweet");
    assert.ok(fromSour.some((e) => e.id === "sweet_sour_mutual"));
    assert.ok(fromSweet.some((e) => e.id === "sweet_sour_mutual"));
  });

  test("'richness' — the one non-basic-taste PerceptualTarget — is queryable like any other", () => {
    const pairs = counterbalancesInvolving("richness");
    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].id, "acid_cuts_richness");
  });

  test("a taste with no modeled pair returns an honest empty array, not an error", () => {
    assert.deepEqual(counterbalancesInvolving("umami"), []);
    assert.deepEqual(counterbalancesInvolving("neutral"), []);
  });
});

// dilutionVolumeToTarget — 2026-08-16, PAPER_NOTES_2608.04768.md TICKET 3.
describe("dilutionVolumeToTarget", () => {
  test("exact-target no-op: already at targetConc requires zero diluent", () => {
    assert.equal(dilutionVolumeToTarget(1, 10, 10), 0);
  });

  test("2x overshoot -> equal volume of diluent added (halves the concentration)", () => {
    // 1L at concentration 10, target 5 (half): by conservation of solute,
    // 10 units of solute in 1L must end up at 5 units/L -> 2L total -> 1L
    // of diluent added. A direct hand-check of the formula, not just "some
    // number came back".
    assert.equal(dilutionVolumeToTarget(1, 10, 5), 1);
  });

  test("already below target -> 0, not a negative volume", () => {
    assert.equal(dilutionVolumeToTarget(1, 3, 10), 0);
  });

  test("a real numeric case: 4x overshoot needs 3x the current volume in diluent", () => {
    assert.equal(dilutionVolumeToTarget(2, 20, 5), 6); // 2 * (20/5 - 1) = 2*3 = 6
  });

  test("guards: non-positive currentVolume, negative currentConc, non-positive targetConc all throw", () => {
    assert.throws(() => dilutionVolumeToTarget(0, 10, 5));
    assert.throws(() => dilutionVolumeToTarget(-1, 10, 5));
    assert.throws(() => dilutionVolumeToTarget(1, -1, 5));
    assert.throws(() => dilutionVolumeToTarget(1, 10, 0));
    assert.throws(() => dilutionVolumeToTarget(1, 10, -5));
  });
});
