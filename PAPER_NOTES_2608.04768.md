# Paper notes — arXiv:2608.04768, "Embedding Large Language Models into Flow Controls"

**Full title:** Embedding Large Language Models into Flow Controls: An Agentic
Framework for Adaptive and Trustworthy Automated Cooking
**Authors:** Zihan Song, Hongwei Huang, Yueshuo Sun, Yonglin Tian, Fei-Yue Wang, Bai Li
(Hunan University / East China Normal University / CASIA State Key Laboratory
for Management and Control of Complex Systems)
**arXiv:** 2608.04768 (cs.CV), August 2026. Read 2026-08-16 against repo HEAD
`bcc6e53`.

**What this document is:** an implementation ticket list, not a literature
summary. Sections marked **TICKET** are meant to be picked up directly by a
coding agent; each states its own acceptance criteria and which
`ENGINE_INVARIANTS.md` rules it must not violate. Sections marked
**DELIBERATELY NOT ADOPTED** are decisions, not omissions — do not
"helpfully" implement them later without re-opening the argument here.

Sibling to `SIMULATION_TARGETS.md`: that file evaluates *targets to ground
this model in*; this file evaluates *one specific published system* that
occupies the layer directly above OCR, and extracts what's reusable.

---

## 1. What the paper actually builds

A physical wok-robot system in three modules:

1. **Pre-cooking preparation (offline).** User info + kitchen context → dish
   name (LoRA-fine-tuned LLM) → canonical recipe (RAG over a curated local
   corpus) → customized recipe (same fine-tuned LLM, bounded to modifying the
   canonical reference) → **programmatic recipe with explicit flow control**
   (two general-purpose LLMs, not fine-tuned) → executable Python over a fixed
   atomic-action library.
2. **Online execution.** Generated Python runs; four sensor modalities
   (visual, IR thermal, acoustic, olfactory/gas) feed an *asynchronous
   supervisory process* running parallel to the main execution thread, with
   explicit priority and mutual-exclusion rules, that can modify, suspend,
   override, or fully take over the running plan.
3. **Post-cooking adaptation.** Leftover analysis + user feedback → persistent
   historical dining records → better customization next time. Explicitly does
   not affect the current dish.

**Validation:** LoRA SFT benchmarked on 5 base models (BLEU-4 / ROUGE-L);
staged-vs-end-to-end code generation on a 20-dish test set; physical
experiments on two dishes (Salted Pork, Kung Pao Chicken) plus a simulated
oil-surface fire.

## 2. What the paper independently confirms about this repo's design

No work items here — this section exists so the confirmations are on record
and don't get re-litigated.

- **Staged decomposition beats end-to-end, empirically.** Their Table II: the
  end-to-end single-prompt baseline scored **structural integrity 92.5,
  functional correctness 65, executability 20%**, against 100/100/100% for the
  staged pipeline. Read that baseline row carefully — it is code that *looks*
  well-formed and *does not run*. This is the strongest external evidence yet
  for `CONCEPT.md` §14/§16 and `ENGINE_INVARIANTS.md` #10 (LLM → structured
  intent, never LLM → authoritative world state), and it should be cited
  wherever this repo argues for that boundary.
- **Bounded customization over open generation.** Their customization stage
  fixes the dish identity and canonical recipe and permits only modification
  within those bounds — structurally the same move as this repo's "a recipe
  declares intent, knowledge lives on entities/actions" (`ENGINE_INVARIANTS.md`
  #1).
- **The instantaneous/continuous split was arrived at independently.** See
  TICKET 1. `src/place.ts`'s own top doc comment already argues that
  `advanceTempSeconds` is a continuous elapsed-time process that
  `applyAction`'s one-shot instantaneous-transition shape does not fit. This
  paper reaches the identical split from the hardware side. Two independent
  derivations of the same distinction is a strong signal it is real structure,
  not a local modeling artifact.
- **Manual confirmation as a deliberate safety trade-off, not a defect.**
  Their conclusion concedes the system still requires user confirmation for
  instantaneous operations whose completion cannot be reliably sensed, and
  frames it as a deliberate trade-off between execution safety and full
  automation. `VerificationCriterionSchema`'s `manual_confirmation` method and
  `confidence: "low"` vocabulary already encode exactly this stance. Keep it.

## 3. The gap this paper proves is real

