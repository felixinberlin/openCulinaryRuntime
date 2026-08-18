/**
 * Real, computed altitude → water-boiling-point physics: the ICAO/US
 * Standard Atmosphere 1976 barometric formula (altitude → pressure)
 * composed with the (inverted) Antoine equation (pressure → water's
 * boiling point) — replacing the sea-level-only assumption of `100`
 * everywhere `boilingPointC` is used. See `reference/altitude.md` for the
 * formulas, validity bounds, scope, and citations.
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
  A: 8.07131,
  B: 1730.63,
  C: 233.426,
} as const;

/** Both formulas' own stated validity bounds, as real, checkable
 *  constants rather than only prose. See `reference/altitude.md`. */
export const BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M = { min: 0, max: 11000 } as const;
export const ANTOINE_EQUATION_VALIDITY_TEMP_C = { min: 1, max: 100 } as const;

/** True iff `altitudeMeters` falls within the barometric formula's own
 *  stated troposphere bound. */
export function isWithinBarometricValidity(altitudeMeters: number): boolean {
  return (
    altitudeMeters >= BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M.min &&
    altitudeMeters <= BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M.max
  );
}

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
 * The temperature at which pure water boils at the given altitude —
 * composes `atmosphericPressurePa` with the (inverted) Antoine equation.
 * See `reference/altitude.md` for what this does and doesn't cover.
 */
export function waterBoilingPointC(altitudeMeters: number): number {
  const pressurePa = atmosphericPressurePa(altitudeMeters);
  const pressureMmHg = pressurePa / 133.322; // 1 mmHg = 133.322 Pa
  const { A, B, C } = WATER_ANTOINE_COEFFICIENTS;
  // log10(P) = A - B/(C+T)  =>  T = B/(A - log10(P)) - C
  return B / (A - Math.log10(pressureMmHg)) - C;
}
