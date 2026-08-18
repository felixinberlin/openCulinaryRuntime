import type { Action } from "./action.ts";
import type { RecipeScript } from "./recipe.ts";
import type { CriticalControlPoint } from "./thermal.ts";
import type { DomainFact, Entity } from "./ingredient.ts";

/**
 * A real query interface over the structured domain data — answers a
 * question by reading only the already-validated, already-cited JSON in
 * `data/`, never generating an answer from general knowledge. See
 * `reference/query.md` for design rationale.
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
  /** Whether this parameter actually determines the resulting state, or
   *  is informational only. */
  stateDetermining: boolean;
  /** Every metadata.*Note field on the action whose key or text mentions
   *  this parameter id. */
  relevantNotes: { key: string; text: string }[];
  /** Every recipe step found using this action, with the value it chose
   *  for this parameter (if any). */
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

/** The `CriticalControlPointSchema.domainFacts` sibling of
 *  `answerAboutParameter` above — returns the already-validated,
 *  already-typed `DomainFact` directly, no prose parsing. See
 *  `reference/query.md`. */
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

/** The `EntitySchema.domainFacts` sibling of `answerAboutDomainFact`
 *  above. See `reference/query.md`. */
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
