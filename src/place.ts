import type { Entity } from "./ingredient.ts";
import type { HeatSourceProfile } from "./heat-source.ts";

/**
 * PlaceState — the "heat as a shared, time-varying property of a PLACE
 * (pot/pan), not a per-action-call parameter on one ingredient" gap named in
 * `ROADMAP.md` (raised directly by the user while `SIMMER` was being built:
 * "heat is a function inside a place where many ingredients can live. it
 * increase and decrease in time.") and `LEARNINGS.md` 2026-08-13, which
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

/**
 * Advance this place's temperature by `elapsedSeconds` of real (simulated,
 * not wall-clock — `ENGINE_INVARIANTS.md` #9, determinism: same inputs must
 * always produce the same output, which a `Date.now()` read would violate)
 * time under a given heat source — the actual structural piece the ROADMAP
 * item was missing: state that evolves as an explicit function of elapsed
 * time, not a single one-shot total (`heat-source.ts`'s
 * `estimatedPreheatSeconds` already computed a total; this is its
 * complement, letting a caller check progress at any intermediate point,
 * which a real robot control loop — polling "are we there yet" — actually
 * needs).
 *
 * SAME energy-balance simplification `estimatedPreheatSeconds` already
 * documents and uses (one constant mid-range power/efficiency value for the
 * whole interval, no real startup ramp, no heat loss to the pot/room) —
 * reusing that one stated approximation rather than inventing a second,
 * silently different one for the exact same physical question.
 *
 * THE ONE PHYSICS FACT THIS FUNCTION MUST GET RIGHT, deliberately, because
 * getting it wrong would silently predict an impossible temperature: once
 * the contents reach `boilingPointC`, further delivered energy goes into
 * the liquid→vapor phase change (latent heat of vaporization), NOT into
 * further temperature rise — real water at a rolling boil stays at ~100°C
 * (sea level), it does not keep climbing the longer the burner runs. This
 * function therefore CLAMPS at `boilingPointC` rather than integrating
 * `ΔT = energy / (mass × specificHeat)` straight through it. It does NOT
 * model evaporative mass loss past that point (a real, smaller, genuinely
 * separate effect — the pot's water mass measurably drops over a long boil,
 * which this module doesn't track) — flagged as a real, unmodeled
 * refinement rather than silently assumed away, same standard as
 * `estimatedPreheatSeconds`'s own doc comment.
 *
 * Throws if `place` is empty (`pourInto` first) or `contentsEntity` has no
 * `boilingPointC` — a place with unknown contents has no defined ceiling to
 * clamp against, and silently picking one (e.g. 100) would misrepresent
 * anything that isn't water (see `oil.json`'s `smokePoint`, a genuinely
 * different physical ceiling this function doesn't attempt to generalize to
 * — oil doesn't boil at a food-safe temperature the way water does).
 */
export function advanceHeatSeconds(
  place: PlaceState,
  heatSource: HeatSourceProfile,
  elapsedSeconds: number,
  contentsEntity: Entity
): PlaceState {
  if (place.contentsEntityId === null || place.massKg === null) {
    throw new Error(`Cannot heat "${place.toolEntityId}": nothing has been poured in yet (call pourInto() first).`);
  }
  if (place.contentsEntityId !== contentsEntity.id) {
    throw new Error(
      `Place contains "${place.contentsEntityId}" but was asked to advance heat using "${contentsEntity.id}"'s ` +
        `thermophysical properties — mismatched entity.`
    );
  }
  const boilingPointC = contentsEntity.thermophysical?.boilingPointC;
  const specificHeat = contentsEntity.thermophysical?.specificHeatJPerKgK;
  if (boilingPointC === undefined || specificHeat === undefined) {
    throw new Error(
      `"${contentsEntity.id}" has no thermophysical.boilingPointC/specificHeatJPerKgK — cannot heat it without a ` +
        `known ceiling to clamp against.`
    );
  }
  if (elapsedSeconds < 0) {
    throw new Error(`elapsedSeconds must be non-negative, got ${elapsedSeconds}`);
  }
  if (place.currentTempC >= boilingPointC) {
    // Already there (or, for a mis-set starting temp above boiling, already
    // past it) — nothing left to compute, and dividing by an already-zero
    // ΔT budget below would be a wasted (if harmless) calculation.
    return place;
  }

  const midPowerW = (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) / 2 / 100;
  const deliveredPowerW = midPowerW * midEfficiency;
  const energyDeliveredJ = deliveredPowerW * elapsedSeconds;
  const deltaT = energyDeliveredJ / (place.massKg * specificHeat);
  const nextTempC = Math.min(place.currentTempC + deltaT, boilingPointC);

  return { ...place, currentTempC: nextTempC };
}

/** Real, checkable state a robot's control loop would actually poll for —
 *  "is the water boiling yet" — rather than trusting a precomputed total
 *  duration blindly. Named to mirror `boil.json`'s own `verification`
 *  field's description ("water at or near 100°C, a visible rolling boil"),
 *  the same real-world check this function makes computable instead of
 *  only human-observable. */
export function isAtBoiling(place: PlaceState, contentsEntity: Entity): boolean {
  const boilingPointC = contentsEntity.thermophysical?.boilingPointC;
  if (boilingPointC === undefined) {
    throw new Error(`"${contentsEntity.id}" has no thermophysical.boilingPointC to check against.`);
  }
  return place.currentTempC >= boilingPointC;
}
