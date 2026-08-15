import type { Citation, Entity } from "./ingredient.ts";

/**
 * Real heat-transfer physics, not another reference table — added
 * 2026-08-15, directly in response to the user naming the actual
 * mechanism: hot oil browns a potato's surface quickly while its low
 * thermal conductivity means the CENTER lags behind, sometimes badly
 * enough to burn the outside before the inside is done. Deferred from
 * `cut-dimensions.ts` (same day, geometry only) specifically because
 * this needed real math, not just a citation.
 *
 * THE MODEL: 1D transient conduction in an infinite slab (Fourier's
 * second law) — the standard "one-term approximation" every heat-
 * transfer textbook gives for exactly this geometry (e.g. Incropera &
 * DeWitt, *Fundamentals of Heat and Mass Transfer*, the plane-wall
 * transient-conduction chapter). For a slab whose SURFACE is assumed to
 * jump instantly to the surrounding medium's temperature (Biot number →
 * ∞ — see the honesty caveat below), the center-plane temperature is:
 *
 *   θ(t) = (T_center(t) − T_surface) / (T_initial − T_surface)
 *        = A₁ · exp(−λ₁² · Fo),   Fo = α·t / L²
 *
 * where L is the slab's HALF-thickness (heat enters from both flat
 * faces), α = k/(ρ·cp) is thermal diffusivity, and for the Bi→∞ case
 * λ₁ = π/2 ≈ 1.5708, A₁ = 4/π ≈ 1.2732 — exact values for this specific
 * case (not a recalled table lookup), confirmed against multiple
 * independent academic sources 2026-08-15. Valid for Fo > 0.2 (the
 * one-term approximation's own stated validity condition, the same
 * "state it, don't silently assume it always holds" discipline
 * `thermal.ts`'s `validityCondition` field already uses) —
 * `tests/heat-penetration.test.ts` checks the capability-test script's
 * actual scenarios stay within this range, rather than only asserting it.
 *
 * TWO HONESTY CAVEATS, NAMED EXPLICITLY, NOT LEFT IMPLICIT:
 *
 * 1. Bi→∞ means this model treats the potato's SURFACE as reaching the
 *    oil's temperature INSTANTLY. Real oil-frying convective heat
 *    transfer is fast but not infinite — a genuine convective heat-
 *    transfer coefficient for oil frying (which would need its own real
 *    citation, and depends on oil velocity/piece geometry — deeper food-
 *    engineering territory than this pass attempts) would predict a
 *    slightly SLOWER center-heating rate than this model does. This
 *    model is therefore a reasonable LOWER BOUND on time-to-center-
 *    doneness, not an exact prediction — named here rather than implied
 *    to be more precise than it is.
 * 2. This computes ONE real physical quantity: how long the CENTER takes
 *    to reach a target temperature. It does NOT model browning/Maillard
 *    reaction kinetics at the surface, so it cannot say whether the
 *    outside actually "burns" by that point — only how long the center
 *    takes. Comparing that time against a real surface-browning-kinetics
 *    figure (which doesn't exist anywhere in this repo) is a further,
 *    deliberately deferred step, not attempted here. Matches this
 *    session's standing refusal to fabricate a "texture" output
 *    (`cut-dimensions.ts`'s own doc comment) — this file computes real
 *    TIME, not texture.
 * 3. THE COMPUTED TIMES ARE SHORT — SECONDS TO TENS OF SECONDS FOR A REAL
 *    3-5MM SLICE — AND THAT IS CORRECT, NOT A BUG, BUT EASY TO MISREAD.
 *    A 3mm slice (1.5mm half-thickness) in 175°C oil reaches a 97°C
 *    center in ~7 seconds by pure conduction (checked directly against
 *    this file's own math 2026-08-15) — far shorter than
 *    `crispy_french_fries.json`'s real 180s finishing fry. This is NOT a
 *    contradiction: pure heat conduction is only PART of what real
 *    frying time is spent on. This repo's own already-cited Kalogianni &
 *    Smith (2013) found most property change happens in the first 1-2
 *    minutes and crust thickness plateaus DESPITE continued heat
 *    penetration — real frying time is dominated by surface moisture
 *    evaporation and crust formation, physical processes this module
 *    does not model AT ALL (not "approximately," entirely absent). This
 *    module answers a narrower, real question — how fast heat physically
 *    reaches the center — not "how long should I actually fry this,"
 *    which depends on those other, unmodeled processes too.
 */

const ONE_TERM_LAMBDA_1 = Math.PI / 2; // exact, Bi -> infinity case
const ONE_TERM_A_1 = 4 / Math.PI; // exact, Bi -> infinity case
const MIN_VALID_FOURIER_NUMBER = 0.2; // one-term approximation's own stated validity condition

export const ONE_TERM_APPROXIMATION_CITATION: Citation = {
  source:
    "Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer* — the standard one-term approximation for 1D transient conduction in a plane wall (Table of lambda_1/A_1 coefficients by Biot number). For Bi -> infinity: lambda_1 = pi/2 (1.5708), A_1 = 4/pi (1.2732), valid for Fourier number > 0.2 — confirmed via multiple independent academic sources 2026-08-15, not just recalled.",
  confidence: "standard_reference",
  note:
    "The lambda_1/A_1 VALUES for the Bi->infinity case are exact, derivable mathematics (the eigenvalue equation cos(lambda)=0 has first root pi/2), not empirical figures needing independent verification — the citation is for the METHOD (which physical assumptions this approximation makes, and its Fo>0.2 validity range), not a number that could itself be wrong.",
};

