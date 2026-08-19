# Open Culinary Runtime (OCR)

**Recipes as code, not prose.** An ingredient is a typed entity with real
physical properties. Cooking it is a state transition, not a sentence. A
recipe is a script that actually *runs* — and can refuse to run if it's
unsafe.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Zod](https://img.shields.io/badge/schema-zod-6b46c1)](https://zod.dev/)

---

## This is not a recipe database

It's an **Entity-Component-System for cooking**. `potato` isn't a string
in a JSON blob of ingredient names — it's an entity with a real thermal
conductivity, a set of physically-reachable states, and a table of
transitions that are *forbidden* because they're not physically possible
(you cannot `PEEL` something you've already `MASH`ed — there's no
discrete skin left for a knife to act on). `PEEL` isn't a step in a
paragraph — it's an action with required tools, a required capability on
its target, and a declared output that spawns real *byproducts*
(`potato` → `PEEL` → `potato` (peeled) + `potato_peel`, mass conserved).

Run a recipe and you get a real execution trace, not a checklist:

```
$ npm run recipe -- tortilla_de_patatas

Running "Spanish Tortilla (sin cebolla)"
WASH potato-1: state "raw" -> "raw", tags [washed]
PEEL potato-1: state "raw" -> "peeled", tags [washed]
  spawned potato_peel-1 (potato_peel, state: "raw")
CUT potato-1: state "peeled" -> "sliced", tags [washed]
FRY potato-1: state "sliced" -> "fried", tags [washed]
CRACK egg-1: state "raw" -> "cracked" (destroyed — conservation of mass)
  spawned egg_shell-2 (egg_shell, state: "raw")
  spawned egg_cracked-3 (egg_cracked, state: "raw")
BEAT egg_cracked-3: state "raw" -> "beaten"
SALT egg_cracked-3: state "beaten" -> "beaten", tags [salted]
COMBINE potato-1: state "fried" -> "fried" (destroyed — conservation of mass)
  consumed secondary instance egg_cracked-3 (egg_cracked)
  spawned tortilla_mixture-4 (tortilla_mixture, state: "raw")
REST tortilla_mixture-4: state "raw" -> "raw", tags [salted,rested]
FRY tortilla_mixture-4: state "raw" -> "fried", tags [salted,rested]
FLIP tortilla_mixture-4: state "fried" -> "fried", tags [salted,rested,flipped]
FRY tortilla_mixture-4: state "fried" -> "fried", tags [salted,rested,flipped]

Final inventory:
  tortilla_mixture-4: tortilla_mixture, state "fried", tags [salted,rested,flipped]
```

Every line above is a real, typed state transition the engine computed —
not a template string. `potato-1` and `egg_cracked-3` are genuinely gone
from the final inventory; `tortilla_mixture-4` genuinely didn't exist
until `COMBINE` spawned it. Ask this same engine for a dish it can't
physically produce, and it tells you exactly why, instead of silently
producing garbage.

## It knows what's unsafe, and cites its source

This isn't a toy state machine — `FRY`/`BOIL`/`PASTEURIZE` are wired to a
real HACCP critical-control-point model, and every threshold traces to a
real source, not a guess. Some CCPs are a cited flat time/temperature
threshold (the case below); where a CCP defines a real thermal-death-time
model instead (D-value/z-value, the same math food-safety regulators
use), the engine *computes* the exact required hold time for whatever
temperature the recipe actually specifies, rather than checking against
one fixed anchor point (see `capability-test:execution-bounds` for that
computed case):

```
$ npm run recipe -- tortilla_de_betanzos

  WARNING: FRY on "tortilla_mixture": 12s is below "Egg cooking
  (Salmonella)"'s minimum hold of 15s at 63°C (or 71°C instantaneous)
  for Salmonella spp.. USDA FoodSafety.gov 'Safe Minimum Internal
  Temperature Chart' — https://www.foodsafety.gov/food-safety-charts/
  safe-minimum-internal-temperature. advisoryOnly: true because the FDA
  Food Code (§3-603.11) explicitly recognizes eggs cooked to order with
  a still-runny yolk as a permitted 'increased risk' practice requiring
  a consumer advisory, not a banned one.
```

Tortilla de Betanzos is *supposed* to have a liquid, barely-set center —
so the engine doesn't reject it, it warns, correctly distinguishing "a
known, disclosed risk a human can judge" (advisory) from "genuinely raw
egg that was never heated at all" (hard reject, no override, in
autonomous mode). That distinction — and the exact regulatory language
behind it — is real, cited data, not a hardcoded `if`.

## The four pillars

| Pillar | What it means | Concretely |
|---|---|---|
| **Entities** | Physical, reusable objects — ingredients vs. tools, modeled separately | `potato`, `egg`, `onion`, `chef-knife`, `pan` |
| **States** | Observable physical conditions | `raw` → `peeled` → `sliced` → `fried` → `burned` (terminal, no way back) |
| **Actions** | Transition boundaries — consume state A, yield state B | `PEEL`, `CUT`, `BOIL`, `CARAMELIZE`, `COMBINE` (merges two instances into one) |
| **Parameters** | Quantitative/qualitative modifiers, including safety-critical ones | `oilTempC`, `durationSeconds`, HACCP hold times |

