import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Closes ROADMAP.md's long-stale Phase 4 item "Unit tests per
 * forbidden-transition rule" — written back when it was genuinely blocked on
 * `INVALID_TRANSITIONS` not existing at all. That blocker cleared 2026-08-15
 * (`Entity.invalidTransitions`, per-entity) and was substantially AUDITED
 * 2026-08-15/16 (potato.json's `invalidTransitionsAudit2026-08-16`, egg.json's
 * `separatedNote`, onion.json's mirrored audit) — but nothing had ever run
 * those specific, real, shipped rules against the real engine. `npm test`
 * deliberately stays independent of `data/*.json` (CLAUDE.md's own stated
 * split — synthetic fixtures in `tests/*.test.ts`, real-data proof via
 * capability-test scripts + `npm run validate`), so this follows the SAME
 * shape as `failure-states-as-a-robot.ts` (which proves exactly one such
 * rule — burned potato rejecting FRY) rather than adding a `data/*.json`
 * dependency to the unit suite.
 *
 * Every fromState/toState pair below is drawn directly from the real,
 * shipped `invalidTransitions` maps on potato/egg/egg_cracked/onion — not
 * reinvented here. `burned`/`overcooked` (potato) are deliberately NOT
 * re-tested — `failure-states-as-a-robot.ts` already covers that ground.
 *
 * A real, honest finding surfaced while building this, not smoothed over:
 * egg's `peel.json` prerequisite (`statePrerequisites.peel: "boiled"`, a
 * single required state, not an array) means PEEL can only ever be called
 * from state "boiled" in the first place — so egg's own
 * `sliced`/`diced`/`chopped`/`fried`/`poached` entries forbidding a
 * reversion to `"peeled"` are structurally REDUNDANT: `applyAction`'s
 * earlier statePrerequisites check already makes that call impossible for
 * an entirely different, stricter reason, before `invalidTransitions` is
 * ever consulted. Not a bug (defense in depth is harmless), but a real
 * difference from potato's OWN reversion-to-peeled entries, where PEEL has
 * no statePrerequisites at all — there, `invalidTransitions` is the ONLY
 * thing enforcing it. Each check below reports which mechanism actually
 * fired, rather than treating "REJECTED" as one undifferentiated outcome.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const ALL_TOOLS = new Set(["knife", "grater", "masher", "pot", "pan", "oven", "bowl"]);
const ALL_INGREDIENTS = new Set(["water", "oil"]);

let passCount = 0;
let failCount = 0;

function attempt(
  entityId: string,
  fromState: string,
  tags: string[],
  actionId: string,
  params: Record<string, string>,
  expect: "rejected_by_invalid_transitions" | "rejected_earlier" | "succeeds",
  toStateLabel: string
): void {
  const instance: Instance = { entityId, state: fromState, tags };
  const action = actions.get(actionId)!;
  let outcome: "rejected_by_invalid_transitions" | "rejected_earlier" | "succeeds";
  let message = "";
  try {
    const result = applyAction(instance, action, entities, ALL_TOOLS, params, ALL_INGREDIENTS);
    outcome = "succeeds";
    message = `-> "${result.instance.state}"`;
  } catch (err) {
    message = (err as Error).message;
    outcome = /forbidden transition/.test(message)
      ? "rejected_by_invalid_transitions"
      : "rejected_earlier";
  }
  const ok = outcome === expect;
  if (ok) passCount++;
  else failCount++;
  const tag = ok ? "PASS" : "FAIL";
  console.log(
    `  [${tag}] ${entityId} "${fromState}" --${action.verb}--> "${toStateLabel}": ${outcome}` +
      (ok ? "" : ` (expected ${expect})`) +
      ` — ${message}`
  );
}

console.log("=== potato.json — mashed forbids reverting to any intact-piece state ===");
console.log("(load-bearing: PEEL/BOIL/PAR_FRY/BAKE have no statePrerequisites for potato at all)");
attempt("potato", "mashed", [], "peel", {}, "rejected_by_invalid_transitions", "peeled");
attempt("potato", "mashed", [], "boil", {}, "rejected_by_invalid_transitions", "boiled");
attempt(
  "potato",
  "mashed",
  [],
  "par_fry",
  { oilTempC: "150" },
  "rejected_by_invalid_transitions",
  "par_fried"
);
attempt("potato", "mashed", [], "bake", {}, "rejected_by_invalid_transitions", "baked");
console.log(
  '  (CUT/GRATE need a "washed" or "peeled" tag/state to even reach invalidTransitions —'
);
console.log(
  "   a mashed-but-previously-washed potato is a real reachable combination: raw+WASH tag -> BOIL -> MASH)"
);
attempt(
  "potato",
  "mashed",
  ["washed"],
  "cut",
  { shape: "sliced" },
  "rejected_by_invalid_transitions",
  "sliced"
);
attempt(
  "potato",
  "mashed",
  ["washed"],
  "cut",
  { shape: "diced" },
  "rejected_by_invalid_transitions",
  "diced"
);
attempt(
  "potato",
  "mashed",
  ["washed"],
  "cut",
  { shape: "halved" },
  "rejected_by_invalid_transitions",
  "halved"
);
attempt("potato", "mashed", ["washed"], "grate", {}, "rejected_by_invalid_transitions", "grated");
console.log(
  "  Deliberately NOT forbidden — the real potato-cake technique (mashed -> fried IS legal):"
);
attempt("potato", "mashed", [], "fry", { oilTempC: "175" }, "succeeds", "fried");

