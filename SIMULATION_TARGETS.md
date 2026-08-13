# Simulation / robot-execution target research

Started 2026-08-13 in response to "do we have any simulator open source we
can use for the robot thingy?" followed by "like states and worlds, or game
frameworks where we can throw the cooking truth" — i.e. not a request for
physics/manipulation hardware-in-the-loop, but for a **symbolic world of
objects-with-states that actions transition**, matching this repo's own
`Entity`/`State`/`Action`/`Parameter` model as closely as possible. Research
and worked mapping only — **nothing here is built**. `ENGINE_INVARIANTS.md`
#11 still holds: a closed-loop control/perception layer is a separate,
larger piece of work, not implied by anything in this file.

## The five candidates, ranked by structural closeness to this repo's model

| # | Name | License | What it actually is | Rendering/physics | Closest OCR concept | Source |
|---|------|---------|----------------------|--------------------|----------------------|--------|
| 1 | **PDDL** (via [Fast Downward](https://www.fast-downward.org/)) | Open (GPLv3, Fast Downward) | A symbolic planning language: typed objects, predicates, operators with preconditions/effects. No world, no rendering. | None | `requiredTargetCapability`/`statePrerequisites` = preconditions; `transformedState`/`addsTag` = effects — almost a 1:1 structural match to `engine.ts` | [fast-downward.org](https://www.fast-downward.org/) |
| 2 | **VirtualHome** | Open source (research license) | Household activities as *programs*: sequences of `⟨action, object⟩` pairs mutating a graph of object states | Unity, rendered | `RecipeScript.sequence` mutating `Instance.state`/`tags` — closest "visual world" match | [arXiv:1806.07011](https://arxiv.org/abs/1806.07011) |
| 3 | **AI2-THOR / ProcTHOR** | Open source (Apache-2.0-family) | A literal game engine (Unity) with an object-state API (`Sliced`, `Cooked`, `Dirty`, `Filled`, `ToggledOn`, ...); ProcTHOR adds procedural scene generation (10k+ generated houses) | Unity, rendered, real physics | `possibleStates`/`possibleTags` vocabulary overlaps closely by name | [ai2thor.allenai.org](https://ai2thor.allenai.org/), [ProcTHOR NeurIPS'22](https://arxiv.org/pdf/2206.06994) |
| 4 | **OmniGibson / BEHAVIOR-1K** | MIT (code); NVIDIA Omniverse runtime | Physics sim with an explicit predicate-logic layer mapping simulator state to logic states (`Cooked`, `Soaked`, `Frozen`, `Sliced`, ...); BEHAVIOR-1K's 1,000 tasks are specified in **BDDL** (BEHAVIOR Domain Definition Language), a PDDL-flavored goal-state spec | NVIDIA Omniverse, photorealistic, heaviest install | `BDDL` goal-states ≈ `RecipeScriptSchema`'s target end-state, aimed at simulation goals rather than authored recipes | [github.com/StanfordVL/OmniGibson](https://github.com/StanfordVL/OmniGibson), [github.com/StanfordVL/BEHAVIOR-1K](https://github.com/StanfordVL/BEHAVIOR-1K), [iGibson 2.0 paper](https://arxiv.org/abs/2108.03272) |
| 5 | **RoboCasa(365)** | MIT | Kitchen-task manipulation benchmark (365 tasks, 2,500 kitchens, 3,200+ assets) built on robosuite + MuJoCo, for training/benchmarking an actual manipulator policy | MuJoCo physics, NVIDIA Omniverse rendering | None directly — this is the tier for *driving a real/simulated arm*, once there's an actuator to drive | [RoboCasa365 arXiv](https://arxiv.org/pdf/2603.04356), [lerobot docs](https://huggingface.co/docs/lerobot/main/en/robocasa) |

**Recommendation stands as given in conversation**: start at #1 (PDDL) —
costs almost nothing against what's already built and tells you something
real about whether the action graph is a *sound, solvable* planning domain.
VirtualHome (#2) is the better "make it visual" next step over AI2-THOR/
OmniGibson because its program-of-actions representation least fights
`RecipeScript`'s existing shape. RoboCasa (#5) is correctly a later-tier
concern — it answers "how does an arm execute this," not "is this world
model coherent," and this repo has no actuator layer to hand it to yet.

## Worked mapping: the six base ingredients this repo already has

Each row is the **existing, real OCR truth** (`data/entities/*.json`, as of
2026-08-13) next to how it would be expressed in each candidate's native
shape. This is a worked example proving the mapping is mechanical, not an
exhaustive re-encoding of every verb — one or two representative actions per
ingredient, the same "proven, not just asserted" discipline the rest of this
repo holds itself to (see `ROADMAP.md`'s capability-tests table).

| Ingredient | OCR truth (states / key capabilities / actions) | PDDL object + predicate | VirtualHome program line | AI2-THOR / OmniGibson object-state equivalent |
|---|---|---|---|---|
| **egg** (`egg.json`) | states: raw→boiled/fried/peeled/separated/cracked/poached; `isBoilable`, `isSimmerable`, `isPeelable`; CCP `egg_cooking` on fry/poach/boil/simmer | `(egg egg_1)`, `(state egg_1 raw)` → `(state egg_1 boiled)` | `[Boil] <egg_1> (1)` | `Cooked(egg_1) = True` |
| **potato** (`potato.json`) | states: raw→washed→peeled→(sliced/diced/...)→boiled/fried/baked/mashed; `statePrerequisites.cut: peeled` | `(potato p_1)`, precondition `(state p_1 peeled)` on the `cut` operator | `[Cut] <potato_1>` (preceded by `[Peel] <potato_1>`) | `Sliced(potato_1) = True`, requires `Peeled(potato_1) = True` first |
| **water** (`water.json`) | states: cold/boiling; `isBoilingMedium` — never itself a target, only the required co-present ingredient for BOIL/SIMMER/POACH | not an operand of the operator at all — an **existential precondition**: `(exists (?w - ingredient) (and (boiling-medium ?w) (present ?w)))` | not a program step — implicit scene state (a filled pot) | `Filled(pot_1, water)` — a container-fill predicate, not an object-state one |
| **oil** (`oil.json`) | states: cold/hot; tag `garlic_infused`; `isFryingMedium`/`isEmulsifier`/`isInfusable` — target of INFUSE, secondary-capability-provider for FRY/EMULSIFY | `(oil oil_1)`, effect of `infuse`: `(garlic-infused oil_1)` — a unary predicate, same shape whether the JSON action used `addsTag` or `transformedState` (PDDL doesn't distinguish the two; see note below) | `[PourInto] <garlic_1> <oil_1>` then `[Infuse] <oil_1>` | `Cooked(oil_1)`-adjacent — no native `Infused` state in any of these frameworks' built-in vocabularies; would need a custom predicate |
| **salt** (`salt.json`) | states: dry/wet/dissolved; `allowedTransformations: []` — salt is **never itself an action's target**, only the `isSaltySeasoning`-satisfying co-present ingredient for SALT | never appears as an operator's own object parameter — same existential-precondition shape as water above: `(exists (?s - ingredient) (salty-seasoning ?s))` | `[PutOn] <salt_1> <potato_1>` (VirtualHome models it as an object interaction even though OCR treats it as presence-only) | `Salted` isn't a built-in AI2-THOR/OmniGibson state at all — closest is a generic `Dirty`/`Covered`-style predicate repurposed |
| **garlic** (`garlic.json`) | states: raw→peeled→(cut shapes)→...→`coarse`/`fine_paste`→`emulsified`; `statePrerequisites`: `cut`/`crush` need `peeled`, `emulsify` needs `fine_paste` | `(garlic g_1)`; operator chain `peel: (state g_1 raw) → (state g_1 peeled)`, `crush: (state g_1 peeled) ∧ (fineness fine_paste) → (state g_1 fine_paste)`, `emulsify: (state g_1 fine_paste) ∧ (exists (?o) (emulsifier ?o)) → (state g_1 emulsified)` | `[Peel] <garlic_1>`, `[Crush] <garlic_1>`, `[Emulsify] <garlic_1> <oil_1>` | `Sliced`→no native `Emulsified`/`Crushed` predicate in AI2-THOR/OmniGibson's built-in vocabulary either — same custom-predicate gap as garlic-infused oil above |

### Two deeper worked examples

**BOIL, egg + water (cross-object precondition).** `boil.json`'s
`requiredIngredientCapabilities: ["isBoilingMedium"]` is not "water is an
input to this operator" the way `cut`'s target is — it's "some OTHER object
with this capability must merely be present," checked but never consumed
(`ROADMAP.md` Phase 4's own framing). This is exactly PDDL's `exists`
quantifier over a precondition, not an extra operator parameter — a real,
useful translation check: it confirms `requiredIngredientCapabilities` was
modeled as *presence*, not *consumption*, on purpose (see `engine.ts`'s own
doc comment), and PDDL's existing vocabulary already has the right shape for
it without inventing anything new.

**CRUSH → EMULSIFY, garlic + oil (secondary-capability chain).**
`garlic.json`'s `statePrerequisites.emulsify: "fine_paste"` plus
`emulsify.json`'s `requiredIngredientCapabilities: ["isEmulsifier"]`
(satisfied by `oil.json`) is a three-step PDDL operator chain: `peel` →
`crush` (parameterized by `fineness`, `outputs.transformedStateFromParameter`
— PDDL handles this as one operator per `fineness` value, since PDDL
preconditions/effects are typically fixed per operator, not parameter-valued
the way `action.ts`'s schema allows) → `emulsify`, gated on both garlic's own
state AND oil's independent presence. Confirms the multi-ingredient,
multi-precondition shape this repo already has (target capability +
ingredient capability + tool) maps onto PDDL's standard multi-precondition
operators with no structural surprises.

### What none of these five actually capture (stated precisely, not implied)

- **HACCP/CCP numeric time-temperature reasoning** (`thermal.ts`'s D/z-value
  model, `egg_cooking.json`'s `heldSeconds`/`heldC`). Classical/STRIPS PDDL
  (what Fast Downward runs by default) has no numeric fluents at all —
  representing a real hold-time-vs-temperature tradeoff needs PDDL2.1
  durative actions/numeric fluents and a numeric-capable planner (e.g.
  Metric-FF, ENHSP), not vanilla Fast Downward. None of the four
  world/game-engine options (VirtualHome/AI2-THOR/ProcTHOR/OmniGibson) model
  pathogen kill-time either — their `Cooked` predicate is binary, not a
  function of an accumulated thermal dose the way this repo's CCP check
  actually is.
- **Citations and confidence levels** (`CitationSchema`, every
  `source`/`confidence` field in this repo). No research artifact in this
  comparison has any concept of "how sure are we this number is right" — that
  provenance layer is unique to this repo's own schema, not something any of
  these five frameworks would preserve on import.
- **The heat-as-a-shared-place gap** (`ROADMAP.md`'s "Heat as a shared,
  time-varying property of a PLACE" entry, raised the same day as this file).
  Interestingly, AI2-THOR/OmniGibson's own container-fill / object-state
  model (`Filled(pot_1, water)`, heat sources as toggleable objects) is
  actually closer to solving this than this repo's current engine is — worth
  revisiting if that gap is ever picked up for real, since one of these five
  candidates may already have solved the exact modeling problem rather than
  needing it built from scratch.

## Status

Research and worked mapping only. No PDDL files, VirtualHome programs, or
simulator integration exist in this repo as of this writing — see
`ROADMAP.md`'s satellite-projects area for where an actual build-out would
be scoped, and `ENGINE_INVARIANTS.md` #11 for why that's deliberately not
this session's work.
