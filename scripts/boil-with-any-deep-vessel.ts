import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * Capability test for `action.ts`'s `requiredToolCapabilities` /
 * `engine.ts`'s matching `applyAction` check, added 2026-08-14 directly in
 * response to: "what if the robot tries to boil the egg in a pan, not a
 * pot, because it has no pot available — will it work?"
 *
 * Answers that question for real, against the actual data, for THREE cases
 * rather than one — the point isn't "make it always work," it's "make tool
 * substitution capability-based instead of id-based, so it works exactly
 * when the physical vessel actually qualifies and correctly still refuses
 * when it doesn't":
 *   1. Only a pan available -> still correctly REJECTED (a real frying pan
 *      can't hold enough water depth to submerge an egg — pan.json
 *      deliberately doesn't assert isDeepVessel).
 *   2. Only a pot available -> works, unchanged from before this fix.
 *   3. Only a saucepan available -> ALSO works — a tool BOIL never
 *      mentions by id anywhere, proving this is genuine capability-based
 *      substitution, not a second hardcoded special case for "saucepan".
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const boil = actions.get("boil")!;
console.log(`boil.json's tool requirement: requiredTools=[${boil.requiredTools}], requiredToolCapabilities=[${boil.requiredToolCapabilities}]\n`);

function attempt(toolId: string) {
  const egg: Instance = { entityId: "egg", state: "raw", tags: [] };
  try {
    const result = applyAction(egg, boil, entities, new Set([toolId]), { durationSeconds: "480" }, new Set(["water"]), ccps);
    console.log(`  "${toolId}" only: OK — egg -> "${result.instance.state}"`);
  } catch (e) {
    console.log(`  "${toolId}" only: REJECTED — ${(e as Error).message}`);
  }
}

console.log("1. Robot has only a pan (no pot) — the exact question asked:");
attempt("pan");

console.log("\n2. Robot has only a pot:");
attempt("pot");

console.log("\n3. Robot has only a saucepan — a tool boil.json never names, proving real substitution:");
attempt("saucepan");

console.log(
  "\nSo: no, a bare pan still correctly fails — it's not deep enough to submerge an egg, and that's a real " +
    "physical fact, not a data-model artifact anymore. But the ENGINE no longer hardcodes 'pot' by name: any " +
    "current or future tool entity that legitimately asserts isDeepVessel (saucepan, a stockpot, a deep sauté " +
    "pan, ...) works immediately, with zero changes to boil.json/simmer.json/pasteurize.json."
);
