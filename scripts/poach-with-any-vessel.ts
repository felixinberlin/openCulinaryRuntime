import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";

/**
 * The POACH sibling of `boil-with-any-deep-vessel.ts`/`fry-with-any-vessel.ts`
 * — closes the "one verb left with the old exact-id tool check" gap named in
 * ROADMAP.md's `requiredToolCapabilities` entry. Unlike BOIL (isDeepVessel
 * only) or FRY (isFryingVessel only), POACH's real requirement generalizes to
 * `isVessel` — the WEAKER, medium-agnostic capability all four vessels share
 * — because real cited technique has TWO genuinely different, both-standard
 * poaching methods in TWO genuinely different vessel shapes (see poach.json's
 * own `vesselCorrectionNote` and REFERENCES.md): a deep pot/saucepan for the
 * classic single-egg vortex method, and a wide pan/wok for a no-vortex batch
 * method. Proves all four actually work via `applyAction`, not just that the
 * schema accepts the capability.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const poach = actions.get("poach")!;

for (const toolId of ["pot", "pan", "saucepan", "wok"]) {
  const instance: Instance = { entityId: "egg", state: "raw", tags: [] };
  const result = applyAction(
    instance,
    poach,
    entities,
    new Set([toolId]),
    { waterTempC: "90", durationSeconds: "180", yolkDoneness: "runny" },
    new Set(["water"]),
    ccps
  );
  console.log(`POACH with only "${toolId}" on hand: "${instance.state}" -> "${result.instance.state}"`);
}

console.log(
  "\nAll four succeed — a real change from before 2026-08-17, when requiredTools: ['pan'] (exact-id) meant a " +
    "robot with only a pot (no pan) could not poach an egg at all, for no real physical reason. Knife alone " +
    "(no vessel at all) is still correctly rejected:"
);
try {
  applyAction(
    { entityId: "egg", state: "raw", tags: [] },
    poach,
    entities,
    new Set(["knife"]),
    { waterTempC: "90" },
    new Set(["water"]),
    ccps
  );
  console.log("  Unexpected: POACH with only a knife should have been rejected.");
} catch (e) {
  console.log(`  REJECTED: ${(e as Error).message}`);
}

console.log(
  "\nStill NOT closed by this script: the real, cited difference in resulting EGG SHAPE between a deep-vessel " +
    "vortex poach and a wide-pan batch poach (poach.json's own vesselCorrectionNote) is not modeled as an " +
    "outcome parameter — informational-only depth, same as every other unenforced technique fact in this " +
    "vocabulary, and a deliberately separate concern from this script's own scope (vessel SUBSTITUTABILITY, " +
    "not vessel-driven outcome prediction)."
);
