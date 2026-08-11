# CONCEPT.md — Tortilla World

> Captured from `masideas.md` (raw outline/notes). This is a structured write-up of that outline, not a finished spec — sections marked **TODO (from source)** were only a heading in the original notes and still need real content. This document has **not** been reconciled with `CLAUDE_DEV_CTX.md` / `Culinary_Informatics_Research_Plan.pdf` / `ROADMAP.md`, which build around a linear step-sequence recipe model that this outline explicitly argues against (see §12). Treat the two as parallel design tracks until that's resolved.

Working title: **Tortilla World**. Philosophy, per the source notes: *"Grandma First, Machine Deep"* — recipes are authored the way a person actually talks about cooking; the mechanical/scientific structure lives underneath, never the other way around.

## 1–2. Premise

**Knowledge > Instructions.**

- Ingredients know themselves.
- Tools know themselves.
- Actions know themselves.
- Recipes should contain as little knowledge as possible.

A recipe is not where cooking knowledge lives — it's a thin declarative pointer into knowledge that lives on ingredients, tools, and actions.

## 3. Core Principles

- **Knowledge is immutable.** (the canonical definition of "what an onion is" doesn't change at runtime)
- **Instances are mutable.** (*this* onion, on the cutting board, changes state)
- **Recipes are declarative.**
- **Everything is replayable.**
- **Everything is deterministic.**
- **Unknown knowledge is allowed.** (the world must not break when it meets an ingredient/action/state it doesn't recognize — see §15)

## 4. The World

**TODO (from source):** needs real content + diagrams. The outline names these as the entities that exist in the world, undefined beyond the name:

- Ingredient Types
- Ingredient Instances
- Actions
- Transformations
- Tools
- Containers
- Workstations
- Environment
- Particles
- Recipes
- Events

## 5. Knowledge Layers

The layer this doc's notes call out as the strongest idea. Natural language compiles *down* through three layers — never the reverse:

```
Grandma Layer   →   "pela la patata" ("peel the potato")
      ↓
World Layer     →   PEEL
                     requires: knife
                     creates: peeled potato, potato peel
      ↓
Scientific Layer →  skin removed, water decreases, surface changes, ...
```

Grandma-layer language is parsed into world-layer mechanics; the world layer's effects are explained (not derived) by the scientific layer. Inference never runs backward — you don't reconstruct grandma's phrasing from scientific state.

## 6. Ingredient Model

**TODO (from source):** flagged in the notes as "an enormous document" on its own — still needs to be written. The outline gives the fields it must cover:

- Identity
- Structure
- Composition
- Capabilities
- Possible States
- Allowed Transformations
- Produced Byproducts
- Sensory Properties
- Metadata

## 7. Actions

An action is knowledge, not code. Example shape, per the source:

```
PEEL
  requires:      knife
  valid targets: vegetables
  outputs:       peeled object, waste
  duration:      variable
  precision:     optional
```

## 8. States

Not just the coarse `raw` / `fried`. The source calls out a richer vocabulary:

`peeled`, `cut`, `broken`, `burned`, `crispy`, `cold`, `warm`, `hot`, `overcooked`, `salted`, `wet`, `dry`

## 9. Transformations

> "Recipes don't exist. Transformations exist."

Example:

```
egg → break → egg white + egg yolk + shell
```

(Consistent with the egg-separation example in `CLAUDE_DEV_CTX.md` and the PDF — conservation of mass/entities holds across all three source docs.)

## 10. Event System

Everything is Event Sourcing. State is never stored directly — only events:

`PICK_UP`, `DROP`, `CUT`, `MOVE`, `HEAT`, `WAIT`, `MIX`, ...

World state is a projection of the event log, not a thing that's saved.

## 11. Timeline

Because everything is event-sourced, these come "for free" from the same log:

- undo / redo
- save
- playback
- "ghost cooking" (replaying a past run)
- AI explanation (narrating what happened, from events)
- robot execution (replaying/driving the same events on a physical actuator)

## 12. Recipe Model

The key departure from the step-sequence model elsewhere in this repo. A recipe does **not** contain:

```
Step 1
Step 2
Step 3
```

It contains:

- Goals
- Constraints
- Required Ingredients
- Acceptable States
- Serving
- Optional Variants
- Tolerance
- Victory Conditions

i.e. a recipe declares *what counts as done*, not an ordered procedure to follow. (This is the piece that conflicts with `RecipeScriptSchema`'s linear `sequence: MechanicalAction[]` in `CLAUDE_DEV_CTX.md` — unresolved, see the note at the top of this file.)

## 13. Validation Engine

> "Is this tortilla valid?"

Validation compares **states**, not text. A finished dish is checked against the recipe's declared acceptable states / victory conditions (§12), not against a transcript of steps taken to get there.

## 14. Human Language

Where the LLM sits in the pipeline:

```
"corta la cebolla finita" ("cut the onion thin")
      ↓
LLM
      ↓
Intent: SLICE, target: onion, thickness: thin
      ↓
Deterministic engine
```

The LLM's only job is producing a structured `Intent`; everything after that is deterministic engine logic.

## 15. Unknown Knowledge

Important, cross-referenced from §3. The world must accept an unknown ingredient, unknown action, or unknown state **without breaking**. (This is the same requirement as the PDF's "dynamic capability inference" — an unrecognized ingredient like passion fruit still needs inferred capabilities like `isPeelable`, `isChoppable`, `isFryable` at runtime rather than a hard failure.)

## 16. AI Integration

- The AI never cooks.
- The AI interprets.
- The AI never decides rules.

Same boundary as §14: LLM → Intent, never LLM → authoritative world state.

## 17. Robotics

> Same API.

```
Human → Timeline → Robot
```

Nothing about the model changes for a robotic actuator — it consumes/drives the same event timeline a human session would. (Narrower and more concrete than the PDF's separate "Unity physics engine for a robotic arm" framing — worth reconciling: is Unity the robot-side interpreter of this same timeline, or a distinct target?)

## 18. Multiplayer

Not a near-term goal (the project is currently single-player), but the architecture should be able to explain, without changing the fundamental model, how multiple agents could operate on the same timeline concurrently.

## 19. Future

Speculative, unscoped ideas from the notes — not commitments:

Smells, particles, fermentation, time, bacteria, economy, market, restaurants, robots.

## 20. Appendix

**TODO (from source) — not yet written:**

- JSON model
- Examples
- DSL
- Cooklang
- Comparison
- References

---

See `ENGINE_INVARIANTS.md` for the companion document: rules code generated against this concept must never violate.
