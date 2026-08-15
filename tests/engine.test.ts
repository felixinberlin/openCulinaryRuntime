import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";
import { makeEntity, makeAction, makeCcp } from "./helpers.ts";

const NO_TOOLS = new Set<string>();
const NO_INGREDIENTS = new Set<string>();
const NO_CCPS = new Map();

describe("applyAction — preconditions", () => {
  test("throws for an instance whose entity id isn't registered", () => {
    const action = makeAction({ id: "peel", requiredTargetCapability: "isPeelable" });
    const instance: Instance = { entityId: "ghost", state: "raw", tags: [] };
    assert.throws(
      () => applyAction(instance, action, new Map(), NO_TOOLS),
      /Unknown entity "ghost"/
    );
  });

  test("throws when the entity kind isn't a valid target for the action", () => {
    const knife = makeEntity({ id: "knife", kind: "tool" });
    const action = makeAction({ id: "peel", validTargetKinds: ["ingredient"] });
    const entities = new Map([["knife", knife]]);
    assert.throws(
      () => applyAction({ entityId: "knife", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /cannot target entity kind "tool"/
    );
  });

  test("enforces per-action statePrerequisites", () => {
    const potato = makeEntity({
      id: "potato",
      statePrerequisites: { cut: "peeled" },
    });
    const action = makeAction({ id: "cut", outputs: { transformedState: "diced" } });
    const entities = new Map([["potato", potato]]);

    assert.throws(
      () => applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /requires "potato" to already be "peeled"/
    );

    const result = applyAction({ entityId: "potato", state: "peeled", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(result.instance.state, "diced");
  });

  test("statePrerequisites accepts an array of acceptable prior states (added 2026-08-13 for skin-on cuts)", () => {
    const potato = makeEntity({
      id: "potato",
      statePrerequisites: { cut: ["washed", "peeled"] },
    });
    const action = makeAction({ id: "cut", outputs: { transformedState: "diced" } });
    const entities = new Map([["potato", potato]]);

    // Neither listed state is required exclusively — either satisfies it.
    const fromWashed = applyAction({ entityId: "potato", state: "washed", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(fromWashed.instance.state, "diced");
    const fromPeeled = applyAction({ entityId: "potato", state: "peeled", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(fromPeeled.instance.state, "diced");

    // A state outside the set is still rejected, and the error names both options.
    assert.throws(
      () => applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /requires "potato" to already be "washed" or "peeled"/
    );
  });

  test("statePrerequisites entries also match a TAG, not just state (added 2026-08-15 — 'washed' is now a tag, not a state)", () => {
    const potato = makeEntity({
      id: "potato",
      statePrerequisites: { cut: ["washed", "peeled"] },
    });
    const action = makeAction({ id: "cut", outputs: { transformedState: "diced" } });
    const entities = new Map([["potato", potato]]);

    // "peeled" as a real STATE still satisfies it (unchanged behavior).
    const fromPeeledState = applyAction({ entityId: "potato", state: "peeled", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(fromPeeledState.instance.state, "diced");

    // "washed" as a TAG — not the state — now satisfies it too: a raw,
    // unpeeled potato that has been washed can be cut (skin-on), the exact
    // real case that forced this. This is the whole point of the fix: a
    // potato instance can carry "washed" as a fact independent of whatever
    // its current state is.
    const fromWashedTag = applyAction({ entityId: "potato", state: "raw", tags: ["washed"] }, action, entities, NO_TOOLS);
    assert.equal(fromWashedTag.instance.state, "diced");

    // Neither the state nor a tag satisfies it — still rejected, and the
    // rejection message now also names the current tags for debuggability.
    assert.throws(
      () => applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /requires "potato" to already be "washed" or "peeled" \(currently "raw", tags \[\]\)/
    );
  });

  test("wash's real fix: washing survives a later PEEL, unlike the old transformedState modeling", () => {
    // The actual bug the 2026-08-15 fix addresses: WASH used to set
    // outputs.transformedState (a mutually-exclusive state), so peeling
    // AFTER washing silently lost the fact the potato had ever been
    // washed. WASH now sets a tag (wash.json's outputs.addsTag) — applied
    // directly here via applyAction with a WASH-shaped action, exactly
    // like recipe-runner.ts would, rather than hand-constructing the tag.
    const potato = makeEntity({
      id: "potato",
      statePrerequisites: { cut: ["washed", "peeled"] },
      capabilities: { isWashable: true, isPeelable: true },
    });
    const wash = makeAction({ id: "wash", requiredTargetCapability: "isWashable", outputs: { addsTag: "washed" } });
    const peel = makeAction({ id: "peel", requiredTargetCapability: "isPeelable", outputs: { transformedState: "peeled" } });
    const cut = makeAction({ id: "cut", outputs: { transformedState: "diced" } });
    const entities = new Map([["potato", potato]]);

    let instance: Instance = { entityId: "potato", state: "raw", tags: [] };
    instance = applyAction(instance, wash, entities, NO_TOOLS).instance;
    assert.deepEqual(instance, { entityId: "potato", state: "raw", tags: ["washed"] });

    instance = applyAction(instance, peel, entities, NO_TOOLS).instance;
    // The real fix, made concrete: state changed to "peeled", but the
    // "washed" tag survived — under the old transformedState modeling,
    // this instance's state would have become "peeled" with NO trace it
    // had ever been washed.
    assert.deepEqual(instance, { entityId: "potato", state: "peeled", tags: ["washed"] });

    // Washing AGAIN after peeling — the user's literal ask ("I wash before
    // and after if I want to") — is legal and a harmless no-op (addsTag's
    // existing duplicate guard), not an error and not a double effect.
    instance = applyAction(instance, wash, entities, NO_TOOLS).instance;
    assert.deepEqual(instance, { entityId: "potato", state: "peeled", tags: ["washed"] });

    // CUT still works — satisfied via the real "peeled" state this time.
    instance = applyAction(instance, cut, entities, NO_TOOLS).instance;
    assert.equal(instance.state, "diced");
  });

  test("requiredTargetCapability: missing vs. explicit false both block, distinguishably", () => {
    const unasserted = makeEntity({ id: "rock" });
    const denied = makeEntity({ id: "bone", capabilities: { isPeelable: false } });
    const action = makeAction({ id: "peel", requiredTargetCapability: "isPeelable" });
    const entities = new Map([
      ["rock", unasserted],
      ["bone", denied],
    ]);

    assert.throws(
      () => applyAction({ entityId: "rock", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /but it is unasserted/
    );
    assert.throws(
      () => applyAction({ entityId: "bone", state: "raw", tags: [] }, action, entities, NO_TOOLS),
      /but it is explicitly false/
    );
  });

  test("requiredTools: throws when a required tool isn't on hand, passes when it is", () => {
    const potato = makeEntity({ id: "potato" });
    const action = makeAction({ id: "peel", requiredTools: ["peeler"] });
    const entities = new Map([["potato", potato]]);
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS),
      /requires tool "peeler"/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, new Set(["peeler"])));
  });

  test("requiredIngredientCapabilities checks presence of ANY qualifying ingredient, not a specific one", () => {
    const potato = makeEntity({ id: "potato" });
    const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });
    const water = makeEntity({ id: "water", capabilities: { isFryingMedium: false } });
    const action = makeAction({ id: "fry", requiredIngredientCapabilities: ["isFryingMedium"] });
    const entities = new Map([
      ["potato", potato],
      ["oil", oil],
      ["water", water],
    ]);
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, {}, new Set(["water"])),
      /requires an available ingredient with capability "isFryingMedium"/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS, {}, new Set(["water", "oil"])));
  });

  test("requiredToolCapabilities checks ANY available tool asserting the capability, not one hardcoded id — the pot-vs-pan case", () => {
    const egg = makeEntity({ id: "egg" });
    const pot = makeEntity({ id: "pot", kind: "tool", capabilities: { isDeepVessel: true } });
    const pan = makeEntity({ id: "pan", kind: "tool", capabilities: { isDeepVessel: false } });
    const saucepan = makeEntity({ id: "saucepan", kind: "tool", capabilities: { isDeepVessel: true } });
    const action = makeAction({ id: "boil", requiredToolCapabilities: ["isDeepVessel"] });
    const entities = new Map([
      ["egg", egg],
      ["pot", pot],
      ["pan", pan],
      ["saucepan", saucepan],
    ]);
    const instance: Instance = { entityId: "egg", state: "raw", tags: [] };

    // Only a pan on hand — no substitute exists for it, correctly rejected.
    assert.throws(
      () => applyAction(instance, action, entities, new Set(["pan"])),
      /requires an available tool with capability "isDeepVessel"/
    );
    // A pot works...
    assert.doesNotThrow(() => applyAction(instance, action, entities, new Set(["pot"])));
    // ...and so does a completely different tool id asserting the same capability —
    // the actual point: substitutable by capability, not hardcoded to "pot".
    assert.doesNotThrow(() => applyAction(instance, action, entities, new Set(["saucepan"])));
  });

  test("requiredTools and requiredToolCapabilities combine with AND semantics when an action declares both", () => {
    const egg = makeEntity({ id: "egg" });
    const pot = makeEntity({ id: "pot", kind: "tool", capabilities: { isDeepVessel: true } });
    const thermometer = makeEntity({ id: "thermometer", kind: "tool" });
    const action = makeAction({
      id: "boil",
      requiredTools: ["thermometer"],
      requiredToolCapabilities: ["isDeepVessel"],
    });
    const entities = new Map([
      ["egg", egg],
      ["pot", pot],
      ["thermometer", thermometer],
    ]);
    const instance: Instance = { entityId: "egg", state: "raw", tags: [] };

    // Capability satisfied, but the specific required tool is missing.
    assert.throws(
      () => applyAction(instance, action, entities, new Set(["pot"])),
      /requires tool "thermometer"/
    );
    // Specific tool present, but no available tool satisfies the capability.
    assert.throws(
      () => applyAction(instance, action, entities, new Set(["thermometer"])),
      /requires an available tool with capability "isDeepVessel"/
    );
    // Both present — passes.
    assert.doesNotThrow(() => applyAction(instance, action, entities, new Set(["pot", "thermometer"])));
  });
});

describe("applyAction — parameters", () => {
  const entities = new Map([["potato", makeEntity({ id: "potato" })]]);
  const instance: Instance = { entityId: "potato", state: "raw", tags: [] };

  test("required allowedValues parameter: missing throws, invalid value throws, valid value passes", () => {
    const action = makeAction({
      id: "cut",
      parameters: [{ id: "shape", required: true, allowedValues: ["diced", "sliced"] }],
      outputs: { transformedStateFromParameter: "shape" },
    });

    assert.throws(() => applyAction(instance, action, entities, NO_TOOLS), /requires a "shape" parameter/);
    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { shape: "julienned" }),
      /only diced, sliced are valid/
    );
    const result = applyAction(instance, action, entities, NO_TOOLS, { shape: "diced" });
    assert.equal(result.instance.state, "diced");
  });

  test("numericRange parameter: out-of-bounds and non-numeric both throw, in-range passes", () => {
    const action = makeAction({
      id: "fry",
      parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 1, max: 600 } }],
      outputs: { transformedState: "fried" },
    });

    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "9999" }),
      /expected a number between 1 and 600/
    );
    assert.throws(
      () => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "not-a-number" }),
      /expected a number between 1 and 600/
    );
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS, { durationSeconds: "30" }));
  });

  test("an optional parameter that's simply absent doesn't throw", () => {
    const action = makeAction({
      id: "fry",
      parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 1, max: 600 } }],
      outputs: { transformedState: "fried" },
    });
    assert.doesNotThrow(() => applyAction(instance, action, entities, NO_TOOLS));
  });
});

