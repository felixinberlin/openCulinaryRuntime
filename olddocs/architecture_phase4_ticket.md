# 🏗️ Architecture Ticket: openCulinaryRuntime Phase 4 & Beyond

**Created:** August 14, 2026  
**Status:** PLANNING (Not yet implemented)  
**Complexity:** HIGH (6-12 weeks estimated)  
**Blocking:** Nothing in Phase 1-3; architectural foundation for all future work  

> **Naming note (added during review pass, 2026-08-15):** `ROADMAP.md` already
> uses "Phase 4" for a different, mostly-closed body of work (`OcrValidationEngine`
> / `applyAction`, CCP enforcement, `COMBINE`, `FLIP` — see `ROADMAP.md`'s
> "Phase 4 — Validation engine" section). Everything this ticket calls "Phase 4"
> is what `ROADMAP.md` separately tracks as **"Phase 4.5 — Goal-directed
> planning"** (unstarted, same scope: planner, goal specs, closed-loop
> execution, domain facts — resolved in `WORLD_MODEL.md` 2026-08-12). This
> ticket is a detailed elaboration of that section, not a new proposal — read
> them together, and prefer `ROADMAP.md`'s phase numbering when cross-
> referencing elsewhere in the repo. Milestone numbers (M1-M5) below are this
> ticket's own internal breakdown, not `ROADMAP.md` phase numbers.

---

## Executive Summary

The openCulinaryRuntime has reached **Phase 3 completion** with a working schema/engine for deterministic recipe validation and execution. Phase 4 represents a **fundamental architectural evolution** from hand-authored linear sequences to **automated planning** over a formal domain model, enabled by reframing "recipe" from procedural instructions to declarative goal specifications.

**Key Decision:** The world (objects undergoing continuous transformation) is primary; a recipe is an intent layer on top, not the core. This was resolved 2026-08-12 in `WORLD_MODEL.md` and unblocks serious robot integration.

---

## 1. CURRENT ARCHITECTURE (Phase 1-3)

### 1.1 Core Design Pillars

✅ **Entity-Component-System (ECS) Model**
- `Entity`: Ingredient/tool/resource with properties, capabilities, possible states
- `Instance`: Runtime entity with current state/tags, position in inventory
- `Action`: Verb with preconditions (what must be true) and effects (what changes)
- `State`: Discrete label representing condition of an instance (raw, boiled, fried, ...)
- `Recipe` (Script): Linear sequence of action applications against an initial inventory

✅ **Knowledge Separation**
- Knowledge lives in **canonical definitions** (entity/action/tool JSON files)
- Recipes contain only **intent** (initial inventory + action sequence)
- No executable logic in recipes; all behavior derives from action definitions

✅ **Event-Sourced Execution**
- Every action application produces a log entry
- Current state is a projection of the event log
- Deterministic: same inputs → same output always
- Replayable: can replay/audit/verify any past execution

### 1.2 Schema Architecture

```
src/
├── ingredient.ts        # Entity, Instance definitions
├── action.ts            # Action schema (preconditions + effects)
├── thermal.ts           # D/z-value HACCP model
├── heat-source.ts       # Heat provider profiles + preheat estimation
├── altitude.ts          # Altitude → boiling point physics
├── egg-doneness.ts      # Egg timing reference tables (soft/medium/hard)
├── potato-doneness.ts   # Potato timing reference tables (piece size)
├── place.ts             # Heating container state (temperature over time)
├── recipe.ts            # RecipeScript: initial inventory + action sequence
├── recipe-runner.ts     # Execution engine: applies actions, logs events
├── engine.ts            # Core applyAction logic + CCP validation
├── registry.ts          # File loader for JSON definitions
└── query.ts             # [Closed 2026-08-12] Domain query interface — real,
                          # running (`npm run ask`), NOT a placeholder; see
                          # ROADMAP.md's Phase 4.5 entry for `answerAboutParameter`.

data/
├── entities/            # Ingredient/tool definitions (26 files as of this
                          # ticket's 2026-08-14 draft; 28 as of 2026-08-15 —
                          # butter.json/sunflower_oil.json added since)
├── actions/             # Action definitions (28 files, not 30)
├── ccps/                # Critical Control Points (3 files: egg cooking/pasteurization)
├── heat-sources/        # Heat provider profiles (3 files: gas/vitro/wood)
└── recipes/             # Hand-authored executable recipes (12 files, not 15)

tests/
├── engine.test.ts       # Core applyAction + CCP logic
├── altitude.test.ts     # Altitude/boiling physics
├── egg-doneness.test.ts # Doneness reference table
├── potato-doneness.test.ts
├── place.test.ts        # Temperature simulation
└── [6 more: action, heat-source, ingredient, recipe, recipe-runner, thermal —
    11 suites total, plus tests/helpers.ts (not itself a suite)]

scripts/
├── validate.ts          # Schema + cross-reference validation
├── boil-at-altitude.ts  # Altitude physics integration proof
├── cook-egg-many-ways.ts
└── [~26 more demo/capability-test scripts — see package.json's "scripts"
    block for the current authoritative list rather than a count here,
    since this count has already drifted once between this ticket's
    2026-08-14 draft and this 2026-08-15 review pass]
```

