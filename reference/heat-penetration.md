# `src/heat-penetration.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Real heat-transfer physics, not another reference table — added
2026-08-15, directly in response to the user naming the actual mechanism:
hot oil browns a potato's surface quickly while its low thermal
conductivity means the CENTER lags behind, sometimes badly enough to burn
the outside before the inside is done. Deferred from `cut-dimensions.ts`
(same day, geometry only) specifically because this needed real math, not
just a citation.

### THE MODEL

1D transient conduction in an infinite slab (Fourier's second law) — the
standard "one-term approximation" every heat-transfer textbook gives for
exactly this geometry (e.g. Incropera & DeWitt, *Fundamentals of Heat and
Mass Transfer*, the plane-wall transient-conduction chapter). For a slab
whose SURFACE is assumed to jump instantly to the surrounding medium's
temperature (Biot number → ∞ — see the honesty caveats below), the
center-plane temperature is:

    θ(t) = (T_center(t) − T_surface) / (T_initial − T_surface)
         = A₁ · exp(−λ₁² · Fo),   Fo = α·t / L²

where L is the slab's HALF-thickness (heat enters from both flat faces),
α = k/(ρ·cp) is thermal diffusivity, and for the Bi→∞ case λ₁ = π/2 ≈
1.5708, A₁ = 4/π ≈ 1.2732 — exact values for this specific case (not a
recalled table lookup), confirmed against multiple independent academic
sources 2026-08-15. Valid for Fo > 0.2 (the one-term approximation's own
stated validity condition, the same "state it, don't silently assume it
always holds" discipline `thermal.ts`'s `validityCondition` field already
uses) — `tests/heat-penetration.test.ts` checks the capability-test
script's actual scenarios stay within this range, rather than only
asserting it.

### TWO (THREE) HONESTY CAVEATS, NAMED EXPLICITLY, NOT LEFT IMPLICIT

1. Bi→∞ means this model treats the potato's SURFACE as reaching the
   oil's temperature INSTANTLY. Real oil-frying convective heat transfer
   is fast but not infinite — a genuine convective heat-transfer
   coefficient for oil frying (which would need its own real citation,
   and depends on oil velocity/piece geometry — deeper food-engineering
   territory than this pass attempts) would predict a slightly SLOWER
   center-heating rate than this model does. This model is therefore a
   reasonable LOWER BOUND on time-to-center-doneness, not an exact
   prediction — named here rather than implied to be more precise than it
   is.
2. This computes ONE real physical quantity: how long the CENTER takes to
   reach a target temperature. It does NOT model browning/Maillard
   reaction kinetics at the surface, so it cannot say whether the outside
   actually "burns" by that point — only how long the center takes.
   `MAILLARD_REACTION_ONSET_TEMP_C` below (added 2026-08-15, checked
   against multiple independent sources) names the real temperature ABOVE
   which browning becomes chemically possible at all — a genuine, small
   step toward the deferred gap, not the whole thing: knowing the onset
   TEMPERATURE says nothing about the RATE/TIME browning actually takes
   once above it, which is what would be needed to compare against this
   file's own center-doneness times and answer "does the outside burn
   before the inside is done." That comparison remains a further,
   deliberately deferred step, not attempted here. Matches this session's
   standing refusal to fabricate a "texture" output (`cut-dimensions.ts`'s
   own doc comment) — this file computes real TIME, not texture.
3. THE COMPUTED TIMES ARE SHORT — SECONDS TO TENS OF SECONDS FOR A REAL
   3-5MM SLICE — AND THAT IS CORRECT, NOT A BUG, BUT EASY TO MISREAD. A
   3mm slice (1.5mm half-thickness) in 175°C oil reaches a 97°C center in
   ~7 seconds by pure conduction (checked directly against this file's
   own math 2026-08-15) — far shorter than `crispy_french_fries.json`'s
   real 180s finishing fry. This is NOT a contradiction: pure heat
   conduction is only PART of what real frying time is spent on. This
   repo's own already-cited Kalogianni & Smith (2013) found most property
   change happens in the first 1-2 minutes and crust thickness plateaus
   DESPITE continued heat penetration — real frying time is dominated by
   surface moisture evaporation and crust formation, physical processes
   this module does not model AT ALL (not "approximately," entirely
   absent). This module answers a narrower, real question — how fast heat
   physically reaches the center — not "how long should I actually fry
   this," which depends on those other, unmodeled processes too.

## `ONE_TERM_LAMBDA_1` / `ONE_TERM_A_1` / `MIN_VALID_FOURIER_NUMBER`

Exact, Bi -> infinity case values; `MIN_VALID_FOURIER_NUMBER` is the
one-term approximation's own stated validity condition.

## `ONE_TERM_APPROXIMATION_CITATION`

The lambda_1/A_1 VALUES for the Bi->infinity case are exact, derivable
mathematics (the eigenvalue equation cos(lambda)=0 has first root pi/2),
not empirical figures needing independent verification — the citation is
for the METHOD (which physical assumptions this approximation makes, and
its Fo>0.2 validity range), not a number that could itself be wrong.

## `POTATO_FORK_TENDER_CENTER_TEMP_C`

"Fork tender" internal potato temperature — the practically-meaningful
"is it actually done" target, distinct from and higher than starch
gelatinization ONSET (`STARCH_GELATINIZATION_ONSET_TEMP_C` — where
texture starts changing but isn't complete). Sourced from baked-potato
measurements (the most commonly measured/documented case) and used here
as a general doneness target regardless of cooking method — the
underlying starch chemistry is the same, the same kind of cross-technique
reuse `EGG_BOIL_DONENESS`'s boiling-start figures already get reused
elsewhere in this repo.

## `POTATO_DONENESS_TEMP_CITATION`

Checked via web search 2026-08-15, not independently re-verified against
a peer-reviewed primary source. Measured for baked potato specifically;
used here as a general doneness target since the underlying
starch-gelatinization chemistry doesn't depend on cooking method.

## `STARCH_GELATINIZATION_ONSET_TEMP_C`

The temperature ABOVE which starch granules begin gelatinizing (texture
starts changing) — real, but distinct from and lower than
`POTATO_FORK_TENDER_CENTER_TEMP_C` (full tenderness). Promoted from the
citation note above, which already named this figure in prose; same
source/confidence tier, not a fresh, separately-verified claim.

## `MAILLARD_REACTION_ONSET_TEMP_C`

The real temperature ABOVE which the Maillard reaction — the chemistry
behind browning/crust flavor at a fried surface — becomes possible at
all. NOT a kinetics model: this says nothing about how fast browning
proceeds once above it, only that it cannot proceed at all below it. See
honesty caveat 2 above for exactly what this does and doesn't close.

## `MAILLARD_REACTION_STAGES_C`

The rest of the same real curve `MAILLARD_REACTION_ONSET_TEMP_C` names
the start of — promoted from `MAILLARD_REACTION_ONSET_CITATION`'s own
source text (already checked the same way, same date, same confidence
tier) rather than a fresh claim: slow, real reaction from
`slowOnsetRangeC`, sharp acceleration at the onset temperature, peak
browning efficiency across `peakEfficiencyRangeC`, and above
`pyrolysisOnsetC` other processes (charring) take over from Maillard
browning specifically.

## `MAILLARD_REACTION_ONSET_CITATION`

Checked via web search 2026-08-15 (a user-supplied document raised the
same figure independently, but that document has no traceable
bibliography — not itself treated as a source; this citation is from
directly checking multiple independent food-science summaries, which
converged closely). Not independently re-verified against a peer-reviewed
primary source. Covers `MAILLARD_REACTION_STAGES_C` too (added 2026-08-18,
promoted from this same note's own prose, not re-researched) — the whole
curve was checked together, not just the single onset point.

## `ROOM_TEMP_C`

The "room temperature" assumption several callers across this repo
independently re-declared as a bare `20` with only an inline comment
(`recipe-explain.ts`'s fry-timing advisory, `recipe-runner.ts`'s `FILL`
default starting liquid temperature, and two capability-test scripts) —
promoted to one real, cited constant so there's one source of truth for a
number that already fed real, user-facing computation without one. 20C
sits at the conservative (low) end of the real, standard range — not an
arbitrary pick, see `ROOM_TEMP_CITATION` below.

## `ROOM_TEMP_CITATION`

Checked via web search 2026-08-18, via a secondary source explicitly
attributing to USP/FDA/USDA (the primary USP text wasn't fetched directly
this session). 20C is the LOW end of the real 20-25C range, not an
invented number — a conservative, defensible choice for a
starting-temperature assumption (a lower start means more time to reach a
target temperature, never less), not upgraded to 25C without a specific
reason to prefer the range's other end.

## `thermalDiffusivityM2PerS`

Throws — not undefined — if any of the three inputs is missing, same "a
caller must know this doesn't apply yet" contract every other
reference-table lookup in this repo uses.

## `SlabConductionParams`

- `halfThicknessM`: Slab HALF-thickness in meters (heat enters from both flat faces — for a cut.json "sliced" piece, half of cutShapeDimensionMm's value, converted from mm).
- `surfaceTempC`: The surrounding medium's temperature (oil/water) — assumed to be the slab's surface temperature under this model's Bi->infinity simplification (see the file-level notes above).

## `centerTempCAfterSeconds`

The center-plane temperature after `elapsedSeconds` of heating/cooling
toward `surfaceTempC`. Real physics, not a lookup — see the file-level
notes above for the formula and its honesty caveats.

## `secondsForCenterToReachTempC`

The inverse, and the actually useful query: how many seconds until the
CENTER reaches `targetCenterTempC`. Throws on real, physically
meaningless inputs rather than returning NaN/Infinity silently: no
driving force (surface == initial temp), or a target on the wrong side of
the driving force (colder than the surface while heating, or hotter than
the surface while cooling — the center can never overshoot the medium
it's equilibrating toward).

## `isWithinValidityCondition`

Exposed so callers/tests can confirm a given scenario actually falls
within the one-term approximation's Fo > 0.2 validity condition, rather
than only asserting it in prose.

## `SYMMETRY_INSULATED_BOUNDARY_CITATION`

The symmetry argument itself is exact, standard textbook material.
Treating a "little oil"/pan-fried face as fully insulated (rather than
merely much-lower-h than oil) is this file's own added simplification, in
the same honest spirit as the Bi->infinity assumption already documented
above — named explicitly in `effectiveHalfThicknessM`'s own notes below,
not left implicit.

## `effectiveHalfThicknessM`

Converts a real, physical slice thickness into the HALF-thickness the
model above actually needs — added 2026-08-15, directly answering the
user's next real observation: "it's not the same if the potatoes are
swimming in oil or if there is only a little." Same model, same formula —
only how far heat has to travel before reaching the center differs,
because how many faces are actually in contact with hot oil differs.

`heatedFaces: 2` — SUBMERGED / deep-fried: hot oil contacts both flat
faces of the slice at once, the classic symmetric-slab case this file's
other functions were originally built around. Heat enters from both
sides, so only HALF the actual thickness has to conduct through to reach
the center: `halfThicknessM = actualThicknessM / 2`.

`heatedFaces: 1` — SHALLOW oil / pan-frying: only the bottom face touches
hot oil; the top face sits in air (much lower convective heat transfer
than oil — roughly an order of magnitude, treated here as effectively
insulated, the file's own added simplification, see
`SYMMETRY_INSULATED_BOUNDARY_CITATION`'s note). This is NOT a different
physical model — a standard symmetry argument (see that citation) shows
one-face heating with the other face insulated is physically identical to
HALF of a symmetric slab of DOUBLE the actual thickness:
`halfThicknessM = actualThicknessM` (the FULL thickness, not halved).
Since the model's own time formula scales with L², this one real,
checkable consequence follows directly: for the same actual slice,
`heatedFaces: 1` takes ~4x as long for the center to reach the same
target temperature as `heatedFaces: 2` — not "longer," a specific,
derivable multiple (see `tests/heat-penetration.test.ts`).
