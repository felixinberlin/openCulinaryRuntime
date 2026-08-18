# LEARNINGS_PROCESS.md

Part of `LEARNINGS.md`'s theme split. This file: the SPECIFIC incidents
behind `LEARNINGS.md`'s Core verification-discipline rules — dated, with
the concrete numbers/findings/decisions each one produced. **Read
`LEARNINGS.md`'s Core section first** — if you just need the rule, it's
there; this file is for when the specific precedent matters (e.g. "has
this exact document/claim already been checked").

Pruned 2026-08-18 (was 1,153 lines) — every entry's generalizable lesson
moved to `LEARNINGS.md`'s Core section; what remains here is the
non-repeated residue: the specific claim, source, number, or decision
each incident actually produced. See `LEARNINGS.md`'s "Periodic
maintenance" section for the pruning discipline this followed.

---

## 2026-08-12

- **`attempt-tortilla.ts` (write the attempt as a script, run it, let it
  fail where it actually fails) found two real, previously-invisible
  vocabulary gaps**: no verb merges two instances into one (blocked
  potato+egg → tortilla mixture, the third time this exact gap blocked a
  real recipe), and no `FLIP` verb existed. `FLIP` needed zero schema
  change (fit the existing single-target `addsTag` shape exactly);
  `COMBINE` needed real new mechanism: `requiredSecondaryCapability`
  (distinct from `requiredIngredientCapabilities` — presence-check vs.
  consume-and-replace are genuinely different operations) and
  `combinesInto` (mutually exclusive with `transformedState`).
- **Runtime-assigned spawned instance ids (`entityId-N`, a global counter
  across the whole run) cannot be predicted by reading a recipe file —
  they have to be run to find out.** A first-draft recipe guessed
  `egg_cracked-1`; the real id was `egg_cracked-3` (an earlier step's
  byproducts ate counters 1–2 first). `validate.ts` doesn't simulate a
  run, so it can't catch a wrong guess here — only actually running the
  recipe does.
- **Not every safety shortfall deserves the same `advisoryOnly`
  treatment, and the CCP author has to make that call per-hazard, not
  default every CCP to the same posture.** `egg_cooking.json` (active
  cooking, a runny yolk) is `advisoryOnly: true` — an FDA-recognized,
  disclosed-risk practice. `egg_pasteurization_raw.json` (raw egg with NO
  pasteurization step at all) is `advisoryOnly: false` in every
  `SafetyPolicy` mode — there's no "the diner knowingly accepted this"
  framing for silently skipping the one available mitigation.
- **A safety mechanism keyed to the wrong trigger action can leave a
  recipe with ZERO enforcement indefinitely.** `egg_cooking.json`'s CCP
  only checked on `FRY`/`SCRAMBLE`/`POACH`/`BOIL`; a raw-egg-yolk recipe
  that never cooks the yolk at all (alioli) silently never triggered it.
  Fixed by adding a genuinely different CCP (`PASTEURIZE`, a different
  point on the real time-temperature curve — low-temp, long-hold, stays
  raw) rather than a stricter version of the cooking one.
- **`if (seconds < threshold)` is `false` for `NaN`, not an error** — a
  comparison-based safety gate silently PASSES malformed/unparsed input
  unless it has its own explicit `Number.isNaN` guard; an implicit
  coupling to a different validated field elsewhere in the same function
  is not a substitute.
- **`ActionSchema`'s precondition/effect shape turns out to already be a
  STRIPS/PDDL-style planning-operator representation**, discovered by
  asking what a robot would actually need, not designed for it up front —
  every hand-authored `RecipeScript.sequence` is a human doing backward-
  chaining through that graph by hand. Reframes `CONCEPT.md` §12's
  goal-based-vs-linear-sequence fork: they're not competing formats, one
  is the compiled output of planning against the other's goal spec.
- **A dish name can be a false friend across languages**: "tortilla
  francesa" (Spanish: a flat, fully-cooked everyday omelette) and "French
  omelette" (the classical technique: baveuse, folded) are NOT the same
  dish. Missed until asked what a robot needs to make either "as asked" —
  the vocabulary could only express one outcome. Fixed with `yolkDoneness`/
  `edgeStyle`/`internalTexture` parameters and a `FOLD` action.
- **A composite entity built from an at-risk ingredient needs its OWN
  `criticalControlPointsByAction` — inheriting the ingredient doesn't
  inherit the safety wiring.** Found twice independently
  (`tortilla_mixture.json`, `handmade-alioli-egg-yolk.json`'s original
  version) by asking about a specific real dish, not by auditing in the
  abstract. A systematic sweep after the second instance (every cooking-
  capable entity × its CCP wiring) found zero further gaps — turned into a
  permanent `validate.ts` NOTE so this stays checked going forward.
- **Citing salt's sodium content surfaced a real, fixable 1.49% numeric
  error** (stored 38758mg/100g vs. the exact stoichiometric 39337mg/100g,
  computed from IUPAC atomic weights — table salt is pure NaCl, so this is
  exactly derivable, not an empirical figure with real biological
  variance). "Add a source" and "check the number is actually right"
  turned out to be different, complementary checks.
- **Implementing the real D-value/z-value thermal-death-time model (not
  two hand-picked anchor points) found a genuine, computable ~4x
  discrepancy between two existing egg-pasteurization CCPs** — both cite
  57°C, one requires 3900s (in-shell), the model predicts ~975s would
  suffice at 57°C for already-liquid egg (no shell heat-penetration lag).
  Once `egg_yolk` could be pasteurized directly, the alioli-with-egg-yolk
  wait dropped from 65 minutes to 3.5, backed by a real USDA-cited figure.
- **Auditing "is blind retry safe" for every action found one real bug**:
  `PEEL` neither `destroysTarget`s nor checks the target isn't already
  peeled, so a blind retry after an interruption spawns a SECOND,
  physically impossible `potato_peel` instance — the only `retrySafe:
  false` among 21 actions, found only by asking the question of every
  single one.

## 2026-08-13

- **A vague-sounding request ("robot simulator?") had two structurally
  different honest answers** (manipulation/physics tier vs. symbolic
  world-model tier) — the user's follow-up revealed they meant the
  second; re-searched rather than retrofitting the first answer. See
  `SIMULATION_TARGETS.md` for the sourced comparison.
- **`requiredIngredientCapabilities` (water for BOIL, salt for SALT) is
  structurally an EXISTENTIAL PDDL precondition, not an operator
  parameter** — confirmed by actually trying to translate `boil.json`
  into a PDDL operator. This repo's presence-only, non-consuming
  semantics matches PDDL's own `exists` shape exactly, without needing
  new machinery — a real pressure-test that the design was principled,
  not accidental.
- **Classical/STRIPS PDDL has no numeric fluents** — `thermal.ts`'s D/z-
  value hold-time math literally cannot be expressed without a numeric-
  capable planner variant (PDDL2.1/Metric-FF/ENHSP). No VirtualHome/AI2-
  THOR/ProcTHOR/OmniGibson built-in vocabulary models a CCP's accumulated
  thermal dose either (their "Cooked" is binary), and none has any
  concept of `CitationSchema`'s provenance/confidence layer.
- **A capability-diff audit script (every entity's asserted capability ×
  every action's capability-reference fields) found 5 hits; 4 of 5 were
  correctly-justified intentional gaps** (already had their own doc
  comments explaining why) — only `salt.json`'s `isDissolvable` had a bare
  `"todo"` instead of a justification, the real fix. A note that
  JUSTIFIES vs. a note that ADMITS is the actual signal for "leave it" vs.
  "fix it," not "the audit found it."
- **Resisted padding an audit's output for uniformity** — `BEAT`'s
  missing hazard was real (failed comparison against `MASH`, same manual/
  repetitive/utensil-in-hand shape); adding hazards to `WASH`/`SALT`/
  `PEPPER` "for symmetry" would have been dishonest padding, since nothing
  comparably risky-shaped exists for them.

## 2026-08-14

- **`place.ts`'s energy-balance approximation is one constant mid-range
  power/efficiency value for the whole heating interval** — checked to
  make sure `advanceHeatSeconds` reused this exact simplification rather
  than inventing a second, silently-different one for the same physical
  question.
- **A real ordering trap in a refactor was caught by tracing one specific
  existing test's failure MESSAGE, not just its pass/fail.** A naive
  `advanceHeatSeconds` → `advanceTempSeconds` wrapper resolved
  `boilingPointC` before checking place/entity match, breaking an
  existing "throws on mismatched entity" test's error content (wrong
  message, not wrong pass/fail) for the fixture with no `thermophysical`
  block at all. "Tests still pass" isn't proof of preserved behavior
  until failure-message content is checked too.
- **`requiredTools` matched by exact entity id with NO capability-based
  path, even though the identical distinction was already solved for
  ingredients (`requiredIngredientCapabilities`)** — the asymmetry was
  already named in `action.ts`'s own doc comment, just never carried to
  the tool side. Generalizing the MECHANISM (not widening one entity's
  capabilities to make one scenario pass) was the right reading of "make
  it generic" — proven by keeping the correct-rejection case (pan ≠ deep
  vessel) in the test, not discarding it.

