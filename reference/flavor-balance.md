# `src/flavor-balance.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Real, cited taste-counterbalance data — closed 2026-08-15, triaged from a
user-supplied Reddit thread (r/Cooking, "Engineer brain struggling with
cooking," moved to `olddocs/reddit-thread-1mo4tj8.md` after triage; see
`ROADMAP.md`'s "Common culinary knowledge coverage" and
`LEARNINGS_PROCESS.md` 2026-08-15 for the full triage). The thread's
single most-repeated organizing idea across dozens of independent
commenters was Samin Nosrat's "Salt, Fat, Acid, Heat" framework; checking
it against this repo's actual state (not assumed) found Salt/Fat/Heat
already real and structural (`salt.json`, `oil.json`,
`place.ts`/`heat-source.ts`) but NOTHING about how tastes actually
interact/counterbalance each other — `SensoryPropertiesSchema.taste`
(ingredient.ts) records what a taste IS per-ingredient, never how one
taste perceptually affects another. This file is that missing piece, at
the same informational-only depth as every other categorical/technique
parameter in this vocabulary — see the depth-limit note at the bottom.

`TasteCategory` deliberately mirrors `SensoryPropertiesSchema.taste`'s
enum exactly (not imported — same lightweight "local literal union, not a
shared schema" pattern `egg-doneness.ts`/`potato-doneness.ts` already use
for their own allowedValues unions) rather than importing it, so a change
to one doesn't silently drift the other without a visible diff.

