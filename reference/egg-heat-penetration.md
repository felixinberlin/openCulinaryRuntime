# `src/egg-heat-penetration.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Real, computed spherical heat-conduction physics for whole-egg boiling
time — the whole-egg sibling of `heat-penetration.ts`'s plane-slab model
(built for potato slices). Added 2026-08-16, directly answering "check if
there's any newer/other real math on this topic" against
`egg-doneness.ts`'s existing `EGG_BOIL_DONENESS` table, which is
EMPIRICAL (sourced from consumer cooking guides), never independently
computed from first principles — same "replace/supplement a lookup table
with a real physics formula, cross-checked against the existing figures"
standard `altitude.ts` already holds itself to for water's own boiling
point.

### THE MODEL

Charles Williams' closed-form transient-conduction formula for a
homogeneous sphere (University of Exeter, Department of Physics —
https://www.exeter.ac.uk/research-centres/theoretical-physics/boiling-an-egg/
— a well-known, widely-reported piece of applied physics, not a novel
derivation by this repo):

    t = (M^(2/3) * c * rho^(1/3)) / (K * pi^2 * (4*pi/3)^(2/3))
        * ln[ 0.76 * (T_egg - T_water) / (T_yolk - T_water) ]

### DIMENSIONAL ANALYSIS, CHECKED BY HAND BEFORE IMPLEMENTING, not copied blindly

With M in kg, c in J/(kg*K), rho in kg/m^3, K in W/(m*K) — plain SI, the
same units every other `thermophysical` field in this repo already uses —
the whole prefactor comes out in SECONDS directly. (M^(2/3) * rho^(1/3)
has units kg/m; times c [J/(kg*K)] gives J/(m*K); divided by K [W/(m*K) =
J/(s*m*K)] gives seconds.) No hidden CGS/other unit convention is needed
for this specific formula, despite that being a real, common gotcha with
other popularized physics formulas — worth stating explicitly since it
was checked, not assumed.

### THE 0.76 CONSTANT'S OWN DERIVATION IS NOT EXPLAINED on the source page

This repo has not independently re-derived it (it plausibly folds in the
sphere's first-eigenvalue/eigenfunction normalization the way this
repo's own `heat-penetration.ts` states its A_1=4/pi, lambda_1=pi/2
explicitly for the *slab* case, but the source material for THIS formula
does not show that derivation). Stated honestly as a given constant of
the cited formula, not invented, not re-derived.

### CROSS-CHECKED BY HAND against `EGG_BOIL_DONENESS`'s existing empirical ranges

For a 55g ("large") egg, 4C start, 100C sea-level water, `egg.json`'s own
density/conductivity/specific-heat, using `YOLK_TARGET_TEMP_C`'s three
targets:

- soft (65C): ~408s — falls INSIDE the empirical 360-420s range.
- medium (67.5C): ~450s — ~30s SHORT of the empirical 480-540s range (a near miss, not a match).
- hard (70C): ~494s — well SHORT of the empirical 660-780s range (a real, honest divergence, not a match).

Real convergent evidence for "soft," a near-miss for "medium," a genuine
discrepancy for "hard" — reported honestly as all three, not smoothed
into a single "it matches" claim. See `scripts/boil-egg-by-physics.ts`
for this comparison computed live against the actual loaded data, not
just asserted in this comment. Plausible reason for the "hard"
divergence, stated as a hypothesis, not a proven fact: real recipes
aiming for a reliably fully-set yolk deliberately overshoot past the bare
coagulation threshold (egg-size variance, starting-temp variance, wanting
a MARGIN of doneness, not a marginal one) — this model computes the
moment the center just BARELY reaches the target temperature, which is a
genuinely different question from "how long should a recipe actually
cook it for."

### YOLK TARGET TEMPERATURES — a REASONED INTERPRETATION, flagged as such

Not a single directly-cited three-way split: `YOLK_TARGET_TEMP_C`'s own
notes below have the full citation reasoning (a NEWER, 2025, peer-reviewed
denaturation figure anchoring the low end, an OLDER, commonly-cited
coagulation RANGE providing the span).

### WHAT THIS DOES NOT DO, stated explicitly

- Treats the egg as ONE homogeneous material (uniform density/
  conductivity/specific heat) — real eggs are two materials (white and
  yolk) with genuinely different thermal properties and a real,
  non-trivial shell/membrane boundary. A far more sophisticated 2025 model
  (Di Lorenzo & Di Maio, "Periodic cooking of eggs," *Communications
  Engineering*, REFERENCES.md) solves a full two-material diffusion PDE
  with temperature-dependent diffusivity and Arrhenius-kinetics gelation,
  numerically — a genuinely different CLASS of model (numerical PDE +
  reaction kinetics) than anything else in this repo attempts anywhere.
  Deliberately NOT built here — this file uses the OLDER, simpler,
  closed-form Williams model (matching this repo's established style,
  e.g. `heat-penetration.ts`'s own slab approximation), but borrows the
  NEWER paper's more rigorous yolk denaturation temperature (see
  `YOLK_TARGET_TEMP_C`) as its target input — old tractable math, newer
  science for the number that actually matters. A full numerical
  two-material implementation remains a real, much larger,
  separately-scoped possibility, not attempted here.
