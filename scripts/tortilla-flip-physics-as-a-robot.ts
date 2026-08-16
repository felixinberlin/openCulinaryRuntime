import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import {
  thermalDiffusivityM2PerS,
  effectiveHalfThicknessM,
  secondsForCenterToReachTempC,
  isWithinValidityCondition,
  type SlabConductionParams,
} from "../src/heat-penetration.ts";

/**
 * First real proof for tortilla_mixture.json's new thermophysical block —
 * added 2026-08-16 directly answering "is flipping a tortilla the same
 * logic as agitating potato pieces in oil." Reuses heat-penetration.ts's
 * EXISTING slab-conduction model with ZERO code changes — what was
 * actually missing was real thermophysical data on the composite entity,
 * not new physics.
 *
 * Deliberately does NOT claim to compute the exact "flipped once, halfway
 * through" time — that needs the actual spatial temperature profile at
 * the flip moment as a real, non-uniform initial condition for stage two,
 * which this repo's one-term approximation does not expose (only the
 * CENTER temperature). What IS computed here, honestly, is a real BRACKET
 * both ends of which are directly reachable from existing code:
 *   t_symmetric (both faces heated from t=0 — an idealized LOWER bound,
 *     physically impossible for an actual single flip, but a real,
 *     computable floor)
 *   <= t_actual_with_one_flip (NOT computed)
 *   <= t_singleSided (never flipped — a real, honest UPPER bound)
 *
 * This directly corrects a user-supplied external report's own central
 * claim, which modeled "with flip" as equivalent to t_symmetric for the
 * FULL cooking duration — the physics of fully-submerged frying, not of
 * a sequential mid-cook flip. See LEARNINGS_ENGINE.md's own entry for
 * the full critique.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const tortilla = entities.get("tortilla_mixture")!;

const alpha = thermalDiffusivityM2PerS(tortilla);
const actualThicknessM = 0.028; // 2.8cm — this entity's own derived, cited thickness
const initialTempC = 20; // room/rested temperature — same convention potato-heat-penetration.ts uses
const surfaceTempC = 175; // real pan temperature, matching fry.json's own oilTempC precedent used elsewhere
const targetCenterTempC = 71; // egg_cooking.json's own real, cited instantaneous safety threshold — not invented here

console.log("Goal: bound the real time for a tortilla's center to reach a safe, set temperature — not fake a single number.\n");

const symmetricParams: SlabConductionParams = {
  halfThicknessM: effectiveHalfThicknessM(actualThicknessM, 2),
  diffusivityM2PerS: alpha,
  initialTempC,
  surfaceTempC,
};
const singleSidedParams: SlabConductionParams = {
  halfThicknessM: effectiveHalfThicknessM(actualThicknessM, 1),
  diffusivityM2PerS: alpha,
  initialTempC,
  surfaceTempC,
};

const tSymmetric = secondsForCenterToReachTempC(symmetricParams, targetCenterTempC);
const tSingleSided = secondsForCenterToReachTempC(singleSidedParams, targetCenterTempC);

console.log(`Real, computed 2.8cm-thick tortilla, 20°C start, 175°C pan, target center 71°C (egg_cooking.json's real threshold):\n`);
console.log(`  LOWER bound (t_symmetric, both faces heated from t=0 — idealized, not achievable by an actual flip):`);
console.log(`    ${tSymmetric.toFixed(0)}s (${(tSymmetric / 60).toFixed(1)} min)`);
console.log(`  UPPER bound (t_singleSided, NEVER flipped — a real, honest worst case):`);
console.log(`    ${tSingleSided.toFixed(0)}s (${(tSingleSided / 60).toFixed(1)} min)`);
console.log(`  Ratio: ${(tSingleSided / tSymmetric).toFixed(2)}x — matches the model's own derivable L² scaling (4x for a halved effective length).`);

console.log(
  `\nThe TRUE 'flipped exactly once, halfway through' time lies somewhere between these two — genuinely NOT computed ` +
    `here (see tortilla_mixture.json's own flipPhysicsNote for exactly why: the one-term approximation this repo uses ` +
    `only exposes the CENTER temperature, not the full spatial profile needed as stage two's real initial condition).`
);

console.log(
  `\nValidity check (Fo > 0.2, this model's own stated condition): symmetric case ${
    isWithinValidityCondition(symmetricParams, tSymmetric) ? "PASSES" : "FAILS"
  }, single-sided case ${isWithinValidityCondition(singleSidedParams, tSingleSided) ? "PASSES" : "FAILS"}.`
);

console.log(
  "\nSame underlying logic as agitating potato pieces while frying, confirmed: both are instances of changing which " +
    "face of an object is exposed to the heat source (formally 'surface renewal' in heat-transfer theory) — stirring " +
    "many small pieces rapidly approximates the SYMMETRIC (both-faces) case on average; flipping one large mass once " +
    "is a real, sequential, single-flip case, genuinely between the two bounds above, not equal to either one."
);
