# `src/potato-doneness.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

The potato half of "how long, depending on temperature and piece size" —
added 2026-08-14 as the direct sibling of `egg-doneness.ts` (this file
mirrors that one's structure and rigor deliberately, not coincidentally:
same "a robot needs a real number, not a vague label" motivation, same
`commonly_cited_unverified` confidence tier, same real-range-not-a-point
shape). Before this file, `boil.json`'s new `pieceSize` parameter (below)
had no attached meaning anywhere in this repo — informational only, same
starting point `yolkDoneness` had before `EGG_BOIL_DONENESS` existed.

### THE ONE REAL FINDING THAT MAKES THIS TABLE GENUINELY DIFFERENT FROM `EGG_BOIL_DONENESS`

Not just a copy with different numbers: for egg, `boiling_start` (egg
lowered into already-boiling water) is the common, assumed default
technique — see `boil.json`'s `startMethodNote`. For potato, multiple
independent sources (America's Test Kitchen; A Couple Cooks) explicitly
recommend the OPPOSITE as the objectively better technique, not just a
gentler alternative: potatoes started in COLD water and brought up to a
boil together cook more EVENLY (heat has time to penetrate the dense
flesh before the exterior overcooks) and America's Test Kitchen's own
testing found this also takes LESS total time than a boiling-water start,
not more — see REFERENCES.md. That creates a real, named tension this
file does not silently resolve: every range below is a HOLD time at
boiling (matching `boil.json`'s `durationSeconds` / `applyAction`'s
existing semantics — time spent AT temperature, not total elapsed time
from a cold pot), i.e. scoped to `startMethod: "boiling_start"`, the same
method `EGG_BOIL_DONENESS` uses — but that is NOT the technique real
sources actually recommend for potato. Using `cold_start` for potato
(arguably the MORE correct real-world choice here, unlike egg) would need
the exact same unbuilt mechanism `egg-doneness.ts`'s own doc comment
already names and declines to fake: a cooking-rate function integrated
over a temperature ramp, not a table lookup. Flagged here rather than
silently defaulted past.

### WHY THE THREE RANGES BELOW OVERLAP AT THE EDGES, UNLIKE `EGG_BOIL_DONENESS`'s CLEANLY SEPARATED TIERS

A real domain difference, not a data-quality gap: egg's table pins ONE
size assumption ("large," ~50-60g) so soft/medium/hard vary by cook time
alone. Potato's three categories below (`whole`/`halved_or_quartered`/
`diced`) each still span a real range of ACTUAL sizes within the category
(a small quartered new potato vs. a large quartered russet), so a big
`diced` piece and a small `halved_or_quartered` piece can genuinely take
about the same time — the ranges are honestly reported as overlapping
rather than forced into false separation. Ordering holds for the
TYPICAL/MEDIAN case (whole > halved_or_quartered > diced), not for every
possible pair of extremes — see `tests/potato-doneness.test.ts` for
exactly what is and isn't asserted about ordering because of this.

### ASSUMPTIONS THIS TABLE MAKES, STATED EXPLICITLY

Same discipline as `EGG_BOIL_DONENESS`'s own assumptions block:

- `whole` assumes a 2-to-2.5-inch-diameter potato (America's Test
  Kitchen's own size-banded data, the most precise source found) — a
  smaller or larger whole potato needs real adjustment this table doesn't
  compute, the identical gap `egg-doneness.ts` names for egg size.
- Doneness target is "fork tender" throughout (a knife/fork/skewer meets
  no resistance) — the real, universally-cited verification criterion
  across every source checked, matching `boil.json`'s own `verification`
  field's spirit.
- `startMethod: "boiling_start"` (see the tension named above), Sea level
  (see `water.json`'s own altitude caveat — unaddressed here too, for the
  same reason `egg-doneness.ts` leaves it unaddressed).
- Potato variety/starch content is NOT accounted for — waxy (new/red)
  potatoes and starchy (russet) potatoes behave differently under heat;
  every source cited here blends both without controlling for it, so this
  table does too, named as a real, unaddressed simplification rather than
  silently assumed uniform.

## `ATK_CITATION`

A professional test-kitchen source, same tier of authority as
`egg-doneness.ts`'s López-Alt/Serious Eats citation, but not independently
re-verified against a primary/peer-reviewed source this session.

## `CUT_PIECE_CITATION`

Blended across multiple convergent consumer cooking sources, not one
single authoritative test-kitchen source the way the 'whole' entry is —
reported as a wider range for that reason, not narrowed artificially.

## `POTATO_BOIL_DONENESS`

The `whole` entry's diameter figure lives on `potato.json`'s own
`physicalDimensions.typicalDiameterCm` now (added 2026-08-15) — same ATK
citation, no longer duplicated independently here.

## `potatoBoilDonenessRange`

Throws rather than returning undefined, same contract as
`egg-doneness.ts`'s `eggBoilDonenessRange`.