## 2026-08-15

- **A second-version document (`frying-potatoes-science-v2.md`) arriving
  mid-task WITH a freshly-appended bibliography was itself the strongest
  evidence neither version should be trusted**: in-text bracket numbers
  ran past [560] with no scheme matching the six-item bibliography; one
  citation was a real paper about unrelated bacterial-growth kinetics,
  two were unrelated CS arXiv preprints (one literally titled about
  AI-generated citation verification — a strong signal the citations
  themselves were machine-generated), none plausibly sourced the
  document's actual numeric claims (38% oil reduction, 92% polyphenol
  loss). What DID survive independent checking: the Maillard reaction's
  ~140°C onset (`MAILLARD_REACTION_ONSET_TEMP_C`), the cold-oil-start
  technique (reported qualitatively, no percentage), and a free
  corroboration of `oil.json`'s existing specific-heat citation (within
  0.2%).
- **`garlic-oil-potatoes.json` fried garlic FIRST, then spent three more
  steps prepping potato while garlic sat in hot oil — the exact mistake a
  user-described real technique warns against** (burnt garlic turns
  bitter). No schema/engine check anywhere catches step-ORDER mistakes;
  this repo doesn't model elapsed idle time at all. Fixed by reordering
  (all potato prep before garlic touches oil) and reducing garlic's
  browning time from 400s to 240s (cited range's midpoint; 400s exceeded
  real guidance of 3-5 min and was independently long enough to explain
  "burnt, bad-tasting garlic" on its own).
