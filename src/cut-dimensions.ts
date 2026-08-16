import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited numeric meaning for `cut.json`'s `shape` parameter — added
 * 2026-08-15, the third instance of a now-established playbook
 * (`egg-doneness.ts`'s `EGG_BOIL_DONENESS`, `potato-doneness.ts`'s
 * `POTATO_BOIL_DONENESS`): an existing categorical action parameter gets a
 * real, cited numeric range via a standalone reference-data module, with
 * ZERO changes to the action's own schema or to `engine.ts`. Before this
 * file, "sliced"/"diced"/"julienne"/etc. were labels with no attached size
 * anywhere in this repo — every size hint that existed
 * (`potato.json`'s `fryingScienceNote`, `par-fry.json`'s `thicknessNote`,
 * `potato-doneness.ts`'s own `description` strings) was unenforced prose.
 *
 * DIRECTLY SCOPED, NOT THE WHOLE "cut geometry, oil temp, and time change
 * texture" QUESTION THAT MOTIVATED THIS: real food science does not reduce
 * that question to one formula — this repo's own already-cited Kalogianni
 * & Smith (2013) paper (REFERENCES.md, `data/actions/fry.json`/
 * `par-fry.json`) found frying is a nonlinear, coupled process (crust
 * thickness plateaus, water loss and oil uptake are NOT simply linked).
 * This file answers only the first, honestly-buildable half: what does
 * "sliced" actually MEAN in millimeters. It does NOT compute or predict
 * frying time, heat penetration, or texture from these numbers — that
 * would need real heat-transfer physics (a genuinely different, larger,
 * deliberately deferred piece of work — see `data/actions/fry.json`'s
 * `oilTempCNote`, which already names "a real fryer would adjust duration
 * for the target's actual size/shape, and this doesn't" as an open gap).
 *
 * A REAL TENSION NAMED, NOT SILENTLY RESOLVED: `potato-doneness.ts`'s own
 * `diced` entry describes "~1-inch (2.5cm) dice" (a potato-salad/boiling-
 * oriented cut) — genuinely LARGER than this file's `diced` entry below
 * (professional "small-to-medium dice," ~6-13mm, a sauté/fry-oriented
 * cut). Both are real; `cut.json`'s single `diced` enum value doesn't
 * distinguish which one a given recipe means, and this file does not
 * invent a resolution — it's named here so the discrepancy is visible
 * rather than silently picking one number and implying it covers both.
 *
 * `sliced` is scoped to the specific case that actually motivated this —
 * a thin, round potato slice for frying (tortilla de patatas) — not a
 * universal "sliced" standard, because none exists: unlike dice/julienne,
 * professional knife-cut taxonomy doesn't define one fixed thickness for
 * "sliced" in general (real recipes always further qualify it, e.g. "1/4
 * inch rounds").
 *
 * `halved`/`quartered` are NOT independently sourced — they're a fraction
 * of `potato.json`'s own `physicalDimensions.typicalDiameterCm` (added the
 * same day), computed here rather than cited separately, since halving/
 * quartering a potato is arithmetic on the potato's own real size, not a
 * separate knife-cut standard.
 *
 * `chopped`/`minced` have NO authoritative numeric standard — Wikipedia's
 * "List of culinary knife cuts" (the source for julienne/dice below,
 * checked directly 2026-08-15) explicitly defines "mincing" only as
 * "very finely divided into uniform pieces," no measurement, and has no
 * entry for "chopped" at all. The ranges given for these two are honest
 * best-effort approximations from general culinary usage, not a cited
 * standard — flagged with a distinctly worded citation note rather than
 * presented with the same confidence as the sourced entries.
 */
export const CutShapeDimensionSchema = z.object({
  shape: z.enum(["sliced", "diced", "julienne", "chopped", "minced", "halved", "quartered"]),
  /** The characteristic dimension for this shape — thickness for a slice,
   *  edge length for a dice/julienne cross-section, in millimeters. Not
   *  every real dimension of the cut (e.g. julienne's 3-5cm LENGTH isn't
   *  captured) — just the one that matters most for how fast heat can
   *  reach the center, the dimension a future physics pass would need. */
  dimensionMm: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type CutShapeDimension = z.infer<typeof CutShapeDimensionSchema>;

const KNIFE_CUT_STANDARD_CITATION: Citation = {
  source:
    'Wikipedia, "List of culinary knife cuts" (en.wikipedia.org/wiki/List_of_culinary_knife_cuts) — standard professional knife-cut size definitions (julienne: 1/8"x1/8"x1-2"; fine julienne: 1/16"x1/16"x1-2"; brunoise: 1/8" sides; small dice: 1/4" sides; medium dice: 1/2" sides; large dice: 3/4" sides), aggregating culinary-school-taught standards (e.g. Escoffier School of Culinary Arts).',
  confidence: "commonly_cited_unverified",
  note: "Checked via direct lookup 2026-08-15. mm values below are this repo's own precise conversion from the cited inch fractions (1/4in = 6.35mm, not a rounded 5-6mm approximation), not independently re-measured or re-derived from a primary culinary-school textbook.",
};

const TORTILLA_SLICE_CITATION: Citation = {
  source:
    'Convergent tortilla de patatas recipe sources, checked via direct lookup 2026-08-15: The Mediterranean Dish (themediterraneandish.com/spanish-tortilla-recipe) specifies "1/8-inch-thick slices" (~3.2mm); Spanish Sabores (spanishsabores.com/best-spanish-omelet-recipe) specifies "about 5 mm thick."',
  confidence: "commonly_cited_unverified",
  note: "Two independent consumer recipe sources, both directly quoted this session, converging on a 3-5mm range for this specific dish's slicing technique — not a universal 'sliced' standard (see this file's own doc comment for why none exists).",
};

const LOOSE_TERM_CITATION_NOTE =
  'No authoritative numeric standard exists for this term (Wikipedia\'s "List of culinary knife cuts" gives no measurement for it — checked directly 2026-08-15). This range is an honest best-effort approximation from general culinary usage, not a sourced figure — reported with the same schema shape as the sourced entries for consistency, not the same confidence.';

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
      "Professional small-to-medium dice (cube edge). Does NOT cover potato-doneness.ts's own larger ~25mm potato-salad/boiling-style dice — a real, named tension, see this file's doc comment.",
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

/** Convenience lookup — throws rather than returning undefined, same
 *  contract as `eggBoilDonenessRange`/`potatoBoilDonenessRange`. Covers
 *  only `sliced`/`diced`/`julienne`/`chopped`/`minced` — `halved`/
 *  `quartered` are handled by `halvedOrQuarteredDimensionMm` below, since
 *  they're derived from `potato.json`'s own size rather than an
 *  independently cited knife-cut standard. */
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
 * `physicalDimensions.typicalDiameterCm` (e.g. `potato.json`), not an
 * independently cited knife-cut standard — halving/quartering a potato
 * doesn't have a "standard" size the way a dice or julienne does, it's
 * simply a fraction of whatever potato you started with. Returns the
 * resulting piece's largest dimension in mm, same unit as
 * `cutShapeDimensionMm` for consistency.
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
