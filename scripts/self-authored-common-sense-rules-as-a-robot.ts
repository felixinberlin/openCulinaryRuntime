import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Self-authored common-sense cooking rules (2026-08-17) — NOT triaged from
 * any external document, written directly against this repo's own real
 * entities/actions/recipes by auditing for the exact class of gap
 * `physical-feasibility-rules-as-a-robot.ts`'s rule #29 found: a newer
 * action's real prerequisites not yet audited against an older entity (or,
 * new here, against a SECONDARY instance at all). See LEARNINGS_PROCESS.md
 * 2026-08-17 for the audit method.
 *
 * Two genuine, real, structural gaps found and fixed:
 *
 * 1. "You cannot rest a raw, never-cooked potato." REST (isRestable) had no
 *    statePrerequisites.rest entry on potato.json at all — physically
 *    hollow, since every real use of REST in this vocabulary is POST-cook
 *    settling (residual heat/moisture redistribution), and a raw potato has
 *    neither. Fixed: statePrerequisites.rest: ['boiled','par_fried'] — see
 *    potato.json's own restStatePrerequisiteNote.
 *
 * 2. "You cannot combine a raw, unprepped secondary ingredient." A DEEPER
 *    structural gap, not a data-only fix: engine.ts's applyAction checked
 *    `requiredSecondaryCapability` (a static, state-independent boolean)
 *    on a COMBINE-shaped action's secondary instance, but NEVER checked
 *    that instance's actual current state at all — meaning a raw, unpeeled
 *    whole onion could satisfy COMBINE_POTATO_ONION's secondary slot, and a
 *    never-beaten egg_cracked could satisfy COMBINE's/COMBINE_CON_CEBOLLA's.
 *    Fixed in src/engine.ts (checkStatePrerequisite, extracted and reused
 *    for both target AND secondary — see its own doc comment) plus three
 *    new data/entities/*.json entries: onion.json's
 *    statePrerequisites.combine_potato_onion: 'sliced', egg_cracked.json's
 *    statePrerequisites.combine/combine_con_cebolla: ['beaten','well_beaten'].
 *
 * Every other rule below is a proof-of-soundness check (already correctly
 * enforced before this session, verified rather than assumed) covering
 * ground `physical-feasibility-rules-as-a-robot.ts` and
 * `invalid-transitions-as-a-robot.ts` don't already duplicate.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const ALL_TOOLS = new Set(["knife", "grater", "masher", "pot", "pan", "oven", "bowl", "mortar"]);

let passCount = 0;
let failCount = 0;

function attempt(
  label: string,
  instance: Instance,
  actionId: string,
  params: Record<string, string>,
  expectRejected: boolean,
  secondaryInstance?: Instance
): void {
  const action = actions.get(actionId)!;
  let rejected: boolean;
  let message = "";
  try {
    const result = applyAction(
      instance,
      action,
      entities,
      ALL_TOOLS,
      params,
      new Set(),
      new Map(),
      undefined,
      secondaryInstance
    );
    rejected = false;
    message = `-> state "${result.instance.state}", tags [${result.instance.tags}]`;
  } catch (err) {
    rejected = true;
    message = (err as Error).message;
  }
  const ok = rejected === expectRejected;
  if (ok) passCount++;
  else failCount++;
  console.log(
    `  [${ok ? "PASS" : "FAIL"}] ${label}: ${rejected ? "REJECTED" : "SUCCEEDED"} — ${message}`
  );
}

console.log("=== Rule 1 (NEW FIX) — you cannot rest a raw, never-cooked potato ===\n");
attempt(
  "REST a raw potato (nothing to settle yet)",
  { entityId: "potato", state: "raw", tags: [] },
  "rest",
  { durationSeconds: "120" },
  true
);
attempt(
  "REST a boiled potato (mashed-potatoes.json's real case — must still succeed)",
  { entityId: "potato", state: "boiled", tags: [] },
  "rest",
  { durationSeconds: "120" },
  false
);
attempt(
  "REST a par_fried potato (crispy-french-fries.json's real case — must still succeed)",
  { entityId: "potato", state: "par_fried", tags: [] },
  "rest",
  { durationSeconds: "600" },
  false
);

console.log("\n=== Rule 2 (NEW FIX) — you cannot combine potato with an unprepped onion ===\n");
attempt(
  "COMBINE_POTATO_ONION with a raw, whole, unpeeled onion secondary",
  { entityId: "potato", state: "sliced", tags: [] },
  "combine_potato_onion",
  {},
  true,
  { entityId: "onion", state: "raw", tags: [] }
);
attempt(
  "COMBINE_POTATO_ONION with a properly sliced onion secondary (the real recipe's own case — must still succeed)",
  { entityId: "potato", state: "sliced", tags: [] },
  "combine_potato_onion",
  {},
  false,
  { entityId: "onion", state: "sliced", tags: [] }
);

console.log("\n=== Rule 3 (NEW FIX) — you cannot combine potato with a never-beaten egg ===\n");
attempt(
  "COMBINE with a raw, never-beaten egg_cracked secondary",
  { entityId: "potato", state: "fried", tags: [] },
  "combine",
  {},
  true,
  { entityId: "egg_cracked", state: "raw", tags: [] }
);
attempt(
  "COMBINE with a beaten egg_cracked secondary (tortilla-de-patatas.json's real case — must still succeed)",
  { entityId: "potato", state: "fried", tags: [] },
  "combine",
  {},
  false,
  { entityId: "egg_cracked", state: "beaten", tags: [] }
);
attempt(
  "COMBINE with a well_beaten egg_cracked secondary (tortilla-de-betanzos.json's real case — must still succeed)",
  { entityId: "potato", state: "fried", tags: [] },
  "combine",
  {},
  false,
  { entityId: "egg_cracked", state: "well_beaten", tags: [] }
);
attempt(
  "COMBINE_CON_CEBOLLA with a raw, never-beaten egg_cracked secondary",
  { entityId: "potato_onion_mixture", state: "fried", tags: [] },
  "combine_con_cebolla",
  {},
  true,
  { entityId: "egg_cracked", state: "raw", tags: [] }
);

console.log(
  "\n=== Rules 4-9 — proof of soundness for mechanisms already correct before this audit ===\n"
);
attempt(
  "Rule 4: you cannot fold an egg that hasn't been fried into an omelette shape yet",
  { entityId: "egg_cracked", state: "raw", tags: [] },
  "fold",
  {},
  true
);
attempt(
  "Rule 5: you can fold a fried egg_cracked (the real French-omelette step)",
  { entityId: "egg_cracked", state: "fried", tags: [] },
  "fold",
  {},
  false
);
attempt(
  "Rule 6: you cannot emulsify garlic that hasn't been crushed to a fine paste yet",
  { entityId: "garlic", state: "peeled", tags: [] },
  "emulsify",
  {},
  true
);
attempt(
  "Rule 7: you cannot alkaline-parboil a whole, unpeeled potato",
  { entityId: "potato", state: "raw", tags: [] },
  "alkaline_parboil",
  {},
  true
);
attempt(
  "Rule 8: you cannot caramelize a whole, unsliced onion",
  { entityId: "onion", state: "peeled", tags: [] },
  "caramelize",
  {},
  true
);
attempt(
  "Rule 9: you cannot marinate an onion that hasn't been sliced (quick-pickled-onions.json's real prerequisite)",
  { entityId: "onion", state: "peeled", tags: [] },
  "marinate",
  { durationSeconds: "1800" },
  true
);

console.log(`\n${passCount} passed, ${failCount} failed.`);
console.log(
  "\nStill NOT closed, honestly named: the same secondary-instance-state gap this session fixed for COMBINE/" +
    "COMBINE_CON_CEBOLLA/COMBINE_POTATO_ONION could in principle apply to any FUTURE action that adds " +
    "requiredSecondaryCapability — checkStatePrerequisite (src/engine.ts) now runs automatically for any such " +
    "action, so this is closed structurally, not just for these three; but this script only directly exercises " +
    "the three that exist today. This audit also did not attempt to exhaustively re-check every " +
    "requiredIngredientCapabilities/requiredToolCapabilities check in the same way (a real, different, " +
    "narrower mechanism — 'is a qualifying ingredient/tool present at all', not 'is this specific tracked " +
    "instance in the right state') — out of scope for this pass, named rather than silently assumed covered."
);
