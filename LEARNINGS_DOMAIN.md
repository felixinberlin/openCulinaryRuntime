# LEARNINGS_DOMAIN.md

Part of `LEARNINGS.md`'s theme split. This file: **culinary/food-science
domain modeling** — HACCP thresholds, heat/thermal physics, doneness
tables, technique verbs, and the real citations/tradeoffs behind them.
Read `LEARNINGS.md`'s Core section first — the verification discipline
there applies to every citation below.

Pruned 2026-08-18 (was 1,534 lines) per `LEARNINGS.md`'s maintenance
discipline. Kept: real citations/numbers, genuine technique distinctions
with their concrete evidence, and schema-shape decisions driven by a
specific real-data forcing case. Dropped: narrative process repetition
now in Core, and design-rationale fully duplicated in the relevant
`src/*.ts`/`data/*.json` doc comment.

---

## 2026-08-12

- **`CriticalControlPointSchema` doesn't fit storage-duration hazards**
  (garlic-in-oil botulism is a refrigeration/acidification concern, not
  something a cooking step's heat controls) — correctly named as a
  mismatch (`infuse.json`'s `safetyNote`) rather than forced in.
- **An `advisoryOnly` CCP shortfall a human can read and accept (a runny
  yolk) has no one to make that call under autonomous execution — the
  safe default flips to reject, not stay permissive**, unless a human
  explicitly pre-authorized that specific CCP id in advance
  (`engine.ts`'s `SafetyPolicy`).
- **Every categorical "informational only" parameter accumulated so far**
  (`heatLevel`, `doneness`, `oilAdditionRate`, `curdSize`, `agitation`,
  `waterTempC`) **is a human-readable hint with no defined robot-actuator
  mapping** — `SafetyPolicy` only closes the HACCP-timing gap for
  autonomous execution, not the rest of the engine.

## 2026-08-13

- **Pre-salting draws moisture out via osmosis (drier surface, better
  browning when fried); post-salting is surface-only with zero effect on
  the cook** — closed with an informational `timing` parameter, not
  enforced (would need `FRY` to read a moisture/salting-history signal —
  real, separate, unbuilt gap).
- **`QuantitySchema` is a 3-way discriminated union
  (`precise`/`imprecise`/`relative`)** because "a pinch" and "2% of flour
  by weight" are different KINDS of quantity — forcing either into one
  `amount` field would misrepresent it. `imprecise` exists because cooks
  genuinely don't measure a pinch; `relative` exists for real quantities
  (baker's percentage) that are precise only relative to another
  ingredient.
- **A generic `isSeasoning` capability was fine with one entity (salt)
  asserting it and became a real bug the moment a sibling
  (`black_pepper`) was added** — `SALT` would have silently accepted
  pepper as satisfying "a salt-like ingredient is present." Caught by
  asking "does adding a sibling break the existing one" before writing
  the new entity, not after. Fixed by splitting into
  `isSaltySeasoning`/`isPepperySeasoning`/`isSpicySeasoning` alongside
  the still-useful generic flag.
- **`ActionOutputsSchema.addsTag` is applied independent of the target
  entity's `possibleTags`** — only byproduct/`combinesInto` tag
  INHERITANCE is filtered against `possibleTags`; the primary `addsTag`
  path never was. An entity could permit an addsTag-shaped action without
  ever declaring the resulting tag. Added as a permanent soft
  `validate.ts` NOTE (asymmetric with inheritance-filtering, so a hard
  fail would be wrong), proven to actually fire.
- **A new heat-provider knowledge domain needed its own top-level
  collection (`src/heat-source.ts` + `data/heat-sources/*.json`), not a
  field on `EntitySchema`** — attaching it to `EntitySchema` directly hit
  a real circular import (`HeatSourceProfileSchema` needs `CitationSchema`,
  defined in `ingredient.ts`). Hitting a circular import is sometimes a
  signal the new concept is a peer of an existing top-level collection
  (mirroring `thermal.ts`/`data/ccps/`), not a child field.
- **Which heat source you use changes how FAST water reaches boiling,
  never the TEMPERATURE it boils at** (~100°C at sea level regardless of
  flame). Modeling heat source as adjusting `BOIL`'s `durationSeconds`
  would have been physically wrong, not just imprecise — `heat-source.ts`'s
  parameter is deliberately informational-only.
- **`EGG_BOIL_DONENESS`'s "medium" range (480-540s) gives a previously
  meaningless label (`yolkDoneness`) a real, cited seconds range** — but
  `applyAction` still doesn't compute `durationSeconds` FROM
  `yolkDoneness` automatically, a deliberate line (resolving intent into
  parameters is the LLM-intent-layer's job, per `CONCEPT.md` §14, not this
  schema's). Cross-checked against `soft-boiled-egg.json`'s pre-existing
  390s choice (falls inside the new "soft" 360-420s range) as a real
  consistency check, now a permanent unit test.
- **Salting egg-boiling water is NOT an instance of `SALT`'s seasoning
  mechanism** — it's about faster coagulation sealing a shell crack, not
  flavor (the egg barely absorbs salt from ~10 minutes in water).
  Documented as a real, deliberately-not-built gap rather than forced
  into the wrong verb. Also explicitly did NOT repeat the commonly-claimed
  "salted water peels eggs easier" — checked separately and found weaker/
  disputed evidence than freshness/shocking's own established explanation.
- **`SIMMER` reuses `BOIL`'s `"boiled"` state on purpose** (different
  temperature band, 85-96°C vs. ~100°C, same real-world dish) — verified
  by actually running `PEEL` (requires egg's `statePrerequisites.peel:
  "boiled"`) against a SIMMER-produced egg, not just asserted as
  equivalent in prose. `PAR_FRY` does NOT reuse `FRY`'s `"fried"` — the
  opposite answer to the structurally identical question, because
  `par_fried` is pale/soft/unfinished, a result a competent cook would
  call wrong, not gently done. The discriminator, checkable each time: do
  real cooks call the two RESULTS the same dish?
- **`FRY` had no real `°C` parameter at all despite `BOIL`/`SIMMER`/
  `POACH` all having `waterTempC`** — surfaced while sourcing `PAR_FRY`'s
  `oilTempC` and noticing the inconsistency; fixed on `fry.json` itself,
  not just the new sibling.
- **"Getting the perfect egg shape" / basting / "transformations take
  time" split into three real, differently-sized gaps in one message**:
  freshness (small, real — `fresh`/`aged` tags, only settable at
  `initialInventory`, since this repo has no elapsed-time/`AGE` verb),
  basting as a distinct technique from `edgeStyle`'s existing crispy-lace
  (small, real, added), and "states can change mid-process" (the SAME
  structural "heat as a place" gap already named, folded in rather than
  duplicated). Splitting a dense message into separately-sized parts
  avoided both under- and over-building.
- **Grating is not a sixth `CUT` shape** — a box grater shreds by
  friction, a knife slices; folding `"grated"` into `cut.json` would have
  asserted a knife produces grated potato. Fixed with a dedicated `GRATE`
  verb + `grater.json`. General check: "does an existing TOOL actually
  perform this motion," not "which enum could this value slot into."
- **`statePrerequisites` widened to `string | string[]`** (one state OR a
  set) for the narrow, checked need "can more than one prior state
  satisfy the same prerequisite" — NOT the much bigger, riskier "should
  transitions be freely composable" question. A unit test asserts the OLD
  single-value error message still matches literally, not just a looser
  regex, so a subtle format change would be caught.

## 2026-08-14

- **`startMethod` (thermal shock) and `simmer.json`'s turbulence note
  already covered two of three real egg-crack mechanisms** — the one
  genuinely uncovered mechanism was mechanical impact at entry
  (`placementMethod`). Resisted turning this into a crack-probability
  simulation — a fabricated numeric "risk score" would look more rigorous
  than a closed enum while being less honest; nothing in this repo's
  citation trail supports assigning real numbers to it.
- **"Are you SURE any egg mix and any potato fry style works" was
  answered by testing the edges, not re-asserting the summary** — four
  direct checks (MASH exists? cut an unpeeled potato? grated shape?
  baked egg?) found four real, previously-uncited gaps in under a
  minute, cheaper than reasoning from what had already been built.

## 2026-08-15

- **`butter.json` and `sunflower_oil.json` needed zero `src/` changes** —
  further confirmation `requiredIngredientCapabilities`
  (capability-based) and `place.ts`'s smoke-point check
  (entity-property-based) were already the right generalization. Two
  fat entities, not a parameter on one, because "what changes with
  butter" is qualitative, not quantitative: real ~18% water content
  (unmodeled foaming, named not built), a LOWER smoke point (175°C) than
  either oil for a DIFFERENT physical reason (milk solids charring, not
  the fat itself) that correctly rejects at a real recipe's 191°C
  finishing-fry target.
- **A request for "cut geometry + oil temp + cook time → texture, measured
  and mathed" was checked against real food science before being built —
  no such unified formula exists** (this repo's own already-cited
  Kalogianni & Smith 2013: frying is nonlinear/coupled, crust thickness
  plateaus despite continued heat penetration). Presented the honest
  scope options rather than silently fabricating or silently scoping
  down; the user chose the geometry-only slice. Two real sources were
  checked directly rather than assumed: Wikipedia's own knife-cuts page
  gives NO numeric standard for "mincing"/"chopped" (both entries
  honestly flagged unsourced); two real tortilla recipes fetched directly
  converged independently on a 3-5mm slice range.
- **`heat-penetration.ts`'s real textbook answer (Fourier's second law,
  one-term slab approximation) computed suspiciously SMALL numbers
  (single digits to tens of seconds) against a real 180s fry time** — not
  a bug: pure conductive heat penetration through a few mm is genuinely
  fast; real total fry time is dominated by surface moisture evaporation
  and crust formation, which this model doesn't touch (the same
  Kalogianni & Smith finding). Named as the model's third honesty caveat
  (alongside Bi→∞ instant-surface-heating and no browning kinetics) —
  what needed fixing was the doc comment's honesty about what question it
  answers, not the physics.
- **Submerged (2-face) vs. shallow (1-face) oil heating composed with the
  SAME model via one new `effectiveHalfThicknessM` helper** (standard
  heat-transfer symmetry: one-face-heated-with-other-insulated ≡ half of
  a symmetric slab at double thickness) — produced a specific, derivable
  prediction (center takes ~4x as long, since the model's time formula
  scales with L²), confirmed by the capability-test script's real numbers
  landing at exactly 4.0x. The strongest kind of evidence this repo
  values: not "changed in the expected direction" but "changed by the
  exact ratio predicted."
- **Adding `oilTempC` to a recipe with an EMPTY `durationSeconds` would
  have been a real, consequential edit to recipe BEHAVIOR** (inventing a
  cook time the original author left open), not the same move as
  promoting an already-stated `heatLevel` to a number — left two of four
  under-covered recipes alone for exactly that reason, enriched the other
  two (which already had both fields) with zero behavior change.
- **Vinegar, not citrus, as the first ACID entity** — citrus would pull in
  unbuilt juicing/zesting sub-mechanics; vinegar is shelf-stable, used
  directly, and matches this repo's "one generic entity for the common
  case" convention. `flavor-balance.ts` deliberately invented exactly one
  new concept (`"richness"`) while resisting a speculative full taste-
  interaction matrix — three cited pairs (sweet/sour, salt/bitter, both
  real peer-reviewed DOI-bearing studies found by searching the
  MECHANISM, not the source thread's wording), not 7×7 combinations.
  Acid-cuts-richness — the most-repeated claim in the motivating source —
  turned out to be the WEAKEST-sourced of the three (real mechanism, but
  the strongest source found was paywalled) — logged at
  `commonly_cited_unverified`, not the higher tier, to match what was
  actually verified.

## 2026-08-16

- **Not every entity's failure states (`burned`/`overcooked`) close the
  same way, even with identical vocabulary.** Potato has a real rescue
  for `overcooked` (mash it — the same real technique `mashNote` already
  documents). Egg's `overcooked` has none. Garlic goes from toasted to
  burnt fastest of all four (small size, high sugar content — this
  repo's own `ROADMAP.md` had already named the "don't let it rest in hot
  oil" sequencing problem before `burned` existed as an assertable
  state). Tortilla mixture (finished dish) has no rescue for a different
  reason: it's not an intermediate ingredient with further options.
  Deliberately did NOT assert the specific mechanism behind either
  failure state (egg's iron-sulfide chemistry, garlic's exact Maillard
  kinetics) where citing it would need a lookup not done — the
  qualitative, commonly-known-result framing was judged sufficient rather
  than dressed up with an unverified specific mechanism.
- **`potato.json`'s `invalidTransitions` re-audit found TWO structurally
  different reasons a state can't revert to `"peeled"`**: cut-shape states
  (sliced/diced/...) — a GEOMETRIC fact, no whole piece left for PEEL to
  act on, true regardless of any named technique; `fried`/`baked` — a
  weaker "no real named technique found on active search" claim, the same
  weaker tier used elsewhere. Recorded both tiers explicitly rather than
  picking one confidence for the whole batch. `boiled` was deliberately
  left untouched — boiling is gentle/wet, the skin stays intact and
  separable (the real basis for boil-in-jacket-then-peel); frying/baking's
  dry heat measurably alters the skin in a way boiling doesn't, a real
  physical distinction, not just "already corrected once, leave it alone."
  Deliberately did NOT attempt shape-to-shape closures (`diced` forbidding
  `sliced`) — progressive cutting is a real technique, and asserting a
  closure here risked repeating the exact potato-peel mistake.
- **A web search for "garlic clove skin percentage" returned an
  authoritative-LOOKING ~24-25% that would have been a real error if used
  directly** — that figure is whole-BULB industrial processing yield,
  while `garlic.json` is modeled at single-CLOVE granularity. The actually
  correct figure (~1-3%, a single clove's skin against its peeled mass)
  came from a smaller, more weakly-sourced estimate — the more
  authoritative-LOOKING source was measuring the wrong THING, not
  measuring it more rigorously. **The identical trap recurred one search
  later for onion peel** (~37-38% industrial-processing figure, real
  home-kitchen hand-peeling figure ~7-10%) — worth actively distrusting
  "waste percentage" figures from the industrial byproduct-valorization
  literature family without checking their scope first, a pattern now
  confirmed twice, not a one-off.
- **A first draft of `caramelize.json` wrongly assumed caramelizing onions
  is always low-heat** — real technique genuinely splits: traditional
  (very low heat, ~45 min) vs. Kenji López-Alt's faster method (medium-
  high/high heat, periodically deglazed, ~15-20 min), both real, opposite
  heat levels for the same named dish. Caught by actually researching
  technique, not assuming "caramelization = gentle" from intuition.
  `CARAMELIZE` gets its own state (unlike garlic's still-unresolved FRY
  `doneness` parameter question) because real cooks name caramelized
  onion as a genuinely different, independently-named finished dish, not
  a gentler path to the same result the way SIMMER reaches BOIL's state.
- **Egg-white whisking is one-way in a direction no prior
  `invalidTransitions` entry had to consider: BACKWARD WITHIN the same
  progression** (stiff can't revert to firm, firm can't revert to soft),
  not just "can't revert to the start." Checked directly against real
  whisking sources (denatured protein aggregation is the same one-way
  event repeating at each stage), not assumed from the raw-only pattern.
  `over_whisked` forbidding `blended` too was a real, sourced choice
  (every source describes it as collapsed/grainy/watery with no rescue
  for ANY subsequent action), not just a convenience to make
  `isTerminalState` return true.
- **Building `WHISK` found `egg_white.json` already carried a
  `'pasteurized'` tag and a note explaining why raw whipped white needs
  it, but was never wired to `PASTEURIZE`/`isPasteurizable`** — its
  sibling `egg_yolk.json` had the real wiring; `egg_white.json` only had
  the tag and the intent. The same "field exists, note explains it,
  nothing reads/writes it" shape found before elsewhere.
- **"Stirred potato sticks when left alone, breaks when stirred too much"
  is TWO independent mechanisms with two different citation tiers, not
  one phenomenon** — sticking is textbook starch chemistry; breaking
  traces to a real but narrower peer-reviewed fact (Binner et al. 2000,
  cell-wall pectin solubilization) plus this repo's own inferential leap
  connecting it to agitation specifically. `broken` became a TAG, not a
  state, because a piece is still physically `fried` (or any state) AND
  broken at the same time — the same orthogonal-fact shape `washed`
  already established; state-vs-tag and authored-vs-derived are two
  separate axes, not one choice.

## 2026-08-17

- **The obvious move for POACH's vessel requirement (reuse
  `isFryingVessel`, since `poach.json`'s own metadata said "wide shallow
  pan") would have been wrong** — direct lookup found the classic
  single-egg vortex method actually wants a NARROWER, DEEPER vessel, the
  opposite shape `isFryingVessel` qualifies. A second real, independently
  cited technique (batch-poaching in a wide skillet) genuinely matches
  the original framing. Both a hasty "just swap to deep-vessel" AND the
  original "one standard vessel" claim would have each been half-wrong —
  reusing `isVessel` (the real union of all four vessels, already built
  for an unrelated reason) was correct precisely because it doesn't pick
  a side between two real techniques. A metadata note sitting unchallenged
  since an action was authored is not automatically still correct just
  because nothing contradicted it yet — this is the third time this
  exact lesson recurred, this time self-triggered by an unrelated
  generalization task, not a user's direct pushback.
- **A raw shell egg keeps 3-5 weeks refrigerated; the same egg,
  hard-boiled, keeps only ~1 week — a ~5x difference for the identical
  entity** — the concrete number pair that decided `storageLifeByState`
  should key by STATE, not be a flat entity-level field. Potato's
  `doNotRefrigerate` (quality: starch→sugar below ~42°F, worse frying)
  and garlic-in-oil's botulism risk (safety) are both real reasons to say
  "don't just refrigerate this," but different KINDS of true — kept as
  separate, explicitly-named concerns rather than one field covering
  both. Several primary government pages returned HTTP 403 to direct
  fetch this session — real, repeated, not a fluke; corroborated every
  figure via 2+ independent secondary sources instead and logged
  `commonly_cited_unverified` (the claim was verified, not the primary
  text).
- **`oven.json` had `possibleStates: ["off","preheating","hot"]` with
  ZERO actions ever transitioning it** — a "minimal tool entity, added so
  a reference resolves" is a recurring, under-scrutinized shape, now
  found three separate times (`pan.json`'s `hot`/`cold` in 2026-08-13,
  before the gap it evidenced was closed by `place.ts`; `knife.json`'s
  `clean`/`dirty`, later given a real mechanism by `tool-hygiene.ts`;
  this `oven.json` instance). Worth actively checking any new tool entity
  for orphaned `possibleStates` before assuming a stub is harmless. Named
  and cross-referenced, not reactivated here (nothing in this change
  needed real oven temperature/preheat-time). **ROAST vs. BAKE**: the
  concrete, checkable difference (not just near-synonym intuition) is
  real roasting universally uses fat, real baking (per this vocabulary's
  own `bake.json`) explicitly needs no medium —
  `requiredIngredientCapabilities: ["isFryingMedium"]` vs. `[]`, a real,
  provable rejection difference in both directions.
- **`ALKALINE_PARBOIL` needed a genuinely new capability
  (`isAlkalizingAgent`, deliberately NOT `isSeasoning`)** — reused the
  exact reasoning `egg.json`'s own (still-unbuilt-elsewhere)
  `crackContainmentNote` had already worked out for a different, still-
  unmodeled case (salt added to boiling water for crack containment, not
  flavor): a water additive used for a process-chemistry reason, not
  seasoning, doesn't fit `isSeasoning`. A "why not built this way" note
  written for one gap is worth checking when a later, differently-shaped
  gap turns out to have the identical structure.
- **STEAM got an unusually clean, MEASURED reason for its own state**
  (unlike every prior same-verb-vs-different-verb call in this repo,
  settled by "do cooks name these different dishes"): Lee et al. 2017,
  83.65% vitamin C retention steamed vs. 49.79% boiled — a real,
  quantified compositional difference, strictly better evidence than the
  qualitative test when available. The identical verb needed two
  genuinely different justifications for egg (easier peeling, same eaten
  result) vs. potato (measured composition difference) — collapsing them
  into one note would have overclaimed for one and underclaimed for the
  other. Caught a real dead end before shipping: STEAM's whole reason to
  exist for egg is easier peeling, so `statePrerequisites.peel`/`shock`
  had to widen in the SAME change, or the verb would have been pointless
  for its own stated purpose — checked by hand-tracing the use case, not
  by running the reachability tool (a cheaper, earlier check than
  building the demo that would eventually have caught it too).
- **GRILL's range was deliberately left overlapping ROAST's** (191-232°C
  vs. 204-232°C) — real convergent sources cite comparably high bands for
  both; the actual distinction is direct vs. enclosed heat delivery, not
  temperature. Inventing a temperature split to look cleaner would have
  fabricated an unsupported distinction. Proved the two tools are
  mechanically exclusive in BOTH rejection directions (GRILL rejects
  oven-only; ROAST also correctly rejects grill-only) — checking only one
  direction wouldn't rule out a copy-paste gap in the other.
- **MARINATE's distinction from ACID is provable by the ABSENCE of a
  parameter, not a different value of one** — ACID has no
  `durationSeconds` at all (an instantaneous tag-add), MARINATE has a
  real required-range one. Onion's real marinating timescale (~30 min)
  and egg's (3-10 days) differ by ~3 orders of magnitude — the honest
  response was ONE action with a wide declared range and an explanatory
  note, not two verbs or a narrowed range: the test that actually matters
  is "is the same physical mechanism producing both," not "how different
  are the numbers" (acid penetration at wildly different rates for
  structurally different foods is still one mechanism).
- **`mashed-potatoes.json`'s own metadata had said "dilutes the butter/
  milk added during mashing" since the day it was written — while the
  recipe contained no milk at all.** A real content gap can sit in plain
  sight inside this repo's own prose, already named, just not acted on.
  `isMashEnrichment` (shared by butter/milk) was deliberately NOT wired
  as a requirement on `mash.json` — mashing with nothing added is
  unusual but not physically impossible; making it mandatory would have
  been a culinary-preference constraint dressed as a physical-feasibility
  one.
- **Baking's anchor dish was chosen deliberately as UNLEAVENED flatbread
  (flour + water + salt), not the more ambitious leavened bread** — a
  genuine 3-ingredient leavened dough can't yet be expressed as one
  `RecipeScript` (COMBINE only merges two instances); unleavened
  flatbread is a real, complete, correct dish on its own (real roti/
  chapati/tortilla-de-harina technique), not a lesser proof. The
  individual leavened-path mechanisms (yeast activation via a flagged
  reuse of DISSOLVE — mechanically similar, but the real process is
  BIOLOGICAL activation, not physical solubility, named explicitly; and
  PROOF) were still built and independently proven the same day, not
  deferred alongside the recipe that would eventually chain them — the
  blocker is "can these three ingredients be one RecipeScript," not "does
  yeast/proofing work at all."

## 2026-08-18

- **A wide sweep for comment-only facts found the "room temperature"
  assumption (`20°C`) had NO citation at all anywhere, unlike almost
  everything else in this repo** — every other magic number checked
  already had at least a "checked via web search, date" note; this one
  was purely "stated assumption." Verified via a real search: USP defines
  room temperature as 20-25°C, FDA/USDA apply the same baseline for
  holding perishable food — `20` turned out to be the real, conservative
  (low) end of an actual standard range, not an arbitrary pick, but that
  was worth confirming rather than assuming after the fact.
- **The EU egg-grading regulation (63-73g for "large") and this repo's
  own internally-reconciled `EGG_SIZE_GRAMS.large` (55g) are DIFFERENT
  numbers for a real, already-documented reason (egg-doneness.ts's own
  doc comment)** — promoting the real regulatory band into a queryable
  `domainFacts` entry had to be additive, a separate fact sitting next to
  the working table, not a replacement for it. Silently overwriting the
  working anchor with the "more official-looking" regulatory number would
  have broken the internal consistency that anchor was deliberately built
  to preserve across this repo's own timing tables.
- **The USDA Danger Zone rule (roomTempHours) had been cited and scoped
  in `StorageLifeSchema` since 2026-08-17 with an explicit note that no
  entity had a real forcing case for it yet — a full session later, the
  forcing case had been sitting there the whole time (every entity with a
  real HACCP/perishability profile already in this repo: egg and its
  derivatives, milk), just never revisited.** Worth the general lesson: a
  "no forcing case yet" note is worth periodically re-checking against
  entities that already exist, not only waiting for a NEW entity to
  supply the case — the case can already be present and just
  unconnected.
