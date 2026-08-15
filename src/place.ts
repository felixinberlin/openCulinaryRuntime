import type { Entity } from "./ingredient.ts";
import type { HeatSourceProfile } from "./heat-source.ts";

/**
 * PlaceState — the "heat as a shared, time-varying property of a PLACE
 * (pot/pan), not a per-action-call parameter on one ingredient" gap named in
 * `ROADMAP.md` (raised directly by the user while `SIMMER` was being built:
 * "heat is a function inside a place where many ingredients can live. it
 * increase and decrease in time.") and `LEARNINGS_DOMAIN.md` 2026-08-13, which
 * scoped it as design-and-record, not implement — closed here, for real,
 * once a concrete forcing case existed ("what does a robot actually need to
 * boil an egg" — see `scripts/boil-egg-as-a-robot.ts`).
 *
 * SCOPED DELIBERATELY NARROWER than that ROADMAP entry's full description,
 * and that narrowing is stated here rather than left implicit: this closes
 * the PHYSICS half (a real temperature that persists on a tool instance and
 * evolves as a pure function of elapsed time, not a per-call guess) as a
 * standalone module — the same precedent `heat-source.ts` and
 * `egg-doneness.ts` set (real, cited, useful reference math, provable via a
 * script, BEFORE being wired into `engine.ts`'s core precondition checks).
 * It does NOT touch `applyAction`/`Instance` — there is still no engine
 * concept of "instances co-located in one tool instance sharing its state,"
 * no `FILL`/`POUR` or placement verb in `data/actions/*.json`, and BOIL's
 * `requiredIngredientCapabilities` check still only asks "is some water
 * available at all," never "is THIS pot's water actually at temperature."
 * That remaining half — wiring this into `applyAction`'s preconditions, and
 * giving FILL/PLACE real `Action` definitions — is real, structural,
 * `engine.ts`-shaped work, intentionally left for when a recipe actually
 * needs the engine itself to enforce it, not manufactured speculatively
 * here (seen `masideas.md`'s dead-capability problem too many times in
 * this repo's own history to repeat it deliberately).
 *
 * GENERALIZED 2026-08-14 (`advanceTempSeconds`/`isAtTargetTemp`), once a
 * second real forcing case — frying, not just boiling — proved the
 * boiling-only shape was too narrow: FRY's oil never boils at any real
 * cooking temperature (`oil.json` has no `boilingPointC` at all, and
 * shouldn't — it doesn't apply), so `advanceHeatSeconds`'s original
 * "clamp at `contentsEntity.thermophysical.boilingPointC`" design couldn't
 * represent heating oil to a real fry temperature at all. `advanceTempSeconds`
 * takes an explicit `targetTempC` instead of reading one fixed field, and
 * `advanceHeatSeconds`/`isAtBoiling` are now thin wrappers over it
 * (`targetTempC = contentsEntity.thermophysical.boilingPointC`) — same
 * external behavior, same tests, zero breaking change; see
 * `tests/place.test.ts`.
 *
 * ONE REAL PHYSICS DISTINCTION THE GENERALIZATION MUST NOT BLUR: for
 * water, clamping at `boilingPointC` represents a real, unavoidable
 * physical ceiling (further energy goes into phase change, not further
 * ΔT — water CANNOT exceed it while liquid water remains). For oil heated
 * toward a chosen `targetTempC` (a fry setpoint, not a phase-change
 * point), nothing physically stops the temperature from continuing past
 * it — the clamp here instead represents "this function models a
 * controlled heating process that stops adding energy once the target is
 * reached," the same real-world behavior a thermostat or an attentive
 * cook provides, not a law of physics. Both are legitimate, but they are
 * different KINDS of true, and conflating them would be dishonest —
 * stated explicitly here rather than left to look like one uniform
 * mechanism.
 *
 * `smokePointC` (`ingredient.ts`'s `ThermophysicalPropertiesSchema`,
 * added alongside this generalization) is the real safety mechanism that
 * distinguishes the two cases further: `advanceTempSeconds` REJECTS a
 * `targetTempC` at or above a declared `smokePointC` outright, rather than
 * silently heating toward (or past) a genuine fire/smoke-point safety
 * ceiling the way it would silently clamp at a harmless phase-change
 * point. A real fryer or cook wouldn't (shouldn't) dial in a temperature
 * past an oil's smoke point either — this makes that refusal a hard error
 * instead of an implicit assumption.
 */
