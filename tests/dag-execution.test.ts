import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  resolveStepId,
  deriveDependsOn,
  topologicalOrder,
  scheduleDag,
  scheduleDagFromSteps,
  type DagNode,
} from "../src/dag-scheduler.ts";
import type { RecipeStep } from "../src/recipe.ts";
import { makeAction } from "./helpers.ts";

/**
 * Coverage for src/dag-scheduler.ts (ROADMAP.md's "Recipe execution as a
 * DAG" ticket) — synthetic fixtures, same convention as
 * execution-bounds.test.ts/in-progress-action.test.ts, no data/*.json
 * dependency. Filename matches the ticket's own named acceptance
 * criterion (tests/dag-execution.test.ts) exactly.
 */

function step(
  overrides: Partial<RecipeStep> & { actionId: string; targetInstanceId: string }
): RecipeStep {
  return { params: {}, availableIngredientInstanceIds: [], ...overrides };
}

describe("resolveStepId / deriveDependsOn — id fallback and edge derivation", () => {
  test("resolveStepId falls back to array index when no explicit id is set", () => {
    const s = step({ actionId: "wash", targetInstanceId: "potato-1" });
    assert.equal(resolveStepId(s, 0), "0");
    assert.equal(resolveStepId(s, 3), "3");
  });

  test("an explicit id is used instead of the index", () => {
    const s = step({ id: "wash_potato", actionId: "wash", targetInstanceId: "potato-1" });
    assert.equal(resolveStepId(s, 5), "wash_potato");
  });

  test("no explicit dependsOn anywhere: every step auto-depends on the immediately preceding one (legacy linear import)", () => {
    const sequence = [
      step({ actionId: "wash", targetInstanceId: "potato-1" }),
      step({ actionId: "peel", targetInstanceId: "potato-1" }),
      step({ actionId: "cut", targetInstanceId: "potato-1" }),
    ];
    const edges = deriveDependsOn(sequence);
    assert.deepEqual(edges.get("0"), []);
    assert.deepEqual(edges.get("1"), ["0"]);
    assert.deepEqual(edges.get("2"), ["1"]);
  });

  test("an explicit empty dependsOn: [] means genuinely no prerequisite, not 'unspecified'", () => {
    const sequence = [
      step({ id: "a", actionId: "wash", targetInstanceId: "potato-1" }),
      step({ id: "b", actionId: "peel", targetInstanceId: "garlic-1", dependsOn: [] }),
    ];
    const edges = deriveDependsOn(sequence);
    assert.deepEqual(edges.get("a"), []);
    assert.deepEqual(edges.get("b"), []); // NOT auto-derived to depend on "a"
  });

  test("explicit dependsOn is used as-is, including a real join (two prerequisites)", () => {
    const sequence = [
      step({ id: "a", actionId: "boil", targetInstanceId: "potato-1", dependsOn: [] }),
      step({ id: "b", actionId: "caramelize", targetInstanceId: "onion-1", dependsOn: [] }),
      step({ id: "c", actionId: "combine", targetInstanceId: "potato-1", dependsOn: ["a", "b"] }),
    ];
    const edges = deriveDependsOn(sequence);
    assert.deepEqual(edges.get("c"), ["a", "b"]);
  });
});

