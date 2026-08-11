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
 * Byproducts are deliberately NOT listed on the action. CONCEPT.md §9:
 * "Recipes don't exist, transformations exist" — but *which* byproducts a
 * transformation yields is a fact about the target ingredient (see
 * `producedByproducts` on `EntitySchema`), not about the verb. Peeling a
 * potato yields potato peel; peeling an apple yields apple peel — the verb
 * PEEL is identical in both cases. `spawnsTargetByproducts: true` tells the
 * engine to read the byproducts off the target entity at execution time.
 */
export const ActionOutputsSchema = z.object({
  /** State id the primary target transitions to, e.g. "peeled". */
  transformedState: z.string().optional(),
  /** If true, entities listed in the target's own `producedByproducts` are spawned. */
  spawnsTargetByproducts: z.boolean().default(false),
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
  outputs: ActionOutputsSchema,
  duration: z.enum(["fixed", "variable"]).default("variable"),
  precision: z.enum(["required", "optional"]).default("optional"),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Action = z.infer<typeof ActionSchema>;
