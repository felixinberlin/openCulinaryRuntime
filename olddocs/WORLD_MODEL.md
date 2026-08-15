# WORLD_MODEL.md — resolving CONCEPT.md's flagged fork

`CONCEPT.md`'s own opening line has said this since the file was written: "has
**not** been reconciled with `CLAUDE_DEV_CTX.md` ... which build around a linear
step-sequence recipe model that this outline explicitly argues against (see §12)
... Treat the two as parallel design tracks until that's resolved." Every piece of
engine work this whole session (`Action`, `Entity`, `RecipeScript`, `engine.ts`)
was built on the linear-sequence side of that fork. This document is the
resolution, prompted directly by being asked to think about recipe format and
domain-knowledge rules from a robot's actual point of view — which turns out to
answer the fork question too: **the world (objects undergoing continuous physical
and chemical transformation) is the primary representation; a recipe is one layer
of intent on top of it, not the core.**

## The good news: this doesn't throw away the session's work

`ActionSchema` (`action.ts`) is, structurally, already a classical AI-planning
operator — preconditions and effects, the STRIPS/PDDL shape — without ever having
been driven that way:

- **Preconditions**: `requiredTargetCapability`, `requiredTools`,
  `requiredIngredientCapabilities`, `requiredSecondaryCapability`,
  `statePrerequisites` (on the entity).
- **Effects**: `outputs.transformedState`/`transformedStateFromParameter`,
  `addsTag`, `spawnsTargetByproducts`, `destroysTarget`, `combinesInto`.

