# World Model Optimization Opportunities

The engine is solid for **Phase 1-3** (entity definitions, basic actions, recipe structure). Here are the real gaps that would make the model more complete and expressive.

---

## 1. INVENTORY CONSUMPTION (Phase 4 Blocker)

**Current state:** Ingredients don't get consumed. You can use oil-1 to fry egg, potato, and chicken all at once. It never runs out.

**What's missing:**
```typescript
interface RecipeStep {
  // Current:
  actionId: string;
  targetInstanceId: string;
  
  // Missing: how much ingredient is consumed?
  ingredientConsumption?: {
    instanceId: string;
    amount?: number;  // How much of the ingredient is used?
    unit?: string;    // grams, ml, "all"
  }
}
```

**Example:** To make a tortilla, you need **oil to fry multiple things**. But if oil runs out, subsequent steps fail.

**Impact:** Recipes become more realistic. You can model:
- Oil that runs out after 3 frying sessions
- Salt that runs out
- Ingredients that partially consumed (1 egg of 6)

**What to add:**
1. Extend `RecipeStep` to track ingredient consumption
2. Modify `engine.ts` to check available ingredient quantity
3. Decrement ingredient amounts after each action
4. Fail with "insufficient oil" instead of silently proceeding

**Effort:** Medium (2-3 days)

---

## 2. FORBIDDEN STATE TRANSITIONS

**Current state:** A potato can go from `raw` → `peeled` → `cut` → `fried` or `raw` → `boiled`. But the engine doesn't prevent impossible transitions.

**What's missing:**
```typescript
interface Entity {
  possibleStates: string[];
  // Missing: explicitly forbidden transitions
  forbiddenTransitions?: {
    from: string;
    to: string;
    reason?: string;  // "Can't unboil a potato"
  }[]
}
```

