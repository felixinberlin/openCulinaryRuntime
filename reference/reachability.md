# `src/reachability.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## File-level

`isGoalReachable` — TICKET 4 of `PAPER_NOTES_2608.04768.md` (Song et al.,
arXiv:2608.04768, 2026 — `REFERENCES.md`), deliberately the LAST of that
ticket list ("the real work... do last, do slowly").

Their equation (9) triggers "recipe migration" when the minimum
achievable deviation from the goal state exceeds a tolerance:
`min_actions D(S_proj, S_goal) > ε`. Strip the robotics off and this is a
pure offline validator query: given the current world state, is the
declared goal still reachable through the action graph? That's
`CONCEPT.md` §12's victory conditions plus §13's validation engine, and
the kind of question `SIMULATION_TARGETS.md` candidate #1 (PDDL) exists
to buy — and a question no system in that paper's own citation list can
answer OFFLINE; they need a physical wok and a running dish to discover
it empirically.

DELIBERATELY SCOPED AS REACHABILITY ONLY, not migration (per the ticket's
own instruction) — proposing an alternative goal is planning, which this
repo doesn't have a planner for. `D(·,·)` itself is also NOT reproduced:
it's a weighted sum over continuous variables (concentration, thermal
distribution, appearance) with no stated weights in the paper —
attempting it would be inventing numbers this repo has no basis for. This
is BFS over the DISCRETE state/tag graph only — no numeric fluents, no
thermal dose, no tolerance metric — which `SIMULATION_TARGETS.md` already
notes is exactly where classical PDDL sits (no numeric fluents either),
and is a real, answerable, useful question on its own.

SCOPED TO ONE INSTANCE'S OWN STATE GRAPH, not a full multi-instance
world — the same narrowing this repo's other standalone-before-engine-
wiring modules use (`place.ts`, `execution-bounds.ts`, ...). Concretely:

- Edges come from the THREE pieces of data that already exist for this
  exact purpose, per the ticket's own explicit instruction ("all three
  already exist; do not invent a new graph representation"):
  `Entity.allowedTransformations` (candidate verbs), `Action`'s own
  `requiredTargetCapability`/`requiredTools`/`requiredToolCapabilities`/
  `requiredIngredientCapabilities` (whether an edge is actually usable
  given the tools/ingredients on hand), and `Entity.invalidTransitions`
  (closures — the exact matrix `606f056`/narrowed `3e2050a` built).
- A `transformedStateFromParameter` action (e.g. `CUT`'s `shape`) fans
  out into one candidate edge per `allowedValues` entry — a planner could
  choose any of them; this is genuinely multiple real edges, not one
  ambiguous one.
- A `requiredSecondaryCapability` (COMBINE-shaped) action is a real,
  NAMED non-goal, not silently mishandled: this search tracks ONE
  instance's own reachability, has no model of a second instance being
  available, and refuses to guess — recorded as a
  `requires_secondary_instance` blocking reason and the edge is not
  explored.
- `destroysTarget`/`combinesInto` (conservation-of-mass actions —
  `SEPARATE`, `CRACK`, `COMBINE`) are real dead ends for THIS instance:
  once fired, the instance no longer exists to reach anything further,
  correctly modeled as an `instance_destroyed` blocking reason with zero
  outgoing edges, not a state this search pretends persists. This is the
  exact, real mechanism behind "an egg separated into yolk/white can
  never reach a goal of 'a whole boiled egg' again" — not because
  `invalidTransitions` forbids it, but because the ORIGINAL instance is
  gone; no verb in this vocabulary recombines yolk+white+shell back into
  one egg.

DETERMINISM (`ENGINE_INVARIANTS.md` #9): plain BFS, FIFO queue, visiting
`entity.allowedTransformations` in its own declared array order at each
node and — for a parameter-driven action — `parameters[].allowedValues`
in its own declared array order. Neither depends on `Map`/`Set` iteration
order for the RESULT (tool/ingredient capability checks are boolean
membership tests, not order-sensitive) — the same path is returned for
the same inputs every time; see `tests/reachability.test.ts` for a direct
check of this, not just an assumption.

## `GoalPredicate`

- `state`: Target `state`, if the goal cares about it.
- `requiredTags`: Tags the goal requires ALL of, if any — the instance may carry others too.

## `BlockingReason`

Why a specific action/edge could not be used, ANYWHERE it was tried
during the search — the accumulated, deduplicated answer to "the reason
is the useful part," not a single guess at the one true cause. Multiple
reasons can (and often do) apply across the whole search.

## `ReachabilityStep`

- `param`: Which `allowedValues` entry was chosen, for a `transformedStateFromParameter`-driven step (e.g. CUT's `shape: "diced"`). Absent for a fixed-`transformedState` or tag-only step.

## `ReachabilityQuery`

- `entities`: Every known entity — needed to resolve a candidate tool/ingredient's own capabilities, the same lookup `engine.ts`'s `applyAction` does.

## `Edge` / `enumerateEdges`

One usable outgoing transition from `(fromState, fromTags)` — the exact
action/parameter choice as a `ReachabilityStep`, plus the state/tags it
leads to. Extracted 2026-08-17 from `isGoalReachable`'s own inline loop
body (`ROADMAP.md`'s "close the gaps" planner work) so `planner.ts`'s
cost-aware search can reuse the IDENTICAL precondition-checking logic —
same `required*` checks, same `invalidTransitions` closure, same
parameter fan-out — instead of a second, silently-divergible
reimplementation. `isGoalReachable` below was refactored to CALL this
function rather than inline it; its own behavior (including the exact
`blockedBy` reasons and their order) is unchanged — verified by
re-running every existing `tests/reachability.test.ts` case and
`capability-test:reachability` after this extraction, not assumed.

An unresolvable action id is a data-integrity issue `scripts/validate.ts`'s
own cross-reference already catches; not this function's job to re-flag.

The conservation-of-mass branch (`destroysTarget`/`combinesInto`): a real
dead end for THIS instance — see the file-level notes above. Recorded,
not silently skipped, and deliberately yielded with ZERO outgoing edges.