Conservation of mass holds across every transformation: `SEPARATE` on an
egg destroys the egg and spawns `egg_yolk` + `egg_white`, full stop — you
cannot end up with a yolk that still has a shell, and you cannot separate
an egg twice. Physical feasibility is enforced per-entity, not assumed:
each ingredient carries its own audited table of forbidden transitions,
checked against *real cooking technique*, not intuition — this repo has
caught and corrected its own wrong assumptions here more than once (see
`LEARNINGS_PROCESS.md`), which is exactly the point of writing them down
as data instead of leaving them implicit.

## Why this exists

The concrete, non-abstract goal: someone who cannot safely cook for
themselves — a wheelchair user without full reach/grip, someone
recovering from surgery, an elderly person living alone — should be able
to have an actual cooked meal made *for* them by a machine that follows
real technique, not one that just reheats a tray. That only works if
"cook" is precise enough for a machine to execute *and* honest enough not
to fake the parts it can't yet do.

Every "informational only, not enforced" note and every "flagged, not
built" gap in this codebase exists on purpose: skipping that honesty
would make the system *look* more capable than it is — which, for
something meant to eventually cook unattended for a person relying on it,
is a worse failure mode than a visible gap. See `ROADMAP.md`'s "Why this
exists" for the full framing.

## What's actually real right now

| Metric | Count |
|---|---|
| **Entities** | 33 (potato, egg + 4 byproducts, garlic, onion, vinegar, oil, butter, salt, pepper, chili, tools, ...) |
| **Actions** | 36 verbs (`PEEL`, `CUT`, `BOIL`, `SIMMER`, `FRY`, `PAR_FRY`, `CARAMELIZE`, `COMBINE`, `EMULSIFY`, `PASTEURIZE`, `REST`, ...) |
| **Recipes** | 15, each simulated end-to-end by `npm run validate`, not just schema-checked |
| **Unit tests** | 236, `node:test`, zero mocks of the actual engine |
| **CCPs** | 3, cited to USDA/FDA — one with a full computed D/z thermal model |
| **Data files** | 90, every safety threshold and physical constant traced in `REFERENCES.md` |

A sample of what's provably makeable end-to-end — run any of these
yourself, right now, no setup beyond `npm install`:

| Dish | What it proves |
|---|---|
| `npm run recipe -- tortilla_de_patatas` | The full combine-two-instances-into-one pipeline, byproducts, conservation of mass |
| `npm run recipe -- tortilla_de_patatas_con_cebolla` | A two-stage `COMBINE` chain (potato+onion, then +egg) into a genuinely distinct composite entity |
| `npm run recipe -- tortilla_de_betanzos` | HACCP advisory-vs-reject distinction, cited to the FDA Food Code |
| `npm run recipe -- crispy_french_fries` | Shape/oil-temperature/doneness working together, double-fry with a real rest interval |
| `npm run capability-test:boil-at-altitude` | Real barometric physics — water boils below 100°C at altitude, computed, not looked up |
| `npm run capability-test:reachability` | A real BFS over the whole vocabulary: "can this ingredient ever reach this goal state?" |
| `npm run capability-test:execution-bounds` | Rejects a plausible-but-early "looks done" sensory signal against a computed safety floor |
| `npm run capability-test:shared-pot-heat` | Two eggs sharing one pot's real, time-varying temperature — heat as a property of the *pot*, not a per-ingredient parameter |

The full, continuously-updated table (30+ rows) lives in `ROADMAP.md`
under "Capability tests."

## Built on real physics and real citations, not vibes

- **Thermal safety**: a real D-value/z-value thermal-death-time model
  (the same math food-safety regulators use), not a fixed "cook for X
  minutes."
- **Altitude physics**: water's actual boiling point at any elevation,
  derived from the ICAO Standard Atmosphere barometric formula + the
  Antoine vapor-pressure equation — not a lookup table.
- **Every claim is sourced.** `REFERENCES.md` traces every safety
  threshold, every physical constant, and every technique claim to a
  real source — USDA FoodData Central, the FDA Food Code, peer-reviewed
  food-science literature, or (honestly labeled, weaker tier) commonly-
  cited practitioner sources. Nothing here claims novel food science —
  the schema and engine are the original contribution.
- **Grounded against real robotics research**: the `instantaneous` vs.
  `continuous` split on every one of the 36 actions was cross-checked
  against an independently-published paper on LLM-generated robot
  control code (`PAPER_NOTES_2608.04768.md`) — two different derivations
  (this repo's simulation side, that paper's hardware side) arriving at
  the identical distinction is treated as real evidence, not coincidence.
