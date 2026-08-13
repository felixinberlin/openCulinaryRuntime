import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import type { z } from "zod";

/**
 * Minimal-but-valid builders for the three core schemas, so each test only
 * has to spell out the fields it actually cares about. Deliberately routed
 * through `.parse()` (not built as raw object literals) so a test failure
 * that stems from a bad fixture, rather than the code under test, fails
 * loudly at the schema boundary instead of silently passing malformed data
 * into `applyAction`.
 *
 * Typed against each schema's z.input (pre-default shape, e.g. `outputs:
 * {}` without spawnsTargetByproducts/destroysTarget filled in yet) rather
 * than its z.infer output type — a test fixture only supplies the fields it
 * cares about and lets Zod's own defaults fill the rest, same as every
 * data/*.json file does.
 */

export function makeEntity(overrides: Partial<z.input<typeof EntitySchema>> & { id: string }): Entity {
  return EntitySchema.parse({
    kind: "ingredient",
    names: { en: overrides.id },
    aggregationState: "solid",
    ...overrides,
  });
}

export function makeAction(overrides: Partial<z.input<typeof ActionSchema>> & { id: string }): Action {
  return ActionSchema.parse({
    verb: overrides.id.toUpperCase(),
    names: { en: overrides.id },
    outputs: {},
    ...overrides,
  });
}

export function makeCcp(
  overrides: Partial<z.input<typeof CriticalControlPointSchema>> & { id: string }
): CriticalControlPoint {
  return CriticalControlPointSchema.parse({
    names: { en: overrides.id },
    instantaneousC: 74,
    heldC: 57,
    heldSeconds: 60,
    pathogen: "Salmonella spp.",
    source: "test fixture — not a real citation",
    ...overrides,
  });
}
