import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited taste-counterbalance data — how one taste perceptually
 * affects another (distinct from `SensoryPropertiesSchema.taste`, which
 * records what a taste IS per-ingredient). `TasteCategory` mirrors that
 * enum without importing it. `PerceptualTarget` adds "richness" (a
 * mouthfeel sensation, not a basic taste) as a real, named exception. See
 * `reference/flavor-balance.md` for design rationale, scope, and citations.
 */
export type TasteCategory = "salty" | "sweet" | "sour" | "bitter" | "umami" | "pungent" | "neutral";
export type PerceptualTarget = TasteCategory | "richness";

const TASTE_CATEGORY_VALUES = [
  "salty",
  "sweet",
  "sour",
  "bitter",
  "umami",
  "pungent",
  "neutral",
] as const;
const TasteCategorySchema = z.enum(TASTE_CATEGORY_VALUES);
const PerceptualTargetSchema = z.union([TasteCategorySchema, z.literal("richness")]);

export const FlavorCounterbalanceSchema = z.object({
  id: z.string().min(1),
  /** The taste/perceptual quality that gets perceptually REDUCED. */
  suppressed: PerceptualTargetSchema,
  /** The taste category responsible for reducing it. */
  by: TasteCategorySchema,
  /** "mutual" — both directions measurably suppress each other. "one_directional"
   *  — only `by` suppressing `suppressed` is evidenced. */
  direction: z.enum(["mutual", "one_directional"]),
  mechanism: z.string().min(1),
  /** A real, honest limit on the claim above, when one is known. See
   *  `reference/flavor-balance.md`. */
  realWorldCaveat: z.string().optional(),
  citation: CitationSchema,
});
export type FlavorCounterbalance = z.infer<typeof FlavorCounterbalanceSchema>;

const SWEET_SOUR_CITATION: Citation = {
  source:
    'Mao, Tian, Qin & Chen, "Sensory sweetness and sourness interactive response of sucrose-citric acid mixture based on synergy and antagonism," npj Science of Food 6:33 (2022), doi:10.1038/s41538-022-00148-0',
  confidence: "standard_reference",
  note: "Verified via direct lookup this session. A real, controlled psychophysics study, not a culinary-tradition claim. See reference/flavor-balance.md.",
};

const SALT_BITTER_CITATION: Citation = {
  source:
    'Breslin & Beauchamp, "Suppression of bitterness by sodium: variation among bitter taste stimuli," Chemical Senses 20(6):609-623 (1995), doi:10.1093/chemse/20.6.609',
  confidence: "standard_reference",
  note: "The classic, foundational study — verified via direct lookup this session. Deliberately NOT presented as a universal rule — see reference/flavor-balance.md and this entry's own realWorldCaveat.",
};

const ACID_RICHNESS_CITATION: Citation = {
  source:
    "Samin Nosrat, Salt Fat Acid Heat (Simon & Schuster, 2017) — the book's own central, repeatedly-cited thesis (also the single most-recommended resource in the triaged Reddit thread this file traces to)",
  confidence: "commonly_cited_unverified",
  note: "Weaker evidentiary tier than the two pairs above ON PURPOSE — a plausible sensory-science characterization not independently verified this session. See reference/flavor-balance.md.",
};

export const FLAVOR_COUNTERBALANCES: readonly FlavorCounterbalance[] = [
  {
    id: "sweet_sour_mutual",
    suppressed: "sour",
    by: "sweet",
    direction: "mutual",
    mechanism:
      "Sucrose and citric acid mutually raise each other's detection threshold and reduce each other's perceived intensity — adding sugar to an oversour dish measurably reduces perceived sourness, and adding acid to an oversweet one measurably reduces perceived sweetness.",
    citation: SWEET_SOUR_CITATION,
  },
  {
    id: "salt_suppresses_bitter",
    suppressed: "bitter",
    by: "salty",
    direction: "one_directional",
    mechanism:
      "Sodium ions suppress perceived bitterness, likely via inhibition at the taste receptor / oral cavity level (peripheral), for many — not all — bitter compounds.",
    realWorldCaveat:
      "Compound-dependent, not universal: the same foundational study found some bitter compounds suppressed by sodium salts over 70%, others barely affected at all. Effect size on bitter vegetables specifically correlates with how bitter that taster already found the plain vegetable, not a flat percentage for everyone.",
    citation: SALT_BITTER_CITATION,
  },
  {
    id: "acid_cuts_richness",
    suppressed: "richness",
    by: "sour",
    direction: "one_directional",
    mechanism:
      "Acid's tightening/'contraction' mouthfeel sensation perceptually counteracts fat's coating/smoothness sensation — the real mechanism behind acid 'cutting through' a rich dish, or 'brightening' a dull one.",
    citation: ACID_RICHNESS_CITATION,
  },
];

/** Every counterbalance pair a given taste/perceptual quality
 *  participates in, on EITHER side. Returns an empty array (not a throw)
 *  for a category with no modeled pair — a legitimate, honest answer. */
export function counterbalancesInvolving(taste: PerceptualTarget): readonly FlavorCounterbalance[] {
  return FLAVOR_COUNTERBALANCES.filter((c) => c.suppressed === taste || c.by === taste);
}

export const DILUTION_CITATION: Citation = {
  source:
    "The standard dilution / conservation-of-solute relation (general chemistry — the C₁V₁ = C₂V₂ mass-balance form, adding a zero-concentration diluent), not a culinary or food-science-specific claim",
  confidence: "standard_reference",
  note: "Encountered applied to cooking specifically in PAPER_NOTES_2608.04768.md's analysis of Song, Huang, Sun, Tian, Wang & Li, arXiv:2608.04768 (2026). Cited here against the underlying physics itself, not against that paper. See reference/flavor-balance.md.",
};

/**
 * Volume of neutral diluent needed to bring a solution from `currentConc`
 * down to `targetConc`, by conservation of solute. Concentration units
 * are caller-defined but must match between `currentConc`/`targetConc`.
 * Assumes a well-mixed, homogeneous LIQUID solution — does NOT apply to
 * a dry-seasoned solid. See `reference/flavor-balance.md`.
 */
export function dilutionVolumeToTarget(
  currentVolume: number,
  currentConc: number,
  targetConc: number
): number {
  if (currentVolume <= 0) {
    throw new Error(`currentVolume must be positive, got ${currentVolume}.`);
  }
  if (currentConc < 0) {
    throw new Error(`currentConc must be non-negative, got ${currentConc}.`);
  }
  if (targetConc <= 0) {
    throw new Error(
      `targetConc must be positive, got ${targetConc} — a target of zero or below would require infinite diluent, not a real dilution target.`
    );
  }
  if (currentConc <= targetConc) {
    // Already at or below target — a clean 0, not an error a caller must
    // special-case.
    return 0;
  }
  return currentVolume * (currentConc / targetConc - 1);
}

// DEPTH LIMIT: this file records three real, cited WHAT-counterbalances-
// WHAT facts. It does not, and could not honestly, tell a caller HOW MUCH
// of one taste is needed to counteract a given amount of another — the
// underlying psychophysics is threshold/sensitivity data, not a general
// dose-response formula. See reference/flavor-balance.md.