/** "Fork tender" internal potato temperature — the practically-meaningful
 *  "is it actually done" target, distinct from and higher than starch
 *  gelatinization ONSET (56-66C, where texture starts changing but isn't
 *  complete). Sourced from baked-potato measurements (the most commonly
 *  measured/documented case) and used here as a general doneness target
 *  regardless of cooking method — the underlying starch chemistry is the
 *  same, the same kind of cross-technique reuse `EGG_BOIL_DONENESS`'s
 *  boiling-start figures already get reused elsewhere in this repo. */
export const POTATO_FORK_TENDER_CENTER_TEMP_C = { min: 96, max: 99 } as const;

export const POTATO_DONENESS_TEMP_CITATION: Citation = {
  source:
    "ThermoWorks (already this repo's own cited source for French fry temps, par-fry.json) and the Idaho Potato Commission both converge on 96-99C (205-210F) internal temperature for a fully cooked, fork-tender baked potato. Distinct from starch gelatinization ONSET, commonly cited across food-science sources at 56-66C — texture starts changing there, but full tenderness needs the higher figure.",
  confidence: "commonly_cited_unverified",
  note: "Checked via web search 2026-08-15, not independently re-verified against a peer-reviewed primary source. Measured for baked potato specifically; used here as a general doneness target since the underlying starch-gelatinization chemistry doesn't depend on cooking method.",
};

/** Thermal diffusivity (alpha = k / (rho * cp), m^2/s) from an entity's
 *  own thermophysical fields. Throws — not undefined — if any of the
 *  three inputs is missing, same "a caller must know this doesn't apply
 *  yet" contract every other reference-table lookup in this repo uses. */
export function thermalDiffusivityM2PerS(entity: Entity): number {
  const t = entity.thermophysical;
  if (!t?.thermalConductivityWPerMK || !t?.densityKgPerM3 || !t?.specificHeatJPerKgK) {
    throw new Error(
      `Cannot compute thermal diffusivity for "${entity.id}": missing thermalConductivityWPerMK/densityKgPerM3/specificHeatJPerKgK on its thermophysical block.`
    );
  }
  return t.thermalConductivityWPerMK / (t.densityKgPerM3 * t.specificHeatJPerKgK);
}

export interface SlabConductionParams {
  /** Slab HALF-thickness in meters (heat enters from both flat faces —
   *  for a cut.json "sliced" piece, half of cutShapeDimensionMm's value,
   *  converted from mm). */
  halfThicknessM: number;
  diffusivityM2PerS: number;
  initialTempC: number;
  /** The surrounding medium's temperature (oil/water) — assumed to be
   *  the slab's surface temperature under this model's Bi->infinity
   *  simplification (see this file's own doc comment). */
  surfaceTempC: number;
}

function fourierNumber(params: SlabConductionParams, elapsedSeconds: number): number {
  return (params.diffusivityM2PerS * elapsedSeconds) / params.halfThicknessM ** 2;
}

/** The center-plane temperature after `elapsedSeconds` of heating/cooling
 *  toward `surfaceTempC`. Real physics, not a lookup — see this file's
 *  own doc comment for the formula and its two honesty caveats. */
export function centerTempCAfterSeconds(params: SlabConductionParams, elapsedSeconds: number): number {
  const fo = fourierNumber(params, elapsedSeconds);
  const theta = ONE_TERM_A_1 * Math.exp(-(ONE_TERM_LAMBDA_1 ** 2) * fo);
  return params.surfaceTempC + theta * (params.initialTempC - params.surfaceTempC);
}

/** The inverse, and the actually useful query: how many seconds until the
 *  CENTER reaches `targetCenterTempC`. Throws on real, physically
 *  meaningless inputs rather than returning NaN/Infinity silently:
 *  no driving force (surface == initial temp), or a target on the wrong
 *  side of the driving force (colder than the surface while heating, or
 *  hotter than the surface while cooling — the center can never overshoot
 *  the medium it's equilibrating toward). */
export function secondsForCenterToReachTempC(params: SlabConductionParams, targetCenterTempC: number): number {
  const { initialTempC, surfaceTempC } = params;
  if (surfaceTempC === initialTempC) {
    throw new Error("secondsForCenterToReachTempC: surfaceTempC equals initialTempC — no driving force, the target is never reached.");
  }
  const heating = surfaceTempC > initialTempC;
  if (heating && (targetCenterTempC <= initialTempC || targetCenterTempC >= surfaceTempC)) {
    throw new Error(
      `secondsForCenterToReachTempC: targetCenterTempC ${targetCenterTempC}C is not between initialTempC ${initialTempC}C and surfaceTempC ${surfaceTempC}C — the center can never reach it while heating toward the surrounding medium.`
    );
  }
  if (!heating && (targetCenterTempC >= initialTempC || targetCenterTempC <= surfaceTempC)) {
    throw new Error(
      `secondsForCenterToReachTempC: targetCenterTempC ${targetCenterTempC}C is not between surfaceTempC ${surfaceTempC}C and initialTempC ${initialTempC}C — the center can never reach it while cooling toward the surrounding medium.`
    );
  }
  const theta = (targetCenterTempC - surfaceTempC) / (initialTempC - surfaceTempC);
  const fo = -Math.log(theta / ONE_TERM_A_1) / ONE_TERM_LAMBDA_1 ** 2;
  return (fo * params.halfThicknessM ** 2) / params.diffusivityM2PerS;
}

/** Exposed so callers/tests can confirm a given scenario actually falls
 *  within the one-term approximation's Fo > 0.2 validity condition,
 *  rather than only asserting it in prose. */
export function isWithinValidityCondition(params: SlabConductionParams, elapsedSeconds: number): boolean {
  return fourierNumber(params, elapsedSeconds) > MIN_VALID_FOURIER_NUMBER;
}
