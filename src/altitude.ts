/**
 * Real, computed altitude → water-boiling-point physics — closes the gap
 * `water.json`'s own citation note, `heat-source.ts`'s doc comment, and
 * every `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS` assumptions block have
 * all separately named since this repo's first thermal-property citation:
 * "boilingPointC: 100 is pressure-dependent, not a universal constant...
 * This repo has no altitude/pressure parameter anywhere." Added 2026-08-14
 * in direct response to an external scientific review naming this as the
 * single highest-priority unaddressed gap.
 *
 * Same "implement the actual textbook formula instead of a hand-picked
 * anchor point" standard `thermal.ts`'s D/z-value model already holds
 * itself to — two real, standard, independently-citable physics/chemistry
 * relationships, composed:
 *
 * 1. ALTITUDE -> ATMOSPHERIC PRESSURE: the ICAO/US Standard Atmosphere
 *    1976 barometric formula for the troposphere (0-11km, where every
 *    inhabited/cooking-relevant altitude on Earth falls):
 *      P(h) = P0 * (1 - L*h/T0) ^ (g*M / (R*L))
 *    P0 = 101325 Pa (standard sea-level pressure), L = 0.0065 K/m
 *    (temperature lapse rate), T0 = 288.15 K (standard sea-level temp),
 *    g = 9.80665 m/s^2, M = 0.0289644 kg/mol (molar mass of dry air),
 *    R = 8.31446 J/(mol*K) (universal gas constant). Source: ICAO Doc
 *    7488 / US Standard Atmosphere 1976 — the same standard atmosphere
 *    model aviation, meteorology, and engineering reference tables are
 *    built on. Confidence: standard_reference.
 *
 * 2. PRESSURE -> WATER'S BOILING POINT: the Antoine equation, water's own
 *    real vapor-pressure-vs-temperature curve (valid 1-100°C, exactly the
 *    range every altitude on Earth's inhabited surface needs):
 *      log10(P_mmHg) = A - B / (C + T_celsius)
 *    A = 8.07131, B = 1730.63, C = 233.426 — standard coefficients
 *    published in the NIST Chemistry WebBook (originally Antoine, 1888;
 *    republished in essentially every physical chemistry reference,
 *    e.g. Lange's Handbook of Chemistry). Confidence: standard_reference.
 *    Inverted here (solve for T given P) to answer "at THIS pressure,
 *    what temperature does water boil at" rather than the equation's more
 *    common forward use.
 *
 * WHAT THIS DOES NOT DO, stated explicitly rather than implied solved:
 * this answers "what temperature does water boil at, here" — it does NOT
 * adjust `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS`'s hold-time ranges for
 * altitude. A real, separate, still-open effect: food cooks SLOWER at a
 * lower boiling point (less thermal energy reaching the food per unit
 * time), and quantifying that needs real heat-transfer-rate modeling into
 * the food itself — the same "would need temperature-curve integration,
 * out of scope" gap `egg-doneness.ts`'s own doc comment already names for
 * cold-start timing, not a new one. This file closes the REACH-boiling-
 * temperature half only.
 *
 * ALSO NOT GENERALIZED to other liquids (e.g. oil): the Antoine equation
 * above is water's own specific vapor-pressure curve, not a generic
 * liquid-boiling formula — oil doesn't have a clean single-component
 * boiling curve the way pure water does (see `place.ts`'s own doc comment
 * on why oil is heated toward a chosen setpoint via `advanceTempSeconds`
 * instead, not a `boilingPointC`-style physical ceiling at all).
 */

const STANDARD_ATMOSPHERE = {
  seaLevelPressurePa: 101325,
  temperatureLapseRateKPerM: 0.0065,
  seaLevelTempK: 288.15,
  gravityMPerS2: 9.80665,
  molarMassAirKgPerMol: 0.0289644,
  gasConstantJPerMolK: 8.31446,
} as const;

const WATER_ANTOINE_COEFFICIENTS = {
  // Valid range: 1-100°C (NIST Chemistry WebBook).
  A: 8.07131,
  B: 1730.63,
  C: 233.426,
} as const;

/**
 * Local atmospheric pressure at a given altitude above sea level, via the
 * ICAO/US Standard Atmosphere 1976 barometric formula. Valid for the
 * troposphere (0-11,000m) — every inhabited cooking altitude on Earth.
 */
export function atmosphericPressurePa(altitudeMeters: number): number {
  if (altitudeMeters < 0) {
    throw new Error(`altitudeMeters must be non-negative, got ${altitudeMeters}`);
  }
  const {
    seaLevelPressurePa,
    temperatureLapseRateKPerM,
    seaLevelTempK,
    gravityMPerS2,
    molarMassAirKgPerMol,
    gasConstantJPerMolK,
  } = STANDARD_ATMOSPHERE;
  const exponent =
    (gravityMPerS2 * molarMassAirKgPerMol) / (gasConstantJPerMolK * temperatureLapseRateKPerM);
  return (
    seaLevelPressurePa *
    Math.pow(1 - (temperatureLapseRateKPerM * altitudeMeters) / seaLevelTempK, exponent)
  );
}

/**
 * The temperature at which pure water boils at the given altitude — the
 * real, computed answer to "what temperature does water actually boil at
 * here," replacing the sea-level-only `100` every `boilingPointC` field
 * and every doneness table in this repo has assumed until now. Composes
 * `atmosphericPressurePa` with the (inverted) Antoine equation.
 */
export function waterBoilingPointC(altitudeMeters: number): number {
  const pressurePa = atmosphericPressurePa(altitudeMeters);
  const pressureMmHg = pressurePa / 133.322; // 1 mmHg = 133.322 Pa
  const { A, B, C } = WATER_ANTOINE_COEFFICIENTS;
  // log10(P) = A - B/(C+T)  =>  T = B/(A - log10(P)) - C
  return B / (A - Math.log10(pressureMmHg)) - C;
}
