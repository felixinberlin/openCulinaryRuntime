import { z } from "zod";
import { EntityKindSchema } from "./ingredient.ts";

/**
 * Verbs Dictionary — canonical Action definitions.
 *
 * "Actions know themselves" (CONCEPT.md §1/§7): an Action is knowledge, not
 * code, and it is defined once, independently of any recipe or specific
 * ingredient that later uses it (ENGINE_INVARIANTS.md #2 "Actions never know
 * recipes"). One JSON file per verb under `data/actions/*.json`.
 *
 * This is distinct from the planned `recipe-step.ts` `MechanicalActionSchema`
 * (not implemented yet): that will describe one *instance* of a verb inside
 * a specific recipe's sequence (this target, these actual inputs/outputs).
 * `ActionSchema` here describes the verb itself, once, the same way
 * `EntitySchema` describes an ingredient/tool once.
 */

/**
 * A "Parameter" — CLAUDE_DEV_CTX.md's 4th pillar, "Culinary Details":
 * quantitative/qualitative details modifying a specific action, e.g. CUT's
 * "shape". `allowedValues` is a closed set (not a free string) because a
 * value here doubles as a state id when `outputs.transformedStateFromParameter`
 * points at it — see below.
 */
export const ActionParameterSchema = z.object({
  id: z.string().min(1),
  names: z.record(z.string(), z.string()).optional(),
  required: z.boolean().default(true),
  allowedValues: z.array(z.string()).min(1),
});
export type ActionParameter = z.infer<typeof ActionParameterSchema>;

/**
 * Byproducts are deliberately NOT listed on the action. CONCEPT.md §9:
 * "Recipes don't exist, transformations exist" — but *which* byproducts a
 * transformation yields is a fact about the target ingredient (see
 * `producedByproducts` on `EntitySchema`), not about the verb. Peeling a
 * potato yields potato peel; peeling an apple yields apple peel — the verb
 * PEEL is identical in both cases. `spawnsTargetByproducts: true` tells the
 * engine to read the byproducts off the target entity at execution time.
 */
export const ActionOutputsSchema = z
  .object({
    /** State id the primary target transitions to, e.g. "peeled". For actions
     *  with no state-determining parameter (PEEL, WASH). */
    transformedState: z.string().optional(),
    /**
     * For a parameterized action (CUT), the resulting state instead of a
     * fixed `transformedState`: names one of this action's `parameters[].id`,
     * and the target's new state becomes whatever value was passed for that
     * parameter (e.g. shape: "diced" -> state "diced"). Mutually exclusive
     * with `transformedState`.
     */
    transformedStateFromParameter: z.string().optional(),
    /**
     * A tag id (see `EntitySchema.possibleTags`) added to the target
     * alongside its existing state, e.g. SALT adds "salted" without
     * touching whatever state the target is already in — a boiled potato
     * stays "boiled" and becomes "boiled" + tag "salted", since seasoning
     * is orthogonal to cooking method/form, unlike boiled vs. fried.
     */
    addsTag: z.string().optional(),
    /** If true, entities listed in the target's own `producedByproducts` are spawned. */
    spawnsTargetByproducts: z.boolean().default(false),
    /**
     * If true, the target instance is fully consumed and removed from the
     * simulation inventory rather than kept around in `transformedState` —
     * CLAUDE_DEV_CTX.md's conservation-of-mass rule: "separate" destroys
     * the parent egg; only the spawned children remain afterward.
     * `transformedState` may still be set alongside this — it becomes the
     * state recorded in the run log for the instance's last moment before
     * removal, not a state anything will ever observe it in afterward.
     */
    destroysTarget: z.boolean().default(false),
  })
  .refine((o) => !(o.transformedState && o.transformedStateFromParameter), {
    message: "transformedState and transformedStateFromParameter are mutually exclusive",
  });
export type ActionOutputs = z.infer<typeof ActionOutputsSchema>;

export const ActionSchema = z.object({
  /** Stable machine id, e.g. "peel". Referenced by EntitySchema.allowedTransformations. */
  id: z.string().min(1),
  /** Uppercase verb, per CONCEPT.md convention (PEEL, CUT, MOVE, HEAT, ...). */
  verb: z.string().min(1),
  names: z.record(z.string(), z.string()).refine((n) => "en" in n, {
    message: "names must at least include an 'en' entry",
  }),
  /**
   * Tool entity ids required to perform this action (CONCEPT.md §5/§7:
   * "PEEL requires: knife"). Cross-checked against data/entities/ at
   * validation time — every id here must resolve to an entity of kind "tool".
   */
  requiredTools: z.array(z.string()).default([]),
  /**
   * The capability flag (EntitySchema.capabilities key) a target entity must
   * assert `true` for this action to be legal against it — e.g. "isPeelable".
   * Generalizes CONCEPT.md §7's "valid targets: vegetables" into the
   * capability model already used for entities (see ingredient.ts), instead
   * of hardcoding food categories into the verb.
   *
   * A missing or `false` capability both block the action; only an explicit
   * `false` on the entity is a *permanent* denial (see ingredient.ts
   * CapabilitiesSchema doc comment) that a future capability-inference pass
   * must never override.
   */
  requiredTargetCapability: z.string().optional(),
  validTargetKinds: z.array(EntityKindSchema).default(["ingredient"]),
  /**
   * Capabilities required of some OTHER ingredient present alongside the
   * target — e.g. FRY needs a frying medium (oil, butter, ...) in addition
   * to whatever's being fried. Capability-based like requiredTargetCapability,
   * not id-based like requiredTools: any isFryingMedium ingredient will do,
   * not one specific entity. Checked for presence only (not consumed/
   * decremented) — proper ingredient consumption belongs to the full
   * recipe-level inventory in ROADMAP.md Phase 4, not this per-action check.
   */
  requiredIngredientCapabilities: z.array(z.string()).default([]),
  parameters: z.array(ActionParameterSchema).default([]),
  outputs: ActionOutputsSchema,
  duration: z.enum(["fixed", "variable"]).default("variable"),
  precision: z.enum(["required", "optional"]).default("optional"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Action = z.infer<typeof ActionSchema>;