describe("topologicalOrder — cycle detection (acceptance criterion)", () => {
  test("an acyclic DAG (garlic-oil-potatoes-shaped: two branches + a join) produces a valid order", () => {
    const sequence = [
      step({ id: "wash_potato", actionId: "wash", targetInstanceId: "potato-1", dependsOn: [] }),
      step({
        id: "peel_potato",
        actionId: "peel",
        targetInstanceId: "potato-1",
        dependsOn: ["wash_potato"],
      }),
      step({ id: "peel_garlic", actionId: "peel", targetInstanceId: "garlic-1", dependsOn: [] }),
      step({
        id: "cut_garlic",
        actionId: "cut",
        targetInstanceId: "garlic-1",
        dependsOn: ["peel_garlic"],
      }),
      step({
        id: "fry_both",
        actionId: "fry",
        targetInstanceId: "potato-1",
        dependsOn: ["peel_potato", "cut_garlic"],
      }),
    ];
    const result = topologicalOrder(sequence);
    assert.ok("order" in result, "expected a valid order, not a cycle");
    const order = (result as { order: string[] }).order;
    assert.equal(order.length, 5);
    // Every dependency must appear before its dependent.
    assert.ok(order.indexOf("wash_potato") < order.indexOf("peel_potato"));
    assert.ok(order.indexOf("peel_potato") < order.indexOf("fry_both"));
    assert.ok(order.indexOf("cut_garlic") < order.indexOf("fry_both"));
  });

  test("a DIRECT cycle (Step A requires Step B, which requires Step A) is caught, not silently accepted", () => {
    const sequence = [
      step({ id: "a", actionId: "boil", targetInstanceId: "x", dependsOn: ["b"] }),
      step({ id: "b", actionId: "fry", targetInstanceId: "x", dependsOn: ["a"] }),
    ];
    const result = topologicalOrder(sequence);
    assert.ok("cycle" in result, "expected a cycle to be detected");
    const cycle = (result as { cycle: string[] }).cycle;
    assert.deepEqual(new Set(cycle), new Set(["a", "b"]));
  });

  test("an INDIRECT, longer cycle (A -> B -> C -> A) is also caught", () => {
    const sequence = [
      step({ id: "a", actionId: "wash", targetInstanceId: "x", dependsOn: ["c"] }),
      step({ id: "b", actionId: "peel", targetInstanceId: "x", dependsOn: ["a"] }),
      step({ id: "c", actionId: "cut", targetInstanceId: "x", dependsOn: ["b"] }),
    ];
    const result = topologicalOrder(sequence);
    assert.ok("cycle" in result);
    assert.deepEqual(new Set((result as { cycle: string[] }).cycle), new Set(["a", "b", "c"]));
  });

  test("a legacy linear recipe (no explicit id/dependsOn anywhere) has zero risk of a cycle and orders exactly as written", () => {
    const sequence = [
      step({ actionId: "wash", targetInstanceId: "potato-1" }),
      step({ actionId: "peel", targetInstanceId: "potato-1" }),
      step({ actionId: "cut", targetInstanceId: "potato-1" }),
    ];
    const result = topologicalOrder(sequence);
    assert.ok("order" in result);
    assert.deepEqual((result as { order: string[] }).order, ["0", "1", "2"]);
  });

  test("a step referencing an unknown dependency id throws a clear error rather than silently dropping it", () => {
    const sequence = [
      step({ id: "a", actionId: "boil", targetInstanceId: "x", dependsOn: ["nonexistent"] }),
    ];
    assert.throws(() => topologicalOrder(sequence), /unknown step id "nonexistent"/);
  });
});