### 1.3 Key Implemented Features

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| Entity/action definitions | 1 | ✅ | Base ECS model |
| HACCP/CCP validation | 2 | ✅ | D/z-value thermal model |
| Doneness timing tables | 2 | ✅ | Egg/potato soft/medium/hard |
| Heat source physics | 2 | ✅ | Preheat estimation, control precision |
| Altitude correction | 3 | ✅ | Altitude → boiling point (Antoine eq.) |
| Tool capabilities | 2 | ✅ | isFryingVessel, isDeepVessel (capability-based) |
| State prerequisites | 2 | ✅ | Single state or array of acceptable states |
| Byproduct spawning | 2 | ✅ | Conservation of mass |
| Tag inheritance | 2 | ✅ | Pasteurized tag carries to byproducts |
| Secondary instances (COMBINE) | 2 | ✅ | Two-instance merge (potato + egg → tortilla) |
| Temperature simulation | 3 | ✅ | advanceTempSeconds generalized (water/oil) |
| Recipe execution logging | 1 | ✅ | Event log from applyAction |
| Autonomous vs. human safety modes | 2 | ✅ | Different CCP thresholds per SafetyPolicy |

### 1.4 Current Limitations (Documented, Not Bugs)

| Limitation | Phase | Category | Why Not Fixed | Scope Note |
|------------|-------|----------|---------------|-----------|
| Cold-start timing | — | Model gap | Would need ODE integration | Boiling-start only (matches existing tables) |
| Shared place-state | 4 | Architecture | Needs co-location tracking | Each ingredient has own temperature assumption |
| Inventory consumption | 4 | Feature | Not implemented | Only presence-check, no quantity tracking |
| Forbidden transitions | 4 | Feature | Manual per-action prerequisites only | No global state-transition matrix |
| Storage-duration hazards | 4 | Model gap | CCP schema temperature-only | No "keep at 4°C for X days" representation |
| REST verb | 4 | Feature | No elapsed-time modeling | Par-fry requires explicit rest but no mechanism |
| Robot control layer | 5+ | Architecture | Out of scope | Categorical parameters not mapped to actuators |
| Continuous perception | 5+ | Architecture | Out of scope | Discrete state is human/simplification layer |

---

## 2. WORLD MODEL & PHASE 4 VISION

### 2.1 Philosophical Resolution (WORLD_MODEL.md)

**The Fork:** CONCEPT.md §12 rejected step-sequence recipes in favor of goal-based specs. CLAUDE_DEV_CTX.md built linear sequences. These seemed incompatible until 2026-08-12.

**The Resolution:** Both are correct, at different levels.

```
Goal Spec (high-level intent)     ← What a human wants
         ↓
    Planner (search)              ← Automated planning over domain model
         ↓
RecipeScript (linear sequence)    ← What a robot executes
         ↓
Event Log (timeline)              ← What actually happened
```

**Key Insight:** The combination of `ActionSchema` + `EntitySchema` is already STRIPS/PDDL shaped:
- **Preconditions:** `ActionSchema`'s `requiredTargetCapability`, `requiredTools`, `requiredIngredientCapabilities` — plus `EntitySchema.statePrerequisites` (`src/ingredient.ts`; keyed per-action-id on the *target entity*, not a field on `ActionSchema` itself — a real split worth naming precisely, since a planner's precondition-graph builder needs to read both schemas, not just one)
- **Effects:** `transformedState`, `addsTag`, `spawnsTargetByproducts`, `destroysTarget`, `combinesInto` (all on `ActionSchema.outputs`)

