import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { applyAction, type Instance } from "../src/engine.ts";
import { isTerminalState } from "../src/ingredient.ts";

/**
 * First end-to-end proof for data/actions/whisk.json + egg_white.json's
 * new peak-stage states, added 2026-08-16 — closes egg_white.json's own
 * former todo note ("whipping to stiff peaks... isn't modeled"). Mirrors
 * caramelize-onion-as-a-robot.ts's role.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

const tools = new Set(["mixer", "pot"]);

console.log(
  "Goal: raw egg white -> foamy -> soft -> firm -> stiff peaks, plus the real gates around it.\n"
);

// ---------------------------------------------------------------------
// 1. The real path: WHISK through all four real stages, one applyAction
//    call per stage (a cook doesn't have to stop at each one, but this
//    proves every stage is independently reachable and correctly
//    computed by the SAME parameter-driven action).
// ---------------------------------------------------------------------
let white: Instance = { entityId: "egg_white", state: "raw", tags: [] };
for (const stage of ["foamy", "soft_peaks", "firm_peaks", "stiff_peaks"]) {
  const result = applyAction(
    white,
    actions.get("whisk")!,
    entities,
    tools,
    { peakStage: stage },
    new Set(),
    ccps
  );
  console.log(`1. WHISK (peakStage: ${stage}): "${white.state}" -> "${result.instance.state}"`);
  white = result.instance;
}
console.log();

// ---------------------------------------------------------------------
// 2. invalidTransitions: cannot go BACKWARD to a less-developed stage —
//    stiff_peaks is the current state; requesting soft_peaks again must
//    be rejected, not silently "un-whisked."
// ---------------------------------------------------------------------
try {
  applyAction(
    white,
    actions.get("whisk")!,
    entities,
    tools,
    { peakStage: "soft_peaks" },
    new Set(),
    ccps
  );
  console.log("2. Unexpected: stiff_peaks -> soft_peaks should have been rejected.");
} catch (e) {
  console.log(`2. WHISK stiff_peaks -> soft_peaks correctly REJECTED: ${(e as Error).message}\n`);
}

// ---------------------------------------------------------------------
// 3. invalidTransitions: cannot revert all the way to raw either.
// ---------------------------------------------------------------------
try {
  applyAction(
    white,
    actions.get("whisk")!,
    entities,
    tools,
    { peakStage: "foamy" },
    new Set(),
    ccps
  );
  console.log("3. Unexpected: stiff_peaks -> foamy should have been rejected.");
} catch (e) {
  console.log(`3. WHISK stiff_peaks -> foamy correctly REJECTED: ${(e as Error).message}\n`);
}

// ---------------------------------------------------------------------
// 4. 'over_whisked' is a real, terminal state — reachable only as an
//    authored fact (TICKET 5's shape), never as a WHISK parameter value.
// ---------------------------------------------------------------------
const eggWhiteEntity = entities.get("egg_white")!;
console.log(
  `4. "over_whisked" is one of whisk.json's peakStage allowedValues? ${actions.get("whisk")!.parameters[0].allowedValues!.includes("over_whisked")} (expected false — never a chosen target)`
);
console.log(
  `   isTerminalState(egg_white, "over_whisked") = ${isTerminalState(eggWhiteEntity, "over_whisked")} (expected true)`
);

const overWhisked: Instance = { entityId: "egg_white", state: "over_whisked", tags: [] };
try {
  applyAction(
    overWhisked,
    actions.get("whisk")!,
    entities,
    tools,
    { peakStage: "stiff_peaks" },
    new Set(),
    ccps
  );
  console.log(
    "   Unexpected: whisking an over_whisked white back to stiff_peaks should have been rejected."
  );
} catch (e) {
  console.log(
    `   WHISK on an already-over_whisked white correctly REJECTED: ${(e as Error).message}\n`
  );
}

// ---------------------------------------------------------------------
// 5. The real, directly-forced fix alongside WHISK: egg_white was never
//    actually wired to PASTEURIZE despite already having the
//    'pasteurized' tag and a note explaining why it should be — closed
//    the same day, proven here against the real CCP.
// ---------------------------------------------------------------------
const rawForPasteurize: Instance = { entityId: "egg_white", state: "raw", tags: [] };
const pasteurized = applyAction(
  rawForPasteurize,
  actions.get("pasteurize")!,
  entities,
  tools,
  { waterTempC: "60", durationSeconds: "210" },
  new Set(),
  ccps
);
console.log(
  `5. PASTEURIZE egg_white (60°C/210s, egg_pasteurization_liquid.json): tags [${pasteurized.instance.tags.join(", ")}] ` +
    `(expected "pasteurized" — was unreachable before today's fix, see egg_white.json's own pasteurizedTagNote)`
);

console.log(
  "\nStill NOT closed by this script, named rather than implied covered: no real recipe in this repo actually " +
    "USES whisked egg white yet (a meringue needs sugar, still an unbuilt entity — ROADMAP.md's 'Far more " +
    "staple ingredients' gap) — this proves the mechanism is real and correct, not that a real dish exercises " +
    "it end-to-end the way tortilla_de_patatas exercises COMBINE."
);
