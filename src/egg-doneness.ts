import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited seconds ranges behind `boil.json`'s `yolkDoneness` labels
 * (soft/medium/hard) — grounds "medium boiled" in an actual duration for
 * a human, recipe author, or future intent layer to use, without the
 * engine itself resolving the label (that stays CONCEPT.md §14's
 * intent-layer job). Assumes a large egg, boiling-water start, sea level,
 * refrigerator-cold start, prompt shocking. See `reference/egg-doneness.md`
 * for the full assumptions, scope, and citations.
 */
export const EggBoilDonenessSchema = z.object({
  yolkDoneness: z.enum(["soft", "medium", "hard"]),
  /** Real range, not a single number — "medium" covers a genuine band of
   *  acceptable results even under these controlled assumptions. */
  durationSecondsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type EggBoilDoneness = z.infer<typeof EggBoilDonenessSchema>;

const CITATION: Citation = {
  source:
    'Commonly cited large-egg, boiling-water-start timing guidelines convergent across cooking-science sources (e.g. J. Kenji López-Alt, Serious Eats "The Food Lab" egg-timing guide)',
  confidence: "commonly_cited_unverified",
  note: "Not verified against a primary source this session. See reference/egg-doneness.md for the soft-boiled-egg.json cross-check.",
};

export const EGG_BOIL_DONENESS: readonly EggBoilDoneness[] = [
  {
    yolkDoneness: "soft",
    durationSecondsRange: { min: 360, max: 420 },
    description: "Jammy to runny yolk, white fully set — the classic soft-boiled/mollet egg.",
    citation: CITATION,
  },
  {
    yolkDoneness: "medium",
    durationSecondsRange: { min: 480, max: 540 },
    description:
      "Yolk mostly set but still creamy/fudgy at the center, not chalky — the common 'jammy-firm' middle ground.",
    citation: CITATION,
  },
  {
    yolkDoneness: "hard",
    durationSecondsRange: { min: 660, max: 780 },
    description: "Yolk fully set throughout, no liquid/creamy center — classic hard-boiled.",
    citation: CITATION,
  },
];

/** Throws rather than returning undefined — every value of `boil.json`'s
 *  `yolkDoneness` allowedValues has an entry here by construction. */
export function eggBoilDonenessRange(yolkDoneness: "soft" | "medium" | "hard"): {
  min: number;
  max: number;
} {
  const entry = EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === yolkDoneness);
  if (!entry)
    throw new Error(
      `No EGG_BOIL_DONENESS entry for "${yolkDoneness}" — out of sync with boil.json's allowedValues`
    );
  return entry.durationSecondsRange;
}

/**
 * Real, cited seconds offset from the `EGG_BOIL_DONENESS` large-egg
 * baseline for other sizes — layered on top of the base table, not a
 * competing one. See `reference/egg-doneness.md` for the source figures
 * and the extra_large midpoint choice.
 */
export const EGG_SIZE_ADJUSTMENT_SECONDS: Readonly<
  Record<"small" | "medium" | "large" | "extra_large", number>
> = {
  small: -60,
  medium: -30,
  large: 0, // the baseline EGG_BOIL_DONENESS itself already assumes
  extra_large: 45,
};

/**
 * Real gram values for each egg size, input data for
 * `egg-heat-penetration.ts`'s spherical conduction model. `large` is
 * anchored at 55g to match this file's own EGG_BOIL_DONENESS baseline
 * assumption, with the other sizes spaced via the EU grading regulation's
 * relative band structure around that anchor. See `reference/egg-doneness.md`
 * for the full reconciliation with the EU/US grading schemes.
 */
export const EGG_SIZE_GRAMS: Readonly<
  Record<"small" | "medium" | "large" | "extra_large", number>
> = {
  small: 45,
  medium: 50,
  large: 55, // anchor — matches this file's own EGG_BOIL_DONENESS base-table assumption
  extra_large: 65,
};

/** `eggBoilDonenessRange`, adjusted for a real egg size instead of only
 *  ever assuming "large" — the offset is applied to both ends of the
 *  range, preserving the band's real width. */
export function eggBoilDonenessRangeForSize(
  yolkDoneness: "soft" | "medium" | "hard",
  size: "small" | "medium" | "large" | "extra_large"
): { min: number; max: number } {
  const base = eggBoilDonenessRange(yolkDoneness);
  const offset = EGG_SIZE_ADJUSTMENT_SECONDS[size];
  if (offset === undefined) {
    throw new Error(
      `No EGG_SIZE_ADJUSTMENT_SECONDS entry for "${size}" — out of sync with boil.json's eggSize allowedValues`
    );
  }
  return { min: base.min + offset, max: base.max + offset };
}
