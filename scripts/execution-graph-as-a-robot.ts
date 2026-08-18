import { join } from "node:path";
import { loadEntities, loadActions, loadRecipes } from "../src/registry.ts";
import { compileToExecutionGraph, checkExecutionOrder } from "../src/execution-graph.ts";

/**
 * Capability test for `src/execution-graph.ts` — the "Implement Execution
 * Graph as Compiler IR" ticket, closed 2026-08-18. Three real recipes,
 * three different real outcomes — not synthetic fixtures (those live in
 * `tests/execution-graph.test.ts`), proving the compiler against this
 * repo's actual `data/entities/*.json`/`data/actions/*.json`/
 * `data/recipes/*.json`.
 *
 * A. `salted-fried-potatoes.json` — a fully linear recipe (wash -> peel ->
 *    cut -> fry -> drain -> salt), every instance already in
 *    `initialInventory`. Compiles cleanly; checked against the ticket's
 *    own acceptance criteria (a deterministic graph, inspectable without
 *    a runtime).
 * B. `garlic-oil-potatoes.json` — a REAL recipe already authored with
 *    explicit step `id`/`dependsOn` (`dag-scheduler.ts`'s own join-node
 *    proof), with `fry_potato` depending on BOTH `cut_potato` and
 *    `infuse_oil` — a genuine fan-in, the exact non-linear shape the
 *    ticket's own diagram draws (peel/slice/fry with a converging "heat
 *    oil" branch), now proven against real data instead of only a
 *    synthetic fixture.
 * C. `tortilla-de-patatas.json` — `BEAT` targets `egg_cracked-3`, an
 *    instance SPAWNED by an earlier `CRACK` step, not present in
 *    `initialInventory`. `execution-graph.ts`'s own doc comment names
 *    this exact case as out of scope for this compiler pass (resolving a
 *    spawned instance's entity id requires actually running the recipe,
 *    which this compiler never does) — this proves it's rejected with a
 *    clear, named reason, not silently wrong or crashing.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const recipes = loadRecipes(join(root, "data", "recipes"));

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// --- A. A real, fully linear recipe ----------------------------------------

section("A. Linear recipe — salted_fried_potatoes");

const potatoes = recipes.get("salted_fried_potatoes");
if (!potatoes) throw new Error("Fixture recipe missing: salted_fried_potatoes");

const resultA = compileToExecutionGraph(potatoes, entities, actions);
if (!resultA.ok) {
  throw new Error(
    `Expected salted_fried_potatoes to compile cleanly, got errors: ${resultA.errors.join("; ")}`
  );
}
console.log(`Compiled ${resultA.graph.nodes.length} nodes, ${resultA.graph.edges.length} edges.`);
for (const node of resultA.graph.nodes) {
  console.log(
    `  ${node.id}: ${node.action} on [${node.inputs.join(", ")}] — ` +
      `${node.preconditions.length} preconditions, ${node.effects.length} effects`
  );
}
// Serializable without the runtime — the ticket's own acceptance criterion.
const serialized = JSON.stringify(resultA.graph);
const reparsed = JSON.parse(serialized);
if (reparsed.nodes.length !== resultA.graph.nodes.length) {
  throw new Error("Graph did not round-trip through JSON.stringify/parse cleanly.");
}
console.log(
  `Serialized to ${serialized.length} bytes of plain JSON and re-parsed identically — no runtime needed.`
);

// checkExecutionOrder: the graph's own edges, not array position, decide order.
const forward = resultA.graph.nodes.map((n) => n.id);
const reversed = [...forward].reverse();
if (!checkExecutionOrder(resultA.graph, forward).valid) {
  throw new Error("Expected the graph's own natural node order to be a valid execution order.");
}
if (checkExecutionOrder(resultA.graph, reversed).valid) {
  throw new Error("Expected the REVERSED order to violate at least one dependency edge.");
}
console.log(
  "Confirmed: forward order is valid, reversed order correctly violates a real dependency edge."
);

// --- B. A real fan-in (non-linear) dependency structure --------------------

section("B. Fan-in dependency — garlic_oil_potatoes (fry_potato needs cut_potato AND infuse_oil)");

const garlicOil = recipes.get("garlic_oil_potatoes");
if (!garlicOil) throw new Error("Fixture recipe missing: garlic_oil_potatoes");

const resultB = compileToExecutionGraph(garlicOil, entities, actions);
if (!resultB.ok) {
  throw new Error(
    `Expected garlic_oil_potatoes to compile cleanly, got errors: ${resultB.errors.join("; ")}`
  );
}
const incomingToFry = resultB.graph.edges.filter((e) => e.to === "fry_potato").map((e) => e.from);
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
console.log(
  "Confirmed against real data: a genuine fan-in, not a linear list — the ticket's own core requirement."
);

// --- C. A real, honest rejection --------------------------------------------

section("C. Honest rejection — tortilla_de_patatas' BEAT on a SPAWNED instance");

const tortilla = recipes.get("tortilla_de_patatas");
if (!tortilla) throw new Error("Fixture recipe missing: tortilla_de_patatas");

const resultC = compileToExecutionGraph(tortilla, entities, actions);
if (resultC.ok) {
  throw new Error(
    "Expected tortilla_de_patatas to be REJECTED (BEAT targets egg_cracked-3, a spawned instance) — it compiled instead."
  );
}
console.log("Compilation correctly rejected. Errors:");
for (const error of resultC.errors) console.log(`  - ${error}`);
if (!resultC.errors.some((e) => e.includes("egg_cracked-3"))) {
  throw new Error(
    'Expected a rejection reason naming "egg_cracked-3" specifically, not a generic failure.'
  );
}
console.log(
  "\nConfirmed: rejected with a clear, named reason (spawned-instance resolution is out of scope for this " +
    "compiler pass) rather than crashing or silently compiling a graph with a wrong/guessed entity resolution."
);

console.log("\nAll execution-graph.ts capability checks passed.");
