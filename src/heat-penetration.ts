import type { Citation, Entity } from "./ingredient.ts";

/**
 * Real heat-transfer physics for how fast heat reaches the CENTER of a
 * slab of food in hot oil/water — 1D transient conduction (Fourier's
 * second law), the standard one-term approximation for a plane wall with
 * Bi→∞ (surface instantly at the medium's temperature). Answers a
 * narrower question than "is it done": how long conduction alone takes,
 * not browning/crust formation, which dominate real frying time. See
 * `reference/heat-penetration.md` for the formula, honesty caveats, and
 * citations.
 */

/** Exact, Bi -> infinity case values. */
const ONE_TERM_LAMBDA_1 = Math.PI / 2;
const ONE_TERM_A_1 = 4 / Math.PI;
/** The one-term approximation's own stated validity condition. */
const MIN_VALID_FOURIER_NUMBER = 0.2;

export const ONE_TERM_APPROXIMATION_CITATION: Citation = {
  source:
    "Incropera & DeWitt, *Fundamentals of Heat and Mass Transfer* — the standard one-term approximation for 1D transient conduction in a plane wall (Table of lambda_1/A_1 coefficients by Biot number). For Bi -> infinity: lambda_1 = pi/2 (1.5708), A_1 = 4/pi (1.2732), valid for Fourier number > 0.2 — confirmed via multiple independent academic sources 2026-08-15, not just recalled.",
  confidence: "standard_reference",
  note: "The lambda_1/A_1 values for the Bi->infinity case are exact, derivable mathematics, not empirical figures needing independent verification — see reference/heat-penetration.md.",
};

/** "Fork tender" internal potato temperature — distinct from and higher
 *  than starch gelatinization onset (`STARCH_GELATINIZATION_ONSET_TEMP_C`).
 *  See `reference/heat-penetration.md`. */
export const POTATO_FORK_TENDER_CENTER_TEMP_C = { min: 96, max: 99 } as const;

export const POTATO_DONENESS_TEMP_CITATION: Citation = {
  source:
    "ThermoWorks (already this repo's own cited source for French fry temps, par-fry.json) and the Idaho Potato Commission both converge on 96-99C (205-210F) internal temperature for a fully cooked, fork-tender baked potato. Distinct from starch gelatinization ONSET, commonly cited across food-science sources at 56-66C — texture starts changing there, but full tenderness needs the higher figure.",
  confidence: "commonly_cited_unverified",
  note: "Checked via web search 2026-08-15. Measured for baked potato specifically; used here as a general doneness target since the underlying starch-gelatinization chemistry doesn't depend on cooking method.",
};

/** Temperature above which starch granules begin gelatinizing (texture
 *  starts changing) — lower than full tenderness. See `reference/heat-penetration.md`. */
export const STARCH_GELATINIZATION_ONSET_TEMP_C = { min: 56, max: 66 } as const;

/** Temperature above which the Maillard reaction (browning/crust flavor)
 *  becomes possible at all — not a kinetics model, says nothing about
 *  how fast browning proceeds once above it. See `reference/heat-penetration.md`. */
export const MAILLARD_REACTION_ONSET_TEMP_C = 140;

/** The rest of the same curve `MAILLARD_REACTION_ONSET_TEMP_C` names the
 *  start of: slow onset, sharp acceleration at onset, peak efficiency,
 *  then pyrolysis takes over. See `reference/heat-penetration.md`. */
export const MAILLARD_REACTION_STAGES_C = {
  slowOnsetRangeC: { min: 115, max: 130 },
  peakEfficiencyRangeC: { min: 165, max: 200 },
  pyrolysisOnsetC: 180,
} as const;

export const MAILLARD_REACTION_ONSET_CITATION: Citation = {
  source:
    "Multiple independent food-science sources converge on ~140C (280F) as the onset of the Maillard reaction under normal cooking conditions — the reaction proceeds slowly from ~115-130C, accelerates sharply from ~140C, peaks in efficiency around 165-200C, and above ~180-190C other processes (pyrolysis/charring) take over.",
  confidence: "commonly_cited_unverified",
  note: "Checked via web search 2026-08-15. Not independently re-verified against a peer-reviewed primary source. Covers MAILLARD_REACTION_STAGES_C too — see reference/heat-penetration.md.",
};

