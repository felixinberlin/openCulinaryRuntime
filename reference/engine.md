# `src/engine.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

Minimal execution engine — applies one canonical Action to one instance.

This is a stepping stone toward ROADMAP.md Phase 4's full
`OcrValidationEngine` (HACCP, an ordered recipe sequence — still not a
dedicated class here, `applyAction` covers the same ground as a plain
function). It checks: the target entity's capability, required tools being
on hand, `Entity.statePrerequisites` (a narrower per-action "must already
be in this state first" precondition, e.g. potato.json: cut requires
"peeled"), the action's declared `parameters` (e.g. CUT's "shape"),
`requiredIngredientCapabilities` (e.g. FRY needs some available ingredient
with isFryingMedium, like oil), and — closed 2026-08-15,
`Entity.invalidTransitions` (ingredient.ts) — arbitrary forbidden state
transitions in general (e.g. potato.json now genuinely stops mashed potato
from reverting to a pre-mash state — see that field's own doc comment for
why it's keyed per-entity rather than the one global matrix
CLAUDE_DEV_CTX.md's literal example shows, AND for a real mistake this
field caught in its own first draft, worth reading before trusting any
single example in this codebase over checking real technique). It also
only checks that a qualifying ingredient is *present*, not consume/
decrement it — real quantity tracking belongs to Phase 4's recipe-level
inventory.

`state` and `tags` are deliberately separate: `state` is the one
mutually-exclusive form/cooking-method value (raw/washed/.../boiled/
fried/...), while `tags` holds any number of orthogonal properties (e.g.
"salted") that coexist with whatever the current state is — see
`ActionOutputsSchema.addsTag` in action.ts.

`ExecutionResult.destroyed` (driven by `action.outputs.destroysTarget`) is
the conservation-of-mass case CLAUDE_DEV_CTX.md and ROADMAP.md Phase 4
call out: e.g. SEPARATE on an egg — the caller (recipe-runner.ts) must
drop the target from inventory instead of writing `instance` back, while
still spawning `spawned` in its place. This engine only implements that
for a single explicit action's target; it is not the general "decrement
quantities against an arbitrary inventory" system Phase 4 ultimately
wants.

`secondaryInstance` / `ExecutionResult.secondaryDestroyed` (ROADMAP.md
Phase 4, "multi-instance composition" — added once the tortilla
capability test proved it necessary, see LEARNINGS_PROCESS.md
2026-08-12): a COMBINE-shaped action (`action.requiredSecondaryCapability`
set) merges a SECOND instance into the result, not just the primary
target — e.g. fried potato + beaten egg -> tortilla_mixture. Both the
primary target and `secondaryInstance` are destroyed; one new instance of
`action.outputs.combinesInto` is spawned in `spawned`, same array
`spawnsTargetByproducts` already uses. `secondaryInstance` is optional and
`requiredSecondaryCapability` defaults unset, so every action that doesn't
declare it — i.e. everything before this addition — is completely
unaffected.

### HACCP (ROADMAP.md Phase 2/4, thermal.ts)

If the target entity names a CriticalControlPoint for this action
(`criticalControlPointsByAction`, ingredient.ts) and the step supplied a
"durationSeconds" parameter, that duration is checked against the CCP's
`heldSeconds`. This engine does NOT simulate heat transfer — it has no
model of the actual internal temperature reached, only the declared cook
time. The check therefore rests on an explicit, stated assumption: any
heat level a cook would plausibly use for this action (a hot pan,
simmering water) is already well above the CCP's `heldC` floor, so
elapsed time is the binding constraint, not temperature. That assumption
is only reasonable for thin, fast-heating preparations (a fried/poached/
scrambled egg, a few millimeters through) where the coldest point still
heats quickly — it would NOT hold for a thick dish (a baked egg
casserole) where the center can lag the surface by minutes; nothing here
should be reused for that case without revisiting this assumption first.

A shortfall throws unless the CCP is `advisoryOnly`, in which case it's
appended to `ExecutionResult.warnings` instead — the FDA Food Code's
actual "increased risk, permitted with disclosure" posture for e.g. a
runny egg yolk, not a hard ban — UNLESS `policy.mode === "autonomous"`
(SafetyPolicy, below), where an unoverridden advisory is *also* a hard
reject: CONCEPT.md §17 says a robot drives the same event timeline as a
human, same API, but "same API" cannot mean "same default judgment call"
when there is no human to make it. "human" (the default) preserves the
original warn-and-continue behavior unchanged for every existing caller.