**No thermal-dose / pathogen model anywhere in the system.** Their
"trustworthy" is scoped entirely to *operational* safety — fire, dry heating,
burning, overflow, over-seasoning. Continuous-action termination conditions are
visual, thermal-*distribution*, acoustic, and olfactory. There is no
time-temperature integration, no D/z-value reasoning, no core-temperature
verification, and no HACCP concept of any kind.

They cook Kung Pao Chicken — poultry — on this basis.

`SIMULATION_TARGETS.md` already recorded that none of PDDL / VirtualHome /
AI2-THOR / OmniGibson / RoboCasa model pathogen kill-time. This paper extends
that finding from *simulation frameworks* to *a deployed physical cooking
robot in the current literature*. Record it as such: `src/thermal.ts` +
`data/ccps/*.json` is not a differentiating nice-to-have, it is the layer this
field is currently missing, and the honest framing of OCR's role is **the
offline verifier for exactly this class of system** (their §IV-F "verifies it
against key constraints" is one sentence long and names neither the
constraints nor the checker).

Do **not** overstate this in repo docs. The correct claim is "this specific
published system has no thermal-dose model, and neither did the five
frameworks surveyed in `SIMULATION_TARGETS.md`" — not "no robot cooking system
has ever modeled food safety."

---

## TICKET 1 — `actionKind: "instantaneous" | "continuous"`

**Effort:** low. **Impact:** high — this is the schema-level name for a
distinction `place.ts`, `recipe-runner.ts`, and `engine.ts` are already
working around implicitly.

### Why

The paper's split: **instantaneous** actions are one-off operations whose
completion cannot be reliably sensed (ignition, ingredient addition) and are
executed once before proceeding; **continuous** actions evolve over time
(stirring, heating) and are expressed as do–until constructs terminated by
observable sensory criteria.

In this repo the same line already exists three times, unnamed:

- `place.ts` — `advanceTempSeconds` is continuous, `applyAction` is one-shot;
  that mismatch is why the shared-heat work landed in `recipe-runner.ts` and
  not inside `applyAction`.
- `recipe-runner.ts` — which steps consult `PlaceState` is currently decided
  by an **opt-in `params.placeId` convention**, i.e. by recipe authoring, not
  by a typed property of the verb. That is the wrong layer: whether BOIL is
  time-evolving is a fact about BOIL (`ENGINE_INVARIANTS.md` #1 — knowledge
  lives on the action, not the recipe).
- `action.ts` — `duration: "fixed" | "variable"` is adjacent but not the same
  question. `variable` means "how long is not fixed"; `continuous` means "the
  effect accumulates over elapsed time and terminates on a condition." CUT is
  `variable` and instantaneous. Keep both fields; do not overload `duration`.

### Implementation

1. **`src/action.ts`** — add to `ActionSchema`:

   ```ts
   actionKind: z.enum(["instantaneous", "continuous"]).optional(),
   ```

   Optional, not defaulted. A missing value means "not yet audited," matching
   the precedent `retrySafe` sets in its own doc comment. Do **not** infer a
   default — a wrong silent default here is worse than an absent field.

   Write a doc comment in this file's established style covering: the paper
   provenance, the two candidate discriminators below and the fact that they
   disagree, and the explicit statement that this field does not change
   `applyAction`'s semantics.

2. **Audit all 32 `data/actions/*.json` individually.** Every action gets an
   `actionKind` plus a one-line `metadata.actionKindNote` stating the
   rationale. Do not batch-assign by pattern match.

   **Two discriminators, which genuinely disagree — this is the interesting
   part, not a problem to smooth over:**

   - *Paper's test:* does it have an observable termination condition, or is
     it fire-and-forget?
   - *Engine's test:* does the effect depend on elapsed time or on a
     `PlaceState` temperature?

   Unambiguous by both tests:

   | `actionKind` | Actions |
   |---|---|
   | continuous | `boil`, `simmer`, `poach`, `fry`, `par-fry`, `bake`, `heat_place`, `pasteurize`, `infuse` |
   | instantaneous | `salt`, `pepper`, `chili`, `acid`, `crack`, `separate`, `peel`, `wash`, `fill`, `place_in`, `flip`, `fold`, `combine` |

   **Genuinely ambiguous — audit each and state which test you applied and
   why:** `beat`, `mix`, `scramble`, `mash`, `crush`, `emulsify`, `dissolve`,
   `cut`, `grate`, `shock`.

   Worked example of the tension: `beat` is stirring — continuous by the
   paper's test (the paper names stirring explicitly), with a real visual
   termination condition. But `applyAction` fires its effect the instant
   preconditions pass, with no elapsed-time term at all, so it is
   instantaneous by the engine's test. `shock` is the mirror case: thermally
   time-dependent in reality, one-shot in the model.

   **Where the two tests disagree, classify by the paper's test (the physical
   truth) and record the disagreement in `metadata.actionKindNote`.** Those
   notes then become the exact inventory of where this engine's one-shot
   approximation departs from physical reality — which is more valuable than a
   clean classification, and is the same "state the gap rather than hide it"
   discipline the rest of `data/actions/*.json` already follows.

