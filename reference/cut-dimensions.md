# `src/cut-dimensions.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Real, cited numeric meaning for `cut.json`'s `shape` parameter — added
2026-08-15, the third instance of a now-established playbook
(`egg-doneness.ts`'s `EGG_BOIL_DONENESS`, `potato-doneness.ts`'s
`POTATO_BOIL_DONENESS`): an existing categorical action parameter gets a
real, cited numeric range via a standalone reference-data module, with
ZERO changes to the action's own schema or to `engine.ts`. Before this
file, "sliced"/"diced"/"julienne"/etc. were labels with no attached size
anywhere in this repo — every size hint that existed (`potato.json`'s
`fryingScienceNote`, `par-fry.json`'s `thicknessNote`,
`potato-doneness.ts`'s own `description` strings) was unenforced prose.

DIRECTLY SCOPED, NOT THE WHOLE "cut geometry, oil temp, and time change
texture" QUESTION THAT MOTIVATED THIS: real food science does not reduce
that question to one formula — this repo's own already-cited Kalogianni &
Smith (2013) paper (REFERENCES.md, `data/actions/fry.json`/
`par-fry.json`) found frying is a nonlinear, coupled process (crust
thickness plateaus, water loss and oil uptake are NOT simply linked).
This file answers only the first, honestly-buildable half: what does
"sliced" actually MEAN in millimeters. It does NOT compute or predict
frying time, heat penetration, or texture from these numbers — that would
need real heat-transfer physics (a genuinely different, larger,
deliberately deferred piece of work — see `data/actions/fry.json`'s
`oilTempCNote`, which already names "a real fryer would adjust duration
for the target's actual size/shape, and this doesn't" as an open gap).
(Since partially closed by `heat-penetration.ts`/`recipe-explain.ts`'s
fry-timing-vs-geometry check, which composes with this file.)

A REAL TENSION NAMED, NOT SILENTLY RESOLVED: `potato-doneness.ts`'s own
`diced` entry describes "~1-inch (2.5cm) dice" (a potato-salad/boiling-
oriented cut) — genuinely LARGER than this file's `diced` entry below
(professional "small-to-medium dice," ~6-13mm, a sauté/fry-oriented cut).
Both are real; `cut.json`'s single `diced` enum value doesn't distinguish
which one a given recipe means, and this file does not invent a
resolution — it's named here so the discrepancy is visible rather than
silently picking one number and implying it covers both.

`sliced` is scoped to the specific case that actually motivated this — a
thin, round potato slice for frying (tortilla de patatas) — not a
universal "sliced" standard, because none exists: unlike dice/julienne,
professional knife-cut taxonomy doesn't define one fixed thickness for
"sliced" in general (real recipes always further qualify it, e.g. "1/4
inch rounds").

`halved`/`quartered` are NOT independently sourced — they're a fraction
of `potato.json`'s own `physicalDimensions.typicalDiameterCm` (added the
same day), computed here rather than cited separately, since
halving/quartering a potato is arithmetic on the potato's own real size,
not a separate knife-cut standard.

`chopped`/`minced` have NO authoritative numeric standard — Wikipedia's
"List of culinary knife cuts" (the source for julienne/dice below,
checked directly 2026-08-15) explicitly defines "mincing" only as "very
finely divided into uniform pieces," no measurement, and has no entry for
"chopped" at all. The ranges given for these two are honest best-effort
approximations from general culinary usage, not a cited standard —
flagged with a distinctly worded citation note rather than presented with
the same confidence as the sourced entries.

## `CutShapeDimensionSchema`

- `dimensionMm`: The characteristic dimension for this shape — thickness for a slice, edge length for a dice/julienne cross-section, in millimeters. Not every real dimension of the cut (e.g. julienne's 3-5cm LENGTH isn't captured) — just the one that matters most for how fast heat can reach the center, the dimension a future physics pass would need.

## `KNIFE_CUT_STANDARD_CITATION`

Checked via direct lookup 2026-08-15. mm values below are this repo's own
precise conversion from the cited inch fractions (1/4in = 6.35mm, not a
rounded 5-6mm approximation), not independently re-measured or
re-derived from a primary culinary-school textbook.

## `TORTILLA_SLICE_CITATION`

Two independent consumer recipe sources, both directly quoted this
session, converging on a 3-5mm range for this specific dish's slicing
technique — not a universal 'sliced' standard (see the file-level notes
above for why none exists).

## `LOOSE_TERM_CITATION_NOTE`

No authoritative numeric standard exists for this term (Wikipedia's "List
of culinary knife cuts" gives no measurement for it — checked directly
2026-08-15). This range is an honest best-effort approximation from
general culinary usage, not a sourced figure — reported with the same
schema shape as the sourced entries for consistency, not the same
confidence.

## `cutShapeDimensionMm`

Throws rather than returning undefined, same contract as
`eggBoilDonenessRange`/`potatoBoilDonenessRange`. Covers only
`sliced`/`diced`/`julienne`/`chopped`/`minced` — `halved`/`quartered` are
handled by `halvedOrQuarteredDimensionMm` below, since they're derived
from `potato.json`'s own size rather than an independently cited
knife-cut standard.

## `halvedOrQuarteredDimensionMm`

`halved`/`quartered` sizes are arithmetic on an entity's own
`physicalDimensions.typicalDiameterCm` (e.g. `potato.json`), not an
independently cited knife-cut standard — halving/quartering a potato
doesn't have a "standard" size the way a dice or julienne does, it's
simply a fraction of whatever potato you started with. Returns the
resulting piece's largest dimension in mm, same unit as
`cutShapeDimensionMm` for consistency.
