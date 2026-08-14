# Open Culinary Runtime (OCR)

Recipes modeled as deterministic, executable state machines — an
Entity-Component-System, not prose instructions. An ingredient is a typed
entity with capabilities and physical states; an action is a transition
boundary that consumes inputs in one state and yields outputs in another;
a recipe is a script the engine actually runs and validates, including
HACCP food-safety thresholds, not just text a human interprets.

This is not claiming novel food science. Every safety threshold, physical
constant, and technique claim in `data/*.json`/`src/*.ts` traces to a real
source — see `REFERENCES.md`. What's original here is the schema/engine:
`Entity`/`State`/`Action`/`Parameter`, conservation of mass across
transformations, physical-feasibility restrictions, and CCP enforcement
(D/z-value thermal model) applied to cooking.

## Why

The concrete goal: someone who cannot safely cook for themselves — a
wheelchair user without full reach/grip, someone recovering from surgery,
an elderly person living alone — should be able to have an actual cooked
meal made *for* them by a machine that follows real technique, not just
reheats a tray. That only works if "cook" is precise enough for a machine
to execute and honest enough not to fake the parts it can't yet do. See
`ROADMAP.md`'s "Why this exists" for the full framing.

## Status

Past the planning stage. `src/` has a working schema/engine; `data/` has
real entities, actions, recipes, CCPs, and heat-source profiles (potato,
egg + byproducts, garlic, alioli variants, gas/vitro/wood heat sources);
`scripts/` has runnable demos and capability tests proving specific real
dishes are makeable end-to-end (tortilla de patatas, tortilla de Betanzos,
crispy French fries, soft-boiled egg, and more — see the capability-test
table in `ROADMAP.md`).

## Quickstart

```sh
npm install
npm test                 # unit suite (tests/*.test.ts) — synthetic fixtures
npm run validate          # schema + cross-reference check over the real data/*.json
npm run recipe -- <id>    # run a specific recipe, e.g. tortilla_de_patatas
```

See `package.json` for the full list of `demo:*` and `capability-test:*`
scripts.

## Documentation map

Read in roughly this order to get oriented:

| File | What it is |
|---|---|
| `CONCEPT.md` | The founding outline — "Grandma First, Machine Deep." Working title *Tortilla World*. |
| `WORLD_MODEL.md` | Resolves `CONCEPT.md`'s flagged design fork: the world (event-sourced, continuously transforming) is primary; a recipe is one layer of intent on top. |
| `ENGINE_INVARIANTS.md` | What must never break, regardless of implementation track — read this before generating code. |
| `CLAUDE_DEV_CTX.md` | The original architecture blueprint/system-prompt this was built from. |
| `CLAUDE.md` | Ground truth on how the plan diverged from what's actually built, file-by-file, plus repo commands and conventions. |
| `ROADMAP.md` | Phased build plan and the capability-test table — which real dishes are provably makeable today. |
| `LEARNINGS.md` | Dated log of schema constraints, engine gotchas, and design tradeoffs discovered along the way. |
| `REFERENCES.md` | Bibliography — every safety threshold and technique claim traced to a real source. |
| `SIMULATION_TARGETS.md` | Research comparing simulator/robot-execution targets (PDDL, VirtualHome, AI2-THOR, OmniGibson, RoboCasa) for eventually grounding this model in a simulated or robot-executed world. Not yet chosen. |
| `masideas.md` | The raw original brainstorm notes `CONCEPT.md` and `ENGINE_INVARIANTS.md` were written up from. |

`CLAUDE.md` also scopes three not-yet-started satellite projects (a Python
recipe-scraper pipeline, a React Native reference app, a Home Assistant
component) — see that file before assuming any of them exist.

## License

MIT — see `LICENSE`.