3. **Cross-check against `verification.method`.** All 32 actions already carry
   a `verification` criterion. Every `manual_confirmation` action
   (`salt`, `pepper`, `chili`, `acid`) should come out instantaneous — that is
   precisely the paper's "cannot be reliably sensed, so ask the human" class.
   Every `thermal` action (`boil`, `bake`, `heat_place`, `pasteurize`,
   `shock`) should come out continuous, with `shock` as the one to look at
   hardest. **If any action breaks this correspondence, that is a finding —
   record it, do not adjust either field to make the pattern hold.**

4. **`scripts/validate.ts`** — add a cross-reference check: warn (do not fail)
   on any action missing `actionKind`, in the same style as existing
   cross-reference checks.

5. **`src/recipe-runner.ts`** — do **not** change dispatch behaviour in this
   ticket. Add `actionKind` to the pre-flight/explain output only, so the
   classification is visible before anything depends on it. Behavioural change
   is TICKET 2.

### Acceptance criteria

- `npm test` and `npm run validate` pass.
- All 32 action JSONs carry `actionKind` + `metadata.actionKindNote`.
- No existing recipe changes behaviour; every capability test in
  `ROADMAP.md`'s table still passes unchanged.
- `LEARNINGS_ENGINE.md` gets a dated entry recording every action where the
  two discriminators disagreed.

### Invariant check

Touches #1 (knowledge on the action, not the recipe — this ticket *improves*
compliance), #6 (definitions immutable at runtime — unaffected, this is
authoring-time data). Nothing else.

---

## TICKET 2 — `maxDurationSeconds`: the sensory-OR-timeout dual bound

**Effort:** medium. **Impact:** high — this is the concrete integration
surface between OCR and any system shaped like the paper's.

### Why

Their generated Python renders continuous steps as
`Step(Continuous, Until(Condition)) with Timeout(120s, ForceNext)`. The paper
states that every continuous action carries a maximum recommended duration
**derived from empirical cooking experience**, which prevents indefinite
execution when the sensory condition is never satisfied, guaranteeing progress
and avoiding deadlock.

That upper bound is the slot OCR fills, and fills better: `src/egg-doneness.ts`
(`EGG_BOIL_DONENESS`, `EGG_SIZE_ADJUSTMENT_SECONDS`), `src/potato-doneness.ts`
(`POTATO_BOIL_DONENESS`), `src/heat-penetration.ts`, and the CCP hold times in
`data/ccps/*.json` all derive real numbers with real citations. Their number
comes from an LLM's recollection of cooking experience.

**The asymmetry that matters, and the reason this ticket is not just a
convenience field:** a sensor can report "looks done" *before* the CCP hold
time is met. In their architecture that ends the step. In OCR's, the CCP is a
floor a sensor must not be able to override. That is `ENGINE_INVARIANTS.md`
#11 with a concrete adversary for the first time.

### Implementation

1. **`src/action.ts`** — add an optional bound to `ActionSchema`, applicable
   only when `actionKind === "continuous"`:

   ```ts
   /** Upper time bound for a continuous action, for an executor that would
    *  otherwise loop forever waiting on a sensory termination condition. */
   maxDurationSeconds: z.number().positive().optional(),
   ```

   Add a `.refine()` rejecting `maxDurationSeconds` on an action declared
   `instantaneous`.

2. **New module `src/execution-bounds.ts`.** Follow the precedent of
   `egg-doneness.ts` / `heat-source.ts` / `place.ts`: real reference math,
   provable via a script, **before** being wired into `engine.ts`'s
   precondition checks. Export something along the lines of:

   ```ts
   export type ExecutionBound = {
     /** Earliest the step may terminate regardless of what a sensor says.
      *  Sourced from a CCP hold time when one applies to this
      *  action/target pair — otherwise undefined. */
     minSafeHoldSeconds?: number;
     /** Upper bound; the executor should force-advance past this. */
     maxDurationSeconds: number;
     /** Which of the two, if either, is safety-load-bearing. */
     floorIsSafetyCritical: boolean;
     citation?: Citation;
   };

   export function executionBoundFor(
     action: Action,
     targetEntity: Entity,
     params: Record<string, unknown>,
   ): ExecutionBound | undefined;
   ```

   `minSafeHoldSeconds` must be read from the existing CCP machinery
   (`src/thermal.ts`, `data/ccps/*.json`, the target entity's
   `criticalControlPointsByAction`) — **do not introduce a second, parallel
   source of hold-time truth.**

