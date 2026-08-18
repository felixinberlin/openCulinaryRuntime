# `src/place.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## `PlaceState`

The "heat as a shared, time-varying property of a PLACE (pot/pan), not a
per-action-call parameter on one ingredient" gap named in `ROADMAP.md`
(raised directly by the user while `SIMMER` was being built: "heat is a
function inside a place where many ingredients can live. it increase and
decrease in time.") and `LEARNINGS_DOMAIN.md` 2026-08-13, which scoped it
as design-and-record, not implement — closed here, for real, once a
concrete forcing case existed ("what does a robot actually need to boil
an egg" — see `scripts/boil-egg-as-a-robot.ts`).

### SCOPED DELIBERATELY NARROWER than that ROADMAP entry's full description

That narrowing is stated here rather than left implicit: this closed the
PHYSICS half (a real temperature that persists on a tool instance and
evolves as a pure function of elapsed time, not a per-call guess) as a
standalone module — the same precedent `heat-source.ts` and
`egg-doneness.ts` set (real, cited, useful reference math, provable via a
script, BEFORE being wired into `engine.ts`'s core precondition checks).
At the time this file was first written, it did NOT touch
`applyAction`/`Instance` — no engine concept of "instances co-located in
one tool instance sharing its state," no `FILL`/`POUR`/placement verb in
`data/actions/*.json`, and BOIL's `requiredIngredientCapabilities` check
only asking "is some water available at all," never "is THIS pot's water
actually at temperature."

### THAT REMAINING HALF CLOSED 2026-08-16

Not inside `applyAction` itself (still completely unchanged:
`advanceTempSeconds` is a genuinely continuous, elapsed-time process that
`applyAction`'s one-shot instantaneous-transition shape doesn't fit), but
in `src/recipe-runner.ts`, which now recognizes three new real verbs
(`data/actions/fill.json`/`place_in.json`/`heat_place.json`) and tracks
`places`/`placeContents` alongside `Instance` inventory — the actual
"instances co-located in one tool instance sharing its state" concept,
plus an opt-in `params.placeId` readiness check on BOIL/SIMMER steps
against this file's own `PlaceState`. See `recipe-runner.ts`'s own
reference doc for the full mechanism and `ROADMAP.md`'s "Heat as a
shared, time-varying property of a PLACE" entry (2026-08-16 update) for
what's still open (FRY/oil, the placed food's own internal temperature,
periodic/alternating heating).

### GENERALIZED 2026-08-14 (`advanceTempSeconds`/`isAtTargetTemp`)

Once a second real forcing case — frying, not just boiling — proved the
boiling-only shape was too narrow: FRY's oil never boils at any real
cooking temperature (`oil.json` has no `boilingPointC` at all, and
shouldn't — it doesn't apply), so `advanceHeatSeconds`'s original "clamp
at `contentsEntity.thermophysical.boilingPointC`" design couldn't
represent heating oil to a real fry temperature at all. `advanceTempSeconds`
takes an explicit `targetTempC` instead of reading one fixed field, and
`advanceHeatSeconds`/`isAtBoiling` are now thin wrappers over it
(`targetTempC = contentsEntity.thermophysical.boilingPointC`) — same
external behavior, same tests, zero breaking change; see
`tests/place.test.ts`.

### ONE REAL PHYSICS DISTINCTION THE GENERALIZATION MUST NOT BLUR

For water, clamping at `boilingPointC` represents a real, unavoidable
physical ceiling (further energy goes into phase change, not further ΔT
— water CANNOT exceed it while liquid water remains). For oil heated
toward a chosen `targetTempC` (a fry setpoint, not a phase-change point),
nothing physically stops the temperature from continuing past it — the
clamp here instead represents "this function models a controlled heating
process that stops adding energy once the target is reached," the same
real-world behavior a thermostat or an attentive cook provides, not a law
of physics. Both are legitimate, but they are different KINDS of true,
and conflating them would be dishonest — stated explicitly here rather
than left to look like one uniform mechanism.

`smokePointC` (`ingredient.ts`'s `ThermophysicalPropertiesSchema`, added
alongside this generalization) is the real safety mechanism that
distinguishes the two cases further: `advanceTempSeconds` REJECTS a
`targetTempC` at or above a declared `smokePointC` outright, rather than
silently heating toward (or past) a genuine fire/smoke-point safety
ceiling the way it would silently clamp at a harmless phase-change point.
A real fryer or cook wouldn't (shouldn't) dial in a temperature past an
oil's smoke point either — this makes that refusal a hard error instead
of an implicit assumption.

### Field notes

- `toolEntityId`: The tool this place models, e.g. "pot" — matches an `Entity.id` of `kind: "tool"`. Purely descriptive here; nothing in this module reads `Entity` for the tool itself (no tool thermophysical data exists yet — `pan.json`'s own `metadata.notes` says as much).
- `contentsEntityId`: `null` when nothing has been poured/placed in yet.

## `emptyPlace`

An empty place at a given ambient starting temperature (defaults to a
reasonable room temperature — real recipes should pass the actual
measured value when one matters, this is just a sane default for a
freshly-created, nothing-poured-in-yet state).

## `pourInto`

Pour a real, measured quantity of one ingredient into an (empty) place —
the missing "put water in the pan" step from the robot's-eye sketch this
module answers. Deliberately restrictive rather than silently wrong:
pouring a SECOND, different ingredient into an already-occupied place (a
real mixture, e.g. adding stock to water) would need real thermal mixing
math (a mass-weighted temperature average, at minimum) this module does
not implement — rejected outright rather than quietly averaging or
overwriting. Topping up MORE of the same ingredient at the same place
(e.g. adding more cold water) also isn't handled — same reasoning, same
missing mixing math — and is rejected for the identical reason, not
silently allowed just because the entityId matches.

## `assertPlaceMatchesEntity`

Shared precondition both `advanceTempSeconds` and `advanceHeatSeconds`
need, checked in this exact order (place-empty, then mismatched-entity)
BEFORE either resolves any thermophysical field — a caller passing the
wrong entity entirely should hear about that before hearing about a
missing property on it.

## `advanceTempSeconds`

Advance this place's temperature by `elapsedSeconds` of real (simulated,
not wall-clock — `ENGINE_INVARIANTS.md` #9, determinism) time under a
given heat source, toward an explicit `targetTempC` — the general form;
see the `PlaceState` section above for why `targetTempC` is a
caller-supplied number here rather than a fixed field read off
`contentsEntity` the way the original boiling-only version worked, and
for the real physics distinction between "clamped at a phase-change
ceiling" (water) and "clamped at a chosen setpoint" (oil) that
generalization required naming explicitly.

Same energy-balance simplification `estimatedPreheatSeconds`
(`heat-source.ts`) already documents and uses (one constant mid-range
power/efficiency value for the whole interval, no real startup ramp, no
heat loss to the pot/room) — reused here, not reinvented.

Throws if: `place` is empty or its contents don't match `contentsEntity`
(`assertPlaceMatchesEntity`); `contentsEntity` has no
`thermophysical.specificHeatJPerKgK` (nothing to compute a heating rate
from); `elapsedSeconds` is negative; or `targetTempC` is at or above a
declared `thermophysical.smokePointC` (a real safety ceiling this
function refuses to heat toward, not a value to silently clamp at).

## `isAtTargetTemp`

Real, checkable state a robot's control loop would actually poll for —
"have we reached the target yet" — rather than trusting a precomputed
total duration blindly. General form of `isAtBoiling`.

## `advanceHeatSeconds`

Boiling-specific convenience wrapper over `advanceTempSeconds`, kept for
every existing caller (`boil.json`/`simmer.json`'s use cases): resolves
`targetTempC` from `contentsEntity.thermophysical.boilingPointC` — the
one real case where the clamp target IS also a hard physical ceiling
(latent heat of vaporization; see the `PlaceState` section above). Same
external behavior as before the 2026-08-14 generalization.

## `isAtBoiling`

Boiling-specific convenience wrapper over `isAtTargetTemp` — see
`advanceHeatSeconds`'s notes above.
