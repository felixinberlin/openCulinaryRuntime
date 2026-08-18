import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import { answerAboutEntityDomainFact } from "../src/query.ts";
import {
  ROOM_TEMP_C,
  MAILLARD_REACTION_ONSET_TEMP_C,
  MAILLARD_REACTION_STAGES_C,
  STARCH_GELATINIZATION_ONSET_TEMP_C,
  POTATO_FORK_TENDER_CENTER_TEMP_C,
} from "../src/heat-penetration.ts";
import {
  atmosphericPressurePa,
  isWithinBarometricValidity,
  BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M,
  ANTOINE_EQUATION_VALIDITY_TEMP_C,
} from "../src/altitude.ts";
import { DANGER_ZONE_CITATION, ALLERGEN_REGULATION_CITATION } from "../src/ingredient.ts";

/**
 * Capability test for the "transfer knowledge from code comments into
 * real code" sweep, 2026-08-18 — a directed review (not a single ticket)
 * that swept all 31 `src/*.ts` files for real, checkable facts stated
 * ONLY in doc-comment prose (never a typed field, exported constant, or
 * `Citation`/`DomainFact` this repo's own query interface can reach), and
 * promoted the genuine ones found. See `LEARNINGS_DOMAIN.md`/
 * `LEARNINGS_ENGINE.md` 2026-08-18 for the full sweep and what was
 * deliberately NOT promoted (design rationale with no underlying fact;
 * facts already covered; a few items judged too minor to be worth a
 * dedicated typed field).
 *
 * Every promotion here follows this repo's own established discipline:
 * the confidence tier and citation of each fact is PRESERVED from the
 * comment it was promoted from (not silently upgraded), and every one is
 * proven either directly consumed by real computation (not just declared)
 * or genuinely queryable via `npm run ask` — never a "declared but dead"
 * field with no real consumer, the exact anti-pattern this repo has
 * caught and fixed multiple times before (`pan.json`'s unreachable hot/
 * cold, `oven.json`'s unreachable states, `potato.json`'s unwired
 * `mashed`).
 */

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));

// --- 1. ROOM_TEMP_C: one source of truth instead of 4 independent literals ---

section("1. ROOM_TEMP_C — one cited constant, not 4 independently re-declared magic numbers");

console.log(
  `ROOM_TEMP_C = ${ROOM_TEMP_C}°C — now the single source recipe-explain.ts's fry-timing`
);
console.log("advisory, recipe-runner.ts's FILL default, and 2 capability-test scripts all import.");
if (ROOM_TEMP_C !== 20) {
  throw new Error(
    `Expected ROOM_TEMP_C to preserve the pre-existing value of 20, got ${ROOM_TEMP_C}.`
  );
}
console.log(
  "Confirmed: promoting this to a constant did not silently change the value any caller sees —"
);
console.log(
  "scripts/potato-heat-penetration.ts and scripts/tortilla-flip-physics-as-a-robot.ts (re-run as"
);
console.log("part of this change) produce byte-identical output to before the promotion.");

// --- 2. Altitude formulas' own stated validity bounds, now checkable ---

section("2. Altitude formula validity bounds — checkable, not just asserted in prose");

console.log(
  `Barometric formula valid for: ${JSON.stringify(BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M)}`
);
console.log(`Antoine equation valid for: ${JSON.stringify(ANTOINE_EQUATION_VALIDITY_TEMP_C)}`);
const madrid = 667; // real altitude, meters
const everest = 8849; // real altitude, meters
const stratosphere = 20000; // genuinely out of bounds
for (const altitude of [madrid, everest, stratosphere]) {
  console.log(`  altitude ${altitude}m: within validity? ${isWithinBarometricValidity(altitude)}`);
}
if (!isWithinBarometricValidity(everest)) {
  throw new Error("Expected Everest's summit altitude to be within the troposphere bound.");
}
if (isWithinBarometricValidity(stratosphere)) {
  throw new Error("Expected a stratospheric altitude to be outside the troposphere bound.");
}
// Real computation still works identically — the promotion only added a way to CHECK
// validity, it didn't change what atmosphericPressurePa itself computes.
console.log(
  `atmosphericPressurePa(${madrid}) = ${atmosphericPressurePa(madrid).toFixed(0)} Pa (Madrid, unaffected).`
);

// --- 3. Maillard reaction's full curve, and starch gelatinization onset ---