**Example:**
- Potato: `peeled` → `raw` is **forbidden** (can't un-peel)
- Egg: `fried` → `separated` is **forbidden** (can't unscramble)
- Egg: `raw` → `hard_boiled` → `runny` is **forbidden** (can't unbake)

**Current workaround:** You just don't write recipes with invalid transitions. The engine trusts you.

**What to add:**
1. Add `forbiddenTransitions` schema to `Entity`
2. Check in `applyAction()` before applying state change
3. Reject with clear error: "Can't transition potato from fried back to raw"

**Benefit:** Prevents nonsense recipes before they run.

**Effort:** Low (1 day)

---

## 3. CONCURRENT ACTIONS ON SHARED RESOURCES

**Current state:** The engine doesn't model shared resources. Both actions assume they succeed independently.

**What's missing:**
```typescript
interface Action {
  // Current: just lists required tools
  requiredTools?: string[];
  
  // Missing: does this action HOLD the tool for the duration?
  toolLockBehavior?: {
    toolId: string;
    duration?: number;  // Seconds held
    exclusive: boolean; // Only one action can use this tool at a time?
  }[]
}
```

**Example:**
- You can't use the same pan to fry two things simultaneously
- You can't use the oven while it's already baking
- But you CAN use a knife while something else boils (no conflict)

**Current state:** Engine runs steps sequentially, so no conflict happens. But it also can't model "fry potatoes while egg boils" properly.

**What to add:**
1. Add `toolLockBehavior` to `Action`
2. Track which tools are "locked" (in use) and until when
3. Check preconditions: "Can't fry with pan—already frying something else"
4. Mark tools as free after `durationSeconds` expire

**Benefit:** Enables richer concurrency modeling. Games/robots can see: "This tool is busy until second 600."

**Effort:** Medium (2-3 days)

---

## 4. COMPOSITE DISH ASSEMBLY (Phase 4 Feature)

**Current state:** Actions transform individual instances. You can't easily model "combine potato + egg + oil → tortilla_mixture".

**What's there:** `COMBINE` action exists but is underspecified.

**What's missing:**
```typescript
interface Action {
  // For COMBINE/ASSEMBLE actions:
  targetCount?: number;        // How many instances to combine?
  inputRequirements: {
    entityId: string;
    count: number;
    state?: string;           // Must be "fried", etc.
  }[]
  
  output: {
    spawnedEntityId: string;
    inheritsTagsFrom?: string[]; // Which inputs' tags carry to output?
  }
}
```

**Example:**
```json
{
  "id": "combine",
  "verb": "COMBINE",
  "inputRequirements": [
    { "entityId": "potato", "count": 1, "state": "fried" },
    { "entityId": "egg_white", "count": 1, "state": "fried" },
    { "entityId": "egg_yolk", "count": 1, "state": "raw" }
  ],
  "output": {
    "spawnedEntityId": "tortilla_mixture",
    "inheritsTagsFrom": ["potato", "egg_white"]
  }
}
```

**Current issue:** Engine doesn't verify all 3 inputs exist and are in the right state before combining.

**What to add:**
1. Extend precondition checking: "Need 1 fried potato, 1 fried egg white, 1 raw yolk"
2. Verify all inputs exist and match states
3. Spawn output with inherited tags
4. Mark all inputs as consumed/destroyed

**Benefit:** Recipes become more expressive. Final dish captures properties of its components.

**Effort:** Medium (2-3 days)

---

## 5. PARTIAL STATE & PROGRESS TRACKING

**Current state:** An action is instant. "Boil potato for 600s" → potato is immediately "boiled" with no intermediate states.

**What's missing:**
```typescript
interface Instance {
  entityId: string;
  state: string;
  tags: string[];
  
  // Missing: is this action still in progress?
  inProgressAction?: {
    actionId: string;
    startedAt: number;      // Epoch seconds
    durationSeconds: number;
    estimatedCompletion: number;
  }
}
```

**Example:**
```
Second 0: Boil potato
  potato-1: { state: "raw", inProgressAction: { actionId: "boil", durationSeconds: 600 } }

Second 300: Check potato
  potato-1: { state: "raw", inProgressAction: { ..., estimatedCompletion: 600 } }
  // Still cooking! Not done yet.

Second 600: Check potato
  potato-1: { state: "boiled", inProgressAction: null }
  // Now it's done
```

**Current workaround:** Engine doesn't track this. CLI layer must do it externally.

**What to add:**
1. Add `inProgressAction` field to `Instance`
2. Don't mark state as `"boiled"` until duration completes
3. New action type: `CHECK` or `INSPECT` that reads current progress
4. Preconditions can check: "Is potato still cooking?" → prevent using it

**Benefit:** Enables games/robots to model real-time cooking. You can pause, check, and resume.

**Effort:** Medium (2-3 days)

---

## 6. MULTI-TARGET ACTIONS

**Current state:** Each action targets one instance (PEEL one potato, FRY one egg).

**What's missing:**
```typescript
interface RecipeStep {
  actionId: string;
  targetInstanceId: string;      // Single target
  
  // Missing: batch operations
  targetInstanceIds?: string[];  // ["potato-1", "potato-2", "potato-3"]
  batchMode?: "sequential" | "parallel"
}
```

**Example:**
- PEEL [potato-1, potato-2, potato-3] (sequentially, 1 per step)
- WASH [egg-1, egg-2, egg-3] (in parallel, same action)

**Current:** You have to write 3 separate steps: PEEL potato-1, PEEL potato-2, PEEL potato-3.

**What to add:**
1. Extend `RecipeStep` to support `targetInstanceIds`
2. New execution mode: batch processor that applies action to each target
3. Track each separately (potato-1 peeled at step 1, potato-2 at step 2)

**Benefit:** Recipes more compact. Real chefs do "peel all 6 potatoes" not "peel potato 1, peel potato 2..."

**Effort:** Medium (2-3 days)

---

## 7. CAPABILITY CONSTRAINTS (Currently Weak)

**Current state:** You define `capabilities` on entities (isPeelable: true). But precondition checking is basic.

**What's missing:**
```typescript
interface Action {
  // Current:
  requiredTargetCapability: string;
  
  // Missing: gradation and properties
  requiredTargetCapabilities: {
    capabilityId: string;
    level?: number;           // Sharpness level: 1-10
    minValue?: number;        // At least this sharp
  }[]
}

interface Entity {
  capabilities: {
    isPeelable: boolean;
    
    // Missing: capability levels
    knifeSharpenss?: number;  // 0-10
    heatRetention?: number;   // How well does this hold temp?
  }
}
```

**Example:**
- A dull knife can't julienne (needs sharpness ≥ 8)
- A thin pan heats unevenly (low heatRetention)
- A sharp knife "CUT" and "JULIENNE" but dull knife only "CUT"

**Current:** No distinction. Knife is just "has knife" or "no knife".

**What to add:**
1. Extend `capabilities` to be objects with numeric properties
2. Precondition checks: "Need knife with sharpness ≥ 8"
3. Fail with reason: "Knife too dull for julienne"

**Benefit:** More realistic modeling. Tools degrade. Some actions need better equipment.

**Effort:** Low-Medium (1-2 days)

---

## 8. ALTERNATIVE ACTIONS & SUBSTITUTION

**Current state:** Each step names one specific action. No alternatives.

**What's missing:**
```typescript
interface RecipeStep {
  actionId: string;
  
  // Missing: can we use a different action?
  alternatives?: {
    actionId: string;
    tradeoff: string;  // "Takes 2x longer but less risk"
  }[]
}
```

**Example:**
- BOIL potato OR STEAM potato OR MICROWAVE potato
- Each produces slightly different state or takes different duration
- Engine should mark these as valid alternatives

**Current:** You write one recipe. No variants.

**What to add:**
1. Define `alternatives` in action definitions
2. When validating, mark as "step can use X or Y"
3. Recipe execution: pick one (user choice, or deterministic fallback)

**Benefit:** Games/robots can offer choices. "Want to boil (10 min) or steam (5 min)?"

**Effort:** Medium (2 days)

---

## 9. CONDITIONAL STEPS

**Current state:** Recipe always runs the same steps in the same order.

**What's missing:**
```typescript
interface RecipeStep {
  actionId: string;
  targetInstanceId: string;
  
  // Missing: only run this step IF...
  condition?: {
    checkType: "instance_state" | "instance_tag" | "ingredient_available"
    instanceId?: string;
    expectedState?: string;
    expectedTag?: string;
    otherwise: "skip" | "fail" | "branch_to_step"
  }
}
```

**Example:**
```
Step 1: CHECK egg doneness
  Condition: if state is "runny", skip step 2 (extra frying)
  
Step 2: FRY egg for 60s (optional)
  Only if yolk wasn't runny already
```

**Current:** No conditionals. All steps execute.

**What to add:**
1. Add `condition` to `RecipeStep`
2. Before executing step, evaluate condition
3. Skip or branch based on result

**Benefit:** Recipes adapt to current state. "If potato is big, boil longer."

**Effort:** Medium (2-3 days)

---

## Priority: What to Optimize First

### High Impact (Users immediately notice)

1. **Inventory Consumption** (Phase 4 blocker)
   - Without this, recipes aren't realistic
   - Players will ask "why didn't oil run out?"
   - Enables resource management gameplay

2. **Forbidden Transitions**
   - Quick win, prevents bad recipes
   - One day to implement

3. **Composite Dish Assembly**
   - Enables final-dish recipes
   - Games need this for cooking games

### Medium Impact

4. **Tool Locking for Concurrency**
   - Enables "fry potatoes while boiling water"
   - CLI layer needs this

5. **Partial State/Progress Tracking**
   - Enables real-time cooking sim
   - Games need this badly

### Lower Priority (Can Add Later)

6. Multi-target batch operations
7. Capability gradation
8. Alternative actions
9. Conditional steps

---

## Recommended Approach

### Week 1: Foundation (High Impact)
- [ ] **Inventory Consumption** — Extend `RecipeStep`, modify preconditions, decrement amounts
- [ ] **Forbidden Transitions** — Add schema, check in `applyAction()`
- [ ] **Composite Dish Assembly** — Enhance `COMBINE`, verify multi-input requirements

### Week 2: Concurrency Support (Medium Impact)
- [ ] **Tool Locking** — Track which tools are in use until when
- [ ] **Partial State** — Add `inProgressAction`, enable CHECK action

### Week 3: Polish & Expansion (Nice to Have)
- [ ] **Batch Operations** — Extend `RecipeStep` to handle multiple targets
- [ ] **Alternative Actions** — Mark substitutable actions in schema

---

## What to Tell the Engine Team

```
The engine is solid for basic recipes.
To make it production-ready for games/robots, add:

1. Inventory consumption (oil runs out after 3 uses)
2. Forbidden state transitions (can't un-peel a potato)
3. Multi-input assembly (combine potato + egg → tortilla)
4. Tool locking (can't use same pan for two things)
5. Partial progress (cooking is in-progress, not instant)

These aren't breaking changes—they extend the schema without breaking existing recipes.

Priority: Week 1 focuses on #1-3 (realistic resources and dish assembly).
Week 2 adds #4-5 (concurrent cooking).
```

---

## Files That Need Updating

### High Priority
- `src/ingredient.ts` → Add inventory consumption schema
- `src/engine.ts` → Check forbidden transitions, track tool locks
- `src/action.ts` → Enhance `COMBINE` with multi-input requirements
- `tests/engine.test.ts` → Add tests for new constraints

### Medium Priority
- `src/recipe.ts` → Add `inProgressAction` to `Instance`
- `data/entities/*.json` → Add `forbiddenTransitions` property
- `data/actions/*.json` → Add tool locking for relevant actions

---

## Does This Align with Your Vision?

These are **world model improvements**, not a separate CLI project. They make the engine more expressive and closer to real cooking constraints.

Which of these resonates? Should we start with inventory consumption?
