import { join } from "node:path";
import { loadEntities, loadActions, loadRecipes } from "../src/registry.ts";
import { compileToExecutionGraph } from "../src/execution-graph-compiler.ts";
import {
  createExecutionGraph,
  addNode,
  addDependency,
  validateExecutionGraph,
  serializeExecutionGraph,
  deserializeExecutionGraph,
  checkExecutionOrder,
} from "../src/execution-graph.ts";

/**
 * Capability test for the "Execution Graph" ticket (revised 2026-08-18) —
 * `src/execution-graph.ts` (the pure IR + minimal builder API) and
 * `src/execution-graph-compiler.ts` (the domain-aware producer built on
 * top of it). Four parts:
 *
 * A. The pure IR's minimal API used directly — createExecutionGraph/
 *    addNode/addDependency/validateExecutionGraph/serializeExecutionGraph/
 *    deserializeExecutionGraph — with ZERO recipe/entity/action data
 *    anywhere, proving the IR genuinely doesn't need this repo's domain
 *    at all (the ticket's own core architectural requirement).
 * B. `salted-fried-potatoes.json` — a fully linear real recipe, compiled
 *    and round-tripped through serialization.
 * C. `garlic-oil-potatoes.json` — a REAL recipe already authored with
 *    explicit step `id`/`dependsOn`, with `fry_potato` depending on BOTH
 *    `cut_potato` and `infuse_oil` — a genuine fan-in, proven against
 *    real data.
 * D. `tortilla-de-patatas.json` — `BEAT` targets `egg_cracked-3`, an
 *    instance SPAWNED by an earlier `CRACK` step, not present in
 *    `initialInventory` — proves the compiler rejects with a clear,
 *    named reason rather than silently wrong or crashing.
 */

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// --- A. The pure IR, built by hand — no recipe/entity/action data at all ---

section("A. Pure IR — peel -> slice -> fry, built with zero domain data");

const irGraph = createExecutionGraph("peel_slice_fry_by_hand");
addNode(irGraph, {
  id: "peel-potato-1",
  action: "peel",
  inputs: [{ entityId: "potato-1", role: "target" }],
  preconditions: [{ type: "state", entityId: "potato-1", state: ["whole"] }],
  effects: [{ type: "state", entityId: "potato-1", state: "peeled" }],
});
addNode(irGraph, {
  id: "slice-potato-1",
  action: "slice",
  inputs: [{ entityId: "potato-1", role: "target" }],
  preconditions: [{ type: "state", entityId: "potato-1", state: ["peeled"] }],
  effects: [{ type: "state", entityId: "potato-1", state: "sliced" }],
});
addNode(irGraph, {
  id: "fry-potato-1",
  action: "fry",
  inputs: [{ entityId: "potato-1", role: "target" }],
  preconditions: [{ type: "state", entityId: "potato-1", state: ["sliced"] }],
  effects: [{ type: "state", entityId: "potato-1", state: "fried" }],
});
addDependency(irGraph, "peel-potato-1", "slice-potato-1");
addDependency(irGraph, "slice-potato-1", "fry-potato-1");

const irValidation = validateExecutionGraph(irGraph);
console.log("Structural validation:", irValidation);
if (!irValidation.valid)
  throw new Error("Expected the hand-built IR graph to be structurally valid.");

const irSerialized = serializeExecutionGraph(irGraph);
const irReconstructed = deserializeExecutionGraph(irSerialized);
if (JSON.stringify(irReconstructed) !== JSON.stringify(irGraph)) {
  throw new Error("Graph did not round-trip through serialize/deserialize unchanged.");
}
console.log(
  `Serialized to ${irSerialized.length} bytes, deserialized back byte-for-byte identical.`
);