3. **`scripts/`** — add a demo proving the asymmetry on a real dish: a case
   where a plausible sensory "done" signal arrives before
   `minSafeHoldSeconds`, and the bound correctly refuses to let the step end.
   `soft_boiled_egg` or `huevo_frito` are the natural targets (both already
   exercise `egg_cooking`'s CCP). Register it in `package.json` alongside the
   other `capability-test:*` scripts and add a row to `ROADMAP.md`'s table.

4. **`src/recipe-explain.ts` / `src/recipe-narrator.ts`** — surface the bound
   in explain output, the same way `cut-dimensions.ts` and
   `heat-penetration.ts` were wired in (`6f6fa46`).

### Acceptance criteria

- A script demonstrably shows a sensory-early-termination attempt being
  rejected by the CCP floor, with the citation for that floor printed.
- Every `maxDurationSeconds` value in `data/actions/*.json` traces to a real
  source in `REFERENCES.md`, or is explicitly marked as a house value with a
  stated rationale. **Do not copy the paper's numbers** — they have no stated
  provenance.
- `engine.ts`'s `applyAction` is unchanged.

### Invariant check

#9 (determinism — the bound is a pure function of action + entity + params,
no hidden state), #11 (this ticket *strengthens* it: an autonomous executor
gets a hard floor it cannot sensor-override). #10 holds: nothing here lets an
LLM assert world state.

---

## TICKET 3 — dilution repair in `flavor-balance.ts`

**Effort:** low. **Impact:** medium.

### Why

Their equation (7), for the over-seasoning correction case:

```
ΔV = V_curr · (C_curr / C_target − 1)
```

Standard dilution balance. `src/flavor-balance.ts` currently exports
`FLAVOR_COUNTERBALANCES` and `counterbalancesInvolving()` — descriptive
knowledge about which tastes offset which. This adds the *repair* direction:
given an overshoot, how much diluent brings it back.

### Implementation

Add to `src/flavor-balance.ts`:

```ts
/** Volume of neutral diluent needed to bring a solution from currentConc
 *  down to targetConc, by conservation of solute. Concentration units are
 *  caller-defined but must match; volume unit is whatever currentVolume is
 *  expressed in. Returns 0 when already at or below target. */
export function dilutionVolumeToTarget(
  currentVolume: number,
  currentConc: number,
  targetConc: number,
): number;
```

Guard `targetConc <= 0` and `currentConc < targetConc` explicitly. Cite
against a standard reference (conservation of solute, `C₁V₁ = C₂V₂`), **not**
against this paper — the paper is where we found it applied to cooking, not
the source of the physics. Note in the doc comment that this assumes a
well-mixed homogeneous liquid and therefore does not apply to a dry-seasoned
solid (an over-salted fried potato is not recoverable this way), which is the
honest limit and the one most likely to be misapplied.

Add a `tests/flavor-balance.test.ts` case.

### Acceptance criteria

Unit test covering: exact-target no-op, 2× overshoot → equal volume added,
guard behaviour on invalid input.

---

## TICKET 4 — goal reachability from an arbitrary intermediate state

**Effort:** high. **Impact:** high. This is the one worth doing slowly.

### Why

Their equation (9) triggers *recipe migration* — abandoning the target dish for
a reachable one — when the minimum achievable deviation from the goal state
exceeds a tolerance:

```
min_actions D(S_proj, S_goal) > ε
```

Strip the robotics off and this is a **pure offline validator query**: *given
the current world state, is the declared goal still reachable through the
action graph?*

That is `CONCEPT.md` §12's victory conditions plus §13's validation engine,
and it is what `SIMULATION_TARGETS.md` candidate #1 (PDDL) exists to buy. It
is also a question no system in the paper's citation list can answer offline —
they need a physical wok and a running dish to discover it.

This is the strongest strategic item in this document: it is squarely inside
the "offline recipe compiler/validator, not real-time simulator" framing, it
reuses everything already built, and it answers a question the field currently
answers empirically and expensively.

### Implementation