- **`CLAUDE_DEV_CTX.md`'s own flagship `INVALID_TRANSITIONS` example
  ("cannot peel a potato that is already boiled") is factually wrong** —
  boil-in-jacket-then-peel is a real, common technique. It sat unchecked
  in three files since this repo's first commit, cited approvingly as
  "the worked example" for this exact feature, until the user caught it
  the moment it was finally enforced. Fixed by RETRACTION (every
  `potato.json` entry forbidding reversion to `"peeled"` removed
  outright), not softened — what survived (`mashed` forbidding any
  intact-piece state) is the one entry that's structurally, not
  conventionally, true. Re-auditing `egg.json` for the same class of
  error found no repeat, but did retract `sliced`/`diced`/`chopped`
  forbidding `boiled` anyway: its justification was "no counter-example
  found," the same weak evidentiary shape that was wrong for potato, even
  though no actual counter-example turned up this time.

## 2026-08-16

- **A fabricated cross-reference was caught before shipping by running
  the check that should have preceded writing the sentence**: a
  `REFERENCES.md` addition claimed a specific paper was "also
  independently the source cited elsewhere in this repo" for an unrelated
  discussion — invented mid-sentence, plausible-sounding, ungrounded.
  `grep`-checked, zero hits, removed.
- **A paper-derived ticket's own suggested test case was checked against
  the actual data before writing a line of code, and was wrong**: "mashed
  potato, which INVALID_TRANSITIONS should close off from fried" —
  `mashed → fried` is deliberately LEGAL (potato-cakes exception, closed
  2026-08-13). Used a different, verified dead end (`burned`) instead.
  The same reachability tool then reported something genuinely surprising
  (`mashed potato → "peeled"` reachable) — traced by hand rather than
  assumed to be a bug in the new code, and confirmed real: `potato.json`
  has no `"fried"` key in `invalidTransitions` at all. Deliberately did
  NOT patch this under the unrelated ticket's scope — a plausible one-line
  fix risked repeating the exact under-audited-closure mistake the
  original wrong claim was.
