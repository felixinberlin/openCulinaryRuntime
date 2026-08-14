import { z } from "zod";
import { CitationSchema, type Citation } from "./ingredient.ts";

/**
 * The concrete answer to "if I tell a robot I want my egg medium boiled, I
 * want it to understand it" — added 2026-08-13 directly in response to that
 * question. Before this file, `boil.json`'s `yolkDoneness` parameter
 * (soft/medium/hard) was a label with NO attached meaning anywhere in this
 * repo: informational only, explicitly documented as "doesn't drive
 * durationSeconds." That's still true here in one precise sense — this
 * file does not change `applyAction`/`engine.ts` at all (ROADMAP.md: "don't
 * worry about the engine yet") — but "medium boiled" now has a real, cited,
 * checkable number of seconds behind it for a human, a recipe author, or a
 * future intent-resolution layer to actually use, instead of nothing.
 *
 * This is deliberately NOT the engine automatically resolving "medium" into
 * a `durationSeconds` value — that's CONCEPT.md §14's LLM-intent-layer job
 * (see `fry.json`'s `internalTextureNote` for the same principle applied to
 * "omelette" vs. "tortilla francesa": OCR represents the distinction
 * precisely, it does not decide which one a customer meant). What THIS file
 * closes is the other half of that gap: an intent layer resolving "medium"
 * previously had nothing grounded to resolve it TO. Now it does.
 *
 * ASSUMPTIONS THIS TABLE MAKES, STATED EXPLICITLY (egg size and start
 * temperature both meaningfully shift real timing, and neither is tracked
 * on `egg.json` itself as a size FIELD — no entity-level concept, only a
 * per-call adjustment, see below):
 * - A "large" egg (~50-60g), the most common size these figures are given
 *   for in the source material below. `EGG_SIZE_ADJUSTMENT_SECONDS`/
 *   `eggBoilDonenessRangeForSize` (added 2026-08-14) now compute a real,
 *   cited offset for small/medium/extra_large instead of only ever
 *   assuming large — see that function's own doc comment.
 * - Starting from refrigerator-cold (~4°C), not room temperature.
 * - The BOILING-WATER-START method specifically: the egg goes into ALREADY
 *   boiling water, and the timer starts at that moment — matching
 *   `boil.json`'s own verification criterion ("water at or near 100°C
 *   maintained for at least durationSeconds"). This is `startMethod:
 *   "boiling_start"` on `boil.json`'s new parameter.
 * - Sea level (see `water.json`'s own altitude caveat — unaddressed here
 *   too, for the same reason).
 * - The egg is removed and shocked (`shock.json`) promptly at the end of
 *   `durationSeconds` — these figures assume carryover cooking is arrested,
 *   not left to keep cooking further (see `shock.json`'s
 *   carryoverCookingNote).
 *
 * COLD-START TIMING IS DELIBERATELY NOT INCLUDED HERE, NAMED AS A REAL GAP
 * RATHER THAN FAKED: for `startMethod: "cold_start"` (egg placed in COLD
 * water, heated together), total time is NOT simply
 * `estimatedPreheatSeconds` (heat-source.ts) plus one of the durations
 * below — the egg is already cooking gradually throughout the temperature
 * ramp, not just once boiling is reached, so the two numbers don't just
 * add. Modeling that properly needs integrating a cooking-rate function
 * over a temperature curve — real food-science territory this repo doesn't
 * attempt (matching `estimatedPreheatSeconds`'s own stated depth limit) —
 * flagged rather than silently offering a wrong number for that case.
 */
export const EggBoilDonenessSchema = z.object({
  yolkDoneness: z.enum(["soft", "medium", "hard"]),
  /** Real range, not a single number — even under these controlled
   *  assumptions, "medium" covers a genuine band of acceptable results, not
   *  one exact second count. */
  durationSecondsRange: z.object({ min: z.number().positive(), max: z.number().positive() }),
  description: z.string().min(1),
  citation: CitationSchema,
});
export type EggBoilDoneness = z.infer<typeof EggBoilDonenessSchema>;