describe("applyAction — outputs & conservation of mass", () => {
  test("addsTag is idempotent — re-running doesn't duplicate the tag", () => {
    const potato = makeEntity({ id: "potato", possibleTags: ["salted"] });
    const action = makeAction({ id: "salt", outputs: { addsTag: "salted" } });
    const entities = new Map([["potato", potato]]);

    const once = applyAction({ entityId: "potato", state: "raw", tags: [] }, action, entities, NO_TOOLS);
    assert.deepEqual(once.instance.tags, ["salted"]);

    const twice = applyAction(once.instance, action, entities, NO_TOOLS);
    assert.deepEqual(twice.instance.tags, ["salted"]);
  });

  test("spawnsTargetByproducts prefers byproductsByAction[action.id] over the flat producedByproducts fallback", () => {
    const egg = makeEntity({
      id: "egg",
      producedByproducts: ["egg_shell"],
      byproductsByAction: { separate: ["egg_shell", "egg_yolk", "egg_white"] },
    });
    const eggShell = makeEntity({ id: "egg_shell", possibleStates: ["raw"] });
    const eggYolk = makeEntity({ id: "egg_yolk", possibleStates: ["raw"] });
    const eggWhite = makeEntity({ id: "egg_white", possibleStates: ["raw"] });
    const entities = new Map([
      ["egg", egg],
      ["egg_shell", eggShell],
      ["egg_yolk", eggYolk],
      ["egg_white", eggWhite],
    ]);

    const peel = makeAction({ id: "peel", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });
    const peeled = applyAction({ entityId: "egg", state: "boiled", tags: [] }, peel, entities, NO_TOOLS);
    assert.deepEqual(
      peeled.spawned.map((s) => s.entityId),
      ["egg_shell"],
      "PEEL should fall back to producedByproducts, not the separate-specific override"
    );

    const separate = makeAction({ id: "separate", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });
    const separated = applyAction({ entityId: "egg", state: "raw", tags: [] }, separate, entities, NO_TOOLS);
    assert.deepEqual(
      separated.spawned.map((s) => s.entityId),
      ["egg_shell", "egg_yolk", "egg_white"]
    );
  });

  test("spawned byproducts inherit the parent's tags, filtered against the byproduct's own possibleTags", () => {
    const egg = makeEntity({ id: "egg", producedByproducts: ["egg_yolk", "egg_shell"] });
    // egg_yolk can carry "pasteurized" onward; egg_shell can't (not a
    // meaningful concept for a shell) — the filter must drop it there.
    const eggYolk = makeEntity({ id: "egg_yolk", possibleStates: ["raw"], possibleTags: ["pasteurized"] });
    const eggShell = makeEntity({ id: "egg_shell", possibleStates: ["raw"], possibleTags: [] });
    const entities = new Map([
      ["egg", egg],
      ["egg_yolk", eggYolk],
      ["egg_shell", eggShell],
    ]);
    const separate = makeAction({ id: "separate", outputs: { spawnsTargetByproducts: true, destroysTarget: true } });

    const result = applyAction(
      { entityId: "egg", state: "raw", tags: ["pasteurized"] },
      separate,
      entities,
      NO_TOOLS
    );
    const yolk = result.spawned.find((s) => s.entityId === "egg_yolk")!;
    const shell = result.spawned.find((s) => s.entityId === "egg_shell")!;
    assert.deepEqual(yolk.tags, ["pasteurized"]);
    assert.deepEqual(shell.tags, []);
  });

  test("destroysTarget marks the result destroyed, but still reports the pre-destruction instance for logging", () => {
    const egg = makeEntity({ id: "egg" });
    const entities = new Map([["egg", egg]]);
    const action = makeAction({ id: "crack", outputs: { destroysTarget: true, transformedState: "cracked" } });
    const result = applyAction({ entityId: "egg", state: "raw", tags: [] }, action, entities, NO_TOOLS);
    assert.equal(result.destroyed, true);
    assert.equal(result.instance.state, "cracked");
  });

  test("requiredSecondaryCapability: throws without a secondary instance, and when the secondary lacks the capability", () => {
    const potato = makeEntity({ id: "fried_potato" });
    const eggBad = makeEntity({ id: "flour" }); // no isCombinable
    const eggGood = makeEntity({ id: "beaten_egg", capabilities: { isCombinable: true } });
    const entities = new Map([
      ["fried_potato", potato],
      ["flour", eggBad],
      ["beaten_egg", eggGood],
    ]);
    const action = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "tortilla_mixture" },
    });
    const target: Instance = { entityId: "fried_potato", state: "fried", tags: [] };

    assert.throws(
      () => applyAction(target, action, entities, NO_TOOLS),
      /requires a secondary instance/
    );
    assert.throws(
      () =>
        applyAction(target, action, entities, NO_TOOLS, {}, NO_INGREDIENTS, NO_CCPS, undefined, {
          entityId: "flour",
          state: "raw",
          tags: [],
        }),
      /requires secondary capability "isCombinable"/
    );
  });

  test("combinesInto merges tags from BOTH instances (filtered), destroys both, spawns exactly one new instance", () => {
    const potato = makeEntity({ id: "fried_potato", possibleTags: ["salted"] });
    const egg = makeEntity({ id: "beaten_egg", capabilities: { isCombinable: true }, possibleTags: ["salted"] });
    const mixture = makeEntity({
      id: "tortilla_mixture",
      possibleStates: ["combined"],
      possibleTags: ["salted"],
    });
    const entities = new Map([
      ["fried_potato", potato],
      ["beaten_egg", egg],
      ["tortilla_mixture", mixture],
    ]);
    const action = makeAction({
      id: "combine",
      requiredSecondaryCapability: "isCombinable",
      outputs: { combinesInto: "tortilla_mixture" },
    });

    const result = applyAction(
      { entityId: "fried_potato", state: "fried", tags: ["salted"] },
      action,
      entities,
      NO_TOOLS,
      {},
      NO_INGREDIENTS,
      NO_CCPS,
      undefined,
      { entityId: "beaten_egg", state: "beaten", tags: [] }
    );

    assert.equal(result.destroyed, true);
    assert.equal(result.secondaryDestroyed, true);
    assert.equal(result.spawned.length, 1);
    assert.equal(result.spawned[0].entityId, "tortilla_mixture");
    assert.equal(result.spawned[0].state, "combined");
    assert.deepEqual(result.spawned[0].tags, ["salted"]);
  });
});

