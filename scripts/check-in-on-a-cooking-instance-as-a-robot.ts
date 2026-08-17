import { join } from "node:path";
import { loadEntities, loadActions, loadCcps } from "../src/registry.ts";
import { executionBoundFor } from "../src/execution-bounds.ts";
import { beginAction, progressStatus, fractionOfRequestedDuration, remainingRequestedSeconds } from "../src/in-progress-action.ts";

/**
 * Capability test for `src/in-progress-action.ts` — the next real slice of
 * ROADMAP.md's "Heat as a shared, time-varying property of a PLACE" gap,
 * specifically the previously-named-but-unbuilt `Instance.inProgressAction`
 * design input. `applyAction` (`engine.ts`) is atomic — this proves a
 * SEPARATE, real capability: given an action that started some simulated
 * seconds ago, can a caller (a robot checking in on a pot mid-boil) ask
 * "where am I in this process" and get a real, correct answer — reusing
 * `execution-bounds.ts`'s already-real safety floor/forced ceiling rather
 * than re-deriving a second notion of "how long should this take."
 *
 * Four real cases, walked forward through simulated time:
 *
 * A. BOIL egg (`egg_cooking`'s flat 15s CCP floor) — a robot checks in at
 *    5s (still below the floor — the SAME floor `reject-early-sensory-
 *    termination.ts` already proves a sensor may not override, now from
 *    the "I'm checking on it" angle), then at 200s (long past the floor,
 *    still short of a plausible requested duration), then past its own
 *    requested duration.
 * B. FRY (no CCP floor at all for potato) with a requested duration LONGER
 *    than its own `maxDurationSeconds` ceiling — proves `forced_timeout`
 *    fires from the ceiling even when the caller asked for more.
 * C. MASH — a real, common continuous action with NO `durationSeconds`
 *    parameter at all (worked by hand/masher "until done", not to a
 *    caller-specified clock). Proves `requestedDurationSeconds`/
 *    `fractionOfRequestedDuration`/`remainingRequestedSeconds` correctly
 *    report "not applicable" rather than guessing, while `progressStatus`
 *    still correctly tracks the forced timeout.
 * D. An instantaneous action (PEEL) — proves `beginAction` correctly
 *    refuses to track something that has no partial-completion concept at
 *    all, rather than silently returning a nonsensical in-progress record.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));

function checkIn(label: string, actionId: string, entityId: string, params: Record<string, string>, checkpoints: number[]): void {
  console.log(`\n=== ${label} ===`);
  const action = actions.get(actionId)!;
  const entity = entities.get(entityId)!;
  const inProgress = beginAction(action, params, 0);
  if (!inProgress) {
    console.log(`  beginAction returned undefined — not a continuous, audited action. Nothing to check in on.`);
    return;
  }
  const bound = executionBoundFor(action, entity, params, ccps);
  console.log(
    `  Started at t=0s. requestedDurationSeconds: ${inProgress.requestedDurationSeconds ?? "(none supplied/applicable)"}. ` +
      `Bound: minSafeHoldSeconds=${bound?.minSafeHoldSeconds ?? "n/a"}, maxDurationSeconds=${bound?.maxDurationSeconds ?? "n/a"}.`
  );
  for (const t of checkpoints) {
    const status = progressStatus(inProgress, bound, t);
    const fraction = fractionOfRequestedDuration(inProgress, t);
    const remaining = remainingRequestedSeconds(inProgress, t);
    console.log(
      `  t=${t}s -> ${status}` +
        (fraction !== undefined ? `, ${Math.round(fraction * 100)}% of requested duration, ${remaining}s remaining` : "")
    );
  }
}

checkIn("A. BOIL egg — flat CCP floor (egg_cooking), real requested duration", "boil", "egg", { durationSeconds: "420" }, [
  5, 60, 200, 420, 500,
]);

checkIn(
  "B. FRY — no CCP floor, requested duration LONGER than the real 1800s ceiling",
  "fry",
  "potato",
  { durationSeconds: "3000" },
  [900, 1799, 1800, 2000]
);

checkIn("C. MASH — no durationSeconds parameter at all, worked 'until done'", "mash", "potato", { consistency: "smooth" }, [
  60, 300, 600, 700,
]);

console.log("\n=== D. PEEL — instantaneous, no partial-completion concept ===");
const peelAction = actions.get("peel")!;
const notTracked = beginAction(peelAction, {}, 0);
console.log(`  beginAction(PEEL, ...) === undefined: ${notTracked === undefined}`);

console.log(
  "\nStill NOT closed, honestly named rather than implied covered: engine.ts's applyAction is completely " +
    "UNCHANGED — it stays atomic, same as execution-bounds.ts's own precedent. Nothing in recipe-runner.ts " +
    "constructs an InProgressAction or pauses a step mid-execution; this only proves the QUERY mechanism " +
    "itself is real and correct given a hypothetical already-started action. The two concrete cases " +
    "ROADMAP.md's own entry names for this gap — an egg's shape settling/spreading over its first several " +
    "seconds after cracking, and basting applied repeatedly DURING a fry rather than once — are NOT modeled " +
    "here: this module answers 'how far along, in TIME, is a started action,' not 'what does the food " +
    "actually look/behave like partway through,' a genuinely harder question with its own real physical facts " +
    "this pass deliberately did not attempt to source and cite."
);
