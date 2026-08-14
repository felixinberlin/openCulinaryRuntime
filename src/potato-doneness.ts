import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * The potato half of "how long, depending on temperature and piece size" —
 * added 2026-08-14 as the direct sibling of `egg-doneness.ts` (this file
 * mirrors that one's structure and rigor deliberately, not coincidentally:
 * same "a robot needs a real number, not a vague label" motivation, same
 * `commonly_cited_unverified` confidence tier, same real-range-not-a-point
 * shape). Before this file, `boil.json`'s new `pieceSize` parameter (below)
 * had no attached meaning anywhere in this repo — informational only, same
 * starting point `yolkDoneness` had before `EGG_BOIL_DONENESS` existed.
 *
 * THE ONE REAL FINDING THAT MAKES THIS TABLE GENUINELY DIFFERENT FROM
 * `EGG_BOIL_DONENESS`, not just a copy with different numbers: for egg,
 * `boiling_start` (egg lowered into already-boiling water) is the common,
 * assumed default technique — see `boil.json`'s `startMethodNote`. For
 * potato, multiple independent sources (America's Test Kitchen; A Couple
 * Cooks) explicitly recommend the OPPOSITE as the objectively better
 * technique, not just a gentler alternative: potatoes started in COLD water
 * and brought up to a boil together cook more EVENLY (heat has time to
 * penetrate the dense flesh before the exterior overcooks) and America's
 * Test Kitchen's own testing found this also takes LESS total time than a
 * boiling-water start, not more — see REFERENCES.md. That creates a real,
 * named tension this file does not silently resolve: every range below is
 * a HOLD time at boiling (matching `boil.json`'s `durationSeconds` /
 * `applyAction`'s existing semantics — time spent AT temperature, not
 * total elapsed time from a cold pot), i.e. scoped to `startMethod:
 * "boiling_start"`, the same method `EGG_BOIL_DONENESS` uses — but that is
 * NOT the technique real sources actually recommend for potato. Using
 * `cold_start` for potato (arguably the MORE correct real-world choice
 * here, unlike egg) would need the exact same unbuilt mechanism
 * `egg-doneness.ts`'s own doc comment already names and declines to fake:
 * a cooking-rate function integrated over a temperature ramp, not a table
 * lookup. Flagged here rather than silently defaulted past.
 *
 * WHY THE THREE RANGES BELOW OVERLAP AT THE EDGES, UNLIKE
 * `EGG_BOIL_DONENESS`'s CLEANLY SEPARATED SOFT/MEDIUM/HARD TIERS — a real
 * domain difference, not a data-quality gap: egg's table pins ONE size
 * assumption ("large," ~50-60g) so soft/medium/hard vary by cook time
 * alone. Potato's three categories below (`whole`/`halved_or_quartered`/
 * `diced`) each still span a real range of ACTUAL sizes within the
 * category (a small quartered new potato vs. a large quartered russet), so
 * a big `diced` piece and a small `halved_or_quartered` piece can
 * genuinely take about the same time — the ranges are honestly reported as
 * overlapping rather than forced into false separation. Ordering holds for
 * the TYPICAL/MEDIAN case (whole > halved_or_quartered > diced), not for
 * every possible pair of extremes — see `tests/potato-doneness.test.ts`
 * for exactly what is and isn't asserted about ordering because of this.
 *
 * ASSUMPTIONS THIS TABLE MAKES, STATED EXPLICITLY (same discipline as
 * `EGG_BOIL_DONENESS`'s own assumptions block):
 * - `whole` assumes a 2-to-2.5-inch-diameter potato (America's Test
 *   Kitchen's own size-banded data, the most precise source found) — a
 *   smaller or larger whole potato needs real adjustment this table
 *   doesn't compute, the identical gap `egg-doneness.ts` names for egg
 *   size.
 * - Doneness target is "fork tender" throughout (a knife/fork/skewer
 *   meets no resistance) — the real, universally-cited verification
 *   criterion across every source checked, matching `boil.json`'s own
 *   `verification` field's spirit.
 * - `startMethod: "boiling_start"` (see the tension named above),
 *   Sea level (see `water.json`'s own altitude caveat — unaddressed here
 *   too, for the same reason `egg-doneness.ts` leaves it unaddressed).
 * - Potato variety/starch content is NOT accounted for — waxy (new/red)
 *   potatoes and starchy (russet) potatoes behave differently under heat;
 *   every source cited here blends both without controlling for it, so
 *   this table does too, named as a real, unaddressed simplification
 *   rather than silently assumed uniform.
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
    "America's Test Kitchen, \"Boiling Potatoes\" (americastestkitchen.com/how_tos/5964-boiling-potatoes) — size-banded whole-potato boiling times (2-2.5\" diameter: 15-18 min), and the cold-start-is-both-more-even-AND-faster finding cited in this file's own doc comment.",
  confidence: "commonly_cited_unverified",
  note: "A professional test-kitchen source, same tier of authority as egg-doneness.ts's López-Alt/Serious Eats citation, but not independently re-verified against a primary/peer-reviewed source this session.",
};

const CUT_PIECE_CITATION: Citation = {
  source:
    "Convergent across commonly-cited cooking guides for halved/quartered and diced/cubed potato boiling times (e.g. A Couple Cooks, \"How Long to Boil Potatoes for Potato Salad\" — large cubes/quarters 8-15min, diced/baby potatoes ~10min; Key to My Lime's independent ~15-20min quartered figure cross-checked against the same range).",
  confidence: "commonly_cited_unverified",
  note: "Blended across multiple convergent consumer cooking sources, not one single authoritative test-kitchen source the way the 'whole' entry is — reported as a wider range for that reason, not narrowed artificially.",
};

export const POTATO_BOIL_DONENESS: readonly PotatoBoilDoneness[] = [
  {
    pieceSize: "diced",
    durationSecondsRange: { min: 480, max: 720 },
    description: "~1-inch (2.5cm) dice — the fastest-cooking real preparation, used for potato salad and quick sides.",
    citation: CUT_PIECE_CITATION,
  },
  {
    pieceSize: "halved_or_quartered",
    durationSecondsRange: { min: 480, max: 1200 },
    description: "Halved or quartered — the common whole-but-reduced size for potato salad/roasting prep, real range depends heavily on the source potato's own size.",
    citation: CUT_PIECE_CITATION,
  },
  {
    pieceSize: "whole",
    durationSecondsRange: { min: 900, max: 1080 },
    description: "Whole, unpeeled, ~2-2.5 inches (5-6cm) diameter — the classic 'boil then peel' or potato-for-mash starting point.",
    citation: ATK_CITATION,
  },
];

/** Convenience lookup — throws rather than returning undefined, same
 *  contract as `egg-doneness.ts`'s `eggBoilDonenessRange`. */
export function potatoBoilDonenessRange(pieceSize: "whole" | "halved_or_quartered" | "diced"): { min: number; max: number } {
  const entry = POTATO_BOIL_DONENESS.find((e) => e.pieceSize === pieceSize);
  if (!entry) throw new Error(`No POTATO_BOIL_DONENESS entry for "${pieceSize}" — out of sync with boil.json's allowedValues`);
  return entry.durationSecondsRange;
}
