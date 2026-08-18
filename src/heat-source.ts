import { z } from "zod";
import { CitationSchema } from "./ingredient.ts";

/**
 * Real, cited performance facts about a physical heat provider (gas
 * burner, vitro radiant hob, wood fire, ...) — how fast it delivers heat
 * and how precisely it can be controlled, never the target temperature
 * itself (boiling point depends on pressure/altitude only). See
 * `reference/heat-source.md` for design rationale, history, and citations.
 */
export const HeatSourceProfileSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /** Realistic delivered-power range for a single home burner/ring/fire, in watts. */
  typicalPowerWattsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  /** What fraction of that power actually reaches the pot's contents rather
   *  than escaping around the sides / radiating away. 0-100. */
  thermalEfficiencyPercentRange: z.object({
    min: z.number().positive().max(100),
    max: z.number().positive().max(100),
  }),
  /** How quickly the delivered heat actually changes when the cook adjusts
   *  the control (or the fire changes on its own) — not the same as power. */
  responseSpeed: z.enum(["instant", "fast", "slow", "highly_variable"]),
  controlPrecision: z.enum(["precise", "moderate", "coarse"]),
  /** How much a skilled cook typically relies on physically repositioning
   *  the pan (not just adjusting the source's own control) to fine-tune
   *  delivered heat. See `reference/heat-source.md`. */
  manualPositioningRelevance: z.enum(["low", "moderate", "high"]),
  citation: CitationSchema,
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type HeatSourceProfile = z.infer<typeof HeatSourceProfileSchema>;

/**
 * How long (seconds) to raise `waterMassKg` of water from `initialTempC`
 * to `targetTempC` on `heatSource`, via Q = mcΔT / deliveredPower. A
 * single energy-balance estimate for planning, not a precise prediction —
 * see `reference/heat-source.md` for what it does and doesn't capture.
 */
export function estimatedPreheatSeconds(
  waterMassKg: number,
  initialTempC: number,
  targetTempC: number,
  heatSource: HeatSourceProfile,
  /** Midpoint of the source's power/efficiency range — a single best
   *  estimate, not a min/max pair. */
  waterSpecificHeatJPerKgK = 4186
): number {
  if (targetTempC <= initialTempC) {
    throw new Error(`targetTempC (${targetTempC}) must be above initialTempC (${initialTempC})`);
  }
  const energyRequiredJ = waterMassKg * waterSpecificHeatJPerKgK * (targetTempC - initialTempC);
  const midPowerW =
    (heatSource.typicalPowerWattsRange.min + heatSource.typicalPowerWattsRange.max) / 2;
  const midEfficiency =
    (heatSource.thermalEfficiencyPercentRange.min + heatSource.thermalEfficiencyPercentRange.max) /
    2 /
    100;
  const deliveredPowerW = midPowerW * midEfficiency;
  return energyRequiredJ / deliveredPowerW;
}