/** Room temperature, the low end of the real 20-25C standard range — one
 *  cited source of truth for a value several callers across this repo
 *  independently redeclared. See `reference/heat-penetration.md`. */
export const ROOM_TEMP_C = 20;

export const ROOM_TEMP_CITATION: Citation = {
  source:
    "U.S. Pharmacopeia (USP) defines room temperature as 20-25C (68-77F); FDA/USDA food-safety guidance applies the same baseline for holding perishable food (the identical range this repo's own Danger Zone citation, ingredient.ts's StorageLifeSchema, already uses).",
  confidence: "commonly_cited_unverified",
  note: "Checked via web search 2026-08-18. 20C is the LOW end of the real 20-25C range, a conservative choice for a starting-temperature assumption. See reference/heat-penetration.md.",
};

/** Thermal diffusivity (alpha = k / (rho * cp), m^2/s) from an entity's
 *  own thermophysical fields. Throws if any input is missing. */
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
  /** Slab HALF-thickness in meters (heat enters from both flat faces). */
  halfThicknessM: number;
  diffusivityM2PerS: number;
  initialTempC: number;
  /** The surrounding medium's temperature (oil/water) — assumed to be
   *  the slab's surface temperature under this model's Bi->infinity
   *  simplification. */
  surfaceTempC: number;
}

function fourierNumber(params: SlabConductionParams, elapsedSeconds: number): number {
  return (params.diffusivityM2PerS * elapsedSeconds) / params.halfThicknessM ** 2;
}

/** The center-plane temperature after `elapsedSeconds` of heating/cooling
 *  toward `surfaceTempC`. See `reference/heat-penetration.md` for the
 *  formula and its honesty caveats. */
export function centerTempCAfterSeconds(
  params: SlabConductionParams,
  elapsedSeconds: number
): number {
  const fo = fourierNumber(params, elapsedSeconds);
  const theta = ONE_TERM_A_1 * Math.exp(-(ONE_TERM_LAMBDA_1 ** 2) * fo);
  return params.surfaceTempC + theta * (params.initialTempC - params.surfaceTempC);
}

/** The inverse, and the actually useful query: how many seconds until the
 *  CENTER reaches `targetCenterTempC`. Throws on physically meaningless
 *  inputs (no driving force, or a target on the wrong side of it) rather
 *  than returning NaN/Infinity silently. */
export function secondsForCenterToReachTempC(
  params: SlabConductionParams,
  targetCenterTempC: number
): number {
  const { initialTempC, surfaceTempC } = params;
  if (surfaceTempC === initialTempC) {
    throw new Error(
      "secondsForCenterToReachTempC: surfaceTempC equals initialTempC — no driving force, the target is never reached."
    );
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

/** Whether a given scenario actually falls within the one-term
 *  approximation's Fo > 0.2 validity condition. */
export function isWithinValidityCondition(
  params: SlabConductionParams,
  elapsedSeconds: number
): boolean {
  return fourierNumber(params, elapsedSeconds) > MIN_VALID_FOURIER_NUMBER;
}

export const SYMMETRY_INSULATED_BOUNDARY_CITATION: Citation = {
  source:
    "Standard heat-transfer symmetry argument (e.g. Cengel, *Heat and Mass Transfer*; Incropera & DeWitt, same chapter as this file's own one-term approximation): a plane wall heated identically on BOTH faces has zero heat flux at its centerline by symmetry, so that centerline behaves exactly like an INSULATED boundary — meaning a slab heated from only ONE face, with the other face insulated, is physically identical to HALF of a symmetric slab of DOUBLE the thickness. Confirmed via multiple independent sources 2026-08-15.",
  confidence: "standard_reference",
  note: "The symmetry argument itself is exact, standard textbook material. Treating a pan-fried face as fully insulated is this file's own added simplification — see reference/heat-penetration.md.",
};

/**
 * Converts a real, physical slice thickness into the HALF-thickness the
 * model above actually needs, depending on how many faces are actually in
 * contact with hot oil (2 = submerged/deep-fried, 1 = shallow oil/pan-
 * frying, treated via a symmetry argument as equivalent to double the
 * thickness heated from both sides). See `reference/heat-penetration.md`.
 */
export function effectiveHalfThicknessM(actualThicknessM: number, heatedFaces: 1 | 2): number {
  return heatedFaces === 2 ? actualThicknessM / 2 : actualThicknessM;
}
