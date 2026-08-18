import { z } from "zod";
import { EntityKindSchema } from "./ingredient.ts";

/**
 * Verbs Dictionary — canonical Action definitions. One JSON file per verb
 * under `data/actions/*.json`. Describes the verb itself once, independent
 * of any recipe or ingredient (mirrors `EntitySchema`).
 * See `reference/action.md` for design rationale, history, and citations.
 */

/** A quantitative/qualitative parameter modifying an action — a closed
 *  `allowedValues` set, or a continuous `numericRange`. Exactly one of
 *  the two must be set. */
export const ActionParameterSchema = z
  .object({
    id: z.string().min(1),
    names: z.record(z.string(), z.string()).optional(),
    required: z.boolean().default(true),
    allowedValues: z.array(z.string()).min(1).optional(),
    numericRange: z
      .object({
        unit: z.string().min(1),
        min: z.number(),
        max: z.number(),
      })
      .optional(),
  })
  .refine((p) => !!p.allowedValues !== !!p.numericRange, {
    message: "exactly one of allowedValues or numericRange must be set",
  });
export type ActionParameter = z.infer<typeof ActionParameterSchema>;

/** What executing this action does to its target. See `reference/action.md`
 *  for why byproducts are never listed here (they're a fact about the
 *  target entity, not the verb). */
export const ActionOutputsSchema = z
  .object({
    /** State id the primary target transitions to, e.g. "peeled". For
     *  actions with no state-determining parameter (PEEL, WASH). */
    transformedState: z.string().optional(),
    /** For a parameterized action (CUT): names one of `parameters[].id`,
     *  and the resulting state becomes whatever value was passed for it.
     *  Mutually exclusive with `transformedState`. */
    transformedStateFromParameter: z.string().optional(),
    /** A tag id (`EntitySchema.possibleTags`) added alongside the
     *  target's existing state, e.g. SALT adds "salted". */
    addsTag: z.string().optional(),
    /** The parameter-driven sibling of `addsTag` — a value-to-tag map,
     *  for when the tag string doesn't match the parameter value directly. */
    addsTagFromParameter: z
      .object({
        parameter: z.string().min(1),
        tagByValue: z.record(z.string(), z.string()),
      })
      .optional(),
    /** If true, entities listed in the target's own `producedByproducts` are spawned. */
    spawnsTargetByproducts: z.boolean().default(false),
    /** If true, the target instance is fully consumed and removed from
     *  inventory (conservation of mass) rather than kept in `transformedState`. */
    destroysTarget: z.boolean().default(false),
    /** For a COMBINE-shaped action: the entity id of the new instance
     *  spawned from merging the target + secondary instance (both
     *  consumed). Mutually exclusive with `transformedState`/
     *  `transformedStateFromParameter`. */
    combinesInto: z.string().optional(),
  })
  .refine((o) => !(o.transformedState && o.transformedStateFromParameter), {
    message: "transformedState and transformedStateFromParameter are mutually exclusive",
  })
  .refine((o) => !(o.combinesInto && (o.transformedState || o.transformedStateFromParameter)), {
    message:
      "combinesInto is mutually exclusive with transformedState/transformedStateFromParameter",
  })
  .refine((o) => !(o.addsTag && o.addsTagFromParameter), {
    message: "addsTag and addsTagFromParameter are mutually exclusive",
  });
export type ActionOutputs = z.infer<typeof ActionOutputsSchema>;

/** How a machine would confirm this action's effect actually happened,
 *  not just that preconditions passed and a timer elapsed. Structured
 *  domain knowledge for a not-yet-built closed-loop layer — see
 *  `reference/action.md`. */
export const VerificationCriterionSchema = z.object({
  method: z.enum([
    "visual",
    "thermal",
    "mass_change",
    "tactile_force",
    "olfactory",
    "elapsed_time_only",
    "manual_confirmation",
  ]),
  /** What specifically to check, concrete enough to hand to a vision
   *  pipeline, a thermocouple threshold, or a human — not "check it's done". */
  description: z.string().min(1),
  /** How reliable this check actually is at confirming the effect really happened. */
  confidence: z.enum(["high", "medium", "low"]),
});
export type VerificationCriterion = z.infer<typeof VerificationCriterionSchema>;