Every hand-authored recipe is a **pre-computed plan** — what an automated planner would generate from a goal specification and this domain model.

### 2.2 Three Major Changes in Phase 4

#### A. Recipe Format Evolution: Script → Goal Spec

**Current (Linear Script):**
```json
{
  "id": "tortilla_de_patatas",
  "initialInventory": [...],
  "sequence": [
    { "verb": "PEEL", "targetInstanceId": "potato-1", ... },
    { "verb": "CUT", "targetInstanceId": "potato_peeled-1", ... },
    { "verb": "FRY", "targetInstanceId": "potato_cut-1", ... },
    ...
  ]
}
```

**Phase 4 (Goal Spec):**
```json
{
  "id": "tortilla_de_patatas",
  "goal": {
    "primaryEntity": "tortilla_mixture",
    "state": "fried",
    "tags": ["flipped"]
  },
  "constraints": [
    "never exceed any non-advisory CCP",
    "final dish must be safe for autonomous consumption",
    "must use available ingredients in initialInventory"
  ],
  "requiredCapabilities": [
    "isCombinableBase", "isCombinableAddition",
    "isFryable", "isFlippable"
  ],
  "tolerance": {
    "durationSeconds": { "target": 900, "acceptable_range": [700, 1100] },
    "oilTempC": { "target": 175, "acceptable_range": [165, 190] }
  },
  "variants": {
    "onion_free": { "constraints_add": ["never touch onion"] }
  },
  "metadata": {
    "servings": 2,
    "difficulty": "intermediate",
    "basedOn": "traditional Spanish recipe"
  }
}
```

**Impact:**
- ✅ Human-readable intent layer
- ✅ Multiple valid execution paths (planner picks one)
- ✅ Graceful degradation (can still use old hand-authored scripts)
- ✅ Declarative constraints instead of imperative steps

**Migration:** Old scripts stay valid as "worked examples"; planner must be able to reproduce them from goals.

---

#### B. Execution Model: Fail-Fast → Closed-Loop Replan

**Current (Phase 1-3):**
```
Step 1 → Step 2 → Step 3 (all pre-baked)
If Step 2 fails:
  - Log it
  - Continue to Step 3 anyway
  (Correct for offline validation, dangerous for robots)
```

**Phase 4 (Robot-Ready):**
```
Step 1 → Check: did it work?
  ✓ Continue to Step 2
  ✗ Halt, replan, try recovery routine
     (or escalate if unrecoverable)
```

**Implementation:**
- `ExecutionResult` gains `success: boolean` + `failureReason?: string`
- `recipe-runner.ts` gains a `RobotMode` that halts on any failure
- Planner generates recovery paths (alternative actions for same goal)
- Safety policy enforced on each step, not just logged

---

#### C. Domain Knowledge as Data: Prose → Queryable Schema

**Current (Hidden in Prose):**
```json
{
  "id": "egg_cooking",
  "metadata": {
    "note": "Egg white coagulates at 62-65°C, yolk at 65-70°C...",
    "coagulationReferenceC": {
      "eggWhite": [62, 65],
      "eggYolk": [65, 70]
    }
  }
}
```

**Phase 4 (Structured Data):**
```json
{
  "id": "egg_cooking",
  "domainFacts": [
    {
      "fact": "egg_white_coagulation_temp",
      "value": 64,
      "unit": "celsius",
      "confidence": "standard_reference",
      "source": "McGee, On Food and Cooking",
      "verified": true,
      "verified_date": "2026-08-14"
    },
    {
      "fact": "egg_yolk_coagulation_temp",
      "value": 67,
      "unit": "celsius",
      "confidence": "standard_reference",
      "source": "McGee, On Food and Cooking",
      "verified": true,
      "verified_date": "2026-08-14"
    }
  ],
  "metadata": {
    "note": "Original prose explanation stays here for humans"
  }
}
```

**Why:**
- 🚫 If a planner/robot needs "what temperature does egg white set at" at decision time, pulling it from English prose requires LLM interpretation → violates ENGINE_INVARIANTS #10
- ✅ Structured `DomainFact` schema: type-safe, source-tracked, verification-stamped
- ✅ Planner can query facts without LLM
- ✅ Humans still get prose explanation

---

### 2.3 What Phase 4 Does NOT Change

