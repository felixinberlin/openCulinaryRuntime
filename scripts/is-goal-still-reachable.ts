import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { isGoalReachable, type BlockingReason } from "../src/reachability.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for TICKET 4 (`PAPER_NOTES_2608.04768.md`) —
 * `src/reachability.ts`'s `isGoalReachable`, proving its own stated
 * acceptance criteria against REAL `data/entities/*.json`/`data/actions/*.json`,
 * not synthetic fixtures (those live in `tests/reachability.test.ts`):
 *
 * 1. Two real dead ends, each with a SPECIFIC named reason, not a bare "no."
 * 2. A real reachable mid-recipe state, with a path that's then actually
 *    RUN against `engine.ts`'s `applyAction` step by step — the search
 *    result isn't just claimed, it's executed for real.
 * 3. Determinism — the same query run twice returns the identical result.
 *
 * TWO REAL FINDINGS surfaced while building this, worth stating up front —
 * exactly the kind of thing this ticket claims a reachability tool is FOR
 * ("a question the field currently answers empirically and expensively"):
 *
 * 1. The ticket's own suggested "good forcing case" — "a potato that has
 *    been mashed — which INVALID_TRANSITIONS should close off from fried"
 *    — is FACTUALLY WRONG against this repo's own already-audited data.
 *    `mashed → fried` is deliberately LEGAL (`potato.json`'s own
 *    `mashNote` — pan-frying mashed potato into a "potato cake" is a real,
 *    celebrated technique). Checked directly (`data/entities/potato.json`)
 *    before building anything around it, not trusted from the ticket's own
 *    prose — see `LEARNINGS_PROCESS.md` 2026-08-16.
 * 2. Querying `mashed potato → goal "peeled"` (Case 1b below) ORIGINALLY
 *    reported REACHABLE — genuinely surprising, and a real, previously-
 *    invisible gap this tool found by pure graph search, not injected on
 *    purpose: `mashed → fried` (legal) → `fried → peeled` (`potato.json`
 *    had NO `"fried"` key in `invalidTransitions` at all, unlike
 *    `egg.json`'s already-audited `fried`/`poached` forbidding `peeled`).
 *    NOT patched under THIS ticket's scope (a rushed one-line addition
 *    risked repeating the exact mistake `potato.json`'s own 2026-08-15
 *    correction was built to prevent) — instead given the same dedicated,
 *    per-transition real-technique audit `egg.json` got, the same day,
 *    as its own separate follow-up (`potato.json`'s
 *    `invalidTransitionsAudit2026-08-16`, `ROADMAP.md` Phase 4). Case 1b
 *    below now correctly reports `reachable: false` — kept in this script
 *    as a regression check on that fix, not removed once "solved."
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

function describeReason(r: BlockingReason): string {
  switch (r.kind) {
    case "missing_target_capability":
      return `${r.actionId}: target lacks capability "${r.capability}"`;
    case "missing_tool":
      return `${r.actionId}: tool "${r.toolId}" not available`;
    case "missing_tool_capability":
      return `${r.actionId}: no available tool has capability "${r.capability}"`;
    case "missing_ingredient_capability":
      return `${r.actionId}: no available ingredient has capability "${r.capability}"`;
    case "unsatisfied_state_prerequisite":
      return `${r.actionId}: requires prior state/tag ${r.requiredAnyOf.join(" or ")}, currently "${r.fromState}"`;
    case "forbidden_transition":
      return `${r.actionId}: "${r.fromState}" -> "${r.toState}" is a forbidden transition (invalidTransitions)`;
    case "requires_secondary_instance":
      return `${r.actionId}: requires a secondary instance — out of scope for single-instance reachability`;
    case "instance_destroyed":
      return `${r.actionId}: destroys the target — a dead end for THIS instance`;
    case "invalid_target_kind":
      return `${r.actionId}: doesn't apply to this entity kind`;
  }
}

console.log('=== Case 1: burned potato, goal state "peeled" (a clean, already-verified terminal dead end) ===');
const potato = entities.get("potato")!;
const result1 = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "burned",
  startTags: [],
  goal: { state: "peeled" },
  availableTools: new Set(["knife", "pan", "oven"]),
  availableIngredients: new Set(["oil"]),
});
console.log(`reachable: ${result1.reachable}`);
if (!result1.reachable) {
  console.log("blockedBy:");
  for (const r of result1.blockedBy) console.log(`  - ${describeReason(r)}`);
}

