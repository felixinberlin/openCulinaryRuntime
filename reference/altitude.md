# `src/altitude.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Real, computed altitude → water-boiling-point physics — closes the gap
`water.json`'s own citation note, `heat-source.ts`'s doc comment, and
every `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS` assumptions block have
all separately named since this repo's first thermal-property citation:
"boilingPointC: 100 is pressure-dependent, not a universal constant...
This repo has no altitude/pressure parameter anywhere." Added 2026-08-14
in direct response to an external scientific review naming this as the
single highest-priority unaddressed gap.

Same "implement the actual textbook formula instead of a hand-picked
anchor point" standard `thermal.ts`'s D/z-value model already holds
itself to — two real, standard, independently-citable physics/chemistry
relationships, composed:

1. **ALTITUDE -> ATMOSPHERIC PRESSURE**: the ICAO/US Standard Atmosphere
   1976 barometric formula for the troposphere (0-11km, where every
   inhabited/cooking-relevant altitude on Earth falls):

       P(h) = P0 * (1 - L*h/T0) ^ (g*M / (R*L))

   P0 = 101325 Pa (standard sea-level pressure), L = 0.0065 K/m
   (temperature lapse rate), T0 = 288.15 K (standard sea-level temp), g =
   9.80665 m/s^2, M = 0.0289644 kg/mol (molar mass of dry air), R =
   8.31446 J/(mol*K) (universal gas constant). Source: ICAO Doc 7488 / US
   Standard Atmosphere 1976 — the same standard atmosphere model aviation,
   meteorology, and engineering reference tables are built on. Confidence:
   standard_reference.

2. **PRESSURE -> WATER'S BOILING POINT**: the Antoine equation, water's
   own real vapor-pressure-vs-temperature curve (valid 1-100°C, exactly
   the range every altitude on Earth's inhabited surface needs):

       log10(P_mmHg) = A - B / (C + T_celsius)

   A = 8.07131, B = 1730.63, C = 233.426 — standard coefficients published
   in the NIST Chemistry WebBook (originally Antoine, 1888; republished in
   essentially every physical chemistry reference, e.g. Lange's Handbook
   of Chemistry). Confidence: standard_reference. Inverted here (solve for
   T given P) to answer "at THIS pressure, what temperature does water
   boil at" rather than the equation's more common forward use.

### WHAT THIS DOES NOT DO, stated explicitly rather than implied solved

This answers "what temperature does water boil at, here" — it does NOT
adjust `EGG_BOIL_DONENESS`/`POTATO_BOIL_DONENESS`'s hold-time ranges for
altitude. A real, separate, still-open effect: food cooks SLOWER at a
lower boiling point (less thermal energy reaching the food per unit
time), and quantifying that needs real heat-transfer-rate modeling into
the food itself — the same "would need temperature-curve integration,
out of scope" gap `egg-doneness.ts`'s own doc comment already names for
cold-start timing, not a new one. This file closes the REACH-boiling-
temperature half only.

ALSO NOT GENERALIZED to other liquids (e.g. oil): the Antoine equation
above is water's own specific vapor-pressure curve, not a generic
liquid-boiling formula — oil doesn't have a clean single-component
boiling curve the way pure water does (see `place.ts`'s own doc comment
on why oil is heated toward a chosen setpoint via `advanceTempSeconds`
instead, not a `boilingPointC`-style physical ceiling at all).

## `BAROMETRIC_FORMULA_VALIDITY_ALTITUDE_M` / `ANTOINE_EQUATION_VALIDITY_TEMP_C`

Both formulas' own stated validity bounds, promoted from this file's
top-level prose into real, checkable constants — matching the pattern
`thermal.ts`'s `ThermalInactivationModelSchema.validityCondition` already
established for exactly this (a model's applicable range should be a real
field a caller/test can check, not only an assertion in prose). Source:
ICAO Doc 7488 / US Standard Atmosphere 1976 (troposphere bound) and the
NIST Chemistry WebBook (Antoine-coefficient bound) — the same two
citations already named in the file-level notes above.

## `isWithinBarometricValidity`

Exposed so a caller/test can confirm a given scenario is actually valid,
the same "don't only assert it in prose" precedent
`heat-penetration.ts`'s `isWithinValidityCondition` already set for its
own one-term conduction approximation.

## `atmosphericPressurePa`

Local atmospheric pressure at a given altitude above sea level, via the
ICAO/US Standard Atmosphere 1976 barometric formula. Valid for the
troposphere (0-11,000m) — every inhabited cooking altitude on Earth.

## `waterBoilingPointC`

The temperature at which pure water boils at the given altitude — the
real, computed answer to "what temperature does water actually boil at
here," replacing the sea-level-only `100` every `boilingPointC` field and
every doneness table in this repo had assumed before this file existed.
Composes `atmosphericPressurePa` with the (inverted) Antoine equation.
