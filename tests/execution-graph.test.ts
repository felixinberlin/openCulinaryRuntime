import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  createExecutionGraph,
  addNode,
  addDependency,
  validateExecutionGraph,
  serializeExecutionGraph,
  deserializeExecutionGraph,
  checkExecutionOrder,
  type ExecutionGraph,
  type ExecutionNode,
} from "../src/execution-graph.ts";

/**
 * Pure IR tests — no `RecipeScript`, no `Entity`, no `Action` anywhere in
 * this file, on purpose: `execution-graph.ts` imports nothing from this
 * repo's own domain, and its tests hold it to the same standard. The
 * ticket's own worked example (peel -> slice -> fry) is built here by
 * hand, via the minimal builder API, exactly the way a hypothetical
 * compiler would use it — `tests/execution-graph-compiler.test.ts`
 * covers the actual RecipeScript -> ExecutionGraph compiler separately.
 */

function peelNode(): ExecutionNode {
  return {
    id: "peel-potato-1",
    action: "peel",
    inputs: [{ entityId: "potato-1", role: "target" }],
    preconditions: [{ type: "state", entityId: "potato-1", state: ["whole"] }],
    effects: [{ type: "state", entityId: "potato-1", state: "peeled" }],
  };
}
function sliceNode(): ExecutionNode {
  return {
    id: "slice-potato-1",
    action: "slice",
    inputs: [{ entityId: "potato-1", role: "target" }],
    preconditions: [{ type: "state", entityId: "potato-1", state: ["peeled"] }],
    effects: [{ type: "state", entityId: "potato-1", state: "sliced" }],
  };
}
function fryNode(): ExecutionNode {
  return {
    id: "fry-potato-1",
    action: "fry",
    inputs: [
      { entityId: "potato-1", role: "target" },
      { entityId: "oil-1", role: "ingredient" },
    ],
    preconditions: [{ type: "state", entityId: "potato-1", state: ["sliced"] }],
    effects: [{ type: "state", entityId: "potato-1", state: "fried" }],
  };
}

function buildLinearGraph(): ExecutionGraph {
  const graph = createExecutionGraph("peel_slice_fry");
  addNode(graph, peelNode());
  addNode(graph, sliceNode());
  addNode(graph, fryNode());
  addDependency(graph, "peel-potato-1", "slice-potato-1");
  addDependency(graph, "slice-potato-1", "fry-potato-1");
  return graph;
}

describe("basic graph — peel -> slice -> fry", () => {
  test("has exactly 3 nodes and 2 edges", () => {
    const graph = buildLinearGraph();
    assert.equal(graph.nodes.length, 3);
    assert.equal(graph.edges.length, 2);
  });

  test("node ids are correct", () => {
    const graph = buildLinearGraph();
    assert.deepEqual(
      graph.nodes.map((n) => n.id),
      ["peel-potato-1", "slice-potato-1", "fry-potato-1"]
    );
  });

  test("dependencies are correct — from/to, not array position", () => {
    const graph = buildLinearGraph();
    assert.deepEqual(graph.edges, [
      { from: "peel-potato-1", to: "slice-potato-1" },
      { from: "slice-potato-1", to: "fry-potato-1" },
    ]);
  });

  test("is a valid graph", () => {
    assert.deepEqual(validateExecutionGraph(buildLinearGraph()), { valid: true });
  });
});

describe("entity references — by id, not embedded objects", () => {
  test('peel\'s input references "potato-1" as a plain id, not a potato object', () => {
    const graph = buildLinearGraph();
    const peel = graph.nodes.find((n) => n.id === "peel-potato-1")!;
    assert.deepEqual(peel.inputs, [{ entityId: "potato-1", role: "target" }]);
    assert.equal(typeof peel.inputs[0].entityId, "string");
  });

  test("no node anywhere carries a nested entity object — every reference is a bare id", () => {
    const graph = buildLinearGraph();
    for (const node of graph.nodes) {
      for (const input of node.inputs) {
        assert.equal(
          Object.keys(input).every((k) => k === "entityId" || k === "role"),
          true
        );
      }
    }
  });
});