❌ **Not** a continuous physics simulator
- Out of scope, same reasoning as ENGINE_INVARIANTS #11
- Discrete state is intentional simplification layer for robots/humans
- Continuous measurement is a separate **perception layer** (Phase 5+)

❌ **Not** replacing existing `RecipeScript`/`engine.ts`
- Both remain as the planner's **target representation**
- Hand-authored recipes are "worked examples" the planner should reproduce
- All 15 existing recipes stay valid; this adds planning on top

❌ **Not** an immediate rewrite
- Too much scope for this cycle
- Implement planning as a separate layer initially
- Migrate old recipes incrementally

---

## 3. PHASE 4 DETAILED ARCHITECTURE

### 3.1 New Components

```
src/
├── planner.ts           # [NEW] Domain planner (search over actions)
│   ├── type Plan = Action[]
│   ├── function plan(goal: Goal, domain: Domain, init: Inventory): Plan
│   ├── function replan(failure: FailureReason, domain: Domain): Plan
│   └── // Backward-chaining, depth-first initially (adequate for recipes)
│
├── goal.ts              # [NEW] Goal specification schema
│   ├── type Goal = { primaryEntity, desiredState, constraints, tolerance }
│   ├── type Constraint = string (e.g., "CCP_safe", "autonomous_mode")
│   └── type Tolerance = { target, acceptable_range }
│
├── domain-model.ts      # [NEW] Planner's domain representation
│   ├── type DomainModel = { entities, actions, facts }
│   ├── function isValidTransition(from, to, action): boolean
│   └── // Derives precondition/effect graph at load time
│
├── domain-facts.ts      # [NEW] Queryable knowledge layer
│   ├── type DomainFact = { fact, value, unit, confidence, source, verified }
│   ├── function lookupFact(factId: string): DomainFact
│   └── // Fast lookup for planner/verifier decisions
│
├── robot-executor.ts    # [NEW] Closed-loop execution for robots
│   ├── type RobotExecutionMode = "supervised" | "autonomous" | "teleoperated"
│   ├── function executeWithReplan(plan, domain, mode): ExecutionTrace
│   └── // Halts on failure, replans or escalates
│
└── verification.ts      # [Enhanced] State predicates for goal checking
    ├── function isGoalSatisfied(instance, goal): boolean
    ├── function getGoalProgress(inventory, goal): number (0-1)
    └── // Replaces discrete "success/fail" with continuous progress
```

### 3.2 Data Schema Changes

**New Schema: `DomainFactSchema`**
```typescript
export const DomainFactSchema = z.object({
  fact: z.string().min(1),                // Unique ID (e.g., "egg_white_coagulation_temp")
  value: z.number(),                      // The actual value
  unit: z.string().min(1),               // "celsius", "seconds", "joules", etc.
  range: z.object({                      // Optional: natural variation
    min: z.number(),
    max: z.number(),
  }).optional(),
  confidence: z.enum([
    "standard_reference",                // Published, primary source
    "commonly_cited_unverified",         // Common knowledge, not personally verified
    "empirical_measurement",             // From experiment
    "theoretical_model",                 // Derived from first principles
  ]),
  source: z.string().min(1),             // Citation/reference
  verified: z.boolean(),                 // Was this fact independently checked?
  verified_date: z.string().optional(),  // When verification happened
  verified_by: z.string().optional(),    // Who verified it
  metadata: z.record(z.unknown()).optional(),
});
```

**New Schema: `GoalSpecificationSchema`**
```typescript
export const GoalSpecificationSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  goal: z.object({
    primaryEntityId: z.string(),         // "tortilla_mixture"
    desiredState: z.string(),            // "fried"
    desiredTags: z.array(z.string()),   // ["flipped"]
  }),
  constraints: z.array(z.object({
    type: z.enum(["safety", "feasibility", "preference"]),
    description: z.string(),
    enforcedBy: z.string().optional(),  // "egg_cooking CCP" or "inventory check"
  })),
  tolerance: z.object({
    durationSeconds: z.object({
      target: z.number(),
      acceptableRange: z.tuple([z.number(), z.number()]),
    }).optional(),
    temperature: z.object({
      target: z.number(),
      acceptableRange: z.tuple([z.number(), z.number()]),
    }).optional(),
    // ... other parameters
  }).optional(),
  initialInventory: z.array(RecipeInstanceSchema),
  metadata: z.record(z.unknown()).optional(),
});
```

