import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * The FRY sibling of `boil-with-any-deep-vessel.ts`, added 2026-08-14 while
 * "extending FRY with everything learned from BOIL." Same real question,
 * same real answer: `requiredTools: ["pan"]` was an id-vs-capability
 * mismatch, not a physical constraint — fixed identically to BOIL's
 * `isDeepVessel` fix via `isFryingVessel` (`fry.json`'s `toolCapabilityNote`).
 * Proves THREE cases, not one:
 *   1. Only a pot available -> correctly REJECTED (a tall, narrow pot has
 *      poor surface-area-to-volume for shallow frying — pot.json
 *      deliberately doesn't assert isFryingVessel).
 *   2. Only a pan available -> works, unchanged from before this fix.
 *   3. Only a wok available -> ALSO works — a tool fry.json never mentions
 *      by id anywhere, proving real capability-based substitution.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const fry = actions.get("fry")!;
console.log(`fry.json's tool requirement: requiredTools=[${fry.requiredTools}], requiredToolCapabilities=[${fry.requiredToolCapabilities}]\n`);

function attempt(toolId: string) {
  const egg: Instance = { entityId: "egg", state: "raw", tags: [] };
  try {
    const result = applyAction(
      egg,
      fry,
      entities,
      new Set([toolId]),
      { durationSeconds: "90", yolkDoneness: "runny" },
      new Set(["oil"]),
      ccps
    );
    console.log(`  "${toolId}" only: OK — egg -> "${result.instance.state}"`);
  } catch (e) {
    console.log(`  "${toolId}" only: REJECTED — ${(e as Error).message}`);
  }
}

console.log("1. Robot has only a pot (no pan) — the FRY analog of the earlier BOIL question:");
attempt("pot");

console.log("\n2. Robot has only a pan:");
attempt("pan");

console.log("\n3. Robot has only a wok — a tool fry.json never names, proving real substitution:");
attempt("wok");

console.log(
  "\nSo: a pot still correctly fails — poor surface area for shallow frying, a real physical fact, not a data-model " +
    "artifact anymore. The engine no longer hardcodes 'pan' by name: any current or future tool entity that " +
    "legitimately asserts isFryingVessel (wok, a cast-iron skillet, ...) works immediately, with zero changes to " +
    "fry.json/par-fry.json."
);
