import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * Real, cited taste-counterbalance data — closed 2026-08-15, triaged from a
 * user-supplied Reddit thread (r/Cooking, "Engineer brain struggling with
 * cooking," moved to `olddocs/reddit-thread-1mo4tj8.md` after triage; see
 * `ROADMAP.md`'s "Common culinary knowledge coverage" and `LEARNINGS_
 * PROCESS.md` 2026-08-15 for the full triage). The thread's single most-
 * repeated organizing idea across dozens of independent commenters was
 * Samin Nosrat's "Salt, Fat, Acid, Heat" framework; checking it against
 * this repo's actual state (not assumed) found Salt/Fat/Heat already real
 * and structural (`salt.json`, `oil.json`, `place.ts`/`heat-source.ts`) but
 * NOTHING about how tastes actually interact/counterbalance each other —
 * `SensoryPropertiesSchema.taste` (ingredient.ts) records what a taste IS
 * per-ingredient, never how one taste perceptually affects another. This
 * file is that missing piece, at the same informational-only depth as
 * every other categorical/technique parameter in this vocabulary — see
 * the file-level caveat at the bottom.
 *
 * `TasteCategory` deliberately mirrors `SensoryPropertiesSchema.taste`'s
 * enum exactly (not imported — same lightweight "local literal union, not
 * a shared schema" pattern `egg-doneness.ts`/`potato-doneness.ts` already
 * use for their own allowedValues unions) rather than importing it, so a
 * change to one doesn't silently drift the other without a visible diff.
 *
 * `PerceptualTarget` adds exactly one non-basic-taste value, `"richness"`
 * — a real, named exception, not scope creep: fat/richness is a MOUTHFEEL
 * sensation (a coating/smoothness perception), not one of the five basic
 * tastes salt/sweet/sour/bitter/umami are, the same reason `pungent` (this
 * repo's own prior addition, 2026-08-13) needed its own category rather
 * than being folded into `bitter` — a real, distinct sensory channel, not
 * a degree of an existing one. Deliberately NOT added to
 * `SensoryPropertiesSchema.taste` itself: that field classifies what an
 * INGREDIENT tastes like (a real per-ingredient fact), while "richness" as
 * used here is a PERCEPTION about a whole dish's fat content, a different
 * question this file's own narrower scope doesn't try to answer more
 * broadly than the one counterbalance pair below actually needs.
 */
export type TasteCategory = "salty" | "sweet" | "sour" | "bitter" | "umami" | "pungent" | "neutral";
export type PerceptualTarget = TasteCategory | "richness";

const TASTE_CATEGORY_VALUES = ["salty", "sweet", "sour", "bitter", "umami", "pungent", "neutral"] as const;
const TasteCategorySchema = z.enum(TASTE_CATEGORY_VALUES);
const PerceptualTargetSchema = z.union([TasteCategorySchema, z.literal("richness")]);

export const FlavorCounterbalanceSchema = z.object({
  id: z.string().min(1),
  /** The taste/perceptual quality that gets perceptually REDUCED. */
  suppressed: PerceptualTargetSchema,
  /** The taste category responsible for reducing it. */
  by: TasteCategorySchema,
  /** "mutual" — both directions measurably suppress each other (one entry
   *  covers both, not two redundant ones). "one_directional" — only `by`
   *  suppressing `suppressed` is actually evidenced; the reverse isn't
   *  claimed. */
  direction: z.enum(["mutual", "one_directional"]),
  mechanism: z.string().min(1),
  /** A real, honest limit on the claim above — e.g. "compound-dependent,
   *  not universal." Optional: not every pair has a known caveat, but
   *  where one exists it's recorded here rather than smoothed over,
   *  matching this repo's "named tension, not hidden" discipline
   *  (see potato-doneness.ts's cold-start-vs-egg tension for the same
   *  pattern applied elsewhere). */
  realWorldCaveat: z.string().optional(),
  citation: CitationSchema,
});
export type FlavorCounterbalance = z.infer<typeof FlavorCounterbalanceSchema>;

const SWEET_SOUR_CITATION: Citation = {
  source:
    "Mao, Tian, Qin & Chen, \"Sensory sweetness and sourness interactive response of sucrose-citric acid mixture based on synergy and antagonism,\" npj Science of Food 6:33 (2022), doi:10.1038/s41538-022-00148-0",
  confidence: "standard_reference",
  note:
    "Verified via direct lookup this session, not recalled: citric acid raised sucrose's absolute detection threshold and reduced sensitivity to sweetness changes; sucrose raised citric acid's absolute detection threshold while INCREASING sensitivity to sourness-strength changes (an asymmetric mechanism even though the net effect — mutual suppression of perceived intensity — is symmetric). A real, controlled psychophysics study, not a culinary-tradition claim.",
};

const SALT_BITTER_CITATION: Citation = {
  source:
    "Breslin & Beauchamp, \"Suppression of bitterness by sodium: variation among bitter taste stimuli,\" Chemical Senses 20(6):609-623 (1995), doi:10.1093/chemse/20.6.609",
  confidence: "standard_reference",
  note:
    "The classic, foundational study — verified via direct lookup this session. Deliberately NOT presented as a universal rule: the same paper found sodium salts suppress bitterness of some compounds by over 70% (e.g. urea) while barely affecting others (e.g. MgSO4) — see realWorldCaveat below. A 2013 follow-up (Keast lab, published in Chemosensory Perception) found the effect on bitter VEGETABLES specifically was strongest for tasters who perceived the plain vegetable as highly bitter to begin with, not a flat percentage reduction for everyone.",
};

const ACID_RICHNESS_CITATION: Citation = {
  source:
    "Samin Nosrat, Salt Fat Acid Heat (Simon & Schuster, 2017) — the book's own central, repeatedly-cited thesis (also the single most-recommended resource in the triaged Reddit thread this file traces to)",
  confidence: "commonly_cited_unverified",
  note:
    "Weaker evidentiary tier than the two pairs above ON PURPOSE, not an oversight: this is a real, widely-applied culinary technique (a squeeze of lemon on a rich dish; vinegar deglazing a pan's fond) with a plausible sensory-science characterization — acid's tightening/'contraction' mouthfeel sensation perceptually counteracting fat's coating/smoothness sensation — corroborated by general mouthfeel-science literature (e.g. Wolinska-Kennard et al., \"Mouthfeel of Food and Beverages: A Comprehensive Review of Physiology, Biochemistry, and Key Sensory Compounds,\" Comprehensive Reviews in Food Science and Food Safety, 2025) — but that review sat behind a paywall this session, so its exact text was NOT verified directly the way the two peer-reviewed primary studies above were. Named honestly as the weaker-tier claim rather than papered over with equal confidence.",
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

/**
 * Query helper — every counterbalance pair a given taste/perceptual quality
 * participates in, on EITHER side (useful both for "what does adding more
 * salty do" and "what can I add to fix an over-bitter dish"). Mirrors
 * `eggBoilDonenessRange`'s "throw on genuine misuse, don't return undefined"
 * shape only where relevant — here an empty result for a category with no
 * modeled pair (e.g. "umami") is a legitimate, honest answer, not an error,
 * so this returns an empty array rather than throwing.
 */
export function counterbalancesInvolving(taste: PerceptualTarget): readonly FlavorCounterbalance[] {
  return FLAVOR_COUNTERBALANCES.filter((c) => c.suppressed === taste || c.by === taste);
}

/**
 * DEPTH LIMIT, stated explicitly (same discipline as every other
 * informational-only module in this vocabulary — see engine.ts's own file
 * doc comment on categorical technique parameters): this file records
 * three real, cited, WHAT-counterbalances-WHAT facts. It does not, and
 * could not honestly, tell a caller HOW MUCH of one taste is needed to
 * counteract a given amount of another — the underlying psychophysics
 * (even in the two peer-reviewed studies cited above) is threshold/
 * sensitivity data over controlled sucrose-citric acid concentration
 * ranges, not a general dose-response formula transferable to arbitrary
 * dishes and arbitrary ingredients. Same "taste as the sensor, feedback
 * loop, not a fixed setpoint" boundary `CONCEPT.md`/`ENGINE_INVARIANTS.md`
 * already hold for every other subjective-adjustment case in this repo
 * (SALT's `timing` parameter, `egg_cooking`'s runny-yolk advisory, ...) —
 * this file gives real domain facts an intent layer or a human could use
 * to REASON about a "too bitter"/"too rich" complaint, not a formula that
 * computes the fix.
 */