console.log("\n=== potato.json — every cut-shape / cooked state forbids reverting to peeled ===");
console.log("(structural: once subdivided or cooked, no single whole piece remains to peel)");
for (const fromState of [
  "sliced",
  "diced",
  "julienne",
  "chopped",
  "minced",
  "halved",
  "quartered",
  "grated",
  "fried",
  "baked",
  "par_fried",
]) {
  attempt("potato", fromState, [], "peel", {}, "rejected_by_invalid_transitions", "peeled");
}

console.log("\n=== onion.json — the same audit, mirrored (2026-08-16) ===");
for (const fromState of [
  "sliced",
  "diced",
  "julienne",
  "chopped",
  "minced",
  "halved",
  "quartered",
  "grated",
  "fried",
  "baked",
  "caramelized",
]) {
  attempt("onion", fromState, [], "peel", {}, "rejected_by_invalid_transitions", "peeled");
}

console.log(
  "\n=== egg.json — fried/poached forbidding a reversion to peeled: REDUNDANT, not load-bearing ==="
);
console.log(
  '(PEEL requires state "boiled" exactly — fried/poached can never reach PEEL at all, for a'
);
console.log(
  " DIFFERENT, earlier, stricter reason — invalidTransitions never actually gets consulted here)"
);
attempt("egg", "fried", [], "peel", {}, "rejected_earlier", "peeled");
attempt("egg", "poached", [], "peel", {}, "rejected_earlier", "peeled");
attempt("egg", "sliced", [], "peel", {}, "rejected_earlier", "peeled");

console.log(
  "\n=== egg.json — fried/poached/separated forbidding a reversion to boiled: LIVE, load-bearing ==="
);
console.log(
  "(BOIL has no statePrerequisites for egg — invalidTransitions is the only thing stopping this)"
);
attempt("egg", "fried", [], "boil", {}, "rejected_by_invalid_transitions", "boiled");
attempt("egg", "poached", [], "boil", {}, "rejected_by_invalid_transitions", "boiled");
attempt("egg", "separated", [], "boil", {}, "rejected_by_invalid_transitions", "boiled");

console.log(
  '\n=== egg.json — "separated" also forbids reverting to fried/poached (no shell in play) ==='
);
attempt(
  "egg",
  "separated",
  [],
  "fry",
  { oilTempC: "175" },
  "rejected_by_invalid_transitions",
  "fried"
);
attempt("egg", "separated", [], "poach", {}, "rejected_by_invalid_transitions", "poached");

console.log(
  "\n=== egg_cracked.json — fried/scrambled is a genuine protein-coagulation one-way door ==="
);
attempt(
  "egg_cracked",
  "fried",
  [],
  "beat",
  { intensity: "lightly_beaten" },
  "rejected_by_invalid_transitions",
  "lightly_beaten"
);
attempt(
  "egg_cracked",
  "fried",
  [],
  "beat",
  { intensity: "beaten" },
  "rejected_by_invalid_transitions",
  "beaten"
);
attempt(
  "egg_cracked",
  "scrambled",
  [],
  "beat",
  { intensity: "well_beaten" },
  "rejected_by_invalid_transitions",
  "well_beaten"
);
console.log(
  '  NOT independently checkable: egg_cracked\'s "fried"/"scrambled" also forbid reverting to "raw" — but no ' +
    'action in this vocabulary has outputs.transformedState/-FromParameter that ever produces "raw" at all ' +
    "(it's only ever an INITIAL inventory state), so that specific entry can never actually fire via a real " +
    "action call — a genuinely dead/unreachable rule, named here rather than faked with a synthetic action."
);

console.log(
  `\n${passCount} passed, ${failCount} failed (of ${passCount + failCount} real, shipped rules checked).`
);
console.log(
  "\nStill NOT covered by this script: burned/overcooked (see failure-states-as-a-robot.ts, which already " +
    "proves that ground); this only re-derives what the loaded data/*.json ACTUALLY says today, so it " +
    "regresses correctly if a future edit narrows or widens any of these rules — it does not independently " +
    "re-justify each rule's real-world correctness (that's ROADMAP.md's/each entity's own citation's job)."
);
