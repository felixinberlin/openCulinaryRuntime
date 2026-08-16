import { z } from "zod";

/**
 * The standard microbiological thermal-death-time model — D-value/z-value
 * kinetics, the actual math the FDA Food Code's own multi-point tables were
 * derived from (this is not a novel formula, it's textbook thermobacteriology:
 * Stumbo's thermal death time model). One cited (temperature, required-hold-
 * time) reference pair, plus a z-value (the °C rise that cuts the required
 * hold time by a factor of 10), lets the required time be COMPUTED at any
 * actual temperature — replacing "pick more fixed anchor points if you need
 * more temperature options" with one formula that covers the whole curve.
 *
 * `requiredHoldSeconds` below is the formula:
 *   t(T) = referenceHoldSeconds × 10^((referenceTempC − T) / zValueC)
 *
 * CRITICAL VALIDITY CONDITION, not a footnote: this model assumes the
 * PRODUCT is at the stated temperature, not just the surrounding medium. It
 * is only honestly applicable when the product reaches medium temperature
 * quickly — thin, liquid, well-mixed, no insulating barrier (e.g. already-
 * separated liquid egg yolk in a shallow water bath). It is NOT valid for a
 * whole egg still in its shell: the shell measurably slows heat penetration
 * to the interior, so "water bath at T" does not mean "yolk at T" for a
 * significant initial period. Using this formula against water-bath
 * temperature for an in-shell process would understate the required time.
 * `validityCondition` on each instance states this explicitly per use, not
 * just here.
 */
export const ThermalInactivationModelSchema = z.object({
  referenceTempC: z.number(),
  /** Minimum hold time (seconds) at referenceTempC — a real, cited
   *  regulatory or published figure, not a derived/computed one. */
  referenceHoldSeconds: z.number().positive(),
  zValueC: z.number().positive(),
  /** States explicitly what physical assumption must hold for this specific
   *  use of the model to be valid — see the doc comment above. */
  validityCondition: z.string().min(1),
  source: z.string().min(1),
});
export type ThermalInactivationModel = z.infer<typeof ThermalInactivationModelSchema>;

export function requiredHoldSeconds(model: ThermalInactivationModel, actualTempC: number): number {
  return (
    model.referenceHoldSeconds * Math.pow(10, (model.referenceTempC - actualTempC) / model.zValueC)
  );
}

/**
 * CriticalControlPointSchema — ROADMAP.md Phase 2's HACCP model
 * (CLAUDE_DEV_CTX.md: "thermal steps must enforce safety thresholds, e.g.
 * holding a minimum internal temperature of 135°F for at least 15 seconds").
 *
 * Grounded in the FDA Food Code's actual time-temperature-equivalence
 * pattern (§3-401.11): a pathogen can be reduced to a safe level either by
 * an instantaneous higher temperature, OR a lower temperature held for a
 * minimum time — the same log-reduction, two different paths. This schema
 * models exactly those two points (`instantaneousC` and `heldC`/
 * `heldSeconds`), not the full multi-point curve the real Food Code table
 * specifies (which has many more (temperature, time) pairs between those
 * two extremes) — reconstructing that whole curve from memory risked
 * quietly-wrong numbers, so this stops at the two anchor points that are
 * confidently, commonly published (see data/ccps/*.json `source` fields).
 * `thermalModel` (optional, below) is the real, computable escape hatch from
 * that limitation where it's honestly applicable — see its own doc comment.
 *
 * `advisoryOnly` captures a real regulatory nuance, not a simplification:
 * the FDA Food Code explicitly permits some animal-food dishes served
 * below the CCP (a still-runny egg yolk) as a recognized "increased risk"
 * consumer-advisory practice, not a banned one. engine.ts treats a
 * shortfall against an advisoryOnly CCP as a warning, not a hard reject.
 */
export const CriticalControlPointSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /** Reach-and-hold-for-an-instant target, °C. */
  instantaneousC: z.number(),
  /** Lower alternative target, °C, valid only if held for `heldSeconds`. */
  heldC: z.number(),
  heldSeconds: z.number().positive(),
  /** The organism this threshold is sized against, e.g. "Salmonella spp." */
  pathogen: z.string().min(1),
  /** See doc comment above — engine.ts warns instead of rejecting when true. */
  advisoryOnly: z.boolean().default(false),
  /** Citation for instantaneousC/heldC/heldSeconds — required, not optional:
   *  an unsourced number here is exactly the "quietly-wrong" failure mode
   *  this schema exists to avoid. */
  source: z.string().min(1),
  /** Optional: the real, computable model behind the two fixed anchor points
   *  above. When present AND the step supplies an actual temperature
   *  parameter (waterTempC), engine.ts uses this to compute the required
   *  hold time at THAT exact temperature instead of only ever checking
   *  against the one fixed heldC/heldSeconds pair. Absent for CCPs where no
   *  real temperature parameter exists to compute against (FRY/BOIL/
   *  SCRAMBLE only have categorical heatLevel, not a real °C value) — the
   *  fixed two-point check is the honest ceiling for those, not a
   *  placeholder waiting to be upgraded. */
  thermalModel: ThermalInactivationModelSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CriticalControlPoint = z.infer<typeof CriticalControlPointSchema>;
