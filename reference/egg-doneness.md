# `src/egg-doneness.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The concrete answer to "if I tell a robot I want my egg medium boiled, I
want it to understand it" — added 2026-08-13 directly in response to that
question. Before this file, `boil.json`'s `yolkDoneness` parameter
(soft/medium/hard) was a label with NO attached meaning anywhere in this
repo: informational only, explicitly documented as "doesn't drive
durationSeconds." That's still true here in one precise sense — this file
does not change `applyAction`/`engine.ts` at all (ROADMAP.md: "don't worry
about the engine yet") — but "medium boiled" now has a real, cited,
checkable number of seconds behind it for a human, a recipe author, or a
future intent-resolution layer to actually use, instead of nothing.

This is deliberately NOT the engine automatically resolving "medium" into
a `durationSeconds` value — that's CONCEPT.md §14's LLM-intent-layer job
(see `fry.json`'s `internalTextureNote` for the same principle applied to
"omelette" vs. "tortilla francesa": OCR represents the distinction
precisely, it does not decide which one a customer meant). What THIS file
closes is the other half of that gap: an intent layer resolving "medium"
previously had nothing grounded to resolve it TO. Now it does.

### ASSUMPTIONS THIS TABLE MAKES, STATED EXPLICITLY

Egg size and start temperature both meaningfully shift real timing, and
neither is tracked on `egg.json` itself as a size FIELD — no entity-level
concept, only a per-call adjustment, see `EGG_SIZE_ADJUSTMENT_SECONDS`
below:

- A "large" egg (~50-60g), the most common size these figures are given
  for in the source material below. `EGG_SIZE_ADJUSTMENT_SECONDS`/
  `eggBoilDonenessRangeForSize` (added 2026-08-14) now compute a real,
  cited offset for small/medium/extra_large instead of only ever assuming
  large — see that function's own notes below.
- Starting from refrigerator-cold (~4°C), not room temperature.
- The BOILING-WATER-START method specifically: the egg goes into ALREADY
  boiling water, and the timer starts at that moment — matching
  `boil.json`'s own verification criterion ("water at or near 100°C
  maintained for at least durationSeconds"). This is `startMethod:
  "boiling_start"` on `boil.json`'s new parameter.
- Sea level (see `water.json`'s own altitude caveat — unaddressed here
  too, for the same reason).
- The egg is removed and shocked (`shock.json`) promptly at the end of
  `durationSeconds` — these figures assume carryover cooking is arrested,
  not left to keep cooking further (see `shock.json`'s
  carryoverCookingNote).

### COLD-START TIMING IS DELIBERATELY NOT INCLUDED HERE, NAMED AS A REAL GAP RATHER THAN FAKED

For `startMethod: "cold_start"` (egg placed in COLD water, heated
together), total time is NOT simply `estimatedPreheatSeconds`
(heat-source.ts) plus one of the durations below — the egg is already
cooking gradually throughout the temperature ramp, not just once boiling
is reached, so the two numbers don't just add. Modeling that properly
needs integrating a cooking-rate function over a temperature curve — real
food-science territory this repo doesn't attempt (matching
`estimatedPreheatSeconds`'s own stated depth limit) — flagged rather than
silently offering a wrong number for that case.

## `EggBoilDonenessSchema`

- `durationSecondsRange`: Real range, not a single number — even under these controlled assumptions, "medium" covers a genuine band of acceptable results, not one exact second count.

## `CITATION`

Not verified against a primary source this session. soft's range
(360-420s) was cross-checked for internal consistency, not independently
derived: `data/recipes/soft-boiled-egg.json` already chose 390s for a
'soft'/jammy result before this table existed, and 390 falls inside this
range rather than requiring reconciliation — a real check, not just an
assertion, that the two were built from the same underlying common
knowledge.

## `eggBoilDonenessRange`

Throws rather than returning undefined, since every value of
`boil.json`'s `yolkDoneness` allowedValues has an entry here by
construction; a miss would mean the two drifted out of sync.

## `EGG_SIZE_ADJUSTMENT_SECONDS`

Closes the "large egg only" assumption named above from the start — added
2026-08-14 in response to an external scientific review naming egg-size
adjustment as a concrete, tractable gap. `EGG_BOIL_DONENESS` above stays
exactly as-is (still large-egg-based, still the primary table) — this is a
real, cited OFFSET applied on top of it, the same "adjustment layered on a
base table" shape `heat-source.ts`'s preheat time is layered on top of
`EGG_BOIL_DONENESS`'s hold time, not a second, competing table.

Real, convergent consumer cooking-guide figures (egg timing guides that
publish a size-adjustment chart), corroborating each other: roughly 30
seconds per size step relative to a large egg, larger eggs needing more
time — physically consistent with `thermal.ts`'s own "heat has to
penetrate to the center" reasoning, the same mechanism `thermalModel`'s
validity condition already leans on. Confidence: `commonly_cited_
unverified`, same tier as `EGG_BOIL_DONENESS` itself — this is the same
class of source (consumer cooking-science guides), not independently
upgraded.

`extra_large`'s offset (+45s) is the midpoint of a commonly-cited 30-60s
range, not independently pinned to one exact source figure — stated
honestly as a rounded middle value, the same "round, plausible value
within a commonly-cited range" convention `oil.json`'s density/smoke-point
citations already use, rather than implying more precision than the
source material actually gives for that one size.

## `EGG_SIZE_GRAMS`

Real gram values for `small`/`medium`/`large`/`extra_large` — added
2026-08-16 as input data for `egg-heat-penetration.ts`'s Williams-formula
spherical conduction model, which needs an actual MASS to compute against
(`EGG_SIZE_ADJUSTMENT_SECONDS` above only ever gave a seconds OFFSET, no
gram value at all).

A real reconciliation problem, named explicitly rather than glossed over:
the EU's official egg-grading regulation (Commission Regulation (EC) No
589/2008, Article 4) gives S <53g, M 53-63g, L 63-73g, XL >=73g — clean,
real, citable bands. But THIS file's own `EGG_BOIL_DONENESS` base table
already documents its own baseline assumption as "a 'large' egg
(~50-60g)" — which sits much closer to the US grading scheme's "large"
(56.7g minimum) than the EU's "large" band (63-73g). Picking the EU bands
literally would have silently made "large" mean two different masses in
the same file. Resolved for INTERNAL CONSISTENCY, not by re-deriving a new
external citation: `large` is anchored at 55g (the midpoint of this
file's own existing ~50-60g assumption), and the other three sizes are
spaced using the EU regulation's real relative band structure around that
anchor, rather than either grading scheme's absolute values. Confidence:
`commonly_cited_unverified` for the anchor choice itself (a
reconciliation, not a direct citation) even though the EU regulation it's
shaped by is `standard_reference` — see REFERENCES.md.

## `eggBoilDonenessRangeForSize`

`eggBoilDonenessRange`, adjusted for a real egg size instead of only ever
assuming "large". Composes the base range with the offset table above
rather than a second, separately-cited table — the offset is applied to
BOTH ends of the range, preserving the band's real width.