describe("scheduleDag — the exact acceptance-criterion scenario", () => {
  test("10 minutes of passive boiling concurrent with 5 minutes of active chopping executes in exactly 10 simulated minutes, not 15", () => {
    const nodes: DagNode[] = [
      { id: "boil_water", dependsOn: [], durationSeconds: 600, active: false, requiredToolIds: [] },
      { id: "chop_onions", dependsOn: [], durationSeconds: 300, active: true, requiredToolIds: [] },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.totalSeconds, 600); // 10 minutes, NOT 900 (15 minutes)
    assert.equal(schedule.nodes.get("boil_water")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("boil_water")!.finishSeconds, 600);
    assert.equal(schedule.nodes.get("chop_onions")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("chop_onions")!.finishSeconds, 300);
  });

  test("two ACTIVE tasks cannot overlap — the single shared actor resource serializes them", () => {
    const nodes: DagNode[] = [
      { id: "chop_a", dependsOn: [], durationSeconds: 300, active: true, requiredToolIds: [] },
      { id: "chop_b", dependsOn: [], durationSeconds: 300, active: true, requiredToolIds: [] },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.totalSeconds, 600); // serialized: 300 + 300, not max(300,300)
    assert.equal(schedule.nodes.get("chop_a")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("chop_b")!.startSeconds, 300); // waits for the actor to free up
  });

  test("two PASSIVE tasks fully overlap — unlimited passive capacity", () => {
    const nodes: DagNode[] = [
      { id: "boil_a", dependsOn: [], durationSeconds: 600, active: false, requiredToolIds: [] },
      { id: "marinate_b", dependsOn: [], durationSeconds: 900, active: false, requiredToolIds: [] },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.totalSeconds, 900); // max, not sum
    assert.equal(schedule.nodes.get("boil_a")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("marinate_b")!.startSeconds, 0);
  });

  test("join node (Step C 'toss pasta in sauce' waits for BOTH A and B): starts only once the LATER of the two finishes", () => {
    const nodes: DagNode[] = [
      { id: "boil_pasta", dependsOn: [], durationSeconds: 600, active: false, requiredToolIds: [] }, // finishes at 600
      {
        id: "simmer_sauce",
        dependsOn: [],
        durationSeconds: 900,
        active: false,
        requiredToolIds: [],
      }, // finishes at 900
      {
        id: "toss",
        dependsOn: ["boil_pasta", "simmer_sauce"],
        durationSeconds: 60,
        active: true,
        requiredToolIds: [],
      },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.nodes.get("toss")!.startSeconds, 900); // NOT 600 — must wait for the later dependency
    assert.equal(schedule.nodes.get("toss")!.finishSeconds, 960);
    assert.equal(schedule.totalSeconds, 960);
  });

  test("join node correctly does NOT start early even if it's ready before the actor is free from something else", () => {
    const nodes: DagNode[] = [
      { id: "prep", dependsOn: [], durationSeconds: 100, active: true, requiredToolIds: [] }, // actor busy 0-100
      { id: "boil", dependsOn: [], durationSeconds: 50, active: false, requiredToolIds: [] }, // finishes at 50, well before prep
      {
        id: "combine",
        dependsOn: ["prep", "boil"],
        durationSeconds: 30,
        active: true,
        requiredToolIds: [],
      },
    ];
    const schedule = scheduleDag(nodes);
    // combine's readySeconds = max(finish(prep)=100, finish(boil)=50) = 100;
    // actor is free at 100 too (prep just finished) — so combine starts at 100, not 50.
    assert.equal(schedule.nodes.get("combine")!.startSeconds, 100);
  });
});