**Enhanced: `ActionSchema`**
- Add `alternatives: string[]` (other actions that achieve similar effects)
- Add `recoveryActions: { [failureMode]: Action[] }` (what to try if this fails)
- Add `executionEstimates: { min_duration_seconds, typical_duration_seconds, max_duration_seconds }`

### 3.3 Planner Algorithm (Pseudo-Code)

```typescript
/**
 * Backward-chaining planner: work from goal back to initial state,
 * finding action sequence that satisfies preconditions and achieves effects.
 *
 * Simple for recipes (action graph is sparse, no resource competition),
 * adequate for deterministic validation use case.
 */
function plan(
  goal: Goal,
  domain: DomainModel,
  initialInventory: Inventory,
): Action[] | null {
  
  // Base case: goal already satisfied?
  if (isGoalSatisfied(initialInventory, goal)) {
    return [];
  }

  // Recursive case: find an action that helps, plan its preconditions
  for (const action of domain.actions) {
    
    // Does this action achieve the goal (direct effect)?
    if (actionContributesToGoal(action, goal)) {
      
      // Can we satisfy this action's preconditions?
      const preconditionPlan = planPreconditions(action, domain, initialInventory);
      if (preconditionPlan !== null) {
        // This action is viable; plan everything leading up to it
        const fullPlan = [...preconditionPlan, action];
        
        // Verify: does the full sequence actually work?
        const trace = simulate(fullPlan, initialInventory, domain);
        if (trace.success && isGoalSatisfied(trace.finalInventory, goal)) {
          return fullPlan;
        }
      }
    }
  }

  // No valid plan found
  return null;
}

/**
 * Verify a plan before returning it: simulate with actual applyAction,
 * not just precondition checks. A plan can pass precondition analysis
 * but still fail in practice (e.g., if a byproduct changes state in a way
 * that violates a later action's prerequisites).
 */
function simulate(
  actions: Action[],
  initialInventory: Inventory,
  domain: DomainModel,
): ExecutionTrace {
  let inventory = initialInventory;
  const log = [];
  
  for (const action of actions) {
    const result = applyAction(action, domain, inventory);
    log.push(result);
    if (!result.success) {
      return { success: false, log, finalInventory: inventory };
    }
    inventory = result.updatedInventory;
  }
  
  return { success: true, log, finalInventory: inventory };
}

/**
 * When an action fails during execution, generate a recovery plan.
 * For a robot: try alternative actions, check for constraint violations,
 * possibly backtrack and replan from an earlier state.
 */
function replan(
  failurePoint: ExecutionTrace,
  lastSuccessfulStep: number,
  domain: DomainModel,
  goal: Goal,
): Action[] | null {
  // Fallback 1: Does the failing action have alternatives?
  if (failedAction.alternatives) {
    for (const altActionId of failedAction.alternatives) {
      const altAction = domain.actions.get(altActionId);
      if (canExecute(altAction, failurePoint.inventoryAt(lastSuccessfulStep))) {
        return [altAction, ...plan(goal, domain, failurePoint.inventoryAt(lastSuccessfulStep))];
      }
    }
  }
  
  // Fallback 2: Does the action define recovery steps?
  if (failedAction.recoveryActions[failureReason]) {
    const recovery = failedAction.recoveryActions[failureReason];
    return [...recovery, ...plan(goal, domain, failurePoint.inventory)];
  }
  
  // Fallback 3: Backtrack and replan from last success
  return plan(goal, domain, failurePoint.inventoryAt(lastSuccessfulStep));
}
```

### 3.4 Integration with Existing `recipe-runner.ts`

**Option A (Preferred): Planner as Optional Layer**
```
Goal Spec
    ↓
[Optional] Planner
    ↓
RecipeScript (generated or hand-authored)
    ↓
recipe-runner.ts (existing)
    ↓
Event Log
```

- Planner is **opt-in**, not mandatory
- Can still use hand-authored recipes directly
- Planner output feeds into existing execution engine
- No breaking changes to current workflows

**Option B (Future): Replace Hand-Authored Scripts**
```
Goal Spec
    ↓
Planner
    ↓
recipe-runner.ts
    ↓
Event Log
```

- Eventually, stop hand-authoring recipes
- Planner becomes the standard way to produce sequences
- Hand-authored recipes become "reference implementations" for testing

