import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";

/**
 * A real query interface over the structured domain data — the answer to
 * "I want this system to answer robot questions in the domain scope."
 * CONCEPT.md §14's boundary applies here exactly: an LLM's job is turning a
 * free-text question into a structured lookup (which action, which
 * parameter) — it is NOT this module's job to generate an answer from
 * general knowledge, and it's not what this returns. Everything below reads
 * only from the already-validated, already-cited JSON in data/ — the same
 * data ENGINE_INVARIANTS.md #10 already requires be authoritative over an
 * LLM for validation rules, now made queryable for domain QUESTIONS too, not
 * just execution.
 */

export interface ParameterAnswer {
  actionId: string;
  actionVerb: string;
  parameterId: string;
  /** Closed-set values, if this parameter uses allowedValues. */
  allowedValues?: string[];
  /** Continuous range, if this parameter uses numericRange. */
  numericRange?: { unit: string; min: number; max: number };
  required: boolean;
  /** Whether this parameter actually determines the resulting state
   *  (transformedStateFromParameter) or is informational only — a real,
   *  load-bearing distinction this whole codebase has been careful about;
   *  answering a domain question without surfacing this would overstate
   *  how much the system actually enforces. */
  stateDetermining: boolean;
  /** Every metadata.*Note field on the action whose key or text mentions
   *  this parameter id — the actual sourced domain knowledge, not a summary
   *  of it. */
  relevantNotes: { key: string; text: string }[];
  /** Every recipe step found using this action, with the value it chose for
   *  this parameter (if any) — real precedent, not a hypothetical. */
  recipeUsages: { recipeId: string; recipeNameEn: string; stepIndex: number; value: string | undefined }[];
}

export function answerAboutParameter(
  actions: Map<string, Action>,
  recipes: Map<string, RecipeScript>,
  actionId: string,
  parameterId: string
): ParameterAnswer | undefined {
  const action = actions.get(actionId);
  if (!action) return undefined;
  const param = action.parameters.find((p) => p.id === parameterId);
  if (!param) return undefined;

  const relevantNotes: { key: string; text: string }[] = [];
  for (const [key, value] of Object.entries(action.metadata)) {
    if (typeof value !== "string") continue;
    if (key.toLowerCase().includes(parameterId.toLowerCase()) || value.includes(parameterId)) {
      relevantNotes.push({ key, text: value });
    }
  }

  const recipeUsages: ParameterAnswer["recipeUsages"] = [];
  for (const recipe of recipes.values()) {
    recipe.sequence.forEach((step, stepIndex) => {
      if (step.actionId === actionId) {
        recipeUsages.push({
          recipeId: recipe.id,
          recipeNameEn: recipe.names.en,
          stepIndex,
          value: step.params[parameterId],
        });
      }
    });
  }

  return {
    actionId: action.id,
    actionVerb: action.verb,
    parameterId,
    allowedValues: param.allowedValues,
    numericRange: param.numericRange,
    required: param.required,
    stateDetermining: action.outputs.transformedStateFromParameter === parameterId,
    relevantNotes,
    recipeUsages,
  };
}
