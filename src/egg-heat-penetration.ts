import type { Citation } from "./ingredient.ts";

/**
 * Real, computed spherical heat-conduction physics for whole-egg boiling
 * time (Charles Williams' closed-form transient-conduction formula for a
 * homogeneous sphere) — the whole-egg sibling of `heat-penetration.ts`'s
 * plane-slab model. Cross-checked against `EGG_BOIL_DONENESS`'s empirical
 * ranges, not treated as a replacement for them. See
 * `reference/egg-heat-penetration.md` for the formula, dimensional
 * analysis, cross-check results, and citations.
 */

export const WILLIAMS_FORMULA_CITATION: Citation = {
  source:
    'University of Exeter, Department of Physics and Astronomy, "Boiling an Egg" (Charles Williams\' closed-form spherical transient-conduction formula) — https://www.exeter.ac.uk/research-centres/theoretical-physics/boiling-an-egg/. A well-known, widely-reported piece of applied physics popularization (New Scientist, BBC, and others have covered it), not a peer-reviewed primary derivation.',
  confidence: "commonly_cited_unverified",
  note: "Verified via direct lookup 2026-08-16. The 0.76 constant's own derivation is not shown on the source page and has not been independently re-derived here — see reference/egg-heat-penetration.md.",
};

/**
 * Target yolk temperature for each `yolkDoneness` tier (`boil.json`'s
 * `yolkDoneness` parameter, `EGG_BOIL_DONENESS`) — a reasoned
 * interpretation combining a 2025 peer-reviewed denaturation figure
 * (`soft`) with an older, commonly-cited coagulation range's upper bound
 * (`hard`); `medium` is this repo's own interpretive midpoint. See
 * `reference/egg-heat-penetration.md`.
 */
export const YOLK_TARGET_TEMP_C: Readonly<Record<"soft" | "medium" | "hard", number>> = {
  soft: 65,
  medium: 67.5,
  hard: 70,
};

export const YOLK_TARGET_TEMP_CITATION: Citation = {
  source:
    "Di Lorenzo & Di Maio, \"Periodic cooking of eggs,\" Communications Engineering (Nature Portfolio, 2025), https://www.nature.com/articles/s44172-024-00334-w — yolk denaturation ~65C (`soft`'s anchor) — combined with the University of Exeter page's own stated 65-70C yolk-coagulation range (`hard`'s anchor at the top of that range; `medium` is this repo's own unsourced interpretive midpoint, not directly cited).",
  confidence: "commonly_cited_unverified",
  note: "A genuinely mixed-confidence citation — the 65C soft anchor traces to a 2025 peer-reviewed paper, but medium/hard are this repo's own reasoned interpretation. See reference/egg-heat-penetration.md.",
};

export interface EggSphereConductionParams {
  /** Egg mass in kg — see `egg-doneness.ts`'s `EGG_SIZE_GRAMS`. */
  massKg: number;
  specificHeatJPerKgK: number;
  densityKgPerM3: number;
  thermalConductivityWPerMK: number;
  /** Starting egg temperature, C — this repo's standing convention is
   *  refrigerator-cold (~4C), left a real parameter, not hardcoded. */
  initialTempC: number;
  /** The boiling water's temperature, C — pass `altitude.ts`'s
   *  `waterBoilingPointC(altitudeMeters)` for a real altitude-adjusted value. */
  waterTempC: number;
}

/** Given constant of the cited formula, not independently derived. */
const WILLIAMS_LN_COEFFICIENT = 0.76;

/**
 * How many seconds until the egg's CENTER (the yolk) reaches
 * `targetYolkTempC`, via Williams' closed-form spherical-conduction
 * formula. Throws on physically meaningless inputs (no driving force, or
 * a target on the wrong side of it) — see `reference/egg-heat-penetration.md`.
 */
export function secondsForYolkToReachTempC(
  params: EggSphereConductionParams,
  targetYolkTempC: number
): number {
  const {
    massKg,
    specificHeatJPerKgK,
    densityKgPerM3,
    thermalConductivityWPerMK,
    initialTempC,
    waterTempC,
  } = params;

  if (waterTempC === initialTempC) {
    throw new Error(
      "secondsForYolkToReachTempC: waterTempC equals initialTempC — no driving force, the target is never reached."
    );
  }
  const heating = waterTempC > initialTempC;
  if (heating && (targetYolkTempC <= initialTempC || targetYolkTempC >= waterTempC)) {
    throw new Error(
      `secondsForYolkToReachTempC: targetYolkTempC ${targetYolkTempC}C is not between initialTempC ${initialTempC}C and waterTempC ${waterTempC}C — the yolk can never reach it while heating toward the water.`
    );
  }
  if (!heating && (targetYolkTempC >= initialTempC || targetYolkTempC <= waterTempC)) {
    throw new Error(
      `secondsForYolkToReachTempC: targetYolkTempC ${targetYolkTempC}C is not between waterTempC ${waterTempC}C and initialTempC ${initialTempC}C — the yolk can never reach it while cooling toward the water.`
    );
  }

  const prefactor =
    (Math.pow(massKg, 2 / 3) * specificHeatJPerKgK * Math.pow(densityKgPerM3, 1 / 3)) /
    (thermalConductivityWPerMK * Math.PI ** 2 * Math.pow((4 * Math.PI) / 3, 2 / 3));

  const lnArgument =
    (WILLIAMS_LN_COEFFICIENT * (initialTempC - waterTempC)) / (targetYolkTempC - waterTempC);
  return prefactor * Math.log(lnArgument);
}
