# LEARNINGS.md

A dated, append-only log of concrete things learned while building this engine —
patterns, gotchas, and *why* a design choice was made, not a changelog of *what*
files changed (that's `git log`). Read this before starting new work in this repo;
append a new dated entry when you learn something that would've saved you time if
you'd known it going in. Don't rewrite or delete old entries — append.

---

## 2026-08-12

### Schema/engine constraints that shape everything downstream

- **`ActionOutputsSchema` supports exactly one of `transformedState` (fixed) or
  `transformedStateFromParameter` (fully parameter-driven) — never "fixed by
  default, overridable per call."** This blocked giving garlic's FRY a real
  `"browned"` state without breaking every potato/egg caller that doesn't pass a
  doneness param (`transformedStateFromParameter` throws if its param is
  missing, `required: false` or not). Resolution used twice: keep the nuance as
  an **informational, non-state-determining parameter** instead of inventing a
  default-value mechanism. The alternative — splitting a dedicated verb, the way
  `SCRAMBLE` was split from `FRY` and `POACH` from `BOIL` — is the other valid
  escape hatch when the outcome genuinely differs enough to earn its own verb.
- **`requiredIngredientCapabilities` checks presence via the ingredient's
  *entity* definition only — never the ingredient *instance's* current
  state.** A whole raw garlic clove and knife-minced garlic both satisfy
  `isAromaticSource` identically. Real technique cares about surface area /
  rupture; the engine can't currently express that. Flagged in `infuse.json` as
  a known, pre-existing gap, not something new.
- **`byproductsByAction` (entity-level, keyed by action id) exists because a flat
  `producedByproducts` list breaks the moment one entity has *two* different
  `spawnsTargetByproducts` actions with different outputs** (egg: `PEEL` → shell
  only, `SEPARATE`/`CRACK` → shell + yolk/white or shell + cracked). Any new
  entity with more than one spawning action needs this, not the flat list.
- **`destroysTarget` actions still populate `ExecutionResult.instance`** — it's
  the target's state the instant before removal, kept for logging. The caller
  (`recipe-runner.ts`) must `inventory.delete(...)`, not `inventory.set(...)`,
  when `result.destroyed` is true. A demo script bug (`cook-egg-many-ways.ts`
  first draft) chained off `.instance` after `CRACK` instead of `.spawned` —
  caught by actually running the script, not by reading the code.

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

### Recipe-level patterns

- **A finished "dish" (alioli, salted fried potatoes) is represented by a
  `RecipeScript`'s own `names` field, not a new composite entity** —
  `EntitySchema.structure.composite/components` exists but nothing populates it
  yet. Assembling multiple finished instances into one composite dish (a salad
  from reused fried garlic + other components) is a genuinely unbuilt feature
  (no `ASSEMBLE`-style verb, no merge-instances mechanic) — flagged as an open
  extension in `garlic-oil-potatoes.json` rather than faked with a hollow
  composite entity that's really just one ingredient under a new id.
- **Ingredients are never consumed/decremented by `requiredIngredientCapabilities`
  checks — only checked for presence.** This is a documented limitation
  (`engine.ts`'s own doc comment), but it's also what makes "the same oil
  instance flavors garlic, then fries a potato two steps later" work for free —
  a limitation and a convenience at the same time, worth knowing both sides of.
- **Two recipes meant to be compared side-by-side** (`handmade-alioli.json` vs.
  `handmade-alioli-egg-yolk.json`) **should share every step up to the point
  they actually diverge, using identical parameter ids/units so the diff is
  literal, not narrated.** Cross-reference both directions in `metadata` since
  `RecipeScriptSchema` has no formal "variant of" field.

### Process

- **After any `engine.ts`/schema change: re-run every existing demo script +
  every recipe + `tsc -p . --noEmit`, not just the new thing.** Caught two real
  regressions this session this way (the `CRACK`/`.spawned` bug, the CCP-gating
  bug) that a narrower check would have missed.
- **`tsc` reports pre-existing `TS5097` (import-extension) errors across nearly
  every file in this repo, unrelated to any change made here.** Filter with
  `grep -v TS5097` when checking for *new* type errors, or the noise drowns
  the signal.
- **Cite sources for numeric claims that could be quietly wrong** (USDA/FDA
  URLs and section numbers in `data/ccps/egg_cooking.json`, not just a bare
  number) — and state explicitly when a figure is a simplification of a richer
  real table (the Food Code's actual multi-point curve vs. this schema's
  two-point model), rather than implying more precision than was verified.
- **"Can the vocabulary make dish X end-to-end" is a better progress signal than
  phase checkboxes, and it's empirically checkable — write the attempt as a
  script, run it, let it fail where it actually fails.** `attempt-tortilla.ts`
  proved two real, previously-only-implicit gaps this way: no verb combines two
  separate instances into one (blocks potato+egg → tortilla mixture, same root
  cause as the earlier "salad" gap in `garlic-oil-potatoes.json` — this is now
  the third time it's blocked a real recipe, promoted to the top of
  `ROADMAP.md` Phase 4 because of that), and no `FLIP` verb exists at all for
  the single most technique-defining step of the dish. Neither gap is about
  robot control/perception (`ENGINE_INVARIANTS.md` #11) — the vocabulary itself
  stops short before physical execution is even the question. Worth
  re-attempting a new real dish periodically specifically to surface the next
  missing verb, rather than guessing at what to build speculatively.
- **Both gaps above are now closed — `COMBINE` needed a genuine new engine
  mechanism, `FLIP` didn't.** `FLIP` fit the existing single-target action
  shape exactly (`addsTag`, same as `SALT`) — no schema/engine change at all,
  pure data. `COMBINE` couldn't: `applyAction` only ever took one target
  instance, and every existing "second ingredient" mechanism
  (`requiredIngredientCapabilities`) explicitly only checks *presence*, never
  consumes anything (that limitation is stated in `ROADMAP.md` Phase 4 itself).
  Merging two real instances into a new one needed: a second required-capability
  slot on the action (`requiredSecondaryCapability`, distinct from
  `requiredIngredientCapabilities` on purpose — presence-check vs.
  consume-and-replace are genuinely different operations, not degrees of the
  same one), a new output shape (`combinesInto`, mutually exclusive with
  `transformedState`/`transformedStateFromParameter` — there's no "resulting
  state" on an instance being replaced by a different entity), and a second
  destroyed-flag (`secondaryDestroyed`) so `recipe-runner.ts` knows to remove
  the secondary instance too. All of it optional/unset by default, so every
  action defined before this stayed completely unaffected — verified by full
  regression, same discipline as every other engine change this session.
- **Runtime-assigned spawned instance IDs (`entityId-N`, global counter across
  the whole run) can't be predicted by reading a recipe file — they have to be
  run to find out.** First draft of `tortilla-de-patatas.json` guessed
  `egg_cracked-1`; the actual ID was `egg_cracked-3` (CRACK's own
  `["egg_shell", "egg_cracked"]` byproduct order, after `potato_peel-1` from an
  earlier step, ate counters 1 and 2 first). `validate.ts` can't catch this —
  it explicitly doesn't simulate a run, just logs a NOTE for any
  `targetInstanceId`/`secondaryInstanceId` not in `initialInventory`. Running
  the recipe and reading the actual log is the only real check.