describe("preconditions/effects — whole -> peeled -> sliced", () => {
  test("peel: precondition whole, effect peeled", () => {
    const graph = buildLinearGraph();
    const peel = graph.nodes.find((n) => n.id === "peel-potato-1")!;
    assert.deepEqual(peel.preconditions, [
      { type: "state", entityId: "potato-1", state: ["whole"] },
    ]);
    assert.deepEqual(peel.effects, [{ type: "state", entityId: "potato-1", state: "peeled" }]);
  });

  test("slice: precondition peeled, effect sliced — causally linked to peel's own effect, not independently asserted", () => {
    const graph = buildLinearGraph();
    const peel = graph.nodes.find((n) => n.id === "peel-potato-1")!;
    const slice = graph.nodes.find((n) => n.id === "slice-potato-1")!;
    assert.deepEqual(slice.preconditions, [
      { type: "state", entityId: "potato-1", state: ["peeled"] },
    ]);
    assert.deepEqual(slice.effects, [{ type: "state", entityId: "potato-1", state: "sliced" }]);
    // The literal fact that makes this a real causal chain, not two
    // independent assertions: slice's precondition state matches peel's
    // own effect state, for the same entityId.
    assert.equal(slice.preconditions[0].state[0], (peel.effects[0] as { state: string }).state);
  });
});

describe("invalid graph — rejected, not silently accepted", () => {
  test("addDependency to a node not yet added throws", () => {
    const graph = createExecutionGraph("test");
    addNode(graph, sliceNode());
    assert.throws(() => addDependency(graph, "slice-potato-1", "missing-node"), /unknown node/);
  });

  test("addNode with a duplicate id throws", () => {
    const graph = createExecutionGraph("test");
    addNode(graph, peelNode());
    assert.throws(() => addNode(graph, peelNode()), /duplicate node id/);
  });

  test("validateExecutionGraph reports a dangling edge on a graph assembled some other way (e.g. deserialized)", () => {
    const graph: ExecutionGraph = {
      id: "test",
      nodes: [peelNode()],
      edges: [{ from: "peel-potato-1", to: "missing-node" }],
    };
    const result = validateExecutionGraph(graph);
    assert.equal(result.valid, false);
    if (result.valid) return;
    assert.ok(result.errors.some((e) => e.includes("missing-node")));
  });

  test("validateExecutionGraph reports a duplicate node id on a graph assembled some other way", () => {
    const graph: ExecutionGraph = { id: "test", nodes: [peelNode(), peelNode()], edges: [] };
    const result = validateExecutionGraph(graph);
    assert.equal(result.valid, false);
    if (result.valid) return;
    assert.ok(result.errors.some((e) => e.includes("Duplicate node id")));
  });

  test("addDependency rejects a self-referencing edge", () => {
    const graph = createExecutionGraph("test");
    addNode(graph, peelNode());
    assert.throws(
      () => addDependency(graph, "peel-potato-1", "peel-potato-1"),
      /cannot depend on itself/
    );
  });

  test("validateExecutionGraph rejects a cycle assembled some other way, documented as: ExecutionGraph must be a DAG", () => {
    const graph: ExecutionGraph = {
      id: "test",
      nodes: [peelNode(), sliceNode()],
      edges: [
        { from: "peel-potato-1", to: "slice-potato-1" },
        { from: "slice-potato-1", to: "peel-potato-1" },
      ],
    };
    const result = validateExecutionGraph(graph);
    assert.equal(result.valid, false);
    if (result.valid) return;
    assert.ok(result.errors.some((e) => e.toLowerCase().includes("dag")));
  });
});

