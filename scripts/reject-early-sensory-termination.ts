import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { executionBoundFor } from "../src/execution-bounds.ts";

/**
 * Capability test for `src/execution-bounds.ts` (TICKET 2,
 * `PAPER_NOTES_2608.04768.md`) — the concrete asymmetry that ticket exists
 * to name: in the paper's own architecture, a plausible sensory "looks
 * done" reading ends a continuous step outright. This repo's CCP machinery
 * is a floor a sensor must NOT be able to override. Two real cases, both
 * against real `data/ccps/*.json` thresholds, not synthetic numbers:
 *
 * Case A — BOIL on egg (`egg_cooking`, a flat `heldSeconds` floor, the
 * `soft_boiled_egg.json`/`huevo_frito.json` territory this ticket's own
 * acceptance criteria names). Case B — PASTEURIZE on egg_yolk
 * (`egg_pasteurization_liquid`, the one CCP in this repo with a real D/z
 * `thermalModel` — computed via `thermal.ts`'s `requiredHoldSeconds`, not a
 * fixed anchor) — the sharper illustration: the gap between "a thermal
 * sensor reports the target temperature reached" and "the pathogen kill
 * time at that temperature has actually elapsed" is large and real, not a
 * few seconds of rounding.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

function runCase(
  label: string,
  actionId: string,
  entityId: string,
  params: Record<string, string>,
  sensorReportedSeconds: number
): void {
  console.log(`\n=== ${label} ===`);
  const action = actions.get(actionId)!;
  const entity = entities.get(entityId)!;
  const bound = executionBoundFor(action, entity, params, ccps);

  if (!bound) {
    console.log(`  No ExecutionBound applies (not continuous, or no maxDurationSeconds) — nothing to demonstrate.`);
    return;
  }

  console.log(`  maxDurationSeconds (paper's own ceiling): ${bound.maxDurationSeconds}s`);
  console.log(`  minSafeHoldSeconds (this repo's real CCP floor): ${bound.minSafeHoldSeconds ?? "none — no CCP applies"}`);
  console.log(`  floorIsSafetyCritical: ${bound.floorIsSafetyCritical}`);
  console.log(`  citation: ${bound.citation ?? "(none)"}`);

  console.log(
    `\n  A plausible sensor reports "looks/reads done" at ${sensorReportedSeconds}s.`
  );
  console.log(
    `  In the paper's own architecture (Song et al., arXiv:2608.04768), a continuous step's sensory ` +
      `termination condition ends the step the instant it fires — at ${sensorReportedSeconds}s here.`
  );

  if (bound.floorIsSafetyCritical && sensorReportedSeconds < bound.minSafeHoldSeconds!) {
    console.log(
      `\n  REJECTED by this repo's real CCP floor: ${sensorReportedSeconds}s < ${bound.minSafeHoldSeconds}s required.`
    );
    console.log(`  Citation for the floor: ${bound.citation}`);
    console.log(
      `  The sensory reading, however plausible, is NOT allowed to end this step early — a sensor may` +
        ` report the food LOOKS/READS done well before the pathogen kill time at this temperature has` +
        ` actually elapsed (ENGINE_INVARIANTS.md #11's control/perception gap, now with a concrete` +
        ` adversary: an early-but-plausible sensory signal).`
    );
  } else if (bound.floorIsSafetyCritical) {
    console.log(`\n  ACCEPTED: ${sensorReportedSeconds}s >= ${bound.minSafeHoldSeconds}s — the real floor was actually met.`);
  } else {
    console.log(`\n  ACCEPTED (no CCP floor applies to this action/entity pair — nothing to reject against).`);
  }
}

// Case A: flat heldSeconds floor (egg_cooking: 15s @ 63°C, no thermalModel —
// see thermal.ts's own doc comment on why a flat anchor is the honest model
// here). A sensor plausibly reporting "looks cooked" at 5s is still well
// short of the real 15s floor.
runCase("BOIL egg — flat CCP floor (egg_cooking)", "boil", "egg", {}, 5);

// Case B: real D/z-computed floor (egg_pasteurization_liquid). At 60°C the
// reference point is 210s; a thermal sensor plausibly reports "target
// temperature reached and stable" at 30s — the temperature IS correct, but
// the pathogen kill time at that temperature has barely begun.
runCase(
  "PASTEURIZE egg_yolk — D/z-computed CCP floor (egg_pasteurization_liquid)",
  "pasteurize",
  "egg_yolk",
  { waterTempC: "60" },
  30
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: this is a synthetic " +
    "sensorReportedSeconds value, not a real sensor reading — no perception layer exists " +
    "(ENGINE_INVARIANTS.md #11 unchanged). engine.ts's applyAction does not consume " +
    "execution-bounds.ts at all — this module is standalone, same precedent as place.ts/heat-source.ts " +
    "before engine wiring. src/recipe-explain.ts surfaces maxDurationSeconds/CCP info for a recipe's own " +
    "steps (read-only, pre-flight) but does not itself call executionBoundFor with a hypothetical sensor " +
    "reading the way this script does."
);