export interface PlaceState {
  /** The tool this place models, e.g. "pot" — matches an `Entity.id` of
   *  `kind: "tool"`. Purely descriptive here; nothing in this module reads
   *  `Entity` for the tool itself (no tool thermophysical data exists yet —
   *  `pan.json`'s own `metadata.notes` says as much). */
  readonly toolEntityId: string;
  /** `null` when nothing has been poured/placed in yet. */
  readonly contentsEntityId: string | null;
  readonly massKg: number | null;
  readonly currentTempC: number;
}

/** An empty place at a given ambient starting temperature (defaults to a
 *  reasonable room temperature — real recipes should pass the actual
 *  measured value when one matters, this is just a sane default for a
 *  freshly-created, nothing-poured-in-yet state). */
export function emptyPlace(toolEntityId: string, ambientTempC = 20): PlaceState {
  return { toolEntityId, contentsEntityId: null, massKg: null, currentTempC: ambientTempC };
}

/**
 * Pour a real, measured quantity of one ingredient into an (empty) place —
 * the missing "put water in the pan" step from the robot's-eye sketch this
 * module answers. Deliberately restrictive rather than silently wrong:
 * pouring a SECOND, different ingredient into an already-occupied place (a
 * real mixture, e.g. adding stock to water) would need real thermal mixing
 * math (a mass-weighted temperature average, at minimum) this module does
 * not implement — rejected outright rather than quietly averaging or
 * overwriting. Topping up MORE of the same ingredient at the same place
 * (e.g. adding more cold water) also isn't handled — same reasoning, same
 * missing mixing math — and is rejected for the identical reason, not
 * silently allowed just because the entityId matches.
 */
export function pourInto(
  place: PlaceState,
  ingredientEntityId: string,
  massKg: number,
  tempC: number
): PlaceState {
  if (place.contentsEntityId !== null) {
    throw new Error(
      `Cannot pour "${ingredientEntityId}" into "${place.toolEntityId}": already contains ` +
        `"${place.contentsEntityId}" — this module has no mixing-temperature math for combining ` +
        `two pours (even of the same ingredient); start from emptyPlace() again instead.`
    );
  }
  if (massKg <= 0) {
    throw new Error(`massKg must be positive, got ${massKg}`);
  }
  return { toolEntityId: place.toolEntityId, contentsEntityId: ingredientEntityId, massKg, currentTempC: tempC };
}

/** Shared precondition both `advanceTempSeconds` and `advanceHeatSeconds`
 *  need, checked in this exact order (place-empty, then mismatched-entity)
 *  BEFORE either resolves any thermophysical field — a caller passing the
 *  wrong entity entirely should hear about that before hearing about a
 *  missing property on it. */
function assertPlaceMatchesEntity(place: PlaceState, contentsEntity: Entity): void {
  if (place.contentsEntityId === null || place.massKg === null) {
    throw new Error(`Cannot heat "${place.toolEntityId}": nothing has been poured in yet (call pourInto() first).`);
  }
  if (place.contentsEntityId !== contentsEntity.id) {
    throw new Error(
      `Place contains "${place.contentsEntityId}" but was asked to advance heat using "${contentsEntity.id}"'s ` +
        `thermophysical properties — mismatched entity.`
    );
  }
}

/**
 * Advance this place's temperature by `elapsedSeconds` of real (simulated,
 * not wall-clock — `ENGINE_INVARIANTS.md` #9, determinism) time under a
 * given heat source, toward an explicit `targetTempC` — the general form;
 * see this file's own top doc comment for why `targetTempC` is a caller-
 * supplied number here rather than a fixed field read off `contentsEntity`
 * the way the original boiling-only version worked, and for the real
 * physics distinction between "clamped at a phase-change ceiling" (water)
 * and "clamped at a chosen setpoint" (oil) that generalization required
 * naming explicitly.
 *
 * SAME energy-balance simplification `estimatedPreheatSeconds`
 * (`heat-source.ts`) already documents and uses (one constant mid-range
 * power/efficiency value for the whole interval, no real startup ramp, no
 * heat loss to the pot/room) — reused here, not reinvented.
 *
 * Throws if: `place` is empty or its contents don't match `contentsEntity`
 * (`assertPlaceMatchesEntity`); `contentsEntity` has no
 * `thermophysical.specificHeatJPerKgK` (nothing to compute a heating rate
 * from); `elapsedSeconds` is negative; or `targetTempC` is at or above a
 * declared `thermophysical.smokePointC` (a real safety ceiling this
 * function refuses to heat toward, not a value to silently clamp at).
 */