`PerceptualTarget` adds exactly one non-basic-taste value, `"richness"` —
a real, named exception, not scope creep: fat/richness is a MOUTHFEEL
sensation (a coating/smoothness perception), not one of the five basic
tastes salt/sweet/sour/bitter/umami are, the same reason `pungent` (this
repo's own prior addition, 2026-08-13) needed its own category rather
than being folded into `bitter` — a real, distinct sensory channel, not a
degree of an existing one. Deliberately NOT added to
`SensoryPropertiesSchema.taste` itself: that field classifies what an
INGREDIENT tastes like (a real per-ingredient fact), while "richness" as
used here is a PERCEPTION about a whole dish's fat content, a different
question this file's own narrower scope doesn't try to answer more
broadly than the one counterbalance pair below actually needs.

## `FlavorCounterbalanceSchema`

- `suppressed`: The taste/perceptual quality that gets perceptually REDUCED.
- `by`: The taste category responsible for reducing it.
- `direction`: "mutual" — both directions measurably suppress each other (one entry covers both, not two redundant ones). "one_directional" — only `by` suppressing `suppressed` is actually evidenced; the reverse isn't claimed.
- `realWorldCaveat`: A real, honest limit on the claim above — e.g. "compound-dependent, not universal." Optional: not every pair has a known caveat, but where one exists it's recorded here rather than smoothed over, matching this repo's "named tension, not hidden" discipline (see potato-doneness.ts's cold-start-vs-egg tension for the same pattern applied elsewhere).

## `SWEET_SOUR_CITATION`

Verified via direct lookup this session, not recalled: citric acid raised
sucrose's absolute detection threshold and reduced sensitivity to
sweetness changes; sucrose raised citric acid's absolute detection
threshold while INCREASING sensitivity to sourness-strength changes (an
asymmetric mechanism even though the net effect — mutual suppression of
perceived intensity — is symmetric). A real, controlled psychophysics
study, not a culinary-tradition claim.

## `SALT_BITTER_CITATION`

The classic, foundational study — verified via direct lookup this
session. Deliberately NOT presented as a universal rule: the same paper
found sodium salts suppress bitterness of some compounds by over 70%
(e.g. urea) while barely affecting others (e.g. MgSO4) — see the
`realWorldCaveat` on `salt_suppresses_bitter` below. A 2013 follow-up
(Keast lab, published in Chemosensory Perception) found the effect on
bitter VEGETABLES specifically was strongest for tasters who perceived
the plain vegetable as highly bitter to begin with, not a flat percentage
reduction for everyone.

## `ACID_RICHNESS_CITATION`

Weaker evidentiary tier than the two pairs above ON PURPOSE, not an
oversight: this is a real, widely-applied culinary technique (a squeeze
of lemon on a rich dish; vinegar deglazing a pan's fond) with a plausible
sensory-science characterization — acid's tightening/'contraction'
mouthfeel sensation perceptually counteracting fat's coating/smoothness
sensation — corroborated by general mouthfeel-science literature (e.g.
Wolinska-Kennard et al., "Mouthfeel of Food and Beverages: A
Comprehensive Review of Physiology, Biochemistry, and Key Sensory
Compounds," Comprehensive Reviews in Food Science and Food Safety, 2025)
— but that review sat behind a paywall this session, so its exact text
was NOT verified directly the way the two peer-reviewed primary studies
above were. Named honestly as the weaker-tier claim rather than papered
over with equal confidence.

## `counterbalancesInvolving`

Query helper — every counterbalance pair a given taste/perceptual quality
participates in, on EITHER side (useful both for "what does adding more
salty do" and "what can I add to fix an over-bitter dish"). Mirrors
`eggBoilDonenessRange`'s "throw on genuine misuse, don't return undefined"
shape only where relevant — here an empty result for a category with no
modeled pair (e.g. "umami") is a legitimate, honest answer, not an error,
so this returns an empty array rather than throwing.

## `DILUTION_CITATION`

Encountered applied to cooking specifically in `PAPER_NOTES_2608.04768.md`'s
analysis of Song, Huang, Sun, Tian, Wang & Li, arXiv:2608.04768 (2026) —
their equation (7), for their supervisory process's over-seasoning
correction case. Cited here against the underlying physics itself
(textbook, uncontroversial), NOT against that paper — the paper is where
this repo found the CULINARY APPLICATION of a standard relation, not the
source of the relation. See REFERENCES.md.

## `dilutionVolumeToTarget`

Volume of neutral diluent needed to bring a solution from `currentConc`
down to `targetConc`, by conservation of solute (mass of dissolved solute
doesn't change when diluent — assumed zero-concentration — is added,
only the volume it's dissolved in does). `TICKET 3` of
`PAPER_NOTES_2608.04768.md` — see `DILUTION_CITATION` above for why the
physics is cited independently of that paper.

Concentration units are caller-defined but MUST match between
`currentConc`/`targetConc` (e.g. both g salt per L water, or both a
percentage) — this function has no notion of what the units mean, only
that they're consistent. `currentVolume`'s unit is whatever unit the
returned volume comes out in (liters in, liters of diluent needed out).

REAL, STATED LIMIT, same "informational depth, not a formula that solves
the whole problem" discipline this file's own depth-limit note below
already holds for `FLAVOR_COUNTERBALANCES`: this assumes a well-mixed,
homogeneous LIQUID solution — it does NOT apply to a dry-seasoned solid.
An over-salted fried potato is not recoverable this way (there is no
"volume" to dilute into; the salt is distributed unevenly across a solid
surface, not dissolved in a bulk liquid) — the same category distinction
`place.ts`'s own doc comment draws between a liquid MEDIUM and the solid
food within it, applied here to seasoning instead of heat.

The already-at-or-below-target early return: not an error — a caller
checking "does this need correcting at all" should get a clean 0, not
have to special-case this itself.

## DEPTH LIMIT (file-level closing note)

Stated explicitly (same discipline as every other informational-only
module in this vocabulary — see engine.ts's own file doc comment on
categorical technique parameters): this file records three real, cited,
WHAT-counterbalances-WHAT facts. It does not, and could not honestly,
tell a caller HOW MUCH of one taste is needed to counteract a given
amount of another — the underlying psychophysics (even in the two
peer-reviewed studies cited above) is threshold/sensitivity data over
controlled sucrose-citric acid concentration ranges, not a general
dose-response formula transferable to arbitrary dishes and arbitrary
ingredients. Same "taste as the sensor, feedback loop, not a fixed
setpoint" boundary `CONCEPT.md`/`ENGINE_INVARIANTS.md` already hold for
every other subjective-adjustment case in this repo (SALT's `timing`
parameter, `egg_cooking`'s runny-yolk advisory, ...) — this file gives
real domain facts an intent layer or a human could use to REASON about a
"too bitter"/"too rich" complaint, not a formula that computes the fix.
