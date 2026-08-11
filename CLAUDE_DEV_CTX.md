# Open Culinary Runtime (OCR) — Claude Pro Programming Guide 🤖🍳

This document acts as the definitive development context and system prompt for **Claude Pro (or any advanced LLM/coding agent)**. It provides a complete conceptual blueprint, file map, validation specifications, and reference code architectures to enable the seamless generation, validation, and extension of the **Open Culinary Runtime (OCR)** ecosystem.

---

## 🧭 System Instructions (Copy-Paste to Claude's System Prompt)

```markdown
You are a Lead Software Engineer and Culinary Informatics Architect specializing in the Open Culinary Runtime (OCR) and OpenRecipe standards. 

Your objective is to help write, validate, and extend TypeScript and Python engines that treat recipes as deterministic, executable state machines using an Entity-Component-System (ECS) architecture rather than static text blocks.

### Core Architectural Pillars
1. **Entities ("What"):** Describe physical, reusable objects. Separates consumable ingredients (e.g., "potato") from reusable cookware or utensils (e.g., "frying-pan", "chef-knife").
2. **States ("Physical Conditions"):** Describe broad, observable physical conditions of an entity (e.g., "raw", "peeled", "chopped", "boiled", "liquid").
3. **Actions ("Changes"):** Describe physical transformations that act as transition boundaries, consuming inputs in State A and yielding outputs in State B.
4. **Parameters ("Culinary Details"):** Describe quantitative details modifying the physics, timing (seconds), or safety critical thresholds (HACCP) of a specific action.

### Strict Simulation Heuristics
- **Conservation of Mass & Entities:** When a step executes (e.g., "separate"), the parent entity is consumed/destroyed from the simulation inventory, and the disjoint child entities (e.g., "egg_yolk" and "egg_white") are spawned in its place.
- **Physical Feasibility Restrictions:** Prevent logically impossible state transitions. Block actions that violate the physics matrix (e.g., you cannot "peel" a potato that is already "boiled", and you cannot "chop" something that is "mashed" or "liquid").
- **HACCP Critical Control Points (CCPs):** Thermal steps must enforce safety thresholds (e.g., holding a minimum internal temperature of 135°F for at least 15 seconds).
- **Cooklang Interoperability:** Treat Cooklang as the primary human-writable interface. Maintain full backward-compatibility with custom scaling rules (multiplier factors) and spice locks (quantities prefixed with `=` do not scale linearly).
- **Schema.org Complement:** Treat Schema.org JSON-LD as a flat, lossy target for public search-engine indexation. Provide lossless conversions from rich, nested OCR JSONs to flat, readable string arrays.
```

---

## 📂 Repository File Map & Specifications

Claude should respect the following modular file layout when writing or updating code:

### 1. `ingredient.ts` (Core Entity & Ingestion Models)
Defines the vocabulary of things in the kitchen. 
- **`EntitySchema`:** Validates static entities, separating ingredients and tools.
- **`RecipeIngredientSchema`:** Handles instance portion sizes, quantities (fraction/decimal union), and localized translations.
- **`ParsedIngredientSchema`:** Handles temporary storage for unstructured regex parser runs before entity mapping.

### 2. `recipe-step.ts` (Execution Sequence & HACCP Safety)
Models the mechanical actions, states, and safety boundaries.
- **`EntityStateSchema`:** Captures an entity ID, active physical state, quantity, and unit.
- **`CriticalControlPointSchema`:** Tracks USDA-compliant HACCP thresholds (phases, critical temperature limits in Fahrenheit, and holding times).
- **`MechanicalActionSchema`:** Validates a step sequence, requiring an array of tools used, inputs consumed, and outputs generated.

### 3. `recipe.ts` (The Complete Compiled Script)
- **`RecipeScriptSchema`:** The overall container mapping initial inventory states (initial kitchen setup) and the linear execution sequence.

### 4. `nutrition-extension.ts` (Optional Pluggable Metadata)
- **`UsdaMealPatternContributionSchema`:** Maps school lunch nutritional ounce/cup equivalents (grains, protein, vegetables) to core ingredients without bloating the core spec.

---

## 🚀 Reference Code Architectures

Feed these exact implementations to Claude to ensure coding consistency:

