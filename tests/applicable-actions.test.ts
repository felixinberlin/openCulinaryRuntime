import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { makeEntity, makeAction } from "./helpers.ts";
import { listApplicableActions } from "../src/applicable-actions.ts";
import type { Instance } from "../src/engine.ts";

/**
 * Synthetic-fixture coverage, same convention as recipe-player.test.ts —
 * a small potato/knife/oil/onion vocabulary rather than real data/*.json,
 * so each test exercises listApplicableActions's own logic (dry-running
 * applyAction per candidate and reporting why not), not the real
 * vocabulary already covered by scripts/*-as-a-robot.ts capability tests.
 */

const potato = makeEntity({
  id: "potato",
  possibleStates: ["raw", "peeled", "chopped"],
  allowedTransformations: ["peel", "chop", "fry", "combine"],
  statePrerequisites: { chop: "peeled" },
  capabilities: { isPeelable: true, isChoppable: true, isFryable: true },
});
const onion = makeEntity({
  id: "onion",
  possibleStates: ["raw"],
  allowedTransformations: [],
  capabilities: { isSeasonable: true },
});
const oil = makeEntity({ id: "oil", capabilities: { isFryingMedium: true } });

const peel = makeAction({
  id: "peel",
  requiredTargetCapability: "isPeelable",
  outputs: { transformedState: "peeled" },
});
const chop = makeAction({
  id: "chop",
  requiredTargetCapability: "isChoppable",
  requiredTools: ["chef-knife"],
  outputs: { transformedState: "chopped" },
});
const fry = makeAction({
  id: "fry",
  requiredTargetCapability: "isFryable",
  requiredIngredientCapabilities: ["isFryingMedium"],
  outputs: { transformedState: "fried" },
});
const combine = makeAction({
  id: "combine",
  requiredTargetCapability: "isPeelable",
  requiredSecondaryCapability: "isSeasonable",
  outputs: { combinesInto: "potato_onion_mix" },
});

const entities = new Map([
  ["potato", potato],
  ["onion", onion],
  ["oil", oil],
]);
const actions = new Map([
  ["peel", peel],
  ["chop", chop],
  ["fry", fry],
  ["combine", combine],
]);

describe("listApplicableActions", () => {
  test("a raw potato can PEEL, cannot yet CHOP (state prerequisite), can FRY (oil on hand), and COMBINE needs a secondary", () => {
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };
    const results = listApplicableActions(
      instance,
      entities,
      actions,
      new Set(["chef-knife"]),
      new Set(["oil"])
    );
    const byId = new Map(results.map((r) => [r.actionId, r]));

    assert.equal(byId.get("peel")?.applicable, true);

    assert.equal(byId.get("chop")?.applicable, false);
    assert.match(byId.get("chop")!.reason!, /state|prerequisite|chopped|peeled/i);

    assert.equal(byId.get("fry")?.applicable, true);

    assert.equal(byId.get("combine")?.requiresSecondaryInstance, true);
    assert.equal(byId.get("combine")?.applicable, false);
    assert.match(byId.get("combine")!.reason!, /second instance/i);
  });

  test("CHOP is blocked when the required tool is missing", () => {
    const instance: Instance = { entityId: "potato", state: "peeled", tags: [] };
    const results = listApplicableActions(instance, entities, actions, new Set());
    const chopResult = results.find((r) => r.actionId === "chop");
    assert.equal(chopResult?.applicable, false);
    assert.ok(chopResult?.reason);
  });

  test("CHOP becomes applicable once peeled and the required tool is available", () => {
    const instance: Instance = { entityId: "potato", state: "peeled", tags: [] };
    const results = listApplicableActions(instance, entities, actions, new Set(["chef-knife"]));
    assert.equal(results.find((r) => r.actionId === "chop")?.applicable, true);
  });

  test("a COMBINE-shaped action succeeds once a real secondary instance is supplied", () => {
    const instance: Instance = { entityId: "potato", state: "raw", tags: [] };
    const secondary: Instance = { entityId: "onion", state: "raw", tags: [] };
    const results = listApplicableActions(
      instance,
      entities,
      actions,
      new Set(),
      new Set(),
      new Map(),
      undefined,
      secondary
    );
    const combineResult = results.find((r) => r.actionId === "combine");
    assert.equal(combineResult?.requiresSecondaryInstance, true);
    assert.equal(combineResult?.applicable, true);
  });

  test("an unknown entityId throws rather than silently returning an empty list", () => {
    const instance: Instance = { entityId: "does-not-exist", state: "raw", tags: [] };
    assert.throws(() => listApplicableActions(instance, entities, actions, new Set()), /Unknown entity/);
  });
});