console.log('\n=== Case 1b: mashed potato, goal state "peeled" — regression check on a real, now-fixed gap ===');
const result1b = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "mashed",
  startTags: [],
  goal: { state: "peeled" },
  availableTools: new Set(["knife", "pan", "oven"]),
  availableIngredients: new Set(["oil"]),
});
console.log(`reachable: ${result1b.reachable}`);
if (result1b.reachable) {
  console.log(`path: ${result1b.path.map((s) => s.actionId).join(" -> ")}`);
  console.log(
    "  UNEXPECTED: this was a real gap this tool originally found (mashed -> fry -> peel) and fixed via " +
      "potato.json's invalidTransitionsAudit2026-08-16 — if this branch prints, that fix has regressed."
  );
} else {
  console.log(
    '  Correctly unreachable: "fried" now forbids "peeled" (potato.json\'s invalidTransitionsAudit2026-08-16) ' +
      "— this Case originally reported TRUE (a real gap this tool found by pure graph search) before that fix; " +
      "kept here as a permanent regression check, see this file's own top doc comment for the full story."
  );
}

console.log('\n=== Case 2: separated egg, goal state "boiled" (a whole boiled egg back) ===');
const egg = entities.get("egg")!;
const result2 = isGoalReachable({
  entity: egg,
  entities,
  actions,
  startState: "separated",
  startTags: [],
  goal: { state: "boiled" },
  availableTools: new Set(["pot", "pan", "bowl"]),
  availableIngredients: new Set(["water", "oil", "salt", "black_pepper", "chili_flakes", "vinegar"]),
});
console.log(`reachable: ${result2.reachable}`);
if (!result2.reachable) {
  console.log("blockedBy:");
  for (const r of result2.blockedBy) console.log(`  - ${describeReason(r)}`);
}
console.log(
  '(Note: "boil"/"simmer"/"fry" from "separated" are blocked by forbidden_transition here because of a real ' +
    "gap this exercise found and fixed in egg.json — see data/entities/egg.json's separatedNote and " +
    "LEARNINGS_ENGINE.md 2026-08-16.)"
);

console.log('\n=== Case 3: raw + "washed" tag potato, goal state "fried" — REACHABLE, path executed for real ===');
const result3 = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: ["washed"],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
console.log(`reachable: ${result3.reachable}`);
if (result3.reachable) {
  console.log(`path: ${result3.path.map((s) => (s.param ? `${s.actionId}(${s.param})` : s.actionId)).join(" -> ")}`);

  let instance: Instance = { entityId: "potato", state: "raw", tags: ["washed"] };
  for (const step of result3.path) {
    const action = actions.get(step.actionId)!;
    const params: Record<string, string> = step.param ? { shape: step.param } : {};
    const applied = applyAction(instance, action, entities, new Set(["knife", "pan"]), params, new Set(["oil"]));
    console.log(`  ${action.verb}: "${instance.state}" -> "${applied.instance.state}"`);
    instance = applied.instance;
  }
  console.log(`Final state: "${instance.state}" — matches goal: ${instance.state === "fried"}`);
}

console.log("\n=== Determinism check: same query, run twice ===");
const runA = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: ["washed"],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
const runB = isGoalReachable({
  entity: potato,
  entities,
  actions,
  startState: "raw",
  startTags: ["washed"],
  goal: { state: "fried" },
  availableTools: new Set(["knife", "pan"]),
  availableIngredients: new Set(["oil"]),
});
console.log(`identical result both runs: ${JSON.stringify(runA) === JSON.stringify(runB)}`);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: this is REACHABILITY only, not " +
    "migration (proposing an alternative goal is planning, out of scope, per the ticket's own instruction); no " +
    "numeric fluents/thermal dose/tolerance metric — discrete state/tag graph only; single-instance scope — a " +
    "requiredSecondaryCapability (COMBINE-shaped) edge is recorded as blocked, not explored, since this search " +
    "has no model of a second instance being available; engine.ts's applyAction is completely unchanged."
);
