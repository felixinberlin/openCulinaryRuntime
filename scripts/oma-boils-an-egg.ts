import { join } from "node:path";
import { loadEntities, loadActions, loadCcps, loadHeatSources } from "../src/registry.ts";
import { applyAction, type Instance, type SafetyPolicy } from "../src/engine.ts";
import { estimatedPreheatSeconds } from "../src/heat-source.ts";
import { EGG_BOIL_DONENESS } from "../src/egg-doneness.ts";

/**
 * "Oma" persona demo — added 2026-08-13, following CONCEPT.md §14's own
 * pipeline exactly:
 *
 *   "boil me an egg, medium"
 *         ↓
 *       LLM                    <- NOT built here (this repo has no LLM);
 *         ↓                       CONCEPT.md §14's boundary is "LLM -> Intent,
 *   Intent: BOIL, target: egg,    never LLM -> authoritative world state" —
 *           yolkDoneness: medium  so the Intent below is GIVEN, not derived.
 *         ↓
 *   Deterministic engine      <- THIS is what this script actually proves.
 *
 * Oma is a naive end-user: she doesn't know or care what oil/water
 * temperature is, what heat source is on the stove, what Salmonella's
 * kill-time threshold is, or that a robot cooking unattended needs a
 * different default safety posture than a human standing at the stove
 * (ENGINE_INVARIANTS.md #11). The whole point of everything this repo has
 * built — EGG_BOIL_DONENESS, heat-source.ts, egg_cooking.json,
 * SafetyPolicy — is that NONE of that has to come from her. This script
 * walks the resolution end to end and PROVES it, rather than asserting in
 * a doc comment that "the vocabulary is grounded enough for this."
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));
const ccps = loadCcps(join(root, "data", "ccps"));
const heatSources = loadHeatSources(join(root, "data", "heat-sources"));

console.log('Oma: "Boil me an egg, medium."');
console.log(
  "(That's the entire request — no temperature, no timing, no heat source, no safety detail.)\n"
);

// ---------------------------------------------------------------------
// The LLM's only job (CONCEPT.md §14) — produce this Intent. Not built
// here; represented as a plain given object, the same boundary the
// concept doc draws.
// ---------------------------------------------------------------------
const intent = { verb: "boil" as const, targetEntityId: "egg", yolkDoneness: "medium" as const };
console.log(`Intent (what an LLM would have produced): ${JSON.stringify(intent)}\n`);

console.log("=== Everything below is the deterministic engine's job, not Oma's or the LLM's ===\n");

// ---------------------------------------------------------------------
// 1. "What is an egg?" — the robot doesn't need Oma to explain it; it's
//    already grounded, real data.
// ---------------------------------------------------------------------
const egg = entities.get(intent.targetEntityId)!;
console.log(`1. What is an egg? (${egg.names.en}, entity "${egg.id}")`);
console.log(
  `   isBoilable: ${egg.capabilities.isBoilable}, isSimmerable: ${egg.capabilities.isSimmerable}`
);
console.log(
  `   Safety threshold wired to BOIL: "${egg.criticalControlPointsByAction.boil}" (data/ccps/egg_cooking.json)\n`
);

// ---------------------------------------------------------------------
// 2. "Medium" — resolved to a real, cited seconds range, not guessed.
// ---------------------------------------------------------------------
const doneness = EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === intent.yolkDoneness)!;
const durationSeconds = doneness.durationSecondsRange.min; // the earliest point still safely inside the cited range
console.log(
  `2. "medium" resolved via EGG_BOIL_DONENESS: ${doneness.durationSecondsRange.min}-${doneness.durationSecondsRange.max}s`
);
console.log(`   (${doneness.description}) — using ${durationSeconds}s.\n`);

// ---------------------------------------------------------------------
// 3. How much fire? Oma never said. The KITCHEN'S actual heat source is a
//    fact of the world, not something to invent — assumed here as "gas"
//    (a robot would read this from its own environment, not ask Oma).
// ---------------------------------------------------------------------
const heatSource = heatSources.get("gas")!;
const water = entities.get("water")!;
const potWaterMassKg = 1.0;
const startTempC = 15; // tap-cold, not fridge-cold
const preheatSeconds = estimatedPreheatSeconds(
  potWaterMassKg,
  startTempC,
  water.thermophysical!.boilingPointC!,
  heatSource
);
console.log(
  `3. Kitchen has: ${heatSource.names.en}. Water reaches boiling in ~${preheatSeconds.toFixed(0)}s from ${startTempC}°C —`
);
console.log(
  `   a real, computed number (heat-source.ts), not asked of Oma or guessed by the robot.\n`
);

// ---------------------------------------------------------------------
// 4. Safety — a robot cooking for Oma unattended is AUTONOMOUS execution
//    (ENGINE_INVARIANTS.md #11), a genuinely different default posture
//    than a human at the stove, even though it's the exact same BOIL step.
// ---------------------------------------------------------------------
const policy: SafetyPolicy = { mode: "autonomous" };
console.log(
  `4. Execution mode: "${policy.mode}" — no human present to judge a shortfall, so the safe default applies automatically.\n`
);

// ---------------------------------------------------------------------
// 5. Execute the fully-resolved, now-concrete BOIL step.
// ---------------------------------------------------------------------
const tools = new Set(["pot", "knife", "bowl"]);
const ingredients = new Set(["water"]);
const rawEgg: Instance = { entityId: "egg", state: "raw", tags: [] };
const boiled = applyAction(
  rawEgg,
  actions.get("boil")!,
  entities,
  tools,
  { durationSeconds: String(durationSeconds) },
  ingredients,
  ccps,
  policy
);
console.log(`5. BOIL executed: "${rawEgg.state}" -> "${boiled.instance.state}"`);
console.log(
  `   Warnings: ${boiled.warnings.length === 0 ? "none — comfortably clears egg_cooking's threshold" : boiled.warnings.join("; ")}\n`
);

// Finish the dish — SHOCK stops carryover cooking (egg.json's shockNote:
// durationSeconds alone doesn't fully determine final doneness), then PEEL.
const shocked = applyAction(
  boiled.instance,
  actions.get("shock")!,
  entities,
  tools,
  {},
  ingredients
).instance;
const peeled = applyAction(
  shocked,
  actions.get("peel")!,
  entities,
  new Set(["knife"]),
  {},
  ingredients
).instance;
console.log(
  `6. SHOCK then PEEL: "${boiled.instance.state}" -> "${shocked.state}" -> "${peeled.state}"\n`
);

console.log(`Oma's egg: state "${peeled.state}", tags [${peeled.tags}] — ready.`);
console.log(
  `\nEvery number above (${durationSeconds}s hold, ~${preheatSeconds.toFixed(0)}s preheat, autonomous-mode safety posture)` +
    " came from grounded, cited data —\n" +
    "Oma supplied exactly two words: 'egg' and 'medium'. That's the whole point of this repo, made concrete."
);
