import { z } from "zod";

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
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CriticalControlPoint = z.infer<typeof CriticalControlPointSchema>;