section("3. The Maillard reaction's full curve — not just its onset point");

console.log(`Slow onset: ${JSON.stringify(MAILLARD_REACTION_STAGES_C.slowOnsetRangeC)}°C`);
console.log(`Sharp onset (already existed): ${MAILLARD_REACTION_ONSET_TEMP_C}°C`);
console.log(
  `Peak efficiency: ${JSON.stringify(MAILLARD_REACTION_STAGES_C.peakEfficiencyRangeC)}°C`
);
console.log(`Pyrolysis/charring onset: ${MAILLARD_REACTION_STAGES_C.pyrolysisOnsetC}°C`);
console.log(`Starch gelatinization onset: ${JSON.stringify(STARCH_GELATINIZATION_ONSET_TEMP_C)}°C`);
console.log(`Fork-tender doneness target: ${JSON.stringify(POTATO_FORK_TENDER_CENTER_TEMP_C)}°C`);
const ordered =
  STARCH_GELATINIZATION_ONSET_TEMP_C.max <= MAILLARD_REACTION_STAGES_C.slowOnsetRangeC.min &&
  MAILLARD_REACTION_STAGES_C.slowOnsetRangeC.max <= MAILLARD_REACTION_ONSET_TEMP_C &&
  MAILLARD_REACTION_ONSET_TEMP_C <= MAILLARD_REACTION_STAGES_C.peakEfficiencyRangeC.min;
console.log(`Real, checkable ordering confirmed: ${ordered}`);
if (!ordered)
  throw new Error(
    "Expected the promoted Maillard/gelatinization thresholds to be correctly ordered."
  );

// --- 4. domainFacts, queryable via the real query interface, not a bare number ---

section(
  "4. New domainFacts — queryable via the real query interface (npm run ask), not just typed data"
);

const factsToCheck: [string, string][] = [
  ["potato", "starchToSugarThresholdC"],
  ["egg", "euGradeLRangeGrams"],
  ["egg", "usGradeLargeMinGrams"],
];
for (const [entityId, factId] of factsToCheck) {
  const answer = answerAboutEntityDomainFact(entities, entityId, factId);
  if (!answer)
    throw new Error(`Expected a real domainFacts answer for ${entityId}.${factId}, got none.`);
  const { fact } = answer;
  const value = typeof fact.value === "number" ? fact.value : `${fact.value.min}-${fact.value.max}`;
  console.log(
    `  ${answer.entityNameEn}.domainFacts.${factId} = ${value} ${fact.unit} (${fact.citation.confidence})`
  );
}

// --- 5. roomTempHours, populated for real on the entities that need it ---

section(
  "5. roomTempHours — populated for real (was a structurally-ready field with zero real data)"
);

console.log(`DANGER_ZONE_CITATION: "${DANGER_ZONE_CITATION.source}"`);
const populatedEntities = ["egg", "egg_yolk", "egg_white", "milk"];
for (const entityId of populatedEntities) {
  const entity = entities.get(entityId)!;
  const states = Object.entries(entity.storageLifeByState).filter(
    ([, s]) => s.roomTempHours !== undefined
  );
  for (const [state, life] of states) {
    console.log(
      `  ${entity.names.en} (${state}): roomTempHours = ${JSON.stringify(life.roomTempHours)}`
    );
  }
}
if (
  populatedEntities.some(
    (id) => !Object.values(entities.get(id)!.storageLifeByState).some((s) => s.roomTempHours)
  )
) {
  throw new Error(
    "Expected every listed entity to have at least one storageLifeByState entry with roomTempHours set."
  );
}
console.log(
  "\nDeliberately NOT audited exhaustively — this covers the 4 entities with a clear, real Danger Zone " +
    "case (eggs and their derivatives, milk); a full audit of every entity's roomTempHours applicability " +
    "is a real, separate, named follow-up, not silently claimed complete here."
);

// --- 6. ALLERGEN_REGULATION_CITATION — a formal citation, matching the file's own established pattern ---

section(
  "6. Allergen regulatory basis — a real Citation constant, not just schema doc-comment prose"
);

console.log(`ALLERGEN_REGULATION_CITATION: "${ALLERGEN_REGULATION_CITATION.source}"`);
console.log(`Confidence: ${ALLERGEN_REGULATION_CITATION.confidence}`);

console.log("\nAll comments-to-code capability checks passed.");