- **A user-supplied "tortilla thermal physics" document mixed real,
  correctly-quoted physics with fabricated repo-specific claims** — its
  Choi-Okos equations exactly reproduced this repo's own independently-
  verified figures (real); its "Metadatos Técnicos" section referenced a
  source file and a UI feature that don't exist anywhere in this repo
  (false). Being right about hard, checkable science is not evidence of
  being right about soft, repo-specific claims — different questions,
  different checks. The document's CENTRAL claim (a one-flip tortilla
  modeled as equivalent to symmetric-both-face heating for the whole
  duration) was subtly, physically wrong — a real flip is sequential
  (stage two starts from a non-uniform profile the model can't reuse
  fresh); the "4x faster" headline number was real arithmetic applied to
  the wrong physical scenario. Resolved by computing a real BRACKET
  (`scripts/tortilla-flip-physics-as-a-robot.ts`) instead of forcing a
  false-precision single answer.

## 2026-08-17

- **A 300-item "common sense cooking rules" document produced exactly 3
  actionable, real, cited gaps (~1% hit rate)** — steam-dry potato before
  mashing, calibrated pierce-before-baking risk, whole-vs-ground pepper
  shelf life. A second, differently-named but genuinely different
  document (physical-feasibility constraints, not domain facts) appeared
  mid-task — surfaced explicitly and asked about, rather than silently
  folded in or ignored; the first document's fully-verified work was
  committed immediately rather than blocked on that decision.
- **The pierce-before-baking rule was deliberately NOT added as a formal
  hazard entry**, even though a plausible one-line entry was easy to
  write — the same source cited elsewhere in this repo for potato facts
  describes the actual risk as rare, not routine; a formal entry would
  have overstated it.
- **The productive move for self-authoring common-sense rules (rather
  than triaging an external list) was reusing the exact "new action × old
  entity" seam** that had just found a real gap (rule #29, `DRAIN`'s
  missing `statePrerequisite`) — checking every entity against which
  NEWER actions it had gained a capability for found a second real
  instance (`potato.json`'s `REST`) in ~10 minutes, a much higher hit rate
  than either external-document triage, because the search targeted a
  known-productive pattern instead of reading unrelated claims.
- **A deeper structural gap was found by asking a different question**:
  not "is this entity's own `statePrerequisites` complete" but "does
  `applyAction` check `statePrerequisites` for every ROLE an instance can
  play." `requiredSecondaryCapability` was checked for capability only,
  never state — an asymmetry unaudited since it was first added
  (2026-08-12). Fixed at the engine layer (`checkStatePrerequisite`
  extracted, called for both roles), not per-data-file. Two existing
  metadata notes were found stale as a side effect (`onion.json`'s
  "enforced" claim was true only for the target, not the secondary;
  `egg_cracked.json`'s "can't be expressed" claim was already 2 days
  stale) — corrected both, not just the underlying code.
- **A formally-written ticket ("purge external identifier fields from
  core schema") described a problem that, on an exhaustive grep including
  `olddocs/`, did not exist anywhere in this repo.** The acceptance
  criterion ("grep yields no results") was trivially satisfiable by doing
  nothing — closed as already-satisfied rather than fabricating the
  fields just to have something to remove for a clean-looking diff, which
  would have misrepresented this repo's actual history.