Every `RecipeScript.sequence` authored this session (`salted-fried-potatoes.json`,
both alioli variants, `garlic-oil-potatoes.json`, `tortilla-de-patatas.json`) is a
**hand-computed plan** — me doing backward-chaining from a goal ("a finished
tortilla") through this precondition/effect graph, by hand, one JSON file at a
time. That's exactly the job a planner automates. Nothing about `Entity`/`Action`/
`engine.ts`'s `applyAction` needs to be rebuilt for this — they become the
**domain model a planner searches over**, and a completed run's `log`
(`recipe-runner.ts` already produces one) becomes the **grounded trace/timeline**
CONCEPT.md §11 describes (undo/redo, playback, "ghost cooking," robot replay — all
"come for free from the event log," per that section, once there IS a log of a
real planned-and-executed run rather than a hand-authored script).

## What changes

### 1. Recipes become goal specifications, not scripts

`RecipeScriptSchema` (`recipe.ts`) — `initialInventory` + a fixed, ordered
`sequence` — is CONCEPT.md §12's rejected shape:

```
Step 1
Step 2
Step 3
```

What §12 actually asks for — Goals, Constraints, Required Ingredients, Acceptable
States, Serving, Optional Variants, Tolerance, Victory Conditions — is a
**declarative end-state predicate**, e.g. (sketch, not a committed schema):

```
goal: { entityId: "tortilla_mixture", state: "fried", tags: ["flipped"] }
constraints: [ "never exceed any non-advisory CCP", "onion-free" ]
requiredCapabilitiesAvailable: ["isCombinableBase", "isCombinableAddition", ...]
tolerance: { durationSeconds: { target: 900, acceptable: [700, 1100] } }
```

`RecipeScript` doesn't disappear — it becomes the **output** of planning against a
goal like this, not the input a person writes by hand. Today's `data/recipes/*.json`
files are best read, going forward, as **worked example plans** a planner should
be able to reproduce (or improve on) given the same goal and the same domain model,
not as the canonical authoring format.

### 2. Closed-loop execution, not "continue past the first failure"

`recipe-runner.ts`'s current behavior — a step's failure is logged and the run
*continues to the next step regardless* — is explicitly correct for what it was
built for: offline validation, "collect every problem, then report." **It would be
actively dangerous if reused verbatim to drive a real robot.** If `PEEL` fails, a
robot blindly proceeding to `CUT` is now cutting something that may not be
peeled, or may not be where the plan assumed — a physical hazard, not a logged
error. A robot execution mode needs to, at minimum, halt and replan (or trigger an
explicit recovery routine) on a step failure, not fall through to the next
pre-baked step. This is a real, load-bearing distinction between "validate a
recipe file" and "drive a robot," and the current single execution path
conflates them.

### 3. Discrete `state` is a derived classification of continuous reality, not the primitive

`Instance.state` (`"raw"`, `"fried"`, ...) is a label. A real robot's actual
sensed reality is continuous: surface temperature over time, moisture loss,
degree of protein denaturation, browning (Maillard reaction progression). The CCP
mechanism already does exactly this kind of thing in miniature — `heldSeconds` at
`heldC` is a *threshold classification* over an underlying continuous
time-temperature process, expressed as structured, checkable data. **The honest,
correctly-scoped generalization is NOT "simulate the continuous physics" — that
was explicitly, correctly rejected before** (the fabricated original `CLAUDE.md`
this project's real one replaced invented a nonexistent "finite-difference heat
simulation," and `ENGINE_INVARIANTS.md` #11 already draws this line for the
autonomous-execution case). The right scope: OCR's job is to define **what the
discrete label means** — the sensor-checkable predicate over continuous variables
that constitutes "fried" — as structured, queryable data (a `VerificationCriterion`
per state transition, generalizing the CCP pattern), and leave *measuring* those
continuous variables to a real sensing/control layer this repo doesn't and
shouldn't contain.

### 4. Domain knowledge as queryable data, not prose for a human reviewer

Look at what's actually in this repo's `metadata.notes` fields today: egg white/
yolk coagulation ranges (`egg_cooking.json`), why poaching water shouldn't fully
boil (`poach.json`), why garlic burns bitter past a threshold (`infuse.json`), why
an emulsion breaks when oil is added too fast (`emulsify.json`) — genuinely
correct, well-sourced domain knowledge. **All of it is prose, written for a human
code reviewer, not data a robot's own planner/verifier could query at runtime.**
If a robot needed "what's the safe temperature range for keeping egg yolk raw" at
decision time, the only place that lives right now is an English paragraph — and
having anything *interpret that paragraph* at runtime (an LLM, most obviously)
to extract a safety-critical number is exactly the failure mode
`ENGINE_INVARIANTS.md` #10 and CONCEPT.md §16 already forbid ("LLMs are never
authoritative... never decide validation rules"). The fix is structural: a
`DomainFact`/`PhysicalProperty` schema — typed value, unit, confidence/source,
`verified: boolean` — sitting *alongside* the prose (which stays, for humans),
not replacing it. `egg_cooking.json`'s buried `metadata.coagulationReferenceC`
object is the right instinct, already present, just not yet a first-class,
consistently-used pattern across the rest of this repo's domain knowledge.

## What I'm explicitly NOT proposing

- **Not** a continuous physics/heat-transfer simulator. Correctly out of scope,
  same reasoning as `ENGINE_INVARIANTS.md` #11 and the rejection of the
  fabricated earlier `CLAUDE.md`'s invented physics-engine framing.
- **Not** an immediate rewrite of `RecipeScriptSchema`/`recipe-runner.ts`/every
  existing `data/recipes/*.json` file. They're correct and useful as-is for what
  they currently do (validated, runnable, hand-authored plans) — this document
  proposes a NEW layer (goal specs + a planner) sitting on top / upstream of them,
  not a replacement built under time pressure inside an already-large session.
- **Not** a claim that a planner is a small addition. Real automated planning
  (search over a precondition/effect graph, handling partial observability,
  replanning on failure) is substantial, separate work — bigger than everything
  built this session combined. Flagged as a real future phase, not undersold.

## Status

Proposal / direction, not implemented. `CONCEPT.md`'s top-of-file fork note and
§12 are updated to point here as the resolution — the fork itself (goal-based vs.
linear-sequence) is resolved in favor of the goal-based/event-sourced track being
primary, with the linear-sequence machinery already built kept as the planner's
target representation and a completed run's trace format, not discarded.
