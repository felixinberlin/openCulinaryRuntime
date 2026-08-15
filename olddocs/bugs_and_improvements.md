# OpenCulinaryRuntime: Bugs & Areas for Improvement

**Analysis Date:** August 14, 2026  
**Scope:** Full codebase review - TypeScript, schemas, tests, validation, data integrity

---

## 🔴 CRITICAL ISSUES

### 1. **TypeScript Build Fails (TS5097 errors across all files)**
- **Severity:** HIGH - Blocks production builds
- **Problem:** All `.ts` files have import errors due to missing `allowImportingTsExtensions` compiler option
- **Evidence:** `npm run build` produces 32 TS5097 errors across src/, scripts/, tests/
- **Root Cause:** `tsconfig.json` doesn't enable `allowImportingTsExtensions` despite using `.ts` extensions in imports
- **Impact:** 
  - Can't compile to JavaScript via `tsc`
  - Only works via `tsx` (which bypasses TypeScript)
  - Distribution/production artifacts can't be built
- **Files Affected:** ALL `.ts` files (35+ files)
- **Fix:** Add `"allowImportingTsExtensions": true` to `tsconfig.json`'s `compilerOptions`
- **Note:** This is pre-existing per `LEARNINGS.md` (documented as filtering with `grep -v TS5097`), but still a real blocker for real deployment

### 2. **Silent Ingredient Instance ID Resolution Failures**
- **Severity:** HIGH - Data integrity issue, hard to debug
- **Problem:** Wrong/typo'd IDs in `RecipeStep.availableIngredientInstanceIds` fail **silently**, not loudly
- **Evidence:** `recipe-runner.ts` line 77-81 filters out undefined values without error
- **Impact:** 
  - A recipe step appears to run correctly even when it's not using the ingredient you intended
  - Safety chains can be silently broken (e.g., pasteurized egg fails to be recognized)
  - Discovered by accident in `handmade-alioli-egg-yolk.json` during session - referenced wrong instance ID for months
- **Root Cause:** `inventory.get(id)?.entityId` returns `undefined` for invalid IDs, then filter silently drops it
- **Example:** Recipe intended to use `egg_yolk-1` but the actual spawned ID was `egg_yolk-3` → silently ignored
- **Fix Options:**
  - Add validation to throw if an ingredient instance isn't found
  - Add stricter recipe validation that cross-checks spawned IDs against usage
  - Document this clearly in schema comments as a trap
- **Affected Files:** `recipe-runner.ts` line 77-81

### 3. **No Validation for Spawned Instance IDs in Recipes**
- **Severity:** HIGH - Data integrity issue
- **Problem:** Recipe files reference spawned instance IDs that can't be predicted from reading the file alone
- **Evidence:** Runtime spawn counter is global; `validate.ts` explicitly can't check this
- **Example:** `tortilla-de-patatas.json` referenced `egg_cracked-1` but actual ID was `egg_cracked-3`
- **Impact:** 
  - Recipe files can have incorrect instance references that only fail at runtime
  - Very hard to debug (requires running the script and comparing logs)
  - Documentation says to read the log, but there's no automated check
- **Root Cause:** Spawn IDs are assigned at runtime via counter; recipes can't pre-declare them
- **Fix Options:**
  - Add a validation mode that does a full simulation run and reports spawn ID mismatches
  - Generate a "recipe reference ID map" script that runs recipes and outputs actual IDs
  - Document this as a mandatory step in recipe authoring (run first, read log, then update IDs)
- **Affected Files:** `src/recipe-runner.ts`, `scripts/validate.ts`

---

## 🟠 HIGH-PRIORITY IMPROVEMENTS

### 4. **Inventory Consumption Not Implemented (Phase 4 Blocker)**
- **Severity:** HIGH - Architecture limitation
- **Status:** Documented as Phase 4 feature in `ROADMAP.md`
- **Problem:** `requiredIngredientCapabilities` only checks presence, never decrements inventory
- **Evidence:** `engine.ts` line 19-20 doc comment, confirmed in schema
- **Impact:**
  - Same oil instance can theoretically be used unlimited times in a recipe
  - No quantity tracking (needed for accurate nutritional info, cost, etc.)
  - Phase 4's full recipe-level inventory system still needed