export function advanceTempSeconds(
  place: PlaceState,
  heatSource: HeatSourceProfile,
  elapsedSeconds: number,
  contentsEntity: Entity,
  targetTempC: number
): PlaceState {
  assertPlaceMatchesEntity(place, contentsEntity);

  const specificHeat = contentsEntity.thermophysical?.specificHeatJPerKgK;
  if (specificHeat === undefined) {
    throw new Error(
      `"${contentsEntity.id}" has no thermophysical.specificHeatJPerKgK — cannot compute how it heats.`
    );
  }

  const smokePointC = contentsEntity.thermophysical?.smokePointC;
  if (smokePointC !== undefined && targetTempC >= smokePointC) {
    throw new Error(
      `Refusing to heat "${contentsEntity.id}" toward ${targetTempC}°C: at or above its declared smokePointC ` +
        `(${smokePointC}°C) — a real safety ceiling, not a target to heat toward. Choose a lower targetTempC.`
    );
  }

  if (elapsedSeconds < 0) {
    throw new Error(`elapsedSeconds must be non-negative, got ${elapsedSeconds}`);
  }
  if (place.currentTempC >= targetTempC) {
    // Already there — nothing left to compute.
    return place;
  }

  const midPowerW = (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) / 2 / 100;
  const deliveredPowerW = midPowerW * midEfficiency;
  const energyDeliveredJ = deliveredPowerW * elapsedSeconds;
  const deltaT = energyDeliveredJ / (place.massKg! * specificHeat);
  const nextTempC = Math.min(place.currentTempC + deltaT, targetTempC);

  return { ...place, currentTempC: nextTempC };
}

/** Real, checkable state a robot's control loop would actually poll for —
 *  "have we reached the target yet" — rather than trusting a precomputed
 *  total duration blindly. General form of `isAtBoiling`. */
export function isAtTargetTemp(place: PlaceState, targetTempC: number): boolean {
  return place.currentTempC >= targetTempC;
}

/**
 * Boiling-specific convenience wrapper over `advanceTempSeconds`, kept for
 * every existing caller (`boil.json`/`simmer.json`'s use cases): resolves
 * `targetTempC` from `contentsEntity.thermophysical.boilingPointC` — the
 * one real case where the clamp target IS also a hard physical ceiling
 * (latent heat of vaporization; see this file's top doc comment). Same
 * external behavior as before the 2026-08-14 generalization.
 */
export function advanceHeatSeconds(
  place: PlaceState,
  heatSource: HeatSourceProfile,
  elapsedSeconds: number,
  contentsEntity: Entity
): PlaceState {
  assertPlaceMatchesEntity(place, contentsEntity);
  const boilingPointC = contentsEntity.thermophysical?.boilingPointC;
  if (boilingPointC === undefined) {
    throw new Error(
      `"${contentsEntity.id}" has no thermophysical.boilingPointC/specificHeatJPerKgK — cannot heat it without a ` +
        `known ceiling to clamp against.`
    );
  }
  return advanceTempSeconds(place, heatSource, elapsedSeconds, contentsEntity, boilingPointC);
}

/** Boiling-specific convenience wrapper over `isAtTargetTemp` — see
 *  `advanceHeatSeconds`'s doc comment. */
export function isAtBoiling(place: PlaceState, contentsEntity: Entity): boolean {
  const boilingPointC = contentsEntity.thermophysical?.boilingPointC;
  if (boilingPointC === undefined) {
    throw new Error(`"${contentsEntity.id}" has no thermophysical.boilingPointC to check against.`);
  }
  return isAtTargetTemp(place, boilingPointC);
}
