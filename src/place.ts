import type { Entity } from "./ingredient.ts";
import type { HeatSourceProfile } from "./heat-source.ts";

/**
 * A tool instance (pot/pan) as a real, stateful place: a temperature that
 * persists and evolves as a pure function of elapsed simulated time under
 * a heat source, shared by every ingredient co-located in it — rather
 * than a per-action-call guess on one ingredient. See `reference/place.md`
 * for design rationale, history, and citations.
 */
export interface PlaceState {
  /** The tool this place models, e.g. "pot" — matches an `Entity.id` of `kind: "tool"`. */
  readonly toolEntityId: string;
  /** `null` when nothing has been poured/placed in yet. */
  readonly contentsEntityId: string | null;
  readonly massKg: number | null;
  readonly currentTempC: number;
}

/** An empty place at a given ambient starting temperature. */
export function emptyPlace(toolEntityId: string, ambientTempC = 20): PlaceState {
  return { toolEntityId, contentsEntityId: null, massKg: null, currentTempC: ambientTempC };
}

/**
 * Pour a real, measured quantity of one ingredient into an (empty) place.
 * Pouring into an already-occupied place, or topping up more of the same
 * ingredient, is rejected outright — this module has no thermal-mixing
 * math to combine two pours. See `reference/place.md`.
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
  return {
    toolEntityId: place.toolEntityId,
    contentsEntityId: ingredientEntityId,
    massKg,
    currentTempC: tempC,
  };
}

/** Shared precondition for `advanceTempSeconds`/`advanceHeatSeconds`,
 *  checked place-empty then mismatched-entity — a caller passing the
 *  wrong entity entirely should hear about that first. */
function assertPlaceMatchesEntity(place: PlaceState, contentsEntity: Entity): void {
  if (place.contentsEntityId === null || place.massKg === null) {
    throw new Error(
      `Cannot heat "${place.toolEntityId}": nothing has been poured in yet (call pourInto() first).`
    );
  }
  if (place.contentsEntityId !== contentsEntity.id) {
    throw new Error(
      `Place contains "${place.contentsEntityId}" but was asked to advance heat using "${contentsEntity.id}"'s ` +
        `thermophysical properties — mismatched entity.`
    );
  }
}

/**
 * Advance this place's temperature by `elapsedSeconds` of simulated time
 * under a heat source, toward an explicit `targetTempC`. Same
 * energy-balance simplification as `heat-source.ts`'s
 * `estimatedPreheatSeconds`. Throws if the place is empty/mismatched, has
 * no `specificHeatJPerKgK`, `elapsedSeconds` is negative, or `targetTempC`
 * is at or above a declared `smokePointC`. See `reference/place.md`.
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
    return place;
  }

  const midPowerW =
    (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) /
    2 /
    100;
  const deliveredPowerW = midPowerW * midEfficiency;
  const energyDeliveredJ = deliveredPowerW * elapsedSeconds;
  const deltaT = energyDeliveredJ / (place.massKg! * specificHeat);
  const nextTempC = Math.min(place.currentTempC + deltaT, targetTempC);

  return { ...place, currentTempC: nextTempC };
}

/** Whether this place has reached `targetTempC` — the real, pollable
 *  state a control loop checks, rather than trusting a precomputed
 *  duration blindly. General form of `isAtBoiling`. */
export function isAtTargetTemp(place: PlaceState, targetTempC: number): boolean {
  return place.currentTempC >= targetTempC;
}

/**
 * Boiling-specific convenience wrapper over `advanceTempSeconds`: resolves
 * `targetTempC` from `contentsEntity.thermophysical.boilingPointC`. See
 * `reference/place.md` for why boiling is the one case where the clamp
 * target is also a hard physical ceiling.
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

/** Boiling-specific convenience wrapper over `isAtTargetTemp`. */
export function isAtBoiling(place: PlaceState, contentsEntity: Entity): boolean {
  const boilingPointC = contentsEntity.thermophysical?.boilingPointC;
  if (boilingPointC === undefined) {
    throw new Error(`"${contentsEntity.id}" has no thermophysical.boilingPointC to check against.`);
  }
  return isAtTargetTemp(place, boilingPointC);
}