### A. The Core Validation Engine (`ocr-engine.ts`)
```typescript
import { RecipeScript, EntityState, MechanicalAction } from './ocr-schema';

export interface ValidationError {
  stepId: string;
  verb: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  finalInventory: EntityState[];
}

const INVALID_TRANSITIONS: Record<string, string[]> = {
  boiled: ['raw', 'peeled'],
  fried: ['raw', 'peeled', 'boiled'],
  mashed: ['raw', 'peeled', 'chopped', 'sliced', 'diced', 'boiled'],
  liquid: ['raw', 'peeled', 'chopped', 'sliced', 'diced', 'boiled', 'mashed'],
};

export class OcrValidationEngine {
  private inventory: Map<string, EntityState> = new Map();

  constructor(initialInventory: EntityState[]) {
    for (const item of initialInventory) {
      this.inventory.set(item.entityId, { ...item });
    }
  }

  public validate(recipe: RecipeScript): ValidationResult {
    const errors: ValidationError[] = [];
    for (const step of recipe.sequence) {
      const stepErrors = this.validateStep(step);
      if (stepErrors.length > 0) {
        errors.push(...stepErrors);
      } else {
        this.applyStep(step);
      }
    }
    return {
      isValid: errors.length === 0,
      errors,
      finalInventory: Array.from(this.inventory.values()),
    };
  }

  private validateStep(step: MechanicalAction): ValidationError[] {
    const errors: ValidationError[] = [];

    // Pre-requisites & Requirements check
    if (step.requirements) {
      for (const req of step.requirements) {
        const invItem = this.inventory.get(req.entityId);
        if (!invItem) {
          errors.push({ stepId: step.id, verb: step.verb, message: `Missing entity: ${req.entityId} not in inventory.` });
          continue;
        }
        if (req.requiredState && invItem.state !== req.requiredState) {
          errors.push({ stepId: step.id, verb: step.verb, message: `State conflict: ${req.entityId} must be ${req.requiredState}, got ${invItem.state}.` });
        }
      }
    }

    // Input state transition logic check
    for (const input of step.inputs) {
      const invItem = this.inventory.get(input.entityId);
      if (!invItem) {
        errors.push({ stepId: step.id, verb: step.verb, message: `Execution failed: Input ${input.entityId} not available.` });
        continue;
      }

      const forbiddenNextStates = INVALID_TRANSITIONS[invItem.state] || [];
      if (forbiddenNextStates.includes(input.state)) {
        errors.push({
          stepId: step.id,
          verb: step.verb,
          message: `Forbidden transition: Cannot transform ${input.entityId} from ${invItem.state} to ${input.state}.`
        });
      }
    }
    return errors;
  }

  public applyStep(step: MechanicalAction): void {
    for (const input of step.inputs) {
      const invItem = this.inventory.get(input.entityId);
      if (invItem) {
        if (input.quantity && invItem.quantity !== undefined) {
          invItem.quantity -= input.quantity;
          if (invItem.quantity <= 0) this.inventory.delete(input.entityId);
        } else {
          this.inventory.delete(input.entityId);
        }
      }
    }
    for (const output of step.outputs) {
      const existing = this.inventory.get(output.entityId);
      if (existing) {
        existing.state = output.state;
        if (output.quantity && existing.quantity !== undefined) existing.quantity += output.quantity;
      } else {
        this.inventory.set(output.entityId, { ...output });
      }
    }
  }
}
```

### B. Bi-directional Compilers (`ocr-converter.ts`)
Must convert standard text formatting to structured Schema.org fields or parse inline Cooklang text tokens:
```typescript
import { IngredientModel } from './ocr-schema';

export function compileToSchemaOrgIngredient(ing: IngredientModel): string {
  if (ing.rawString) return ing.rawString;
  const parts: string[] = [];
  if (ing.quantity) parts.push(ing.quantity.toString());
  if (ing.unit) parts.push(ing.unit);
  parts.push(ing.name);
  let baseString = parts.join(" ");
  if (ing.preparation) baseString += `, ${ing.preparation}`;
  return baseString.trim();
}
```

---

## 🛠️ Direct Programming Assignments

Instruct Claude Pro to program the following active tasks:

### Assignment 1: Web Scraper Pipeline (Python / BeautifulSoup)
Have Claude write a Python parsing script that:
1. Ingests a raw recipe web URL, requests the page, and extracts `<script type="application/ld+json">`.
2. Parses the lossy Schema.org `recipeIngredient` strings and uses regex / NLP heuristics to tokenize them into `quantity`, `unit`, `name`, and `preparation`.
3. Auto-generates Cooklang text and compiles it into an executable OCR JSON script.

### Assignment 2: Mobile Reference App (React Native + Expo)
Have Claude design screens matching our 4-tab navigator specifications:
1. **Discover Screen:** Real-time search of local recipe folders with interactive cooking steps.
2. **Community Screen:** Feed with async `FormData` recipe post uploads and an active `onUploadProgress` hook.
3. **Meal Plan Screen:** Parsing and mapping `.menu` schedules.
4. **Profile Screen:** Handling JWT tokens with automatic logout when expired.

### Assignment 3: Home Assistant HACS Component (Python)
Have Claude program a custom Home Assistant platform that:
1. Interfaces with a local CookCLI server running on `http://localhost:9080`.
2. Creates sensors to track expiring food and depleted pantry items.
3. Automatically populates HA Calendar cards using parsed `.menu` file schedules.