- **Workaround:** Currently checked but not enforced; recipes can be written assuming limited supply
- **Missing:** 
  - Quantity tracking per instance
  - Depletion checks
  - Fractional consumption (e.g., use 1/2 of oil, leave 1/2)
- **Affected Files:** `engine.ts`, `action.ts`, would need `recipe-runner.ts` updates

### 5. **No Forbidden State Transition Matrix (Phase 4 Blocker)**
- **Severity:** HIGH - Safety/correctness gap
- **Status:** Documented as Phase 4 feature in `ROADMAP.md`
- **Problem:** Engine only checks prerequisites for specific actions, not general forbidden transitions
- **Evidence:** `engine.ts` line 14-20 doc comment
- **Examples:**
  - Nothing prevents peeling an already-boiled potato (physically impossible)
  - No general rule preventing nonsensical state chains
  - Only per-action `statePrerequisites` exist, which is narrower
- **Impact:**
  - Invalid recipes can run without errors
  - Need full INVALID_TRANSITIONS matrix (Phase 4 work)
- **Affected Files:** `engine.ts` (would need new validation layer)

### 6. **CCP Modeling Doesn't Fit Storage-Duration Hazards**
- **Severity:** MEDIUM - Incomplete safety model
- **Status:** Acknowledged in `LEARNINGS.md` and `CONCEPT.md`
- **Problem:** `CriticalControlPointSchema` only models cooking-temperature/hold-time CCPs, not storage hazards
- **Example:** Garlic-in-oil botulism risk (post-preparation refrigeration/acidification) can't be expressed
- **Impact:**
  - Some real food safety concerns are unrepresentable in current schema
  - `infuse.json` has a workaround `safetyNote` field (non-enforced)
  - No mechanism to track post-preparation conditions