const CITATION: Citation = {
  source:
    "Commonly cited large-egg, boiling-water-start timing guidelines convergent across cooking-science sources (e.g. J. Kenji López-Alt, Serious Eats \"The Food Lab\" egg-timing guide)",
  confidence: "commonly_cited_unverified",
  note:
    "Not verified against a primary source this session. soft's range (360-420s) was cross-checked for internal consistency, not independently derived: data/recipes/soft-boiled-egg.json already chose 390s for a 'soft'/jammy result before this table existed, and 390 falls inside this range rather than requiring reconciliation — a real check, not just an assertion, that the two were built from the same underlying common knowledge.",
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
    description: "Yolk mostly set but still creamy/fudgy at the center, not chalky — the common 'jammy-firm' middle ground.",
    citation: CITATION,
  },
  {
    yolkDoneness: "hard",
    durationSecondsRange: { min: 660, max: 780 },
    description: "Yolk fully set throughout, no liquid/creamy center — classic hard-boiled.",
    citation: CITATION,
  },
];

/** Convenience lookup — throws rather than returning undefined, since every
 *  value of `boil.json`'s `yolkDoneness` allowedValues has an entry here by
 *  construction; a miss would mean the two drifted out of sync. */
export function eggBoilDonenessRange(yolkDoneness: "soft" | "medium" | "hard"): { min: number; max: number } {
  const entry = EGG_BOIL_DONENESS.find((e) => e.yolkDoneness === yolkDoneness);
  if (!entry) throw new Error(`No EGG_BOIL_DONENESS entry for "${yolkDoneness}" — out of sync with boil.json's allowedValues`);
  return entry.durationSecondsRange;
}

/**
 * Closes the "large egg only" assumption this file's own doc comment named
 * from the start — added 2026-08-14 in response to an external scientific
 * review naming egg-size adjustment as a concrete, tractable gap. `EGG_BOIL_
 * DONENESS` above stays exactly as-is (still large-egg-based, still the
 * primary table) — this is a real, cited OFFSET applied on top of it, the
 * same "adjustment layered on a base table" shape `heat-source.ts`'s preheat
 * time is layered on top of `EGG_BOIL_DONENESS`'s hold time, not a second,
 * competing table.
 *
 * Real, convergent consumer cooking-guide figures (egg timing guides that
 * publish a size-adjustment chart), corroborating each other: roughly 30
 * seconds per size step relative to a large egg, larger eggs needing more
 * time — physically consistent with `thermal.ts`'s own "heat has to
 * penetrate to the center" reasoning, the same mechanism `thermalModel`'s
 * validity condition already leans on. Confidence: `commonly_cited_
 * unverified`, same tier as `EGG_BOIL_DONENESS` itself — this is the same
 * class of source (consumer cooking-science guides), not independently
 * upgraded.
 *
 * `extra_large`'s offset (+45s) is the midpoint of a commonly-cited 30-60s
 * range, not independently pinned to one exact source figure — stated
 * honestly as a rounded middle value, the same "round, plausible value
 * within a commonly-cited range" convention `oil.json`'s density/smoke-
 * point citations already use, rather than implying more precision than
 * the source material actually gives for that one size.
 */
export const EGG_SIZE_ADJUSTMENT_SECONDS: Readonly<Record<"small" | "medium" | "large" | "extra_large", number>> = {
  small: -60,
  medium: -30,
  large: 0, // the baseline EGG_BOIL_DONENESS itself already assumes
  extra_large: 45,
};

/** `eggBoilDonenessRange`, adjusted for a real egg size instead of only
 *  ever assuming "large". Composes the base range with the offset table
 *  above rather than a second, separately-cited table — the offset is
 *  applied to BOTH ends of the range, preserving the band's real width. */
export function eggBoilDonenessRangeForSize(
  yolkDoneness: "soft" | "medium" | "hard",
  size: "small" | "medium" | "large" | "extra_large"
): { min: number; max: number } {
  const base = eggBoilDonenessRange(yolkDoneness);
  const offset = EGG_SIZE_ADJUSTMENT_SECONDS[size];
  if (offset === undefined) {
    throw new Error(`No EGG_SIZE_ADJUSTMENT_SECONDS entry for "${size}" — out of sync with boil.json's eggSize allowedValues`);
  }
  return { min: base.min + offset, max: base.max + offset };
}
