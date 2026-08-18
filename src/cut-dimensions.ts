import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited numeric meaning for `cut.json`'s `shape` parameter (a real,
 * cited millimeter range via a standalone reference-data module, zero
 * changes to the action's own schema or to `engine.ts`) — what "sliced"/
 * "diced"/"julienne" etc. actually mean in mm. Does NOT compute or
 * predict frying time/texture from these numbers — that's real
 * heat-transfer physics, a separate concern (`heat-penetration.ts`/
 * `recipe-explain.ts` compose with this). See `reference/cut-dimensions.md`
 * for design rationale, scope, and citations.
 */
export const CutShapeDimensionSchema = z.object({
  shape: z.enum(["sliced", "diced", "julienne", "chopped", "minced", "halved", "quartered"]),
  /** The characteristic dimension for this shape — thickness for a
   *  slice, edge length for a dice/julienne cross-section, in millimeters. */
  dimensionMm: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type CutShapeDimension = z.infer<typeof CutShapeDimensionSchema>;

const KNIFE_CUT_STANDARD_CITATION: Citation = {
  source:
    'Wikipedia, "List of culinary knife cuts" (en.wikipedia.org/wiki/List_of_culinary_knife_cuts) — standard professional knife-cut size definitions (julienne: 1/8"x1/8"x1-2"; fine julienne: 1/16"x1/16"x1-2"; brunoise: 1/8" sides; small dice: 1/4" sides; medium dice: 1/2" sides; large dice: 3/4" sides), aggregating culinary-school-taught standards (e.g. Escoffier School of Culinary Arts).',
  confidence: "commonly_cited_unverified",
  note: "Checked via direct lookup 2026-08-15. mm values below are this repo's own precise conversion from the cited inch fractions. See reference/cut-dimensions.md.",
};

const TORTILLA_SLICE_CITATION: Citation = {
  source:
    'Convergent tortilla de patatas recipe sources, checked via direct lookup 2026-08-15: The Mediterranean Dish (themediterraneandish.com/spanish-tortilla-recipe) specifies "1/8-inch-thick slices" (~3.2mm); Spanish Sabores (spanishsabores.com/best-spanish-omelet-recipe) specifies "about 5 mm thick."',
  confidence: "commonly_cited_unverified",
  note: "Two independent consumer recipe sources converging on a 3-5mm range for this specific dish's slicing technique — not a universal 'sliced' standard. See reference/cut-dimensions.md.",
};

const LOOSE_TERM_CITATION_NOTE =
  'No authoritative numeric standard exists for this term (Wikipedia\'s "List of culinary knife cuts" gives no measurement for it — checked directly 2026-08-15). This range is an honest best-effort approximation from general culinary usage, not a sourced figure.';

export const CUT_SHAPE_DIMENSIONS: readonly CutShapeDimension[] = [
  {
    shape: "sliced",
    dimensionMm: { min: 3, max: 5 },
    description:
      "Thin round slice, the tortilla de patatas / potato-frying case that motivated this table.",
    citation: TORTILLA_SLICE_CITATION,
  },
  {
    shape: "diced",
    dimensionMm: { min: 6.35, max: 12.7 },
    description:
      "Professional small-to-medium dice (cube edge). Does NOT cover potato-doneness.ts's own larger ~25mm potato-salad/boiling-style dice — a real, named tension, see reference/cut-dimensions.md.",
    citation: KNIFE_CUT_STANDARD_CITATION,
  },
  {
    shape: "julienne",
    dimensionMm: { min: 1.6, max: 3.2 },
    description:
      'Matchstick cross-section, spanning fine julienne (1/16") to regular julienne (1/8"); real length is 3-5cm, not captured by this single dimension.',
    citation: KNIFE_CUT_STANDARD_CITATION,
  },
  {
    shape: "chopped",
    dimensionMm: { min: 10, max: 20 },
    description: "Rough-cut, irregular pieces — the loosest-defined term in this set.",
    citation: {
      source: "General culinary usage, no single authoritative standard",
      confidence: "commonly_cited_unverified",
      note: LOOSE_TERM_CITATION_NOTE,
    },
  },
  {
    shape: "minced",
    dimensionMm: { min: 1, max: 2 },
    description: 'Finer than brunoise (1/8"/3mm) — the finest cut in this set.',
    citation: {
      source: "General culinary usage, no single authoritative standard",
      confidence: "commonly_cited_unverified",
      note: LOOSE_TERM_CITATION_NOTE,
    },
  },
];

/** Throws rather than returning undefined, same contract as
 *  `eggBoilDonenessRange`/`potatoBoilDonenessRange`. Covers only the five
 *  independently-cited knife-cut shapes — `halved`/`quartered` are
 *  handled by `halvedOrQuarteredDimensionMm` below. */
export function cutShapeDimensionMm(
  shape: "sliced" | "diced" | "julienne" | "chopped" | "minced"
): { min: number; max: number } {
  const entry = CUT_SHAPE_DIMENSIONS.find((e) => e.shape === shape);
  if (!entry)
    throw new Error(
      `No CUT_SHAPE_DIMENSIONS entry for "${shape}" — out of sync with cut.json's allowedValues`
    );
  return entry.dimensionMm;
}

/**
 * `halved`/`quartered` sizes are arithmetic on an entity's own
 * `physicalDimensions.typicalDiameterCm`, not an independently cited
 * knife-cut standard — halving/quartering a potato is simply a fraction
 * of whatever potato you started with. Returns the resulting piece's
 * largest dimension in mm. See `reference/cut-dimensions.md`.
 */
export function halvedOrQuarteredDimensionMm(
  typicalDiameterCm: { min: number; max: number },
  pieces: 2 | 4
): { min: number; max: number } {
  const divisor = pieces === 2 ? 2 : 4;
  return {
    min: (typicalDiameterCm.min * 10) / divisor,
    max: (typicalDiameterCm.max * 10) / divisor,
  };
}
