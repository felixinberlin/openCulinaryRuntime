import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import type { DomainFact, Entity } from "./ingredient.ts";

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
  recipeUsages: {
    recipeId: string;
    recipeNameEn: string;
    stepIndex: number;
    value: string | undefined;
  }[];
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

/**
 * The `CriticalControlPointSchema.domainFacts` sibling of
 * `answerAboutParameter` above (`ingredient.ts`'s `DomainFactSchema`,
 * `ROADMAP.md`'s "Structured DomainFact/PhysicalProperty records" gap,
 * closed 2026-08-17) — the concrete answer to that gap's own stated
 * problem: "a robot's planner/verifier cannot safely consult an English
 * paragraph for a safety-critical number at runtime." This returns the
 * already-validated, already-typed `DomainFact` object directly — no
 * prose parsing involved, matching `ENGINE_INVARIANTS.md` #10 the same way
 * `answerAboutParameter` already does for action parameters.
 */
export interface DomainFactAnswer {
  ccpId: string;
  ccpNameEn: string;
  factId: string;
  fact: DomainFact;
}

export function answerAboutDomainFact(
  ccps: Map<string, CriticalControlPoint>,
  ccpId: string,
  factId: string
): DomainFactAnswer | undefined {
  const ccp = ccps.get(ccpId);
  if (!ccp) return undefined;
  const fact = ccp.domainFacts[factId];
  if (!fact) return undefined;
  return { ccpId: ccp.id, ccpNameEn: ccp.names.en, factId, fact };
}

/**
 * The `EntitySchema.domainFacts` sibling of `answerAboutDomainFact` above
 * — `ingredient.ts`'s `EntitySchema.domainFacts`, extended to entities
 * 2026-08-17 once a real second forcing case existed
 * (`kosher_salt.json`'s/`flaky_salt.json`'s real, cited
 * grams-per-teaspoon figures). Same shape, same reasoning, a different
 * source map.
 */
export interface EntityDomainFactAnswer {
  entityId: string;
  entityNameEn: string;
  factId: string;
  fact: DomainFact;
}

export function answerAboutEntityDomainFact(
  entities: Map<string, Entity>,
  entityId: string,
  factId: string
): EntityDomainFactAnswer | undefined {
  const entity = entities.get(entityId);
  if (!entity) return undefined;
  const fact = entity.domainFacts[factId];
  if (!fact) return undefined;
  return { entityId: entity.id, entityNameEn: entity.names.en, factId, fact };
}