Deliberately scoped as **reachability only**, not migration. Migration
requires proposing an alternative goal, which is planning, which is not this
repo's job yet.

1. **`src/reachability.ts`** — a search over the existing action graph:

   ```ts
   export type ReachabilityResult =
     | { reachable: true; path: { actionId: string; params?: Record<string, unknown> }[] }
     | { reachable: false; blockedBy: BlockingReason[] };
   ```

   Inputs: current `Instance` state + tags, a goal predicate (target state
   and/or required tags), available tools, available ingredients. Edges come
   from `allowedTransformations`, `statePrerequisites`, and the
   `INVALID_TRANSITIONS` matrix (`606f056`, narrowed in `3e2050a`) — **all
   three already exist; do not invent a new graph representation.**

   `blockedBy` must name the specific reason: a missing tool capability, an
   unsatisfiable `statePrerequisite`, a closed `invalidTransition`, an absent
   required ingredient capability. "Not reachable" with no reason is not an
   acceptable output — the reason is the useful part.

2. Start with **BFS over discrete state/tag transitions only.** No numeric
   fluents, no thermal dose, no tolerance metric ε. Their `D(·,·)` is a
   weighted sum over continuous variables (concentration, thermal
   distribution, appearance) and has no stated weights in the paper; do not
   attempt to reproduce it. Reachability over the discrete graph is a real,
   answerable, useful question on its own, and is where PDDL sits per
   `SIMULATION_TARGETS.md`'s note that classical PDDL has no numeric fluents
   anyway.

3. **`scripts/is-goal-still-reachable.ts`** + a `ROADMAP.md` table row. Good
   forcing cases from existing data: a potato that has been `mashed` — which
   `INVALID_TRANSITIONS` should close off from `fried` — and an egg
   `separated` into yolk/white when the goal wanted a whole `boiled` egg.

4. **`ROADMAP.md`** — file under world-model work, not tooling. This is engine
   expressiveness.

### Acceptance criteria

- Correctly reports unreachable, **with a specific named reason**, for at
  least two real dead-end states drawn from existing `data/entities/*.json`.
- Correctly reports reachable with a valid path for a mid-recipe state of an
  existing recipe, and that path validates against the real engine when run.
- No changes to `engine.ts` or `applyAction`.

### Invariant check

#8 (state reconstructable from events — this reads state, appends nothing),
#9 (deterministic — BFS with a fixed tie-break order; **specify and test the
ordering**, do not let it depend on `Map` insertion order accidentally).

---

## TICKET 5 — failure-state vocabulary

**Effort:** low-medium. **Impact:** medium.

### Why

Their anomaly taxonomy is field-tested on real hardware and free to take:
**fire / open flame, dry heating, uneven heating (localized scorching
tendency), partially burned, excessive seasoning, pot overflow.**

`CONCEPT.md` §8 lists `burned` and `overcooked` in the state vocabulary. No
entity in `data/entities/*.json` implements either. That is a real hole: the
engine can currently express every way a dish goes right and no way it goes
wrong.

### Implementation

1. Add `burned` / `overcooked` as real states to the entities where they are
   physically reachable (`potato`, `egg`, `garlic`, `tortilla_mixture` at
   minimum), with `INVALID_TRANSITIONS` entries closing off what cannot follow
   — `burned` is terminal for essentially every downstream action, and that is
   the point.
2. **Do not add a "burn detection" mechanism.** No timers, no probability, no
   inference. This ticket adds *reachable failure states and their closures*
   only. Deciding that burning has occurred requires perception —
   `ENGINE_INVARIANTS.md` #11, out of scope.
3. Consider a `terminal: true` marker on states from which no transformation
   is allowed, so `recipe-explain.ts` can say "this state is unrecoverable"
   rather than silently listing zero options. Cross-check against the
   `dissolve` / `mash` "dead state made reachable" work (`ROADMAP.md`
   2026-08-13) — those were dead states that turned out to be reachable
   *into*; this is the opposite direction.

### Acceptance criteria

`INVALID_TRANSITIONS` closures for `burned` are audited per-entity, not
global — matching the decision already made in `606f056` and corrected in
`7d497d4` / `3e2050a`. Do not repeat the potato-peel mistake: verify each
closure is *physically* true rather than intuitively true.

---

## TICKET 6 — `REFERENCES.md` additions

**Effort:** trivial.

Add, under a new "Robotic / automated cooking systems" heading (this is
systems literature, not food-safety or physics — keep it separate from the
existing sections so nothing here is mistaken for a safety citation):

