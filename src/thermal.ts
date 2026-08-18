import { z } from "zod";
import { DomainFactSchema } from "./ingredient.ts";

/**
 * D-value/z-value thermal-death-time kinetics: one cited (temperature,
 * required-hold-time) reference pair plus a z-value lets the required
 * hold time be computed at any actual temperature. Only valid when the
 * PRODUCT (not just the surrounding medium) is at the stated temperature
 * — see `reference/thermal.md` for the validity condition and citations.
 */
export const ThermalInactivationModelSchema = z.object({
  referenceTempC: z.number(),
  /** Minimum hold time (seconds) at referenceTempC — a real, cited figure. */
  referenceHoldSeconds: z.number().positive(),
  zValueC: z.number().positive(),
  /** States explicitly what physical assumption must hold for this
   *  specific use of the model to be valid. */
  validityCondition: z.string().min(1),
  source: z.string().min(1),
});
export type ThermalInactivationModel = z.infer<typeof ThermalInactivationModelSchema>;

/** t(T) = referenceHoldSeconds × 10^((referenceTempC − T) / zValueC) */
export function requiredHoldSeconds(model: ThermalInactivationModel, actualTempC: number): number {
  return (
    model.referenceHoldSeconds * Math.pow(10, (model.referenceTempC - actualTempC) / model.zValueC)
  );
}

/**
 * HACCP critical control point: FDA Food Code time-temperature-equivalence
 * (§3-401.11) — a pathogen is reduced to a safe level either by an
 * instantaneous higher temperature, or a lower temperature held for a
 * minimum time. Models exactly those two anchor points, not the full
 * multi-point curve. See `reference/thermal.md` for design rationale,
 * history, and citations.
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
  /** When true, engine.ts warns instead of rejecting a shortfall — the FDA
   *  Food Code's real "increased risk, permitted with disclosure" posture. */
  advisoryOnly: z.boolean().default(false),
  /** Citation for instantaneousC/heldC/heldSeconds — required, not optional. */
  source: z.string().min(1),
  /** The real, computable model behind the two fixed anchor points above,
   *  used when a step supplies an actual temperature. Absent where no real
   *  temperature parameter exists to compute against. See `reference/thermal.md`. */
  thermalModel: ThermalInactivationModelSchema.optional(),
  /** Structured, typed reference facts related to this CCP but not
   *  themselves the enforced threshold — informational context only;
   *  `engine.ts` never reads this for enforcement. See `reference/thermal.md`. */
  domainFacts: z.record(z.string(), DomainFactSchema).default({}),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CriticalControlPoint = z.infer<typeof CriticalControlPointSchema>;