/** Physical/operational danger from PERFORMING this action (to a person
 *  nearby) — distinct from `CriticalControlPointSchema` (danger from
 *  under-processed food). Structured data only, no control system. */
export const HazardSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  note: z.string().min(1),
});
export type Hazard = z.infer<typeof HazardSchema>;

export const ActionSchema = z
  .object({
    /** Stable machine id, e.g. "peel". Referenced by EntitySchema.allowedTransformations. */
    id: z.string().min(1),
    /** Uppercase verb, per CONCEPT.md convention (PEEL, CUT, MOVE, HEAT, ...). */
    verb: z.string().min(1),
    names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
      message: "names must at least include an 'en' entry",
    }),
    /** Tool entity ids required to perform this action — for when one
     *  SPECIFIC tool is genuinely required. See `requiredToolCapabilities`
     *  for the substitutable case. */
    requiredTools: z.array(z.string()).default([]),
    /** Capabilities required of some available tool — any tool asserting
     *  the capability satisfies it, not one hardcoded id. ANDed with
     *  `requiredTools` when both are set. */
    requiredToolCapabilities: z.array(z.string()).default([]),
    /** The capability flag a target entity must assert `true` for this
     *  action to be legal against it, e.g. "isPeelable". */
    requiredTargetCapability: z.string().optional(),
    validTargetKinds: z.array(EntityKindSchema).default(["ingredient"]),
    /** Capabilities required of some OTHER available ingredient (e.g.
     *  FRY needs a frying medium). Checked for presence only, never consumed. */
    requiredIngredientCapabilities: z.array(z.string()).default([]),
    /** The parameter-driven sibling of `requiredIngredientCapabilities` —
     *  which capability is required depends on the value passed for
     *  `parameter`. Also records which instance satisfied it
     *  (`ExecutionResult.matchedIngredientInstanceId`). */
    requiredIngredientCapabilityFromParameter: z
      .object({
        parameter: z.string().min(1),
        capabilityByValue: z.record(z.string(), z.string()),
      })
      .optional(),
    /** The capability a SECONDARY instance must assert for a
     *  COMBINE-shaped action — consumed like the primary target when
     *  `outputs.combinesInto` is set. */
    requiredSecondaryCapability: z.string().optional(),
    parameters: z.array(ActionParameterSchema).default([]),
    outputs: ActionOutputsSchema,
    duration: z.enum(["fixed", "variable"]).default("variable"),
    precision: z.enum(["required", "optional"]).default("optional"),
    /** One-off (instantaneous) vs. evolves over elapsed time and
     *  terminates on an observable condition (continuous). Set per the
     *  physical truth even where it disagrees with `applyAction`'s
     *  current one-shot behavior — see `reference/action.md`. Optional:
     *  absent means not yet audited, never silently defaulted. */
    actionKind: z.enum(["instantaneous", "continuous"]).optional(),
    /** Upper time bound for a `continuous` action (only). Consumed by
     *  `execution-bounds.ts`, not `applyAction`. */
    maxDurationSeconds: z.number().positive().optional(),
    /** Does a `continuous` action need the actor's ongoing hands (ACTIVE)
     *  or run itself once started (PASSIVE)? Only meaningful for
     *  `continuous` actions — every `instantaneous` action is definitionally
     *  active. Consumed by `dag-scheduler.ts` only. */
    requiresActiveAttention: z.boolean().optional(),
    /** How a machine would confirm this action's effect happened —
     *  see `VerificationCriterionSchema`. */
    verification: VerificationCriterionSchema.optional(),
    /** Physical/operational dangers from performing this action. Empty
     *  array is a real, audited claim ("no notable hazard"), not an
     *  unfilled field. */
    hazards: z.array(HazardSchema).default([]),
    /** Is blindly re-running this action after an interruption safe? See
     *  `reference/action.md` for the two distinct ways this can be true. */
    retrySafe: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((a) => !(a.actionKind === "instantaneous" && a.maxDurationSeconds !== undefined), {
    message:
      'maxDurationSeconds only applies to actionKind: "continuous" — an instantaneous action has no do-until loop for a timeout to bound',
  });
export type Action = z.infer<typeof ActionSchema>;