---

## 4. PHASE 4 IMPLEMENTATION ROADMAP

### 4.1 Milestones (6-12 weeks)

**Milestone 1: Planning Core (Weeks 1-2)**
- [ ] `planner.ts` basic backward-chaining search
- [ ] `goal.ts` goal specification schema
- [ ] `domain-model.ts` precondition/effect graph builder
- [ ] Unit tests for planner on simple cases (salt potato, boil egg)
- **Deliverable:** Planner can generate 2-3 existing hand-authored recipes from goals

**Milestone 2: Domain Facts & Verification (Weeks 3-4)**
- [ ] `domain-facts.ts` queryable knowledge layer
- [ ] Migrate existing `metadata.coagulationReferenceC` → `DomainFact` schema
- [ ] `verification.ts` enhanced with goal-satisfaction predicates
- [ ] Audit domain knowledge for consistency (all CCPs, all heat params)
- **Deliverable:** Planner can query facts, verify intermediate states against facts

**Milestone 3: Robot Execution & Replan (Weeks 5-7)**
- [ ] `robot-executor.ts` closed-loop execution mode
- [ ] Add `alternatives`, `recoveryActions` to action definitions
- [ ] `replan()` function for failure recovery
- [ ] Test against induced failures (e.g., fake a CCP violation)
- **Deliverable:** Robot can recover from a simulated action failure and replan

**Milestone 4: Constraint Handling & Optimization (Weeks 8-9)**
- [ ] Constraint language (safety, feasibility, preference)
- [ ] Planner respects hard constraints (safety) vs. soft (preference)
- [ ] Multi-goal satisfaction (tortilla must be fried AND flipped AND safe)
- **Deliverable:** Planner can generate multiple valid plans and rank them

**Milestone 5: Integration & Validation (Weeks 10-12)**
- [ ] Integrate planner with existing recipe-runner.ts
- [ ] Validate planner output matches hand-authored recipes
- [ ] Update REFERENCES.md with new sourced facts
- [ ] Documentation: planner usage guide, debug mode
- **Deliverable:** Planner can reproduce all 15 existing recipes from goals

### 4.2 Acceptance Criteria

**Must Have:**
- ✅ Planner generates valid plans (simulated applyAction produces no errors)
- ✅ Generated plans satisfy goals (final state matches goal predicate)
- ✅ Planner handles constraints (respects safety CCPs, autonomous mode)
- ✅ Planner reproduces 80%+ of existing hand-authored recipes exactly
- ✅ Robot mode can recover from failure and replan
- ✅ All tests pass; no regressions in Phase 1-3 code
- ✅ TypeScript strict mode, no `any` types

**Nice to Have:**
- 🟡 Planner can optimize for minimal duration / minimal ingredients
- 🟡 Planner explains its reasoning ("chose BOIL over FRY because CCP requires 63°C")
- 🟡 Web UI for interactive goal → recipe generation
- 🟡 Adversarial testing (generate hard cases planner fails on)

---

## 5. PHASE 4 ARCHITECTURAL DECISIONS

### 5.1 Planner Strategy: Backward-Chaining Depth-First

