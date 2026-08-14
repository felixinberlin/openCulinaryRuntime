import { EntitySchema, type Entity } from "../src/ingredient.ts";
import { ActionSchema, type Action } from "../src/action.ts";
import { CriticalControlPointSchema, type CriticalControlPoint } from "../src/thermal.ts";
import { HeatSourceProfileSchema, type HeatSourceProfile } from "../src/heat-source.ts";
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

/** Consolidated 2026-08-14 (was duplicated identically in
 *  heat-source.test.ts and place.test.ts — an external review correctly
 *  flagged the duplication, DRY per this file's own stated purpose). An
 *  "ideal" heat source (1000W, 100% efficiency) by default — deterministic,
 *  easy-to-hand-check numbers for tests that don't care about heat-source
 *  variation, same reasoning the other three builders' defaults follow. */
export function makeHeatSource(
  overrides: Partial<z.input<typeof HeatSourceProfileSchema>> & { id: string }
): HeatSourceProfile {
  return HeatSourceProfileSchema.parse({
    names: { en: overrides.id },
    typicalPowerWattsRange: { min: 1000, max: 1000 },
    thermalEfficiencyPercentRange: { min: 100, max: 100 },
    responseSpeed: "instant",
    controlPrecision: "precise",
    manualPositioningRelevance: "low",
    citation: { source: "test fixture", confidence: "commonly_cited_unverified" },
    ...overrides,
  });
}
