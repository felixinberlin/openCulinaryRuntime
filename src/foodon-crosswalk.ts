import { z } from "zod";
import { CitationSchema } from "./ingredient.ts";

/**
 * FoodOn ontology crosswalk — an OPTIONAL, pluggable mapping from an entity
 * to its matching class in FoodOn (foodon.org), the OBO Foundry food
 * ontology. Not in `CLAUDE_DEV_CTX.md`'s original plan; added 2026-08-19 in
 * direct response to a user question about FoodOn coverage. Deliberately
 * NOT a field on `EntitySchema` — same precedent as `nutrition-
 * extension.ts`. See `reference/foodon-crosswalk.md` for design rationale,
 * scope, and citations.
 */

const FOODON_CURIE_RE = /^FOODON:\d{8}$/;

/** One entity's matched FoodOn class. `curie`/`iri` both identify the same
 *  class in FoodOn's own two standard forms (see `reference/foodon-
 *  crosswalk.md`); `label` is FoodOn's own class label AS RECORDED at
 *  match time — FoodOn is a living ontology and upstream labels can
 *  change. */
export const FoodOnCrosswalkEntrySchema = z.object({
  curie: z.string().regex(FOODON_CURIE_RE, "must be a FOODON: id, e.g. FOODON:03315354"),
  iri: z.string().min(1),
  label: z.string().min(1),
  citation: CitationSchema,
  note: z.string().optional(),
});
export type FoodOnCrosswalkEntry = z.infer<typeof FoodOnCrosswalkEntrySchema>;

/** One `data/foodon-crosswalk/*.json` file. `id` is the `Entity.id` this
 *  describes — same one-file-per-entity, `id`-is-the-join-key shape
 *  `nutrition-extension.ts`'s `MealPatternContributionFileSchema` already
 *  established. */
export const FoodOnCrosswalkFileSchema = z.object({
  id: z.string().min(1),
  foodOn: FoodOnCrosswalkEntrySchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type FoodOnCrosswalkFile = z.infer<typeof FoodOnCrosswalkFileSchema>;

/** FoodOn's own standard PURL form for a CURIE, e.g. "FOODON:03315354" ->
 *  "http://purl.obolibrary.org/obo/FOODON_03315354". Mechanical, not a
 *  second source of truth — every real data file stores its own `iri`
 *  directly rather than relying on this being called, but this lets a
 *  caller recompute/verify one from a bare `curie`. */
export function foodOnIriFromCurie(curie: string): string {
  if (!FOODON_CURIE_RE.test(curie)) {
    throw new Error(`Not a FOODON: curie: "${curie}"`);
  }
  return `http://purl.obolibrary.org/obo/${curie.replace(":", "_")}`;
}
