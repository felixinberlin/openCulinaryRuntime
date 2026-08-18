import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited seconds ranges behind `boil.json`'s `pieceSize` labels
 * (whole/halved_or_quartered/diced) — the potato sibling of
 * `egg-doneness.ts`'s `EGG_BOIL_DONENESS`, same structure and confidence
 * tier. Scoped to `startMethod: "boiling_start"`, even though real
 * sources recommend cold-start for potato as objectively better — see
 * `reference/potato-doneness.md` for that named tension, the overlapping
 * ranges, assumptions, and citations.
 */
export const PotatoBoilDonenessSchema = z.object({
  pieceSize: z.enum(["whole", "halved_or_quartered", "diced"]),
  durationSecondsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type PotatoBoilDoneness = z.infer<typeof PotatoBoilDonenessSchema>;

const ATK_CITATION: Citation = {
  source:
    'America\'s Test Kitchen, "Boiling Potatoes" (americastestkitchen.com/how_tos/5964-boiling-potatoes) — size-banded whole-potato boiling times (2-2.5" diameter: 15-18 min), and the cold-start-is-both-more-even-AND-faster finding cited in reference/potato-doneness.md.',
  confidence: "commonly_cited_unverified",
  note: "A professional test-kitchen source, not independently re-verified against a primary/peer-reviewed source this session.",
};

const CUT_PIECE_CITATION: Citation = {
  source:
    'Convergent across commonly-cited cooking guides for halved/quartered and diced/cubed potato boiling times (e.g. A Couple Cooks, "How Long to Boil Potatoes for Potato Salad" — large cubes/quarters 8-15min, diced/baby potatoes ~10min; Key to My Lime\'s independent ~15-20min quartered figure cross-checked against the same range).',
  confidence: "commonly_cited_unverified",
  note: "Blended across multiple convergent consumer cooking sources, not one single authoritative test-kitchen source — reported as a wider range for that reason.",
};

export const POTATO_BOIL_DONENESS: readonly PotatoBoilDoneness[] = [
  {
    pieceSize: "diced",
    durationSecondsRange: { min: 480, max: 720 },
    description:
      "~1-inch (2.5cm) dice — the fastest-cooking real preparation, used for potato salad and quick sides.",
    citation: CUT_PIECE_CITATION,
  },
  {
    pieceSize: "halved_or_quartered",
    durationSecondsRange: { min: 480, max: 1200 },
    description:
      "Halved or quartered — the common whole-but-reduced size for potato salad/roasting prep, real range depends heavily on the source potato's own size.",
    citation: CUT_PIECE_CITATION,
  },
  {
    pieceSize: "whole",
    durationSecondsRange: { min: 900, max: 1080 },
    // Diameter figure lives on potato.json's own physicalDimensions.
    // typicalDiameterCm — same ATK citation, not duplicated here.
    description:
      "Whole, unpeeled, potato.json's own typicalDiameterCm — the classic 'boil then peel' or potato-for-mash starting point.",
    citation: ATK_CITATION,
  },
];

/** Throws rather than returning undefined, same contract as
 *  `egg-doneness.ts`'s `eggBoilDonenessRange`. */
export function potatoBoilDonenessRange(pieceSize: "whole" | "halved_or_quartered" | "diced"): {
  min: number;
  max: number;
} {
  const entry = POTATO_BOIL_DONENESS.find((e) => e.pieceSize === pieceSize);
  if (!entry)
    throw new Error(
      `No POTATO_BOIL_DONENESS entry for "${pieceSize}" — out of sync with boil.json's allowedValues`
    );
  return entry.durationSecondsRange;
}
