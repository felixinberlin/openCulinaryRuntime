import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import {
  thermalDiffusivityM2PerS,
  secondsForCenterToReachTempC,
  isWithinValidityCondition,
  effectiveHalfThicknessM,
  POTATO_FORK_TENDER_CENTER_TEMP_C,
  MAILLARD_REACTION_ONSET_TEMP_C,
  ROOM_TEMP_C,
} from "../src/heat-penetration.ts";
import { cutShapeDimensionMm } from "../src/cut-dimensions.ts";

/**
 * Capability test proving the real mechanism the user named directly:
 * hot oil browns the outside quickly while the potato's low thermal
 * conductivity means the CENTER lags behind — sometimes deliberately used
 * for a crispy-outside/tender-inside texture, sometimes a mistake if the
 * cook doesn't account for it. See heat-penetration.ts's own doc comment
 * for the full honesty caveats this script's numbers are subject to.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const potato = entities.get("potato")!;
const alpha = thermalDiffusivityM2PerS(potato);

const targetC = (POTATO_FORK_TENDER_CENTER_TEMP_C.min + POTATO_FORK_TENDER_CENTER_TEMP_C.max) / 2;
const initialTempC = ROOM_TEMP_C; // heat-penetration.ts's own cited room-temperature constant

const sliceRange = cutShapeDimensionMm("sliced"); // cut-dimensions.ts's real, cited 3-5mm range
const thinActualThicknessM = sliceRange.min / 1000;
const thickActualThicknessM = sliceRange.max / 1000;
// Everything below this point assumes submerged/deep-fried (heatedFaces:
// 2) unless a section says otherwise — see the "swimming in oil vs. a
// little" section near the end for the one-face comparison.
const thinHalfThicknessM = effectiveHalfThicknessM(thinActualThicknessM, 2);
const thickHalfThicknessM = effectiveHalfThicknessM(thickActualThicknessM, 2);

console.log(`Target center temp: ${targetC}°C (midpoint of POTATO_FORK_TENDER_CENTER_TEMP_C)\n`);

console.log("=== Same oil temp (175°C), different thickness ===\n");
for (const [label, halfThicknessM] of [
  [`thin (${sliceRange.min}mm)`, thinHalfThicknessM],
  [`thick (${sliceRange.max}mm)`, thickHalfThicknessM],
] as const) {
  const params = { halfThicknessM, diffusivityM2PerS: alpha, initialTempC, surfaceTempC: 175 };
  const seconds = secondsForCenterToReachTempC(params, targetC);
  console.log(
    `  ${label}: ${seconds.toFixed(1)}s (Fo>0.2 valid: ${isWithinValidityCondition(params, seconds)})`
  );
}

console.log("\n=== Same thickness (thin, 3mm), different oil temp ===\n");
for (const surfaceTempC of [120, 165, 191, 200] as const) {
  const params = {
    halfThicknessM: thinHalfThicknessM,
    diffusivityM2PerS: alpha,
    initialTempC,
    surfaceTempC,
  };
  const seconds = secondsForCenterToReachTempC(params, targetC);
  const browningPossible = surfaceTempC >= MAILLARD_REACTION_ONSET_TEMP_C;
  console.log(
    `  ${surfaceTempC}°C oil: ${seconds.toFixed(1)}s (Fo>0.2 valid: ${isWithinValidityCondition(params, seconds)}) — ` +
      `${browningPossible ? "above" : "below"} Maillard onset (${MAILLARD_REACTION_ONSET_TEMP_C}°C): browning ${browningPossible ? "chemically possible" : "NOT possible at this oil temp"}`
  );
}
console.log(
  "\n(Only the ONSET temperature, not a kinetics model — this says nothing about how fast browning happens once " +
    "above it, only whether it can happen at all. 120°C oil literally cannot brown a potato's surface no matter " +
    "how long it fries — a real, checkable reason low-heat cooking stays pale.)"
);

console.log(
  "\nThe real mechanism, now computed rather than just described: hotter oil and/or a thicker slice both " +
    "change how long the CENTER takes to reach doneness — the concrete reason a cook choosing high heat + thin " +
    "cut (fast center penetration, less time for the surface to over-brown) gets a different result than low " +
    "heat + thick cut (slow, even penetration), a real, deliberate technique choice, not always a mistake."
);

console.log(
  "\n=== Swimming in oil (both faces) vs. only a little (one face) — same actual thickness, same oil temp ===\n"
);
for (const [label, actualThicknessM] of [
  [`thin (${sliceRange.min}mm)`, thinActualThicknessM],
  [`thick (${sliceRange.max}mm)`, thickActualThicknessM],
] as const) {
  const submerged = {
    halfThicknessM: effectiveHalfThicknessM(actualThicknessM, 2),
    diffusivityM2PerS: alpha,
    initialTempC,
    surfaceTempC: 175,
  };
  const shallow = {
    halfThicknessM: effectiveHalfThicknessM(actualThicknessM, 1),
    diffusivityM2PerS: alpha,
    initialTempC,
    surfaceTempC: 175,
  };
  const secondsSubmerged = secondsForCenterToReachTempC(submerged, targetC);
  const secondsShallow = secondsForCenterToReachTempC(shallow, targetC);
  console.log(
    `  ${label}, submerged (deep-fried, both faces in oil): ${secondsSubmerged.toFixed(1)}s`
  );
  console.log(
    `  ${label}, shallow oil (pan-fried, one face in oil):  ${secondsShallow.toFixed(1)}s (${(secondsShallow / secondsSubmerged).toFixed(1)}x longer)`
  );
}
console.log(
  "\nSame slice, same oil temperature — only how many faces actually touch the oil changed, and the center " +
    "takes ~4x longer with only one face exposed (heat has to travel through the FULL thickness instead of " +
    "just half of it — a real, derivable consequence of the same physics, not a separately fit number)."
);

console.log(
  "\nIMPORTANT — what this does NOT show: these times (single-digit to tens of seconds) are far shorter than " +
    "real recipe fry times (crispy_french_fries.json: 180s finishing fry) because this is PURE heat conduction " +
    "only — it does not model surface moisture evaporation or crust formation, which this repo's own cited " +
    "Kalogianni & Smith (2013) found dominates real frying time. This answers 'how fast does heat physically " +
    "reach the center,' not 'how long should I fry this' — see heat-penetration.ts's own doc comment."
);
