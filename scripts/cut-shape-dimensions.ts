import { join } from "node:path";
import { loadEntities, loadActions } from "../src/registry.ts";
import {
  CUT_SHAPE_DIMENSIONS,
  cutShapeDimensionMm,
  halvedOrQuarteredDimensionMm,
} from "../src/cut-dimensions.ts";

/**
 * Capability test for `src/cut-dimensions.ts` — prints real, cited
 * numeric meaning for every `cut.json` `shape` value. Directly answers
 * "a thin slice is about X diameter and X radio, and so on" (2026-08-15),
 * scoped deliberately to geometry only — see cut-dimensions.ts's own doc
 * comment for why heat-penetration/texture physics is a separate,
 * deferred piece of work, not attempted here.
 */

const root = join(import.meta.dirname, "..");
const entities = loadEntities(join(root, "data", "entities"));
const actions = loadActions(join(root, "data", "actions"));

const cut = actions.get("cut")!;
console.log(
  `cut.json's shape allowedValues: ${cut.parameters.find((p) => p.id === "shape")!.allowedValues!.join(", ")}\n`
);

for (const entry of CUT_SHAPE_DIMENSIONS) {
  console.log(`${entry.shape}: ${entry.dimensionMm.min}-${entry.dimensionMm.max}mm`);
  console.log(`  ${entry.description}`);
  console.log(`  Source: ${entry.citation.source}`);
  console.log(`  Confidence: ${entry.citation.confidence}\n`);
}

const potato = entities.get("potato")!;
const diameter = potato.physicalDimensions!.typicalDiameterCm!;
console.log(`potato.json's own typicalDiameterCm: ${diameter.min}-${diameter.max}cm\n`);

const halved = halvedOrQuarteredDimensionMm(diameter, 2);
const quartered = halvedOrQuarteredDimensionMm(diameter, 4);
console.log(
  `halved: ${halved.min.toFixed(1)}-${halved.max.toFixed(1)}mm largest dimension (half the potato's own diameter)`
);
console.log(
  `quartered: ${quartered.min.toFixed(1)}-${quartered.max.toFixed(1)}mm largest dimension (a quarter of it)\n`
);

console.log(
  "Real tension named, not resolved: this table's 'diced' " +
    `(${cutShapeDimensionMm("diced").min}-${cutShapeDimensionMm("diced").max}mm, professional small-to-medium dice) ` +
    "is meaningfully SMALLER than potato-doneness.ts's own 'diced' entry (~25mm, potato-salad/boiling-style) — " +
    "cut.json's single 'diced' value doesn't distinguish which one a given recipe means, see cut-dimensions.ts's doc comment."
);

console.log(
  "\nStill NOT computed here, on purpose: how any of these dimensions affect actual frying time, heat " +
    "penetration, or resulting texture — that's real, deferred heat-transfer physics, not this pass's scope."
);