describe("scheduleDag — tool-lock behavior (WORLD_MODEL_OPTIMIZATION.md's toolLockBehavior, 2026-08-17)", () => {
  test("two otherwise-independent PASSIVE steps sharing the SAME tool cannot overlap — 'can't fry two things in the same pan at once'", () => {
    const nodes: DagNode[] = [
      { id: "fry_a", dependsOn: [], durationSeconds: 300, active: false, requiredToolIds: ["pan"] },
      { id: "fry_b", dependsOn: [], durationSeconds: 300, active: false, requiredToolIds: ["pan"] },
    ];
    const schedule = scheduleDag(nodes);
    // Without the tool lock, two independent passive nodes would fully overlap (see the
    // "two PASSIVE tasks fully overlap" test above) -> totalSeconds would be 300. WITH it,
    // they must serialize on the shared pan: 300 + 300 = 600.
    assert.equal(schedule.totalSeconds, 600);
    assert.equal(schedule.nodes.get("fry_a")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("fry_b")!.startSeconds, 300);
  });

  test("two independent steps using DIFFERENT tools still overlap fully — the lock is per-tool, not global", () => {
    const nodes: DagNode[] = [
      {
        id: "boil_in_pot",
        dependsOn: [],
        durationSeconds: 600,
        active: false,
        requiredToolIds: ["pot"],
      },
      {
        id: "roast_in_oven",
        dependsOn: [],
        durationSeconds: 900,
        active: false,
        requiredToolIds: ["oven"],
      },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.totalSeconds, 900); // max, not sum — genuinely different resources
    assert.equal(schedule.nodes.get("boil_in_pot")!.startSeconds, 0);
    assert.equal(schedule.nodes.get("roast_in_oven")!.startSeconds, 0);
  });

  test("a PASSIVE step still locks its tool even though it never touches the actor constraint", () => {
    const nodes: DagNode[] = [
      {
        id: "boil_passive",
        dependsOn: [],
        durationSeconds: 500,
        active: false,
        requiredToolIds: ["pot"],
      },
      {
        id: "boil_again",
        dependsOn: [],
        durationSeconds: 100,
        active: false,
        requiredToolIds: ["pot"],
      },
    ];
    const schedule = scheduleDag(nodes);
    // Both are passive (never wait on the actor), but the SECOND still can't start until the
    // pot itself frees up — a real, different constraint from the actor one.
    assert.equal(schedule.nodes.get("boil_again")!.startSeconds, 500);
    assert.equal(schedule.totalSeconds, 600);
  });

  test("a node with multiple requiredToolIds waits for ALL of them to be free", () => {
    const nodes: DagNode[] = [
      {
        id: "occupy_pan",
        dependsOn: [],
        durationSeconds: 200,
        active: false,
        requiredToolIds: ["pan"],
      },
      {
        id: "occupy_pot",
        dependsOn: [],
        durationSeconds: 50,
        active: false,
        requiredToolIds: ["pot"],
      },
      {
        id: "needs_both",
        dependsOn: [],
        durationSeconds: 30,
        active: false,
        requiredToolIds: ["pan", "pot"],
      },
    ];
    const schedule = scheduleDag(nodes);
    // needs_both can't start until BOTH the pan (free at 200) and the pot (free at 50) are free.
    assert.equal(schedule.nodes.get("needs_both")!.startSeconds, 200);
  });

  test("empty requiredToolIds (the default) behaves exactly as before this field existed — no regression", () => {
    const nodes: DagNode[] = [
      { id: "a", dependsOn: [], durationSeconds: 600, active: false, requiredToolIds: [] },
      { id: "b", dependsOn: [], durationSeconds: 900, active: false, requiredToolIds: [] },
    ];
    const schedule = scheduleDag(nodes);
    assert.equal(schedule.totalSeconds, 900); // full overlap, same as the no-tool-lock case
  });
});

