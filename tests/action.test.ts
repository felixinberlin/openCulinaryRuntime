import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { ActionParameterSchema, ActionOutputsSchema, ActionSchema } from "../src/action.ts";

describe("ActionParameterSchema", () => {
  test("exactly one of allowedValues/numericRange is required", () => {
    assert.throws(() => ActionParameterSchema.parse({ id: "shape" }));
    assert.throws(() =>
      ActionParameterSchema.parse({
        id: "shape",
        allowedValues: ["diced"],
        numericRange: { unit: "s", min: 0, max: 1 },
      })
    );
    assert.doesNotThrow(() =>
      ActionParameterSchema.parse({ id: "shape", allowedValues: ["diced"] })
    );
    assert.doesNotThrow(() =>
      ActionParameterSchema.parse({
        id: "durationSeconds",
        numericRange: { unit: "s", min: 0, max: 1 },
      })
    );
  });

  test("required defaults to true", () => {
    const p = ActionParameterSchema.parse({ id: "shape", allowedValues: ["diced"] });
    assert.equal(p.required, true);
  });
});

describe("ActionOutputsSchema", () => {
  test("transformedState and transformedStateFromParameter are mutually exclusive", () => {
    assert.throws(() =>
      ActionOutputsSchema.parse({
        transformedState: "peeled",
        transformedStateFromParameter: "shape",
      })
    );
    assert.doesNotThrow(() => ActionOutputsSchema.parse({ transformedState: "peeled" }));
    assert.doesNotThrow(() =>
      ActionOutputsSchema.parse({ transformedStateFromParameter: "shape" })
    );
  });

  test("combinesInto is mutually exclusive with transformedState/transformedStateFromParameter", () => {
    assert.throws(() =>
      ActionOutputsSchema.parse({ combinesInto: "tortilla_mixture", transformedState: "combined" })
    );
    assert.throws(() =>
      ActionOutputsSchema.parse({
        combinesInto: "tortilla_mixture",
        transformedStateFromParameter: "shape",
      })
    );
    assert.doesNotThrow(() => ActionOutputsSchema.parse({ combinesInto: "tortilla_mixture" }));
  });

  test("spawnsTargetByproducts and destroysTarget default false", () => {
    const o = ActionOutputsSchema.parse({});
    assert.equal(o.spawnsTargetByproducts, false);
    assert.equal(o.destroysTarget, false);
  });
});

describe("ActionSchema", () => {
  const base = { id: "peel", verb: "PEEL", outputs: {} };

  test("names must include an 'en' entry", () => {
    assert.throws(() => ActionSchema.parse({ ...base, names: { es: "Pelar" } }));
    assert.doesNotThrow(() => ActionSchema.parse({ ...base, names: { en: "Peel" } }));
  });

  test("requiredTools/requiredIngredientCapabilities/parameters/hazards default to empty arrays", () => {
    const a = ActionSchema.parse({ ...base, names: { en: "Peel" } });
    assert.deepEqual(a.requiredTools, []);
    assert.deepEqual(a.requiredIngredientCapabilities, []);
    assert.deepEqual(a.parameters, []);
    assert.deepEqual(a.hazards, []);
    assert.deepEqual(a.validTargetKinds, ["ingredient"]);
  });

  // actionKind — 2026-08-16, PAPER_NOTES_2608.04768.md TICKET 1.
  test("actionKind is optional and undefined by default — a missing value means 'not yet audited', not a silent default", () => {
    const a = ActionSchema.parse({ ...base, names: { en: "Peel" } });
    assert.equal(a.actionKind, undefined);
  });

  test("actionKind accepts 'instantaneous' or 'continuous', rejects anything else", () => {
    assert.doesNotThrow(() =>
      ActionSchema.parse({ ...base, names: { en: "Peel" }, actionKind: "instantaneous" })
    );
    assert.doesNotThrow(() =>
      ActionSchema.parse({ ...base, names: { en: "Peel" }, actionKind: "continuous" })
    );
    assert.throws(() =>
      ActionSchema.parse({ ...base, names: { en: "Peel" }, actionKind: "variable" })
    );
  });
});
