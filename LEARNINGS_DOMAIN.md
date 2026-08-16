# LEARNINGS_DOMAIN.md

Part of `LEARNINGS.md`'s theme split (2026-08-15 — see that file for the
index and why). This file: **culinary/food-science domain modeling** — HACCP
thresholds, heat/thermal physics, doneness tables, technique verbs (SIMMER,
PAR_FRY, cut geometry, ...), and the real citations/tradeoffs behind them.
Not: engine/schema architecture (`LEARNINGS_ENGINE.md`), CLI/authoring
tooling (`LEARNINGS_TOOLING.md`), or verification-discipline/external-input
lessons (`LEARNINGS_PROCESS.md`).

Same rules as before the split: dated, append-only, concrete lessons only —
not a changelog of *what* changed (that's `git log`), *why* a design choice
was made. Don't rewrite or delete old entries — append.

---

## 2026-08-12

### HACCP / safety modeling

- **`CriticalControlPointSchema` is shaped for cook-time temperature/hold-time
  thresholds. It does NOT fit storage-duration hazards** (garlic-in-oil
  botulism is a post-preparation refrigeration/acidification concern, not
  something any cooking step's heat controls). Forcing a hazard into a schema
  built for a different-shaped problem would misrepresent it — correctly
  identifying "this doesn't fit, here's why" is itself the rigorous move, not a
  gap to paper over. See `infuse.json`'s `safetyNote`.
- **The CCP existence check must be gated on the triggering parameter
  (`durationSeconds`) actually being supplied — not merely on the target
  entity having a `criticalControlPointsByAction` entry.** First draft threw
  `"references unknown CriticalControlPoint"` on *every* egg fry/poach that
  didn't pass a duration, because the check ran unconditionally once the entity
  declared a CCP for that action. Caught by full regression, not by review.
- **"Same API" (CONCEPT.md §17: a robot drives the same event timeline a human
  would) does not mean "same default judgment call."** An `advisoryOnly` CCP
  shortfall that a human can read and accept for themselves (a runny yolk) has
  no one to make that call under autonomous execution — the safe default has to
  flip to reject, not stay permissive, unless a human explicitly pre-authorized
  that specific CCP id in advance. This is `engine.ts`'s `SafetyPolicy` and
  `ENGINE_INVARIANTS.md` #11.
- **Every categorical "informational only" parameter accumulated so far**
  (`heatLevel`, `doneness`, `oilAdditionRate`, `curdSize`, `agitation`,
  `waterTempC`) **is a human-readable technique hint with no defined mapping to
  an actual robot actuator command.** `SafetyPolicy` only closes the HACCP-timing
  gap for autonomous execution — it does not make the rest of the engine
  robot-ready. Saying this explicitly beats letting "autonomous mode exists
  now" imply more capability than exists.


## 2026-08-13

### Salting timing + quantity (asked about the same day, closed same session)

- **`SALT` had no notion of WHEN relative to cooking it happens, and that's
  not a cosmetic gap — pre-salting draws moisture out via osmosis (drier
  surface, better browning/crisping when fried) while post-salting is
  surface-only seasoning with zero effect on the cook.** Closed with an
  informational `timing` parameter (`before_cooking`/`during_cooking`/
  `after_cooking`) on `salt.json`, same non-enforced pattern as `fry.json`'s
  `heatLevel`/`doneness` — still doesn't feed back into `FRY`'s actual
  outcome (that would need `FRY` to read a moisture/salting-history signal,
  flagged as a real, separate, unbuilt gap in `salt.json`'s
  `timingNote`). Retrofitted onto all 9 existing recipes that call `salt`
  after an upstream cook step exists, using the recipe's actual step order
  to decide the value (not guessed) — the 2 alioli recipes were correctly
  left without a `timing` value, since garlic is never cooked in either
  dish and the parameter wouldn't mean anything there.
- **A from-scratch batch-edit of several recipe JSON files via
  `json.dump()` silently reformats the WHOLE file** (compact single-line
  array entries become multi-line, unrelated whitespace changes throughout)
  **even when only one field actually changed** — caught immediately by
  `git diff` showing a wall of noise for a one-key edit, not by anticipating
  it. Reverted and redid the same 9 edits as literal string replacements
  (`Edit`/targeted `str.replace`) that touch only the line that changed.
  General lesson: never round-trip a hand-formatted JSON file through a
  generic serializer for a small edit — diff what you're about to write
  before trusting it, or edit the text directly.
- **Quantity ("how much is a pinch, compared to what?") was not a small
  follow-up question — it's `ROADMAP.md` Phase 1's known-unbuilt
  `RecipeIngredientSchema`, and it's the thing the OTHER two questions
  asked the same session (crystal size, generalizing SALT to
  pepper/chili) actually sit on top of, not a peer of either.** Confirmed
  by grep before building anything: zero quantity representation existed
  anywhere (`RecipeInstanceSchema` had `id`/`entityId`/`state`/`tags`, no
  amount field at all) — `salt-1` was "a salt instance that exists," not
  "3g of salt." Worth recognizing explicitly when several small-sounding
  questions arrive in a burst: check whether they're actually independent,
  or whether one is foundational and the others are downstream of it — build
  in dependency order, not arrival order.
- **"A pinch" and "2% of flour by weight" are not the same KIND of
  quantity, and collapsing them into one `amount` field would misrepresent
  whichever one doesn't fit** — this is why `QuantitySchema` is a
  3-way discriminated union (`precise`/`imprecise`/`relative`), not a
  single number+unit. `imprecise` exists because cooks genuinely do not
  measure a pinch (forcing a fake gram value would itself violate this
  repo's own "don't imply more precision than was verified" standard,
  already established for `CitationSchema`); `relative` exists because
  some real quantities (professional bread salt, dosed as a baker's
  percentage of flour mass) genuinely ARE precise but answer "how much"
  only in terms of another ingredient, not an absolute number — directly
  answers "a pinch, compared to what?" for the cases where the honest
  answer is "it doesn't compare to anything, it's just vague" vs. the
  cases where the honest answer is "precisely 2% of the flour."
- **A pinch's real-world gram equivalent depends on the SAME crystal-size
  axis raised as a separate question in the same conversation (coarse vs.
  fine salt) — the two gaps aren't independent, one is a concrete instance
  of the other.** Recorded directly in `QuantitySchema`'s `"imprecise"`
  branch doc comment rather than treated as unrelated, so the connection
  isn't lost between the two LEARNINGS entries. Crystal size itself (fine
  table salt vs. coarse sea salt vs. kosher as separate entities, or a
  property on one) remains genuinely unbuilt — deliberately deferred
  rather than guessed at, same reasoning as `garlic-oil-potatoes.json`'s
  salad gap: name it precisely, don't build it speculatively until a real
  dish needs to distinguish them.
- **Generalizing `SALT` into a parameter-driven `SEASON` verb (so pepper/
  chili don't need copy-pasted actions) was deliberately NOT built this
  session, on the user's own call, in favor of building quantity first.**
  Real blocker if it had been attempted: `ActionOutputsSchema.addsTag` is a
  fixed string today, with no `addsTagFromParameter` counterpart to
  `transformedStateFromParameter` — and `requiredIngredientCapabilities`
  only checks presence, never identifies WHICH specific instance among
  several satisfied the capability, so there'd be no way to know which
  literal tag to add even with that engine feature. Both real, both still
  open — next real dish that needs a second seasoning (not just salt)
  should be what drives building this, per this repo's established working
  method, not built ahead of that need.
- **Told directly to build PEPPER/CHILI without the SEASON generalization
  (engine work explicitly paused) — duplicating SALT's shape found a real
  correctness bug BEFORE it shipped, not after.** `requiredIngredientCapabilities:
  ["isSeasoning"]` on `salt.json`'s action was fine when salt was the only
  entity declaring `isSeasoning: true` — the moment `black_pepper`/
  `chili_flakes` were added with the same generic flag, `SALT` would have
  silently accepted pepper as satisfying "a salt-like ingredient is
  present." Caught by asking "does adding a sibling break the existing
  one" before writing the new entities, not by testing after — fixed by
  splitting the generic `isSeasoning` (kept, genuinely useful as "is this
  A seasoning at all") from three specific capabilities
  (`isSaltySeasoning`/`isPepperySeasoning`/`isSpicySeasoning`) that each
  verb's `requiredIngredientCapabilities` actually checks. Proven, not just
  reasoned about: `scripts/season-potato-three-ways.ts`'s last check
  deliberately tries to SALT a potato with only `black_pepper` on hand and
  asserts it's rejected.
- **`ActionOutputsSchema.addsTag` is applied by `applyAction` completely
  independent of the target entity's `possibleTags`** — only byproduct/
  `combinesInto` tag INHERITANCE is filtered against `possibleTags`
  (`engine.ts`), the primary `addsTag` path never was. This means an entity
  could `allowedTransformations`-permit an addsTag-shaped action without
  ever listing the resulting tag in its own `possibleTags`, and nothing
  would catch it — not a hypothetical, found while manually wiring
  "peppered"/"chili_seasoned" onto potato/egg/egg_cracked and realizing
  there was no check forcing that step to be remembered. Added as a
  permanent `scripts/validate.ts` NOTE (not a hard fail — the asymmetry
  with inheritance-filtering is real, so a false-positive-safe soft check
  is the honest one) rather than trusting it to be done right by hand
  again next time. Proven to fire by deliberately dropping "peppered" from
  potato.json's possibleTags and confirming the NOTE appeared, then
  reverting — same discipline as every other check in this repo.
- **Extending a closed enum (`CRUSH`'s `fineness`: `coarse`/`fine_paste` →
  + `cracked`/`ground`) to fit a second, differently-shaped use case (whole
  peppercorns, which never become a paste) is backward-compatible by
  construction — worth reaching for before assuming a new parameter or new
  verb is needed.** Same reasoning `CUT`'s single `shape` enum already
  generalizes across every choppable entity, applied here for the first
  time to a SECOND action (`CRUSH`) instead of just cited as precedent.
- **A gap flagged honestly in a doc comment, then left alone, is worth
  actually revisiting once the vocabulary grows into it — not just citing
  as "still true."** `garlic.json`'s `flavorChemistryNote` flagged
  `SensoryPropertiesSchema.taste`'s missing "pungent" category back on
  2026-08-12 (allicin's sharpness isn't one of the five basic tastes,
  'umami' was the closest available value, not the correct one) but wasn't
  fixed then — closed now, adding black pepper (piperine) and chili
  (capsaicin) made it load-bearing for THREE entities' sensory accuracy at
  once instead of one, not just garlic's.
- **User-directed scope change ("don't worry about the engine yet, get
  common knowledge into schemas") is a real instruction to prioritize
  breadth-of-coverage work over the engine-consumption work flagged as
  open in the previous entries — not a request to build speculatively
  everywhere.** Handled by: (1) still choosing the concretely-teed-up next
  step (seasoning generalization) rather than picking an arbitrary new
  domain, (2) auditing what's ACTUALLY unrepresented (allergens, cross-
  contamination, staple-ingredient breadth, more verbs) and writing it down
  as a prioritized, honestly-scoped list (`ROADMAP.md`'s new "Common
  culinary knowledge coverage" section) rather than either silently picking
  one to build next unprompted or claiming "all common knowledge" was
  actually achieved in one session — "all" is not a completable claim to
  make honestly here, a checkable list is.

### Heat sources (gas/vitro/wood) + egg-boiling doneness timing

- **A new, real-world domain (heat providers) needed its own top-level
  knowledge collection, not a field bolted onto `EntitySchema`, and
  `CriticalControlPointSchema`/`data/ccps/` was the right precedent to
  copy, not `EntitySchema.thermophysical`.** Tried to attach heat-source
  facts to `EntitySchema` first and hit a real circular-import problem
  immediately: a `HeatSourceProfileSchema` needs `CitationSchema` (defined
  in `ingredient.ts`), but making `EntitySchema` reference
  `HeatSourceProfileSchema` back would require `ingredient.ts` to import
  from the new file too — a genuine cycle, not a style preference. Solved
  by recognizing this is structurally the SAME problem `thermal.ts`/
  `data/ccps/` already solved for CCPs (a fact that doesn't belong to one
  entity, referenced BY id from wherever needed): `src/heat-source.ts` +
  `data/heat-sources/*.json` + `registry.ts`'s `loadHeatSources`, one-way
  import from `heat-source.ts` to `ingredient.ts` only. Worth recognizing
  generally: hitting a circular import is sometimes a signal the new
  concept is a peer of an existing top-level collection, not a child field
  of an existing entity — check for a same-shaped precedent already in the
  repo before restructuring imports to force the field-on-entity shape.
- **The single most important fact to get right here, stated explicitly
  because it's a real, common misconception: which heat source you use
  changes how FAST water reaches boiling, never the TEMPERATURE it boils
  at.** Water is ~100°C at sea level whether it's a bare simmer or a
  roaring boil — pressure/altitude is the only thing that moves that
  number (`water.json`'s existing citation). Modeling heat source as
  adjusting `BOIL`'s required `durationSeconds` (time spent AT
  temperature — what actually cooks the egg) would have been physically
  wrong, not just imprecise; `heat-source.ts`'s new `heatSource` parameter
  on `boil.json` is deliberately informational-only, same non-enforcement
  pattern as `heatLevel` elsewhere, specifically so it can't accidentally
  end up feeding into that number.
- **Asked directly not to overstate precision here, and the honest answer
  required two separate corrections to what had just been built, not one.**
  (1) `estimatedPreheatSeconds` uses one constant average power/efficiency
  value across the whole heating interval — real delivered heat is a
  continuously time-varying curve (most obviously for wood fire, but
  genuinely true for gas/vitro's own startup ramp too); this is now stated
  explicitly as a first-order energy-balance estimate, not a curve
  simulation, matching `thermal.ts`'s own "validity condition" discipline
  for its D/z-value model. (2) A skilled cook's real fine control over
  delivered heat is NOT fully captured by the source's own dial/damper —
  physically moving the pan (off flame, to a fire's cooler edge, lifting
  it) is a real, separate control technique, most load-bearing on wood
  fire specifically because the fire itself often can't be finely dialed
  at all. Added `manualPositioningRelevance` (low/moderate/high per source)
  to name this honestly rather than let `controlPrecision` alone imply it
  was already covered. General lesson: when told "I don't want to go that
  deep, but be scientifically accurate," the right response is not
  refusing to note the limitation — it's stating the limitation precisely
  enough that a reader knows exactly what's NOT modeled, at whatever depth
  the model itself stays.
- **"If I tell a robot I want my egg medium boiled, I want it to
  understand it" pointed at a real, load-bearing, previously-silent gap:
  `boil.json`'s `yolkDoneness` (soft/medium/hard) was a label with ZERO
  attached meaning anywhere in this repo** — informational-only, by design,
  same as `heatLevel`/`doneness` elsewhere, but for THIS parameter that
  meant "medium" resolved to literally nothing a robot (or a human) could
  act on. Closed at the reference-data layer, not the engine layer, on
  purpose: `src/egg-doneness.ts`'s `EGG_BOIL_DONENESS` gives "medium" a
  real, cited seconds range (480-540s) instead of nothing — but
  `applyAction` still doesn't compute `durationSeconds` FROM `yolkDoneness`
  automatically. That's a deliberate line, not an oversight: CONCEPT.md
  §14 already establishes that resolving a customer's stated intent into
  concrete parameters is the LLM-intent-layer's job, not this schema's
  (the exact same principle `fry.json`'s tortilla-francesa/French-omelette
  disambiguation note applies) — this repo's job is making sure that
  resolution has something REAL and GROUNDED to resolve against, which it
  now does, not doing the resolving itself.
- **A new reference table is worth cross-checking against data that
  already existed before it, not just trusting it in isolation.**
  `EGG_BOIL_DONENESS`'s "soft" range (360-420s) was checked against
  `soft-boiled-egg.json`'s already-existing choice of 390s (picked in an
  earlier session, before this table existed) — it falls inside the range,
  a real consistency check, not a coincidence assumed without checking.
  Turned into a permanent unit test (`tests/egg-doneness.test.ts`) so this
  stays checked on every future change, not just verified once by hand.
  Cold-start timing was deliberately left OUT of the new table for the
  opposite reason — checked whether preheat-time + hold-time could just be
  added together for that case and concluded no (the egg cooks gradually
  through the whole ramp, not just once boiling), so a wrong number wasn't
  shipped just to have complete coverage.
- **Salt added to egg-boiling water is real, common technique — but it is
  NOT an instance of `SALT`'s existing seasoning mechanism, and forcing it
  into that verb would have been a category error.** `SALT`/`addsTag:
  "salted"` exists because of osmosis/browning/flavor chemistry
  (`salt.json`'s `timingNote`); salting boiling water for an egg is
  causally different (faster coagulation of leaked white sealing a crack
  if the shell breaks) and isn't really about flavor at all — the egg
  barely absorbs salt from the water in ~10 minutes, unlike a porous food
  cooked longer in salted water (pasta, potato). Documented as a real,
  correctly-scoped, deliberately-not-built gap (`egg.json`'s new
  `crackContainmentNote`) rather than either ignored or mis-modeled via
  the wrong verb just to "have something" — same discipline
  `infuse.json`'s `safetyNote` already established for a differently-shaped
  CCP mismatch. Also explicitly did NOT repeat the commonly-claimed
  "salted water peels eggs easier" — checked confidence on that specific
  claim separately from the crack-containment one and found it weaker/
  disputed (freshness and shocking are the better-supported explanations),
  and said so rather than flattening both claims to the same certainty.

### SIMMER verb, and "heat belongs to a place, not an ingredient"

- **A new verb reusing an existing `transformedState` on purpose, rather
  than inventing its own, was the right call — and the check for it was
  concrete, not just a feeling.** Built `SIMMER` (`data/actions/simmer.json`)
  as a genuinely distinct verb from `BOIL` (different temperature band,
  85-96°C vs. ~100°C, different technique reasoning) but had it produce the
  IDENTICAL `outputs.transformedState: "boiled"` rather than a new
  "simmered" — because a simmered potato/egg and a boiled one are the same
  dish in real cooking, not two different foods, and inventing a second
  state for the same real-world outcome would have been the same category
  error `heat-source.ts`'s "heat source changes TIME, never TEMPERATURE"
  warning already exists to prevent, just on a different axis (process vs.
  outcome, here). Verified this wasn't just a plausible-sounding call by
  actually running `PEEL` (which requires `egg.json`'s
  `statePrerequisites.peel: "boiled"`) against a `SIMMER`-produced egg in
  `scripts/simmer-vs-boil.ts` — it passes with zero new wiring, which is
  the actual evidence the shared-state choice was correct, not merely
  untested optimism. General lesson: when a new action's real-world result
  duplicates an existing state, reusing that state string and PROVING
  downstream consumers (other actions' `statePrerequisites`) still work is
  stronger evidence than asserting semantic equivalence in a doc comment.
- **A capability-test written against a schema constraint (here,
  `durationSeconds`' own `numericRange` floor) can block the exact
  demonstration it was meant to run — worth catching before shipping a
  test that would never actually execute its own interesting branch.**
  First draft of `simmer-vs-boil.ts` tried to replay `egg-haccp.ts`'s "10
  second flash-cook triggers a HACCP warning" demo for `SIMMER`, but
  `simmer.json`'s `durationSeconds` floor (60s, matching `boil.json`'s)
  rejects 10s before the CCP check ever runs — `fry.json`'s floor is 10s
  specifically, which is WHY that demo works there and wouldn't here.
  Resisted the tempting fix (lower `simmer.json`'s floor just to make the
  test pass) since that would be reshaping real data to fit a test rather
  than the reverse; instead changed the test to prove the actually true,
  stronger claim directly — `egg.json`'s `criticalControlPointsByAction.simmer`
  and `.boil` reference the LITERAL SAME CCP id, not a look-alike one, which
  is the real reason no separate threshold is needed (turbulence doesn't
  change Salmonella kill-time) — checkable by reading the data, no
  artificial edge case required.
- **A direct user observation mid-task — "heat is a function inside a place
  where many ingredients can live, it increases and decreases in time, you
  can heat up or play with the pan" — pointed at a real, structurally
  significant, previously-unnoticed gap, and the repo already had physical
  evidence of it before this conversation named it.** `pan.json` has listed
  `possibleStates: ["hot", "cold"]` since before heat-source work started,
  with its own `metadata.notes` already admitting "not fully modeled (no
  thermophysical data yet)" — but `allowedTransformations: []` means
  literally nothing in this vocabulary can ever move a pan between those
  two states; they've been unreachable dead labels. The deeper point:
  `engine.ts`'s `applyAction` is fundamentally one-target-instance-at-a-time
  with heat expressed as a parameter GUESSED PER CALL (`waterTempC`,
  `heatLevel`) on that one target — there is no representation of the
  pot/pan itself as a stateful place with a real temperature that persists
  and evolves over time, which every ingredient currently occupying it
  would share. Two eggs (or a potato and an egg) simmering in the same pot
  right now get two independent `applyAction` calls with two independently
  supplied temperature guesses, not one shared physical truth. This is a
  materially different, larger kind of gap than the "informational-only
  parameter" pattern this repo uses everywhere else (`heatLevel`,
  `startMethod`, `yolkDoneness`) — those all accept that a real mechanism
  goes unmodeled at the CHOSEN depth; this one is about WHERE the state
  even lives (the tool, not the ingredient) and WHETHER it's shared, a
  structural question a parameter tweak can't answer. Explicitly asked the
  user how far to take this before writing anything engine-side, given
  `ROADMAP.md` already has engine work paused for a differently-shaped
  reason (`SEASON` generalization) — answer was "document precisely, don't
  build yet," recorded as its own `ROADMAP.md` "Known-large" bullet rather
  than folded quietly into `SIMMER`'s own scope. General lesson: a user
  aside that sounds like a philosophical remark can be pointing at a real
  fault line already visible in the data (here, a dead-state pair sitting
  in `pan.json` for who knows how long) — worth actually checking the code
  for confirming evidence before either building on the spot or filing it
  away as a vague someday-gap.

### PAR_FRY / double-frying — the same SIMMER-style question, opposite answer

- **The same "does the new verb share the old one's `transformedState`?"
  question came up again for PAR_FRY vs. FRY, and the correct answer was
  the OPPOSITE of SIMMER vs. BOIL — which is exactly why the question needs
  asking fresh each time, not answered by pattern-matching the last
  decision.** SIMMER correctly reuses BOIL's `"boiled"` because the two
  processes reach the identical culinary endpoint. PAR_FRY correctly does
  NOT reuse FRY's `"fried"` — `par_fried` is pale, soft, and unfinished; a
  cook who stopped there would call it wrong, not gently done. Applying
  SIMMER's precedent mechanically here (reuse the existing state) would
  have been a real modeling error masquerading as consistency. The actual
  discriminator, made explicit this time so it's checkable next time too:
  ask whether a competent human would call the two RESULTS the same dish.
  If yes (simmered egg = boiled egg), share the state. If no (par-fried
  fry ≠ finished fry), don't — even when the verbs are otherwise
  structurally identical (same tools, same medium, same capability shape).
- **Not every "this needs a real-world sequence the engine can't do yet"
  intuition turns out to be true — double-frying looked at first like it
  might need the same unbuilt "heat as a place" machinery periodic egg
  cooking does, and turned out not to.** The distinguishing fact, found by
  actually checking rather than assuming: periodic cooking needs RAPID
  alternation between two live temperature baths within one continuous
  process (16 transfers in 32 minutes) — genuinely needs a clock and
  shared, evolving tool state. Double-frying's two stages are temporally
  SEPARATE, with a real ~10-minute rest in between — which means it's just
  two ordinary, independent recipe steps, exactly like BOIL-then-SHOCK
  already is for egg. Proved this rather than asserted it:
  `scripts/double-fry-potato.ts` runs PAR_FRY then FRY as two plain
  `applyAction` calls and it just works, no new engine code. General
  lesson: "this sounds like it needs the same missing feature as that other
  gap" is a hypothesis worth testing against the engine directly, not a
  conclusion to file away — two techniques can look structurally similar
  (both are "cook twice at different temperatures") while actually needing
  completely different amounts of new machinery (one needs a world model
  the other doesn't).
- **`FRY` had a real, longstanding inconsistency with its sibling
  thermal-medium verbs that only became visible by actually comparing
  them side by side: `BOIL`/`SIMMER`/`POACH` all have a real `°C`
  parameter (`waterTempC`), but `FRY` only ever had the vague `heatLevel`
  enum (low/medium/high) despite oil temperature being at least as
  citable and load-bearing as water temperature.** Not something the
  user asked to fix directly — surfaced while sourcing PAR_FRY's own
  `oilTempC` and noticing FRY had no equivalent to be consistent with.
  Fixed by adding `oilTempC` to `fry.json` itself, not just to the new
  `par-fry.json` — the new verb's existence was the forcing function that
  made an old, adjacent gap visible, not the reason to leave it unfixed
  once seen.

### Egg freshness, basting, and "transformations take time" — one message, three separable gaps

- **A single dense user observation split cleanly into three real gaps at
  three different sizes, and treating them uniformly (all build, or all
  document) would have been wrong in both directions.** "Getting the
  perfect egg shape in the pan" turned out to be almost entirely a
  FRESHNESS fact (real, cited, a small data addition — `fresh`/`aged`
  tags). "Throwing heated oil over the yolk" turned out to be a real,
  nameable TECHNIQUE distinct from one already in the schema
  (`topCookingMethod`, distinguished from `edgeStyle`'s existing
  `crispy_lace_puntilla` — same physical motion, different target) — also a
  small, buildable parameter addition. "Transformations usually take time...
  states can change" turned out to be the SAME structural engine gap
  already recorded (`ROADMAP.md`'s "heat as a shared, time-varying place"
  entry) restated in different words, not a new one — folded in rather than
  duplicated. Splitting a dense message into its separately-sized parts
  before deciding what to do with each avoided both under-building (leaving
  the two real, small, buildable facts undocumented) and over-building
  (starting engine work on the atomicity point that was never actually
  asked for and isn't newly scoped just because it was mentioned again).
- **Checked whether the third thread was actually a NEW gap before folding
  it into the existing one, rather than assuming a philosophical-sounding
  restatement must be identical to the last one.** The two concrete cases
  that came with it this time (an egg's shape settling continuously as it
  fries; basting's effect depending on WHEN mid-process it's applied) are
  genuinely different scenarios from periodic egg-cooking (the original
  motivating case for that entry) but root-caused to the exact same
  mechanism: `applyAction` maps one `Instance` state directly to another
  with no representation of anything partway through. Worth stating
  precisely why folding was correct here even though the SIMMER-vs-PAR_FRY
  entry just above warns against assuming shared framing — those were two
  different REQUIRED SCHEMA DECISIONS (state string) built independently
  from convention; this is one and the same UNBUILT MECHANISM restated,
  confirmed structurally, not merely by the sentences sounding similar.
- **`fresh`/`aged` needed a real decision about WHERE freshness can be set,
  not just whether to add it, and the honest answer was "only at
  `initialInventory`, never by an action."** This repo has no elapsed-time
  concept and no verb for the passage of time — inventing an `AGE` action
  just to make freshness feel more "complete" would have manufactured a
  false capability (the engine pretending to model something — real-world
  time passing between or during recipe steps — it fundamentally doesn't).
  `RecipeInstanceSchema.tags` already supports arbitrary starting tags on
  any inventory instance, so this needed zero new mechanism — confirmed by
  checking the schema before assuming a new field was needed, the same
  "check for an existing shape before building a new one" instinct that
  caught the heat-source circular-import case back on 2026-08-13's first
  entry in this file.

### "Complete potato" — being challenged directly on "ANY" was the right prompt to actually test, not just re-explain

- **Asked "are you sure we can make ANY egg mix AND ANY potato fry style,"
  the right response was to test the edges, not to defend or re-assert the
  existing summary.** Ran four direct checks before answering at all: does
  a MASH action exist (no), can you CUT an unpeeled potato (no, hard
  error), does a grated/shredded shape exist (no), can egg be baked (no).
  All four were real, previously-uncited gaps, found in under a minute of
  actual checking rather than reasoning from what had already been built.
  General lesson, worth stating because it's easy to skip under time
  pressure: when asked "are you SURE," the answer is a fresh check against
  the code, not a more confident restatement of the last answer.
- **Caught and fixed a real mistake mid-build, not after: grating is not a
  sixth `CUT` shape.** First instinct was to add `"grated"` to `cut.json`'s
  `shape` enum, matching the path of least resistance (one file edit
  instead of two new entities). Caught before committing by asking the
  same question this repo asks of every other verb/tool pairing: does the
  PHYSICAL MECHANISM match? A box grater shreds by friction against a
  grating surface; a knife slices. Folding `"grated"` into `CUT` would have
  asserted a knife produces grated potato, which is false — the same class
  of error `PAR_FRY` getting its own tool/temperature band (not a `FRY`
  parameter) or `MASH` getting its own tool (not reusing `mortar`) were
  already built to avoid. Fixed by giving `GRATE` its own verb and tool
  (`grater.json`) instead. General lesson: "which existing enum could this
  value slot into" is the wrong first question for a new technique — "does
  an existing TOOL actually perform this motion" is the right one, and
  answering it wrong is cheap to catch immediately, expensive to catch
  after data/recipes start depending on the wrong shape.
- **`statePrerequisites` needed to become "one state OR a set of acceptable
  states," and the fix was small because the question was scoped precisely
  first.** The actual need (skin-on cuts, mash needing boiled-OR-baked) was
  never "should transitions be freely composable" (a much bigger, riskier
  question — see the `INVALID_TRANSITIONS` gap this session already found
  concrete evidence for, `FRY` then `BOIL` composing with zero complaint).
  It was narrowly "can more than one prior state satisfy the same
  prerequisite." Widened `ingredient.ts`'s type to `string | string[]`,
  kept `engine.ts`'s single-state behavior and exact error-message format
  unchanged by treating a lone string as a one-element set — verified by a
  new unit test asserting the OLD single-value error message still matches
  a literal string, not just a looser regex, so a subtle format change
  would have been caught. A small, precisely-scoped engine change (one
  field's type, one function's check) delivered on the same day a much
  larger, precisely-NOT-scoped one (heat-as-a-place) was correctly left
  unbuilt — the difference was never "engine work is risky," it was
  whether the actual need was small or genuinely structural, checked
  freshly each time rather than assumed from the last decision.


## 2026-08-14

### `placementMethod` — "don't break the egg" split into three real mechanisms, closed exactly one

- **A single, casual instruction ("of course, the robot has to try not to
  break the egg") turned out to name three physically distinct crack
  mechanisms, not one — and two of the three already had real coverage
  elsewhere in this vocabulary, found by checking before building instead
  of assuming a new mechanism was needed from scratch.** `startMethod`'s
  existing note already named thermal shock (`cold_start` vs.
  `boiling_start`) as a real crack factor; `simmer.json`'s `whyPerTarget`
  note already named turbulence-during-cooking as "a common, preventable
  CAUSE of shell cracking." The one genuinely uncovered mechanism was
  mechanical impact AT ENTRY — the literal "place it delicately" moment —
  which is what `placementMethod` actually closes. Naming all three and
  being precise about which one is new avoided both under-claiming (missing
  that two were already real, cited coverage) and over-claiming (implying
  one new parameter closes "egg cracking" as a topic).
- **Resisted turning this into a crack-probability simulation, which would
  have been a strictly worse answer than an honest categorical parameter.**
  It would be possible to invent a plausible-looking numeric "crack risk
  score" as a function of `placementMethod`/`startMethod`/turbulence — but
  nothing in this repo's citation trail supports assigning real numbers to
  that, and doing so would violate the same standard `fry.json`'s
  `heatLevel`/`agitation` notes already hold: don't imply more precision
  than was actually verified. A closed enum recording what technique was
  used is honest; a fabricated probability model wearing real-looking
  numbers would not be, and would be a worse answer specifically because it
  would look more rigorous than it is.
- **Named a real, further technique (piercing the egg's air-cell end) as
  explicitly NOT built, rather than either building it speculatively or
  omitting it silently.** It's real, commonly-cited, and would need a
  currently-nonexistent shell-integrity/piercing mechanism — a bigger,
  separate addition with no forcing case yet. Recording it as known-and-
  deferred keeps the gap list honest without expanding scope past what was
  actually asked.

### Egg salad prep — one real gap closed, two real gaps found to be already-closed

- **"How do you get the egg out? Do you wait or shock before peeling?"
  turned out to already be answered by the existing schema, not a new
  gap** — `egg.json`'s `statePrerequisites.peel` has only ever required
  `"boiled"`, never the `"shocked"` tag, so `BOIL -> PEEL` (implicitly:
  however long an uncontrolled wait took) and `BOIL -> SHOCK -> PEEL`
  (controlled, immediate) were BOTH already valid sequences — proved by
  actually running both in `scripts/egg-salad-prep.ts`, not just reading
  the schema and asserting it. Worth stating precisely because it would
  have been easy to assume a question shaped like "how do I do X" implies
  X isn't possible yet — checking first, here, found nothing needed
  building for that half of the question at all.
- **"Cut in blocks" WAS a real, closed gap — `CUT` had never been wired to
  egg.** `isChoppable` + `statePrerequisites.cut: "peeled"` closes it,
  mirroring `potato.json`'s existing `CUT` wiring exactly, with one
  deliberate difference: `peeled` alone, not `["washed","peeled"]` — there
  is no skin-on-egg equivalent of a skin-on potato wedge, so the OR-array
  mechanism `ingredient.ts` added for potato doesn't apply here; checked
  that before reusing the pattern by rote.
- **`possibleStates` for the cut egg lists only `sliced`/`diced`/`chopped`,
  not all five of `cut.json`'s shape values — a real, deliberate narrowing,
  not a copy-paste of potato's full list.** `julienne`/`minced` aren't real
  techniques anyone applies to a boiled egg; `potato.json` listing all five
  is honest for potato (every one of those is real for potato), not a
  precedent to blindly reuse for a different ingredient. Named the
  resulting asymmetry explicitly rather than silently: `cut.json`'s `shape`
  parameter is one shared enum with no per-entity restriction mechanism, so
  `engine.ts` still wouldn't actually stop a caller from requesting
  "julienne egg" today — `possibleStates` here is an honest declaration,
  not an enforcement, and building real per-entity-per-value restriction
  would be new, unscoped engine architecture (same category as the already-
  deferred `SEASON`-generalization gap), not attempted as a side effect of
  this fix.
- **"Use it in a salad" surfaced the SAME already-named, already-deferred
  gap as `garlic-oil-potatoes.json`'s salad, not a new one** — `ROADMAP.md`
  Phase 4's `COMBINE` entry already says reusing fried garlic in a salad
  "still needs its own action definition... not built speculatively here."
  Recognized as the identical shape of gap rather than re-litigated or
  built ad hoc for egg specifically — real composite-dish assembly (a
  `salad` entity, base ingredients like lettuce/mayo that don't exist yet)
  stays real, separate, deferred work.

### `potato-doneness.ts` — the egg pattern reused for a second ingredient, proving the prior session's genericity claims for real

- **`place.ts`/`heat-source.ts` needed ZERO changes to work for potato —
  the actual proof that "the heat physics doesn't care what's in the
  water" was true, not just asserted when built for egg.**
  `scripts/boil-potato-as-a-robot.ts` reuses `pourInto`/`advanceHeatSeconds`/
  `isAtBoiling` and `requiredToolCapabilities`'s `isDeepVessel` check
  completely unmodified. Worth stating plainly: this is the actual payoff
  of building `place.ts` as a standalone, ingredient-agnostic module in the
  first place, rather than something coupled to egg specifically — a
  second real forcing case confirming the earlier design choice, not
  merely repeating it.
- **A real, new physical finding this table surfaces that the egg table
  never had to deal with: potato and egg disagree on which start method is
  actually BETTER, not just gentler.** For egg, `boiling_start` is the
  assumed default and `cold_start` is framed as a gentler alternative with
  a real timing cost. For potato, America's Test Kitchen's own testing
  found `cold_start` is objectively better on BOTH axes — more even
  cooking AND less total time — genuinely the opposite framing. Named this
  explicitly rather than silently reusing egg's `boiling_start`-is-the-
  default framing for potato too, which would have quietly misrepresented
  the real recommended technique. `POTATO_BOIL_DONENESS`'s ranges are
  still scoped to `boiling_start` regardless (matching `durationSeconds`'
  existing hold-time semantics) — a real, stated tension between what this
  table computes and what real technique actually recommends, not resolved
  either way.
- **The three `pieceSize` ranges are honestly reported as overlapping,
  unlike egg's cleanly-separated soft/medium/hard tiers — a real domain
  difference, checked before writing the unit test, not assumed to match
  the egg precedent by default.** Egg's table pins one size assumption
  ("large"), so its three tiers vary by time alone and stay cleanly
  ordered. Potato's three piece-size categories each still span a real
  range of actual sizes (a small quartered new potato vs. a large
  quartered russet), so a big `diced` piece and a small
  `halved_or_quartered` piece can genuinely take about the same time.
  Copying egg's "ranges are non-overlapping" test onto potato's table
  without checking would have been a false assertion — checked the actual
  numbers first, wrote a physically-honest "minimums are ordered" test
  instead (`tests/potato-doneness.test.ts`).
- **"Cut in blocks" (egg, prior entry) and "the size of potato" (this one)
  turned out to share one real, previously-invisible gap: `cut.json`'s
  `shape` enum had no "halved"/"quartered" values at all.** Egg's CUT gap
  was "not wired to this entity"; potato's was different and easy to miss
  because potato WAS already `isChoppable` — the actual gap was one level
  deeper, in the shared action's own vocabulary, not in potato's wiring to
  it. Found only because `POTATO_BOIL_DONENESS`'s `halved_or_quartered`
  category needed a real corresponding CUT-produced state to attach to and
  none existed — the same "a real number/state needed something to resolve
  against, and nothing was there" shape as most of this session's other
  closed gaps.


## 2026-08-15

### Fry-fat generalization (`butter.json`, `sunflower_oil.json`) — finishing and closing out work that was already written

- **The code/data was already correct and complete from 2026-08-14 (a prior
  session); what was actually missing was the repo's own closing
  discipline** — `npm test`/`npm run validate`/`npx tsc --noEmit`/every
  `demo:`/`capability-test:` script had never been re-run against it, and
  neither `REFERENCES.md` nor this file had an entry. All of that ran clean
  on the first pass (99/99 tests, 74/74 files valid including full
  recipe-runner simulation, zero type errors, 25/25 demo scripts). The
  lesson isn't about a bug found — there wasn't one — it's that "the code
  looks done" and "the change is closed out" are different claims, and
  this repo's own stated standard (`CLAUDE.md`: run both test suites plus
  every demo after any change, cite every fact in `REFERENCES.md`) is what
  actually catches the gap between them, not a read-through.
- **Two fat entities, not a parameter on one, because the real answer to
  "what changes if I fry with butter" is qualitatively different, not
  quantitatively.** `sunflower_oil.json` is mechanically identical to
  `oil.json` in every way that matters to the engine (same
  `isFryingMedium` capability, same order-of-magnitude thermophysical
  shape) — it exists purely to prove `fry.json`'s
  `requiredIngredientCapabilities` check was already substitutable, the
  same way `sunflower_oil` vs. `oil` differ only in `smokePointC` (230°C
  vs. 200°C) and get correctly different fry-temperature headroom for
  it. `butter.json` is a genuinely different case: real ~18% water content
  (unmodeled foaming-evaporation phase, named not built), a *lower* smoke
  point than either oil (175°C — milk solids browning/charring before the
  fat itself would smoke, a different physical mechanism, not a weaker
  version of the same one) that `advanceTempSeconds`'s existing safety
  check correctly rejects at `crispy_french_fries.json`'s real 191°C
  finishing-fry target, and named-not-built adjacent techniques (clarified
  butter/ghee raising the usable smoke point by removing the milk solids;
  brown butter/beurre noisette as an intentional doneness stage). Modeling
  butter as "oil with a different number" would have been actively wrong,
  not just less thorough — it would have hidden the one thing that makes
  butter behave differently in a real kitchen.
- **Zero `src/` changes were needed to add a third and fourth fat entity —
  further, unplanned confirmation that `requiredIngredientCapabilities`
  (capability-based) and `place.ts`'s `advanceTempSeconds`/smoke-point
  check (entity-property-based, not fat-type-based) were both already the
  right generalization**, the same shape of payoff `place.ts`'s other
  four forcing cases already demonstrated (see 2026-08-14 entries above).
  Butter forces exactly the case those functions were built to handle
  generally (an arbitrary `smokePointC` ceiling) despite never having been
  written with butter specifically in mind.
- Closes part of `ROADMAP.md`'s long-open "far more staple ingredients"
  gap (dairy) — deliberately scoped to plain whole butter only, not
  clarified butter/ghee or milk/cheese, which remain real, named,
  unbuilt gaps.

### Real cut-shape geometry (`cut-dimensions.ts`) — refusing to fabricate the part that isn't real science

- **The user asked for cut geometry + oil temperature + cook time,
  connected to texture, for tortilla de patatas — "measured and mathed."
  The right answer wasn't "build it," it was "check whether that math
  actually exists first."** This repo's own already-cited Kalogianni &
  Smith (2013) paper (`REFERENCES.md`, cited 2026-08-13 for `fry.json`/
  `par-fry.json`) found frying is a genuinely nonlinear, coupled
  heat/moisture-transport process — crust thickness plateaus despite
  continued heat penetration, water loss and oil uptake aren't simply
  linked. A clean formula unifying variety + geometry + oil temp + time
  → texture is not something real food science has reduced to one
  equation. Building one anyway would have been exactly the "false
  precision" `scientific_review_report.md` specifically praised this
  repo for rejecting — the temptation here wasn't a stray shortcut, it
  was the entire shape of what was asked for.
- **Presented the honest scope options rather than either silently
  building the fabricated version or silently building a smaller thing
  without saying why — the user chose the smallest, geometry-only
  slice, explicitly deferring the heat-penetration physics and variety/
  starch data.** Matches this session's now-repeated pattern (the
  pasteurization citation, the Kenji egg-doneness "inconclusive, don't
  silently apply" case): when a request implies a specific number or
  formula that isn't actually verifiable/real, the right move is
  surfacing that as a decision, not picking a side unasked.
- **Third instance of the same reference-table playbook
  (`egg-doneness.ts`, `potato-doneness.ts`, now `cut-dimensions.ts`) —
  proof the pattern generalizes cleanly a third time, not a coincidence
  worth letting pass unremarked** (same observation this repo already
  made about `place.ts`'s `advanceTempSeconds` generalizing four times).
  An existing categorical action parameter (`cut.json`'s `shape`) gets
  real, cited numeric meaning via a standalone module, zero changes to
  the action's own schema or to `engine.ts` — the established shape for
  "give a label real meaning without inventing new enforcement."
- **Two real sources were checked via direct lookup, not assumed, and
  the checking itself surfaced two real facts worth keeping**: (1)
  Wikipedia's own "List of culinary knife cuts" gives NO numeric
  standard for "mincing" or "chopped" — confirmed by fetching the page
  directly, not inferred from absence in a search summary. Both entries
  in `cut-dimensions.ts` are honestly flagged as unsourced best-effort
  approximations, distinctly worded from the sourced entries, rather
  than presented at the same confidence. (2) Fetching two real tortilla
  de patatas recipes directly (The Mediterranean Dish: "1/8-inch-thick
  slices"; Spanish Sabores: "about 5 mm thick") gave a genuine,
  independently-converging 3-5mm range — stronger grounding than the
  aggregated web-search summary alone would have supported.
- **A real, previously-undocumented tension surfaced and was named
  rather than quietly resolved**: `cut-dimensions.ts`'s own "diced"
  entry (professional small-to-medium dice, ~6-13mm) and
  `potato-doneness.ts`'s existing "diced" entry (~25mm, potato-salad/
  boiling-style) are genuinely different real dice sizes for different
  purposes — `cut.json`'s single `diced` enum value doesn't distinguish
  which one a given recipe means. Neither number is wrong; picking one
  and silently discarding the other would have been.
- **`potato.json`'s `physicalDimensions.typicalDiameterCm` (new field,
  promoted from prose already cited in `potato-doneness.ts`) is a small,
  concrete step toward this repo's still-unbuilt `DomainFact` idea**
  (`architecture_phase4_ticket.md`/`ROADMAP.md` Phase 4.5 — structured,
  queryable facts instead of only prose) — not that schema, but the same
  instinct: a real number a planner could someday query belongs in a
  typed field with a citation, not only inside a `description` string a
  human has to read.

### `heat-penetration.ts` — the deferred physics, closed the same day, and a real number that turned out surprisingly small

- **The user came back with the exact mechanism that makes this real,
  buildable physics rather than the fabricated-formula territory rejected
  last pass**: hot oil browns the surface fast while the potato's low
  thermal conductivity makes the CENTER lag — sometimes a deliberate
  technique (thin cut + high heat = crispy outside/tender inside), not
  just a risk. Unlike "geometry+temp+time+variety → texture" (no real
  formula exists), "how long until the CENTER reaches a target
  temperature, given thickness and the medium's real temperature" has an
  actual textbook answer: Fourier's second law, the standard one-term
  slab approximation. Asked whether to build it or just document the
  principle; the user chose to actually build it.
- **Reused this repo's own already-cited Choi & Okos (1986) model for
  real, rather than adding a new, separately-recalled specific-heat
  number** — `potato.json`'s `thermophysical` citation had named
  Choi-Okos since before this session but admitted the model was never
  actually run (density/conductivity were "recalled as being in the
  right range," not computed). Found the actual published component
  polynomial for carbohydrate specific heat, combined it with
  `water.json`'s own already-cited 4186 J/(kg·K) for the water
  component, mass-weighted by `potato.json`'s own tracked composition —
  a real computation (3733.74 J/(kg·K), rounded to 3730), not a new
  guess, and a genuine upgrade in rigor for that one field specifically
  (density/conductivity stay as recalled figures, honestly still
  uncomputed — this doesn't quietly upgrade their confidence too).
- **The computed numbers turned out much smaller than expected — single-
  digit to tens of seconds for a real 3-5mm slice to reach doneness at
  the center — and that discrepancy against `crispy_french_fries.json`'s
  real 180s fry time was itself worth investigating, not smoothing
  over.** It's correct, not a bug: pure conductive heat penetration
  through a few millimeters is genuinely fast. Real total fry time is
  dominated by something this model doesn't touch at all — surface
  moisture evaporation and crust formation, exactly what this repo's own
  already-cited Kalogianni & Smith (2013) found ("most property change
  happens in the first 1-2 minutes," "crust thickness plateaus despite
  continued heat penetration"). Named this explicitly as the model's
  third and most important honesty caveat (alongside the Bi→∞
  simplification and the no-browning-kinetics limit) rather than either
  hiding the small numbers or quietly adjusting the model to produce
  numbers that "looked more like" a real recipe — the physics was
  computed correctly; what needed fixing was the doc comment's honesty
  about what question it actually answers.
- **Third real, named honesty caveat in one module, not padding**: (1)
  Bi→∞ (instant surface heating) makes this a lower bound, not an exact
  prediction; (2) no browning/Maillard kinetics, so it cannot say
  whether the outside actually burns, only how fast the center heats;
  (3) pure conduction only, so its times are not comparable to real
  total fry times without accounting for moisture/crust physics this
  repo doesn't model. All three are real, distinct limitations found by
  actually building and running the model, not hedging language added
  defensively — the exact same discipline this repo has held to since
  `EGG_BOIL_DONENESS`'s first assumptions block.
- **The user's very next observation — "it's not the same if the
  potatoes are swimming in oil or if there is only a little" — composed
  with the SAME model rather than needing a new one, and turned into a
  real, checkable, exactly-4x prediction, not just "it's slower."** A
  standard heat-transfer symmetry argument (Cengel; Incropera & DeWitt,
  the same chapter already cited) shows one-face heating with the other
  face insulated is physically identical to half of a symmetric slab of
  double the thickness — so submerged (2 faces) vs. shallow oil (1 face)
  is just a different `halfThicknessM` fed into the exact same
  `secondsForCenterToReachTempC`, via a small new
  `effectiveHalfThicknessM` helper, not a new physics module. Because the
  model's own time formula scales with L², this yields a specific,
  derivable prediction — the center should take almost exactly 4x as
  long with one face heated vs. two, for the same actual thickness — and
  the capability-test script's real numbers confirmed it exactly (4.0x
  for both the thin and thick slice cases), the strongest kind of
  evidence this repo's discipline values: not "the number changed in the
  expected direction" but "the number changed by the exact ratio the
  math predicted." A second small, honest simplification was added
  alongside it, in the same spirit as the Bi→∞ one already documented:
  treating a pan-fried top face as fully insulated (zero flux) is itself
  a simplification — a face exposed to air isn't perfectly insulated,
  just at a much lower heat-transfer rate than oil contact — named
  explicitly in `effectiveHalfThicknessM`'s own doc comment rather than
  folded silently into the citation.
- **This kept composing rather than sprawling** — three real-world
  observations in a row (cut geometry, oil-temp-vs-thickness heat
  penetration, submerged-vs-shallow oil) each landed on either a genuinely
  new, well-scoped module (`cut-dimensions.ts`, `heat-penetration.ts`) or,
  this time, a small addition to a module already built the same day.
  Recognizing which case a new observation is — new module vs. new
  parameter on an existing one — mattered more here than any single
  design decision inside either file.

### Closing the coverage gap just found — 2 of 4, not all 4, and why

- **Given an open "you choose," picked the most direct continuation of
  the work just finished — actually reaching the two named-uncovered
  recipes — rather than starting something new.** Looked closer before
  editing, though: `salted-fried-potatoes.json`'s potato `FRY` step has
  EMPTY params (no `heatLevel`, no `durationSeconds` at all), and
  `garlic-oil-potatoes.json`'s has `heatLevel` but still no
  `durationSeconds`. Adding `oilTempC` alone to either wouldn't activate
  anything — the new check requires both `oilTempC` AND
  `durationSeconds`. Inventing a `durationSeconds` where the original
  author left the step open-ended would be a real, consequential edit to
  recipe BEHAVIOR (a specific cook time is real information, not just
  added precision on an existing one), not the same kind of move as
  promoting an already-stated `heatLevel` to a real number. Left both
  recipes alone — 2 of 4, not 4 of 4, and the reason is a real
  distinction, not half-finished work.
- **`tortilla-de-patatas.json`/`tortilla-de-betanzos.json` both already
  had `heatLevel: "low"` AND a committed `durationSeconds` — adding
  `oilTempC: "135"` there is pure enrichment, no behavior change.**
  Needed no new research: `fry.json`'s own `parameterNotes` already cites
  a real source (Harold McGee, *On Food and Cooking*) mapping
  `heatLevel: "low"` to a 120-150°C pan-surface band — 135 is that
  band's own midpoint, matching this repo's standing "round,
  representative value within an already-cited range" convention rather
  than treating this as a new fact needing its own citation.
- **Checked the result directly rather than trusting the silence
  (same discipline as the previous commit's `crispy_french_fries.json`
  verification)**: at 135°C, a real `"sliced"` potato's center reaches
  fork-tender in 10.0-111.2s depending on exact thickness/oil coverage —
  both recipes' actual durations (900s, 480s) sit comfortably above
  that, and `validate-recipe` now reports zero timing advisories for
  steps that previously had no real number to check at all. Recorded the
  actual computed range in each recipe's own new `oilTempCNote`, not
  just "this should be fine."

### `vinegar.json`/`acid.json`/`flavor-balance.ts` — the fourth seasoning verb, and taste-interaction data this repo never had

- **Vinegar, not citrus, as the first ACID entity — a real, deliberate
  choice, not the only valid one.** Citrus (lemon/lime juice) is at
  least as common a real acid source, but modeling it honestly would
  pull in juicing/zesting sub-mechanics this repo has no verbs for yet
  (unlike vinegar, which is used directly, shelf-stable, no prep step).
  Vinegar is also the cleaner match to this repo's own established
  "one generic entity for the common case" convention (`salt.json`,
  `oil.json` are both generic, not `table_salt.json`/`olive_oil.json` —
  the specific-variant entities like `sunflower_oil.json` came SECOND,
  once a real substitution case existed). Citrus as a second acid entity
  is a real, deferred gap, not implied covered.
- **`ACID` mirrors `SALT`/`PEPPER`/`CHILI` exactly, on purpose, not out
  of laziness.** The `SEASON`-generalization gap
  (`addsTagFromParameter` not existing, `requiredIngredientCapabilities`
  not identifying WHICH instance satisfied it) was already named and
  deferred twice before this session; a fourth manually-duplicated verb
  is the same honest "engine work stays paused" answer as the third,
  not a new decision needing re-litigation. Wired to the exact same 3
  entities `PEPPER`/`CHILI` already reach (`potato`/`egg`/`egg_cracked`,
  not `garlic`) for the same reason — matching an existing footprint
  isn't a new judgment call, it's just consistency.
- **The real new piece wasn't the verb, it was `flavor-balance.ts` — and
  writing it honestly required inventing exactly one new concept
  (`"richness"`) while resisting inventing more.** `SensoryPropertiesSchema
  .taste` (ingredient.ts) classifies what a taste an INGREDIENT has;
  nothing anywhere recorded how tastes INTERACT. The temptation once
  building that was to also model saltiness-vs-sweetness, umami-vs-
  everything, etc. — resisted, because the Reddit thread that motivated
  this only ever named three specific pairs (Kempeth's comment,
  specifically), and this session's own very recent `invalidTransitions`
  correction (same day) is a fresh, direct lesson in what happens when a
  plausible-sounding generalization gets asserted without a real,
  checked case behind each specific claim. Three cited pairs, not a
  speculative matrix of all 7×7 taste combinations.
- **Verifying the claims turned up a real confidence gradient, not
  uniform certainty — and the gradient itself is honestly the more
  interesting finding.** Sweet/sour and salt/bitter both trace to real,
  peer-reviewed, DOI-bearing psychophysics studies, found by searching
  the MECHANISM ("sodium suppresses bitterness taste receptor study"),
  not the Reddit comment's wording, and confirmed by direct lookup of
  the actual paper text. Acid-cuts-richness — the most-repeated claim in
  the source thread, and the one this whole addition was built to
  represent — turned out to be the WEAKEST-sourced of the three: real,
  widely-applied, plausible mouthfeel-science mechanism, but the
  strongest primary source found (a 2025 *Comprehensive Reviews in Food
  Science and Food Safety* review) sat behind a paywall, so it's logged
  at `commonly_cited_unverified` rather than claimed as `standard_
  reference` to match the other two. Also found, and recorded rather
  than hidden, a real limit on the salt/bitter pair itself: Breslin &
  Beauchamp's own data shows it's compound-dependent (some bitter
  compounds suppressed over 70%, others essentially unaffected) — a
  "realWorldCaveat" field exists in the schema specifically so a fact
  like this has somewhere honest to live instead of being smoothed into
  a flat, over-general claim.

## 2026-08-16

### Failure states (`burned`/`overcooked`) — the real technique differences that determined each entity's closures

- **The same real-technique-per-entity discipline `invalidTransitions`
  already established (`potato.json`'s `mashed → fried` deliberately
  staying legal for potato cakes) applied to a genuinely new axis: not
  every entity's failure states should be closed off the same way, even
  though all four (potato/egg/garlic/tortilla_mixture) got the identical
  `burned`/`overcooked` VOCABULARY.** Concrete, checked distinctions, not
  assumed uniform:
  - **Potato** has a real, named rescue for `overcooked` (mashing an
    over-boiled, mushy potato — the same real technique `mashNote`
    already documents from a different starting point) that the OTHER
    three entities genuinely don't have an equivalent of — stated as a
    deliberate simplification in `potato.json`'s own note, not silently
    treated the same as the others.
  - **Egg**'s `overcooked` (the classic over-boiled-hard-egg case — a
    commonly-described grey-tinged yolk surface, rubbery white) has no
    comparable rescue once past it — deliberately phrased WITHOUT the
    specific iron-sulfide chemistry mechanism (a real, well-known reaction,
    but asserting the specific mechanism as fact would need its own
    citation this session didn't do the lookup for) — the qualitative,
    commonly-known-result framing was judged sufficient and honest without
    it, the same tier this repo already uses for many similarly
    well-established but individually-uncited culinary facts.
  - **Garlic** is the sharpest, fastest, most commonly-known real case of
    all four — small piece size and high sugar/protein content mean it
    goes from toasted to bitterly burnt quickly, a fact this repo's OWN
    `ROADMAP.md` had already named in passing ("don't let it rest in the
    oil, burnt garlic tastes bad") describing a real sequencing problem
    found while building `garlic-oil-potatoes.json`, well before `burned`
    existed as an actual, assertable state — checked (`grep`) before
    claiming this connection, not assumed from memory.
  - **Tortilla mixture** (the composite dish) has no rescue at all for
    either failure state, for a different, simpler reason than egg's: it's
    the FINISHED dish, not an intermediate ingredient with further
    processing options — closer in shape to "the meal is ruined" than to
    "this component needs to be discarded and the recipe continues,"
    named as the reason its own closure looks structurally like potato/
    garlic's `burned` entry but for a different underlying cause.
- **Deliberately did NOT assert the specific food-science mechanism behind
  either failure state as a cited fact where doing so would have required
  a lookup this session didn't do** (egg's grey-yolk-ring chemistry,
  garlic's exact sugar/Maillard kinetics) — the QUALITATIVE claim
  ("this is a real, commonly-known result/hazard") was judged sufficient
  and left at that confidence tier, rather than dressing it up with an
  unverified specific mechanism just to sound more rigorous. Matches this
  repo's own established tier system (`REFERENCES.md`'s confidence levels)
  applied by judgment in a case where citing at all would have cost real,
  unbudgeted verification effort for a claim this repo doesn't actually
  need at higher precision to be honest.

### `potato.json`'s `invalidTransitions` audit — which "processed → peeled" transitions are real, checked individually

- **Two structurally DIFFERENT reasons a state can't revert to `"peeled"`,
  not one blanket rule — getting this distinction right is the entire
  point of this audit, the same distinction `egg.json`'s own 2026-08-15
  audit already established for a different entity.** (1) Cut-shape
  states (sliced/diced/julienne/chopped/minced/halved/quartered/grated) —
  once the potato is subdivided into pieces, there is no single whole
  piece left for PEEL to act on. This is a fact about GEOMETRY, true
  regardless of any named technique existing or not, the same confidence
  tier `egg.json`'s sliced/diced/chopped forbidding peeled already claims.
  (2) `fried`/`baked`/`par_fried` — no comparable geometric argument
  exists (the potato is still one piece); the claim here is weaker, "no
  real named technique for peeling an already-fried/baked potato was
  found on active search," the exact same weaker tier `egg.json`'s own
  fried/poached-forbidding-BOILED entries (as opposed to its
  fried/poached-forbidding-PEELED entries) already use. Recording BOTH
  tiers explicitly in the same note, rather than picking one confidence
  level for the whole batch, is what keeps this honest.
- **`boiled` was deliberately left untouched, and the reasoning for WHY
  it's different from `fried`/`baked` is a real physical distinction, not
  an arbitrary carve-out** — boiling is a gentle, WET process; the skin
  stays intact and separable by hand once cool enough to handle, which is
  exactly why boil-in-jacket-then-peel is a real, common, already-verified
  technique (`invalidTransitionsNote`, 2026-08-15). Frying/baking's dry/
  oil heat measurably alters the skin's texture (crisping, dehydration,
  browning) in a way boiling doesn't — a real, checkable difference, not
  just "boiled already got corrected once so leave it alone."
- **Deliberately did NOT attempt shape-to-shape closures (e.g. `diced`
  forbidding `sliced`), even though the cut-shape → peeled closures above
  made it tempting to keep going.** Real, named counter-examples exist:
  progressive cutting (`halved` → `quartered` → further dicing) is a
  genuine real technique, and CUT's own `statePrerequisites`
  (`["washed","peeled"]`) already partially gates re-cutting via the
  `washed` TAG mechanism in a way that's hard to reason about
  transition-by-transition without real risk of asserting a closure
  that's actually a legitimate technique — the exact failure mode this
  whole audit exists to avoid repeating. Left unasserted, named as a real,
  still-open gap in the entity's own note, rather than guessed at to look
  more complete.
- **This audit was triggered by a TOOL finding the gap (`src/reachability.ts`,
  TICKET 4) rather than a person deciding to re-check `potato.json`
  proactively** — worth noting as the concrete payoff of building a real
  search over this repo's own data instead of only reasoning about it:
  the exact kind of previously-invisible gap this repo's own manual
  audits (however careful) are structurally prone to missing, found
  mechanically instead.

### Yield/waste factors — the garlic bulk-vs-clove scope trap, checked before it became a real error

- **A web search for "garlic clove skin percentage" returned a genuinely
  authoritative-LOOKING figure (~24-25%, repeated across multiple
  garlic-processing/valorization papers) that would have been a real,
  significant error if used directly — checking WHAT it actually measured
  before using it is what caught this, not the figure's own credibility.**
  That 24-25% is whole-BULB industrial processing yield: every clove's
  skin PLUS the bulb's own outer papery wrapper layers, totaled across an
  entire head of garlic and expressed as a fraction of the whole bulb's
  mass. `garlic.json` (this repo's actual entity, throughout) is modeled
  at single-CLOVE granularity — its own thermophysical citation already
  says so explicitly ("typical clove-tissue values"), a fact that had to
  be actively checked, not assumed, before deciding which of two
  plausible-sounding percentages was the right one. A second, much
  smaller, more weakly-sourced estimate (a single clove's papery skin is
  usually well under 0.1g against a ~4-7g peeled clove, roughly 1-3%) is
  the one actually used — a real case of the MORE authoritative-looking
  source being the WRONG one for this repo's actual unit of measurement,
  not the less rigorous one.
- **Worth stating the general lesson explicitly: "is this percentage
  measuring the same THING my entity represents" is a real, separate
  question from "is this percentage from a credible source," and both
  have to be checked — a rigorous source measuring the wrong scope is not
  more trustworthy than a rough estimate measuring the right one.** The
  same category of check as `LEARNINGS_ENGINE.md`'s earlier entries about
  not conflating two similar-looking but structurally different facts
  (`FRY`'s `oilTempC` vs. `waterTempC`; `overcooked`'s partial vs. `burned`'s
  full terminality) — applied here to a citation's own scope rather than
  to code.