CONCEPT.md §17 also means every categorical "informational only, not
enforced" parameter this codebase has accumulated (fry.json's heatLevel/
agitation/doneness, scramble.json's curdSize, emulsify.json's
oilAdditionRate, poach.json's waterTempC, ...) needs to be read correctly
for what it actually is: a human-readable technique hint, NOT a
calibrated robot control setpoint. "heatLevel: high" has no defined
mapping to an actual actuator command — a controller that invented one
unilaterally would itself be a safety problem, not a solution to one.
Autonomous execution of any of this would need a real translation/
control/perception layer (closed-loop temperature control, computer
vision for "golden" vs "brown", force feedback for CRUSH's fineness,
physical proximity/hazard sensing for a knife or a hot pan near a person)
that does not exist in this repo. SafetyPolicy's "autonomous" mode only
changes what happens to a stated HACCP time threshold — it does NOT mean
the rest of this engine is robot-ready. Flagged here deliberately rather
than letting "autonomous mode exists now" imply more than it does.

## `SafetyPolicy`

Execution policy for who's actually driving — CONCEPT.md §17: a robot
"consumes/drives the same event timeline a human session would," same
API, but that can't mean same DEFAULT for a safety shortfall. An
advisoryOnly CCP shortfall (thermal.ts) warns-and-continues under "human"
— the existing default, and the right one when a person is present to
judge a runny yolk for themselves. Under "autonomous" (a robot with no
human directly supervising this step), the same shortfall is a hard
reject by default: no judgment call to defer to. It only proceeds if the
specific CCP id is in `humanOverrides` — an explicit, prior authorization
(e.g. a diner ordered a soft yolk knowingly), not a blanket "trust the
robot" switch. Defaults to "human" so every existing caller's behavior is
unchanged unless it opts in.

## `ExecutionResult`

- `instance`: The target's state/tags right before this action finished — still populated even when `destroyed` is true, for logging purposes; the caller must not write it back into inventory in that case.
- `destroyed`: True when `action.outputs.destroysTarget` fired: the caller must remove the target from inventory rather than keep `instance`.
- `secondaryDestroyed`: True when a secondary instance (COMBINE-shaped action) was consumed — the caller must remove IT from inventory too, same as `destroyed` for the primary target. Always false when the action has no requiredSecondaryCapability.
- `warnings`: Non-fatal HACCP notices (see the CCP section above) — e.g. a duration below an advisoryOnly CCP's heldSeconds. Empty when no CCP applies or the threshold was met.
- `matchedIngredientInstanceId`: The specific `availableIngredients` instance id that satisfied `action.requiredIngredientCapabilityFromParameter` (SEASON generalization, 2026-08-17) — `undefined` when the action has no such field (the overwhelming majority). The real, additional thing this offers over the static `requiredIngredientCapabilities` list: WHICH instance matched, not just that some qualifying one existed — see that field's own doc comment (action.ts) for why. Still checked for presence only, same limit as every other ingredient-capability check in this engine — not consumed/decremented from inventory.

## `checkStatePrerequisite`

Shared by both the primary target and (added 2026-08-17) the secondary
instance of a COMBINE-shaped action — `role` only affects the error
message's wording, the check itself is identical either way: does
`entity.statePrerequisites[action.id]` (if any) allow this instance's
current state/tags. Extracted from what used to be inline-only logic in
`applyAction` when the secondary-instance gap was found and fixed;
behavior for the primary/target call site is completely unchanged.

A single required state is treated as a one-element allowed set, so this
branch's behavior/error message is unchanged for every statePrerequisites
entry written before array values existed (ingredient.ts's own doc
comment) — only a genuinely multi-valued entry (e.g. potato.json's cut:
["washed", "peeled"]) takes the OR path.

Each allowed entry is checked against EITHER `instance.state` OR
`instance.tags` (added 2026-08-15, potato.json's "cut"/"grate": ["washed",
"peeled"] being the forcing case): "washed" used to be modeled as a STATE
(WASH's outputs.transformedState), which meant washing a potato and then
peeling it silently overwrote away the fact it had ever been washed —
`state` is documented as the one mutually-exclusive value an instance
holds, so "washed" and "peeled" could never both be true of the same
instance at once even though physically they obviously can. WASH now sets
a TAG instead (see wash.json), matching SALT/PEPPER/etc.'s existing
addsTag pattern — an orthogonal fact that survives whatever state comes
next. This check treating state-prerequisite entries as satisfiable by a
matching tag, not just a matching state, is what keeps that precondition
meaningful now that "washed" isn't a state value anymore; every entry
that names an actual state (the overwhelming majority) is completely
unaffected, since instance.state is still checked first/either way.

## `applyAction`

### Secondary-capability check (`requiredSecondaryCapability`)

Added 2026-08-17, self-authored common-sense audit (LEARNINGS_PROCESS.md
this date): `requiredSecondaryCapability` is a static, state-independent
boolean (onion.json asserts isCombinableWithPotato regardless of whether
that onion instance is raw and whole or peeled and sliced), so before this
fix nothing stopped COMBINE_POTATO_ONION from accepting a never-prepped
secondary onion — the identical class of gap statePrerequisites already
closes for the PRIMARY target, just never extended to the secondary
instance. Reuses the exact same statePrerequisites map/lookup-by-action-id
mechanism, not a new field — safe because no entity used here as a
SECONDARY (onion.json, egg_cracked.json) is ever the PRIMARY target of the
same action id, so there is no ambiguity about which role a given entry
describes.

### Capability-based tool check

The substitutable sibling of the exact-id `requiredTools` loop, mirroring
`requiredIngredientCapabilities`'s own logic exactly (any available tool
asserting the capability satisfies it, not one hardcoded id). See
action.ts's `requiredToolCapabilities` doc comment.