describe("applyAction — HACCP / CCP enforcement", () => {
  const eggEntity = makeEntity({ id: "egg_cracked", criticalControlPointsByAction: { fry: "egg_cooking" } });
  const entities = new Map([["egg_cracked", eggEntity]]);
  const fry = makeAction({
    id: "fry",
    parameters: [{ id: "durationSeconds", required: false, numericRange: { unit: "s", min: 0, max: 6000 } }],
    outputs: { transformedState: "fried" },
  });
  const instance: Instance = { entityId: "egg_cracked", state: "raw", tags: [] };

  test("CCP check is gated on durationSeconds being supplied at all", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    // No durationSeconds passed -> zero HACCP behavior, even though this
    // entity/action pair has a CCP wired up.
    const result = applyAction(instance, fry, entities, NO_TOOLS, {}, NO_INGREDIENTS, ccps);
    assert.deepEqual(result.warnings, []);
  });

  test("a non-advisory shortfall is a hard reject regardless of policy", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    assert.throws(
      () => applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "10" }, NO_INGREDIENTS, ccps),
      /is below "egg_cooking"'s minimum hold/
    );
  });

  test("meeting or exceeding the threshold produces no warning and doesn't throw", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    const result = applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "60" }, NO_INGREDIENTS, ccps);
    assert.deepEqual(result.warnings, []);
  });

  test("referencing a CCP id that isn't in the loaded ccps map throws a self-diagnosing error", () => {
    assert.throws(
      () => applyAction(instance, fry, entities, NO_TOOLS, { durationSeconds: "10" }, NO_INGREDIENTS, NO_CCPS),
      /references unknown CriticalControlPoint "egg_cooking".*was ccps not loaded/
    );
  });

  test("a NaN durationSeconds fails closed (throws) instead of silently skipping the check", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: false });
    const ccps = new Map([["egg_cooking", ccp]]);
    // Bypass the numericRange parameter validation (which would itself
    // reject "abc") by targeting an action whose parameters[] doesn't
    // declare durationSeconds at all — isolates the CCP check's OWN guard.
    const undeclaredFry = makeAction({ id: "fry", outputs: { transformedState: "fried" } });
    assert.throws(
      () => applyAction(instance, undeclaredFry, entities, NO_TOOLS, { durationSeconds: "abc" }, NO_INGREDIENTS, ccps),
      /is not a valid number.*refusing to proceed/
    );
  });

  describe("advisoryOnly shortfalls under SafetyPolicy", () => {
    const ccp = makeCcp({ id: "egg_cooking", heldSeconds: 60, advisoryOnly: true });
    const ccps = new Map([["egg_cooking", ccp]]);
    const params = { durationSeconds: "10" };

    test("human mode (default): warns, does not throw", () => {
      const result = applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /is below "egg_cooking"'s minimum hold/);
    });

    test("autonomous mode, no override: hard reject", () => {
      const policy: SafetyPolicy = { mode: "autonomous" };
      assert.throws(
        () => applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy),
        /no human present to accept this risk — rejected by default/
      );
    });

    test("autonomous mode, explicitly overridden for this CCP id: warns, does not throw", () => {
      const policy: SafetyPolicy = { mode: "autonomous", humanOverrides: new Set(["egg_cooking"]) };
      const result = applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy);
      assert.equal(result.warnings.length, 1);
      assert.match(result.warnings[0], /autonomous mode: proceeding on explicit human override/);
    });

    test("autonomous mode, override for a DIFFERENT CCP id: still hard reject", () => {
      const policy: SafetyPolicy = { mode: "autonomous", humanOverrides: new Set(["some_other_ccp"]) };
      assert.throws(
        () => applyAction(instance, fry, entities, NO_TOOLS, params, NO_INGREDIENTS, ccps, policy),
        /rejected by default/
      );
    });
  });

  test("thermalModel + waterTempC computes the required hold time instead of using the fixed heldSeconds anchor", () => {
    // referenceHoldSeconds=1000 @ 57°C, z=10°C -> at 67°C required drops to 100s.
    const ccp = makeCcp({
      id: "egg_cooking",
      heldC: 57,
      heldSeconds: 1000,
      advisoryOnly: false,
      thermalModel: {
        referenceTempC: 57,
        referenceHoldSeconds: 1000,
        zValueC: 10,
        validityCondition: "test fixture",
        source: "test fixture",
      },
    });
    const ccps = new Map([["egg_cooking", ccp]]);
    const poach = makeAction({
      id: "fry",
      parameters: [
        { id: "durationSeconds", required: false, numericRange: { unit: "s", min: 0, max: 6000 } },
        { id: "waterTempC", required: false, numericRange: { unit: "C", min: 0, max: 100 } },
      ],
      outputs: { transformedState: "fried" },
    });

    // 200s at 67°C: below the fixed 1000s anchor, but above the
    // temperature-adjusted 100s requirement -> should PASS, not throw.
    const result = applyAction(
      instance,
      poach,
      entities,
      NO_TOOLS,
      { durationSeconds: "200", waterTempC: "67" },
      NO_INGREDIENTS,
      ccps
    );
    assert.deepEqual(result.warnings, []);

    // Same 200s at the reference temp (57°C) needs the full 1000s -> throws.
    assert.throws(
      () =>
        applyAction(
          instance,
          poach,
          entities,
          NO_TOOLS,
          { durationSeconds: "200", waterTempC: "57" },
          NO_INGREDIENTS,
          ccps
        ),
      /is below "egg_cooking"'s minimum hold/
    );
  });
});