describe("scheduleDagFromSteps — real RecipeStep/Action integration", () => {
  const boilAction = makeAction({
    id: "boil",
    actionKind: "continuous",
    requiresActiveAttention: false,
    outputs: { transformedState: "boiled" },
  });
  const caramelizeAction = makeAction({
    id: "caramelize",
    actionKind: "continuous",
    requiresActiveAttention: true,
    outputs: { transformedState: "caramelized" },
  });
  const peelAction = makeAction({
    id: "peel",
    actionKind: "instantaneous",
    outputs: { transformedState: "peeled" },
  });
  const fryAction = makeAction({
    id: "fry",
    actionKind: "continuous",
    requiresActiveAttention: true,
    requiredTools: ["pan"],
    outputs: { transformedState: "fried" },
  });
  // PASSIVE and tool-locked — isolates the tool-lock proof below from the
  // (separately already-proven) actor constraint: two genuinely passive
  // steps would otherwise fully overlap (see scheduleDag's own "two
  // PASSIVE tasks fully overlap" test), so if these two instead serialize,
  // requiredToolIds derivation is what's actually responsible for it.
  const simmerAction = makeAction({
    id: "simmer",
    actionKind: "continuous",
    requiresActiveAttention: false,
    requiredTools: ["pot"],
    outputs: { transformedState: "simmered" },
  });
  const actions = new Map([
    ["boil", boilAction],
    ["caramelize", caramelizeAction],
    ["peel", peelAction],
    ["fry", fryAction],
    ["simmer", simmerAction],
  ]);

  test("duration is read from the step's own params.durationSeconds, matching in-progress-action.ts's extraction exactly", () => {
    const sequence = [
      step({
        id: "boil_potato",
        actionId: "boil",
        targetInstanceId: "potato-1",
        params: { durationSeconds: "600" },
        dependsOn: [],
      }),
      step({
        id: "caramelize_onion",
        actionId: "caramelize",
        targetInstanceId: "onion-1",
        params: { durationSeconds: "300" },
        dependsOn: [],
      }),
    ];
    const schedule = scheduleDagFromSteps(sequence, actions);
    assert.equal(schedule.totalSeconds, 600); // passive boil (600s) concurrent with active caramelize (300s)
  });

  test("an instantaneous action (PEEL) is always treated as active, with 0 duration when unparameterized", () => {
    const sequence = [
      step({ id: "peel_potato", actionId: "peel", targetInstanceId: "potato-1", dependsOn: [] }),
    ];
    const schedule = scheduleDagFromSteps(sequence, actions);
    assert.equal(schedule.nodes.get("peel_potato")!.finishSeconds, 0);
  });

  test("an unknown actionId (not in the loaded actions map) defaults to active — the SAFE default, never silently passive", () => {
    const sequence = [
      step({ id: "mystery", actionId: "does_not_exist", targetInstanceId: "x", dependsOn: [] }),
    ];
    // Should not throw — just falls back to active: true, duration: 0.
    const schedule = scheduleDagFromSteps(sequence, actions);
    assert.equal(schedule.nodes.get("mystery")!.finishSeconds, 0);
  });

  test("requiredToolIds is derived from the real action's requiredTools — two independent, PASSIVE steps sharing 'pot' still correctly serialize", () => {
    const sequence = [
      step({
        id: "simmer_a",
        actionId: "simmer",
        targetInstanceId: "potato-1",
        params: { durationSeconds: "300" },
        dependsOn: [],
      }),
      step({
        id: "simmer_b",
        actionId: "simmer",
        targetInstanceId: "onion-1",
        params: { durationSeconds: "300" },
        dependsOn: [], // genuinely independent — no dependsOn, and both PASSIVE, so the
        // actor constraint alone would let these fully overlap; only a correctly-derived
        // requiredToolIds (["pot"], from simmerAction.requiredTools) forces serialization.
      }),
    ];
    const schedule = scheduleDagFromSteps(sequence, actions);
    assert.deepEqual(schedule.nodes.get("simmer_a")!, {
      id: "simmer_a",
      startSeconds: 0,
      finishSeconds: 300,
    });
    assert.deepEqual(schedule.nodes.get("simmer_b")!, {
      id: "simmer_b",
      startSeconds: 300,
      finishSeconds: 600,
    });
  });

  test("requiredToolIds derivation: an action with no requiredTools at all (PEEL) schedules with no tool lock at all", () => {
    const sequence = [
      step({ id: "peel_potato", actionId: "peel", targetInstanceId: "potato-1", dependsOn: [] }),
    ];
    const schedule = scheduleDagFromSteps(sequence, actions);
    assert.equal(schedule.nodes.get("peel_potato")!.startSeconds, 0); // no tool wait, nothing to conflict with
  });

  test("a cyclic dependsOn among real RecipeSteps throws rather than producing a nonsensical schedule", () => {
    const sequence = [
      step({
        id: "a",
        actionId: "boil",
        targetInstanceId: "x",
        params: { durationSeconds: "10" },
        dependsOn: ["b"],
      }),
      step({
        id: "b",
        actionId: "boil",
        targetInstanceId: "x",
        params: { durationSeconds: "10" },
        dependsOn: ["a"],
      }),
    ];
    assert.throws(() => scheduleDagFromSteps(sequence, actions), /circular dependency/);
  });

  test("backward compatibility: a fully legacy linear recipe (no id/dependsOn anywhere) schedules as pure serial time, matching today's actual runRecipe behavior", () => {
    const sequence = [
      step({ actionId: "boil", targetInstanceId: "potato-1", params: { durationSeconds: "600" } }),
      step({
        actionId: "caramelize",
        targetInstanceId: "onion-1",
        params: { durationSeconds: "300" },
      }),
    ];
    const schedule = scheduleDagFromSteps(sequence, actions);
    // No explicit dependsOn -> step 1 auto-depends on step 0 -> forced serial, 600 + 300 = 900,
    // NOT the 600s a genuinely independent pair would achieve (proven in the test above).
    assert.equal(schedule.totalSeconds, 900);
  });
});