### `requiredIngredientCapabilityFromParameter`

2026-08-17, SEASON generalization, action.ts's own doc comment — the
required capability is looked up from the ACTUAL value supplied for the
named parameter, not a fixed list. Deliberately checked BEFORE the
generic parameter validation loop below it: a malformed/unrecognized
parameter value here gets ITS OWN clear error (naming the specific
missing mapping) rather than falling through to the generic allowedValues
rejection, even though the loop below would also eventually reject it —
this fails faster and with a more specific message. Unlike the static
loop above, this ALSO records WHICH instance id satisfied it — the real,
additional capability a fixed list cannot offer, since a fixed list never
varies per-call in the first place.

### Forbidden-transition check

ROADMAP.md Phase 4, ingredient.ts's `invalidTransitions` doc comment for
the full reasoning — runs against the COMPUTED nextState, not the action
id, so it also catches a parameter-driven output (CUT's shape). A no-op
transition (nextState === instance.state, e.g. an addsTag-only action
like SALT) can never trip this, since no author would list a state as
forbidden from itself. Deliberately checked here, after every
precondition above has already passed — this is a distinct concern (is
the RESULT physically sane) from "may this action even start," not a
replacement for it.

### `addsTagFromParameter` handling

Mirrors `transformedStateFromParameter`'s own param-lookup, adapted for a
VALUE-TO-TAG map rather than a raw passthrough — see action.ts's
`addsTagFromParameter` doc comment for why. The `refine()` on
`ActionOutputsSchema` already guarantees `addsTag`/`addsTagFromParameter`
never coexist, so this is a real else-branch, not an overlapping check.

### Byproduct spawning (`spawnsTargetByproducts`)

Byproducts are pieces of the SAME original substance (egg -> egg_yolk/
white/shell) — a whole-substance safety property like "pasteurized"
legitimately carries to every piece, conservation-of-mass style. Filtered
against the byproduct entity's own possibleTags so nothing nonsensical
leaks through (e.g. a spawned potato_peel never declares "flipped" as
valid, so it can't inherit it even if the parent somehow had it).

### `combinesInto` handling

Merge tags from BOTH instances being combined — e.g. a salted beaten egg
combined with plain fried potato should leave the resulting
tortilla_mixture "salted" too. Same possibleTags filter as byproducts.
`combinesInto` implies both instances are gone, same conservation-of-mass
logic as `destroysTarget` but for two instances at once — see
`ActionOutputsSchema.combinesInto`'s doc comment (action.ts).

### CCP duration check

Gated on `durationSeconds` actually being supplied, not merely on the
target having a `criticalControlPointsByAction` entry: `durationSeconds`
is an optional parameter, and CCP checking is opt-in along with it. A
caller that never passes a duration (or never loads/passes `ccps` at all)
sees zero behavior change — this must stay true for every pre-existing
call site that fries/pokes an egg without caring about HACCP timing.

Self-defending against malformed input, not just relying on the
`parameters[]` loop above having already validated `durationSeconds` as a
numericRange param: `NaN < ccp.heldSeconds` is FALSE in JS, so without
this guard a garbled duration would silently SKIP the safety check
entirely rather than fail it — the exact failure mode this whole
mechanism exists to prevent. That the parameters loop currently always
catches this first (every CCP-linked action declares durationSeconds
formally) is a convention, not an enforced invariant; this check must not
depend on that convention holding.

If this CCP has a real, computable thermal model AND the step supplied an
actual temperature (waterTempC), the required hold time is computed at
THAT exact temperature instead of only ever checking against the one
fixed heldC/heldSeconds anchor — see `ThermalInactivationModelSchema`'s
doc comment (thermal.ts) for the real D/z-value math and its validity
condition.

The autonomous/advisory branch: `autonomous, not overridden` — an
advisory a human could judge for themselves has no judge here, so the
safe default is reject — see `SafetyPolicy`'s doc comment above.
