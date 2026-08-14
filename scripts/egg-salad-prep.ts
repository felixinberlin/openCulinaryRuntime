import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { eggBoilDonenessRange } from "../src/egg-doneness.ts";

/**
 * Capability test for the 2026-08-14 "after boiled you can cut in blocks,
 * add salt, use it in a salad" conversation, plus its own preceding
 * question — "how do you get the egg out? do you wait or shock before
 * peeling?" — answered here by actually running BOTH valid sequences, not
 * just asserting they're equivalent:
 *   Path A: BOIL -> SHOCK -> PEEL -> CUT (diced) -> SALT
 *   Path B: BOIL -> PEEL -> CUT (diced) -> SALT   (SHOCK skipped — the
 *           "wait" path; statePrerequisites.peel only requires "boiled",
 *           never the "shocked" tag, so this has always been valid)
 *
 * Uses "hard" doneness, not "soft"/"medium" — egg salad is the one real
 * dish in this repo's capability-test history that specifically wants a
 * fully-set yolk (see egg-doneness.ts's EGG_BOIL_DONENESS "hard" entry),
 * not the jammy/runny center every prior egg script in this repo reached
 * for.
 *
 * Deliberately NOT a full "assemble a salad" test — see egg.json's
 * extractionAndRestingNote and ROADMAP.md's Phase 4 "No Composite Dish
 * Entity Assembly" gap: this stops at a diced, salted, ready-to-use egg,
 * the actual real gap that was closed (CUT was never callable on egg at
 * all before this). Combining it into an actual salad entity alongside
 * lettuce/mayo/etc. is separate, larger, not-yet-started work, named, not
 * silently implied covered by this script.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["pot", "bowl", "knife"]);
const ingredients = new Set(["water"]);

const { min, max } = eggBoilDonenessRange("hard");
const holdSeconds = String(min); // fully set is the goal; no need to linger past the minimum

function boilHardEgg(): Instance {
  const raw: Instance = { entityId: "egg", state: "raw", tags: [] };
  const boiled = applyAction(
    raw,
    actions.get("boil")!,
    entities,
    tools,
    { durationSeconds: holdSeconds, yolkDoneness: "hard", placementMethod: "lowered_with_spoon" },
    ingredients,
    ccps
  );
  console.log(`  BOIL (hard, ${holdSeconds}s): "${raw.state}" -> "${boiled.instance.state}"`);
  return boiled.instance;
}

function cutAndSalt(instance: Instance, label: string) {
  const cut = applyAction(instance, actions.get("cut")!, entities, tools, { shape: "diced" }).instance;
  console.log(`  CUT (diced): "${instance.state}" -> "${cut.state}"`);
  const salted = applyAction(cut, actions.get("salt")!, entities, tools, { timing: "after_cooking" }, new Set(["salt"])).instance;
  console.log(`  SALT: tags [${salted.tags}]`);
  console.log(`${label} result: "${salted.state}", tags [${salted.tags}]\n`);
}

console.log('Path A: BOIL -> SHOCK -> PEEL -> CUT (diced) -> SALT ("shock, don\'t wait")');
{
  const boiled = boilHardEgg();
  const shocked = applyAction(boiled, actions.get("shock")!, entities, tools, {}, ingredients).instance;
  console.log(`  SHOCK: "${boiled.state}" -> "${shocked.state}", tags [${shocked.tags}]`);
  const peeled = applyAction(shocked, actions.get("peel")!, entities, tools).instance;
  console.log(`  PEEL: "${shocked.state}" -> "${peeled.state}"`);
  cutAndSalt(peeled, "Path A");
}

console.log('Path B: BOIL -> PEEL -> CUT (diced) -> SALT (SHOCK skipped — the "wait" path)');
{
  const boiled = boilHardEgg();
  // No SHOCK call at all — statePrerequisites.peel only requires "boiled",
  // never the "shocked" tag, so this has ALWAYS been a valid sequence.
  const peeled = applyAction(boiled, actions.get("peel")!, entities, tools).instance;
  console.log(`  PEEL directly (no SHOCK): "${boiled.state}" -> "${peeled.state}"`);
  cutAndSalt(peeled, "Path B");
}

console.log(
  "Both paths run end to end with zero engine changes needed for the SHOCK-vs-PEEL choice — it was already " +
    "representable. What's genuinely new here: egg.json's isChoppable + statePrerequisites.cut ('peeled') — " +
    "CUT could not target egg at all before this."
);
console.log(
  "\nStill NOT represented, named rather than implied covered (see egg.json's extractionAndRestingNote): " +
    "no action models physically removing the egg from the pot (no location/place concept ties an instance to " +
    "a tool at all — ROADMAP.md's 'heat as a shared place' co-location half); no REST/COOL verb models an " +
    "uncontrolled ambient wait as its own step with a duration, only SHOCK's controlled version exists; " +
    "assembling the cut, salted egg into an actual 'salad' entity alongside other ingredients is the pre-existing " +
    "Phase 4 'No Composite Dish Entity Assembly' gap, unaffected by this script."
);