- Does not model the shell/membrane's own (small but nonzero) thermal
  resistance — same Bi->infinity-style "surface reaches medium temperature
  instantly" simplification `heat-penetration.ts` already names for
  potato in hot oil.
- Assumes a perfect sphere. A real egg is a prolate spheroid (`egg.json`
  has no `physicalDimensions` block at all yet, unlike `potato.json`'s
  cited diameter) — treated as a sphere here, the same simplification the
  source formula itself makes explicitly.
- Does NOT account for cold-start (egg added to cold water, heated
  together) — same boiling-water-start-only assumption `egg-doneness.ts`'s
  own base table already states, for the same reason (a temperature RAMP
  would need integrating a cooking-rate function over a curve, not this
  closed-form instant-boundary-jump formula).
- Composes for free with `altitude.ts`'s `waterBoilingPointC` (pass a real
  altitude-adjusted value as `waterTempC` instead of hardcoding 100) — not
  hardcoded here, zero changes needed to either file, same composition
  precedent `place.ts`/`altitude.ts` already established.

## `WILLIAMS_FORMULA_CITATION`

Verified via direct lookup 2026-08-16 (fetched the actual page, not
recalled from training data) — the formula, the sphere assumption, and
the stated coagulation ranges (white 62-65C, yolk 65-70C) were all read
directly. The 0.76 constant's own derivation is not shown on the source
page and has not been independently re-derived here — see the file-level
notes above.

## `YOLK_TARGET_TEMP_C`

Target yolk temperature for each `yolkDoneness` tier this repo already
uses (`boil.json`'s `yolkDoneness` parameter, `EGG_BOIL_DONENESS`) — a
REASONED INTERPRETATION combining two real sources at different
confidence tiers, not one single directly-cited three-way split:

- `soft` (65C) is anchored to the NEWER, more rigorous figure: Di Lorenzo
  & Di Maio, "Periodic cooking of eggs," *Communications Engineering*
  (Nature Portfolio, 2025) — REFERENCES.md — report yolk denaturation at
  approximately 65C (peer-reviewed, `standard_reference` tier), a more
  precise, more recent figure than the older Exeter page's own vaguer
  65-70C range.
- `hard` (70C) is anchored to the OLDER Exeter page's own stated upper
  bound of its yolk-coagulation range (65-70C) — "fully set throughout" is
  a reasonable reading of the top of that range, though this repo has not
  found a peer-reviewed figure specifically for FULL (not just onset) yolk
  coagulation to corroborate it the way `soft`'s figure is corroborated.
- `medium` (67.5C) is this repo's OWN interpretive midpoint between the
  two — not sourced from either document directly, the weakest-confidence
  entry of the three, named as such rather than presented with equal
  footing to the other two.

## `YOLK_TARGET_TEMP_CITATION`

A genuinely mixed-confidence citation: the 65C soft anchor traces to a
2025 peer-reviewed paper (would be standard_reference on its own), but
medium/hard are this repo's own reasoned interpretation layered on top of
an informally-sourced range — kept at the weaker overall tier honestly,
rather than letting the strongest component imply more rigor for the
whole table than it has. See the file-level notes above for the real,
checked cross-check against `EGG_BOIL_DONENESS` this produces.

## `EggSphereConductionParams`

- `massKg`: Egg mass in kg — see `egg-doneness.ts`'s `EGG_SIZE_GRAMS`.
- `initialTempC`: Starting egg temperature, C — this repo's standing convention is refrigerator-cold (~4C), matching `egg-doneness.ts`'s own base-table assumption, but left a real parameter, not hardcoded.
- `waterTempC`: The boiling water's temperature, C — pass `altitude.ts`'s `waterBoilingPointC(altitudeMeters)` for a real altitude-adjusted value instead of hardcoding 100; composes for free.

## `WILLIAMS_LN_COEFFICIENT`

Given constant, not independently derived — see the file-level notes above.

## `secondsForYolkToReachTempC`

How many seconds until the egg's CENTER (the yolk) reaches
`targetYolkTempC`, via Williams' closed-form spherical-conduction
formula. Real physics, not a lookup — see the file-level notes above for
the formula, its dimensional analysis, and its honesty caveats. Throws on
physically meaningless inputs, the same "no driving force" / "target on
the wrong side of the driving force" contract `heat-penetration.ts`'s
`secondsForCenterToReachTempC` already uses.
