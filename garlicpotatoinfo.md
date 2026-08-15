# Garlic Oil Potatoes

Recipe id: `garlic_oil_potatoes` — 9 steps, 6 distinct verbs used.

## Structure — initial inventory

- `garlic-1`: Garlic (garlic), starting state `raw`
- `oil-1`: Oil (oil), starting state `cold`
- `potato-1`: Potato (potato), starting state `raw`
- `salt-1`: Salt (salt), starting state `dry`

## What it needs

**Tools** — declared: knife, pan
Needed by the sequence: knife, pan

**Ingredient capabilities needed**: isFryingMedium, isAromaticSource, isSaltySeasoning

## What the system inferred

- Step 6 (FRY) needed `isFryingMedium` — satisfied by `oil-1` (oil).
- Step 7 (INFUSE) needed `isAromaticSource` — satisfied by `garlic-1` (garlic).
- Step 8 (FRY) needed `isFryingMedium` — satisfied by `oil-1` (oil).
- Step 9 (SALT) needed `isSaltySeasoning` — satisfied by `salt-1` (salt).

Tag inheritance (conservation of mass — a byproduct carries the parent's real, applicable tags forward; only shown when this instance was never targeted again afterward, so the tags can't have come from anything else):
- `potato_peel-1` (Potato peel) inherited tags [washed].

Zero advisories — every pre-flight check (timing-vs-doneness, wash-before-peel/cut, fry-timing-vs-geometry) passed cleanly.

## Verbs used

`WASH`, `PEEL`, `CUT`, `FRY`, `INFUSE`, `SALT`

## Elements created

- `potato_peel-1`: Potato peel (potato_peel), state `raw`, tags [washed]
- `garlic_peel-2`: Garlic skin (garlic_peel), state `raw`

## How long it takes

Stated active duration: **480s** (8.0 min) — sum of every step's own `durationSeconds`, not a real elapsed-time simulation.

Steps that COULD state a duration but don't (not counted above, not zero — genuinely unstated):
- FRY on "potato-1"

## Final inventory

- `garlic-1`: Garlic (garlic), state `fried`
- `oil-1`: Oil (oil), state `cold`, tags [garlic_infused]
- `potato-1`: Potato (potato), state `fried`, tags [washed, salted]
- `salt-1`: Salt (salt), state `dry`
- `potato_peel-1`: Potato peel (potato_peel), state `raw`, tags [washed]
- `garlic_peel-2`: Garlic skin (garlic_peel), state `raw`

## Result

✅ Runs end-to-end with zero errors.
