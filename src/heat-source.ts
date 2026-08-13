import { z } from "zod";
import { CitationSchema } from "./ingredient.ts";

/**
 * HeatSourceProfileSchema — real, cited performance facts about a physical
 * heat provider (a gas burner, a ceramic-glass "vitro" radiant hob, an open
 * wood fire, ...). Added 2026-08-13 in direct response to "how long does
 * boiling an egg take on gas vs. vitro vs. wood" — the same class of
 * question `thermal.ts`'s `CriticalControlPointSchema` answers for pathogen
 * safety, but for a genuinely different physical question (heating RATE,
 * not kill-time), so it's its own file/collection (`data/heat-sources/*.json`,
 * `registry.ts`'s `loadHeatSources`) rather than bolted onto
 * `CriticalControlPointSchema` or `EntitySchema` — same reasoning
 * `thermal.ts`'s own doc comment gives for why CCPs are a separate top-level
 * knowledge collection, not a field grafted onto whatever entity happens to
 * need one.
 *
 * THE ONE FACT THIS SCHEMA MUST GET RIGHT, EXPLICITLY, BECAUSE IT'S A REAL
 * COMMON MISCONCEPTION: which heat source you use does NOT change the
 * temperature water boils at. Boiling point is a function of PRESSURE
 * (altitude) only — see `water.json`'s own citation note — never of how
 * vigorously or with what equipment the water is heated. A rolling boil on
 * a roaring wood fire and a bare simmer on a low gas flame are BOTH water at
 * ~100°C at sea level; the fire just makes it reach and maintain that
 * temperature faster/slower and more or less steadily. What a heat source
 * actually changes is (1) how long it takes to REACH boiling from a cold
 * start (`estimatedPreheatSeconds` below), and (2) how precisely a cook can
 * hold a target temperature/simmer once there (`controlPrecision`) — never
 * the target temperature itself. Modeling heat source as changing the
 * required BOIL `durationSeconds` (the time spent AT temperature, which is
 * what actually cooks the egg / clears a CCP) would be physically wrong;
 * this schema deliberately stays out of that number's way.
 */
export const HeatSourceProfileSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /** Realistic delivered-power range for a single home burner/ring/fire, in
   *  watts — a range, not one number, because even "the same" heat source
   *  varies by unit size/setting (and, for wood, hugely by fire size). */
  typicalPowerWattsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  /** What fraction of that power actually reaches the pot's contents rather
   *  than escaping around the sides / radiating away — the real reason gas
   *  and wood need much more raw power than vitro/induction to deliver the
   *  same heat to the food. 0-100. */
  thermalEfficiencyPercentRange: z.object({ min: z.number().positive().max(100), max: z.number().positive().max(100) }),
  /** How quickly the delivered heat actually changes when the cook adjusts
   *  the control (or the fire changes on its own) — NOT the same thing as
   *  power. Vitro is "slow" despite being a controllable dial specifically
   *  because the ceramic glass + coil underneath has real thermal mass/lag;
   *  gas is "instant" because a flame's size visibly and immediately tracks
   *  the knob; wood is "highly_variable" because it isn't a dial at all —
   *  airflow/fuel state drift on their own between deliberate adjustments. */
  responseSpeed: z.enum(["instant", "fast", "slow", "highly_variable"]),
  controlPrecision: z.enum(["precise", "moderate", "coarse"]),
  citation: CitationSchema,
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type HeatSourceProfile = z.infer<typeof HeatSourceProfileSchema>;

/**
 * Real physics (Q = mcΔT, time = Q / deliveredPower), the same
 * "implement the actual textbook formula instead of a hand-picked anchor"
 * move `thermal.ts`'s `requiredHoldSeconds` made for pathogen kill-time —
 * applied here to a genuinely different question (how long to REACH a
 * target temperature from a cold start, not how long to HOLD one).
 *
 * Deliberately a standalone, uncalled-by-anything-yet utility — like
 * `requiredHoldSeconds` was before `engine.ts`'s CCP check adopted it, this
 * is real, checkable knowledge available for a recipe-authoring/planning
 * layer to use, not something `applyAction` consumes today (ROADMAP.md:
 * "don't worry about the engine yet"). It answers "how long," never
 * "what temperature" — see this file's own top doc comment for why the
 * target temperature (100°C at sea level for boiling water) must NOT be a
 * function of which heat source is used.
 *
 * `waterSpecificHeatJPerKgK` defaults to water's real, standard value
 * (4186 J/(kg·K), CRC Handbook) rather than requiring every caller to pass
 * it — see `water.json`'s `thermophysical.specificHeatJPerKgK`.
 */
export function estimatedPreheatSeconds(
  waterMassKg: number,
  initialTempC: number,
  targetTempC: number,
  heatSource: HeatSourceProfile,
  /** Pick the representative (midpoint) power/efficiency within the
   *  source's range — a single best estimate, not a min/max pair, since
   *  callers generally want one number to reason about, not a further
   *  range to propagate. Callers wanting the full spread can compute the
   *  min/max cases directly from `heatSource`'s own range fields. */
  waterSpecificHeatJPerKgK = 4186
): number {
  if (targetTempC <= initialTempC) {
    throw new Error(`targetTempC (${targetTempC}) must be above initialTempC (${initialTempC})`);
  }
  const energyRequiredJ = waterMassKg * waterSpecificHeatJPerKgK * (targetTempC - initialTempC);
  const midPowerW = (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) / 2 / 100;
  const deliveredPowerW = midPowerW * midEfficiency;
  return energyRequiredJ / deliveredPowerW;
}
