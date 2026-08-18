# `src/execution-bounds.ts` — design rationale, history, and citations

Full prose moved out of the source file's comments, preserved verbatim and organized by symbol in source order. The source file itself now carries only short "what it does" descriptions plus a pointer here.

## `ExecutionBound`

TICKET 2 of `PAPER_NOTES_2608.04768.md` (Song, Huang, Sun, Tian, Wang &
Li, arXiv:2608.04768, 2026 — `REFERENCES.md`), the direct follow-on to
`actionKind` (TICKET 1, `action.ts`, closed 2026-08-16): the paper's own
generated control code renders every continuous step as `Step(Continuous,
Until(Condition)) with Timeout(120s, ForceNext)` — a sensory termination
condition ORed against a hard upper-bound timeout, "derived from
empirical cooking experience," that forces progress if the sensor never
fires. That upper bound is `Action.maxDurationSeconds` (`action.ts`).

### THE ASYMMETRY THIS MODULE EXISTS FOR, not just a convenience wrapper

In the paper's own architecture, a sensory "looks done" signal ends a
continuous step outright — there is no floor a sensor cannot override.
This repo's CCP machinery (`thermal.ts`, `data/ccps/*.json`) already
enforces a REAL microbiological hold-time floor for actions where one
applies (an egg needs 15s at 63°C regardless of how quickly it LOOKS
cooked) — `ENGINE_INVARIANTS.md` #11 ("a future closed-loop control/
perception layer is a separate, larger piece of work") now has a concrete
adversary: a plausible-looking early-termination signal arriving BEFORE
the safety floor is met. `minSafeHoldSeconds` below is that floor,
`maxDurationSeconds` is the paper's ceiling — genuinely different numbers
answering genuinely different questions ("how long must this run AT
MINIMUM to be safe" vs. "how long may this run AT MOST before something
has clearly gone wrong"), not two names for one concept.

Same standalone-module-before-engine-wiring precedent as `place.ts`/
`heat-source.ts`/`egg-doneness.ts`: real reference math, provable via a
script (`scripts/reject-early-sensory-termination.ts`, `npm run
capability-test:execution-bounds`), BEFORE — if ever — being wired into
`engine.ts`'s own precondition checks. `applyAction` is UNCHANGED by this
module's existence, per this ticket's own explicit acceptance criterion.

`minSafeHoldSeconds` is read from the EXISTING CCP machinery only —
`target.criticalControlPointsByAction[action.id]`, `ccps.get(ccpId)`, and
(when the CCP declares one) `thermal.ts`'s real D/z-value
`requiredHoldSeconds` — deliberately NOT a second, parallel source of
hold-time truth. The `waterTempC`-only param key this reads to trigger
the thermal model is copy-exact from `engine.ts`'s own `applyAction` (not
`oilTempC`, even for an oil-medium action like FRY) — a real,
PRE-EXISTING narrowness in `engine.ts` itself (FRY's `oilTempC` never
actually triggers the D/z computation there either), reproduced
faithfully here rather than "fixed" in this module only, which would
itself have created the parallel-source-of-truth problem this doc comment
just said to avoid. Named, not silently inherited.

### Field notes

- `minSafeHoldSeconds`: The earliest this action may terminate regardless of what a sensor reports — undefined when no CCP applies to this action/entity pair (most continuous actions: BEAT, MASH, INFUSE, ... have no microbiological floor at all, a real and correct absence, not an oversight).
- `maxDurationSeconds`: The paper's own upper bound — `action.maxDurationSeconds`, read straight off the loaded `Action`, not recomputed here.
- `floorIsSafetyCritical`: True exactly when `minSafeHoldSeconds` is set — i.e., a real CCP applies, and a sensor-driven executor must not be allowed to end this step before it, no matter how confident the sensory reading is.
- `citation`: The CCP's own `source` string (or, when the D/z model actually computed `minSafeHoldSeconds`, `thermalModel.source`) — not a `CitationSchema` object, because `CriticalControlPointSchema` itself doesn't use one (a bespoke `source: string` field, `thermal.ts`); this matches that shape rather than forcing a conversion.

## `executionBoundFor`

Computes the dual bound for one action/entity/params combination. Returns
`undefined` when this action isn't `continuous` (an instantaneous action
has no do-until loop for a timeout to apply to at all) or hasn't been
given a `maxDurationSeconds` (unaudited for this ticket, same "absent
means not yet decided" discipline `actionKind` itself uses — see
`action.ts`'s own doc comment).

Deterministic (`ENGINE_INVARIANTS.md` #9) — a pure function of its
arguments, no hidden state, no wall-clock read.

The `waterTempC` branch: exact key/behavior match to `engine.ts`'s
`applyAction` — see the file-level notes above for why "waterTempC only"
is deliberately reproduced, not generalized, here.