- **Limitation:** This is architecturally intentional (CCP shape doesn't fit), not a bug per se, but worth noting
- **Needs:** New hazard type + validation mechanism for post-preparation conditions
- **Affected Files:** `src/thermal.ts`, `data/actions/infuse.json`

---

## 🟡 MEDIUM-PRIORITY IMPROVEMENTS

### 7. **Informational-Only Parameters Have No Robot-Safe Mappings**
- **Severity:** MEDIUM - Robot execution limitation
- **Status:** Documented in `LEARNINGS.md` and `ENGINE_INVARIANTS.md` #11
- **Problem:** Many parameters are documented human-readable hints with no defined actuator mappings
- **Examples:** 
  - `heatLevel: "high"` (no defined temp)
  - `doneness` parameter (visual judgment call)
  - `agitation`, `curdSize`, `oilAdditionRate` (all subjective)
- **Impact:**
  - `SafetyPolicy.mode = "autonomous"` is NOT safe for unsupervised robot execution
  - Robot can't translate these hints to real control setpoints
  - No closed-loop perception layer exists
- **Documentation:** `ENGINE_INVARIANTS.md` #11 correctly flags this but could be more prominent
- **Needs:** 
  - Either real sensor/control layer (outside scope) OR
  - Formal robot-safe parameter constraints for each action
- **Affected Files:** `engine.ts` (doc comment), multiple action JSONs

### 8. **No Byproduct/Combined Ingredient Tag Inheritance Until Recently**
- **Severity:** MEDIUM (FIXED) - Safety chain issue
- **Status:** Documented in `LEARNINGS.md` as fixed
- **Problem:** Spawned instances from byproducts started with `tags: []`, losing parent safety tags
- **Example:** A `pasteurize` → `separate` → `emulsify` chain would lose the "pasteurized" tag
- **Status:** ✅ FIXED in engine.ts (lines 276-291) - tags now inherited and filtered
- **Note:** Every entity receiving an inherited tag must declare it in `possibleTags`
- **Verification:** Good test coverage in `engine.test.ts` (lines 182-192)
- **Affected Files:** `engine.ts` (fixed), `action.ts` (schema correct)

### 9. **HACCP CCP Check Only Triggers on Presence of `durationSeconds` Parameter**
- **Severity:** MEDIUM - Safety audit gap
- **Status:** Documented in `LEARNINGS.md`
- **Problem:** A long time passed with `egg_cooking.json` CCP not triggering because wrong action was checked
- **Discovery:** `handmade-alioli-egg-yolk.json` never cooked yolk, so `FRY`/`SCRAMBLE`/`POACH`/`BOIL` CCPs silently never applied
- **Fix:** ✅ Now has dedicated `PASTEURIZE` action with proper CCP wiring
- **Lesson:** For any raw-ingredient recipe, verify there's an action in the sequence the CCP can attach to
- **Risk:** Future recipes could have same issue if new actions bypass existing CCPs
- **Affected Files:** `engine.ts` (lines 322-330 gating logic is correct), `data/actions/pasteurize.json` (new)

### 10. **No Canonical Recipe Variant Cross-Referencing**
- **Severity:** MEDIUM - Documentation/maintainability
- **Problem:** Recipe variants (e.g., `handmade-alioli.json` vs. `handmade-alioli-egg-yolk.json`) lack formal cross-references
- **Evidence:** Only documented in `LEARNINGS.md` as "use metadata to cross-reference both directions"
- **Impact:**
  - Variants can drift without documentation
  - No schema field for "variant of" relationship
  - Manual maintenance burden
- **Workaround:** Existing pairs use `metadata` to link, but no enforcement
- **Fix:** Add optional `metadata.variantOf` or formal `recipeVariants` schema field
- **Affected Files:** `recipe.ts` (RecipeScriptSchema)

### 11. **Missing Verification Field Audits (Old Actions)**
- **Severity:** MEDIUM - Documentation completeness
- **Status:** Partially resolved
- **Problem:** `VerificationCriterionSchema` was added recently; older actions may lack this field
- **Evidence:** Schema comment (action.ts line 232-233) says "existing actions predate this field"
- **Check Result:** All 28 action files DO have `verification` field (checked via grep)
- **Status:** ✅ Looks good - appears all actions were updated
- **Recommendation:** Keep auditing any new actions for verification + hazards
- **Affected Files:** `src/action.ts` (schema good), `data/actions/*.json` (all compliant)

### 12. **Hazards Field Completeness**
- **Severity:** MEDIUM - Safety documentation
- **Status:** Good
- **Check Result:** All 28 action files have `hazards` field
- **Note:** Empty `hazards: []` is a real claim (no physical hazard), not an unfilled field
- **Good Practice:** `SALT` correctly has `hazards: []` (no hazard), not missing the field
- **Affected Files:** `src/action.ts` (schema enforces), `data/actions/*.json` (compliant)

---

## 🟢 LOW-PRIORITY IMPROVEMENTS / ENHANCEMENTS

### 13. **No Composite Dish Entity Assembly (Phase 4 Feature)**
- **Severity:** LOW - Feature gap, not a bug
- **Status:** Documented in `LEARNINGS.md` and `ROADMAP.md`
- **Problem:** `EntitySchema.structure.composite/components` exists but nothing uses it yet
- **Example:** `garlic-oil-potatoes.json` is a salad of "fried garlic" + "fried potatoes" but can't formally assemble them
- **Workaround:** Recipe is just named dish; composite entity structure not populated
- **Needs:** New `ASSEMBLE` verb or merge-instances mechanic (Phase 4)
- **Affected Files:** `src/ingredient.ts` (Schema has structure, but unused), recipes using composites

### 14. **Instance IDs Can't Be Predicted (Runtime Counter)**
- **Severity:** LOW - Usability issue, not a bug
- **Status:** Documented in `LEARNINGS.md`
- **Impact:** Recipe authors must run scripts to know actual spawned IDs
- **Workaround:** Always run first, read log output, then update recipe
- **Better:** Could add `--export-instance-map` mode to generate ID mappings
- **Affected Files:** `src/recipe-runner.ts` (line 116 counter)

### 15. **Action Retry Safety (`retrySafe` field) Needs More Audit**
- **Severity:** LOW - Safety metadata
- **Status:** Field exists and is used, but coverage could be verified
- **Check Result:** All actions have been audited for this per `LEARNINGS.md`
- **Definition:** 
  - `true` = safe to re-run (idempotent like `SALT` or destructive like `SEPARATE`)
  - `false`/unset = unsafe (like `PEEL` which produces byproducts if run twice)
- **Recommendation:** Document this clearly in new action templates
- **Affected Files:** `src/action.ts` (schema line 256)

### 16. **Heat Source Profiles Underutilized**
- **Severity:** LOW - Feature completeness
- **Status:** Exists but limited usage
- **Check Result:** Only 3 heat sources defined (gas, vitro, wood_fire)
- **Usage:** `boil-egg-heat-sources.ts` tests different preheat times
- **Opportunity:** Could expand to model more heat sources (induction, electric coil, open flame, etc.)
- **Potential Improvement:** Link heat profiles to actual temperature ramp times in recipes
- **Affected Files:** `src/heat-source.ts`, `data/heat-sources/`, `scripts/boil-egg-heat-sources.ts`

### 17. **Query Module Unused**
- **Severity:** LOW - Dead code or incomplete feature
- **Status:** Exists but appears unused
- **Check Result:** `src/query.ts` exists (85 lines) but no imports of it found in active code
- **Investigation Needed:** Is this:
  - Dead code ready for removal?
  - Infrastructure for future features?
  - Unfinished capability?
- **Recommendation:** Either document its purpose or remove it
- **Affected Files:** `src/query.ts`

### 18. **Validation Script Could Report More Actionable Errors**
- **Severity:** LOW - Developer experience
- **Problem:** `scripts/validate.ts` can't catch:
  - Wrong spawned instance IDs (by design - no simulation)
  - Logical recipe sequencing errors
  - Missing edges in state transitions
- **Workaround:** Run actual recipe scripts and check logs
- **Enhancement:** Could add `--simulate` mode that does full run and reports all errors
- **Affected Files:** `scripts/validate.ts`

### 19. **No Numeric Precision Validation for Thermal Parameters**
- **Severity:** LOW - Data quality
- **Problem:** Temperature/time parameters accept any number without semantic checking
- **Example:** Could theoretically specify `waterTempC: 1000` or `durationSeconds: -1`
- **Status:** Parameter ranges exist in schema, but no cross-validation
- **Example Needed:** For CCP-linked actions, `durationSeconds` range should relate to CCP's typical hold times
- **Affected Files:** `src/engine.ts`, action JSON files with numeric ranges

### 20. **Recipe Metadata Organization Could Be Standardized**
- **Severity:** LOW - Documentation
- **Status:** Metadata fields are freeform objects
- **Issue:** No schema for `metadata` contents; each recipe is inconsistent
- **Examples:** Some use `variantOf`, others might use different conventions
- **Recommendation:** Define a `metadata` schema with optional standard fields:
  - `variantOf: string`
  - `basedOn: string`
  - `dietaryRestrictions: string[]`
  - `difficulty: "beginner" | "intermediate" | "advanced"`
  - `servings: number`
- **Affected Files:** `src/recipe.ts` (RecipeScriptSchema line 257)

---

## 📋 SUMMARY TABLE

| Category | Count | Status |
|----------|-------|--------|
| **Critical** | 3 | Needs immediate fixes |
| **High Priority** | 3 | Architecture changes needed |
| **Medium Priority** | 9 | Improvements needed |
| **Low Priority** | 5 | Nice-to-have enhancements |
| **Fixed** | 2 | Already resolved ✅ |
| **Good** | 2 | No issues found ✅ |

---

## 🎯 RECOMMENDED ACTION PLAN

### Immediate (This Sprint)
1. **Fix TypeScript build** (Issue #1) - Add `allowImportingTsExtensions: true`
2. **Add validation for ingredient instance IDs** (Issue #2) - Throw on missing references
3. **Document spawned ID pattern** (Issue #3) - Create developer guide

### Near-term (Next Sprint)
4. **Implement simulated validation** (Issue #18) - `--simulate` mode for recipes
5. **Add CCP audit tooling** (Issue #9) - Verify all safety hazards are wired
6. **Standardize metadata schema** (Issue #20) - Define expected fields

### Medium-term (Phase 4 Planning)
7. **Inventory consumption** (Issue #4) - Track and enforce quantity limits
8. **Forbidden transition matrix** (Issue #5) - Full state validation
9. **Storage hazard modeling** (Issue #6) - Extend beyond cook-time CCPs
10. **Composite dish assembly** (Issue #13) - Implement ASSEMBLE verb

### Reference Documentation
- Keep `LEARNINGS.md` current with new discoveries
- Update `ENGINE_INVARIANTS.md` with robot-safety limitations
- Link this analysis to relevant ROADMAP.md phases