if (!checkExecutionOrder(irGraph, ["peel-potato-1", "slice-potato-1", "fry-potato-1"]).valid) {
  throw new Error("Expected forward order to be valid.");
}
if (checkExecutionOrder(irGraph, ["slice-potato-1", "peel-potato-1", "fry-potato-1"]).valid) {
  throw new Error("Expected slice-before-peel to violate a dependency edge.");
}
console.log(
  "Confirmed: a dependency really prevents slice from running before peel — checked structurally, no execution."
);

// --- B/C/D: the domain-aware compiler, against real data -------------------

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

section("B. Linear recipe — salted_fried_potatoes");

const potatoes = recipes.get("salted_fried_potatoes");
if (!potatoes) throw new Error("Fixture recipe missing: salted_fried_potatoes");

const resultB = compileToExecutionGraph(potatoes, entities, actions);
if (!resultB.ok) {
  throw new Error(
    `Expected salted_fried_potatoes to compile cleanly, got errors: ${resultB.errors.join("; ")}`
  );
}
console.log(`Compiled ${resultB.graph.nodes.length} nodes, ${resultB.graph.edges.length} edges.`);
for (const node of resultB.graph.nodes) {
  const inputList = node.inputs.map((i) => `${i.entityId}${i.role ? `:${i.role}` : ""}`).join(", ");
  console.log(
    `  ${node.id}: ${node.action} on [${inputList}] — ${node.preconditions.length} preconditions, ${node.effects.length} effects`
  );
}
if (!validateExecutionGraph(resultB.graph).valid) {
  throw new Error(
    "Compiled graph failed structural validation — should be impossible by construction."
  );
}
console.log(`entityTypes resolved: ${JSON.stringify(resultB.entityTypes)}`);

// --- C. A real fan-in (non-linear) dependency structure --------------------

section("C. Fan-in dependency — garlic_oil_potatoes (fry_potato needs cut_potato AND infuse_oil)");

const garlicOil = recipes.get("garlic_oil_potatoes");
if (!garlicOil) throw new Error("Fixture recipe missing: garlic_oil_potatoes");

const resultC = compileToExecutionGraph(garlicOil, entities, actions);
if (!resultC.ok) {
  throw new Error(
    `Expected garlic_oil_potatoes to compile cleanly, got errors: ${resultC.errors.join("; ")}`
  );
}
const incomingToFry = resultC.graph.edges.filter((e) => e.to === "fry_potato").map((e) => e.from);
console.log(`fry_potato's incoming edges: [${incomingToFry.join(", ")}]`);
if (
  incomingToFry.length !== 2 ||
  !incomingToFry.includes("cut_potato") ||
  !incomingToFry.includes("infuse_oil")
) {
  throw new Error(
    `Expected fry_potato to depend on exactly cut_potato and infuse_oil, got [${incomingToFry.join(", ")}].`
  );
}
console.log("Confirmed against real data: a genuine fan-in, not a linear list.");

// --- D. A real, honest rejection --------------------------------------------

section("D. Honest rejection — tortilla_de_patatas' BEAT on a SPAWNED instance");

const tortilla = recipes.get("tortilla_de_patatas");
if (!tortilla) throw new Error("Fixture recipe missing: tortilla_de_patatas");

const resultD = compileToExecutionGraph(tortilla, entities, actions);
if (resultD.ok) {
  throw new Error(
    "Expected tortilla_de_patatas to be REJECTED (BEAT targets egg_cracked-3, a spawned instance) — it compiled instead."
  );
}
console.log("Compilation correctly rejected. Errors:");
for (const error of resultD.errors) console.log(`  - ${error}`);
if (!resultD.errors.some((e) => e.includes("egg_cracked-3"))) {
  throw new Error(
    'Expected a rejection reason naming "egg_cracked-3" specifically, not a generic failure.'
  );
}
console.log(
  "\nConfirmed: rejected with a clear, named reason (spawned-instance resolution is out of scope for this " +
    "compiler pass) rather than crashing or silently compiling a graph with a wrong/guessed entity resolution."
);

console.log("\nAll execution-graph.ts / execution-graph-compiler.ts capability checks passed.");