**Why this choice:**
- ✅ Recipes are goal-oriented (work backward from desired dish)
- ✅ Action graph is sparse (small branching factor)
- ✅ Deterministic (same goal → same valid plans)
- ✅ Easy to debug (clear reasoning trace)
- ❌ Not optimal (doesn't minimize time/cost)
- ❌ Not complete (might fail on complex goals, but recipes are small)

**Alternatives considered:**
- Forward-chaining: Works in cooking (start with ingredients, apply actions), but harder to guide toward a specific goal
- Means-ends analysis: More sophisticated, overkill for small recipe graphs
- ASP (Answer Set Programming): More declarative, but requires external solver; recipes are small enough for simplicity

**Decision:** Start with backward-chaining. Switch to forward + lookahead if recipes grow complex (Phase 5+).

---

### 5.2 Failure Handling: Halt + Replan (Robot Mode)

**Why this choice:**
- ✅ Safe: robot doesn't proceed with invalid assumptions
- ✅ Debuggable: clear failure point and recovery attempt
- ✅ Aligns with ENGINE_INVARIANTS #11 (autonomous defaults safe)
- ❌ Slower: replanning adds latency
- ❌ Complex: needs fallback strategies

**Alternatives:**
- Optimistic retry: Just try the same action again (fragile, can loop infinitely)
- Silent skip: Omit failed step, continue (dangerous, violates preconditions downstream)
- Escalate immediately: Halt and wait for human input (too slow for autonomous)

**Decision:** Try alternatives first; replan if alternatives exhaust; escalate if replan fails.

---

### 5.3 Knowledge Representation: Structured Data + Prose

**Why this choice:**
- ✅ Machines query facts without LLM
- ✅ Humans still get explanation
- ✅ Verifiability: can mark facts as verified/unverified
- ✅ Backward compatible: prose notes stay, facts added alongside
- ❌ Duplication: same knowledge in two formats
- ❌ Maintenance: keeping them sync'd

**Alternatives:**
- Prose only (current): Simple, but can't be queried
- Formal ontology (OWL, RDFS): Powerful, but high learning curve
- Symbolic rules (Prolog): Executable, but recipe domain is small

**Decision:** Structured `DomainFact` schema alongside prose. Prose is source of truth; facts are queryable derivatives.

---

## 6. IMPACT ANALYSIS

### 6.1 On Existing Code (Phase 1-3)

**Zero Breaking Changes ✅**
- `Entity`, `Action`, `Instance`, `engine.ts`, `recipe-runner.ts` all unchanged
- Planner is an optional layer; existing recipes still work
- No migration required for existing data

**Enhancements (non-breaking):**
- `Action` gets optional `alternatives`, `recoveryActions` fields
- `DomainFact` schema added (no existing references)
- `GoalSpecification` schema added (parallel to `RecipeScript`)

---

### 6.2 On Robot Integration (Future)

**Enables:**
- Closed-loop execution (halt on failure, replan)
- Multi-goal satisfaction (tortilla must be fried AND flipped AND safe)
- Graceful degradation (try alternatives, recover)
- Explainability (why did planner choose action X?)

**Still Doesn't Enable (Phase 5+):**
- Actual sensor feedback (continuous perception layer)
- Actuator mapping (categorical parameters → real motor commands)
- Trajectory optimization (fastest path, minimal ingredients)

---

### 6.3 On Safety & Compliance

**Improves:**
- ✅ Constraint enforcement (hard constraints never violated)
- ✅ Fact verification (all domain facts tracked for source/verification status)
- ✅ Traceability (why did planner choose this sequence?)
- ✅ Autonomous mode defaults safe (replan on any CCP shortfall)

**Maintains:**
- ✅ ENGINE_INVARIANTS all held (LLM never authoritative, etc.)
- ✅ Determinism preserved (same goal → same valid plans)
- ✅ Event sourcing intact (timeline still append-only)

---

## 7. DEPENDENCIES & RISKS

### 7.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Planner generates invalid plans (precondition logic wrong) | Medium | High | Verify plans via simulate() before returning; test extensively |
| Action graph has cycles or contradictions | Low | High | Build domain-model.ts to detect and flag these statically |
| Replanning is too slow for interactive use | Medium | Medium | Profile; cache plans; limit search depth; add timeout |
| Domain facts get out of sync with prose documentation | Medium | Low | Test harness that cross-checks facts vs. action definitions |
| Planner gets stuck in local optima | Low | Low | Acceptable for Phase 4 (adequate for recipes); revisit if needed |

### 7.2 Scope Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Scope creep: "while we're refactoring, let's add X" | High | High | Commit to Phase 4 scope; defer nice-to-haves to Phase 5 |
| Time estimate is low (takes 12+ weeks) | Medium | Medium | Milestone checkpoints; can ship incremental value at M2, M3 |
| Existing test suite breaks during refactoring | Medium | High | Branch strategy; keep Phase 1-3 code untouched; add planner in parallel |

---

## 8. DECISION POINTS FOR STAKEHOLDERS

### 8.1 Approval Gate 1: Start of Phase 4
**Question:** Should we commit to automated planning?

**This ticket answers:**
- ✅ What does it enable? (Closed-loop robots, multi-goal recipes, recovery)
- ✅ What doesn't it break? (Nothing; Phase 1-3 code untouched)
- ✅ How long? (6-12 weeks)
- ✅ Is it the right direction? (Yes; resolves WORLD_MODEL.md, enables robot integration)

**Required decision:** Approve Phase 4 planning work? (Recommend: YES)

---

### 8.2 Approval Gate 2: Domain Facts Migration
**Question:** Should we migrate existing metadata into `DomainFact` schema?

**Scope:** Coagulation temps, CCP thresholds, heat parameters, doneness ranges (all data already exist as prose + some structured metadata)

**Effort:** ~1 week to audit and migrate all files

**Benefit:** Enables planner to query facts without LLM

**Required decision:** Migrate all domain facts now, or migrate incrementally? (Recommend: Incremental — do CCPs first since they're safety-critical)

---

### 8.3 Approval Gate 3: Hand-Authored Recipe → Planner Migration
**Question:** Should we stop writing recipes by hand?

**This happens at:** Milestone 5, after planner is validated

**Tradeoff:**
- ✅ Benefits: Planner handles complexity, generates alternatives, recovers from failures
- ❌ Cost: Manual recipes are useful for validation (prove planner can reproduce them)

**Recommendation:** Keep hand-authored recipes as "reference implementations"; phase out as planner matures.

---

## 9. GLOSSARY

| Term | Definition |
|------|-----------|
| **Goal** | What we want (primary entity in desired state with tags) |
| **Goal Spec** | Formal declaration of goal + constraints + tolerance |
| **Plan** | Sequence of actions that achieves goal from initial state |
| **Planner** | Algorithm that searches for valid plans |
| **Domain Model** | Set of entities, actions, facts available for planning |
| **Precondition** | What must be true for an action to apply |
| **Effect** | What changes when an action applies |
| **Constraint** | Hard rule (safety) or soft preference (efficiency) |
| **Recovery** | Alternative action or replan attempt after failure |
| **Robot Mode** | Execution that halts on failure and replans |
| **Domain Fact** | Queryable knowledge (temp, time, source, verification status) |
| **Verification** | Cross-check that fact matches a primary source |

---

## 10. APPENDICES

### A. Related Documents
- `CONCEPT.md` — Founding outline (Grandma First, Machine Deep)
- `WORLD_MODEL.md` — Resolution of linear vs. goal-based (Primary: world/events; Intent: recipes/goals)
- `ENGINE_INVARIANTS.md` — Non-negotiable rules (LLM never authoritative, etc.)
- `ROADMAP.md` — Phased build plan (Phases 1-3 complete; Phase 4 is planning)
- `LEARNINGS.md` — Session notes on decisions and discoveries

### B. Example: Planner Reproducing Existing Recipe

**Goal:**
```
goal: tortilla_de_patatas
  primary: tortilla_mixture
  state: fried
  tags: [flipped]
constraints:
  - never exceed egg_cooking CCP
  - safe for autonomous consumption
```

**Existing hand-authored recipe (tortilla_de_patatas.json):**
```
sequence:
  1. CUT potato-1 (halved_or_quartered)
  2. FRY potato_cut-1 (165°C, 8 min, PAR_FRY)
  3. REST potato_par_fried-1 (10 min)
  4. FRY potato_par_fried-1 (191°C, 2 min, FRY)
  5. COMBINE potato_fried-1 + egg_cracked-1 → tortilla_mixture-1
  6. FRY tortilla_mixture-1 (175°C, 3 min)
  7. FLIP tortilla_mixture_fried-1
  8. VERIFY egg_cooking CCP is satisfied
```

**Planner should generate:**
✅ Same sequence (or valid alternative)
✅ All preconditions satisfied
✅ All effects correct (mass conserved, tags inherited)
✅ Final state matches goal

---

### C. Pseudocode: Full Planner Example

See section 3.3 above.

---

## CONCLUSION

Phase 4 is the architectural evolution that transforms openCulinaryRuntime from **validated recipe execution** to **autonomous recipe generation and recovery**. It's enabled by reframing recipes as declarative goals instead of imperative scripts, and by recognizing that the existing action schema is already PDDL-shaped.

**Next Steps:**
1. ✅ Review this ticket with stakeholders
2. ⏳ Approve Phase 4 scope and budget
3. ⏳ Start Milestone 1 (planner core)
4. ⏳ Integrate with existing code
5. ⏳ Validate against 15 existing hand-authored recipes

**Estimated Timeline:** 6-12 weeks  
**Team Size:** 1-2 engineers  
**Risk Level:** Medium (algorithm complexity) / Low (integration risk)  
**Value Unlock:** Robot-ready execution, multi-goal recipes, failure recovery, explainability