- **Song, Huang, Sun, Tian, Wang, Li (2026)** — arXiv:2608.04768. Cite for:
  the staged-vs-end-to-end code generation result (their Table II), the
  instantaneous/continuous action split (TICKET 1), the sensory-OR-timeout
  dual bound (TICKET 2), and the anomaly taxonomy (TICKET 5). Confidence:
  `commonly_cited_unverified` — a preprint, and see §6 below for specific
  reasons for caution.
- **Ma, Yan, Fu, Zhao (2011)**, "A Chinese cooking robot for elderly and
  disabled people," *Robotica* 29(6):843–852 — their reference [8].
  **`README.md`'s and `ROADMAP.md`'s "Why this exists" framing is this paper's
  stated motivation, fifteen years earlier.** Worth reading and worth citing;
  the framing is not novel to this repo and should not be presented as such.
- **Yoneda et al. (2024)**, "Statler: State-maintaining language models for
  embodied reasoning," ICRA — their [22]. Closest prior work to OCR's actual
  shape (executable code paired with an explicitly maintained world state).
  Read before TICKET 4.
- **Mavrogiannis, Mavrogiannis, Aloimonos (2024)**, "Cook2LTL: Translating
  cooking recipes to LTL formulae using large language models," ICRA — their
  [23]. Second-closest; recipe text → auditable intermediate representation.
- **Sochacki, Zhang, Abdulali, Iida (2024)**, "Towards practical robotic chef:
  Review of relevant work and future challenges," *Journal of Field Robotics*
  41(5):1596–1616 — their [5]. Survey; the fastest route into the rest of this
  literature.

---

## 6. DELIBERATELY NOT ADOPTED

Decisions with reasons. Re-open the argument here before implementing any of
these.

**LoRA fine-tuning for domain knowledge.** Direct opposite of this repo's
thesis. Their cooking knowledge lives in model weights, trained on 7,392 Q&A
pairs auto-extracted from 1,120 CNKI articles, and is evaluated by BLEU-4 and
ROUGE-L. Those metrics measure textual similarity to reference recipes — not
whether a recipe is correct, and not whether it is safe. Nothing traces to a
source; nothing carries a confidence level. `data/*.json` + `REFERENCES.md` +
`CitationSchema` is the more defensible design and the one this repo should
keep. (Their reported improvements are also arithmetically loose: 2.75 → 26.73
is described as a "23.98% improvement," which is the absolute point
difference, not a percentage.)

**The perception stack.** Scoped out by `ENGINE_INVARIANTS.md` #11, and
thinner than it looks on inspection. Their equation (1),
`S_focus = Var(∇²I)`, is the standard Laplacian-variance *blur/focus* metric
being repurposed as "clarity of the ingredient state" — it measures image
sharpness, not doneness. Equation (3)'s EMA has a dangling `C_t` term that is
never defined. Equations (10)–(11) define a dataset-quality metric and then
state that empirical computation of it is left for future work — a metric
introduced and never computed. Treat the perception content as directional,
not as reference math.

**"100% executability" as a quality claim.** It means the generated Python
runs without error. It does not mean the dish is correct, and it does not mean
the dish is safe. If this result is ever cited in repo docs, cite it for what
it measures — the end-to-end baseline's 20% is the load-bearing number, not
the staged pipeline's 100%.

**Recipe migration (their §V-C).** TICKET 4 deliberately takes reachability
and stops. Migration means proposing a *different* achievable goal from the
current state, which is planning under constraints, which this repo does not
have a planner for. `SIMULATION_TARGETS.md` #1 is the prerequisite. Do not
build a bespoke migration heuristic instead.

**Asynchronous supervisory intervention.** Requires a running execution
thread and live sensing. This repo compiles and validates offline; it has no
execution thread to supervise. The right OCR-side analogue is TICKET 4's
reachability query answered *offline, before execution*, which is strictly
more useful than discovering the same fact mid-dish.

---

## 7. Suggested order

1. TICKET 1 (`actionKind`) — cheap, unblocks TICKET 2, and its audit produces
   a genuinely useful inventory of where the one-shot model departs from
   physics.
2. TICKET 3 (dilution) — trivial, self-contained, closes a real gap in the
   newest module.
3. TICKET 6 (references) — trivial, and TICKET 4 should not start before
   Statler and Cook2LTL have been read.
4. TICKET 2 (execution bounds) — the integration story; do after 1.
5. TICKET 5 (failure states) — independent; slot in wherever.
6. TICKET 4 (reachability) — the real work. Do last, do slowly.