describe("branching — a node with two independent successors", () => {
  test("start -> heat-pan and start -> prepare-potato is representable", () => {
    const graph = createExecutionGraph("branch_test");
    addNode(graph, { id: "start", action: "start", inputs: [], preconditions: [], effects: [] });
    addNode(graph, {
      id: "heat-pan",
      action: "heat",
      inputs: [{ entityId: "pan-1" }],
      preconditions: [],
      effects: [],
    });
    addNode(graph, {
      id: "prepare-potato",
      action: "prepare",
      inputs: [{ entityId: "potato-1" }],
      preconditions: [],
      effects: [],
    });
    addDependency(graph, "start", "heat-pan");
    addDependency(graph, "start", "prepare-potato");

    assert.equal(validateExecutionGraph(graph).valid, true);
    const fromStart = graph.edges.filter((e) => e.from === "start").map((e) => e.to);
    assert.deepEqual(fromStart.sort(), ["heat-pan", "prepare-potato"]);
  });

  test("a converging fan-in (fry depends on both cut-potato and heat-pan) is representable", () => {
    const graph = createExecutionGraph("fan_in_test");
    addNode(graph, {
      id: "heat-pan",
      action: "heat",
      inputs: [{ entityId: "pan-1" }],
      preconditions: [],
      effects: [],
    });
    addNode(graph, {
      id: "cut-potato",
      action: "cut",
      inputs: [{ entityId: "potato-1" }],
      preconditions: [],
      effects: [],
    });
    addNode(graph, {
      id: "fry-potato",
      action: "fry",
      inputs: [{ entityId: "potato-1" }, { entityId: "pan-1" }],
      preconditions: [],
      effects: [],
    });
    addDependency(graph, "heat-pan", "fry-potato");
    addDependency(graph, "cut-potato", "fry-potato");

    assert.equal(validateExecutionGraph(graph).valid, true);
    const incoming = graph.edges.filter((e) => e.to === "fry-potato").map((e) => e.from);
    assert.deepEqual(incoming.sort(), ["cut-potato", "heat-pan"]);
  });
});

describe("determinism", () => {
  test("the same construction sequence produces an identical graph representation every time", () => {
    const first = serializeExecutionGraph(buildLinearGraph());
    const second = serializeExecutionGraph(buildLinearGraph());
    assert.equal(first, second);
  });
});

describe("serialization round-trip", () => {
  test("serializeExecutionGraph -> deserializeExecutionGraph reconstructs an identical graph", () => {
    const graph = buildLinearGraph();
    const reconstructed = deserializeExecutionGraph(serializeExecutionGraph(graph));
    assert.deepEqual(reconstructed, graph);
  });

  test("a reconstructed graph passes validateExecutionGraph exactly like the original", () => {
    const graph = buildLinearGraph();
    const reconstructed = deserializeExecutionGraph(serializeExecutionGraph(graph));
    assert.deepEqual(validateExecutionGraph(reconstructed), validateExecutionGraph(graph));
  });

  test("deserializeExecutionGraph rejects malformed JSON that doesn't match the schema", () => {
    assert.throws(() => deserializeExecutionGraph(JSON.stringify({ nodes: "not an array" })));
  });
});

describe("checkExecutionOrder — a dependency prevents out-of-order execution", () => {
  test("peel before slice before fry is valid", () => {
    const graph = buildLinearGraph();
    assert.deepEqual(
      checkExecutionOrder(graph, ["peel-potato-1", "slice-potato-1", "fry-potato-1"]),
      {
        valid: true,
      }
    );
  });

  test("slice before peel violates the peel -> slice dependency edge", () => {
    const graph = buildLinearGraph();
    const check = checkExecutionOrder(graph, ["slice-potato-1", "peel-potato-1", "fry-potato-1"]);
    assert.equal(check.valid, false);
    if (check.valid) return;
    assert.deepEqual(check.violatedEdge, { from: "peel-potato-1", to: "slice-potato-1" });
  });
});
