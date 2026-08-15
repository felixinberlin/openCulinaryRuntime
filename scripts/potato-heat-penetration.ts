import { join } from "node:path";
import { loadEntities } from "../src/registry.ts";
import {
  thermalDiffusivityM2PerS,
  secondsForCenterToReachTempC,
  isWithinValidityCondition,
  POTATO_FORK_TENDER_CENTER_TEMP_C,
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
const initialTempC = 20; // room temperature, stated assumption

const sliceRange = cutShapeDimensionMm("sliced"); // cut-dimensions.ts's real, cited 3-5mm range
const thinHalfThicknessM = sliceRange.min / 2 / 1000;
const thickHalfThicknessM = sliceRange.max / 2 / 1000;

console.log(`Target center temp: ${targetC}°C (midpoint of POTATO_FORK_TENDER_CENTER_TEMP_C)\n`);

console.log("=== Same oil temp (175°C), different thickness ===\n");
for (const [label, halfThicknessM] of [
  [`thin (${sliceRange.min}mm)`, thinHalfThicknessM],
  [`thick (${sliceRange.max}mm)`, thickHalfThicknessM],
] as const) {
  const params = { halfThicknessM, diffusivityM2PerS: alpha, initialTempC, surfaceTempC: 175 };
  const seconds = secondsForCenterToReachTempC(params, targetC);
  console.log(`  ${label}: ${seconds.toFixed(1)}s (Fo>0.2 valid: ${isWithinValidityCondition(params, seconds)})`);
}

console.log("\n=== Same thickness (thin, 3mm), different oil temp ===\n");
for (const surfaceTempC of [120, 165, 191, 200] as const) {
  const params = { halfThicknessM: thinHalfThicknessM, diffusivityM2PerS: alpha, initialTempC, surfaceTempC };
  const seconds = secondsForCenterToReachTempC(params, targetC);
  console.log(`  ${surfaceTempC}°C oil: ${seconds.toFixed(1)}s (Fo>0.2 valid: ${isWithinValidityCondition(params, seconds)})`);
}

console.log(
  "\nThe real mechanism, now computed rather than just described: hotter oil and/or a thicker slice both " +
    "change how long the CENTER takes to reach doneness — the concrete reason a cook choosing high heat + thin " +
    "cut (fast center penetration, less time for the surface to over-brown) gets a different result than low " +
    "heat + thick cut (slow, even penetration), a real, deliberate technique choice, not always a mistake."
);

console.log(
  "\nIMPORTANT — what this does NOT show: these times (single-digit to tens of seconds) are far shorter than " +
    "real recipe fry times (crispy_french_fries.json: 180s finishing fry) because this is PURE heat conduction " +
    "only — it does not model surface moisture evaporation or crust formation, which this repo's own cited " +
    "Kalogianni & Smith (2013) found dominates real frying time. This answers 'how fast does heat physically " +
    "reach the center,' not 'how long should I fry this' — see heat-penetration.ts's own doc comment."
);