- **Self-correcting, on the record.** This repo has publicly caught and
  fixed its own wrong assumptions — including a factually incorrect
  claim inherited from its own founding spec ("you can't peel a boiled
  potato" — you can, it's a standard technique) — rather than quietly
  editing history. See `LEARNINGS_PROCESS.md`.

## Quickstart

```sh
npm install
npm test                   # unit suite (tests/*.test.ts) — synthetic fixtures
npm run validate            # schema + cross-reference check, PLUS full end-to-end
                             # simulation of every real recipe in data/recipes/
npm run recipe -- <id>      # run a specific recipe, e.g. tortilla_de_patatas
npm run new-recipe -- <path.json> <entityId...>  # scaffold a recipe — see AUTHORING.md
npm run validate-recipe -- <path>                # pre-flight + run an ARBITRARY recipe file
npm run narrate-recipe -- <path> <out.md|.json>  # human-readable "read this back to me"
npm run cooklang-import -- <path.cook | url>     # parse Cooklang text, incl. recipes.cooklang.org URLs
npm run cooklang-export -- <recipeId> [out.cook] # export a real recipe to Cooklang text
```

See `package.json` for the full list of `demo:*` and `capability-test:*`
scripts (37 in total). Writing a new recipe from scratch? See
`AUTHORING.md` for the real, worked-example loop.

## Documentation map

Read in roughly this order to get oriented:

| File | What it is |
|---|---|
| `CONCEPT.md` | The founding outline — "Grandma First, Machine Deep." Working title *Tortilla World*. |
| `olddocs/WORLD_MODEL.md` | Resolves `CONCEPT.md`'s flagged design fork: the world (event-sourced, continuously transforming) is primary; a recipe is one layer of intent on top. |
| `ENGINE_INVARIANTS.md` | What must never break, regardless of implementation track — read this before generating code. |
| `CLAUDE_DEV_CTX.md` | The original architecture blueprint/system-prompt this was built from. |
| `CLAUDE.md` | Ground truth on how the plan diverged from what's actually built, file-by-file, plus repo commands and conventions. |
| `ROADMAP.md` | Phased build plan and the full capability-test table — which real dishes are provably makeable today. |
| `ROADMAP_KNOWLEDGE.md` | Split out of `ROADMAP.md` 2026-08-17 — the closed/open ledger of real-world cooking-domain coverage (ingredients, technique verbs, HACCP facts) and every epic that grew out of it (heat-as-a-place, DAG execution, baking, SEASON, ...). |
| `AUTHORING.md` | How to actually write a new recipe from the command line — the real `validate-recipe` loop, a worked example, and real Cooklang import/export (including from a URL, e.g. recipes.cooklang.org). |
| `LEARNINGS.md` | Index into the dated learnings log — split into `LEARNINGS_ENGINE.md`, `LEARNINGS_DOMAIN.md`, `LEARNINGS_TOOLING.md`, `LEARNINGS_PROCESS.md` (schema/engine gotchas, food-science/technique tradeoffs, CLI-tooling notes, and working-method/verification lessons, respectively). |
| `REFERENCES.md` | Bibliography — every safety threshold and technique claim traced to a real source. |
| `SIMULATION_TARGETS.md` | Research comparing simulator/robot-execution targets (PDDL, VirtualHome, AI2-THOR, OmniGibson, RoboCasa) for eventually grounding this model in a simulated or robot-executed world. Not yet chosen. |
| `PORTING_TO_PYTHON.md` | Tips for a Python rewrite, mined from every doc and code comment here. |
| `masideas.md` | The raw original brainstorm notes `CONCEPT.md` and `ENGINE_INVARIANTS.md` were written up from. |

`CLAUDE.md` also scopes three not-yet-started satellite projects (a
Python recipe-scraper pipeline, a React Native reference app, a Home
Assistant component) — see that file before assuming any of them exist.

## What this is *not* (yet)

In the interest of not overselling this the moment it gets more eyes:

- **No perception layer.** Every "verification" this engine describes
  (visual, thermal, elapsed-time) is a specification of what a real
  sensor *would* need to check — there is no camera, no thermocouple,
  nothing actually watching a stove. This engine is open-loop.
- **No robot arm, no simulator wired up.** The engine is a deterministic
  planner/validator today; grounding it in a physical or simulated body
  is real, scoped, unstarted work — see `SIMULATION_TARGETS.md`.
- **A closed, typed vocabulary.** You cannot hand it a free-text recipe
  and expect it to work — every ingredient and action must already exist
  in `data/`. Flour, dairy beyond butter, most proteins besides egg, and
  most herbs are still missing. `AUTHORING.md` is explicit about this.
- **No Cooklang import/export yet**, despite the schema having fields
  reserved for it — see `AUTHORING.md` for exactly why and what's
  planned.

If any of that is exactly the part you want to build, the codebase is
public and the gaps are all named, on purpose, in `ROADMAP.md`.

## License

MIT — see `LICENSE`.
